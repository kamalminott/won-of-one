import { supabase } from '@/lib/supabase';
import type {
  ClubCompetitionRecord,
  ClubCompetitionMatchRecord,
  ClubCompetitionParticipantRecord,
  ClubPoolAssignmentRecord,
  ClubPoolRecord,
  CompetitionFormat,
  CompetitionPoulesData,
  CompetitionPouleView,
  CompetitionOverviewData,
  CompetitionParticipantsData,
  CompetitionSummary,
  CompetitionWeapon,
  JoinCompetitionQrPayload,
  JoinCompetitionResult,
} from '@/types/competition';

const CLUB_COMPETITION_TABLE = 'club_competition';
const CLUB_COMPETITION_PARTICIPANT_TABLE = 'club_competition_participant';
const CLUB_POOL_TABLE = 'club_pool';
const CLUB_POOL_ASSIGNMENT_TABLE = 'club_pool_assignment';
const CLUB_COMPETITION_MATCH_TABLE = 'club_competition_match';

const JOINABLE_STATUSES = new Set(['registration_open', 'finalised']);
const WITHDRAWAL_EDITABLE_STATUSES = new Set([
  'poules_generated',
  'poules_locked',
  'rankings_locked',
  'de_generated',
]);

type CreateClubCompetitionInput = {
  userId: string;
  displayName: string;
  name: string;
  weapon: CompetitionWeapon;
  format: CompetitionFormat;
  deTouchLimit: 10 | 15;
};

type CreateClubCompetitionResult =
  | {
      ok: true;
      competition: ClubCompetitionRecord;
      qrPayload: string;
    }
  | {
      ok: false;
      message: string;
    };

type CompetitionActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
    };

const sanitizeDisplayName = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'Unnamed User';
};

const sanitizeCompetitionName = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ');
};

const normalizeJoinCode = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 6);
};

const generateJoinCode = (): string => {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
};

const isUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const text = [err.code, err.message, err.details, err.hint].filter(Boolean).join(' ').toLowerCase();
  return err.code === '23505' || text.includes('unique') || text.includes('duplicate');
};

const getSupabaseErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object') return '';
  const err = error as {
    message?: string;
    details?: string;
    hint?: string;
  };
  return [err.message, err.details, err.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const isRegistrationJoinBlocked = (status: string): boolean => {
  return !JOINABLE_STATUSES.has(status);
};

const toSummary = (
  row: Pick<ClubCompetitionRecord, 'id' | 'name' | 'weapon' | 'status' | 'updated_at' | 'finalised_at'>,
  role: 'organiser' | 'participant',
  participantCount: number
): CompetitionSummary => {
  return {
    id: row.id,
    name: row.name,
    weapon: row.weapon,
    status: row.status,
    role,
    participantCount,
    updatedAt: row.updated_at,
    finalisedAt: row.finalised_at,
  };
};

type PouleGenerationResult = {
  pool_count: number;
  participant_count: number;
  match_count: number;
};

const hasScoredPouleMatch = (match: ClubCompetitionMatchRecord): boolean => {
  return (
    match.status === 'live' ||
    match.status === 'completed' ||
    match.status === 'annulled_withdrawal' ||
    match.score_a != null ||
    match.score_b != null
  );
};

const isPendingPouleMatch = (match: ClubCompetitionMatchRecord): boolean => {
  return match.status === 'pending' || match.status === 'live';
};

const computePouleParticipants = ({
  assignments,
  matches,
  participantById,
  userId,
}: {
  assignments: ClubPoolAssignmentRecord[];
  matches: ClubCompetitionMatchRecord[];
  participantById: Map<string, ClubCompetitionParticipantRecord>;
  userId: string;
}) => {
  const statsByParticipantId = new Map<
    string,
    {
      wins: number;
      losses: number;
      hitsScored: number;
      hitsReceived: number;
      fightsRemaining: number;
    }
  >();

  assignments.forEach((assignment) => {
    statsByParticipantId.set(assignment.participant_id, {
      wins: 0,
      losses: 0,
      hitsScored: 0,
      hitsReceived: 0,
      fightsRemaining: 0,
    });
  });

  matches.forEach((match) => {
    const aStats = statsByParticipantId.get(match.fencer_a_participant_id);
    const bStats = statsByParticipantId.get(match.fencer_b_participant_id);
    if (!aStats || !bStats) return;

    if (isPendingPouleMatch(match)) {
      aStats.fightsRemaining += 1;
      bStats.fightsRemaining += 1;
    }

    if (match.status !== 'completed') {
      return;
    }

    const scoreA = match.score_a ?? 0;
    const scoreB = match.score_b ?? 0;
    aStats.hitsScored += scoreA;
    aStats.hitsReceived += scoreB;
    bStats.hitsScored += scoreB;
    bStats.hitsReceived += scoreA;

    const winnerId =
      match.winner_participant_id ??
      (scoreA > scoreB
        ? match.fencer_a_participant_id
        : scoreB > scoreA
          ? match.fencer_b_participant_id
          : null);

    if (winnerId === match.fencer_a_participant_id) {
      aStats.wins += 1;
      bStats.losses += 1;
    } else if (winnerId === match.fencer_b_participant_id) {
      bStats.wins += 1;
      aStats.losses += 1;
    }
  });

  return assignments
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((assignment) => {
      const participant = participantById.get(assignment.participant_id);
      const stats = statsByParticipantId.get(assignment.participant_id);
      if (!participant || !stats) {
        return null;
      }

      return {
        participant: {
          ...participant,
          isSelf: participant.user_id === userId,
        },
        assignment,
        stats: {
          participantId: assignment.participant_id,
          wins: stats.wins,
          losses: stats.losses,
          hitsScored: stats.hitsScored,
          hitsReceived: stats.hitsReceived,
          indicator: stats.hitsScored - stats.hitsReceived,
          fightsRemaining: stats.fightsRemaining,
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

const resolveCompetitionForJoin = async (
  joinCode: string,
  competitionId?: string | null
): Promise<ClubCompetitionRecord | null> => {
  const { data, error } = await supabase.rpc('resolve_club_competition_for_join', {
    p_join_code: joinCode,
    p_competition_id: competitionId ?? null,
  });

  if (error) {
    throw error;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] as ClubCompetitionRecord;
};

const upsertParticipantMembership = async (
  competition: ClubCompetitionRecord,
  userId: string,
  displayName: string
): Promise<JoinCompetitionResult> => {
  const { data: existingMembership, error: existingError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('id, role')
    .eq('competition_id', competition.id)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Unable to verify existing membership.',
    };
  }

  if (existingMembership) {
    return {
      ok: true,
      competition,
      role: existingMembership.role,
      readOnly: competition.status === 'finalised',
      alreadyJoined: true,
    };
  }

  if (isRegistrationJoinBlocked(competition.status)) {
    return {
      ok: false,
      reason: 'registration_locked',
      message: 'Registration is locked for this competition.',
    };
  }

  const { error: insertError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .insert({
      competition_id: competition.id,
      user_id: userId,
      display_name: sanitizeDisplayName(displayName),
      role: 'participant',
      status: 'active',
    });

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return {
        ok: true,
        competition,
        role: 'participant',
        readOnly: competition.status === 'finalised',
        alreadyJoined: true,
      };
    }
    const insertErrorMessage = getSupabaseErrorMessage(insertError);
    if (insertErrorMessage.includes('row-level security')) {
      return {
        ok: false,
        reason: 'unknown',
        message: 'Join is blocked by database policy in this environment. Run the latest competition migrations.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: 'Could not join this competition right now.',
    };
  }

  return {
    ok: true,
    competition,
    role: 'participant',
    readOnly: competition.status === 'finalised',
    alreadyJoined: false,
  };
};

export const buildCompetitionJoinQrPayload = (
  competitionId: string,
  joinCode: string
): string => {
  return `wonofone://competition/join?competition_id=${encodeURIComponent(
    competitionId
  )}&join_code=${encodeURIComponent(joinCode)}`;
};

export const parseCompetitionJoinQrPayload = (
  rawPayload: string
): JoinCompetitionQrPayload | null => {
  const payload = rawPayload.trim();
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as {
      competition_id?: string;
      competitionId?: string;
      join_code?: string;
      joinCode?: string;
    };
    const jsonCompetitionId = parsed.competition_id ?? parsed.competitionId;
    const jsonJoinCode = parsed.join_code ?? parsed.joinCode;
    if (jsonCompetitionId && jsonJoinCode) {
      const normalizedCode = normalizeJoinCode(jsonJoinCode);
      if (normalizedCode.length === 6) {
        return {
          competitionId: jsonCompetitionId,
          joinCode: normalizedCode,
        };
      }
    }
  } catch {
    // Not JSON payload, continue URL parsing.
  }

  try {
    const url = new URL(payload);
    const competitionId =
      url.searchParams.get('competition_id') ?? url.searchParams.get('competitionId');
    const joinCode =
      url.searchParams.get('join_code') ?? url.searchParams.get('joinCode');
    if (!competitionId || !joinCode) return null;
    const normalizedCode = normalizeJoinCode(joinCode);
    if (normalizedCode.length !== 6) return null;
    return {
      competitionId,
      joinCode: normalizedCode,
    };
  } catch {
    return null;
  }
};

export const listCompetitionSummariesForUser = async (
  userId: string
): Promise<{
  active: CompetitionSummary[];
  past: CompetitionSummary[];
}> => {
  const { data: memberships, error: membershipError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('competition_id, role')
    .eq('user_id', userId);

  if (membershipError || !memberships || memberships.length === 0) {
    return { active: [], past: [] };
  }

  const competitionIds = memberships
    .map((membership) => membership.competition_id as string)
    .filter(Boolean);

  const { data: competitions, error: competitionsError } = await supabase
    .from(CLUB_COMPETITION_TABLE)
    .select('id, name, weapon, status, updated_at, finalised_at')
    .in('id', competitionIds);

  if (competitionsError || !competitions || competitions.length === 0) {
    return { active: [], past: [] };
  }

  const { data: participantRows } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('competition_id')
    .in('competition_id', competitionIds);

  const participantCountMap = new Map<string, number>();
  participantRows?.forEach((row) => {
    const competitionId = row.competition_id as string;
    participantCountMap.set(
      competitionId,
      (participantCountMap.get(competitionId) ?? 0) + 1
    );
  });

  const membershipRoleByCompetitionId = new Map<string, 'organiser' | 'participant'>();
  memberships.forEach((membership) => {
    membershipRoleByCompetitionId.set(
      membership.competition_id as string,
      membership.role
    );
  });

  const summaries = competitions
    .map((competition) => {
      const role = membershipRoleByCompetitionId.get(competition.id as string);
      if (!role) return null;
      const count = participantCountMap.get(competition.id as string) ?? 1;
      return toSummary(
        competition as Pick<
          ClubCompetitionRecord,
          'id' | 'name' | 'weapon' | 'status' | 'updated_at' | 'finalised_at'
        >,
        role,
        count
      );
    })
    .filter((summary): summary is CompetitionSummary => summary !== null);

  const active = summaries
    .filter((summary) => summary.status !== 'finalised')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const past = summaries
    .filter((summary) => summary.status === 'finalised')
    .sort((a, b) => (b.finalisedAt ?? '').localeCompare(a.finalisedAt ?? ''));

  return { active, past };
};

export const createClubCompetition = async (
  input: CreateClubCompetitionInput
): Promise<CreateClubCompetitionResult> => {
  const name = sanitizeCompetitionName(input.name);
  if (name.length < 2) {
    return {
      ok: false,
      message: 'Competition name must be at least 2 characters.',
    };
  }

  let createdCompetition: ClubCompetitionRecord | null = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from(CLUB_COMPETITION_TABLE)
      .insert({
        name,
        weapon: input.weapon,
        format: input.format,
        de_touch_limit: input.deTouchLimit,
        status: 'registration_open',
        join_code: joinCode,
        created_by_user_id: input.userId,
      })
      .select('*')
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        continue;
      }
      return {
        ok: false,
        message: error.message || 'Unable to create competition right now.',
      };
    }

    createdCompetition = data as ClubCompetitionRecord;
    break;
  }

  if (!createdCompetition) {
    return {
      ok: false,
      message: 'Could not generate a unique join code. Please try again.',
    };
  }

  const { error: participantError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .insert({
      competition_id: createdCompetition.id,
      user_id: input.userId,
      display_name: sanitizeDisplayName(input.displayName),
      role: 'organiser',
      status: 'active',
    });

  if (participantError) {
    await supabase
      .from(CLUB_COMPETITION_TABLE)
      .delete()
      .eq('id', createdCompetition.id);
    return {
      ok: false,
      message: participantError.message || 'Could not create organiser membership.',
    };
  }

  return {
    ok: true,
    competition: createdCompetition,
    qrPayload: buildCompetitionJoinQrPayload(
      createdCompetition.id,
      createdCompetition.join_code
    ),
  };
};

export const joinCompetitionByCode = async (input: {
  userId: string;
  displayName: string;
  joinCode: string;
}): Promise<JoinCompetitionResult> => {
  const code = normalizeJoinCode(input.joinCode);
  if (code.length !== 6) {
    return {
      ok: false,
      reason: 'invalid_code',
      message: 'Enter a valid 6-digit code.',
    };
  }

  let competition: ClubCompetitionRecord | null = null;
  try {
    competition = await resolveCompetitionForJoin(code, null);
  } catch {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Unable to load competition details right now.',
    };
  }

  if (!competition) {
    return {
      ok: false,
      reason: 'invalid_code',
      message: 'Competition code is invalid.',
    };
  }

  return upsertParticipantMembership(
    competition,
    input.userId,
    input.displayName
  );
};

export const joinCompetitionByQr = async (input: {
  userId: string;
  displayName: string;
  rawPayload: string;
}): Promise<JoinCompetitionResult> => {
  const parsedPayload = parseCompetitionJoinQrPayload(input.rawPayload);
  if (!parsedPayload) {
    return {
      ok: false,
      reason: 'invalid_qr',
      message: 'QR code is invalid or expired.',
    };
  }

  let competition: ClubCompetitionRecord | null = null;
  try {
    competition = await resolveCompetitionForJoin(
      parsedPayload.joinCode,
      parsedPayload.competitionId
    );
  } catch {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Unable to load competition details right now.',
    };
  }

  if (!competition) {
    return {
      ok: false,
      reason: 'invalid_qr',
      message: 'QR code is invalid or expired.',
    };
  }

  return upsertParticipantMembership(competition, input.userId, input.displayName);
};

export const getCompetitionOverviewData = async (input: {
  userId: string;
  competitionId: string;
}): Promise<CompetitionOverviewData | null> => {
  const { data: competition, error: competitionError } = await supabase
    .from(CLUB_COMPETITION_TABLE)
    .select('*')
    .eq('id', input.competitionId)
    .maybeSingle();

  if (competitionError || !competition) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('role')
    .eq('competition_id', input.competitionId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (membershipError || !membership) {
    return null;
  }

  const { count } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('competition_id', input.competitionId);

  const participantCount = count ?? 0;
  const competitionRow = competition as ClubCompetitionRecord;

  return {
    competition: competitionRow,
    role: membership.role,
    participantCount,
    isReadOnly: competitionRow.status === 'finalised',
  };
};

export const getCompetitionParticipantsData = async (input: {
  userId: string;
  competitionId: string;
}): Promise<CompetitionParticipantsData | null> => {
  const overview = await getCompetitionOverviewData(input);
  if (!overview) {
    return null;
  }

  const { data: participants, error } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId)
    .order('role', { ascending: false })
    .order('display_name', { ascending: true });

  if (error || !participants) {
    return null;
  }

  const participantRows = participants as ClubCompetitionParticipantRecord[];
  const organiserCount = participantRows.filter((participant) => participant.role === 'organiser').length;

  return {
    competition: overview.competition,
    currentUserRole: overview.role,
    participants: participantRows.map((participant) => ({
      ...participant,
      isSelf: participant.user_id === input.userId,
    })),
    organiserCount,
  };
};

export const getCompetitionPoulesData = async (input: {
  userId: string;
  competitionId: string;
}): Promise<CompetitionPoulesData | null> => {
  const overview = await getCompetitionOverviewData(input);
  if (!overview) {
    return null;
  }

  const { data: pools, error: poolsError } = await supabase
    .from(CLUB_POOL_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId)
    .order('pool_label', { ascending: true });

  if (poolsError || !pools) {
    return null;
  }

  const poolRows = pools as ClubPoolRecord[];
  const poolIds = poolRows.map((pool) => pool.id);

  const { data: participants, error: participantsError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId);

  if (participantsError || !participants) {
    return null;
  }

  const participantRows = participants as ClubCompetitionParticipantRecord[];
  const participantById = new Map(
    participantRows.map((participant) => [participant.id, participant])
  );

  let assignmentRows: ClubPoolAssignmentRecord[] = [];
  if (poolIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from(CLUB_POOL_ASSIGNMENT_TABLE)
      .select('*')
      .in('pool_id', poolIds)
      .order('position', { ascending: true });

    if (assignmentsError || !assignments) {
      return null;
    }

    assignmentRows = assignments as ClubPoolAssignmentRecord[];
  }

  const { data: matches, error: matchesError } = await supabase
    .from(CLUB_COMPETITION_MATCH_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId)
    .eq('stage', 'poule')
    .order('created_at', { ascending: true });

  if (matchesError || !matches) {
    return null;
  }

  const matchRows = matches as ClubCompetitionMatchRecord[];
  const matchesByPoolId = new Map<string, ClubCompetitionMatchRecord[]>();
  matchRows.forEach((match) => {
    if (!match.pool_id) return;
    const existing = matchesByPoolId.get(match.pool_id) ?? [];
    existing.push(match);
    matchesByPoolId.set(match.pool_id, existing);
  });

  const assignmentsByPoolId = new Map<string, ClubPoolAssignmentRecord[]>();
  assignmentRows.forEach((assignment) => {
    const existing = assignmentsByPoolId.get(assignment.pool_id) ?? [];
    existing.push(assignment);
    assignmentsByPoolId.set(assignment.pool_id, existing);
  });

  const poolViews: CompetitionPouleView[] = poolRows.map((pool) => {
    const poolAssignments = (assignmentsByPoolId.get(pool.id) ?? []).slice().sort((a, b) => {
      return a.position - b.position;
    });
    const poolMatches = (matchesByPoolId.get(pool.id) ?? []).slice().sort((a, b) => {
      return a.created_at.localeCompare(b.created_at);
    });

    return {
      pool,
      participants: computePouleParticipants({
        assignments: poolAssignments,
        matches: poolMatches,
        participantById,
        userId: input.userId,
      }),
      matches: poolMatches,
    };
  });

  const scoredMatchExists = matchRows.some(hasScoredPouleMatch);
  const isOrganiser = overview.role === 'organiser';
  const canEditPreLock =
    isOrganiser &&
    overview.competition.status === 'poules_generated' &&
    !scoredMatchExists;

  return {
    competition: overview.competition,
    currentUserRole: overview.role,
    pools: poolViews,
    canGenerate:
      isOrganiser &&
      overview.competition.status === 'registration_locked' &&
      poolViews.length === 0,
    canRegenerate:
      isOrganiser &&
      overview.competition.status === 'poules_generated' &&
      poolViews.length > 0 &&
      !scoredMatchExists,
    canLock:
      isOrganiser &&
      overview.competition.status === 'poules_generated' &&
      poolViews.length > 0,
    canEditAssignments: canEditPreLock,
    hasAnyScoredPouleMatch: scoredMatchExists,
  };
};

export const generateCompetitionPoules = async (input: {
  competitionId: string;
  regenerate?: boolean;
}): Promise<CompetitionActionResult<PouleGenerationResult>> => {
  const regenerate = input.regenerate ?? false;
  const { data, error } = await supabase.rpc('generate_club_competition_poules', {
    p_competition_id: input.competitionId,
    p_regenerate: regenerate,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can generate poules.' };
    }
    if (message.includes('competition_finalised')) {
      return { ok: false, message: 'Competition is finalised and cannot be edited.' };
    }
    if (message.includes('generate_requires_registration_locked')) {
      return { ok: false, message: 'Lock registration before generating poules.' };
    }
    if (message.includes('regenerate_only_when_poules_generated')) {
      return { ok: false, message: 'Poules can only be regenerated before they are locked.' };
    }
    if (message.includes('cannot_regenerate_after_scoring_started')) {
      return { ok: false, message: 'Poules cannot be regenerated after scoring has started.' };
    }
    if (message.includes('not_enough_active_participants')) {
      return { ok: false, message: 'At least 2 active participants are required.' };
    }
    return { ok: false, message: 'Could not generate poules right now.' };
  }

  const payload =
    Array.isArray(data) && data.length > 0
      ? (data[0] as PouleGenerationResult)
      : (data as PouleGenerationResult);

  if (!payload) {
    return { ok: false, message: 'Poule generation did not return a result.' };
  }

  return {
    ok: true,
    data: payload,
  };
};

export const moveCompetitionPoolAssignment = async (input: {
  competitionId: string;
  participantId: string;
  targetPoolId: string;
  targetPosition?: number | null;
}): Promise<CompetitionActionResult<true>> => {
  const { data, error } = await supabase.rpc('move_club_competition_pool_assignment', {
    p_competition_id: input.competitionId,
    p_participant_id: input.participantId,
    p_target_pool_id: input.targetPoolId,
    p_target_position: input.targetPosition ?? null,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can edit poule assignments.' };
    }
    if (message.includes('assignments_editable_only_before_poules_locked')) {
      return { ok: false, message: 'Assignments can only be edited before poules are locked.' };
    }
    if (message.includes('cannot_edit_assignments_after_scoring_started')) {
      return { ok: false, message: 'Assignments cannot be edited after scoring has started.' };
    }
    if (message.includes('assignment_not_found')) {
      return { ok: false, message: 'That participant assignment was not found.' };
    }
    if (message.includes('target_pool_invalid')) {
      return { ok: false, message: 'Target poule is invalid.' };
    }
    return { ok: false, message: 'Could not update assignment right now.' };
  }

  if (data !== true) {
    return { ok: false, message: 'Assignment update did not return success.' };
  }

  return {
    ok: true,
    data: true,
  };
};

export const lockCompetitionPoules = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<ClubCompetitionRecord>> => {
  const { data, error } = await supabase.rpc('lock_club_competition_poules', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can lock poules.' };
    }
    if (message.includes('poules_can_only_be_locked_from_generated_state')) {
      return { ok: false, message: 'Poules can only be locked after generation.' };
    }
    return { ok: false, message: 'Could not lock poules right now.' };
  }

  const competition =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionRecord)
      : (data as ClubCompetitionRecord);

  if (!competition) {
    return { ok: false, message: 'Updated competition was not returned.' };
  }

  return {
    ok: true,
    data: competition,
  };
};

export const updateCompetitionRegistrationLock = async (input: {
  competitionId: string;
  lock: boolean;
}): Promise<CompetitionActionResult<ClubCompetitionRecord>> => {
  const { data, error } = await supabase.rpc('update_club_competition_registration_lock', {
    p_competition_id: input.competitionId,
    p_locked: input.lock,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can change registration state.' };
    }
    if (message.includes('competition_finalised')) {
      return { ok: false, message: 'Competition is finalised and cannot be edited.' };
    }
    if (message.includes('registration_cannot_be_locked_from_current_state')) {
      return { ok: false, message: 'Registration cannot be locked from the current state.' };
    }
    if (message.includes('registration_cannot_be_unlocked_from_current_state')) {
      return { ok: false, message: 'Registration cannot be unlocked from the current state.' };
    }
    return { ok: false, message: 'Could not update registration state right now.' };
  }

  const competition =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionRecord)
      : (data as ClubCompetitionRecord);

  if (!competition) {
    return { ok: false, message: 'Updated competition was not returned.' };
  }

  return {
    ok: true,
    data: competition,
  };
};

export const updateCompetitionParticipantRole = async (input: {
  competitionId: string;
  targetUserId: string;
  newRole: 'organiser' | 'participant';
}): Promise<CompetitionActionResult<ClubCompetitionParticipantRecord>> => {
  const { data, error } = await supabase.rpc('update_club_competition_participant_role', {
    p_competition_id: input.competitionId,
    p_target_user_id: input.targetUserId,
    p_new_role: input.newRole,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('cannot_demote_last_organiser')) {
      return { ok: false, message: 'You cannot demote the last organiser.' };
    }
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can change participant roles.' };
    }
    return { ok: false, message: 'Could not update role right now.' };
  }

  const participant =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionParticipantRecord)
      : (data as ClubCompetitionParticipantRecord);

  if (!participant) {
    return { ok: false, message: 'Updated participant was not returned.' };
  }

  return {
    ok: true,
    data: participant,
  };
};

export const removeCompetitionParticipant = async (input: {
  competitionId: string;
  targetUserId: string;
}): Promise<CompetitionActionResult<true>> => {
  const { error } = await supabase.rpc('remove_club_competition_participant', {
    p_competition_id: input.competitionId,
    p_target_user_id: input.targetUserId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('remove_only_during_registration_open')) {
      return { ok: false, message: 'Participants can only be removed while registration is open.' };
    }
    if (message.includes('cannot_remove_last_organiser')) {
      return { ok: false, message: 'You cannot remove the last organiser.' };
    }
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can remove participants.' };
    }
    return { ok: false, message: 'Could not remove participant right now.' };
  }

  return {
    ok: true,
    data: true,
  };
};

export const leaveCompetitionAsParticipant = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<true>> => {
  const { error } = await supabase.rpc('leave_club_competition', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('self_leave_only_during_registration_open')) {
      return { ok: false, message: 'You can only leave while registration is open.' };
    }
    if (message.includes('cannot_leave_last_organiser')) {
      return { ok: false, message: 'You cannot leave as the last organiser.' };
    }
    return { ok: false, message: 'Could not leave competition right now.' };
  }

  return {
    ok: true,
    data: true,
  };
};

export const updateCompetitionParticipantWithdrawn = async (input: {
  competitionId: string;
  targetUserId: string;
  withdrawn: boolean;
}): Promise<CompetitionActionResult<ClubCompetitionParticipantRecord>> => {
  const { data: competition, error: competitionError } = await supabase
    .from(CLUB_COMPETITION_TABLE)
    .select('status')
    .eq('id', input.competitionId)
    .maybeSingle();

  if (competitionError || !competition) {
    return { ok: false, message: 'Competition was not found.' };
  }

  if (!WITHDRAWAL_EDITABLE_STATUSES.has(competition.status)) {
    return { ok: false, message: 'Withdraw is only available during poules or DE phases.' };
  }

  const { data, error } = await supabase.rpc('update_club_competition_participant_withdrawn', {
    p_competition_id: input.competitionId,
    p_target_user_id: input.targetUserId,
    p_withdrawn: input.withdrawn,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can manage withdrawn status.' };
    }
    if (message.includes('withdraw_not_allowed_in_current_state')) {
      return { ok: false, message: 'Withdraw is not allowed in the current phase.' };
    }
    return { ok: false, message: 'Could not update withdrawn status right now.' };
  }

  const participant =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionParticipantRecord)
      : (data as ClubCompetitionParticipantRecord);

  if (!participant) {
    return { ok: false, message: 'Updated participant was not returned.' };
  }

  return {
    ok: true,
    data: participant,
  };
};

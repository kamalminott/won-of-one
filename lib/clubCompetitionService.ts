import { supabase } from '@/lib/supabase';
import { isCompetitionGenericDisplayName } from '@/lib/competitionDisplayName';
import type {
  ClubCompetitionRecord,
  ClubCompetitionMatchRecord,
  ClubCompetitionParticipantRecord,
  CompetitionDeTableauData,
  CompetitionDeMatchView,
  CompetitionDeRoundView,
  CompetitionFinalStandingsData,
  CompetitionFinalStandingEntry,
  CompetitionFinalStandingMedal,
  ClubPoolAssignmentRecord,
  ClubPoolRecord,
  CompetitionFormat,
  CompetitionMatchScoringData,
  CompetitionRankingsData,
  CompetitionScoringMode,
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
const CLUB_COMPETITION_RANKING_TABLE = 'club_competition_ranking';

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
      reason?: string;
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

const createCompetitionServiceError = (context: string, error: unknown): Error => {
  if (error instanceof Error) {
    error.message = `${context}: ${error.message}`;
    return error;
  }

  const message = getSupabaseErrorMessage(error) || 'unknown_error';
  return new Error(`${context}: ${message}`);
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
  participantCount: number,
  archivedAt: string | null = null
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
    archivedAt,
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
    if (!match.fencer_a_participant_id || !match.fencer_b_participant_id) {
      return;
    }

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

type RankingRpcRow = {
  competition_id: string;
  participant_id: string;
  rank: number;
  wins: number;
  losses: number;
  bout_count: number;
  win_pct: string | number;
  indicator: number;
  hits_scored: number;
  hits_received: number;
  is_withdrawn: boolean;
  display_name: string;
  participant_status: ClubCompetitionParticipantRecord['status'];
};

type DeGenerationResult = {
  participant_count: number;
  bracket_size: number;
  round_count: number;
  match_count: number;
  auto_advanced_count: number;
};

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const isDeRoundDependentStarted = (
  match: ClubCompetitionMatchRecord,
  matchById: Map<string, ClubCompetitionMatchRecord>
): boolean => {
  if (!match.advances_to_match_id) return false;
  const nextMatch = matchById.get(match.advances_to_match_id);
  if (!nextMatch) return false;
  return (
    nextMatch.status !== 'pending' ||
    nextMatch.score_a != null ||
    nextMatch.score_b != null ||
    nextMatch.winner_participant_id != null
  );
};

const getPlacementBaseFromRoundLabel = (roundLabel: string | null | undefined): number | null => {
  if (!roundLabel) return null;
  if (roundLabel === 'F') return 2;
  if (roundLabel === 'SF') return 3;
  if (roundLabel === 'QF') return 5;

  const match = /^L(\d+)$/.exec(roundLabel);
  if (!match) return null;
  const tableSize = Number.parseInt(match[1], 10);
  if (!Number.isFinite(tableSize) || tableSize <= 1) return null;
  return Math.floor(tableSize / 2) + 1;
};

const getMedalForPosition = (position: number | null): CompetitionFinalStandingMedal => {
  if (position === 1) return 'gold';
  if (position === 2) return 'silver';
  if (position === 3) return 'bronze';
  return null;
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
  const normalizedDisplayName = sanitizeDisplayName(displayName);
  const { data: existingMembership, error: existingError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('id, role, display_name')
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
    const existingDisplayName = existingMembership.display_name ?? '';
    if (
      isCompetitionGenericDisplayName(existingDisplayName) &&
      !isCompetitionGenericDisplayName(normalizedDisplayName)
    ) {
      await supabase
        .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
        .update({ display_name: normalizedDisplayName })
        .eq('id', existingMembership.id);
    }

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
      display_name: normalizedDisplayName,
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
  archived: CompetitionSummary[];
}> => {
  const { data: memberships, error: membershipError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('competition_id, role, archived_at')
    .eq('user_id', userId);

  if (membershipError) {
    throw createCompetitionServiceError('Failed to load competition memberships', membershipError);
  }

  if (!memberships || memberships.length === 0) {
    return { active: [], past: [], archived: [] };
  }

  const competitionIds = memberships
    .map((membership) => membership.competition_id as string)
    .filter(Boolean);

  const { data: competitions, error: competitionsError } = await supabase
    .from(CLUB_COMPETITION_TABLE)
    .select('id, name, weapon, status, updated_at, finalised_at')
    .in('id', competitionIds);

  if (competitionsError) {
    throw createCompetitionServiceError('Failed to load competitions', competitionsError);
  }

  if (!competitions || competitions.length === 0) {
    return { active: [], past: [], archived: [] };
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

  const membershipByCompetitionId = new Map<
    string,
    {
      role: 'organiser' | 'participant';
      archivedAt: string | null;
    }
  >();
  memberships.forEach((membership) => {
    membershipByCompetitionId.set(membership.competition_id as string, {
      role: membership.role,
      archivedAt: membership.archived_at ?? null,
    });
  });

  const summaries = competitions
    .map((competition) => {
      const membership = membershipByCompetitionId.get(competition.id as string);
      if (!membership) return null;
      const count = participantCountMap.get(competition.id as string) ?? 1;
      return toSummary(
        competition as Pick<
          ClubCompetitionRecord,
          'id' | 'name' | 'weapon' | 'status' | 'updated_at' | 'finalised_at'
        >,
        membership.role,
        count,
        membership.archivedAt
      );
    })
    .filter((summary): summary is CompetitionSummary => summary !== null);

  const visibleSummaries = summaries.filter((summary) => !summary.archivedAt);

  const active = visibleSummaries
    .filter((summary) => summary.status !== 'finalised')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const past = visibleSummaries
    .filter((summary) => summary.status === 'finalised')
    .sort((a, b) => (b.finalisedAt ?? '').localeCompare(a.finalisedAt ?? ''));
  const archived = summaries
    .filter((summary) => Boolean(summary.archivedAt))
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));

  return { active, past, archived };
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
  const isReadOnly = competitionRow.status === 'finalised';
  const canFinalise =
    membership.role === 'organiser' &&
    !isReadOnly &&
    ((competitionRow.format === 'poules_only' && competitionRow.status === 'rankings_locked') ||
      (competitionRow.format !== 'poules_only' && competitionRow.status === 'de_generated'));

  return {
    competition: competitionRow,
    role: membership.role,
    participantCount,
    isReadOnly,
    canFinalise,
  };
};

export const finaliseCompetition = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<ClubCompetitionRecord>> => {
  const { data, error } = await supabase.rpc('finalise_club_competition', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can finalise competitions.' };
    }
    if (message.includes('competition_not_ready_for_finalise')) {
      return {
        ok: false,
        message: 'Competition is not ready to finalise yet.',
      };
    }
    if (message.includes('poule_matches_incomplete')) {
      return {
        ok: false,
        message: 'Complete or resolve all poule matches before finalising.',
      };
    }
    if (message.includes('de_matches_incomplete')) {
      return {
        ok: false,
        message: 'Complete or resolve all DE matches before finalising.',
      };
    }
    return { ok: false, message: 'Could not finalise competition right now.' };
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
    if (message.includes('competition_not_found')) {
      return { ok: false, message: 'Competition was not found.' };
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
    if (
      message.includes('duplicate key') ||
      message.includes('unique constraint') ||
      message.includes('club_pool_assignment_pool_id_position_key')
    ) {
      return { ok: false, message: 'Assignment order conflicted. Pull to refresh and try again.' };
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

export const getCompetitionRankingsData = async (input: {
  userId: string;
  competitionId: string;
}): Promise<CompetitionRankingsData | null> => {
  const overview = await getCompetitionOverviewData(input);
  if (!overview) {
    return null;
  }

  const { data: rankingRowsRaw, error: rankingError } = await supabase.rpc(
    'fetch_club_competition_rankings',
    {
      p_competition_id: input.competitionId,
    }
  );

  if (rankingError) {
    return null;
  }

  const { data: participants, error: participantsError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId);

  if (participantsError || !participants) {
    return null;
  }

  const participantViews = (participants as ClubCompetitionParticipantRecord[]).map(
    (participant) => ({
      ...participant,
      isSelf: participant.user_id === input.userId,
    })
  );
  const participantById = new Map(
    participantViews.map((participant) => [participant.id, participant])
  );

  const rankingRows = (Array.isArray(rankingRowsRaw) ? rankingRowsRaw : []) as RankingRpcRow[];

  const rankings = rankingRows
    .map((row) => {
      const participant = participantById.get(row.participant_id);
      if (!participant) return null;
      return {
        ranking: {
          competition_id: row.competition_id,
          participant_id: row.participant_id,
          rank: row.rank,
          wins: row.wins,
          losses: row.losses,
          bout_count: row.bout_count,
          win_pct: toNumber(row.win_pct),
          indicator: row.indicator,
          hits_scored: row.hits_scored,
          hits_received: row.hits_received,
          is_withdrawn: row.is_withdrawn,
        },
        participant: {
          ...participant,
          display_name: row.display_name ?? participant.display_name,
          status: row.participant_status ?? participant.status,
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const { count: withdrawalAnnulmentCount } = await supabase
    .from(CLUB_COMPETITION_MATCH_TABLE)
    .select('*', { head: true, count: 'exact' })
    .eq('competition_id', input.competitionId)
    .eq('stage', 'poule')
    .eq('status', 'annulled_withdrawal');

  const canLockRankings =
    overview.role === 'organiser' &&
    ((overview.competition.format === 'de_only' &&
      overview.competition.status === 'registration_locked') ||
      (overview.competition.format !== 'de_only' &&
        overview.competition.status === 'poules_locked'));

  const canGenerateDe =
    overview.role === 'organiser' &&
    overview.competition.format !== 'poules_only' &&
    overview.competition.status === 'rankings_locked';

  return {
    competition: overview.competition,
    currentUserRole: overview.role,
    rankings,
    tieBreakCaption: 'Tie-break: Win% → Indicator → Hits',
    hasWithdrawalAdjustments: (withdrawalAnnulmentCount ?? 0) > 0,
    canLockRankings,
    canGenerateDe,
  };
};

export const lockCompetitionRankings = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<ClubCompetitionRecord>> => {
  const { data, error } = await supabase.rpc('lock_club_competition_rankings', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can lock rankings.' };
    }
    if (message.includes('rankings_lock_requires_poules_locked')) {
      return { ok: false, message: 'Lock poules before locking rankings.' };
    }
    if (message.includes('rankings_lock_requires_registration_locked_for_de_only')) {
      return { ok: false, message: 'Lock registration before locking rankings.' };
    }
    if (message.includes('poule_matches_incomplete')) {
      return { ok: false, message: 'Complete all poule matches before locking rankings.' };
    }
    if (message.includes('competition_finalised')) {
      return { ok: false, message: 'Competition is finalised and cannot be edited.' };
    }
    return { ok: false, message: 'Could not lock rankings right now.' };
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

export const generateCompetitionDeTableau = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<DeGenerationResult>> => {
  const { data, error } = await supabase.rpc('generate_club_competition_de_tableau', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can generate DE tableau.' };
    }
    if (message.includes('format_excludes_de')) {
      return { ok: false, message: 'This competition format does not include DE.' };
    }
    if (message.includes('de_generation_requires_rankings_locked')) {
      return { ok: false, message: 'Lock rankings before generating DE tableau.' };
    }
    if (message.includes('de_already_generated')) {
      return { ok: false, message: 'DE tableau is already generated.' };
    }
    if (message.includes('not_enough_eligible_participants')) {
      return { ok: false, message: 'At least 2 non-withdrawn participants are required.' };
    }
    return { ok: false, message: 'Could not generate DE tableau right now.' };
  }

  const payload =
    Array.isArray(data) && data.length > 0
      ? (data[0] as DeGenerationResult)
      : (data as DeGenerationResult);

  if (!payload) {
    return { ok: false, message: 'DE generation did not return a result.' };
  }

  return {
    ok: true,
    data: payload,
  };
};

export const getCompetitionDeTableauData = async (input: {
  userId: string;
  competitionId: string;
}): Promise<CompetitionDeTableauData | null> => {
  const overview = await getCompetitionOverviewData(input);
  if (!overview) {
    return null;
  }

  const { data: matches, error: matchesError } = await supabase
    .from(CLUB_COMPETITION_MATCH_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId)
    .eq('stage', 'de')
    .order('de_round_index', { ascending: true })
    .order('de_match_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (matchesError || !matches) {
    return null;
  }

  const { data: participants, error: participantsError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId);

  if (participantsError || !participants) {
    return null;
  }

  const { data: rankings } = await supabase
    .from(CLUB_COMPETITION_RANKING_TABLE)
    .select('participant_id, rank')
    .eq('competition_id', input.competitionId);

  const participantViews = (participants as ClubCompetitionParticipantRecord[]).map(
    (participant) => ({
      ...participant,
      isSelf: participant.user_id === input.userId,
    })
  );
  const participantById = new Map(
    participantViews.map((participant) => [participant.id, participant])
  );
  const seedRankByParticipantId = new Map(
    ((rankings ?? []) as { participant_id: string; rank: number }[]).map((row) => [
      row.participant_id,
      row.rank,
    ])
  );

  const matchRows = matches as ClubCompetitionMatchRecord[];
  const matchById = new Map(matchRows.map((match) => [match.id, match]));

  const roundMap = new Map<number, CompetitionDeRoundView>();
  matchRows.forEach((match) => {
    const roundIndex = match.de_round_index ?? 0;
    const roundLabel = match.round_label ?? `Round ${roundIndex}`;
    const fencerA = match.fencer_a_participant_id
      ? participantById.get(match.fencer_a_participant_id) ?? null
      : null;
    const fencerB = match.fencer_b_participant_id
      ? participantById.get(match.fencer_b_participant_id) ?? null
      : null;
    const downstreamStarted = isDeRoundDependentStarted(match, matchById);

    const matchView: CompetitionDeMatchView = {
      match,
      fencerA,
      fencerB,
      fencerASeedRank: fencerA ? seedRankByParticipantId.get(fencerA.id) ?? null : null,
      fencerBSeedRank: fencerB ? seedRankByParticipantId.get(fencerB.id) ?? null : null,
      canScore:
        !overview.isReadOnly &&
        !!fencerA &&
        !!fencerB &&
        (match.status === 'pending' || match.status === 'live'),
      canOverride:
        !overview.isReadOnly &&
        overview.role === 'organiser' &&
        !!fencerA &&
        !!fencerB &&
        match.status === 'completed' &&
        !downstreamStarted,
      canReset:
        !overview.isReadOnly &&
        overview.role === 'organiser' &&
        match.status === 'completed' &&
        !downstreamStarted,
    };

    const existing = roundMap.get(roundIndex);
    if (existing) {
      existing.matches.push(matchView);
      return;
    }

    roundMap.set(roundIndex, {
      roundIndex,
      roundLabel,
      matches: [matchView],
    });
  });

  const rounds = Array.from(roundMap.values())
    .sort((a, b) => a.roundIndex - b.roundIndex)
    .map((round) => ({
      ...round,
      matches: round.matches.sort((a, b) => {
        const aOrder = a.match.de_match_number ?? 0;
        const bOrder = b.match.de_match_number ?? 0;
        return aOrder - bOrder;
      }),
    }));

  const canGenerateDe =
    overview.role === 'organiser' &&
    overview.competition.format !== 'poules_only' &&
    overview.competition.status === 'rankings_locked';

  return {
    competition: overview.competition,
    currentUserRole: overview.role,
    rounds,
    canGenerateDe,
  };
};

export const getCompetitionFinalStandingsData = async (input: {
  userId: string;
  competitionId: string;
}): Promise<CompetitionFinalStandingsData | null> => {
  const overview = await getCompetitionOverviewData(input);
  if (!overview) {
    return null;
  }

  const { data: rankingRowsRaw, error: rankingError } = await supabase.rpc(
    'fetch_club_competition_rankings',
    {
      p_competition_id: input.competitionId,
    }
  );

  if (rankingError) {
    return null;
  }

  const rankingRows = (Array.isArray(rankingRowsRaw) ? rankingRowsRaw : []) as RankingRpcRow[];
  const seedRankByParticipantId = new Map<string, number>();
  rankingRows.forEach((row) => {
    seedRankByParticipantId.set(row.participant_id, row.rank);
  });

  const { data: participantsRaw, error: participantsError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId);

  if (participantsError || !participantsRaw) {
    return null;
  }

  const participants = (participantsRaw as ClubCompetitionParticipantRecord[]).map(
    (participant) => ({
      ...participant,
      isSelf: participant.user_id === input.userId,
    })
  );
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  const { data: deMatchesRaw, error: deMatchesError } = await supabase
    .from(CLUB_COMPETITION_MATCH_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId)
    .eq('stage', 'de');

  if (deMatchesError) {
    return null;
  }

  const deMatches = (deMatchesRaw ?? []) as ClubCompetitionMatchRecord[];
  const deMatchCount = deMatches.length;
  const deLoserPlacementByParticipantId = new Map<string, { position: number; roundLabel: string }>();
  let championParticipantId: string | null = null;
  let finalistLoserParticipantId: string | null = null;

  deMatches.forEach((match) => {
    if (
      match.status !== 'completed' ||
      !match.fencer_a_participant_id ||
      !match.fencer_b_participant_id ||
      !match.winner_participant_id
    ) {
      return;
    }

    const loserParticipantId =
      match.winner_participant_id === match.fencer_a_participant_id
        ? match.fencer_b_participant_id
        : match.fencer_a_participant_id;

    const placementBase = getPlacementBaseFromRoundLabel(match.round_label ?? null);
    if (placementBase != null) {
      const existing = deLoserPlacementByParticipantId.get(loserParticipantId);
      if (!existing || placementBase < existing.position) {
        deLoserPlacementByParticipantId.set(loserParticipantId, {
          position: placementBase,
          roundLabel: match.round_label ?? '',
        });
      }
    }

    if (match.round_label === 'F') {
      championParticipantId = match.winner_participant_id;
      finalistLoserParticipantId = loserParticipantId;
    }
  });

  const rankingOrderedParticipants = rankingRows
    .map((row) => participantById.get(row.participant_id))
    .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant));
  const rankingOrderedIds = new Set(rankingOrderedParticipants.map((participant) => participant.id));
  const appendedParticipants = participants
    .filter((participant) => !rankingOrderedIds.has(participant.id))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  const orderedParticipants = [...rankingOrderedParticipants, ...appendedParticipants];

  const standings: CompetitionFinalStandingEntry[] = orderedParticipants.map((participant) => {
    const seedRank = seedRankByParticipantId.get(participant.id) ?? null;
    let position: number | null = null;
    let positionLabel = 'TBD';
    let deExitRoundLabel: string | null = null;
    let isPending = false;

    if (participant.status === 'dns') {
      positionLabel = 'DNS';
    } else if (participant.status === 'withdrawn' && deMatchCount === 0) {
      positionLabel = 'WD';
    } else if (overview.competition.format === 'poules_only' || deMatchCount === 0) {
      if (seedRank != null) {
        position = seedRank;
        positionLabel = `${seedRank}`;
      } else if (participant.status === 'withdrawn') {
        positionLabel = 'WD';
      } else {
        positionLabel = '-';
      }
    } else if (participant.id === championParticipantId) {
      position = 1;
      positionLabel = '1';
      deExitRoundLabel = 'Champion';
    } else if (participant.id === finalistLoserParticipantId) {
      position = 2;
      positionLabel = '2';
      deExitRoundLabel = 'F';
    } else {
      const loserPlacement = deLoserPlacementByParticipantId.get(participant.id);
      if (loserPlacement) {
        position = loserPlacement.position;
        positionLabel = `${loserPlacement.position}`;
        deExitRoundLabel = loserPlacement.roundLabel;
      } else if (participant.status === 'withdrawn') {
        positionLabel = 'WD';
      } else {
        isPending = true;
        positionLabel = 'TBD';
      }
    }

    return {
      participant,
      position,
      positionLabel,
      medal: getMedalForPosition(position),
      seedRank,
      deExitRoundLabel,
      isPending,
    };
  });

  standings.sort((a, b) => {
    const category = (entry: CompetitionFinalStandingEntry): number => {
      if (entry.position != null) return 0;
      if (entry.isPending) return 1;
      if (entry.participant.status === 'withdrawn') return 2;
      if (entry.participant.status === 'dns') return 3;
      return 4;
    };
    const categoryDiff = category(a) - category(b);
    if (categoryDiff !== 0) return categoryDiff;

    if (a.position != null && b.position != null && a.position !== b.position) {
      return a.position - b.position;
    }

    if (a.seedRank != null && b.seedRank != null && a.seedRank !== b.seedRank) {
      return a.seedRank - b.seedRank;
    }

    if (a.seedRank != null && b.seedRank == null) return -1;
    if (a.seedRank == null && b.seedRank != null) return 1;
    return a.participant.display_name.localeCompare(b.participant.display_name);
  });

  return {
    competition: overview.competition,
    currentUserRole: overview.role,
    standings,
    isProvisional: overview.competition.status !== 'finalised',
  };
};

export const overrideCompetitionDeMatchResult = async (input: {
  matchId: string;
  scoreA: number;
  scoreB: number;
  reason: string;
}): Promise<CompetitionActionResult<ClubCompetitionMatchRecord>> => {
  const { data, error } = await supabase.rpc('override_club_competition_de_match_result', {
    p_match_id: input.matchId,
    p_score_a: input.scoreA,
    p_score_b: input.scoreB,
    p_reason: input.reason,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('override_reason_required')) {
      return { ok: false, message: 'Please include a reason for this override.' };
    }
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can override DE results.' };
    }
    if (message.includes('downstream_match_started')) {
      return {
        ok: false,
        message: 'This result cannot be overridden because the next round has started.',
      };
    }
    if (message.includes('de_not_editable_in_current_state')) {
      return { ok: false, message: 'DE results are not editable in the current phase.' };
    }
    if (message.includes('ties_not_allowed')) {
      return { ok: false, message: 'Ties are not allowed.' };
    }
    if (message.includes('score_exceeds_touch_limit')) {
      return { ok: false, message: 'Score cannot exceed touch limit.' };
    }
    return { ok: false, message: 'Could not override DE match result right now.' };
  }

  const match =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionMatchRecord)
      : (data as ClubCompetitionMatchRecord);

  if (!match) {
    return { ok: false, message: 'Updated match was not returned.' };
  }

  return {
    ok: true,
    data: match,
  };
};

export const resetCompetitionDeMatch = async (input: {
  matchId: string;
  reason?: string;
}): Promise<CompetitionActionResult<ClubCompetitionMatchRecord>> => {
  const { data, error } = await supabase.rpc('reset_club_competition_de_match', {
    p_match_id: input.matchId,
    p_reason: input.reason ?? 'organiser_reset',
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can reset DE matches.' };
    }
    if (message.includes('downstream_match_started')) {
      return {
        ok: false,
        message: 'This match cannot be reset because the next round has started.',
      };
    }
    if (message.includes('match_not_completed')) {
      return { ok: false, message: 'Only completed matches can be reset.' };
    }
    if (message.includes('de_not_editable_in_current_state')) {
      return { ok: false, message: 'DE results are not editable in the current phase.' };
    }
    return { ok: false, message: 'Could not reset DE match right now.' };
  }

  const match =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionMatchRecord)
      : (data as ClubCompetitionMatchRecord);

  if (!match) {
    return { ok: false, message: 'Updated match was not returned.' };
  }

  return {
    ok: true,
    data: match,
  };
};

export const getCompetitionMatchScoringData = async (input: {
  userId: string;
  competitionId: string;
  matchId: string;
}): Promise<CompetitionMatchScoringData | null> => {
  const overview = await getCompetitionOverviewData({
    userId: input.userId,
    competitionId: input.competitionId,
  });

  if (!overview) {
    return null;
  }

  const { data: match, error: matchError } = await supabase
    .from(CLUB_COMPETITION_MATCH_TABLE)
    .select('*')
    .eq('id', input.matchId)
    .eq('competition_id', input.competitionId)
    .maybeSingle();

  if (matchError || !match) {
    return null;
  }

  const { data: participants, error: participantsError } = await supabase
    .from(CLUB_COMPETITION_PARTICIPANT_TABLE)
    .select('*')
    .eq('competition_id', input.competitionId);

  if (participantsError || !participants) {
    return null;
  }

  const participantViews = (participants as ClubCompetitionParticipantRecord[]).map(
    (participant) => ({
      ...participant,
      isSelf: participant.user_id === input.userId,
    })
  );

  const participantByParticipantId = new Map(
    participantViews.map((participant) => [participant.id, participant])
  );

  const participantByUserId = new Map(
    participantViews.map((participant) => [participant.user_id, participant])
  );

  const matchRow = match as ClubCompetitionMatchRecord;
  const authoritativeScorer = matchRow.authoritative_scorer_user_id
    ? participantByUserId.get(matchRow.authoritative_scorer_user_id) ?? null
    : null;

  return {
    competition: overview.competition,
    currentUserRole: overview.role,
    match: matchRow,
    fencerA: matchRow.fencer_a_participant_id
      ? participantByParticipantId.get(matchRow.fencer_a_participant_id) ?? null
      : null,
    fencerB: matchRow.fencer_b_participant_id
      ? participantByParticipantId.get(matchRow.fencer_b_participant_id) ?? null
      : null,
    authoritativeScorer,
    canTakeOverRemote:
      !overview.isReadOnly &&
      overview.role === 'organiser' &&
      matchRow.scoring_mode === 'remote' &&
      matchRow.status === 'live' &&
      !!matchRow.authoritative_scorer_user_id &&
      matchRow.authoritative_scorer_user_id !== input.userId,
    isAuthoritativeScorer: matchRow.authoritative_scorer_user_id === input.userId,
  };
};

export const prepareCompetitionMatchScoring = async (input: {
  matchId: string;
  mode: CompetitionScoringMode;
  takeOver?: boolean;
}): Promise<CompetitionActionResult<ClubCompetitionMatchRecord>> => {
  const { data, error } = await supabase.rpc('prepare_club_competition_match_scoring', {
    p_match_id: input.matchId,
    p_mode: input.mode,
    p_take_over: input.takeOver ?? false,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('remote_scorer_already_assigned')) {
      return {
        ok: false,
        reason: 'remote_scorer_already_assigned',
        message: 'This match is already being scored by someone else.',
      };
    }
    if (message.includes('scoring_mode_locked_once_live')) {
      return {
        ok: false,
        reason: 'scoring_mode_locked_once_live',
        message: 'Scoring mode cannot be changed after the match is live.',
      };
    }
    if (message.includes('match_not_editable')) {
      return {
        ok: false,
        reason: 'match_not_editable',
        message: 'This match can no longer be edited.',
      };
    }
    if (message.includes('competition_finalised')) {
      return {
        ok: false,
        reason: 'competition_finalised',
        message: 'Competition is finalised and cannot be edited.',
      };
    }
    if (message.includes('poule_matches_locked_after_rankings')) {
      return {
        ok: false,
        reason: 'match_not_editable',
        message: 'Poule results are locked after rankings are locked.',
      };
    }
    if (message.includes('de_not_editable_in_current_state')) {
      return {
        ok: false,
        reason: 'match_not_editable',
        message: 'DE matches are not editable in the current phase.',
      };
    }
    if (message.includes('not_allowed')) {
      return {
        ok: false,
        reason: 'not_allowed',
        message: 'You do not have permission to score this match.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: 'Could not prepare match scoring right now.',
    };
  }

  const match =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionMatchRecord)
      : (data as ClubCompetitionMatchRecord);

  if (!match) {
    return { ok: false, reason: 'unknown', message: 'Match was not returned.' };
  }

  return {
    ok: true,
    data: match,
  };
};

export const takeOverCompetitionMatchRemoteScoring = async (input: {
  matchId: string;
}): Promise<CompetitionActionResult<ClubCompetitionMatchRecord>> => {
  const { data, error } = await supabase.rpc('take_over_club_competition_match_remote_scoring', {
    p_match_id: input.matchId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_allowed')) {
      return {
        ok: false,
        reason: 'not_allowed',
        message: 'Only organisers can take over remote scoring.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: 'Could not take over scoring right now.',
    };
  }

  const match =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionMatchRecord)
      : (data as ClubCompetitionMatchRecord);

  if (!match) {
    return { ok: false, reason: 'unknown', message: 'Match was not returned.' };
  }

  return {
    ok: true,
    data: match,
  };
};

export const setCompetitionMatchLiveScore = async (input: {
  matchId: string;
  scoreA: number;
  scoreB: number;
}): Promise<CompetitionActionResult<ClubCompetitionMatchRecord>> => {
  const { data, error } = await supabase.rpc('set_club_competition_match_live_score', {
    p_match_id: input.matchId,
    p_score_a: input.scoreA,
    p_score_b: input.scoreB,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('not_authoritative_scorer')) {
      return {
        ok: false,
        reason: 'not_authoritative_scorer',
        message: 'Only the active remote scorer can update live score.',
      };
    }
    if (message.includes('match_not_live')) {
      return {
        ok: false,
        reason: 'match_not_live',
        message: 'Match is not live.',
      };
    }
    if (message.includes('match_not_remote_mode')) {
      return {
        ok: false,
        reason: 'match_not_remote_mode',
        message: 'Match is not in remote scoring mode.',
      };
    }
    if (message.includes('score_exceeds_touch_limit')) {
      return {
        ok: false,
        reason: 'score_exceeds_touch_limit',
        message: 'Score cannot exceed match touch limit.',
      };
    }
    if (message.includes('poule_matches_locked_after_rankings')) {
      return {
        ok: false,
        reason: 'match_not_editable',
        message: 'Poule results are locked after rankings are locked.',
      };
    }
    if (message.includes('competition_finalised')) {
      return {
        ok: false,
        reason: 'competition_finalised',
        message: 'Competition is finalised and cannot be edited.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: 'Could not update live score right now.',
    };
  }

  const match =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionMatchRecord)
      : (data as ClubCompetitionMatchRecord);

  if (!match) {
    return { ok: false, reason: 'unknown', message: 'Match was not returned.' };
  }

  return {
    ok: true,
    data: match,
  };
};

export const completeCompetitionMatchScore = async (input: {
  matchId: string;
  scoreA: number;
  scoreB: number;
  mode?: CompetitionScoringMode;
}): Promise<CompetitionActionResult<ClubCompetitionMatchRecord>> => {
  const { data, error } = await supabase.rpc('complete_club_competition_match_score', {
    p_match_id: input.matchId,
    p_score_a: input.scoreA,
    p_score_b: input.scoreB,
    p_mode: input.mode ?? null,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('ties_not_allowed')) {
      return { ok: false, reason: 'ties_not_allowed', message: 'Ties are not allowed.' };
    }
    if (message.includes('score_exceeds_touch_limit')) {
      return {
        ok: false,
        reason: 'score_exceeds_touch_limit',
        message: 'Score cannot exceed touch limit.',
      };
    }
    if (message.includes('not_authoritative_scorer')) {
      return {
        ok: false,
        reason: 'not_authoritative_scorer',
        message: 'Only the active remote scorer can complete this match.',
      };
    }
    if (message.includes('match_already_completed')) {
      return {
        ok: false,
        reason: 'match_already_completed',
        message: 'This match has already been completed.',
      };
    }
    if (message.includes('scoring_mode_locked_once_live')) {
      return {
        ok: false,
        reason: 'scoring_mode_locked_once_live',
        message: 'Scoring mode cannot be changed after match is live.',
      };
    }
    if (message.includes('poule_matches_locked_after_rankings')) {
      return {
        ok: false,
        reason: 'match_not_editable',
        message: 'Poule results are locked after rankings are locked.',
      };
    }
    if (message.includes('de_not_editable_in_current_state')) {
      return {
        ok: false,
        reason: 'match_not_editable',
        message: 'DE matches are not editable in the current phase.',
      };
    }
    if (message.includes('competition_finalised')) {
      return {
        ok: false,
        reason: 'competition_finalised',
        message: 'Competition is finalised and cannot be edited.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: 'Could not save match score right now.',
    };
  }

  const match =
    Array.isArray(data) && data.length > 0
      ? (data[0] as ClubCompetitionMatchRecord)
      : (data as ClubCompetitionMatchRecord);

  if (!match) {
    return { ok: false, reason: 'unknown', message: 'Match was not returned.' };
  }

  return {
    ok: true,
    data: match,
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
    if (message.includes('competition_finalised')) {
      return { ok: false, message: 'Competition is finalised and cannot be edited.' };
    }
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

export const archiveCompetitionForUser = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<true>> => {
  const { error } = await supabase.rpc('archive_club_competition_for_user', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('participant_not_found')) {
      return { ok: false, message: 'You can only archive competitions you are part of.' };
    }
    return { ok: false, message: 'Could not archive this competition right now.' };
  }

  return {
    ok: true,
    data: true,
  };
};

export const restoreCompetitionForUser = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<true>> => {
  const { error } = await supabase.rpc('restore_club_competition_for_user', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('participant_not_found')) {
      return { ok: false, message: 'You can only restore competitions you are part of.' };
    }
    return { ok: false, message: 'Could not restore this competition right now.' };
  }

  return {
    ok: true,
    data: true,
  };
};

export const deleteCompetition = async (input: {
  competitionId: string;
}): Promise<CompetitionActionResult<true>> => {
  const { error } = await supabase.rpc('delete_club_competition', {
    p_competition_id: input.competitionId,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (message.includes('delete_only_during_registration_open')) {
      return {
        ok: false,
        message: 'Only registration-open competitions can be deleted.',
      };
    }
    if (message.includes('not_allowed')) {
      return { ok: false, message: 'Only organisers can delete competitions.' };
    }
    if (message.includes('competition_not_found')) {
      return { ok: false, message: 'Competition was not found.' };
    }
    return { ok: false, message: 'Could not delete this competition right now.' };
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

export type CompetitionWeapon = 'foil' | 'epee' | 'sabre';

export type CompetitionFormat = 'poules_only' | 'poules_then_de' | 'de_only';

export type CompetitionStatus =
  | 'registration_open'
  | 'registration_locked'
  | 'poules_generated'
  | 'poules_locked'
  | 'rankings_locked'
  | 'de_generated'
  | 'finalised';

export type CompetitionRole = 'organiser' | 'participant';

export type CompetitionParticipantStatus = 'active' | 'withdrawn' | 'dns';

export type CompetitionStage = 'poule' | 'de';

export type CompetitionMatchStatus =
  | 'pending'
  | 'live'
  | 'completed'
  | 'canceled_withdrawal'
  | 'annulled_withdrawal';

export type DeRoundLabel = 'L64' | 'L32' | 'L16' | 'QF' | 'SF' | 'F';

export interface CompetitionSummary {
  id: string;
  name: string;
  weapon: CompetitionWeapon;
  status: CompetitionStatus;
  participantCount: number;
  role: CompetitionRole;
  updatedAt: string;
  finalisedAt?: string | null;
}

export interface ClubCompetitionRecord {
  id: string;
  name: string;
  weapon: CompetitionWeapon;
  format: CompetitionFormat;
  de_touch_limit: 10 | 15;
  status: CompetitionStatus;
  join_code: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  finalised_at: string | null;
}

export interface ClubCompetitionParticipantRecord {
  id: string;
  competition_id: string;
  user_id: string;
  display_name: string;
  role: CompetitionRole;
  status: CompetitionParticipantStatus;
  created_at: string;
  updated_at: string;
}

export interface CompetitionParticipantView extends ClubCompetitionParticipantRecord {
  isSelf: boolean;
}

export interface CompetitionParticipantsData {
  competition: ClubCompetitionRecord;
  currentUserRole: CompetitionRole;
  participants: CompetitionParticipantView[];
  organiserCount: number;
}

export interface ClubPoolRecord {
  id: string;
  competition_id: string;
  pool_label: string;
  created_at: string;
  updated_at: string;
}

export interface ClubPoolAssignmentRecord {
  id: string;
  pool_id: string;
  participant_id: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ClubCompetitionMatchRecord {
  id: string;
  competition_id: string;
  stage: CompetitionStage;
  round_label?: string | null;
  pool_id?: string | null;
  fencer_a_participant_id: string;
  fencer_b_participant_id: string;
  touch_limit: 5 | 10 | 15;
  status: CompetitionMatchStatus;
  scoring_mode?: 'remote' | 'manual' | null;
  authoritative_scorer_user_id?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  winner_participant_id?: string | null;
  canceled_reason?: string | null;
  annulled_reason?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PouleParticipantStats {
  participantId: string;
  wins: number;
  losses: number;
  hitsScored: number;
  hitsReceived: number;
  indicator: number;
  fightsRemaining: number;
}

export interface CompetitionPouleParticipant {
  participant: CompetitionParticipantView;
  assignment: ClubPoolAssignmentRecord;
  stats: PouleParticipantStats;
}

export interface CompetitionPouleView {
  pool: ClubPoolRecord;
  participants: CompetitionPouleParticipant[];
  matches: ClubCompetitionMatchRecord[];
}

export interface CompetitionPoulesData {
  competition: ClubCompetitionRecord;
  currentUserRole: CompetitionRole;
  pools: CompetitionPouleView[];
  canGenerate: boolean;
  canRegenerate: boolean;
  canLock: boolean;
  canEditAssignments: boolean;
  hasAnyScoredPouleMatch: boolean;
}

export interface CompetitionOverviewData {
  competition: ClubCompetitionRecord;
  role: CompetitionRole;
  participantCount: number;
  isReadOnly: boolean;
}

export interface JoinCompetitionQrPayload {
  competitionId: string;
  joinCode: string;
}

export type JoinCompetitionFailureReason =
  | 'invalid_code'
  | 'invalid_qr'
  | 'registration_locked'
  | 'not_authenticated'
  | 'unknown';

export type JoinCompetitionResult =
  | {
      ok: true;
      competition: ClubCompetitionRecord;
      role: CompetitionRole;
      readOnly: boolean;
      alreadyJoined: boolean;
    }
  | {
      ok: false;
      reason: JoinCompetitionFailureReason;
      message: string;
    };

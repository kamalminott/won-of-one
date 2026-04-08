export type CompetitionWeapon = 'foil' | 'epee' | 'sabre';

export type CompetitionFormat = 'poules_only' | 'poules_then_de' | 'de_only';
export type CompetitionPlacementMode = 'none' | 'bronze_only';

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
export type CompetitionDeBranch = 'main' | 'bronze';
export type CompetitionScoringMode = 'remote' | 'manual';

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
  archivedAt?: string | null;
}

export interface ClubCompetitionRecord {
  id: string;
  name: string;
  weapon: CompetitionWeapon;
  format: CompetitionFormat;
  placement_mode: CompetitionPlacementMode;
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
  archived_at: string | null;
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
  de_branch?: CompetitionDeBranch | null;
  round_label?: string | null;
  de_round_index?: number | null;
  de_match_number?: number | null;
  advances_to_match_id?: string | null;
  advances_to_slot?: 'a' | 'b' | null;
  loser_advances_to_match_id?: string | null;
  loser_advances_to_slot?: 'a' | 'b' | null;
  pool_id?: string | null;
  fencer_a_participant_id?: string | null;
  fencer_b_participant_id?: string | null;
  touch_limit: 5 | 10 | 15;
  status: CompetitionMatchStatus;
  scoring_mode?: CompetitionScoringMode | null;
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

export interface CompetitionMatchScoringData {
  competition: ClubCompetitionRecord;
  currentUserRole: CompetitionRole;
  match: ClubCompetitionMatchRecord;
  fencerA: CompetitionParticipantView | null;
  fencerB: CompetitionParticipantView | null;
  authoritativeScorer: CompetitionParticipantView | null;
  canTakeOverRemote: boolean;
  isAuthoritativeScorer: boolean;
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
  canFinalise: boolean;
}

export interface ClubCompetitionRankingRecord {
  id: string;
  competition_id: string;
  participant_id: string;
  rank: number;
  wins: number;
  losses: number;
  bout_count: number;
  win_pct: number;
  indicator: number;
  hits_scored: number;
  hits_received: number;
  is_withdrawn: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetitionRankingEntry {
  ranking: Omit<ClubCompetitionRankingRecord, 'id' | 'created_at' | 'updated_at'>;
  participant: CompetitionParticipantView;
}

export interface CompetitionRankingsData {
  competition: ClubCompetitionRecord;
  currentUserRole: CompetitionRole;
  rankings: CompetitionRankingEntry[];
  tieBreakCaption: string;
  hasWithdrawalAdjustments: boolean;
  canEditSeedOrder: boolean;
  canLockRankings: boolean;
  canGenerateDe: boolean;
}

export interface CompetitionDeMatchView {
  match: ClubCompetitionMatchRecord;
  fencerA: CompetitionParticipantView | null;
  fencerB: CompetitionParticipantView | null;
  fencerASeedRank: number | null;
  fencerBSeedRank: number | null;
  canScore: boolean;
  canOverride: boolean;
  canReset: boolean;
}

export interface CompetitionDeRoundView {
  roundIndex: number;
  roundLabel: string;
  matches: CompetitionDeMatchView[];
}

export interface CompetitionDeTableauData {
  competition: ClubCompetitionRecord;
  currentUserRole: CompetitionRole;
  rounds: CompetitionDeRoundView[];
  bronzeMatch: CompetitionDeMatchView | null;
  canGenerateDe: boolean;
}

export type CompetitionFinalStandingMedal = 'gold' | 'silver' | 'bronze' | null;

export interface CompetitionFinalStandingEntry {
  participant: CompetitionParticipantView;
  position: number | null;
  positionLabel: string;
  medal: CompetitionFinalStandingMedal;
  seedRank: number | null;
  deExitRoundLabel: string | null;
  isPending: boolean;
}

export interface CompetitionFinalStandingsData {
  competition: ClubCompetitionRecord;
  currentUserRole: CompetitionRole;
  standings: CompetitionFinalStandingEntry[];
  isProvisional: boolean;
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

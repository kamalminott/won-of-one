import type {
  CompetitionFormat,
  CompetitionMatchStatus,
  CompetitionParticipantStatus,
  CompetitionRole,
  CompetitionStatus,
  CompetitionWeapon,
} from '@/types/competition';

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  registration_open: 'Registration Open',
  registration_locked: 'Registration Locked',
  poules_generated: 'Poules Generated',
  poules_locked: 'Poules Locked',
  rankings_locked: 'Rankings Locked',
  de_generated: 'DE Generated',
  finalised: 'Finalised',
};

export const COMPETITION_STATUS_COLORS: Record<CompetitionStatus, string> = {
  registration_open: '#10B981',
  registration_locked: '#6C5CE7',
  poules_generated: '#6C5CE7',
  poules_locked: '#8B5CF6',
  rankings_locked: '#8B5CF6',
  de_generated: '#FF7675',
  finalised: '#9D9D9D',
};

export const COMPETITION_ROLE_LABELS: Record<CompetitionRole, string> = {
  organiser: 'Organiser',
  participant: 'Participant',
};

export const COMPETITION_PARTICIPANT_STATUS_LABELS: Record<
  CompetitionParticipantStatus,
  string
> = {
  active: 'Active',
  withdrawn: 'Withdrawn',
  dns: 'DNS',
};

export const COMPETITION_PARTICIPANT_STATUS_COLORS: Record<
  CompetitionParticipantStatus,
  string
> = {
  active: '#10B981',
  withdrawn: '#FF7675',
  dns: '#9D9D9D',
};

export const COMPETITION_MATCH_STATUS_LABELS: Record<CompetitionMatchStatus, string> = {
  pending: 'Pending',
  live: 'Live',
  completed: 'Completed',
  canceled_withdrawal: 'Canceled (Withdrawal)',
  annulled_withdrawal: 'Annulled (Withdrawal)',
};

export const COMPETITION_MATCH_STATUS_COLORS: Record<CompetitionMatchStatus, string> = {
  pending: '#9D9D9D',
  live: '#8B5CF6',
  completed: '#10B981',
  canceled_withdrawal: '#FF7675',
  annulled_withdrawal: '#EF4444',
};

export const COMPETITION_WEAPON_LABELS: Record<CompetitionWeapon, string> = {
  foil: 'Foil',
  epee: 'Epee',
  sabre: 'Sabre',
};

export const COMPETITION_FORMAT_LABELS: Record<CompetitionFormat, string> = {
  poules_only: 'Poules only',
  poules_then_de: 'Poules + DE',
  de_only: 'DE only',
};

export const DE_TOUCH_LIMIT_OPTIONS: (10 | 15)[] = [10, 15];

export const COMPETITION_WITHDRAWAL_EDITABLE_STATUSES: CompetitionStatus[] = [
  'poules_generated',
  'poules_locked',
  'rankings_locked',
  'de_generated',
];

// Phase 5 staging: keep agreement flow disabled in V1 while preserving an opt-in path.
export const COMPETITION_ENABLE_RESULT_AGREEMENT = false;

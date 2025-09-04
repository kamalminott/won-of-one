// Database types for Supabase integration

export interface Match {
  match_id: string;
  user_id: string;
  event_id?: string;
  event_date?: string;
  location?: string;
  match_type?: string;
  final_score?: number;
  final_period?: number;
  yellow_cards?: number;
  red_cards?: number;
  priority_assigned?: string;
  period_number?: number;
  fencer_1_id?: string;
  fencer_2_id?: string;
  fencer_1_name?: string;
  fencer_2_name?: string;
  opponent_id?: string;
  result?: string;
  score_diff?: number | null;
  score_spp?: number;
  has_event_data?: boolean;
  score_by_period?: any; // jsonb
  decision_type?: string;
  black_card?: boolean;
  video_referrals_for?: number;
  video_referrals_against?: number;
  video_referrals_success_for?: number;
  video_referrals_success_against?: number;
  bout_length_s?: number;
  source?: string;
  source_confidence?: number;
  data_version?: number;
  touches_against?: number;
  is_win?: boolean;
  is_complete?: boolean; // NEW: Track completion status
}

export interface FencingRemote {
  remote_id: string;
  referee_id?: string;
  fencer_1_id?: string;
  fencer_2_id?: string;
  fencer_1_name?: string;
  fencer_2_name?: string;
  score_1?: number;
  score_2?: number;
  linked_match_id?: string;
  scoring_mode?: string;
  device_serial?: string;
  created_at?: string;
}

export interface Goal {
  goal_id: string;
  user_id?: string;
  category: string;
  description?: string;
  target_value: number;
  unit: string;
  deadline: string;
  is_completed?: boolean;
  current_value?: number;
  tracking_mode?: string;
  linked_session_id?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AppUser {
  user_id: string;
  name?: string;
  preferred_weapon?: string;
  handedness?: string;
  created_at?: string;
}

export interface DiaryEntry {
  entry_id: string;
  user_id: string;
  entry_text?: string;
  tags?: string[];
  learning_note?: string;
  linked_session_id?: string;
  created_at?: string;
}

export interface Drill {
  drill_id: string;
  name: string;
  category?: string;
  equipment_needed?: string;
  video_url?: string;
  image_url?: string;
  default_reps?: number;
  default_duration_sec?: number;
  default_rest_sec?: number;
  tempo_notes?: string;
  created_at?: string;
}

export interface Equipment {
  equipment_id: string;
  name: string;
  icon_url?: string;
  sport?: string;
}

export interface MatchApproval {
  approval_id: string;
  remote_id?: string;
  user_id?: string;
  has_approved?: boolean;
  timestamp?: string;
}

export interface MatchEvent {
  match_event_id: string;
  match_period_id?: string;
  fencing_remote_id?: string;
  match_id?: string;
  event_time?: string;
  event_type?: string;
  scoring_user_id?: string | null;
  scoring_user_name?: string; // Name of who scored
  card_given?: string | null;
  score_diff?: number | null; // Score difference at time of event (null if no user)
  seconds_since_last_event?: number; // Time since previous event
  fencer_1_name?: string; // User's name
  fencer_2_name?: string; // Opponent's name
}

export interface MatchPeriod {
  match_period_id: string;
  match_id: string;
  period_number?: number;
  start_time?: string;
  end_time?: string;
  fencer_1_score?: number;
  fencer_2_score?: number;
  fencer_1_cards?: number;
  fencer_2_cards?: number;
  priority_assigned?: string;
  priority_to?: string;
  timestamp?: string;
  notes?: string;
}

// Simplified types for UI components
export interface SimpleMatch {
  id: string;
  youScore: number;
  opponentScore: number;
  date: string;
  opponentName: string;
  isWin: boolean;
}

export interface SimpleGoal {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  deadline: string;
  isCompleted: boolean;
  progress: number;
}

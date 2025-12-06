import {
    AppUser, DiaryEntry, Drill, Equipment,
    FencingRemote, Goal, Match,
    MatchApproval, MatchEvent,
    SimpleGoal, SimpleMatch
} from '@/types/database';
import { supabase } from './supabase';

// Re-export supabase for use in other services
export { supabase };

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value?: string | null): value is string => {
  return !!value && UUID_V4_REGEX.test(value);
};

// Helper to clean up name casing
const formatFullName = (firstName?: string, lastName?: string, fallbackEmail?: string | null): string | undefined => {
  const normalize = (value?: string) => {
    if (!value) return '';
    return value
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const first = normalize(firstName);
  const last = normalize(lastName);
  const combined = `${first} ${last}`.trim();

  if (combined) {
    return combined;
  }

  if (fallbackEmail) {
    return fallbackEmail.split('@')[0] || undefined;
  }

  return undefined;
};

// Ensure match events always have a usable, monotonic match_time_elapsed value
const normalizeEventsForProgression = <T extends { match_time_elapsed?: number | null; timestamp?: string | null }>(events: T[]): T[] => {
  if (!events || events.length === 0) return [];

  const getMs = (ts?: string | null) => {
    if (!ts) return null;
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  const parseElapsed = (value?: number | null) => {
    if (typeof value === 'number') return value;
    if (value !== null && value !== undefined) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const sorted = [...events].sort((a, b) => {
    const aElapsed = parseElapsed(a.match_time_elapsed);
    const bElapsed = parseElapsed(b.match_time_elapsed);

    if (aElapsed !== null && bElapsed !== null) return aElapsed - bElapsed;
    if (aElapsed !== null) return -1;
    if (bElapsed !== null) return 1;

    const aMs = getMs(a.timestamp) ?? 0;
    const bMs = getMs(b.timestamp) ?? 0;
    return aMs - bMs;
  });

  const firstTimestampMs = sorted
    .map(ev => getMs(ev.timestamp))
    .find(ms => ms !== null) ?? null;

  let lastElapsed = 0;

  return sorted.map((event, index) => {
    let elapsed = parseElapsed(event.match_time_elapsed);

    // Fill missing elapsed time using timestamps if available, otherwise ensure monotonic +1s
    if (elapsed === null) {
      const eventMs = getMs(event.timestamp);
      if (eventMs !== null && firstTimestampMs !== null) {
        elapsed = Math.max(0, Math.round((eventMs - firstTimestampMs) / 1000));
      } else {
        elapsed = index === 0 ? 0 : lastElapsed + 1;
      }
    }

    if (elapsed < lastElapsed) {
      elapsed = lastElapsed + 1;
    }
    lastElapsed = elapsed;

    return { ...event, match_time_elapsed: elapsed };
  });
};

// User-related helpers
export const userService = {
  async getUserById(userId: string): Promise<AppUser | null> {
    try {
      const { data, error } = await supabase
        .from('app_user')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Error fetching user by ID:', error);
        }
        return null;
      }

      return data as AppUser;
    } catch (err) {
      console.error('Unexpected error fetching user by ID:', err);
      return null;
    }
  },

  async createUser(userId: string, email?: string | null, firstName?: string, lastName?: string): Promise<AppUser | null> {
    const name = formatFullName(firstName, lastName, email);

    const insertData: Partial<AppUser> & { user_id: string } = {
      user_id: userId,
      email: email || undefined,
      name,
    };

    try {
      const { data, error } = await supabase
        .from('app_user')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      return data as AppUser;
    } catch (err) {
      console.error('Unexpected error creating user:', err);
      return null;
    }
  },

  async updateUser(userId: string, updates: Partial<AppUser>): Promise<AppUser | null> {
    if (!updates || Object.keys(updates).length === 0) {
      return userService.getUserById(userId);
    }

    const payload: Partial<AppUser> = { ...updates };

    if ('name' in payload && payload.name) {
      payload.name = formatFullName(payload.name, undefined, undefined);
    }

    try {
      const { data, error } = await supabase
        .from('app_user')
        .update(payload)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return null;
      }

      return data as AppUser;
    } catch (err) {
      console.error('Unexpected error updating user:', err);
      return null;
    }
  }
};

type GoalRecord = Goal & {
  progress?: number;
};

export interface GoalUpdateResponse {
  completedGoals: SimpleGoal[];
  failedGoals: Array<{ id: string; title: string; reason: string }>; 
}

interface GoalService {
  getActiveGoals(userId: string): Promise<SimpleGoal[]>;
  createGoal(goalData: Partial<Goal>, userId: string): Promise<SimpleGoal | null>;
  updateGoal(goalId: string, updates: Partial<Goal>): Promise<SimpleGoal | null>;
  deleteGoal(goalId: string): Promise<boolean>;
  deactivateGoal(goalId: string): Promise<boolean>;
  deactivateAllCompletedGoals(userId: string): Promise<number>;
  deactivateExpiredGoals(userId: string): Promise<number>;
  recalculateGoalProgress(goalId: string, userId: string): Promise<SimpleGoal | null>;
  updateGoalsAfterMatch(userId: string, matchResult: 'win' | 'loss' | null, finalScore: number, opponentScore: number): Promise<GoalUpdateResponse>;
}

const calculateProgressPercentage = (currentValue: number, targetValue: number): number => {
  if (!targetValue || targetValue <= 0) {
    return 0;
  }
  const raw = Math.round((currentValue / targetValue) * 100);
  return Math.max(0, Math.min(100, raw));
};

const normalizeGoalRecord = (goal: GoalRecord): SimpleGoal => {
  const targetValue = goal.target_value ?? 0;
  const currentValue = goal.current_value ?? 0;
  const deadlineIso = goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '';

  return {
    id: goal.goal_id,
    title: goal.category || 'Goal',
    description: goal.description || '',
    targetValue,
    currentValue,
    deadline: deadlineIso,
    isCompleted: !!goal.is_completed,
    isFailed: goal.is_failed ?? false,
    progress: calculateProgressPercentage(currentValue, targetValue),
    match_window: goal.match_window ?? undefined,
    starting_match_count: goal.starting_match_count ?? undefined,
  };
};

const fetchGoalRecord = async (goalId: string): Promise<GoalRecord | null> => {
  const { data, error } = await supabase
    .from('goal')
    .select('*')
    .eq('goal_id', goalId)
    .single();

  if (error) {
    console.error('Error fetching goal record:', error);
    return null;
  }

  return data as GoalRecord;
};

const updateGoalRecord = async (goalId: string, updates: Partial<Goal>): Promise<GoalRecord | null> => {
  const { data, error } = await supabase
    .from('goal')
    .update(updates)
    .eq('goal_id', goalId)
    .select()
    .single();

  if (error) {
    console.error('Error updating goal record:', error);
    return null;
  }

  return data as GoalRecord;
};

interface SimplifiedMatch {
  isWin: boolean;
  margin: number;
}

const fetchUserMatchesForGoal = async (userId: string): Promise<SimplifiedMatch[]> => {
  if (!isValidUuid(userId)) {
    console.warn('Skipping match fetch for goal recalculation due to invalid userId', { userId });
    return [];
  }

  const { data, error } = await supabase
    .from('match')
    .select('match_id, final_score, touches_against, result, event_date')
    .eq('user_id', userId)
    .order('event_date', { ascending: false })
    .order('match_id', { ascending: false });

  if (error) {
    console.error('Error fetching matches for goal recalculation:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return [];
  }

  return (data || []).map((match: any) => {
    const finalScore = match.final_score ?? 0;
    const opponentScore = match.touches_against ?? 0;
    const result = (match.result || '').toString().toLowerCase();
    const isWin = result === 'win' || result === 'victory' || finalScore > opponentScore;
    return {
      isWin,
      margin: finalScore - opponentScore,
    };
  });
};

const computeGoalValueFromMatches = (goal: GoalRecord, matches: SimplifiedMatch[]): number => {
  const startingCount = goal.starting_match_count ?? 0;
  const matchesSinceGoal = matches.slice(0, Math.max(0, matches.length - startingCount));
  const category = goal.category || '';

  switch (category) {
    case 'Total Matches Played':
      return matchesSinceGoal.length;
    case 'Wins': {
      if (goal.match_window && goal.match_window > 0) {
        const windowMatches = matchesSinceGoal.slice(0, goal.match_window);
        return windowMatches.filter(match => match.isWin).length;
      }
      return matchesSinceGoal.filter(match => match.isWin).length;
    }
    case 'Average Margin of Victory': {
      if (matchesSinceGoal.length === 0) {
        return 0;
      }
      const totalMargin = matchesSinceGoal.reduce((sum, match) => sum + match.margin, 0);
      const average = totalMargin / matchesSinceGoal.length;
      return Math.round(average * 100) / 100;
    }
    case 'Streaks': {
      let streak = 0;
      for (const match of matchesSinceGoal) {
        if (match.isWin) {
          streak += 1;
        } else {
          break;
        }
      }
      return streak;
    }
    default:
      return goal.current_value ?? 0;
  }
};

const handleDeadlineStatus = async (goal: GoalRecord): Promise<{ updatedGoal?: GoalRecord; failed?: { id: string; title: string; reason: string } }> => {
  if (!goal.deadline) {
    return {};
  }

  const deadlineDate = new Date(goal.deadline);
  const now = new Date();

  if (!goal.is_completed && goal.is_active !== false && deadlineDate < now) {
    const updated = await updateGoalRecord(goal.goal_id, {
      is_active: false,
      is_failed: true,
      updated_at: now.toISOString(),
    });

    if (updated) {
      return {
        updatedGoal: updated,
        failed: {
          id: updated.goal_id,
          title: updated.category || 'Goal',
          reason: 'Deadline passed',
        },
      };
    }
  }

  return {};
};

const updateGoalProgressInternal = async (goal: GoalRecord, newValue: number): Promise<GoalRecord | null> => {
  const targetValue = goal.target_value ?? 0;
  const currentValue = Number.isFinite(newValue) ? newValue : 0;
  const isCompleted = targetValue > 0 ? currentValue >= targetValue : false;

  return updateGoalRecord(goal.goal_id, {
    current_value: currentValue,
    is_completed: isCompleted,
    is_failed: isCompleted ? false : goal.is_failed,
    updated_at: new Date().toISOString(),
  });
};

const computeIncrementalUpdate = (
  goal: GoalRecord,
  matchResult: 'win' | 'loss' | null,
  finalScore: number,
  opponentScore: number
): { needsRecalc: boolean; newValue: number | null } => {
  const category = goal.category || '';
  const currentValue = goal.current_value ?? 0;

  switch (category) {
    case 'Total Matches Played':
      return { needsRecalc: false, newValue: currentValue + 1 };
    case 'Wins': {
      if (goal.match_window && goal.match_window > 0) {
        return { needsRecalc: true, newValue: null };
      }
      if (matchResult === 'win') {
        return { needsRecalc: false, newValue: currentValue + 1 };
      }
      return { needsRecalc: false, newValue: currentValue };
    }
    case 'Average Margin of Victory':
      return { needsRecalc: true, newValue: null };
    case 'Streaks': {
      if (matchResult === 'win') {
        return { needsRecalc: false, newValue: currentValue + 1 };
      }
      return { needsRecalc: false, newValue: 0 };
    }
    default:
      return { needsRecalc: false, newValue: currentValue };
  }
};

export const goalService: GoalService = {
  async getActiveGoals(userId: string): Promise<SimpleGoal[]> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping active goal fetch due to invalid userId', { userId });
      return [];
    }

    const { data, error } = await supabase
      .from('goal')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active goals:', error);
      return [];
    }

    return (data || []).map(goal => normalizeGoalRecord(goal as GoalRecord));
  },

  async createGoal(goalData: Partial<Goal>, userId: string): Promise<SimpleGoal | null> {
    const insertData: Partial<Goal> & { user_id: string } = {
      user_id: userId,
      category: goalData.category || 'Goal',
      description: goalData.description || '',
      target_value: goalData.target_value ?? 0,
      current_value: goalData.current_value ?? 0,
      unit: goalData.unit || 'Month',
      deadline: goalData.deadline || new Date().toISOString(),
      tracking_mode: goalData.tracking_mode || 'manual',
      is_active: goalData.is_active !== undefined ? goalData.is_active : true,
      is_completed: goalData.is_completed ?? false,
      is_failed: goalData.is_failed ?? false,
      match_window: goalData.match_window ?? undefined,
      starting_match_count: goalData.starting_match_count ?? undefined,
      created_at: goalData.created_at,
      updated_at: goalData.updated_at,
    };

    const { data, error } = await supabase
      .from('goal')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating goal:', error);
      return null;
    }

    return normalizeGoalRecord(data as GoalRecord);
  },

  async updateGoal(goalId: string, updates: Partial<Goal>): Promise<SimpleGoal | null> {
    if (!updates || Object.keys(updates).length === 0) {
      const existing = await fetchGoalRecord(goalId);
      return existing ? normalizeGoalRecord(existing) : null;
    }

    const updated = await updateGoalRecord(goalId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    return updated ? normalizeGoalRecord(updated) : null;
  },

  async deleteGoal(goalId: string): Promise<boolean> {
    const { error } = await supabase
      .from('goal')
      .delete()
      .eq('goal_id', goalId);

    if (error) {
      console.error('Error deleting goal:', error);
      return false;
    }

    return true;
  },

  async deactivateGoal(goalId: string): Promise<boolean> {
    const updated = await updateGoalRecord(goalId, {
      is_active: false,
      updated_at: new Date().toISOString(),
    });

    return !!updated;
  },

  async deactivateAllCompletedGoals(userId: string): Promise<number> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping deactivateAllCompletedGoals due to invalid userId', { userId });
      return 0;
    }

    const { data, error } = await supabase
      .from('goal')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_completed', true)
      .select('goal_id');

    if (error) {
      console.error('Error deactivating completed goals:', error);
      return 0;
    }

    return data?.length ?? 0;
  },

  async deactivateExpiredGoals(userId: string): Promise<number> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping deactivateExpiredGoals due to invalid userId', { userId });
      return 0;
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('goal')
      .update({ is_active: false, is_failed: true, updated_at: nowIso })
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_completed', false)
      .lt('deadline', nowIso)
      .select('goal_id');

    if (error) {
      console.error('Error deactivating expired goals:', error);
      return 0;
    }

    return data?.length ?? 0;
  },

  async recalculateGoalProgress(goalId: string, userId: string): Promise<SimpleGoal | null> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping goal recalculation due to invalid userId', { userId });
      return null;
    }

    const goalRecord = await fetchGoalRecord(goalId);
    if (!goalRecord) {
      return null;
    }

    const matches = await fetchUserMatchesForGoal(userId);
    const recomputedValue = computeGoalValueFromMatches(goalRecord, matches);
    const updatedRecord = await updateGoalProgressInternal(goalRecord, recomputedValue);

    if (!updatedRecord) {
      return null;
    }

    const deadlineCheck = await handleDeadlineStatus(updatedRecord);
    const finalRecord = deadlineCheck.updatedGoal ?? updatedRecord;

    return normalizeGoalRecord(finalRecord);
  },

  async updateGoalsAfterMatch(
    userId: string,
    matchResult: 'win' | 'loss' | null,
    finalScore: number,
    opponentScore: number
  ): Promise<GoalUpdateResponse> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping goal updates due to invalid userId', { userId, matchResult, finalScore, opponentScore });
      return { completedGoals: [], failedGoals: [] };
    }

    const { data: activeGoals, error } = await supabase
      .from('goal')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching goals for match update:', error);
      return { completedGoals: [], failedGoals: [] };
    }

    if (!activeGoals || activeGoals.length === 0) {
      return { completedGoals: [], failedGoals: [] };
    }

    const completedGoals: SimpleGoal[] = [];
    const failedGoals: Array<{ id: string; title: string; reason: string }> = [];
    let cachedMatches: SimplifiedMatch[] | null = null;

    for (const rawGoal of activeGoals) {
      const goalRecord = rawGoal as GoalRecord;
      const previouslyCompleted = !!goalRecord.is_completed;

      const { needsRecalc, newValue } = computeIncrementalUpdate(goalRecord, matchResult, finalScore, opponentScore);

      let updatedRecord: GoalRecord | null = null;

      if (needsRecalc) {
        if (!cachedMatches) {
          cachedMatches = await fetchUserMatchesForGoal(userId);
        }
        const recomputedValue = computeGoalValueFromMatches(goalRecord, cachedMatches);
        updatedRecord = await updateGoalProgressInternal(goalRecord, recomputedValue);
      } else if (newValue !== null) {
        updatedRecord = await updateGoalProgressInternal(goalRecord, newValue);
      } else {
        updatedRecord = goalRecord;
      }

      if (!updatedRecord) {
        continue;
      }

      const deadlineResult = await handleDeadlineStatus(updatedRecord);
      const effectiveRecord = deadlineResult.updatedGoal ?? updatedRecord;

      if (deadlineResult.failed) {
        failedGoals.push(deadlineResult.failed);
      }

      const normalized = normalizeGoalRecord(effectiveRecord);

      if (!previouslyCompleted && normalized.isCompleted) {
        completedGoals.push(normalized);
      }
    }

    return { completedGoals, failedGoals };
  },
};

// Match-related functions
export const matchService = {
  // Get recent matches for a user
  async getRecentMatches(userId: string, limit: number = 10): Promise<SimpleMatch[]> {
    console.log('🔍 getRecentMatches called with userId:', userId, 'limit:', limit);
    
    // Fetch user's name to identify which fencer is the user (handles swaps correctly)
    const userProfile = await userService.getUserById(userId);
    const userDisplayName = userProfile?.name || '';
    
    // Helper function to normalize names for comparison
    const normalizeName = (name?: string | null): string => {
      if (!name) return '';
      return name.trim().toLowerCase();
    };
    
    const normalizedUserName = normalizeName(userDisplayName);
    
    console.log('👤 User identification for opponent matching:', {
      userId,
      userDisplayName,
      normalizedUserName
    });
    
    const { data, error } = await supabase
      .from('match')
      .select(`
        *,
        match_period(end_time)
      `)
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .order('match_id', { ascending: false }) // Secondary sort by match_id for same-day matches
      .limit(limit);

    if (error) {
      console.error('Error fetching matches:', error);
      return [];
    }

    console.log('📊 Raw matches data from database:', data?.length, 'matches found');
    console.log('📊 Match details:', data?.map(m => ({ 
      id: m.match_id, 
      fencer1: m.fencer_1_name,
      fencer2: m.fencer_2_name,
      source: m.source, 
      hasPeriods: m.match_period?.length > 0 
    })));

    const matches = data?.map(match => {
      // Get the latest period end time as the match completion time
      const matchPeriods = match.match_period as any[];
      let completionTime: string | undefined;
      let completionTimestamp: number | undefined;
      
      if (matchPeriods && matchPeriods.length > 0) {
        // Find the period with the latest end_time
        const sortedPeriods = [...matchPeriods].sort((a, b) => {
          if (!a.end_time) return 1;
          if (!b.end_time) return -1;
          return new Date(b.end_time).getTime() - new Date(a.end_time).getTime();
        });
        
        if (sortedPeriods[0]?.end_time) {
          const endTime = new Date(sortedPeriods[0].end_time);
          completionTimestamp = endTime.getTime();
          // Format as HH:MM
          const hours = endTime.getHours().toString().padStart(2, '0');
          const minutes = endTime.getMinutes().toString().padStart(2, '0');
          completionTime = `${hours}:${minutes}`;
        }
      } else {
        // For manual matches without match_period, use event_date and event_time
        if (match.event_date) {
          const eventDateTime = new Date(match.event_date);
          completionTimestamp = eventDateTime.getTime();
          // Format as HH:MM
          const hours = eventDateTime.getHours().toString().padStart(2, '0');
          const minutes = eventDateTime.getMinutes().toString().padStart(2, '0');
          completionTime = `${hours}:${minutes}`;
        }
      }
      
      // Determine which fencer is the user and which is the opponent
      // This correctly handles cases where fencers were swapped during the match
      const fencer1Name = match.fencer_1_name || '';
      const fencer2Name = match.fencer_2_name || '';
      const normalizedFencer1 = normalizeName(fencer1Name);
      const normalizedFencer2 = normalizeName(fencer2Name);
      
      // Special case: manual matches may store "You" as fencer_1_name
      const isManualMatchWithYou = match.source === 'manual' && 
        (normalizedFencer1 === 'you' || fencer1Name === 'You');
      
      // Check which fencer matches the user
      const isFencer1User = isManualMatchWithYou || 
        (normalizedUserName && normalizedFencer1 
          ? normalizedFencer1 === normalizedUserName 
          : false);
      const isFencer2User = normalizedUserName && normalizedFencer2 
        ? normalizedFencer2 === normalizedUserName 
        : false;
      
      // Determine opponent name (whichever fencer is NOT the user)
      let opponentName: string;
      if (isFencer1User) {
        // User is fencer_1, so opponent is fencer_2
        opponentName = fencer2Name || 'Unknown';
      } else if (isFencer2User) {
        // User is fencer_2, so opponent is fencer_1
        opponentName = fencer1Name || 'Unknown';
      } else {
        // Fallback: if we can't identify the user, use fencer_2 (old behavior)
        // This handles edge cases where user name doesn't match either fencer name
        opponentName = fencer2Name || 'Unknown';
        console.log('⚠️ Could not identify user in match, using fallback:', {
          matchId: match.match_id,
          fencer1Name,
          fencer2Name,
          userDisplayName,
          source: match.source
        });
      }
      
      return {
        id: match.match_id,
        youScore: match.final_score || 0,
        opponentScore: match.touches_against || 0,
        date: match.event_date ? new Date(match.event_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        time: completionTime,
        opponentName: opponentName, // Use the calculated opponent name (handles swaps correctly)
        isWin: match.is_win || false,
        matchType: match.match_type || undefined,
        source: match.source || 'unknown', // Include source field
        notes: match.notes || '', // Include notes field
        _completionTimestamp: completionTimestamp, // Internal field for sorting
      };
    }) || [];

    // Sort by completion timestamp (most recent first)
    // Matches with timestamps come first, then by date
    const sortedMatches = matches.sort((a, b) => {
      if (a._completionTimestamp && b._completionTimestamp) {
        return b._completionTimestamp - a._completionTimestamp;
      }
      if (a._completionTimestamp && !b._completionTimestamp) return -1;
      if (!a._completionTimestamp && b._completionTimestamp) return 1;
      // Fallback to date comparison
      return b.date.localeCompare(a.date);
    }).map(({ _completionTimestamp, ...match }) => match); // Remove internal field

    console.log('✅ Final processed matches:', sortedMatches.length, 'matches');
    console.log('✅ Match summary:', sortedMatches.map(m => ({ 
      id: m.id, 
      opponent: m.opponentName, 
      source: m.source, 
      date: m.date,
      time: m.time 
    })));

    return sortedMatches;
  },

  // Get all matches for training time calculation
  async getAllMatchesForTrainingTime(userId: string): Promise<{ bout_length_s: number }[]> {
    const { data, error } = await supabase
      .from('match')
      .select('bout_length_s')
      .eq('user_id', userId)
      .not('bout_length_s', 'is', null); // Only get matches with duration data

    if (error) {
      console.error('Error fetching matches for training time:', error);
      return [];
    }

    return data || [];
  },

  // Create a manual match
  async createManualMatch(matchData: {
    userId: string;
    opponentName: string;
    yourScore: number;
    opponentScore: number;
    matchType: 'training' | 'competition';
    date: string;
    time: string;
    notes?: string;
    weaponType?: string;
  }): Promise<Match | null> {
    const { userId, opponentName, yourScore, opponentScore, matchType, date, time, notes, weaponType } = matchData;
    
    // Validate required fields
    if (!userId) {
      console.error('❌ Error: userId is required');
      return null;
    }
    
    if (!opponentName || opponentName.trim() === '') {
      console.error('❌ Error: opponentName is required and cannot be empty');
      return null;
    }
    
    // Parse date and time with validation
    const [day, month, year] = date.split('/');
    const [hour, minute] = time.replace(/[AP]M/i, '').split(':');
    const isPM = time.toUpperCase().includes('PM');
    
    // Validate parsed values
    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);
    
    let eventDateTime: Date;
    
    // Check for invalid values
    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) || isNaN(hourNum) || isNaN(minuteNum)) {
      console.error('❌ Invalid date/time values:', { day, month, year, hour, minute });
      // Fallback to current date/time
      eventDateTime = new Date();
      console.log('⚠️ Using current date/time as fallback:', eventDateTime.toISOString());
    } else if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31 || hourNum < 0 || hourNum > 23 || minuteNum < 0 || minuteNum > 59) {
      console.error('❌ Date/time values out of valid range:', { day: dayNum, month: monthNum, year: yearNum, hour: hourNum, minute: minuteNum });
      // Fallback to current date/time
      eventDateTime = new Date();
      console.log('⚠️ Using current date/time as fallback:', eventDateTime.toISOString());
    } else {
      let hour24 = hourNum;
      if (isPM && hour24 !== 12) hour24 += 12;
      if (!isPM && hour24 === 12) hour24 = 0;
      
      eventDateTime = new Date(yearNum, monthNum - 1, dayNum, hour24, minuteNum);
      
      // Validate the Date object is valid
      if (isNaN(eventDateTime.getTime())) {
        console.error('❌ Invalid Date object created from:', { day: dayNum, month: monthNum, year: yearNum, hour: hour24, minute: minuteNum });
        // Fallback to current date/time
        eventDateTime = new Date();
        console.log('⚠️ Using current date/time as fallback:', eventDateTime.toISOString());
      }
    }
    
    // Normalize weapon type to lowercase
    const normalizedWeaponType = weaponType ? weaponType.toLowerCase() : 'foil';
    
    const insertData = {
      user_id: userId,
      fencer_1_name: 'You', // User is always fencer 1 in manual matches
      fencer_2_name: opponentName.trim(),
      final_score: yourScore,
      // touches_against: opponentScore, // This is a generated column - will be calculated automatically
      event_date: eventDateTime.toISOString(),
      result: yourScore > opponentScore ? 'win' : 'loss',
      score_diff: yourScore - opponentScore,
      match_type: matchType,
      weapon_type: normalizedWeaponType,
      notes: notes || null,
      source: 'manual',
      is_complete: true,
    };

    console.log('🔄 Creating manual match with data:', insertData);

    let data, error;
    try {
      const result = await supabase
        .from('match')
        .insert(insertData)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } catch (networkError: any) {
      // Catch network-level errors (not Supabase errors)
      console.error('❌ Network error creating manual match:', networkError);
      throw new Error('Network request failed');
    }

    if (error) {
      console.error('❌ Error creating manual match:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        insertData: JSON.stringify(insertData, null, 2)
      });
      return null;
    }

    console.log('✅ Manual match created successfully:', data);
    return data;
  },

  // Create a new match from fencing remote data
  async createMatchFromRemote(remoteData: FencingRemote, userId: string | null): Promise<Match | null> {
    const matchData = {
      user_id: userId, // Can be null if user toggle is off
      fencer_1_name: remoteData.fencer_1_name,
      fencer_2_name: remoteData.fencer_2_name,
      final_score: remoteData.score_1 || 0,
      // touches_against is a generated column - removed from insert
      event_date: new Date().toISOString(),
      result: userId ? ((remoteData.score_1 || 0) > (remoteData.score_2 || 0) ? 'win' : 'loss') : null, // Only set result if user is present
      // is_win is a generated column - removed from insert
      score_diff: (remoteData.score_1 || 0) - (remoteData.score_2 || 0),
      match_type: 'training',
      weapon_type: remoteData.weapon_type || 'foil', // Use weapon_type from remote data, default to foil
      source: 'remote', // User is using the fencing remote
    };

    // If userId is null, we need to use an RPC function to bypass RLS for anonymous matches
    if (userId === null) {
      // Try RPC function for anonymous matches first
      console.log('🔄 Attempting RPC call for anonymous match with data:', matchData);
      
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('create_anonymous_match', {
          match_data: matchData
        });

      console.log('📡 RPC call result:', { rpcData, rpcError });

      if (!rpcError && rpcData) {
        // Validate that we got a match_id back
        if (!rpcData.match_id) {
          console.error('❌ RPC succeeded but returned no match_id:', rpcData);
          return null;
        }
        console.log('✅ RPC function succeeded, returning data:', rpcData);
        return rpcData as Match;
      }

      // If RPC fails, log the specific error
      if (rpcError) {
        console.error('❌ RPC function failed with error:', rpcError);
        console.error('❌ Anonymous matches require the RPC function. Please create it in Supabase.');
        console.error('📝 Run this SQL in your Supabase SQL editor:');
        console.error(`
CREATE OR REPLACE FUNCTION create_anonymous_match(match_data jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result_record record;
BEGIN
  INSERT INTO match (
    user_id, 
    fencer_1_name, 
    fencer_2_name, 
    final_score, 
    event_date, 
    result, 
    score_diff, 
    match_type, 
    source,
    weapon_type
  )
  VALUES (
    NULL, -- user_id is always null for anonymous matches
    (match_data->>'fencer_1_name')::text,
    (match_data->>'fencer_2_name')::text,
    (match_data->>'final_score')::integer,
    (match_data->>'event_date')::timestamptz,
    (match_data->>'result')::text,
    (match_data->>'score_diff')::integer,
    (match_data->>'match_type')::text,
    (match_data->>'source')::source_enum,
    (match_data->>'weapon_type')::text
  )
  RETURNING * INTO result_record;
  
  RETURN row_to_json(result_record);
END;
$$;
        `);
        return null;
      }
    }

    // Regular match creation (for authenticated users)
    const { data, error } = await supabase
      .from('match')
      .insert(matchData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating match:', error);
      return null;
    }

    // Validate that we got a match_id back
    if (!data?.match_id) {
      console.error('❌ Match insert succeeded but returned no match_id. This should not happen for authenticated users.');
      return null;
    }

    console.log('✅ Match created successfully:', data.match_id);
    return data;
  },

  // Get match by ID
  async getMatchById(matchId: string): Promise<Match | null> {
    const { data, error } = await supabase
      .from('match')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (error) {
      console.error('Error fetching match:', error);
      return null;
    }

    return data;
  },

  // Calculate best run for a match using Event + Period Hybrid approach
  async calculateBestRun(matchId: string, userName: string, remoteId?: string): Promise<number> {
    try {
      console.log('🏃 Calculating best run for match:', matchId, 'user:', userName);
      
      // Debug: Check what events exist in the database
      const { data: allEvents, error: allEventsError } = await supabase
        .from('match_event')
        .select('*')
        .order('timestamp', { ascending: true });
      
      if (allEventsError) {
        console.error('Error fetching all events for debugging:', allEventsError);
      } else {
        console.log('🔍 Debug: Total events in database:', allEvents?.length || 0);
        if (allEvents && allEvents.length > 0) {
          console.log('🔍 Debug: Recent events:', allEvents.slice(-5).map(e => ({
            match_id: e.match_id,
            fencing_remote_id: e.fencing_remote_id,
            scoring_user_name: e.scoring_user_name,
            timestamp: e.timestamp
          })));
        }
      }
      
      // 1. Get all match events ordered by timestamp (try both match_id and fencing_remote_id)
      let matchEvents = null;
      let eventsError = null;
      
      // First try to get events by match_id
      const { data: eventsByMatchId, error: matchIdError } = await supabase
        .from('match_event')
        .select('*')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });
      
      if (matchIdError) {
        console.error('Error fetching match events by match_id:', matchIdError);
      } else if (eventsByMatchId && eventsByMatchId.length > 0) {
        matchEvents = eventsByMatchId;
        console.log('Found', matchEvents.length, 'match events by match_id');
      } else {
        // If no events found by match_id, try to find events by fencing_remote_id
        if (remoteId) {
          console.log('Trying to find events by fencing_remote_id:', remoteId);
          const { data: eventsByRemoteId, error: remoteIdError } = await supabase
            .from('match_event')
            .select('*')
            .eq('fencing_remote_id', remoteId)
            .order('timestamp', { ascending: true });
          
          if (remoteIdError) {
            console.error('Error fetching match events by fencing_remote_id:', remoteIdError);
          } else if (eventsByRemoteId && eventsByRemoteId.length > 0) {
            matchEvents = eventsByRemoteId;
            console.log('Found', matchEvents.length, 'match events by fencing_remote_id');
          }
        }
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for best run calculation');
        return 0;
      }

      // 2. Get all match periods for context
      const { data: matchPeriods, error: periodsError } = await supabase
        .from('match_period')
        .select('*')
        .eq('match_id', matchId)
        .order('period_number', { ascending: true });

      if (periodsError) {
        console.error('Error fetching match periods for best run:', periodsError);
        return 0;
      }

      // 3. Helper function to get period for an event
      const getPeriodForEvent = (event: any) => {
        if (!matchPeriods || matchPeriods.length === 0) return 1;
        
        // Find the period that contains this event's timestamp
        for (const period of matchPeriods) {
          const eventTime = new Date(event.timestamp);
          const periodStart = new Date(period.start_time);
          const periodEnd = period.end_time ? new Date(period.end_time) : new Date();
          
          if (eventTime >= periodStart && eventTime <= periodEnd) {
            return period.period_number || 1;
          }
        }
        
        // Default to period 1 if no match found
        return 1;
      };

      // 4. Calculate best run using hybrid approach
      let currentRun = 0;
      let bestRun = 0;
      let currentPeriod = 1;
      let runDetails: string[] = [];

      console.log('📊 Processing', matchEvents.length, 'match events for best run calculation');

      for (const event of matchEvents) {
        // Check if we're in a new period (for logging purposes only)
        const eventPeriod = getPeriodForEvent(event);
        if (eventPeriod !== currentPeriod) {
          // Period changed - just update tracking, don't reset run
          currentPeriod = eventPeriod;
        }

        if (event.scoring_user_name === userName) {
          currentRun++;
          bestRun = Math.max(bestRun, currentRun);
          runDetails.push(`Touch ${currentRun} in period ${eventPeriod} at ${event.timestamp}`);
        } else if (event.scoring_user_name && event.scoring_user_name !== userName) {
          // Opponent scored - reset run (only opponent touches break the run)
          if (currentRun > 0) {
            runDetails.push(`Run of ${currentRun} ended by opponent touch in period ${eventPeriod}`);
          }
          currentRun = 0;
        }
      }

      console.log('🏆 Best run calculated:', bestRun);
      console.log('📝 Run details:', runDetails);
      
      return bestRun;
    } catch (error) {
      console.error('Error calculating best run:', error);
      return 0;
    }
  },

  // Calculate score progression data for chart (for user vs opponent matches)
  async calculateScoreProgression(matchId: string, userName: string, remoteId?: string): Promise<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }> {
    try {
      console.log('📈 Calculating score progression for USER vs OPPONENT match:', matchId, 'user:', userName);
      
      // DEBUG: First check if ANY events exist for this match (without null filter)
      const { data: allEvents, error: allEventsError } = await supabase
        .from('match_event')
        .select('match_event_id, scoring_user_name, match_time_elapsed, event_type, cancelled_event_id, fencer_1_name, fencer_2_name')
        .eq('match_id', matchId);
      
      console.log('🔍 DEBUG - All events for match:', {
        matchId,
        totalEvents: allEvents?.length || 0,
        eventsWithNullTime: allEvents?.filter(e => e.match_time_elapsed === null || e.match_time_elapsed === undefined).length || 0,
        eventsWithTime: allEvents?.filter(e => e.match_time_elapsed !== null && e.match_time_elapsed !== undefined).length || 0,
        sampleEvents: allEvents?.slice(0, 3).map(e => ({
          id: e.match_event_id,
          type: e.event_type,
          timeElapsed: e.match_time_elapsed,
          scorer: e.scoring_user_name
        })) || []
      });
      
      if (allEventsError) {
        console.error('Error fetching all match events (debug):', allEventsError);
      }
      
      // 1. Get all match events (including cancellation events), keeping timestamp so we can rebuild elapsed time when missing
      // Include fencer_1_name and fencer_2_name from events to handle swaps correctly
      const { data: matchEventsRaw, error: eventsError } = await supabase
        .from('match_event')
        .select('match_event_id, scoring_user_name, match_time_elapsed, event_type, cancelled_event_id, fencer_1_name, fencer_2_name, timestamp')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });
      
      if (eventsError) {
        console.error('Error fetching match events for score progression:', eventsError);
        return { userData: [], opponentData: [] };
      }

      if (!matchEventsRaw || matchEventsRaw.length === 0) {
        console.log('No match events found for score progression calculation (with timestamp fallback)');
        return { userData: [], opponentData: [] };
      }

      // Fill in missing match_time_elapsed values so the chart can render (common in sabre/legacy matches)
      const matchEvents = normalizeEventsForProgression(matchEventsRaw);
      const missingElapsedCount = matchEventsRaw.filter(ev => ev.match_time_elapsed === null || ev.match_time_elapsed === undefined).length;
      if (missingElapsedCount > 0) {
        console.log('⏱️ Filled missing match_time_elapsed values for score progression:', {
          matchId,
          missingElapsedCount,
          totalEvents: matchEventsRaw.length,
        });
      }

      // 2. Build a Set of cancelled event IDs from cancellation events
      const cancelledEventIds = new Set<string>();
      for (const event of matchEvents) {
        if (event.event_type === 'cancel' && event.cancelled_event_id) {
          cancelledEventIds.add(event.cancelled_event_id);
          console.log('🚫 Found cancellation event for:', event.cancelled_event_id);
        }
      }

      console.log('📊 Total events:', matchEvents.length, 'Cancelled events:', cancelledEventIds.size);

      // 3. Get match data to determine user vs opponent AND final scores for validation
      const { data: matchData, error: matchError } = await supabase
        .from('match')
        .select('fencer_1_name, fencer_2_name, final_score, touches_against')
        .eq('match_id', matchId)
        .single();

      if (matchError || !matchData) {
        console.error('Error fetching match data for score progression:', matchError);
        return { userData: [], opponentData: [] };
      }

      console.log('📈 USER vs OPPONENT - Fencer names:', matchData.fencer_1_name, 'vs', matchData.fencer_2_name);
      console.log('📈 USER vs OPPONENT - Match events found:', matchEvents.length);

      // 4. Deduplicate only exact duplicate IDs so rapid same-second touches are not dropped
      // (previously we deduped by time+scorer which incorrectly removed valid same-second touches)
      const seenEvents = new Set<string>();
      const duplicateEvents: string[] = [];
      
      const uniqueEvents = matchEvents.filter(event => {
        // Skip cancellation events themselves (they're not scoring events)
        if (event.event_type === 'cancel') {
          return false;
        }

        // Skip events that have been cancelled
        if (event.match_event_id && cancelledEventIds.has(event.match_event_id)) {
          console.log('🚫 Skipping cancelled event:', event.match_event_id);
          return false;
        }

        // Only dedupe when the match_event_id repeats (true duplicate)
        const eventKey = event.match_event_id || '';
        if (eventKey && seenEvents.has(eventKey)) {
          duplicateEvents.push(event.match_event_id || 'unknown');
          console.log(`🔄 Duplicate event detected and skipped by ID: ${event.match_event_id}`);
          return false;
        }
        
        if (eventKey) {
          seenEvents.add(eventKey);
        }
        return true;
      });

      if (duplicateEvents.length > 0) {
        console.log(`⚠️ Found ${duplicateEvents.length} duplicate events in match ${matchId}. These have been deduplicated by ID.`);
      }

      console.log(`📊 After deduplication: ${uniqueEvents.length} unique events (removed ${matchEvents.length - uniqueEvents.length} duplicates)`);

      // 5. Process unique events using stored match_time_elapsed, filtering out cancelled events
      // Use event's stored fencer_1_name/fencer_2_name to correctly handle swaps
      let userData: {x: string, y: number}[] = [];
      let opponentData: {x: string, y: number}[] = [];
      
      let userScore = 0;
      let opponentScore = 0;

      for (const event of uniqueEvents) {

        const displaySeconds = event.match_time_elapsed || 0;
        
        // Convert to MM:SS format
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Determine which fencer scored based on event's stored fencer names (handles swaps correctly)
        // Events store fencer_1_name and fencer_2_name at the time of the event
        // Match table stores final fencer_1_name and fencer_2_name (after any swaps)
        // We need to map the event's fencer to the final match fencer based on entity identity
        
        let isUserScored = false;
        
        // First, check if scorer matches userName directly
        if (event.scoring_user_name === userName) {
          isUserScored = true;
        } else if (event.fencer_1_name && event.fencer_2_name) {
          // Use event's stored fencer names to determine which entity scored
          // Then map to final match fencer names
          if (event.scoring_user_name === event.fencer_1_name) {
            // Fencer 1 scored at the time of event
            // Check if this entity is the user in the final match
            if (event.fencer_1_name === matchData.fencer_1_name && matchData.fencer_1_name === userName) {
              isUserScored = true;
            } else if (event.fencer_1_name === matchData.fencer_2_name && matchData.fencer_2_name === userName) {
              // Entity was swapped - fencer_1 at event time is fencer_2 at match end, and they're the user
              isUserScored = true;
            } else if (event.fencer_1_name === matchData.fencer_1_name) {
              // Same entity, still fencer_1 (no swap or swapped back)
              isUserScored = matchData.fencer_1_name === userName;
            } else if (event.fencer_1_name === matchData.fencer_2_name) {
              // Entity swapped - was fencer_1, now fencer_2
              isUserScored = matchData.fencer_2_name === userName;
            }
          } else if (event.scoring_user_name === event.fencer_2_name) {
            // Fencer 2 scored at the time of event
            // Check if this entity is the user in the final match
            if (event.fencer_2_name === matchData.fencer_2_name && matchData.fencer_2_name === userName) {
              isUserScored = true;
            } else if (event.fencer_2_name === matchData.fencer_1_name && matchData.fencer_1_name === userName) {
              // Entity was swapped - fencer_2 at event time is fencer_1 at match end, and they're the user
              isUserScored = true;
            } else if (event.fencer_2_name === matchData.fencer_2_name) {
              // Same entity, still fencer_2 (no swap or swapped back)
              isUserScored = matchData.fencer_2_name === userName;
            } else if (event.fencer_2_name === matchData.fencer_1_name) {
              // Entity swapped - was fencer_2, now fencer_1
              isUserScored = matchData.fencer_1_name === userName;
            }
          }
        } else {
          // Fallback: try to match directly with match table names
          if (event.scoring_user_name === matchData.fencer_1_name && matchData.fencer_1_name === userName) {
            isUserScored = true;
          } else if (event.scoring_user_name === matchData.fencer_2_name && matchData.fencer_2_name === userName) {
            isUserScored = true;
          }
        }

        if (isUserScored) {
          userScore++;
          const dataPoint = { x: timeString, y: userScore };
          userData.push(dataPoint);
        } else {
          opponentScore++;
          const dataPoint = { x: timeString, y: opponentScore };
          opponentData.push(dataPoint);
        }
      }
      

      console.log('📈 Final USER score progression:', userData);
      console.log('📈 Final OPPONENT score progression:', opponentData);

      // Validate and cap progression to match final scores
      // Determine which fencer is the user to map final scores correctly
      const isUserFencer1 = matchData.fencer_1_name === userName;
      const isUserFencer2 = matchData.fencer_2_name === userName;

      // Map final scores based on which fencer is the user
      // If user is fencer_1: user's score = final_score, opponent's = touches_against
      // If user is fencer_2: user's score = touches_against, opponent's = final_score
      const finalUserScore = isUserFencer1 
        ? (matchData.final_score || 0)
        : isUserFencer2
        ? (matchData.touches_against || 0)
        : (matchData.final_score || 0); // Fallback

      const finalOpponentScore = isUserFencer1
        ? (matchData.touches_against || 0)
        : isUserFencer2
        ? (matchData.final_score || 0)
        : (matchData.touches_against || 0); // Fallback

      // Get the last Y values from progression
      const lastUserY = userData.length > 0 ? userData[userData.length - 1].y : 0;
      const lastOpponentY = opponentData.length > 0 ? opponentData[opponentData.length - 1].y : 0;

      // If progression exceeds final scores, cap it and log warning
      if (lastUserY !== finalUserScore || lastOpponentY !== finalOpponentScore) {
        console.warn(`⚠️ Score progression mismatch detected!`, {
          matchId,
          userName,
          isUserFencer1,
          isUserFencer2,
          progression: { user: lastUserY, opponent: lastOpponentY },
          finalScores: { user: finalUserScore, opponent: finalOpponentScore },
          difference: { user: lastUserY - finalUserScore, opponent: lastOpponentY - finalOpponentScore }
        });
        
        // Cap the progression to final scores
        if (lastUserY > finalUserScore) {
          userData = userData.filter(point => point.y <= finalUserScore);
          if (userData.length > 0) {
            const lastPoint = userData[userData.length - 1];
            userData[userData.length - 1] = { ...lastPoint, y: finalUserScore };
          } else if (finalUserScore > 0) {
            // Add a point at the last time if needed
            const lastTime = uniqueEvents.length > 0 
              ? (uniqueEvents[uniqueEvents.length - 1].match_time_elapsed || 0)
              : 0;
            const minutes = Math.floor(lastTime / 60);
            const seconds = lastTime % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            userData.push({ x: timeString, y: finalUserScore });
          }
        }
        
        if (lastOpponentY > finalOpponentScore) {
          opponentData = opponentData.filter(point => point.y <= finalOpponentScore);
          if (opponentData.length > 0) {
            const lastPoint = opponentData[opponentData.length - 1];
            opponentData[opponentData.length - 1] = { ...lastPoint, y: finalOpponentScore };
          } else if (finalOpponentScore > 0) {
            const lastTime = uniqueEvents.length > 0 
              ? (uniqueEvents[uniqueEvents.length - 1].match_time_elapsed || 0)
              : 0;
            const minutes = Math.floor(lastTime / 60);
            const seconds = lastTime % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            opponentData.push({ x: timeString, y: finalOpponentScore });
          }
        }
      }

      return {
        userData,
        opponentData
      };
    } catch (error) {
      console.error('Error calculating score progression:', error);
      return { userData: [], opponentData: [] };
    }
  },

  // Calculate touches by period
  async calculateTouchesByPeriod(matchId: string, userName: string, remoteId?: string, finalUserScore?: number, finalOpponentScore?: number): Promise<{
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  }> {
    try {
      console.log('📊 Calculating touches by period for match:', matchId, 'user:', userName);
      
      // 1. Get all match events ordered by timestamp
      let matchEvents = null;
      
      // First try to get events by match_id
      const { data: eventsByMatchId, error: matchIdError } = await supabase
        .from('match_event')
        .select('match_event_id, event_type, cancelled_event_id, scoring_user_name, timestamp, match_time_elapsed, match_period_id')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });
      
      if (matchIdError) {
        console.error('Error fetching match events by match_id for touches by period:', matchIdError);
      } else if (eventsByMatchId && eventsByMatchId.length > 0) {
        matchEvents = eventsByMatchId;
        console.log('Found', matchEvents.length, 'match events by match_id for touches by period');
      } else {
        // If no events found by match_id, try to find events by fencing_remote_id
        if (remoteId) {
          console.log('Trying to find events by fencing_remote_id for touches by period:', remoteId);
          const { data: eventsByRemoteId, error: remoteIdError } = await supabase
            .from('match_event')
            .select('match_event_id, event_type, cancelled_event_id, scoring_user_name, timestamp, match_time_elapsed, match_period_id')
            .eq('fencing_remote_id', remoteId)
            .order('timestamp', { ascending: true });
          
          if (remoteIdError) {
            console.error('Error fetching match events by fencing_remote_id for touches by period:', remoteIdError);
          } else if (eventsByRemoteId && eventsByRemoteId.length > 0) {
            matchEvents = eventsByRemoteId;
            console.log('Found', matchEvents.length, 'match events by fencing_remote_id for touches by period');
          }
        }
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for touches by period calculation');
        return {
          period1: { user: 0, opponent: 0 },
          period2: { user: 0, opponent: 0 },
          period3: { user: 0, opponent: 0 }
        };
      }

      // 2. Build a Set of cancelled event IDs from cancellation events
      const cancelledEventIds = new Set<string>();
      for (const event of matchEvents) {
        if (event.event_type === 'cancel' && event.cancelled_event_id) {
          cancelledEventIds.add(event.cancelled_event_id);
          console.log('🚫 Found cancellation event for touches by period:', event.cancelled_event_id);
        }
      }

      console.log('📊 Total events for touches by period:', matchEvents.length, 'Cancelled events:', cancelledEventIds.size);

      // 3. Get final match scores to ensure accuracy
      let authoritativeUserScore = finalUserScore;
      let authoritativeOpponentScore = finalOpponentScore;
      
      // If final scores weren't passed, fetch them from the database
      if (authoritativeUserScore === undefined || authoritativeOpponentScore === undefined) {
        const { data: matchData, error: matchError } = await supabase
          .from('match')
          .select('final_score, touches_against, is_complete')
          .eq('match_id', matchId)
          .single();

        if (matchError) {
          console.error('Error fetching match data for touches by period:', matchError);
        }

        authoritativeUserScore = matchData?.final_score || 0;
        authoritativeOpponentScore = matchData?.touches_against || 0;
      }
      
      console.log('📊 Using authoritative final scores for touches by period:', authoritativeUserScore, '-', authoritativeOpponentScore);

      // 4. Get match periods to determine period boundaries
      const { data: matchPeriods, error: periodsError } = await supabase
        .from('match_period')
        .select('*')
        .eq('match_id', matchId)
        .order('period_number', { ascending: true });

      if (periodsError || !matchPeriods || matchPeriods.length === 0) {
        console.log('No match periods found, assuming all events are in period 1');
        // Count all events as period 1, filtering out cancelled events
        let userTouches = 0;
        let opponentTouches = 0;
        
        for (const event of matchEvents) {
          // Skip cancellation events themselves
          if (event.event_type === 'cancel') {
            continue;
          }

          // Skip events that have been cancelled
          if (event.match_event_id && cancelledEventIds.has(event.match_event_id)) {
            console.log('🚫 Skipping cancelled event for touches by period:', event.match_event_id);
            continue;
          }

          if (event.scoring_user_name === userName) {
            userTouches++;
            console.log(`📊 User touch counted in period 1, total: ${userTouches}`);
          } else if (event.scoring_user_name && event.scoring_user_name !== userName) {
            opponentTouches++;
            console.log(`📊 Opponent touch counted in period 1, total: ${opponentTouches}`);
          }
        }
        
        return {
          period1: { user: userTouches, opponent: opponentTouches },
          period2: { user: 0, opponent: 0 },
          period3: { user: 0, opponent: 0 }
        };
      }

      // Map match_period_id to period_number for reliable assignment (avoids time-based misalignment when periods are skipped)
      const periodNumberById: Record<string, number> = {};
      if (matchPeriods) {
        matchPeriods.forEach(period => {
          if (period.match_period_id) {
            periodNumberById[period.match_period_id] = period.period_number || 1;
          }
        });
      }

      // 5. Calculate touches for each period
      const touchesByPeriod = {
        period1: { user: 0, opponent: 0 },
        period2: { user: 0, opponent: 0 },
        period3: { user: 0, opponent: 0 }
      };

      // Track total touches (no longer need to cap - cancelled events are filtered)
      let totalUserTouches = 0;
      let totalOpponentTouches = 0;

      // Find the latest event timestamp to use as fallback for period 3's end_time
      // This handles cases where period 3 doesn't have an end_time set yet
      // Only consider non-cancelled events for the latest time
      const validEvents = matchEvents.filter(e => 
        e.event_type !== 'cancel' && 
        (!e.match_event_id || !cancelledEventIds.has(e.match_event_id))
      );
      const latestEventTime = validEvents.length > 0 
        ? new Date(Math.max(...validEvents.map(e => new Date(e.timestamp).getTime())))
        : new Date();
      
      // Add a small buffer (5 seconds) to ensure events at the end are included
      const matchCompletionTime = new Date(latestEventTime.getTime() + 5000);

      for (const event of matchEvents) {
        // Skip cancellation events themselves
        if (event.event_type === 'cancel') {
          continue;
        }

        // Skip events that have been cancelled
        if (event.match_event_id && cancelledEventIds.has(event.match_event_id)) {
          console.log('🚫 Skipping cancelled event for touches by period:', event.match_event_id);
          continue;
        }
        // Determine which period this event belongs to
        let eventPeriod = 1; // Default to period 1
        
        // Prefer match_period_id mapping to avoid timing errors when periods are skipped or have missing end_time
        if (event.match_period_id && periodNumberById[event.match_period_id]) {
          eventPeriod = periodNumberById[event.match_period_id];
        } else if (matchPeriods.length > 0) {
          const firstPeriodStart = new Date(matchPeriods[0].start_time);
          const eventTime = new Date(event.timestamp);
          
          console.log(`📊 Event: ${event.scoring_user_name} at ${event.timestamp}, First period start: ${firstPeriodStart.toISOString()}`);
          
          // If event happens before first period starts, count it as period 1
          if (eventTime < firstPeriodStart) {
            eventPeriod = 1;
            console.log(`📊 Event before first period start -> Period 1`);
          } else {
            // Check which period the event falls into
            // Use improved logic that handles edge cases
            let bestMatch: { period: number; distance: number } | null = null;
            
            for (let i = 0; i < matchPeriods.length; i++) {
              const period = matchPeriods[i];
              const periodStart = new Date(period.start_time);
              // For last period without end_time, use match completion time or future time
              let periodEnd: Date;
              if (period.end_time) {
                periodEnd = new Date(period.end_time);
              } else if (i === matchPeriods.length - 1) {
                // This is the last period - use match completion time or a future timestamp
                periodEnd = matchCompletionTime;
                console.log(`📊 Period ${period.period_number} has no end_time, using match completion time: ${periodEnd.toISOString()}`);
              } else {
                // Not the last period but no end_time - use next period's start_time
                const nextPeriod = matchPeriods[i + 1];
                periodEnd = nextPeriod ? new Date(nextPeriod.start_time) : matchCompletionTime;
              }
              
              // Check if event falls within period boundaries
              if (eventTime >= periodStart && eventTime <= periodEnd) {
                eventPeriod = period.period_number;
                console.log(`📊 Event falls in period ${eventPeriod} (${periodStart.toISOString()} - ${periodEnd.toISOString()})`);
                break;
              }
              
              // Track closest period for events that don't match exactly
              const distanceToStart = Math.abs(eventTime.getTime() - periodStart.getTime());
              const distanceToEnd = Math.abs(eventTime.getTime() - periodEnd.getTime());
              const minDistance = Math.min(distanceToStart, distanceToEnd);
              
              if (!bestMatch || minDistance < bestMatch.distance) {
                bestMatch = { period: period.period_number, distance: minDistance };
              }
            }
            
            // If no exact match found, assign to closest period (within 5 seconds tolerance)
            if (eventPeriod === 1 && bestMatch && bestMatch.distance < 5000) {
              eventPeriod = bestMatch.period;
              console.log(`📊 Event assigned to closest period ${eventPeriod} (distance: ${bestMatch.distance}ms)`);
            }
          }
        }

        // Count the touch (cancelled events already filtered out above)
        if (event.scoring_user_name === userName) {
          totalUserTouches++;
          if (eventPeriod === 1) touchesByPeriod.period1.user++;
          else if (eventPeriod === 2) touchesByPeriod.period2.user++;
          else if (eventPeriod === 3) touchesByPeriod.period3.user++;
          console.log(`📊 User touch counted in period ${eventPeriod}, total: ${totalUserTouches}`);
        } else if (event.scoring_user_name && event.scoring_user_name !== userName) {
          totalOpponentTouches++;
          if (eventPeriod === 1) touchesByPeriod.period1.opponent++;
          else if (eventPeriod === 2) touchesByPeriod.period2.opponent++;
          else if (eventPeriod === 3) touchesByPeriod.period3.opponent++;
          console.log(`📊 Opponent touch counted in period ${eventPeriod}, total: ${totalOpponentTouches}`);
        }
      }

      console.log('📊 Touches by period calculated:', touchesByPeriod);
      return touchesByPeriod;
    } catch (error) {
      console.error('Error calculating touches by period:', error);
      return {
        period1: { user: 0, opponent: 0 },
        period2: { user: 0, opponent: 0 },
        period3: { user: 0, opponent: 0 }
      };
    }
  },

  // Update a match
  async updateMatch(matchId: string, updates: {
    final_score?: number;
    // touches_against is a generated column - removed from updates
    result?: string | null;
    score_diff?: number | null;
    final_period?: number;
    yellow_cards?: number;
    red_cards?: number;
    priority_assigned?: string;
    bout_length_s?: number;
    is_complete?: boolean;
    notes?: string;
    period_number?: number;
    score_spp?: number;
    score_by_period?: any; // JSONB field for period-by-period scores
    match_type?: string;
    fencer_1_name?: string; // Update fencer names to reflect current positions (after swaps)
    fencer_2_name?: string; // Update fencer names to reflect current positions (after swaps)
    event_date?: string; // ISO string for event date/time
    weapon_type?: string; // Weapon type: 'foil', 'epee', 'sabre'
  }): Promise<Match | null> {
    // First, try to get the match to check if it's anonymous (user_id is null)
    const { data: existingMatch } = await supabase
      .from('match')
      .select('user_id')
      .eq('match_id', matchId)
      .single();

    // If this is an anonymous match (user_id is null), use RPC function
    if (existingMatch && existingMatch.user_id === null) {
      console.log('🔄 Updating anonymous match via RPC function');
      
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('update_anonymous_match', {
          match_id_param: matchId,
          updates: updates
        });

      console.log('📡 RPC update result:', { rpcData, rpcError });

      if (!rpcError && rpcData) {
        console.log('✅ RPC update succeeded:', rpcData);
        return rpcData;
      }

      // If RPC fails, log the specific error and try direct update as fallback
      if (rpcError) {
        console.error('❌ RPC update failed with error:', rpcError);
      }
      console.warn('⚠️ RPC update failed, trying direct update for anonymous match');
    }

    // Regular match update (or fallback for anonymous)
    const { data, error } = await supabase
      .from('match')
      .update(updates)
      .eq('match_id', matchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating match:', error);
      
      // If this is an anonymous match and we get RLS error, provide helpful message
      if (existingMatch && existingMatch.user_id === null && error.code === '42501') {
        console.error('❌ Anonymous match updates not allowed. Please create the RPC function.');
        console.error('📝 Run this SQL in your Supabase SQL editor:');
        console.error(`
CREATE OR REPLACE FUNCTION update_anonymous_match(match_id_param text, updates jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    result_record record;
BEGIN
    UPDATE match
    SET 
        final_score = COALESCE((updates->>'final_score')::integer, final_score),
        result = COALESCE((updates->>'result')::text, result),
        score_diff = COALESCE((updates->>'score_diff')::integer, score_diff),
        final_period = COALESCE((updates->>'final_period')::integer, final_period),
        yellow_cards = COALESCE((updates->>'yellow_cards')::integer, yellow_cards),
        red_cards = COALESCE((updates->>'red_cards')::integer, red_cards),
        priority_assigned = COALESCE((updates->>'priority_assigned')::text, priority_assigned),
        bout_length_s = COALESCE((updates->>'bout_length_s')::integer, bout_length_s),
        is_complete = COALESCE((updates->>'is_complete')::boolean, is_complete),
        notes = COALESCE((updates->>'notes')::text, notes),
        period_number = COALESCE((updates->>'period_number')::integer, period_number),
        score_spp = COALESCE((updates->>'score_spp')::integer, score_spp),
        score_by_period = COALESCE((updates->'score_by_period')::jsonb, score_by_period),
        fencer_1_name = COALESCE((updates->>'fencer_1_name')::text, fencer_1_name),
        fencer_2_name = COALESCE((updates->>'fencer_2_name')::text, fencer_2_name)
    WHERE match_id = match_id_param::uuid
    RETURNING * INTO result_record;
    
    RETURN row_to_json(result_record);
END;
$$;
        `);
      }
      
      return null;
    }

    return data;
  },

  // Delete a match and all related records
  async deleteMatch(matchId: string, fencingRemoteId?: string): Promise<boolean> {
    try {
      console.log('🗑️ Starting deleteMatch:', { matchId, fencingRemoteId });
      
      // Get match data before deletion for goal recalculation
      const { data: matchData, error: matchFetchError } = await supabase
        .from('match')
        .select('user_id, is_win, final_score, touches_against')
        .eq('match_id', matchId)
        .single();

      if (matchFetchError) {
        console.error('❌ Error fetching match data:', matchFetchError);
        return false;
      }

      const userId = matchData?.user_id;
      const wasWin = matchData?.is_win;
      const finalScore = matchData?.final_score;
      const opponentScore = matchData?.touches_against;
      
      // Delete in order: events -> periods -> match
      // 1. Delete all match events (by match_id OR fencing_remote_id)
      let eventsError = null;
      if (fencingRemoteId) {
        // Delete by fencing_remote_id (for events created during remote session)
        console.log('🗑️ Deleting match events by fencing_remote_id:', fencingRemoteId);
        const { data: eventsData, error } = await supabase
          .from('match_event')
          .delete()
          .eq('fencing_remote_id', fencingRemoteId)
          .select();
        eventsError = error;
        console.log('🗑️ Match events delete result:', { data: eventsData, error });
      } else {
        // Delete by match_id (fallback)
        console.log('🗑️ Deleting match events by match_id:', matchId);
        const { data: eventsData, error } = await supabase
          .from('match_event')
          .delete()
          .eq('match_id', matchId)
          .select();
        eventsError = error;
        console.log('🗑️ Match events delete result:', { data: eventsData, error });
      }

      if (eventsError) {
        console.error('❌ Error deleting match events:', eventsError);
        return false;
      } else {
        console.log('✅ Match events deleted successfully');
      }

      // 2. Delete all match periods
      console.log('🗑️ Deleting match periods by match_id:', matchId);
      
      // First, let's see what match_period records exist for this match_id
      const { data: existingPeriods, error: queryError } = await supabase
        .from('match_period')
        .select('*')
        .eq('match_id', matchId);
      
      if (queryError) {
        console.error('❌ Error querying match periods:', queryError);
      } else {
        console.log('🔍 Found match_period records to delete:', existingPeriods?.length || 0, existingPeriods);
      }
      
      const { data: periodsData, error: periodsError } = await supabase
        .from('match_period')
        .delete()
        .eq('match_id', matchId)
        .select();

      if (periodsError) {
        console.error('❌ Error deleting match periods:', periodsError);
        return false;
      } else {
        console.log('✅ Match periods deleted successfully:', periodsData?.length || 0, 'records deleted');
        if (periodsData && periodsData.length > 0) {
          console.log('🗑️ Deleted match_period IDs:', periodsData.map(p => p.match_period_id));
        }
      }

      // 3. Delete the match itself
      console.log('🗑️ Deleting match by match_id:', matchId);
      const { data: deletedMatchData, error: matchError } = await supabase
        .from('match')
        .delete()
        .eq('match_id', matchId)
        .select();

      if (matchError) {
        console.error('❌ Error deleting match:', matchError);
        return false;
      } else {
        console.log('✅ Match deleted successfully:', deletedMatchData);
      }

      // 4. Recalculate goals after deletion (reverse the match impact)
      if (userId && wasWin !== undefined && finalScore !== undefined && opponentScore !== undefined) {
        console.log('🔄 Recalculating goals after match deletion...');
        try {
          // Reverse the match result for goal recalculation
          const reverseResult = wasWin ? 'loss' : 'win';
          await goalService.updateGoalsAfterMatch(userId, reverseResult as 'win' | 'loss', opponentScore, finalScore);
          console.log('✅ Goals recalculated after match deletion');
        } catch (goalError) {
          console.error('❌ Error recalculating goals after deletion:', goalError);
          // Don't fail the deletion if goal recalculation fails
        }
      }

      console.log('Successfully deleted match and all related records:', matchId);
      return true;
    } catch (error) {
      console.error('Error in deleteMatch:', error);
      return false;
    }
  },

  // Calculate score progression data for anonymous matches (no user/opponent concept)
  async calculateAnonymousScoreProgression(matchId: string): Promise<{
    fencer1Data: {x: string, y: number}[],
    fencer2Data: {x: string, y: number}[]
  }> {
    try {
      console.log('📈 Calculating ANONYMOUS score progression for match:', matchId);
      
      // 1. Get all match events (including cancellation events), keeping timestamp so we can rebuild elapsed time when missing
      // Include fencer_1_name and fencer_2_name from events to handle swaps correctly
      const { data: matchEventsRaw, error: eventsError } = await supabase
        .from('match_event')
        .select('match_event_id, scoring_user_name, match_time_elapsed, event_type, cancelled_event_id, fencer_1_name, fencer_2_name, timestamp')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });
      
      if (eventsError) {
        console.error('Error fetching match events for anonymous score progression:', eventsError);
        return { fencer1Data: [], fencer2Data: [] };
      }

      if (!matchEventsRaw || matchEventsRaw.length === 0) {
        console.log('No match events found for anonymous score progression calculation');
        return { fencer1Data: [], fencer2Data: [] };
      }

      // Normalize missing elapsed values so the chart doesn't render blank when times weren't stored
      const matchEvents = normalizeEventsForProgression(matchEventsRaw);
      const missingElapsedCount = matchEventsRaw.filter(ev => ev.match_time_elapsed === null || ev.match_time_elapsed === undefined).length;
      if (missingElapsedCount > 0) {
        console.log('⏱️ Filled missing match_time_elapsed values for anonymous score progression:', {
          matchId,
          missingElapsedCount,
          totalEvents: matchEventsRaw.length,
        });
      }

      // 2. Build a Set of cancelled event IDs from cancellation events
      const cancelledEventIds = new Set<string>();
      for (const event of matchEvents) {
        if (event.event_type === 'cancel' && event.cancelled_event_id) {
          cancelledEventIds.add(event.cancelled_event_id);
          console.log('🚫 Found cancellation event for:', event.cancelled_event_id);
        }
      }

      console.log('📊 Total events:', matchEvents.length, 'Cancelled events:', cancelledEventIds.size);

      // 3. Get match data to get fencer names and final scores
      const { data: matchData, error: matchError } = await supabase
        .from('match')
        .select('fencer_1_name, fencer_2_name, final_score, touches_against')
        .eq('match_id', matchId)
        .single();

      if (matchError || !matchData) {
        console.error('Error fetching match data for anonymous score progression:', matchError);
        return { fencer1Data: [], fencer2Data: [] };
      }

      console.log('📈 ANONYMOUS - Fencer names:', matchData.fencer_1_name, 'vs', matchData.fencer_2_name);
      console.log('📈 ANONYMOUS - Match events found:', matchEvents.length);

      // 4. Deduplicate events by (match_time_elapsed, scoring_user_name, event_type)
      // This prevents duplicate events from being counted multiple times
      const seenEvents = new Set<string>();
      const duplicateEvents: string[] = [];
      
      const uniqueEvents = matchEvents.filter(event => {
        // Skip cancellation events themselves (they're not scoring events)
        if (event.event_type === 'cancel') {
          return false;
        }

        // Skip events that have been cancelled
        if (event.match_event_id && cancelledEventIds.has(event.match_event_id)) {
          console.log('🚫 Skipping cancelled event:', event.match_event_id);
          return false;
        }

        // Create unique key: match_time_elapsed + scoring_user_name + event_type
        // This ensures we only count one event per time/scorer combination
        const eventKey = `${event.match_time_elapsed}_${event.scoring_user_name}_${event.event_type}`;
        
        if (seenEvents.has(eventKey)) {
          duplicateEvents.push(event.match_event_id || 'unknown');
          console.log(`🔄 Duplicate event detected and skipped: ${event.match_event_id} (time: ${event.match_time_elapsed}s, scorer: ${event.scoring_user_name})`);
          return false;
        }
        
        seenEvents.add(eventKey);
        return true;
      });

      if (duplicateEvents.length > 0) {
        console.log(`⚠️ Found ${duplicateEvents.length} duplicate events in match ${matchId}. These have been deduplicated.`);
      }

      console.log(`📊 After deduplication: ${uniqueEvents.length} unique events (removed ${matchEvents.length - uniqueEvents.length} duplicates)`);

      // 5. Process unique events using stored match_time_elapsed
      // Use event's stored fencer_1_name/fencer_2_name to correctly handle swaps
      let fencer1Data: {x: string, y: number}[] = [];
      let fencer2Data: {x: string, y: number}[] = [];
      
      let fencer1Score = 0;
      let fencer2Score = 0;

      for (const event of uniqueEvents) {

        const displaySeconds = event.match_time_elapsed || 0;
        
        // Convert to MM:SS format
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Determine which fencer scored based on event's stored fencer names (handles swaps correctly)
        // Events store fencer_1_name and fencer_2_name at the time of the event
        // Match table stores final fencer_1_name and fencer_2_name (after any swaps)
        // We need to map the event's fencer to the final match fencer based on entity identity
        
        let isFencer1Scored = false;
        
        if (event.fencer_1_name && event.fencer_2_name) {
          // Use event's stored fencer names to determine which entity scored
          // Then map to final match fencer names
          if (event.scoring_user_name === event.fencer_1_name) {
            // Fencer 1 scored at the time of event
            // Check if this entity is fencer_1 or fencer_2 in the final match
            if (event.fencer_1_name === matchData.fencer_1_name) {
              // Same entity, still fencer_1 (no swap or swapped back)
              isFencer1Scored = true;
            } else if (event.fencer_1_name === matchData.fencer_2_name) {
              // Entity swapped - was fencer_1, now fencer_2
              isFencer1Scored = false;
            } else {
              // Fallback: try direct match
              isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
            }
          } else if (event.scoring_user_name === event.fencer_2_name) {
            // Fencer 2 scored at the time of event
            // Check if this entity is fencer_1 or fencer_2 in the final match
            if (event.fencer_2_name === matchData.fencer_2_name) {
              // Same entity, still fencer_2 (no swap or swapped back)
              isFencer1Scored = false;
            } else if (event.fencer_2_name === matchData.fencer_1_name) {
              // Entity swapped - was fencer_2, now fencer_1
              isFencer1Scored = true;
            } else {
              // Fallback: try direct match
              isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
            }
          } else {
            // Fallback: try direct match with match table names
            isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
          }
        } else {
          // Fallback: try direct match with match table names
          isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
        }

        if (isFencer1Scored) {
          fencer1Score++;
          const dataPoint = { x: timeString, y: fencer1Score };
          fencer1Data.push(dataPoint);
          console.log(`📈 ✅ Fencer 1 (${matchData.fencer_1_name}) touch counted: ${fencer1Score} at ${timeString}`);
        } else {
          fencer2Score++;
          const dataPoint = { x: timeString, y: fencer2Score };
          fencer2Data.push(dataPoint);
          console.log(`📈 ✅ Fencer 2 (${matchData.fencer_2_name}) touch counted: ${fencer2Score} at ${timeString}`);
        }
      }

      console.log('📈 Final fencer 1 score progression:', fencer1Data);
      console.log('📈 Final fencer 2 score progression:', fencer2Data);

      // Validate progression vs final scores for anonymous matches
      // Always trust progression counts for charting; finals may be stale or swapped after side switches
      const finalFencer1Score = matchData.final_score || 0;
      const finalFencer2Score = matchData.touches_against || 0;

      const lastFencer1Y = fencer1Data.length > 0 ? fencer1Data[fencer1Data.length - 1].y : 0;
      const lastFencer2Y = fencer2Data.length > 0 ? fencer2Data[fencer2Data.length - 1].y : 0;

      if (lastFencer1Y !== finalFencer1Score || lastFencer2Y !== finalFencer2Score) {
        console.warn(`⚠️ Anonymous score progression mismatch detected!`, {
          matchId,
          progression: { fencer1: lastFencer1Y, fencer2: lastFencer2Y },
          finalScores: { fencer1: finalFencer1Score, fencer2: finalFencer2Score },
          difference: { fencer1: lastFencer1Y - finalFencer1Score, fencer2: lastFencer2Y - finalFencer2Score }
        });
        // Do not mutate progression to match finals; keep progression as truth for charting
      }

      return {
        fencer1Data,
        fencer2Data
      };
    } catch (error) {
      console.error('Error calculating anonymous score progression:', error);
      return { fencer1Data: [], fencer2Data: [] };
    }
  },
};

// Fencing Remote functions
export const fencingRemoteService = {
  // Create a new fencing remote session
  async createRemoteSession(remoteData: Partial<FencingRemote>): Promise<FencingRemote | null> {
    const { data, error } = await supabase
      .from('fencing_remote')
      .insert(remoteData)
      .select()
      .single();

    if (error) {
      console.error('Error creating remote session:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: (error as any)?.code,
      });
      return null;
    }

    return data;
  },

  // Update remote session scores
  async updateRemoteScores(remoteId: string, score1: number, score2: number): Promise<boolean> {
    const { error } = await supabase
      .from('fencing_remote')
      .update({ 
        score_1: score1,
        score_2: score2,
      })
      .eq('remote_id', remoteId);

    if (error) {
      console.error('Error updating remote scores:', error);
      return false;
    }

    return true;
  },

  // Complete remote session and create match
  async completeRemoteSession(remoteId: string, userId: string): Promise<Match | null> {
    // Get the remote session data
    const { data: remoteData, error: remoteError } = await supabase
      .from('fencing_remote')
      .select('*')
      .eq('remote_id', remoteId)
      .single();

    if (remoteError || !remoteData) {
      console.error('Error fetching remote session:', remoteError);
      return null;
    }

    // Create match from remote data
    const match = await matchService.createMatchFromRemote(remoteData, userId);

    if (match) {
      // Update remote session with linked match ID
      await supabase
        .from('fencing_remote')
        .update({ linked_match_id: match.match_id })
        .eq('remote_id', remoteId);
    }

    return match;
  },

  // Delete a fencing remote session
  async deleteRemoteSession(remoteId: string): Promise<boolean> {
    console.log('🗑️ Deleting remote session:', remoteId);
    
    // Skip database deletion for offline sessions (they don't exist in the database)
    if (remoteId.startsWith('offline_')) {
      console.log('📱 Offline session detected - skipping database deletion (session only exists locally)');
      return true; // Return true since offline sessions don't need database deletion
    }
    
    const { data, error } = await supabase
      .from('fencing_remote')
      .delete()
      .eq('remote_id', remoteId)
      .select();

    if (error) {
      console.error('❌ Error deleting remote session:', error);
      return false;
    }

    console.log('✅ Successfully deleted remote session:', { remoteId, data });
    return true;
  },

  // Clean up orphaned match_period records (for debugging)
  async cleanupOrphanedPeriods(): Promise<boolean> {
    try {
      console.log('🧹 Checking for orphaned match_period records...');
      
      // Find match_period records that don't have corresponding match records
      const { data: orphanedPeriods, error } = await supabase
        .from('match_period')
        .select('match_period_id, match_id')
        .not('match_id', 'in', `(SELECT match_id FROM match)`);
      
      if (error) {
        console.error('❌ Error finding orphaned periods:', error);
        return false;
      }
      
      if (orphanedPeriods && orphanedPeriods.length > 0) {
        console.log('🗑️ Found orphaned match_period records:', orphanedPeriods.length);
        console.log('Orphaned period IDs:', orphanedPeriods.map(p => p.match_period_id));
        
        // Delete the orphaned records
        const { error: deleteError } = await supabase
          .from('match_period')
          .delete()
          .in('match_period_id', orphanedPeriods.map(p => p.match_period_id));
        
        if (deleteError) {
          console.error('❌ Error deleting orphaned periods:', deleteError);
          return false;
        }
        
        console.log('✅ Cleaned up orphaned match_period records');
      } else {
        console.log('✅ No orphaned match_period records found');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error in cleanupOrphanedPeriods:', error);
      return false;
    }
  },
};

// Diary Entry-related functions
export const diaryService = {
  // Get diary entries for a user
  async getDiaryEntries(userId: string, limit: number = 20): Promise<DiaryEntry[]> {
    const { data, error } = await supabase
      .from('diary_entry')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching diary entries:', error);
      return [];
    }

    return data || [];
  },

  // Create a new diary entry
  async createDiaryEntry(entryData: Partial<DiaryEntry>, userId: string): Promise<DiaryEntry | null> {
    const newEntry = {
      ...entryData,
      user_id: userId,
    };

    const { data, error } = await supabase
      .from('diary_entry')
      .insert(newEntry)
      .select()
      .single();

    if (error) {
      console.error('Error creating diary entry:', error);
      return null;
    }

    return data;
  },

  // Update diary entry
  async updateDiaryEntry(entryId: string, updates: Partial<DiaryEntry>): Promise<DiaryEntry | null> {
    const { data, error } = await supabase
      .from('diary_entry')
      .update(updates)
      .eq('entry_id', entryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating diary entry:', error);
      return null;
    }

    return data;
  },

  // Delete diary entry
  async deleteDiaryEntry(entryId: string): Promise<boolean> {
    const { error } = await supabase
      .from('diary_entry')
      .delete()
      .eq('entry_id', entryId);

    if (error) {
      console.error('Error deleting diary entry:', error);
      return false;
    }

    return true;
  },
};

// Drill-related functions
export const drillService = {
  // Get all drills
  async getDrills(category?: string): Promise<Drill[]> {
    let query = supabase
      .from('drill')
      .select('*')
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching drills:', error);
      return [];
    }

    return data || [];
  },

  // Get drill by ID
  async getDrillById(drillId: string): Promise<Drill | null> {
    const { data, error } = await supabase
      .from('drill')
      .select('*')
      .eq('drill_id', drillId)
      .single();

    if (error) {
      console.error('Error fetching drill:', error);
      return null;
    }

    return data;
  },

  // Create a new drill
  async createDrill(drillData: Partial<Drill>): Promise<Drill | null> {
    const { data, error } = await supabase
      .from('drill')
      .insert(drillData)
      .select()
      .single();

    if (error) {
      console.error('Error creating drill:', error);
      return null;
    }

    return data;
  },
};

// Equipment-related functions
export const equipmentService = {
  // Get all equipment
  async getEquipment(sport?: string): Promise<Equipment[]> {
    let query = supabase
      .from('equipment')
      .select('*')
      .order('name', { ascending: true });

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching equipment:', error);
      return [];
    }

    return data || [];
  },

  // Get equipment by ID
  async getEquipmentById(equipmentId: string): Promise<Equipment | null> {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('equipment_id', equipmentId)
      .single();

    if (error) {
      console.error('Error fetching equipment:', error);
      return null;
    }

    return data;
  },
};

// Match Approval-related functions
export const matchApprovalService = {
  // Get approvals for a user
  async getUserApprovals(userId: string): Promise<MatchApproval[]> {
    const { data, error } = await supabase
      .from('match_approval')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching match approvals:', error);
      return [];
    }

    return data || [];
  },

  // Create or update approval
  async approveMatch(remoteId: string, userId: string, approved: boolean): Promise<MatchApproval | null> {
    const approvalData = {
      remote_id: remoteId,
      user_id: userId,
      has_approved: approved,
      timestamp: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('match_approval')
      .upsert(approvalData, { onConflict: 'remote_id,user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating approval:', error);
      return null;
    }

    return data;
  },
};

// Match Event-related functions
export const matchEventService = {
  // Get events for a match
  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    const { data, error } = await supabase
      .from('match_event')
      .select('*')
      .eq('match_id', matchId)
      .order('event_time', { ascending: true });

    if (error) {
      console.error('Error fetching match events:', error);
      return [];
    }

    return data || [];
  },

  // Create a match event
  async createMatchEvent(eventData: Partial<MatchEvent>): Promise<MatchEvent | null> {
    const { data, error } = await supabase
      .from('match_event')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      console.error('Error creating match event:', error);
      return null;
    }

    return data;
  },
};

// Match Period Service
export const matchPeriodService = {
  // Create a new match period
  createMatchPeriod: async (periodData: {
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
    notes?: string;
  }) => {
    console.log('🔄 matchPeriodService.createMatchPeriod called with:', periodData);
    
    const { data, error } = await supabase
      .from('match_period')
      .insert(periodData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating match period:', error);
      return null;
    }

    console.log('✅ Match period created successfully:', data);
    return data;
  },

  // Get match periods for a specific match
  getMatchPeriods: async (matchId: string) => {
    const { data, error } = await supabase
      .from('match_period')
      .select('*')
      .eq('match_id', matchId)
      .order('period_number', { ascending: true });

    if (error) {
      console.error('Error fetching match periods:', error);
      return [];
    }

    return data;
  },

  // Update a match period
  updateMatchPeriod: async (periodId: string, updates: {
    end_time?: string;
    fencer_1_score?: number;
    fencer_2_score?: number;
    fencer_1_cards?: number;
    fencer_2_cards?: number;
    priority_assigned?: string;
    priority_to?: string;
    notes?: string;
    timestamp?: string; // Add timestamp to updates
  }) => {
    const { data, error } = await supabase
      .from('match_period')
      .update(updates)
      .eq('match_period_id', periodId)
      .select()
      .single();

    if (error) {
      console.error('Error updating match period:', error);
      return null;
    }

    return data;
  },

  // Note: Removed duplicate calculateScoreProgression function that was causing score inconsistencies
};

// ============================================
// WEEKLY TARGETS & SESSION LOGGING
// ============================================

// Types for Weekly Targets
export interface WeeklyTarget {
  target_id: string;
  user_id: string;
  activity_type: string;
  week_start_date: string; // ISO date string
  week_end_date: string;
  target_sessions: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklySessionLog {
  session_id: string;
  user_id: string;
  activity_type: string;
  session_date: string; // ISO date string
  duration_minutes?: number;
  notes?: string;
  created_at: string;
}

export interface WeeklyProgress {
  activity_type: string;
  target_sessions: number;
  completed_sessions: number;
  week_start_date: string;
  week_end_date: string;
  days_left: number;
  completion_rate: number; // 0-100
}

// Weekly Target Service
export const weeklyTargetService = {
  
  // Create or update a weekly target
  async setWeeklyTarget(
    userId: string,
    activityType: string,
    weekStartDate: Date,
    weekEndDate: Date,
    targetSessions: number
  ): Promise<WeeklyTarget | null> {
    try {
      const { data, error } = await supabase
        .from('weekly_target')
        .upsert({
          user_id: userId,
          activity_type: activityType,
          week_start_date: weekStartDate.toISOString().split('T')[0],
          week_end_date: weekEndDate.toISOString().split('T')[0],
          target_sessions: targetSessions,
          status: 'active', // Set as active target
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,activity_type,week_start_date'
        })
        .select()
        .single();

      if (error) {
        console.error('Error setting weekly target:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in setWeeklyTarget:', error);
      return null;
    }
  },

  // Get target for a specific week
  async getWeeklyTarget(
    userId: string,
    activityType: string,
    weekStartDate: Date
  ): Promise<WeeklyTarget | null> {
    try {
      const dateString = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`;
      
      const { data, error } = await supabase
        .from('weekly_target')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_type', activityType)
        .eq('week_start_date', dateString)
        .eq('status', 'active') // Only get active targets
        .single();
      
      console.log('🔍 Query params:', { userId, activityType, week_start_date: dateString });

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('🔍 No active target found for this week');
          return null; // No rows found
        }
        console.error('Error getting weekly target:', error);
        return null;
      }

      console.log('🔍 Found active target:', data);
      return data;
    } catch (error) {
      console.error('Error in getWeeklyTarget:', error);
      return null;
    }
  },

  // Delete a weekly target
  async deleteWeeklyTarget(targetId: string): Promise<boolean> {
    try {
      // First, get the target details to create history record
      const { data: target, error: fetchError } = await supabase
        .from('weekly_target')
        .select('*')
        .eq('target_id', targetId)
        .single();

      if (fetchError || !target) {
        console.error('Error fetching target for deletion:', fetchError);
        return false;
      }

      // Get completed sessions count
      const { data: sessions } = await supabase
        .from('weekly_session_log')
        .select('session_id')
        .eq('user_id', target.user_id)
        .eq('activity_type', target.activity_type)
        .gte('session_date', target.week_start_date)
        .lte('session_date', target.week_end_date);

      const completedSessions = sessions?.length || 0;
      const completionRate = target.target_sessions > 0 ? (completedSessions / target.target_sessions) * 100 : 0;

      // Check if there are any history records that reference this target
      const { data: existingHistory } = await supabase
        .from('weekly_completion_history')
        .select('id')
        .eq('original_target_id', targetId);

      // Only delete history records if they exist
      if (existingHistory && existingHistory.length > 0) {
        const { error: deleteHistoryError } = await supabase
          .from('weekly_completion_history')
          .delete()
          .eq('original_target_id', targetId);

        if (deleteHistoryError) {
          console.error('Error deleting existing history records:', deleteHistoryError);
        } else {
          console.log('✅ Existing history records deleted');
        }
      } else {
        console.log('ℹ️ No existing history records to delete (this is normal for new targets)');
      }

      // Create history record for deleted target
      const { error: historyError } = await supabase
        .from('weekly_completion_history')
        .insert({
          user_id: target.user_id,
          activity_type: target.activity_type,
          week_start_date: target.week_start_date,
          week_end_date: target.week_end_date,
          target_sessions: target.target_sessions,
          completed_sessions: completedSessions,
          completion_rate: completionRate,
          status: 'abandoned', // Mark as abandoned since user manually deleted
          completion_date: new Date().toISOString()
        });

      if (historyError) {
        console.error('Error creating deletion history:', historyError);
        // Continue with deletion even if history creation fails
      }

      // Clear session logs for the deleted target
      if (sessions && sessions.length > 0) {
        console.log('🗑️ Clearing', sessions.length, 'session logs for deleted target');
        for (const session of sessions) {
          await supabase
            .from('weekly_session_log')
            .delete()
            .eq('session_id', session.session_id);
        }
      }

      // Now delete the target
      const { error } = await supabase
        .from('weekly_target')
        .delete()
        .eq('target_id', targetId);

      if (error) {
        console.error('Error deleting weekly target:', error);
        return false;
      }

      console.log('✅ Target deleted and history record created');
      return true;
    } catch (error) {
      console.error('Error in deleteWeeklyTarget:', error);
      return false;
    }
  },

  // Get all targets for a specific activity
  async getAllTargetsForActivity(userId: string, activityType: string): Promise<WeeklyTarget[]> {
    try {
      const { data, error } = await supabase
        .from('weekly_target')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_type', activityType)
        .eq('status', 'active') // Only get active targets
        .order('week_start_date', { ascending: true });

      if (error) {
        console.error('Error getting all targets for activity:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllTargetsForActivity:', error);
      return [];
    }
  },

  // Mark a target as complete and create history record
  async markTargetComplete(targetId: string): Promise<boolean> {
    try {
      // First, get the target details
      const { data: target, error: fetchError } = await supabase
        .from('weekly_target')
        .select('*')
        .eq('target_id', targetId)
        .single();

      if (fetchError || !target) {
        console.error('Error fetching target for completion:', fetchError);
        return false;
      }

      // Get completed sessions count before clearing them
      const { data: sessions } = await supabase
        .from('weekly_session_log')
        .select('session_id')
        .eq('user_id', target.user_id)
        .eq('activity_type', target.activity_type)
        .gte('session_date', target.week_start_date)
        .lte('session_date', target.week_end_date);

      const completedSessions = sessions?.length || 0;
      const completionRate = target.target_sessions > 0 ? (completedSessions / target.target_sessions) * 100 : 0;

      // Clear the session logs for the completed target
      if (sessions && sessions.length > 0) {
        console.log('🗑️ Clearing', sessions.length, 'session logs for completed target');
        for (const session of sessions) {
          await supabase
            .from('weekly_session_log')
            .delete()
            .eq('session_id', session.session_id);
        }
        console.log('✅ Session logs cleared for completed target');
      }

      // Create history record (without foreign key reference)
      const { error: historyError } = await supabase
        .from('weekly_completion_history')
        .insert({
          user_id: target.user_id,
          activity_type: target.activity_type,
          week_start_date: target.week_start_date,
          week_end_date: target.week_end_date,
          target_sessions: target.target_sessions,
          completed_sessions: completedSessions,
          completion_rate: completionRate,
          status: 'completed',
          completion_date: new Date().toISOString()
        });

      if (historyError) {
        console.error('Error creating completion history:', historyError);
        return false;
      }

      // Delete the target completely after creating history record
      const { error: deleteError } = await supabase
        .from('weekly_target')
        .delete()
        .eq('target_id', targetId);

      if (deleteError) {
        console.error('Error deleting completed target:', deleteError);
        return false;
      }

      console.log('✅ Target deleted and history record created');
      return true;
    } catch (error) {
      console.error('Error in markTargetComplete:', error);
      return false;
    }
  }
};

// Weekly Session Log Service
export const weeklySessionLogService = {
  
  // Log a new session
  async logSession(
    userId: string,
    activityType: string,
    sessionDate?: Date,
    durationMinutes?: number,
    notes?: string
  ): Promise<WeeklySessionLog | null> {
    try {
      const { data, error } = await supabase
        .from('weekly_session_log')
        .insert({
          user_id: userId,
          activity_type: activityType,
          session_date: sessionDate 
            ? sessionDate.toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0],
          duration_minutes: durationMinutes,
          notes: notes
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in logSession:', error);
      return null;
    }
  },

  // Delete a session
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('weekly_session_log')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error deleting session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteSession:', error);
      return false;
    }
  },

  // Get sessions for a specific week
  async getSessionsForWeek(
    userId: string,
    weekStartDate: Date,
    weekEndDate: Date,
    activityType?: string
  ): Promise<WeeklySessionLog[]> {
    try {
      let query = supabase
        .from('weekly_session_log')
        .select('*')
        .eq('user_id', userId)
        .gte('session_date', weekStartDate.toISOString().split('T')[0])
        .lte('session_date', weekEndDate.toISOString().split('T')[0])
        .order('session_date', { ascending: false });

      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting sessions for week:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSessionsForWeek:', error);
      return [];
    }
  }
};

// Weekly Progress Service
export const weeklyProgressService = {
  
  // Get current week progress
  async getCurrentWeekProgress(
    userId: string,
    activityType: string
  ): Promise<WeeklyProgress | null> {
    try {
      // Calculate current week boundaries (Monday to Sunday) in local time
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Local date only
      
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysToMonday);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      console.log('📅 Week calculation:', {
        today: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
        dayOfWeek,
        daysToMonday,
        weekStart: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`,
        weekEnd: `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`
      });

      // Get target
      const target = await weeklyTargetService.getWeeklyTarget(
        userId,
        activityType,
        weekStart
      );
      
      console.log('🎯 Target fetched:', target);

      // Get completed sessions
      const sessions = await weeklySessionLogService.getSessionsForWeek(
        userId,
        weekStart,
        weekEnd,
        activityType
      );

      // Calculate days left
      const daysLeft = Math.floor(
        (weekEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate completion rate
      const targetSessions = target?.target_sessions || 0;
      const completedSessions = sessions.length;
      const completionRate = targetSessions > 0 
        ? Math.round((completedSessions / targetSessions) * 100) 
        : 0;

      return {
        activity_type: activityType,
        target_sessions: targetSessions,
        completed_sessions: completedSessions,
        week_start_date: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`,
        week_end_date: `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`,
        days_left: Math.max(0, daysLeft),
        completion_rate: Math.min(100, completionRate)
      };
    } catch (error) {
      console.error('Error in getCurrentWeekProgress:', error);
      return null;
    }
  }
};

// ============================================
// PRIORITY ROUND ANALYTICS SERVICE
// ============================================

export const priorityAnalyticsService = {
  // Get priority stats for a user
  async getPriorityStats(userId: string) {
    try {
      // Get all match periods with priority data for the user
      const { data, error } = await supabase
        .from('match_period')
        .select(`
          match_id,
          priority_assigned,
          priority_to,
          match!inner(user_id, fencer_1_name, fencer_2_name, event_date)
        `)
        .eq('match.user_id', userId)
        .not('priority_assigned', 'is', null)
        .eq('match.is_complete', true);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          totalPriorityRounds: 0,
          priorityWins: 0,
          priorityLosses: 0,
          priorityWinRate: 0
        };
      }

      // Get priority winners from match events
      const matchIds = data.map(mp => mp.match_id);
      const { data: winnerEvents, error: winnerError } = await supabase
        .from('match_event')
        .select('match_id, scoring_user_name, event_time')
        .in('match_id', matchIds)
        .eq('event_type', 'priority_winner');

      if (winnerError) throw winnerError;

      // Calculate stats
      const totalPriorityRounds = data.length;
      const priorityWins = data.filter(mp => {
        const winnerEvent = winnerEvents?.find(we => we.match_id === mp.match_id);
        return winnerEvent && winnerEvent.scoring_user_name === mp.priority_to;
      }).length;
      
      const priorityLosses = totalPriorityRounds - priorityWins;
      const priorityWinRate = totalPriorityRounds > 0 ? (priorityWins / totalPriorityRounds) * 100 : 0;

      return {
        totalPriorityRounds,
        priorityWins,
        priorityLosses,
        priorityWinRate: Math.round(priorityWinRate * 100) / 100
      };
    } catch (error) {
      console.error('Error getting priority stats:', error);
      return {
        totalPriorityRounds: 0,
        priorityWins: 0,
        priorityLosses: 0,
        priorityWinRate: 0
      };
    }
  },

  // Get priority performance over time
  async getPriorityPerformanceOverTime(userId: string, days: number = 30) {
    try {
      const { data, error } = await supabase
        .from('match_period')
        .select(`
          match_id,
          priority_assigned,
          priority_to,
          match!inner(user_id, event_date, fencer_1_name, fencer_2_name)
        `)
        .eq('match.user_id', userId)
        .not('priority_assigned', 'is', null)
        .eq('match.is_complete', true)
        .gte('match.event_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Get priority winners
      const matchIds = data.map(mp => mp.match_id);
      const { data: winnerEvents } = await supabase
        .from('match_event')
        .select('match_id, scoring_user_name, event_time')
        .in('match_id', matchIds)
        .eq('event_type', 'priority_winner');

      // Group by date and calculate stats
      const dailyStats: { [key: string]: { priorityRounds: number; priorityWins: number } } = {};
      data.forEach((mp: any) => {
        const date = mp.match.event_date ? new Date(mp.match.event_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { priorityRounds: 0, priorityWins: 0 };
        }
        dailyStats[date].priorityRounds++;
        
        const winnerEvent = winnerEvents?.find(we => we.match_id === mp.match_id);
        if (winnerEvent && winnerEvent.scoring_user_name === mp.priority_to) {
          dailyStats[date].priorityWins++;
        }
      });

      return Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        priorityRounds: stats.priorityRounds,
        priorityWins: stats.priorityWins,
        priorityLosses: stats.priorityRounds - stats.priorityWins,
        priorityWinRate: Math.round((stats.priorityWins / stats.priorityRounds) * 100 * 100) / 100
      }));
    } catch (error) {
      console.error('Error getting priority performance over time:', error);
      return [];
    }
  },

  // Get priority duration stats
  async getPriorityDurationStats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('match_event')
        .select(`
          match_id,
          event_time,
          match!inner(user_id)
        `)
        .eq('match.user_id', userId)
        .in('event_type', ['priority_round_start', 'priority_round_end'])
        .order('event_time', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          avgDurationSeconds: 0,
          minDurationSeconds: 0,
          maxDurationSeconds: 0,
          totalPriorityRounds: 0
        };
      }

      // Calculate durations by pairing start/end events
      const durations = [];
      for (let i = 0; i < data.length - 1; i += 2) {
        const start = new Date(data[i].event_time);
        const end = new Date(data[i + 1].event_time);
        const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
        durations.push(duration);
      }

      if (durations.length === 0) {
        return {
          avgDurationSeconds: 0,
          minDurationSeconds: 0,
          maxDurationSeconds: 0,
          totalPriorityRounds: 0
        };
      }

      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      return {
        avgDurationSeconds: Math.round(avgDuration),
        minDurationSeconds: minDuration,
        maxDurationSeconds: maxDuration,
        totalPriorityRounds: durations.length
      };
    } catch (error) {
      console.error('Error getting priority duration stats:', error);
      return {
        avgDurationSeconds: 0,
        minDurationSeconds: 0,
        maxDurationSeconds: 0,
        totalPriorityRounds: 0
      };
    }
  },

  // Get recent priority rounds
  async getRecentPriorityRounds(userId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('match_period')
        .select(`
          match_id,
          priority_assigned,
          priority_to,
          match!inner(user_id, event_date, fencer_1_name, fencer_2_name, result)
        `)
        .eq('match.user_id', userId)
        .not('priority_assigned', 'is', null)
        .eq('match.is_complete', true)
        .order('match.event_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Get priority winners
      const matchIds = data.map(mp => mp.match_id);
      const { data: winnerEvents } = await supabase
        .from('match_event')
        .select('match_id, scoring_user_name, event_time')
        .in('match_id', matchIds)
        .eq('event_type', 'priority_winner');

      return data.map((mp: any) => {
        const winnerEvent = winnerEvents?.find(we => we.match_id === mp.match_id);
        const priorityWon = winnerEvent && winnerEvent.scoring_user_name === mp.priority_to;
        
        return {
          matchId: mp.match_id,
          eventDate: mp.match.event_date ? new Date(mp.match.event_date).toISOString().split('T')[0] : 'Unknown',
          fencer1Name: mp.match.fencer_1_name,
          fencer2Name: mp.match.fencer_2_name,
          priorityFencer: mp.priority_to,
          priorityWinner: winnerEvent?.scoring_user_name || null,
          priorityWon,
          result: mp.match.result
        };
      });
    } catch (error) {
      console.error('Error getting recent priority rounds:', error);
      return [];
    }
  }
};

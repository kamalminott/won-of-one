import {
    AppUser, Competition, DiaryEntry, Drill, Equipment,
    FencingRemote, Goal, Match, MatchPeriod,
    MatchApproval, MatchEvent,
    SimpleGoal, SimpleMatch
} from '@/types/database';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCachedAuthSession, getLastAuthEvent } from './authSessionCache';
import {
  postgrestDelete,
  postgrestInsert,
  postgrestCount,
  postgrestRpc,
  postgrestSelect,
  postgrestSelectOne,
  postgrestUpdate,
  postgrestUpsert,
} from './postgrest';

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

const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateKey = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
};

// Ensure match events always have a usable, monotonic match_time_elapsed value
const normalizeEventsForProgression = <T extends { match_time_elapsed?: number | null; timestamp?: string | null; event_time?: string | null }>(events: T[]): T[] => {
  if (!events || events.length === 0) return [];

  const getMs = (ev: T) => {
    const ts = ev.timestamp || ev.event_time;
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

    const aMs = getMs(a) ?? 0;
    const bMs = getMs(b) ?? 0;
    return aMs - bMs;
  });

  const firstTimestampMs = sorted
    .map(ev => getMs(ev))
    .find(ms => ms !== null) ?? null;

  let lastElapsed = 0;

  return sorted.map((event, index) => {
    let elapsed = parseElapsed(event.match_time_elapsed);

    // Fill missing elapsed time using timestamps if available, otherwise ensure monotonic +1s
    if (elapsed === null) {
      const eventMs = getMs(event);
      if (eventMs !== null && firstTimestampMs !== null) {
        elapsed = Math.max(0, Math.round((eventMs - firstTimestampMs) / 1000));
      } else {
        elapsed = index === 0 ? 0 : lastElapsed + 1;
      }
    }

    // Ensure strictly increasing elapsed to keep progression/x-axis stable (prevents sabre touches from sharing 0s)
    if (elapsed <= lastElapsed) {
      elapsed = lastElapsed + 1;
    }
    lastElapsed = elapsed;

    return { ...event, match_time_elapsed: elapsed };
  });
};

const getResetSegmentValue = (value?: number | null) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const filterEventsByLatestResetSegment = <T extends { reset_segment?: number | null }>(events: T[]): T[] => {
  if (!events || events.length === 0) return [];
  const latestSegment = events.reduce(
    (max, ev) => Math.max(max, getResetSegmentValue(ev.reset_segment)),
    0
  );
  return events.filter(ev => getResetSegmentValue(ev.reset_segment) === latestSegment);
};

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AUTH_SESSION_CACHE_MS = 2000;
const AUTH_SESSION_TIMEOUT_COOLDOWN_MS = 15000;
const DB_REQUEST_TIMEOUT_MS = 8000;
let authSessionCache: { session: Session | null; timestamp: number } = {
  session: null,
  timestamp: 0,
};
let authSessionInFlight: Promise<Session | null> | null = null;
let authSessionTimeoutUntil = 0;

const setAuthSessionCache = (session: Session | null) => {
  authSessionCache = { session, timestamp: Date.now() };
};

const resolveAccessToken = (accessToken?: string | null) => {
  if (accessToken) return accessToken;
  return getCachedAuthSession()?.access_token ?? null;
};

const ensureAuthSession = async (label: string): Promise<Session | null> => {
  const now = Date.now();
  const cachedSession = getCachedAuthSession();
  if (cachedSession?.access_token) {
    setAuthSessionCache(cachedSession);
    return cachedSession;
  }

  if (getLastAuthEvent() === 'SIGNED_OUT') {
    return null;
  }

  if (authSessionTimeoutUntil > now) {
    return null;
  }

  if (authSessionCache.session && now - authSessionCache.timestamp < AUTH_SESSION_CACHE_MS) {
    return authSessionCache.session;
  }

  if (authSessionInFlight) {
    return authSessionInFlight;
  }

  authSessionInFlight = (async () => {
    let sawRefreshToken = !!cachedSession?.refresh_token;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          4000,
          `auth.getSession:${label}`
        );
        if (error) {
          console.warn(`⚠️ [AUTH] ${label} getSession error`, error);
        }
        if (data.session?.refresh_token) {
          sawRefreshToken = true;
        }
        if (data.session?.access_token) {
          setAuthSessionCache(data.session);
          return data.session;
        }
        if (!data.session?.refresh_token) {
          console.warn(`⚠️ [AUTH] ${label} session missing refresh token`);
        }
      } catch (error) {
        console.warn(`⚠️ [AUTH] ${label} getSession timeout`, error);
        authSessionTimeoutUntil = Date.now() + AUTH_SESSION_TIMEOUT_COOLDOWN_MS;
      }

      if (attempt < 2) {
        await delay(250);
      }
    }

    if (!sawRefreshToken) {
      console.warn(`⚠️ [AUTH] ${label} refreshSession skipped - no refresh token`);
      return null;
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.refreshSession(),
        8000,
        `auth.refreshSession:${label}`
      );
      if (error) {
        console.warn(`⚠️ [AUTH] ${label} refreshSession error`, error);
        return null;
      }

      setAuthSessionCache(data.session ?? null);
      return data.session ?? null;
    } catch (error) {
      console.warn(`⚠️ [AUTH] ${label} refreshSession timeout`, error);
      authSessionTimeoutUntil = Date.now() + AUTH_SESSION_TIMEOUT_COOLDOWN_MS;
      return null;
    }
  })();

  try {
    return await authSessionInFlight;
  } finally {
    authSessionInFlight = null;
  }
};

// User-related helpers
type CreateUserOptions = {
  fallbackEmailForName?: string | null;
};

export const userService = {
  async getUserById(userId: string, accessToken?: string | null): Promise<AppUser | null> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ app_user fetch skipped - auth session missing', { userId });
        return null;
      }

      const { data, error } = await postgrestSelectOne<AppUser>(
        'app_user',
        {
          select: '*',
          user_id: `eq.${userId}`,
          limit: 1,
        },
        { accessToken: token }
      );

      if (error) {
        console.error('Error fetching user by ID:', error);
        return null;
      }

      return data as AppUser;
    } catch (err) {
      console.error('Unexpected error fetching user by ID:', err);
      return null;
    }
  },

  async ensureUserById(
    userId: string,
    email?: string | null,
    accessToken?: string | null
  ): Promise<AppUser | null> {
    const existing = await userService.getUserById(userId, accessToken);
    if (existing) {
      return existing;
    }

    let resolvedEmail = email ?? null;
    if (!resolvedEmail) {
      console.warn('⚠️ Unable to resolve user email for profile creation');
    }

    const created = await userService.createUser(
      userId,
      resolvedEmail,
      undefined,
      undefined,
      { fallbackEmailForName: null },
      accessToken
    );

    if (!created) {
      console.warn('⚠️ Failed to ensure app_user record exists', { userId });
    }

    return created;
  },

  async createUser(
    userId: string,
    email?: string | null,
    firstName?: string,
    lastName?: string,
    options?: CreateUserOptions,
    accessToken?: string | null
  ): Promise<AppUser | null> {
    const hasFallbackOverride = options && Object.prototype.hasOwnProperty.call(options, 'fallbackEmailForName');
    const fallbackEmailForName = hasFallbackOverride ? options?.fallbackEmailForName : email;
    const name = formatFullName(firstName, lastName, fallbackEmailForName);

    const insertData: Partial<AppUser> & { user_id: string } = {
      user_id: userId,
      email: email || undefined,
    };

    if (name) {
      insertData.name = name;
    }

    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ app_user upsert skipped - auth session missing', { userId });
        return null;
      }

      const { data, error } = await postgrestInsert<AppUser>(
        'app_user',
        insertData,
        {
          on_conflict: 'user_id',
          select: '*',
        },
        {
          accessToken: token,
          prefer: 'return=representation, resolution=merge-duplicates',
        }
      );

      if (error) {
        console.error('Error upserting user:', error);
        return null;
      }

      const row = Array.isArray(data) ? data[0] ?? null : null;
      return row as AppUser | null;
    } catch (err) {
      console.error('Unexpected error upserting user:', err);
      return null;
    }
  },

  async updateUser(
    userId: string,
    updates: Partial<AppUser>,
    accessToken?: string | null
  ): Promise<AppUser | null> {
    if (!updates || Object.keys(updates).length === 0) {
      return userService.getUserById(userId, accessToken);
    }

    const payload: Partial<AppUser> = { ...updates };

    if ('name' in payload && payload.name) {
      payload.name = formatFullName(payload.name, undefined, undefined);
    }

    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ app_user update skipped - auth session missing', { userId });
        return null;
      }

      const { data, error } = await postgrestUpdate<AppUser>(
        'app_user',
        payload,
        {
          user_id: `eq.${userId}`,
          select: '*',
        },
        { accessToken: token }
      );

      if (error) {
        console.error('Error updating user:', error);
        return null;
      }

      const row = Array.isArray(data) ? data[0] ?? null : null;
      return row as AppUser | null;
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
  getActiveGoals(userId: string, accessToken?: string | null): Promise<SimpleGoal[]>;
  createGoal(goalData: Partial<Goal>, userId: string, accessToken?: string | null): Promise<SimpleGoal | null>;
  updateGoal(goalId: string, updates: Partial<Goal>, accessToken?: string | null): Promise<SimpleGoal | null>;
  deleteGoal(goalId: string, accessToken?: string | null): Promise<boolean>;
  deactivateGoal(goalId: string, accessToken?: string | null): Promise<boolean>;
  deactivateAllCompletedGoals(userId: string, accessToken?: string | null): Promise<number>;
  deactivateExpiredGoals(userId: string, accessToken?: string | null): Promise<number>;
  recalculateGoalProgress(goalId: string, userId: string, accessToken?: string | null): Promise<SimpleGoal | null>;
  updateGoalsAfterMatch(
    userId: string,
    matchResult: 'win' | 'loss' | null,
    finalScore: number,
    opponentScore: number,
    accessToken?: string | null
  ): Promise<GoalUpdateResponse>;
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

const fetchGoalRecord = async (
  goalId: string,
  accessToken?: string | null
): Promise<GoalRecord | null> => {
  const token = resolveAccessToken(accessToken);
  if (!token) {
    console.warn('⚠️ goal fetch skipped - auth session missing', { goalId });
    return null;
  }

  const { data, error } = await postgrestSelectOne<GoalRecord>(
    'goal',
    {
      select: '*',
      goal_id: `eq.${goalId}`,
      limit: 1,
    },
    { accessToken: token }
  );

  if (error) {
    console.error('Error fetching goal record:', error);
    return null;
  }

  return data as GoalRecord | null;
};

const updateGoalRecord = async (
  goalId: string,
  updates: Partial<Goal>,
  accessToken?: string | null
): Promise<GoalRecord | null> => {
  const token = resolveAccessToken(accessToken);
  if (!token) {
    console.warn('⚠️ goal update skipped - auth session missing', { goalId });
    return null;
  }

  const { data, error } = await postgrestUpdate<GoalRecord>(
    'goal',
    updates,
    {
      goal_id: `eq.${goalId}`,
      select: '*',
    },
    { accessToken: token }
  );

  if (error) {
    console.error('Error updating goal record:', error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] ?? null : null;
  return row as GoalRecord | null;
};

interface SimplifiedMatch {
  isWin: boolean;
  margin: number;
}

const fetchUserMatchesForGoal = async (
  userId: string,
  accessToken?: string | null
): Promise<SimplifiedMatch[]> => {
  if (!isValidUuid(userId)) {
    console.warn('Skipping match fetch for goal recalculation due to invalid userId', { userId });
    return [];
  }

  const token = resolveAccessToken(accessToken);
  if (!token) {
    console.warn('⚠️ match fetch skipped - auth session missing', { userId });
    return [];
  }

  const { data, error } = await postgrestSelect<{
    final_score: number | null;
    touches_against: number | null;
    result: string | null;
  }>(
    'match',
    {
      select: 'match_id, final_score, touches_against, result, event_date',
      user_id: `eq.${userId}`,
      order: 'event_date.desc,match_id.desc',
    },
    { accessToken: token }
  );

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

const handleDeadlineStatus = async (
  goal: GoalRecord,
  accessToken?: string | null
): Promise<{ updatedGoal?: GoalRecord; failed?: { id: string; title: string; reason: string } }> => {
  if (!goal.deadline) {
    return {};
  }

  const deadlineDate = new Date(goal.deadline);
  const now = new Date();

  if (!goal.is_completed && goal.is_active !== false && deadlineDate < now) {
    const updated = await updateGoalRecord(
      goal.goal_id,
      {
        is_active: false,
        is_failed: true,
        updated_at: now.toISOString(),
      },
      accessToken
    );

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

const updateGoalProgressInternal = async (
  goal: GoalRecord,
  newValue: number,
  accessToken?: string | null
): Promise<GoalRecord | null> => {
  const targetValue = goal.target_value ?? 0;
  const currentValue = Number.isFinite(newValue) ? newValue : 0;
  const isCompleted = targetValue > 0 ? currentValue >= targetValue : false;

  return updateGoalRecord(
    goal.goal_id,
    {
      current_value: currentValue,
      is_completed: isCompleted,
      is_failed: isCompleted ? false : goal.is_failed,
      updated_at: new Date().toISOString(),
    },
    accessToken
  );
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
  async getActiveGoals(userId: string, accessToken?: string | null): Promise<SimpleGoal[]> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping active goal fetch due to invalid userId', { userId });
      return [];
    }

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ getActiveGoals blocked - auth session not ready', { userId });
      return [];
    }

    const { data, error } = await postgrestSelect<GoalRecord>(
      'goal',
      {
        select: '*',
        user_id: `eq.${userId}`,
        is_active: 'eq.true',
        order: 'created_at.desc',
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching active goals:', error);
      return [];
    }

    return (data || []).map(goal => normalizeGoalRecord(goal as GoalRecord));
  },

  async createGoal(
    goalData: Partial<Goal>,
    userId: string,
    accessToken?: string | null
  ): Promise<SimpleGoal | null> {
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

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ createGoal blocked - auth session not ready', { userId });
      return null;
    }

    let result;
    try {
      result = await postgrestInsert<GoalRecord>(
        'goal',
        insertData,
        { select: '*' },
        { accessToken: token }
      );
    } catch (error) {
      console.error('Error creating goal (request):', error);
      return null;
    }

    if (result.error) {
      if (result.error.code === '23503') {
        console.warn('⚠️ Goal insert failed due to missing user record; retrying once');
        await userService.ensureUserById(userId, undefined, token);
        try {
          result = await postgrestInsert<GoalRecord>(
            'goal',
            insertData,
            { select: '*' },
            { accessToken: token }
          );
        } catch (error) {
          console.error('Error creating goal after retry (request):', error);
          return null;
        }

        if (result.error) {
          console.error('Error creating goal after retry:', result.error);
          return null;
        }
      } else {
        console.error('Error creating goal:', result.error);
        return null;
      }
    }

    const row = Array.isArray(result.data) ? result.data[0] ?? null : null;
    return row ? normalizeGoalRecord(row as GoalRecord) : null;
  },

  async updateGoal(
    goalId: string,
    updates: Partial<Goal>,
    accessToken?: string | null
  ): Promise<SimpleGoal | null> {
    if (!updates || Object.keys(updates).length === 0) {
      const existing = await fetchGoalRecord(goalId, accessToken);
      return existing ? normalizeGoalRecord(existing) : null;
    }

    const updated = await updateGoalRecord(goalId, {
      ...updates,
      updated_at: new Date().toISOString(),
    }, accessToken);

    return updated ? normalizeGoalRecord(updated) : null;
  },

  async deleteGoal(goalId: string, accessToken?: string | null): Promise<boolean> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ deleteGoal blocked - auth session not ready', { goalId });
      return false;
    }

    const { error } = await postgrestDelete(
      'goal',
      { goal_id: `eq.${goalId}` },
      { accessToken: token }
    );

    if (error) {
      console.error('Error deleting goal:', error);
      return false;
    }

    return true;
  },

  async deactivateGoal(goalId: string, accessToken?: string | null): Promise<boolean> {
    const updated = await updateGoalRecord(goalId, {
      is_active: false,
      updated_at: new Date().toISOString(),
    }, accessToken);

    return !!updated;
  },

  async deactivateAllCompletedGoals(userId: string, accessToken?: string | null): Promise<number> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping deactivateAllCompletedGoals due to invalid userId', { userId });
      return 0;
    }

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ deactivateAllCompletedGoals blocked - auth session not ready', { userId });
      return 0;
    }

    const { data, error } = await postgrestUpdate<{ goal_id: string }>(
      'goal',
      { is_active: false, updated_at: new Date().toISOString() },
      {
        user_id: `eq.${userId}`,
        is_active: 'eq.true',
        is_completed: 'eq.true',
        select: 'goal_id',
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error deactivating completed goals:', error);
      return 0;
    }

    return data?.length ?? 0;
  },

  async deactivateExpiredGoals(userId: string, accessToken?: string | null): Promise<number> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping deactivateExpiredGoals due to invalid userId', { userId });
      return 0;
    }

    const nowIso = new Date().toISOString();
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ deactivateExpiredGoals blocked - auth session not ready', { userId });
      return 0;
    }

    const { data, error } = await postgrestUpdate<{ goal_id: string }>(
      'goal',
      { is_active: false, is_failed: true, updated_at: nowIso },
      {
        user_id: `eq.${userId}`,
        is_active: 'eq.true',
        is_completed: 'eq.false',
        deadline: `lt.${nowIso}`,
        select: 'goal_id',
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error deactivating expired goals:', error);
      return 0;
    }

    return data?.length ?? 0;
  },

  async recalculateGoalProgress(
    goalId: string,
    userId: string,
    accessToken?: string | null
  ): Promise<SimpleGoal | null> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping goal recalculation due to invalid userId', { userId });
      return null;
    }

    const goalRecord = await fetchGoalRecord(goalId, accessToken);
    if (!goalRecord) {
      return null;
    }

    const matches = await fetchUserMatchesForGoal(userId, accessToken);
    const recomputedValue = computeGoalValueFromMatches(goalRecord, matches);
    const updatedRecord = await updateGoalProgressInternal(goalRecord, recomputedValue, accessToken);

    if (!updatedRecord) {
      return null;
    }

    const deadlineCheck = await handleDeadlineStatus(updatedRecord, accessToken);
    const finalRecord = deadlineCheck.updatedGoal ?? updatedRecord;

    return normalizeGoalRecord(finalRecord);
  },

  async updateGoalsAfterMatch(
    userId: string,
    matchResult: 'win' | 'loss' | null,
    finalScore: number,
    opponentScore: number,
    accessToken?: string | null
  ): Promise<GoalUpdateResponse> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping goal updates due to invalid userId', { userId, matchResult, finalScore, opponentScore });
      return { completedGoals: [], failedGoals: [] };
    }

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ updateGoalsAfterMatch blocked - auth session not ready', { userId });
      return { completedGoals: [], failedGoals: [] };
    }

    const { data: activeGoals, error } = await postgrestSelect<GoalRecord>(
      'goal',
      {
        select: '*',
        user_id: `eq.${userId}`,
        is_active: 'eq.true',
      },
      { accessToken: token }
    );

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
          cachedMatches = await fetchUserMatchesForGoal(userId, accessToken);
        }
        const recomputedValue = computeGoalValueFromMatches(goalRecord, cachedMatches);
        updatedRecord = await updateGoalProgressInternal(goalRecord, recomputedValue, accessToken);
      } else if (newValue !== null) {
        updatedRecord = await updateGoalProgressInternal(goalRecord, newValue, accessToken);
      } else {
        updatedRecord = goalRecord;
      }

      if (!updatedRecord) {
        continue;
      }

      const deadlineResult = await handleDeadlineStatus(updatedRecord, accessToken);
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

const normalizeCompetitionName = (value: string) => {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
};

export const competitionService = {
  async createCompetition(
    data: {
      userId: string;
      name: string;
      eventDate: string; // YYYY-MM-DD
      weaponType: 'foil' | 'epee' | 'sabre';
      type?: 'WorldCup' | 'GrandPrix' | 'National' | 'Open' | 'Other';
      typeLabel?: string | null;
      preCompetitionNotes?: string | null;
      postCompetitionNotes?: string | null;
      placement?: number | null;
      fieldSize?: number | null;
      accessToken?: string | null;
    }
  ): Promise<Competition | null> {
    const token = resolveAccessToken(data.accessToken);
    if (!token) {
      console.warn('⚠️ createCompetition blocked - auth session not ready', { userId: data.userId });
      return null;
    }

    const normalizedName = normalizeCompetitionName(data.name);
    const payload = {
      user_id: data.userId,
      name: data.name.trim(),
      normalized_name: normalizedName,
      event_date: data.eventDate,
      weapon_type: data.weaponType,
      type: data.type ?? 'Other',
      type_label: data.typeLabel ?? null,
      pre_competition_notes: data.preCompetitionNotes ?? null,
      post_competition_notes: data.postCompetitionNotes ?? null,
      placement: data.placement ?? null,
      field_size: data.fieldSize ?? null,
    };

    const { data: created, error } = await postgrestInsert<Competition>(
      'competition',
      payload,
      { select: '*' },
      { accessToken: token }
    );

    if (error) {
      console.error('Error creating competition:', error);
      return null;
    }

    return created?.[0] ?? null;
  },

  async updateCompetition(
    competitionId: string,
    updates: Partial<{
      name: string;
      event_date: string;
      weapon_type: 'foil' | 'epee' | 'sabre';
      type: 'WorldCup' | 'GrandPrix' | 'National' | 'Open' | 'Other';
      type_label: string | null;
      pre_competition_notes: string | null;
      post_competition_notes: string | null;
      placement: number | null;
      field_size: number | null;
      updated_at: string;
    }>,
    accessToken?: string | null
  ): Promise<Competition | null> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ updateCompetition blocked - auth session not ready', { competitionId });
      return null;
    }

    const payload = { ...updates } as Record<string, unknown>;
    if (typeof updates.name === 'string') {
      payload.normalized_name = normalizeCompetitionName(updates.name);
    }

    const { data, error } = await postgrestUpdate<Competition>(
      'competition',
      payload,
      { competition_id: `eq.${competitionId}` },
      { accessToken: token }
    );

    if (error) {
      console.error('Error updating competition:', error);
      return null;
    }

    return data?.[0] ?? null;
  },

  async getCompetitionById(
    competitionId: string,
    accessToken?: string | null
  ): Promise<Competition | null> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ getCompetitionById blocked - auth session not ready', { competitionId });
      return null;
    }

    const { data, error } = await postgrestSelectOne<Competition>(
      'competition',
      { competition_id: `eq.${competitionId}` },
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching competition:', error);
      return null;
    }

    return data ?? null;
  },

  async searchCompetitions(
    userId: string,
    params: {
      query?: string;
      eventDate?: string;
      weaponType?: 'foil' | 'epee' | 'sabre';
      limit?: number;
    },
    accessToken?: string | null
  ): Promise<Competition[]> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ searchCompetitions blocked - auth session not ready', { userId });
      return [];
    }

    const query: Record<string, string | number> = {
      user_id: `eq.${userId}`,
      order: 'event_date.desc,updated_at.desc',
      limit: params.limit ?? 10,
    };

    if (params.eventDate) {
      query.event_date = `eq.${params.eventDate}`;
    }
    if (params.weaponType) {
      query.weapon_type = `eq.${params.weaponType}`;
    }
    if (params.query) {
      query.name = `ilike.%${params.query}%`;
    }

    const { data, error } = await postgrestSelect<Competition>(
      'competition',
      query,
      { accessToken: token }
    );

    if (error) {
      console.error('Error searching competitions:', error);
      return [];
    }

    return data ?? [];
  },
};

// Match-related functions
export const matchService = {
  // Get recent matches for a user
  async getRecentMatches(
    userId: string,
    limit: number = 10,
    userDisplayNameOverride?: string,
    accessToken?: string | null
  ): Promise<SimpleMatch[]> {
    const debug = __DEV__;
    if (debug) {
      console.log('🔍 getRecentMatches', { userId, limit });
    }

    // Helper function to normalize names for comparison
    const normalizeName = (name?: string | null): string => (name ?? '').trim().toLowerCase();

    // Fetch user's name to identify which fencer is the user (handles swaps correctly)
    let userDisplayName = (userDisplayNameOverride ?? '').trim();
    if (!userDisplayName) {
      try {
        const userProfile = await withTimeout(
          userService.getUserById(userId),
          4000,
          'User profile lookup'
        );
        userDisplayName = userProfile?.name || '';
      } catch (error) {
        if (debug) {
          console.warn('User profile lookup timed out or failed:', error);
        }
      }
    }

    const normalizedUserName = normalizeName(userDisplayName);

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ getRecentMatches blocked - auth session not ready', { userId });
      return [];
    }

    const { data, error } = await postgrestSelect<any>(
      'match',
      {
        select: 'match_id,event_date,final_score,touches_against,is_win,match_type,source,notes,fencer_1_name,fencer_2_name,weapon_type,competition_id,phase,de_round,competition:competition_id(name,event_date,weapon_type,placement,field_size),match_period(end_time)',
        user_id: `eq.${userId}`,
        order: 'event_date.desc,match_id.desc',
        limit,
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching matches:', error);
      return [];
    }

    const formatTimeHHMM = (timestampMs: number): string => {
      const date = new Date(timestampMs);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    const placeholderNames = new Set([
      '',
      'tap to add name',
      'guest',
      'guest 1',
      'guest 2',
      'unknown',
      'fencer 1',
      'fencer 2',
    ]);
    const isPlaceholder = (value?: string | null) =>
      placeholderNames.has(normalizeName(value));

    const filteredData = (data || []).filter((match: any) => {
      return !isPlaceholder(match.fencer_1_name) && !isPlaceholder(match.fencer_2_name);
    });

    const matches = filteredData.map((match: any) => {
      // Get the latest period end time as the match completion time
      const matchPeriods = match.match_period as any[] | undefined;
      let completionTime: string | undefined;
      let completionTimestamp: number | undefined;
      
      if (matchPeriods && matchPeriods.length > 0) {
        // Find the latest end_time without sorting to reduce work
        let latestEndMs: number | undefined;
        for (const period of matchPeriods) {
          if (!period?.end_time) continue;
          const ts = new Date(period.end_time).getTime();
          if (!Number.isFinite(ts)) continue;
          if (latestEndMs === undefined || ts > latestEndMs) {
            latestEndMs = ts;
          }
        }

        if (latestEndMs !== undefined) {
          completionTimestamp = latestEndMs;
          completionTime = formatTimeHHMM(latestEndMs);
        }
      } else {
        // For manual matches without match_period, use event_date and event_time
        if (match.event_date) {
          const eventDateTime = new Date(match.event_date);
          completionTimestamp = eventDateTime.getTime();
          completionTime = formatTimeHHMM(eventDateTime.getTime());
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
        if (debug) {
          console.log('⚠️ Could not identify user in match, using fallback', {
            matchId: match.match_id,
            userDisplayName,
            source: match.source,
          });
        }
      }
      
      const competition = match.competition as {
        name?: string;
        event_date?: string;
        weapon_type?: string;
        placement?: number | null;
        field_size?: number | null;
      } | null;

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
        competitionId: match.competition_id ?? null,
        competitionName: competition?.name ?? null,
        competitionDate: competition?.event_date ?? null,
        competitionWeaponType: competition?.weapon_type ?? null,
        competitionPhase: match.phase ?? null,
        competitionRound: match.de_round ?? null,
        competitionPlacement: competition?.placement ?? null,
        competitionFieldSize: competition?.field_size ?? null,
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

    return sortedMatches;
  },

  async getCompetitionMatches(
    competitionId: string,
    userId: string,
    userDisplayNameOverride?: string,
    accessToken?: string | null
  ): Promise<SimpleMatch[]> {
    const debug = __DEV__;
    if (debug) {
      console.log('🔍 getCompetitionMatches', { userId, competitionId });
    }

    // Helper function to normalize names for comparison
    const normalizeName = (name?: string | null): string => (name ?? '').trim().toLowerCase();

    let userDisplayName = (userDisplayNameOverride ?? '').trim();
    if (!userDisplayName) {
      try {
        const userProfile = await withTimeout(
          userService.getUserById(userId),
          4000,
          'User profile lookup'
        );
        userDisplayName = userProfile?.name || '';
      } catch (error) {
        if (debug) {
          console.warn('User profile lookup timed out or failed:', error);
        }
      }
    }

    const normalizedUserName = normalizeName(userDisplayName);
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ getCompetitionMatches blocked - auth session not ready', { userId, competitionId });
      return [];
    }

    const { data, error } = await postgrestSelect<any>(
      'match',
      {
        select:
          'match_id,event_date,final_score,touches_against,is_win,match_type,source,notes,fencer_1_name,fencer_2_name,weapon_type,competition_id,phase,de_round,match_period(end_time)',
        user_id: `eq.${userId}`,
        competition_id: `eq.${competitionId}`,
        order: 'event_date.desc,match_id.desc',
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching competition matches:', error);
      return [];
    }

    const formatTimeHHMM = (timestampMs: number): string => {
      const date = new Date(timestampMs);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    const placeholderNames = new Set([
      '',
      'tap to add name',
      'guest',
      'guest 1',
      'guest 2',
      'unknown',
      'fencer 1',
      'fencer 2',
    ]);
    const isPlaceholder = (value?: string | null) =>
      placeholderNames.has(normalizeName(value));

    const filteredData = (data || []).filter((match: any) => {
      return !isPlaceholder(match.fencer_1_name) && !isPlaceholder(match.fencer_2_name);
    });

    const matches = filteredData.map((match: any) => {
      const matchPeriods = match.match_period as any[] | undefined;
      let completionTime: string | undefined;
      let completionTimestamp: number | undefined;

      if (matchPeriods && matchPeriods.length > 0) {
        let latestEndMs: number | undefined;
        for (const period of matchPeriods) {
          if (!period?.end_time) continue;
          const ts = new Date(period.end_time).getTime();
          if (!Number.isFinite(ts)) continue;
          if (latestEndMs === undefined || ts > latestEndMs) {
            latestEndMs = ts;
          }
        }

        if (latestEndMs !== undefined) {
          completionTimestamp = latestEndMs;
          completionTime = formatTimeHHMM(latestEndMs);
        }
      } else {
        if (match.event_date) {
          const eventDateTime = new Date(match.event_date);
          completionTimestamp = eventDateTime.getTime();
          completionTime = formatTimeHHMM(eventDateTime.getTime());
        }
      }

      const fencer1Name = match.fencer_1_name || '';
      const fencer2Name = match.fencer_2_name || '';
      const normalizedFencer1 = normalizeName(fencer1Name);
      const normalizedFencer2 = normalizeName(fencer2Name);

      const isManualMatchWithYou =
        match.source === 'manual' && (normalizedFencer1 === 'you' || fencer1Name === 'You');

      const isFencer1User =
        isManualMatchWithYou ||
        (normalizedUserName && normalizedFencer1
          ? normalizedFencer1 === normalizedUserName
          : false);
      const isFencer2User =
        normalizedUserName && normalizedFencer2 ? normalizedFencer2 === normalizedUserName : false;

      let opponentName: string;
      if (isFencer1User) {
        opponentName = fencer2Name || 'Unknown';
      } else if (isFencer2User) {
        opponentName = fencer1Name || 'Unknown';
      } else {
        opponentName = fencer2Name || 'Unknown';
        if (debug) {
          console.log('⚠️ Could not identify user in match, using fallback', {
            matchId: match.match_id,
            userDisplayName,
            source: match.source,
          });
        }
      }

      return {
        id: match.match_id,
        youScore: match.final_score || 0,
        opponentScore: match.touches_against || 0,
        date: match.event_date
          ? new Date(match.event_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        time: completionTime,
        opponentName: opponentName,
        isWin: match.is_win || false,
        matchType: match.match_type || undefined,
        source: match.source || 'unknown',
        notes: match.notes || '',
        competitionId: match.competition_id ?? null,
        competitionPhase: match.phase ?? null,
        competitionRound: match.de_round ?? null,
        _completionTimestamp: completionTimestamp,
      };
    }) || [];

    const sortedMatches = matches
      .sort((a, b) => {
        if (a._completionTimestamp && b._completionTimestamp) {
          return b._completionTimestamp - a._completionTimestamp;
        }
        if (a._completionTimestamp && !b._completionTimestamp) return -1;
        if (!a._completionTimestamp && b._completionTimestamp) return 1;
        return b.date.localeCompare(a.date);
      })
      .map(({ _completionTimestamp, ...match }) => match);

    return sortedMatches;
  },

  async getMatchCounts(
    userId: string,
    accessToken?: string | null
  ): Promise<{ totalMatches: number; winMatches: number }> {
    if (!isValidUuid(userId)) {
      console.warn('Skipping match count fetch due to invalid userId', { userId });
      return { totalMatches: 0, winMatches: 0 };
    }

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ getMatchCounts blocked - auth session not ready', { userId });
      return { totalMatches: 0, winMatches: 0 };
    }

    const [totalResult, winResult] = await Promise.all([
      postgrestCount(
        'match',
        { select: 'match_id', user_id: `eq.${userId}` },
        { accessToken: token }
      ),
      postgrestCount(
        'match',
        { select: 'match_id', user_id: `eq.${userId}`, is_win: 'eq.true' },
        { accessToken: token }
      ),
    ]);

    if (totalResult.error) {
      console.error('Error fetching match count:', totalResult.error);
    }

    if (winResult.error) {
      console.error('Error fetching win match count:', winResult.error);
    }

    return {
      totalMatches: totalResult.count ?? 0,
      winMatches: winResult.count ?? 0,
    };
  },

  // Get all matches for training time calculation
  async getAllMatchesForTrainingTime(
    userId: string,
    accessToken?: string | null
  ): Promise<{ bout_length_s: number }[]> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ getAllMatchesForTrainingTime blocked - auth session not ready', { userId });
      return [];
    }

    const { data, error } = await postgrestSelect<{ bout_length_s: number }>(
      'match',
      {
        select: 'bout_length_s',
        user_id: `eq.${userId}`,
        'bout_length_s': 'not.is.null',
      },
      { accessToken: token }
    );

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
    competitionId?: string | null;
    phase?: 'POULE' | 'DE' | null;
    deRound?: 'L256' | 'L128' | 'L96' | 'L64' | 'L32' | 'L16' | 'QF' | 'SF' | 'F' | null;
    fencer1Name?: string;
    fencer2Name?: string;
    accessToken?: string | null;
  }): Promise<Match | null> {
    const { userId, opponentName, yourScore, opponentScore, matchType, date, time, notes, weaponType } = matchData;
    
    // Validate required fields
    if (!userId) {
      console.error('❌ Error: userId is required');
      return null;
    }

    const token = resolveAccessToken(matchData.accessToken);
    if (!token) {
      console.warn('⚠️ createManualMatch blocked - auth session not ready', { userId });
      return null;
    }

    try {
      await userService.ensureUserById(userId, undefined, token);
    } catch (error) {
      console.warn('⚠️ Unable to ensure app_user record before match insert:', error);
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
    
    const trimmedFencer1Name = matchData.fencer1Name?.trim() || '';
    const trimmedFencer2Name = matchData.fencer2Name?.trim() || '';

    const insertData = {
      user_id: userId,
      fencer_1_name: trimmedFencer1Name || 'You', // Default to "You" if not provided
      fencer_2_name: trimmedFencer2Name || opponentName.trim(),
      final_score: yourScore,
      // touches_against: opponentScore, // This is a generated column - will be calculated automatically
      event_date: eventDateTime.toISOString(),
      result: yourScore > opponentScore ? 'win' : 'loss',
      score_diff: yourScore - opponentScore,
      match_type: matchType,
      weapon_type: normalizedWeaponType,
      competition_id: matchData.competitionId ?? null,
      phase: matchData.phase ?? null,
      de_round: matchData.deRound ?? null,
      notes: notes || null,
      source: 'manual',
      is_complete: true,
    };

    console.log('🔄 Creating manual match with data:', insertData);

    let result;
    try {
      result = await postgrestInsert<Match>(
        'match',
        insertData,
        { select: '*' },
        { accessToken: token }
      );
    } catch (requestError: any) {
      console.error('❌ Request error creating manual match:', requestError);
      return null;
    }

    if (result.error) {
      if (result.error.code === '23503') {
        console.warn('⚠️ Manual match insert failed due to missing user record; retrying once');
        await userService.ensureUserById(userId, undefined, token);
        try {
          result = await postgrestInsert<Match>(
            'match',
            insertData,
            { select: '*' },
            { accessToken: token }
          );
        } catch (requestError: any) {
          console.error('❌ Request error creating manual match after retry:', requestError);
          return null;
        }

        if (result.error) {
          console.error('❌ Error creating manual match after retry:', result.error);
          return null;
        }
      } else {
        console.error('❌ Error creating manual match:', result.error);
        console.error('❌ Error details:', {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code,
          insertData: JSON.stringify(insertData, null, 2),
        });
        return null;
      }
    }

    const row = Array.isArray(result.data) ? result.data[0] ?? null : null;
    console.log('✅ Manual match created successfully:', row);
    return row;
  },

  // Create a new match from fencing remote data
  async createMatchFromRemote(
    remoteData: FencingRemote,
    userId: string | null,
    accessToken?: string | null
  ): Promise<Match | null> {
    let token: string | null = null;
    if (userId) {
      token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ createMatchFromRemote blocked - auth session not ready', { userId });
        return null;
      }
      await userService.ensureUserById(userId, undefined, token);
    }
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
      
      const { data: rpcData, error: rpcError } = await postgrestRpc<Match>(
        'create_anonymous_match',
        { match_data: matchData },
        { allowAnon: true }
      );

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
    let result = await postgrestInsert<Match>(
      'match',
      matchData,
      { select: '*' },
      { accessToken: token }
    );

    if (result.error) {
      if (result.error.code === '23503' && userId && token) {
        console.warn('⚠️ Match insert failed due to missing user record; retrying once');
        await userService.ensureUserById(userId, undefined, token);
        result = await postgrestInsert<Match>(
          'match',
          matchData,
          { select: '*' },
          { accessToken: token }
        );
      }
    }

    if (result.error) {
      console.error('❌ Error creating match:', result.error);
      return null;
    }

    const row = Array.isArray(result.data) ? result.data[0] ?? null : null;

    // Validate that we got a match_id back
    if (!row?.match_id) {
      console.error('❌ Match insert succeeded but returned no match_id. This should not happen for authenticated users.');
      return null;
    }

    console.log('✅ Match created successfully:', row.match_id);
    return row;
  },

  // Get match by ID
  async getMatchById(matchId: string, accessToken?: string | null): Promise<Match | null> {
    const token = resolveAccessToken(accessToken);
    const { data, error } = await postgrestSelectOne<Match>(
      'match',
      {
        select: '*',
        match_id: `eq.${matchId}`,
        limit: 1,
      },
      token ? { accessToken: token } : { allowAnon: true }
    );

    if (!data && !error) {
      console.warn('⚠️ Match not found for match_id:', matchId);
      return null;
    }

    if (error) {
      console.error('Error fetching match:', error);
      return null;
    }

    return data;
  },

  // Calculate best run for a match using Event + Period Hybrid approach
  async calculateBestRun(
    matchId: string,
    userName: string,
    remoteId?: string,
    accessToken?: string | null
  ): Promise<number> {
    try {
      console.log('🏃 Calculating best run for match:', matchId, 'user:', userName);

      const token = resolveAccessToken(accessToken);
      const postgrestOptions = token ? { accessToken: token } : { allowAnon: true };
      
      // Fetch weapon type so we can handle epee double hits correctly
      const { data: matchMeta, error: matchMetaError } = await postgrestSelectOne<{ weapon_type?: string | null }>(
        'match',
        {
          select: 'weapon_type',
          match_id: `eq.${matchId}`,
          limit: 1,
        },
        postgrestOptions
      );

      if (matchMetaError) {
        console.error('Error fetching match metadata for best run:', matchMetaError);
      }

      const weaponType = (matchMeta?.weapon_type || '').toLowerCase();
      const isEpee = weaponType === 'epee';

      // Debug: Check what events exist in the database
      const { data: allEvents, error: allEventsError } = await postgrestSelect<any>(
        'match_event',
        {
          select: '*',
          order: 'timestamp.asc',
        },
        postgrestOptions
      );
      
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
      const { data: eventsByMatchId, error: matchIdError } = await postgrestSelect<any>(
        'match_event',
        {
          select: '*',
          match_id: `eq.${matchId}`,
          order: 'timestamp.asc',
        },
        postgrestOptions
      );
      
      if (matchIdError) {
        console.error('Error fetching match events by match_id:', matchIdError);
      } else if (eventsByMatchId && eventsByMatchId.length > 0) {
        matchEvents = eventsByMatchId;
        console.log('Found', matchEvents.length, 'match events by match_id');
      } else {
        // If no events found by match_id, try to find events by fencing_remote_id
        if (remoteId) {
          console.log('Trying to find events by fencing_remote_id:', remoteId);
          const { data: eventsByRemoteId, error: remoteIdError } = await postgrestSelect<any>(
            'match_event',
            {
              select: '*',
              fencing_remote_id: `eq.${remoteId}`,
              order: 'timestamp.asc',
            },
            postgrestOptions
          );
          
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

      matchEvents = filterEventsByLatestResetSegment(matchEvents);
      if (matchEvents.length === 0) {
        console.log('No match events found for latest reset segment');
        return 0;
      }

      // 2. Get all match periods for context
      const { data: matchPeriods, error: periodsError } = await postgrestSelect<any>(
        'match_period',
        {
          select: '*',
          match_id: `eq.${matchId}`,
          order: 'period_number.asc',
        },
        postgrestOptions
      );

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

      // Track cancelled events so they don't affect runs
      const cancelledEventIds = new Set<string>();
      for (const event of matchEvents) {
        if (event.event_type === 'cancel' && event.cancelled_event_id) {
          cancelledEventIds.add(event.cancelled_event_id);
        }
      }

      for (const event of matchEvents) {
        // Skip cancellation events and events that were cancelled
        if (event.event_type === 'cancel') {
          continue;
        }
        if (event.match_event_id && cancelledEventIds.has(event.match_event_id)) {
          continue;
        }

        // Check if we're in a new period (for logging purposes only)
        const eventPeriod = getPeriodForEvent(event);
        if (eventPeriod !== currentPeriod) {
          // Period changed - just update tracking, don't reset run
          currentPeriod = eventPeriod;
        }

        // In epee, a double hit should break the streak for both fencers
        const eventType = (event.event_type || '').toLowerCase();
        const pointsAwarded = typeof event.points_awarded === 'number'
          ? event.points_awarded
          : (event.card_given === 'red' ? 1 : 0);
        const isDoubleTouch = eventType === 'double' || eventType === 'double_touch' || eventType === 'double_hit';
        const isSingleTouch = eventType === 'touch';
        const isCardPoint = eventType === 'card' && pointsAwarded > 0;

        // Ignore non-scoring events (including yellow cards)
        if (!isSingleTouch && !isDoubleTouch && !isCardPoint) {
          continue;
        }

        if ((isEpee || !weaponType) && isDoubleTouch) {
          if (currentRun > 0) {
            runDetails.push(`Run of ${currentRun} ended by double touch in period ${eventPeriod}`);
          }
          currentRun = 0;
          continue;
        }

        if (isCardPoint) {
          if (!event.scoring_user_name) {
            continue;
          }
          const awardedToUser = event.scoring_user_name !== userName;
          if (awardedToUser) {
            currentRun += pointsAwarded;
            bestRun = Math.max(bestRun, currentRun);
            runDetails.push(`Point ${currentRun} in period ${eventPeriod} at ${event.timestamp}`);
          } else {
            if (currentRun > 0) {
              runDetails.push(`Run of ${currentRun} ended by opponent card in period ${eventPeriod}`);
            }
            currentRun = 0;
          }
        } else if (event.scoring_user_name === userName) {
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

  // Count double touches for a match (used for epee stats)
  async calculateDoubleTouchCount(matchId: string, accessToken?: string | null): Promise<number> {
    try {
      const token = resolveAccessToken(accessToken);
      const { data: matchEventsRaw, error: eventsError } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_event_id,event_type,cancelled_event_id,match_time_elapsed,event_time,timestamp,reset_segment',
          match_id: `eq.${matchId}`,
          order: 'event_time.asc,timestamp.asc',
        },
        token ? { accessToken: token } : { allowAnon: true }
      );

      if (eventsError) {
        console.error('Error fetching match events for double touch count:', eventsError);
        return 0;
      }

      if (!matchEventsRaw || matchEventsRaw.length === 0) {
        console.log('No match events found for double touch count');
        return 0;
      }

      const matchEvents = filterEventsByLatestResetSegment(matchEventsRaw);
      if (matchEvents.length === 0) {
        console.log('No match events found for latest reset segment (double touches)');
        return 0;
      }

      // Track cancelled events so we don't count them
      const cancelledEventIds = new Set<string>();
      for (const event of matchEvents) {
        if (event.event_type === 'cancel' && event.cancelled_event_id) {
          cancelledEventIds.add(event.cancelled_event_id);
        }
      }

      const doubleTypes = new Set(['double', 'double_touch', 'double_hit']);
      const seenKeys = new Set<string>();
      let doubleTouchCount = 0;

      for (const event of matchEvents) {
        // Skip the cancel events themselves
        if ((event.event_type || '').toLowerCase() === 'cancel') {
          continue;
        }

        // Skip events that were cancelled
        if (event.match_event_id && cancelledEventIds.has(event.match_event_id)) {
          continue;
        }

        // Dedupe identical events (handles offline/legacy duplicates)
        const dedupeKey = event.match_event_id
          ? `id_${event.match_event_id}`
          : `${event.event_type || 'unknown'}_${event.event_time || event.timestamp || 'noTime'}_${event.match_time_elapsed ?? 'noElapsed'}`;
        if (seenKeys.has(dedupeKey)) {
          continue;
        }
        seenKeys.add(dedupeKey);

        const eventType = (event.event_type || '').toLowerCase();
        if (doubleTypes.has(eventType)) {
          doubleTouchCount++;
        }
      }

      console.log('📊 Double touch count calculated:', doubleTouchCount);
      return doubleTouchCount;
    } catch (error) {
      console.error('Error calculating double touch count:', error);
      return 0;
    }
  },

  // Calculate score progression data for chart (for user vs opponent matches)
  async calculateScoreProgression(
    matchId: string,
    userName: string,
    remoteId?: string,
    accessToken?: string | null
  ): Promise<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }> {
    try {
      console.log('📈 Calculating score progression for USER vs OPPONENT match:', matchId, 'user:', userName);

      const token = resolveAccessToken(accessToken);
      const postgrestOptions = token ? { accessToken: token } : { allowAnon: true };
      
      // DEBUG: First check if ANY events exist for this match (without null filter)
      const { data: allEvents, error: allEventsError } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_event_id,scoring_user_name,match_time_elapsed,event_type,cancelled_event_id,fencer_1_name,fencer_2_name,points_awarded,card_given,reset_segment',
          match_id: `eq.${matchId}`,
        },
        postgrestOptions
      );
      
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
      const { data: matchEventsRaw, error: eventsError } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_event_id,scoring_user_name,scoring_entity,match_time_elapsed,event_type,cancelled_event_id,fencer_1_name,fencer_2_name,timestamp,event_time,points_awarded,card_given,reset_segment',
          match_id: `eq.${matchId}`,
          order: 'event_time.asc,timestamp.asc',
        },
        postgrestOptions
      );
      
      if (eventsError) {
        console.error('Error fetching match events for score progression:', eventsError);
        return { userData: [], opponentData: [] };
      }

      if (!matchEventsRaw || matchEventsRaw.length === 0) {
        console.log('No match events found for score progression calculation (with timestamp fallback)');
        return { userData: [], opponentData: [] };
      }

      // Fill in missing match_time_elapsed values so the chart can render (common in sabre/legacy matches)
      let matchEvents = normalizeEventsForProgression(matchEventsRaw);
      matchEvents = filterEventsByLatestResetSegment(matchEvents);
      if (matchEvents.length === 0) {
        console.log('No match events found for latest reset segment (score progression)');
        return { userData: [], opponentData: [] };
      }
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
      const { data: matchData, error: matchError } = await postgrestSelectOne<{
        fencer_1_name: string | null;
        fencer_2_name: string | null;
        fencer_1_entity?: string | null;
        fencer_2_entity?: string | null;
        final_score: number | null;
        touches_against: number | null;
      }>(
        'match',
        {
          select: 'fencer_1_name,fencer_2_name,fencer_1_entity,fencer_2_entity,final_score,touches_against',
          match_id: `eq.${matchId}`,
          limit: 1,
        },
        postgrestOptions
      );

      if (matchError || !matchData) {
        console.error('Error fetching match data for score progression:', matchError);
        return { userData: [], opponentData: [] };
      }

      console.log('📈 USER vs OPPONENT - Fencer names:', matchData.fencer_1_name, 'vs', matchData.fencer_2_name);
      console.log('📈 USER vs OPPONENT - Match events found:', matchEvents.length);

      // 4. Deduplicate: keep by ID, and also collapse identical scorer/type at same elapsed and timestamp second
      // This catches legacy offline/online double writes for sabre where match_time_elapsed was null
      const seenEvents = new Set<string>();
      const seenComposite = new Set<string>();
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

        // Composite dedupe for identical scorer/type at same elapsed+time (handles sabre double writes)
        const elapsedKey = event.match_time_elapsed !== null && event.match_time_elapsed !== undefined
          ? Math.round(event.match_time_elapsed)
          : -1;
        const timeKey = (event.event_time || event.timestamp || '').slice(0, 19) || 'noTime';
        const scorerKey = event.scoring_entity || event.scoring_user_name || 'unknown';
        const compositeKey = `${scorerKey}|${event.event_type}|${elapsedKey}|${timeKey}`;
        if (seenComposite.has(compositeKey)) {
          duplicateEvents.push(event.match_event_id || compositeKey);
          console.log(`🔄 Composite duplicate detected and skipped: ${compositeKey}`);
          return false;
        }
        seenComposite.add(compositeKey);
        return true;
      });

      if (duplicateEvents.length > 0) {
        console.log(`⚠️ Found ${duplicateEvents.length} duplicate events in match ${matchId}. These have been deduplicated by ID.`);
      }

      console.log(`📊 After deduplication: ${uniqueEvents.length} unique events (removed ${matchEvents.length - uniqueEvents.length} duplicates)`);

      // 5. Process unique events using stored match_time_elapsed, filtering out cancelled events
      // Order events deterministically: prefer event_time, then timestamp, then match_time_elapsed, then ID
      const orderedEvents = [...uniqueEvents].sort((a, b) => {
        const aTime = (a.event_time || a.timestamp) ?? '';
        const bTime = (b.event_time || b.timestamp) ?? '';
        if (aTime && bTime && aTime !== bTime) return aTime < bTime ? -1 : 1;
        const aElapsed = a.match_time_elapsed ?? Number.MAX_SAFE_INTEGER;
        const bElapsed = b.match_time_elapsed ?? Number.MAX_SAFE_INTEGER;
        if (aElapsed !== bElapsed) return aElapsed - bElapsed;
        const aId = a.match_event_id || '';
        const bId = b.match_event_id || '';
        return aId.localeCompare(bId);
      });

      console.log('📊 [PROGRESSION ORDER] Ordered scoring events (x-axis source data):', orderedEvents.map(ev => ({
        id: ev.match_event_id,
        scorer: ev.scoring_user_name,
        type: ev.event_type,
        elapsed: ev.match_time_elapsed,
        event_time: ev.event_time,
        timestamp: ev.timestamp
      })));

      let userData: {x: string, y: number}[] = [];
      let opponentData: {x: string, y: number}[] = [];
      
      let userScore = 0;
      let opponentScore = 0;
      let lastSeconds = 0;

      for (const event of orderedEvents) {
        const eventType = (event.event_type || '').toLowerCase();
        const isDoubleTouch = eventType === 'double' || eventType === 'double_touch' || eventType === 'double_hit';
        const isSingleTouch = eventType === 'touch';
        const pointsAwarded = typeof event.points_awarded === 'number'
          ? event.points_awarded
          : (event.card_given === 'red' ? 1 : 0);
        const isCardPoint = eventType === 'card' && pointsAwarded > 0;

        // Only count scoring events (touch/double or red-card points)
        if (!isSingleTouch && !isDoubleTouch && !isCardPoint) {
          continue;
        }

        const displaySeconds = event.match_time_elapsed || 0;
        
        // Convert to MM:SS format
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        console.log('⏱️ [PROGRESSION X-AXIS] event→point', {
          id: event.match_event_id,
          scorer: event.scoring_user_name,
          elapsed: event.match_time_elapsed,
          event_time: event.event_time,
          timestamp: event.timestamp,
          xLabel: timeString,
          userScoreBefore: userScore,
          opponentScoreBefore: opponentScore,
        });
        lastSeconds = displaySeconds;

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

        if (isDoubleTouch) {
          userScore++;
          opponentScore++;
          userData.push({ x: timeString, y: userScore });
          opponentData.push({ x: timeString, y: opponentScore });
          continue;
        }

        const awardedToUser = isCardPoint ? !isUserScored : isUserScored;
        const awardedPoints = isCardPoint ? pointsAwarded : 1;

        if (awardedToUser) {
          userScore += awardedPoints;
          userData.push({ x: timeString, y: userScore });
        } else {
          opponentScore += awardedPoints;
          opponentData.push({ x: timeString, y: opponentScore });
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

      // If progression is short, pad with a final point at +1s so chart reaches the saved final
      if (userData.length > 0 || opponentData.length > 0) {
        if (userData.length === 0 && finalUserScore > 0) {
          const padSeconds = lastSeconds + 1;
          const minutes = Math.floor(padSeconds / 60);
          const seconds = padSeconds % 60;
          const padLabel = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          userData.push({ x: padLabel, y: finalUserScore });
          userScore = finalUserScore;
          console.log('📈 Padding empty user progression to final score:', { padLabel, finalUserScore });
        } else if (userData.length > 0 && (userData[userData.length - 1].y < finalUserScore)) {
          const padSeconds = lastSeconds + 1;
          const minutes = Math.floor(padSeconds / 60);
          const seconds = padSeconds % 60;
          const padLabel = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          userData.push({ x: padLabel, y: finalUserScore });
          userScore = finalUserScore;
          console.log('📈 Padding user progression to final score:', { padLabel, finalUserScore });
        }

        if (opponentData.length === 0 && finalOpponentScore > 0) {
          const padSeconds = lastSeconds + 1;
          const minutes = Math.floor(padSeconds / 60);
          const seconds = padSeconds % 60;
          const padLabel = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          opponentData.push({ x: padLabel, y: finalOpponentScore });
          opponentScore = finalOpponentScore;
          console.log('📈 Padding empty opponent progression to final score:', { padLabel, finalOpponentScore });
        } else if (opponentData.length > 0 && (opponentData[opponentData.length - 1].y < finalOpponentScore)) {
          const padSeconds = lastSeconds + 1;
          const minutes = Math.floor(padSeconds / 60);
          const seconds = padSeconds % 60;
          const padLabel = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          opponentData.push({ x: padLabel, y: finalOpponentScore });
          opponentScore = finalOpponentScore;
          console.log('📈 Padding opponent progression to final score:', { padLabel, finalOpponentScore });
        }
      }

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
  async calculateTouchesByPeriod(
    matchId: string,
    userName: string,
    remoteId?: string,
    finalUserScore?: number,
    finalOpponentScore?: number,
    accessToken?: string | null
  ): Promise<{
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  }> {
    try {
      console.log('📊 Calculating touches by period for match:', matchId, 'user:', userName);

      const token = resolveAccessToken(accessToken);
      const postgrestOptions = token ? { accessToken: token } : { allowAnon: true };
      
      // 1. Get all match events ordered by timestamp
      let matchEvents = null;
      
      // First try to get events by match_id
      const { data: eventsByMatchId, error: matchIdError } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_event_id,event_type,cancelled_event_id,scoring_user_name,timestamp,match_time_elapsed,match_period_id,points_awarded,card_given,reset_segment',
          match_id: `eq.${matchId}`,
          order: 'timestamp.asc',
        },
        postgrestOptions
      );
      
      if (matchIdError) {
        console.error('Error fetching match events by match_id for touches by period:', matchIdError);
      } else if (eventsByMatchId && eventsByMatchId.length > 0) {
        matchEvents = eventsByMatchId;
        console.log('Found', matchEvents.length, 'match events by match_id for touches by period');
      } else {
        // If no events found by match_id, try to find events by fencing_remote_id
        if (remoteId) {
          console.log('Trying to find events by fencing_remote_id for touches by period:', remoteId);
          const { data: eventsByRemoteId, error: remoteIdError } = await postgrestSelect<any>(
            'match_event',
            {
              select: 'match_event_id,event_type,cancelled_event_id,scoring_user_name,timestamp,match_time_elapsed,match_period_id,points_awarded,card_given,reset_segment',
              fencing_remote_id: `eq.${remoteId}`,
              order: 'timestamp.asc',
            },
            postgrestOptions
          );
          
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

      matchEvents = filterEventsByLatestResetSegment(matchEvents);
      if (matchEvents.length === 0) {
        console.log('No match events found for latest reset segment (touches by period)');
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

      const getScoringMeta = (event: any) => {
        const eventType = (event.event_type || '').toLowerCase();
        const isDoubleTouch = eventType === 'double' || eventType === 'double_touch' || eventType === 'double_hit';
        const isSingleTouch = eventType === 'touch';
        const pointsAwarded = typeof event.points_awarded === 'number'
          ? event.points_awarded
          : (event.card_given === 'red' ? 1 : 0);
        const isCardPoint = eventType === 'card' && pointsAwarded > 0;
        if (!isSingleTouch && !isDoubleTouch && !isCardPoint) {
          return null;
        }
        return {
          isDoubleTouch,
          isCardPoint,
          points: isCardPoint ? pointsAwarded : 1,
        };
      };

      // 3. Get final match scores to ensure accuracy
      let authoritativeUserScore = finalUserScore;
      let authoritativeOpponentScore = finalOpponentScore;
      
      // If final scores weren't passed, fetch them from the database
      if (authoritativeUserScore === undefined || authoritativeOpponentScore === undefined) {
        const { data: matchData, error: matchError } = await postgrestSelectOne<{
          final_score: number | null;
          touches_against: number | null;
          is_complete: boolean | null;
        }>(
          'match',
          {
            select: 'final_score,touches_against,is_complete',
            match_id: `eq.${matchId}`,
            limit: 1,
          },
          postgrestOptions
        );

        if (matchError) {
          console.error('Error fetching match data for touches by period:', matchError);
        }

        authoritativeUserScore = matchData?.final_score || 0;
        authoritativeOpponentScore = matchData?.touches_against || 0;
      }
      
      console.log('📊 Using authoritative final scores for touches by period:', authoritativeUserScore, '-', authoritativeOpponentScore);

      // 4. Get match periods to determine period boundaries
      const { data: matchPeriods, error: periodsError } = await postgrestSelect<any>(
        'match_period',
        {
          select: '*',
          match_id: `eq.${matchId}`,
          order: 'period_number.asc',
        },
        postgrestOptions
      );

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
          const scoring = getScoringMeta(event);
          if (!scoring) {
            continue;
          }

          if (scoring.isDoubleTouch) {
            userTouches += 1;
            opponentTouches += 1;
            console.log(`📊 Double touch counted in period 1, totals: ${userTouches}-${opponentTouches}`);
            continue;
          }

          if (!event.scoring_user_name) {
            continue;
          }

          const awardedToUser = scoring.isCardPoint
            ? event.scoring_user_name !== userName
            : event.scoring_user_name === userName;

          if (awardedToUser) {
            userTouches += scoring.points;
            console.log(`📊 User point counted in period 1, total: ${userTouches}`);
          } else {
            opponentTouches += scoring.points;
            console.log(`📊 Opponent point counted in period 1, total: ${opponentTouches}`);
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
        const scoring = getScoringMeta(event);
        if (!scoring) {
          continue;
        }

        const target = eventPeriod === 1
          ? touchesByPeriod.period1
          : eventPeriod === 2
          ? touchesByPeriod.period2
          : touchesByPeriod.period3;

        if (scoring.isDoubleTouch) {
          totalUserTouches += 1;
          totalOpponentTouches += 1;
          target.user += 1;
          target.opponent += 1;
          console.log(`📊 Double touch counted in period ${eventPeriod}, totals: ${totalUserTouches}-${totalOpponentTouches}`);
          continue;
        }

        if (!event.scoring_user_name) {
          continue;
        }

        const awardedToUser = scoring.isCardPoint
          ? event.scoring_user_name !== userName
          : event.scoring_user_name === userName;

        if (awardedToUser) {
          totalUserTouches += scoring.points;
          target.user += scoring.points;
          console.log(`📊 User point counted in period ${eventPeriod}, total: ${totalUserTouches}`);
        } else {
          totalOpponentTouches += scoring.points;
          target.opponent += scoring.points;
          console.log(`📊 Opponent point counted in period ${eventPeriod}, total: ${totalOpponentTouches}`);
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
  async updateMatch(
    matchId: string,
    updates: {
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
    fencer_1_entity?: string | null; // Stable entity (fencerA/fencerB) for fencer_1
    fencer_2_entity?: string | null; // Stable entity (fencerA/fencerB) for fencer_2
    event_date?: string; // ISO string for event date/time
    weapon_type?: string; // Weapon type: 'foil', 'epee', 'sabre'
    competition_id?: string | null;
    phase?: 'POULE' | 'DE' | null;
    de_round?: 'L256' | 'L128' | 'L96' | 'L64' | 'L32' | 'L16' | 'QF' | 'SF' | 'F' | null;
  },
  accessToken?: string | null
  ): Promise<Match | null> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ updateMatch blocked - auth session not ready', { matchId });
      return null;
    }

    const { data: existingMatch, error: fetchError } = await postgrestSelectOne<{ user_id: string | null }>(
      'match',
      {
        select: 'user_id',
        match_id: `eq.${matchId}`,
        limit: 1,
      },
      { accessToken: token }
    );

    if (fetchError) {
      console.error('Error fetching match for update:', fetchError);
      return null;
    }

    // If this is an anonymous match (user_id is null), use RPC function
    if (existingMatch && existingMatch.user_id === null) {
      console.log('🔄 Updating anonymous match via RPC function');
      
      const { data: rpcData, error: rpcError } = await postgrestRpc<Match>(
        'update_anonymous_match',
        {
          match_id_param: matchId,
          updates: updates
        },
        { accessToken: token, allowAnon: true }
      );

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
    const { data, error } = await postgrestUpdate<Match>(
      'match',
      updates,
      {
        match_id: `eq.${matchId}`,
        select: '*',
      },
      { accessToken: token }
    );

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
        fencer_2_name = COALESCE((updates->>'fencer_2_name')::text, fencer_2_name),
        fencer_1_entity = COALESCE((updates->>'fencer_1_entity')::text, fencer_1_entity),
        fencer_2_entity = COALESCE((updates->>'fencer_2_entity')::text, fencer_2_entity)
    WHERE match_id = match_id_param::uuid
    RETURNING * INTO result_record;
    
    RETURN row_to_json(result_record);
END;
$$;
        `);
      }
      
      return null;
    }

    const row = Array.isArray(data) ? data[0] ?? null : null;
    return row;
  },

  async updateMatchEventNamesIfPlaceholder(
    matchId: string,
    fencer1Name: string,
    fencer2Name: string,
    accessToken?: string | null
  ): Promise<boolean> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ updateMatchEventNamesIfPlaceholder blocked - auth session not ready', { matchId });
      return false;
    }

    const normalize = (value?: string | null) => {
      if (!value) return '';
      return value.trim().toLowerCase();
    };

    const placeholderNames = new Set([
      '',
      'tap to add name',
      'guest',
      'guest 1',
      'guest 2',
      'unknown',
      'fencer 1',
      'fencer 2',
    ]);

    const isPlaceholder = (value?: string | null) => {
      return placeholderNames.has(normalize(value));
    };

    try {
      const { data: events, error } = await postgrestSelect<{
        match_event_id: string;
        fencer_1_name: string | null;
        fencer_2_name: string | null;
      }>(
        'match_event',
        {
          select: 'match_event_id,fencer_1_name,fencer_2_name',
          match_id: `eq.${matchId}`,
        },
        { accessToken: token }
      );

      if (error) {
        console.error('❌ Error fetching match events for name update:', error);
        return false;
      }

      const targetEventIds = (events || [])
        .filter(event => isPlaceholder(event.fencer_1_name) || isPlaceholder(event.fencer_2_name))
        .map(event => event.match_event_id);

      if (targetEventIds.length === 0) {
        return true;
      }

      const { error: updateError } = await postgrestUpdate(
        'match_event',
        {
          fencer_1_name: fencer1Name,
          fencer_2_name: fencer2Name,
        },
        {
          match_id: `eq.${matchId}`,
          match_event_id: `in.(${targetEventIds.join(',')})`,
        },
        { accessToken: token, preferReturn: false }
      );

      if (updateError) {
        console.error('❌ Error updating match event names:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating match event names:', error);
      return false;
    }
  },

  // Delete a match and all related records
  async deleteMatch(
    matchId: string,
    fencingRemoteId?: string,
    accessToken?: string | null
  ): Promise<boolean> {
    try {
      console.log('🗑️ Starting deleteMatch:', { matchId, fencingRemoteId });

      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ deleteMatch blocked - auth session not ready', { matchId });
        return false;
      }
      
      // Get match data before deletion for goal recalculation
      const { data: matchData, error: matchFetchError } = await postgrestSelectOne<{
        user_id: string | null;
        is_win: boolean | null;
        final_score: number | null;
        touches_against: number | null;
      }>(
        'match',
        {
          select: 'user_id, is_win, final_score, touches_against',
          match_id: `eq.${matchId}`,
          limit: 1,
        },
        { accessToken: token }
      );

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
        const { error } = await postgrestDelete(
          'match_event',
          { fencing_remote_id: `eq.${fencingRemoteId}` },
          { accessToken: token, preferReturn: true }
        );
        eventsError = error;
        console.log('🗑️ Match events delete result:', { error });
      } else {
        // Delete by match_id (fallback)
        console.log('🗑️ Deleting match events by match_id:', matchId);
        const { error } = await postgrestDelete(
          'match_event',
          { match_id: `eq.${matchId}` },
          { accessToken: token, preferReturn: true }
        );
        eventsError = error;
        console.log('🗑️ Match events delete result:', { error });
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
      const { data: existingPeriods, error: queryError } = await postgrestSelect(
        'match_period',
        { select: '*', match_id: `eq.${matchId}` },
        { accessToken: token }
      );
      
      if (queryError) {
        console.error('❌ Error querying match periods:', queryError);
      } else {
        console.log('🔍 Found match_period records to delete:', existingPeriods?.length || 0, existingPeriods);
      }
      
      const { data: periodsData, error: periodsError } = await postgrestDelete<{
        match_period_id: string;
      }>(
        'match_period',
        { match_id: `eq.${matchId}` },
        { accessToken: token, preferReturn: true }
      );

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
      const { data: deletedMatchData, error: matchError } = await postgrestDelete(
        'match',
        { match_id: `eq.${matchId}` },
        { accessToken: token, preferReturn: true }
      );

      if (matchError) {
        console.error('❌ Error deleting match:', matchError);
        return false;
      } else {
        console.log('✅ Match deleted successfully:', deletedMatchData);
      }

      // 4. Recalculate goals after deletion (reverse the match impact)
      if (
        userId &&
        typeof wasWin === 'boolean' &&
        typeof finalScore === 'number' &&
        typeof opponentScore === 'number'
      ) {
        console.log('🔄 Recalculating goals after match deletion...');
        try {
          // Reverse the match result for goal recalculation
          const reverseResult = wasWin ? 'loss' : 'win';
          await goalService.updateGoalsAfterMatch(
            userId,
            reverseResult as 'win' | 'loss',
            opponentScore,
            finalScore,
            accessToken
          );
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
  async calculateAnonymousScoreProgression(
    matchId: string,
    accessToken?: string | null
  ): Promise<{
    fencer1Data: {x: string, y: number}[],
    fencer2Data: {x: string, y: number}[]
  }> {
    try {
      console.log('📈 Calculating ANONYMOUS score progression for match:', matchId);

      const token = resolveAccessToken(accessToken);
      const postgrestOptions = token ? { accessToken: token } : { allowAnon: true };
      
      // 1. Get all match events (including cancellation events), keeping timestamp so we can rebuild elapsed time when missing
      // Include fencer_1_name and fencer_2_name from events to handle swaps correctly
      const { data: matchEventsRaw, error: eventsError } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_event_id,scoring_user_name,scoring_entity,match_time_elapsed,event_type,cancelled_event_id,fencer_1_name,fencer_2_name,timestamp,event_time,points_awarded,card_given,reset_segment',
          match_id: `eq.${matchId}`,
          order: 'event_time.asc,timestamp.asc',
        },
        postgrestOptions
      );
      
      if (eventsError) {
        console.error('Error fetching match events for anonymous score progression:', eventsError);
        return { fencer1Data: [], fencer2Data: [] };
      }

      if (!matchEventsRaw || matchEventsRaw.length === 0) {
        console.log('No match events found for anonymous score progression calculation');
        return { fencer1Data: [], fencer2Data: [] };
      }

      // Normalize missing elapsed values so the chart doesn't render blank when times weren't stored
      let matchEvents = normalizeEventsForProgression(matchEventsRaw);
      matchEvents = filterEventsByLatestResetSegment(matchEvents);
      if (matchEvents.length === 0) {
        console.log('No match events found for latest reset segment (anonymous progression)');
        return { fencer1Data: [], fencer2Data: [] };
      }
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
      const { data: matchData, error: matchError } = await postgrestSelectOne<{
        fencer_1_name: string | null;
        fencer_2_name: string | null;
        fencer_1_entity?: string | null;
        fencer_2_entity?: string | null;
        final_score: number | null;
        touches_against: number | null;
      }>(
        'match',
        {
          select: 'fencer_1_name,fencer_2_name,fencer_1_entity,fencer_2_entity,final_score,touches_against',
          match_id: `eq.${matchId}`,
          limit: 1,
        },
        postgrestOptions
      );

      if (matchError || !matchData) {
        console.error('Error fetching match data for anonymous score progression:', matchError);
        return { fencer1Data: [], fencer2Data: [] };
      }

      console.log('📈 ANONYMOUS - Fencer names:', matchData.fencer_1_name, 'vs', matchData.fencer_2_name);
      console.log('📈 ANONYMOUS - Fencer entities:', matchData.fencer_1_entity, 'vs', matchData.fencer_2_entity);
      console.log('📈 ANONYMOUS - Match events found:', matchEvents.length);

      // 4. Deduplicate events
      // Use match_event_id when available, and collapse identical scorer/type at same elapsed+time (legacy offline duplicates)
      const seenEvents = new Set<string>();
      const seenComposite = new Set<string>();
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

        // Prefer match_event_id; fallback to elapsed+timestamp+scorer+type when missing
        const scorerKey = event.scoring_entity || event.scoring_user_name || 'unknown';
        const eventKey = event.match_event_id
          ? `id_${event.match_event_id}`
          : `${event.match_time_elapsed}_${event.timestamp || event.event_time || 'no_ts'}_${scorerKey}_${event.event_type}`;
        
        if (seenEvents.has(eventKey)) {
          duplicateEvents.push(event.match_event_id || 'unknown');
          console.log(`🔄 Duplicate event detected and skipped: ${event.match_event_id} (time: ${event.match_time_elapsed}s, scorer: ${event.scoring_user_name})`);
          return false;
        }
        
        seenEvents.add(eventKey);

        // Composite dedupe for identical scorer/type at same elapsed+time (legacy sabre/offline double writes)
        const elapsedKey = event.match_time_elapsed !== null && event.match_time_elapsed !== undefined
          ? Math.round(event.match_time_elapsed)
          : -1;
        const timeKey = (event.event_time || event.timestamp || '').slice(0, 19) || 'noTime';
        const compositeKey = `${scorerKey}|${event.event_type}|${elapsedKey}|${timeKey}`;
        if (seenComposite.has(compositeKey)) {
          duplicateEvents.push(event.match_event_id || compositeKey);
          console.log(`🔄 Composite duplicate detected and skipped: ${compositeKey}`);
          return false;
        }
        seenComposite.add(compositeKey);

        return true;
      });

      if (duplicateEvents.length > 0) {
        console.log(`⚠️ Found ${duplicateEvents.length} duplicate events in match ${matchId}. These have been deduplicated.`);
      }

      console.log(`📊 After deduplication: ${uniqueEvents.length} unique events (removed ${matchEvents.length - uniqueEvents.length} duplicates)`);

      // 5. Process unique events using stored match_time_elapsed
      // Order events deterministically: prefer event_time, then timestamp, then match_time_elapsed, then ID
      const orderedEvents = [...uniqueEvents].sort((a, b) => {
        const aTime = (a.event_time || a.timestamp) ?? '';
        const bTime = (b.event_time || b.timestamp) ?? '';
        if (aTime && bTime && aTime !== bTime) return aTime < bTime ? -1 : 1;
        const aElapsed = a.match_time_elapsed ?? Number.MAX_SAFE_INTEGER;
        const bElapsed = b.match_time_elapsed ?? Number.MAX_SAFE_INTEGER;
        if (aElapsed !== bElapsed) return aElapsed - bElapsed;
        const aId = a.match_event_id || '';
        const bId = b.match_event_id || '';
        return aId.localeCompare(bId);
      });

      console.log('📊 [ANON PROGRESSION ORDER] Ordered scoring events (x-axis source data):', orderedEvents.map(ev => ({
        id: ev.match_event_id,
        scorer: ev.scoring_user_name,
        type: ev.event_type,
        elapsed: ev.match_time_elapsed,
        event_time: ev.event_time,
        timestamp: ev.timestamp
      })));

      let fencer1Data: {x: string, y: number}[] = [];
      let fencer2Data: {x: string, y: number}[] = [];
      
      let fencer1Score = 0;
      let fencer2Score = 0;
      let lastSeconds = 0;

      for (const event of orderedEvents) {
        const eventType = (event.event_type || '').toLowerCase();
        const isDoubleTouch = eventType === 'double' || eventType === 'double_touch' || eventType === 'double_hit';
        const isSingleTouch = eventType === 'touch';
        const pointsAwarded = typeof event.points_awarded === 'number'
          ? event.points_awarded
          : (event.card_given === 'red' ? 1 : 0);
        const isCardPoint = eventType === 'card' && pointsAwarded > 0;

        // Only count scoring events (touch/double or red-card points)
        if (!isSingleTouch && !isDoubleTouch && !isCardPoint) {
          continue;
        }

        const displaySeconds = event.match_time_elapsed || 0;
        
        // Convert to MM:SS format
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        console.log('⏱️ [ANON PROGRESSION X-AXIS] event→point', {
          id: event.match_event_id,
          scorer: event.scoring_user_name,
          elapsed: event.match_time_elapsed,
          event_time: event.event_time,
          timestamp: event.timestamp,
          xLabel: timeString,
          fencer1ScoreBefore: fencer1Score,
          fencer2ScoreBefore: fencer2Score,
        });
        lastSeconds = displaySeconds;

        // Determine which fencer scored based on event's stored fencer names (handles swaps correctly)
        // Events store fencer_1_name and fencer_2_name at the time of the event
        // Match table stores final fencer_1_name and fencer_2_name (after any swaps)
        // We need to map the event's fencer to the final match fencer based on entity identity
        
        const resolveScorerIsFencer1 = () => {
          if (event.scoring_entity && matchData.fencer_1_entity && matchData.fencer_2_entity) {
            if (event.scoring_entity === matchData.fencer_1_entity) {
              return true;
            }
            if (event.scoring_entity === matchData.fencer_2_entity) {
              return false;
            }
          }
          let isFencer1Scored = false;
          if (event.fencer_1_name && event.fencer_2_name) {
            if (event.scoring_user_name === event.fencer_1_name) {
              if (event.fencer_1_name === matchData.fencer_1_name) {
                isFencer1Scored = true;
              } else if (event.fencer_1_name === matchData.fencer_2_name) {
                isFencer1Scored = false;
              } else {
                isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
              }
            } else if (event.scoring_user_name === event.fencer_2_name) {
              if (event.fencer_2_name === matchData.fencer_2_name) {
                isFencer1Scored = false;
              } else if (event.fencer_2_name === matchData.fencer_1_name) {
                isFencer1Scored = true;
              } else {
                isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
              }
            } else {
              isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
            }
          } else {
            isFencer1Scored = event.scoring_user_name === matchData.fencer_1_name;
          }
          return isFencer1Scored;
        };

        if (isDoubleTouch) {
          // Epee double: increment both fencers
          fencer1Score++;
          fencer2Score++;
          fencer1Data.push({ x: timeString, y: fencer1Score });
          fencer2Data.push({ x: timeString, y: fencer2Score });
          console.log(`📈 ✅ Double touch counted: fencer1=${fencer1Score}, fencer2=${fencer2Score} at ${timeString}`);
        } else {
          const scorerIsFencer1 = resolveScorerIsFencer1();
          const awardedToFencer1 = isCardPoint ? !scorerIsFencer1 : scorerIsFencer1;
          const awardedPoints = isCardPoint ? pointsAwarded : 1;
          if (awardedToFencer1) {
            fencer1Score += awardedPoints;
            const dataPoint = { x: timeString, y: fencer1Score };
            fencer1Data.push(dataPoint);
            console.log(`📈 ✅ Fencer 1 (${matchData.fencer_1_name}) point counted: ${fencer1Score} at ${timeString}`);
          } else {
            fencer2Score += awardedPoints;
            const dataPoint = { x: timeString, y: fencer2Score };
            fencer2Data.push(dataPoint);
            console.log(`📈 ✅ Fencer 2 (${matchData.fencer_2_name}) point counted: ${fencer2Score} at ${timeString}`);
          }
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
      const progressionExceedsFinals = lastFencer1Y > finalFencer1Score || lastFencer2Y > finalFencer2Score;

      if (lastFencer1Y !== finalFencer1Score || lastFencer2Y !== finalFencer2Score) {
        console.warn(`⚠️ Anonymous score progression mismatch detected!`, {
          matchId,
          progression: { fencer1: lastFencer1Y, fencer2: lastFencer2Y },
          finalScores: { fencer1: finalFencer1Score, fencer2: finalFencer2Score },
          difference: { fencer1: lastFencer1Y - finalFencer1Score, fencer2: lastFencer2Y - finalFencer2Score }
        });
        // Do not mutate progression to match finals; keep progression as truth for charting
      }

      // Pad progression to reach saved finals if events are short (common when an event failed to write)
      // Only pad when progression is below or equal to finals for BOTH fencers; if one side already exceeds,
      // finals are likely user-oriented or swapped, so we keep progression as-is.
      const canPadSafely = !progressionExceedsFinals;
      if (canPadSafely && (lastFencer1Y < finalFencer1Score || lastFencer2Y < finalFencer2Score)) {
        const padSeconds = lastSeconds + 1;
        const minutes = Math.floor(padSeconds / 60);
        const seconds = padSeconds % 60;
        const padLabel = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        if (lastFencer1Y < finalFencer1Score) {
          fencer1Data.push({ x: padLabel, y: finalFencer1Score });
          console.log('📈 Padding fencer 1 progression to final score:', { padLabel, finalFencer1Score });
        }
        if (lastFencer2Y < finalFencer2Score) {
          fencer2Data.push({ x: padLabel, y: finalFencer2Score });
          console.log('📈 Padding fencer 2 progression to final score:', { padLabel, finalFencer2Score });
        }
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
  async createRemoteSession(
    remoteData: Partial<FencingRemote>,
    accessToken?: string | null
  ): Promise<FencingRemote | null> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ fencingRemoteService.createRemoteSession blocked - auth session not ready');
      return null;
    }

    if (remoteData.referee_id) {
      await userService.ensureUserById(remoteData.referee_id, undefined, token);
    }

    const { data, error } = await postgrestInsert<FencingRemote>(
      'fencing_remote',
      remoteData,
      { select: '*' },
      { accessToken: token }
    );

    if (error) {
      console.error('Error creating remote session:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: (error as any)?.code,
      });
      return null;
    }

    const row = Array.isArray(data) ? data[0] ?? null : null;
    return row;
  },

  // Update remote session scores
  async updateRemoteScores(
    remoteId: string,
    score1: number,
    score2: number,
    accessToken?: string | null
  ): Promise<boolean> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ fencingRemoteService.updateRemoteScores blocked - auth session not ready');
      return false;
    }

    const { error } = await postgrestUpdate(
      'fencing_remote',
      { score_1: score1, score_2: score2 },
      { remote_id: `eq.${remoteId}` },
      { accessToken: token }
    );

    if (error) {
      console.error('Error updating remote scores:', error);
      return false;
    }

    return true;
  },

  // Complete remote session and create match
  async completeRemoteSession(
    remoteId: string,
    userId: string,
    accessToken?: string | null
  ): Promise<Match | null> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ fencingRemoteService.completeRemoteSession blocked - auth session not ready');
      return null;
    }

    // Get the remote session data
    const { data: remoteData, error: remoteError } = await postgrestSelectOne<FencingRemote>(
      'fencing_remote',
      {
        select: '*',
        remote_id: `eq.${remoteId}`,
        limit: 1,
      },
      { accessToken: token }
    );

    if (remoteError || !remoteData) {
      console.error('Error fetching remote session:', remoteError);
      return null;
    }

    // Create match from remote data
    const match = await matchService.createMatchFromRemote(remoteData, userId, token);

    if (match) {
      // Update remote session with linked match ID
      await postgrestUpdate(
        'fencing_remote',
        { linked_match_id: match.match_id },
        { remote_id: `eq.${remoteId}` },
        { accessToken: token }
      );
    }

    return match;
  },

  // Delete a fencing remote session
  async deleteRemoteSession(remoteId: string, accessToken?: string | null): Promise<boolean> {
    console.log('🗑️ Deleting remote session:', remoteId);
    
    // Skip database deletion for offline sessions (they don't exist in the database)
    if (remoteId.startsWith('offline_')) {
      console.log('📱 Offline session detected - skipping database deletion (session only exists locally)');
      return true; // Return true since offline sessions don't need database deletion
    }
    
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ fencingRemoteService.deleteRemoteSession blocked - auth session not ready');
      return false;
    }

    const { data, error } = await postgrestDelete(
      'fencing_remote',
      { remote_id: `eq.${remoteId}` },
      { accessToken: token, preferReturn: true }
    );

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
      const token = resolveAccessToken();
      if (!token) {
        console.warn('⚠️ fencingRemoteService.cleanupOrphanedPeriods blocked - auth session not ready');
        return false;
      }

      const { data: allPeriods, error: periodsError } = await postgrestSelect<{ match_period_id: string; match_id: string | null }>(
        'match_period',
        { select: 'match_period_id,match_id' },
        { accessToken: token }
      );

      if (periodsError) {
        console.error('❌ Error finding orphaned periods:', periodsError);
        return false;
      }

      const { data: allMatches, error: matchesError } = await postgrestSelect<{ match_id: string }>(
        'match',
        { select: 'match_id' },
        { accessToken: token }
      );

      if (matchesError) {
        console.error('❌ Error fetching match ids:', matchesError);
        return false;
      }

      const matchIdSet = new Set((allMatches || []).map(match => match.match_id));
      const orphanedPeriods = (allPeriods || []).filter(period => {
        if (!period.match_id) return true;
        return !matchIdSet.has(period.match_id);
      });
      
      if (orphanedPeriods && orphanedPeriods.length > 0) {
        console.log('🗑️ Found orphaned match_period records:', orphanedPeriods.length);
        console.log('Orphaned period IDs:', orphanedPeriods.map(p => p.match_period_id));
        
        // Delete the orphaned records
        const { error: deleteError } = await postgrestDelete(
          'match_period',
          { match_period_id: `in.(${orphanedPeriods.map(p => p.match_period_id).join(',')})` },
          { accessToken: token }
        );
        
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
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ diaryService.getDiaryEntries blocked - auth session not ready');
      return [];
    }

    const { data, error } = await postgrestSelect<DiaryEntry>(
      'diary_entry',
      {
        select: '*',
        user_id: `eq.${userId}`,
        order: 'created_at.desc',
        limit,
      },
      { accessToken: token }
    );

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

    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ diaryService.createDiaryEntry blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestInsert<DiaryEntry>(
      'diary_entry',
      newEntry,
      { select: '*' },
      { accessToken: token }
    );

    if (error) {
      console.error('Error creating diary entry:', error);
      return null;
    }

    return data?.[0] ?? null;
  },

  // Update diary entry
  async updateDiaryEntry(entryId: string, updates: Partial<DiaryEntry>): Promise<DiaryEntry | null> {
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ diaryService.updateDiaryEntry blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestUpdate<DiaryEntry>(
      'diary_entry',
      updates,
      { entry_id: `eq.${entryId}`, select: '*' },
      { accessToken: token }
    );

    if (error) {
      console.error('Error updating diary entry:', error);
      return null;
    }

    return data?.[0] ?? null;
  },

  // Delete diary entry
  async deleteDiaryEntry(entryId: string): Promise<boolean> {
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ diaryService.deleteDiaryEntry blocked - auth session not ready');
      return false;
    }

    const { error } = await postgrestDelete(
      'diary_entry',
      { entry_id: `eq.${entryId}` },
      { accessToken: token }
    );

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
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ drillService.getDrills blocked - auth session not ready');
      return [];
    }

    const query: Record<string, string | number | boolean> = {
      select: '*',
      order: 'name.asc',
    };

    if (category) {
      query.category = `eq.${category}`;
    }

    const { data, error } = await postgrestSelect<Drill>(
      'drill',
      query,
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching drills:', error);
      return [];
    }

    return data || [];
  },

  // Get drill by ID
  async getDrillById(drillId: string): Promise<Drill | null> {
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ drillService.getDrillById blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestSelectOne<Drill>(
      'drill',
      {
        select: '*',
        drill_id: `eq.${drillId}`,
        limit: 1,
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching drill:', error);
      return null;
    }

    return data;
  },

  // Create a new drill
  async createDrill(drillData: Partial<Drill>): Promise<Drill | null> {
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ drillService.createDrill blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestInsert<Drill>(
      'drill',
      drillData,
      { select: '*' },
      { accessToken: token }
    );

    if (error) {
      console.error('Error creating drill:', error);
      return null;
    }

    return data?.[0] ?? null;
  },
};

// Equipment-related functions
export const equipmentService = {
  // Get all equipment
  async getEquipment(sport?: string): Promise<Equipment[]> {
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ equipmentService.getEquipment blocked - auth session not ready');
      return [];
    }

    const query: Record<string, string | number | boolean> = {
      select: '*',
      order: 'name.asc',
    };

    if (sport) {
      query.sport = `eq.${sport}`;
    }

    const { data, error } = await postgrestSelect<Equipment>(
      'equipment',
      query,
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching equipment:', error);
      return [];
    }

    return data || [];
  },

  // Get equipment by ID
  async getEquipmentById(equipmentId: string): Promise<Equipment | null> {
    const token = resolveAccessToken();
    if (!token) {
      console.warn('⚠️ equipmentService.getEquipmentById blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestSelectOne<Equipment>(
      'equipment',
      {
        select: '*',
        equipment_id: `eq.${equipmentId}`,
        limit: 1,
      },
      { accessToken: token }
    );

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
  async getUserApprovals(userId: string, accessToken?: string | null): Promise<MatchApproval[]> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ matchApprovalService.getUserApprovals blocked - auth session not ready');
      return [];
    }

    const { data, error } = await postgrestSelect<MatchApproval>(
      'match_approval',
      {
        select: '*',
        user_id: `eq.${userId}`,
        order: 'timestamp.desc',
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error fetching match approvals:', error);
      return [];
    }

    return data || [];
  },

  // Create or update approval
  async approveMatch(
    remoteId: string,
    userId: string,
    approved: boolean,
    accessToken?: string | null
  ): Promise<MatchApproval | null> {
    const approvalData = {
      remote_id: remoteId,
      user_id: userId,
      has_approved: approved,
      timestamp: new Date().toISOString(),
    };

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ matchApprovalService.approveMatch blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestInsert<MatchApproval>(
      'match_approval',
      approvalData,
      {
        on_conflict: 'remote_id,user_id',
        select: '*',
      },
      {
        accessToken: token,
        prefer: 'return=representation, resolution=merge-duplicates',
      }
    );

    if (error) {
      console.error('Error creating/updating approval:', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] ?? null : null;
    return row;
  },
};

// Match Event-related functions
export const matchEventService = {
  // Get events for a match
  async getMatchEvents(matchId: string, accessToken?: string | null): Promise<MatchEvent[]> {
    const token = resolveAccessToken(accessToken);
    const { data, error } = await postgrestSelect<MatchEvent>(
      'match_event',
      {
        select: '*',
        match_id: `eq.${matchId}`,
        order: 'event_time.asc',
      },
      token ? { accessToken: token } : { allowAnon: true }
    );

    if (error) {
      console.error('Error fetching match events:', error);
      return [];
    }

    return data || [];
  },

  // Create a match event
  async createMatchEvent(
    eventData: Partial<MatchEvent>,
    accessToken?: string | null
  ): Promise<MatchEvent | null> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ matchEventService.createMatchEvent blocked - auth session not ready');
      return null;
    }

    // If a match_id is provided, ensure it exists; if not, return null so caller can retry/queue
    if (eventData.match_id) {
      const { data: matchExists, error: matchError } = await postgrestSelectOne<{ match_id: string }>(
        'match',
        {
          select: 'match_id',
          match_id: `eq.${eventData.match_id}`,
          limit: 1,
        },
        { accessToken: token }
      );

      if (matchError) {
        console.warn('⚠️ matchEventService.createMatchEvent: error checking match existence, aborting insert so caller can retry', {
          match_id: eventData.match_id,
          error: matchError,
        });
        return null;
      }

      if (!matchExists) {
        console.warn('⚠️ matchEventService.createMatchEvent: match not found, aborting insert so caller can retry once match exists', {
          match_id: eventData.match_id,
        });
        return null;
      }
    }

    const useUpsert = !!eventData.event_uuid;
    const query = useUpsert
      ? { select: '*', on_conflict: 'event_uuid' }
      : { select: '*' };
    const { data, error } = useUpsert
      ? await postgrestUpsert<MatchEvent>(
          'match_event',
          eventData,
          query,
          { accessToken: token }
        )
      : await postgrestInsert<MatchEvent>(
          'match_event',
          eventData,
          query,
          { accessToken: token }
        );

    if (error) {
      console.error('Error creating match event:', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] ?? null : null;
    return row;
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
    fencer_a_score?: number;
    fencer_b_score?: number;
    fencer_1_cards?: number;
    fencer_2_cards?: number;
    priority_assigned?: string;
    priority_to?: string;
    notes?: string;
  }, accessToken?: string | null): Promise<MatchPeriod | null> => {
    console.log('🔄 matchPeriodService.createMatchPeriod called with:', periodData);

    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ matchPeriodService.createMatchPeriod blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestInsert<MatchPeriod>(
      'match_period',
      periodData,
      { select: '*' },
      { accessToken: token }
    );

    if (error) {
      console.error('❌ Error creating match period:', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] ?? null : null;
    console.log('✅ Match period created successfully:', row);
    return row;
  },

  // Get match periods for a specific match
  getMatchPeriods: async (matchId: string, accessToken?: string | null) => {
    const token = resolveAccessToken(accessToken);
    const { data, error } = await postgrestSelect(
      'match_period',
      {
        select: '*',
        match_id: `eq.${matchId}`,
        order: 'period_number.asc',
      },
      token ? { accessToken: token } : { allowAnon: true }
    );

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
    fencer_a_score?: number;
    fencer_b_score?: number;
    fencer_1_cards?: number;
    fencer_2_cards?: number;
    priority_assigned?: string;
    priority_to?: string;
    notes?: string;
    timestamp?: string; // Add timestamp to updates
  }, accessToken?: string | null) => {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ matchPeriodService.updateMatchPeriod blocked - auth session not ready');
      return null;
    }

    const { data, error } = await postgrestUpdate(
      'match_period',
      updates,
      {
        match_period_id: `eq.${periodId}`,
        select: '*',
      },
      { accessToken: token }
    );

    if (error) {
      console.error('Error updating match period:', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] ?? null : null;
    return row;
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

export interface ActivityCalendarDay {
  activity_date: string; // YYYY-MM-DD
  total_count: number;
  competition_match_count: number;
  training_match_count: number;
  performance_session_count: number;
  performance_activity_types: string[];
}

// Weekly Target Service
export const weeklyTargetService = {
  
  // Create or update a weekly target
  async setWeeklyTarget(
    userId: string,
    activityType: string,
    weekStartDate: Date,
    weekEndDate: Date,
    targetSessions: number,
    accessToken?: string | null
  ): Promise<WeeklyTarget | null> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ setWeeklyTarget blocked - auth session not ready', { userId });
        return null;
      }
      const weekStart = weekStartDate.toISOString().split('T')[0];
      const weekEnd = weekEndDate.toISOString().split('T')[0];

      let existing: { target_id: string }[] | null = null;
      let existingError: any = null;
      try {
        const existingResult = await postgrestSelect<{ target_id: string }>(
          'weekly_target',
          {
            select: 'target_id',
            user_id: `eq.${userId}`,
            activity_type: `eq.${activityType}`,
            week_start_date: `eq.${weekStart}`,
            order: 'updated_at.desc',
            limit: 1,
          },
          { accessToken: token }
        );
        existing = existingResult.data;
        existingError = existingResult.error;
      } catch (requestError) {
        console.error('Error checking existing weekly target (request):', requestError);
        return null;
      }

      if (existingError) {
        console.error('Error checking existing weekly target:', existingError);
      }

      const payload = {
        user_id: userId,
        activity_type: activityType,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        target_sessions: targetSessions,
        updated_at: new Date().toISOString()
      };

      const existingTarget = existing?.[0];
      let data: WeeklyTarget | null = null;
      let error: any = null;
      try {
        const result = existingTarget?.target_id
          ? await postgrestUpdate<WeeklyTarget>(
              'weekly_target',
              payload,
              {
                target_id: `eq.${existingTarget.target_id}`,
                select: '*',
              },
              { accessToken: token }
            )
          : await postgrestInsert<WeeklyTarget>(
              'weekly_target',
              payload,
              { select: '*' },
              { accessToken: token }
            );
        data = Array.isArray(result.data) ? result.data[0] ?? null : null;
        error = result.error;
      } catch (requestError) {
        console.error('Error setting weekly target (request):', requestError);
        return null;
      }

      if (error) {
        if ((error as any)?.code === '23503') {
          console.warn('⚠️ Weekly target insert failed due to missing user record; retrying once');
          await userService.ensureUserById(userId, undefined, token);
          let retry;
          try {
            retry = existingTarget?.target_id
              ? await postgrestUpdate<WeeklyTarget>(
                  'weekly_target',
                  payload,
                  {
                    target_id: `eq.${existingTarget.target_id}`,
                    select: '*',
                  },
                  { accessToken: token }
                )
              : await postgrestInsert<WeeklyTarget>(
                  'weekly_target',
                  payload,
                  { select: '*' },
                  { accessToken: token }
                );
          } catch (requestError) {
            console.error('Error setting weekly target after retry (request):', requestError);
            return null;
          }

          if (retry.error) {
            console.error('Error setting weekly target after retry:', retry.error);
            return null;
          }

          const retryRow = Array.isArray(retry.data) ? retry.data[0] ?? null : null;
          return retryRow;
        }

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
    weekStartDate: Date,
    accessToken?: string | null
  ): Promise<WeeklyTarget | null> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ getWeeklyTarget blocked - auth session not ready', { userId });
        return null;
      }
      const dateString = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`;
      
      try {
        const result = await postgrestSelect<WeeklyTarget>(
          'weekly_target',
          {
            select: '*',
            user_id: `eq.${userId}`,
            activity_type: `eq.${activityType}`,
            week_start_date: `eq.${dateString}`,
            order: 'updated_at.desc',
            limit: 1,
          },
          { accessToken: token }
        );
        if (result.error) {
          console.error('Error getting weekly target:', result.error);
          return null;
        }
        const target = result.data?.[0] || null;
        if (!target) {
          console.log('🔍 No target found for this week');
        } else {
          console.log('🔍 Found target:', target);
        }
        return target;
      } catch (requestError) {
        console.error('Error getting weekly target (request):', requestError);
        return null;
      }
    } catch (error) {
      console.error('Error in getWeeklyTarget:', error);
      return null;
    }
  },

  // Delete a weekly target
  async deleteWeeklyTarget(
    targetId: string,
    accessToken?: string | null
  ): Promise<boolean> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ deleteWeeklyTarget blocked - auth session not ready', { targetId });
        return false;
      }

      // First, get the target details to create history record
      const { data: target, error: fetchError } = await postgrestSelectOne<WeeklyTarget>(
        'weekly_target',
        {
          select: '*',
          target_id: `eq.${targetId}`,
          limit: 1,
        },
        { accessToken: token }
      );

      if (fetchError || !target) {
        console.error('Error fetching target for deletion:', fetchError);
        return false;
      }

      // Get completed sessions count
      const { data: sessions, error: sessionsError } = await postgrestSelect<WeeklySessionLog>(
        'weekly_session_log',
        {
          select: 'session_id',
          user_id: `eq.${target.user_id}`,
          activity_type: `eq.${target.activity_type}`,
          session_date: [
            `gte.${target.week_start_date}`,
            `lte.${target.week_end_date}`,
          ],
        },
        { accessToken: token }
      );

      if (sessionsError) {
        console.error('Error fetching session logs for deletion:', sessionsError);
      }

      const completedSessions = sessions?.length || 0;
      const completionRate = target.target_sessions > 0 ? (completedSessions / target.target_sessions) * 100 : 0;

      // Check if there are any history records that reference this target
      const { data: existingHistory } = await postgrestSelect<{ id: string }>(
        'weekly_completion_history',
        {
          select: 'id',
          original_target_id: `eq.${targetId}`,
        },
        { accessToken: token }
      );

      // Only delete history records if they exist
      if (existingHistory && existingHistory.length > 0) {
        const { error: deleteHistoryError } = await postgrestDelete(
          'weekly_completion_history',
          { original_target_id: `eq.${targetId}` },
          { accessToken: token }
        );

        if (deleteHistoryError) {
          console.error('Error deleting existing history records:', deleteHistoryError);
        } else {
          console.log('✅ Existing history records deleted');
        }
      } else {
        console.log('ℹ️ No existing history records to delete (this is normal for new targets)');
      }

      // Create history record for deleted target
      const { error: historyError } = await postgrestInsert(
        'weekly_completion_history',
        {
          user_id: target.user_id,
          activity_type: target.activity_type,
          week_start_date: target.week_start_date,
          week_end_date: target.week_end_date,
          target_sessions: target.target_sessions,
          completed_sessions: completedSessions,
          completion_rate: completionRate,
          status: 'abandoned', // Mark as abandoned since user manually deleted
          completion_date: new Date().toISOString(),
        },
        undefined,
        { accessToken: token, preferReturn: false }
      );

      if (historyError) {
        console.error('Error creating deletion history:', historyError);
        // Continue with deletion even if history creation fails
      }

      // Clear session logs for the deleted target
      if (sessions && sessions.length > 0) {
        console.log('🗑️ Clearing', sessions.length, 'session logs for deleted target');
        const { error: deleteSessionsError } = await postgrestDelete(
          'weekly_session_log',
          {
            user_id: `eq.${target.user_id}`,
            activity_type: `eq.${target.activity_type}`,
            session_date: [
              `gte.${target.week_start_date}`,
              `lte.${target.week_end_date}`,
            ],
          },
          { accessToken: token }
        );
        if (deleteSessionsError) {
          console.error('Error deleting weekly session logs:', deleteSessionsError);
        }
      }

      // Now delete the target
      const { error } = await postgrestDelete(
        'weekly_target',
        { target_id: `eq.${targetId}` },
        { accessToken: token }
      );

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
  async getAllTargetsForActivity(
    userId: string,
    activityType: string,
    accessToken?: string | null
  ): Promise<WeeklyTarget[]> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ getAllTargetsForActivity blocked - auth session not ready', { userId });
        return [];
      }

      const { data, error } = await postgrestSelect<WeeklyTarget>(
        'weekly_target',
        {
          select: '*',
          user_id: `eq.${userId}`,
          activity_type: `eq.${activityType}`,
          order: 'week_start_date.asc',
        },
        { accessToken: token }
      );

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
  async markTargetComplete(
    targetId: string,
    accessToken?: string | null
  ): Promise<boolean> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ markTargetComplete blocked - auth session not ready', { targetId });
        return false;
      }

      // First, get the target details
      const { data: target, error: fetchError } = await postgrestSelectOne<WeeklyTarget>(
        'weekly_target',
        {
          select: '*',
          target_id: `eq.${targetId}`,
          limit: 1,
        },
        { accessToken: token }
      );

      if (fetchError || !target) {
        console.error('Error fetching target for completion:', fetchError);
        return false;
      }

      // Get completed sessions count before clearing them
      const { data: sessions, error: sessionsError } = await postgrestSelect<WeeklySessionLog>(
        'weekly_session_log',
        {
          select: 'session_id',
          user_id: `eq.${target.user_id}`,
          activity_type: `eq.${target.activity_type}`,
          session_date: [
            `gte.${target.week_start_date}`,
            `lte.${target.week_end_date}`,
          ],
        },
        { accessToken: token }
      );

      if (sessionsError) {
        console.error('Error fetching session logs for completion:', sessionsError);
      }

      const completedSessions = sessions?.length || 0;
      const completionRate = target.target_sessions > 0 ? (completedSessions / target.target_sessions) * 100 : 0;

      // Clear the session logs for the completed target
      if (sessions && sessions.length > 0) {
        console.log('🗑️ Clearing', sessions.length, 'session logs for completed target');
        const { error: deleteSessionsError } = await postgrestDelete(
          'weekly_session_log',
          {
            user_id: `eq.${target.user_id}`,
            activity_type: `eq.${target.activity_type}`,
            session_date: [
              `gte.${target.week_start_date}`,
              `lte.${target.week_end_date}`,
            ],
          },
          { accessToken: token }
        );
        if (deleteSessionsError) {
          console.error('Error deleting weekly session logs:', deleteSessionsError);
        } else {
          console.log('✅ Session logs cleared for completed target');
        }
      }

      // Create history record (without foreign key reference)
      const { error: historyError } = await postgrestInsert(
        'weekly_completion_history',
        {
          user_id: target.user_id,
          activity_type: target.activity_type,
          week_start_date: target.week_start_date,
          week_end_date: target.week_end_date,
          target_sessions: target.target_sessions,
          completed_sessions: completedSessions,
          completion_rate: completionRate,
          status: 'completed',
          completion_date: new Date().toISOString(),
        },
        undefined,
        { accessToken: token, preferReturn: false }
      );

      if (historyError) {
        console.error('Error creating completion history:', historyError);
        return false;
      }

      // Delete the target completely after creating history record
      const { error: deleteError } = await postgrestDelete(
        'weekly_target',
        { target_id: `eq.${targetId}` },
        { accessToken: token }
      );

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
    notes?: string,
    accessToken?: string | null
  ): Promise<WeeklySessionLog | null> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ logSession blocked - auth session not ready', { userId });
        return null;
      }
      await userService.ensureUserById(userId, undefined, token);
      const { data, error } = await postgrestInsert<WeeklySessionLog>(
        'weekly_session_log',
        {
          user_id: userId,
          activity_type: activityType,
          session_date: sessionDate 
            ? sessionDate.toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0],
          duration_minutes: durationMinutes,
          notes: notes
        },
        { select: '*' },
        { accessToken: token }
      );

      if (error) {
        if ((error as any)?.code === '23503') {
          console.warn('⚠️ Weekly session insert failed due to missing user record; retrying once');
          await userService.ensureUserById(userId, undefined, token);
          const retry = await postgrestInsert<WeeklySessionLog>(
            'weekly_session_log',
            {
              user_id: userId,
              activity_type: activityType,
              session_date: sessionDate 
                ? sessionDate.toISOString().split('T')[0] 
                : new Date().toISOString().split('T')[0],
              duration_minutes: durationMinutes,
              notes: notes
            },
            { select: '*' },
            { accessToken: token }
          );

          if (retry.error) {
            console.error('Error logging session after retry:', retry.error);
            return null;
          }

          const retryRow = Array.isArray(retry.data) ? retry.data[0] ?? null : null;
          return retryRow;
        }

        console.error('Error logging session:', error);
        return null;
      }

      const row = Array.isArray(data) ? data[0] ?? null : null;
      return row;
    } catch (error) {
      console.error('Error in logSession:', error);
      return null;
    }
  },

  // Delete a session
  async deleteSession(sessionId: string, accessToken?: string | null): Promise<boolean> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ deleteSession blocked - auth session not ready', { sessionId });
        return false;
      }

      const { error } = await postgrestDelete(
        'weekly_session_log',
        { session_id: `eq.${sessionId}` },
        { accessToken: token }
      );

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
    activityType?: string,
    accessToken?: string | null
  ): Promise<WeeklySessionLog[]> {
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) {
        console.warn('⚠️ getSessionsForWeek blocked - auth session not ready', { userId });
        return [];
      }

      const { data, error } = await postgrestSelect<WeeklySessionLog>(
        'weekly_session_log',
        {
          select: '*',
          user_id: `eq.${userId}`,
          session_date: [
            `gte.${weekStartDate.toISOString().split('T')[0]}`,
            `lte.${weekEndDate.toISOString().split('T')[0]}`,
          ],
          activity_type: activityType ? `eq.${activityType}` : undefined,
          order: 'session_date.desc',
        },
        { accessToken: token }
      );

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

type ActivityCalendarRpcRow = {
  activity_date: string;
  total_count: number | null;
  competition_match_count: number | null;
  training_match_count: number | null;
  performance_session_count: number | null;
  performance_activity_types: string[] | null;
};

type ActivityCalendarFallbackMatchRow = {
  event_date: string | null;
  competition_id: string | null;
  match_type: string | null;
  phase: string | null;
  de_round: string | null;
};

type ActivityCalendarFallbackSessionRow = {
  session_date: string | null;
  activity_type: string | null;
};

const normalizeActivityCalendarRow = (row: ActivityCalendarRpcRow): ActivityCalendarDay | null => {
  const dateKey = normalizeDateKey(row.activity_date);
  if (!dateKey) return null;

  const competitionMatchCount = Math.max(0, Number(row.competition_match_count ?? 0) || 0);
  const trainingMatchCount = Math.max(0, Number(row.training_match_count ?? 0) || 0);
  const performanceSessionCount = Math.max(0, Number(row.performance_session_count ?? 0) || 0);
  const totalCount = Math.max(
    0,
    Number(
      row.total_count
      ?? (competitionMatchCount + trainingMatchCount + performanceSessionCount)
    )
    || (competitionMatchCount + trainingMatchCount + performanceSessionCount)
  );

  return {
    activity_date: dateKey,
    total_count: totalCount,
    competition_match_count: competitionMatchCount,
    training_match_count: trainingMatchCount,
    performance_session_count: performanceSessionCount,
    performance_activity_types: (row.performance_activity_types ?? []).filter(Boolean),
  };
};

const isCompetitionMatch = (match: ActivityCalendarFallbackMatchRow): boolean => {
  if (match.competition_id) return true;
  if (match.phase) return true;
  if (match.de_round) return true;
  if (match.match_type && match.match_type.toLowerCase() === 'competition') return true;
  return false;
};

export const activityCalendarService = {
  async getActivityCalendar(
    userId: string,
    startDate: Date,
    endDate: Date,
    timezone: string,
    accessToken?: string | null
  ): Promise<ActivityCalendarDay[]> {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      console.warn('⚠️ activityCalendarService.getActivityCalendar blocked - auth session not ready', { userId });
      return [];
    }

    const startKey = formatLocalDateKey(startDate);
    const endKey = formatLocalDateKey(endDate);
    const timezoneValue = timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const rpcResult = await postgrestRpc<ActivityCalendarRpcRow[]>(
      'get_user_activity_calendar',
      {
        p_start_date: startKey,
        p_end_date: endKey,
        p_timezone: timezoneValue,
      },
      { accessToken: token }
    );

    if (!rpcResult.error && Array.isArray(rpcResult.data)) {
      return rpcResult.data
        .map(normalizeActivityCalendarRow)
        .filter((row): row is ActivityCalendarDay => !!row)
        .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
    }

    if (rpcResult.error) {
      console.warn('⚠️ get_user_activity_calendar RPC unavailable, using client fallback', rpcResult.error);
    }

    const [matchResult, sessionResult] = await Promise.all([
      postgrestSelect<ActivityCalendarFallbackMatchRow>(
        'match',
        {
          select: 'event_date,competition_id,match_type,phase,de_round',
          user_id: `eq.${userId}`,
          is_complete: 'eq.true',
          event_date: [
            `gte.${startKey}T00:00:00`,
            `lte.${endKey}T23:59:59`,
          ],
          order: 'event_date.asc',
        },
        { accessToken: token }
      ),
      postgrestSelect<ActivityCalendarFallbackSessionRow>(
        'weekly_session_log',
        {
          select: 'session_date,activity_type',
          user_id: `eq.${userId}`,
          session_date: [
            `gte.${startKey}`,
            `lte.${endKey}`,
          ],
          order: 'session_date.asc',
        },
        { accessToken: token }
      ),
    ]);

    if (matchResult.error) {
      console.error('Error fetching matches for activity calendar fallback:', matchResult.error);
    }

    if (sessionResult.error) {
      console.error('Error fetching session logs for activity calendar fallback:', sessionResult.error);
    }

    const aggregate = new Map<
      string,
      {
        competition_match_count: number;
        training_match_count: number;
        performance_session_count: number;
        performance_activity_types: Set<string>;
      }
    >();

    (matchResult.data || []).forEach(match => {
      if (!match.event_date) return;
      const date = new Date(match.event_date);
      if (Number.isNaN(date.getTime())) return;
      const key = formatLocalDateKey(date);
      if (key < startKey || key > endKey) return;

      const existing = aggregate.get(key) || {
        competition_match_count: 0,
        training_match_count: 0,
        performance_session_count: 0,
        performance_activity_types: new Set<string>(),
      };

      if (isCompetitionMatch(match)) {
        existing.competition_match_count += 1;
      } else {
        existing.training_match_count += 1;
      }
      aggregate.set(key, existing);
    });

    (sessionResult.data || []).forEach(session => {
      const key = normalizeDateKey(session.session_date);
      if (!key || key < startKey || key > endKey) return;

      const existing = aggregate.get(key) || {
        competition_match_count: 0,
        training_match_count: 0,
        performance_session_count: 0,
        performance_activity_types: new Set<string>(),
      };
      existing.performance_session_count += 1;
      if (session.activity_type) {
        existing.performance_activity_types.add(session.activity_type);
      }
      aggregate.set(key, existing);
    });

    return Array.from(aggregate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([activity_date, value]) => ({
        activity_date,
        competition_match_count: value.competition_match_count,
        training_match_count: value.training_match_count,
        performance_session_count: value.performance_session_count,
        total_count:
          value.competition_match_count
          + value.training_match_count
          + value.performance_session_count,
        performance_activity_types: Array.from(value.performance_activity_types).sort((a, b) => a.localeCompare(b)),
      }));
  },
};

// Weekly Progress Service
export const weeklyProgressService = {
  
  // Get current week progress
  async getCurrentWeekProgress(
    userId: string,
    activityType: string,
    accessToken?: string | null
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
        weekStart,
        accessToken
      );
      
      console.log('🎯 Target fetched:', target);

      // Get completed sessions
      const sessions = await weeklySessionLogService.getSessionsForWeek(
        userId,
        weekStart,
        weekEnd,
        activityType,
        accessToken
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
      const token = resolveAccessToken();
      if (!token) {
        console.warn('⚠️ priorityAnalyticsService.getPriorityStats blocked - auth session not ready');
        return {
          totalPriorityRounds: 0,
          priorityWins: 0,
          priorityLosses: 0,
          priorityWinRate: 0
        };
      }

      // Get all match periods with priority data for the user
      const { data, error } = await postgrestSelect<any>(
        'match_period',
        {
          select: 'match_id,priority_assigned,priority_to,match!inner(user_id,fencer_1_name,fencer_2_name,event_date)',
          'match.user_id': `eq.${userId}`,
          priority_assigned: 'not.is.null',
          'match.is_complete': 'eq.true',
        },
        { accessToken: token }
      );

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
      const { data: winnerEvents, error: winnerError } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_id,scoring_user_name,event_time',
          match_id: `in.(${matchIds.join(',')})`,
          event_type: 'eq.priority_winner',
        },
        { accessToken: token }
      );

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
      const token = resolveAccessToken();
      if (!token) {
        console.warn('⚠️ priorityAnalyticsService.getPriorityPerformanceOverTime blocked - auth session not ready');
        return [];
      }

      const { data, error } = await postgrestSelect<any>(
        'match_period',
        {
          select: 'match_id,priority_assigned,priority_to,match!inner(user_id,event_date,fencer_1_name,fencer_2_name)',
          'match.user_id': `eq.${userId}`,
          priority_assigned: 'not.is.null',
          'match.is_complete': 'eq.true',
          'match.event_date': `gte.${new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()}`,
        },
        { accessToken: token }
      );

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Get priority winners
      const matchIds = data.map(mp => mp.match_id);
      const { data: winnerEvents } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_id,scoring_user_name,event_time',
          match_id: `in.(${matchIds.join(',')})`,
          event_type: 'eq.priority_winner',
        },
        { accessToken: token }
      );

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
      const token = resolveAccessToken();
      if (!token) {
        console.warn('⚠️ priorityAnalyticsService.getPriorityDurationStats blocked - auth session not ready');
        return {
          avgDurationSeconds: 0,
          minDurationSeconds: 0,
          maxDurationSeconds: 0,
          totalPriorityRounds: 0
        };
      }

      const { data, error } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_id,event_time,match!inner(user_id)',
          'match.user_id': `eq.${userId}`,
          event_type: 'in.(priority_round_start,priority_round_end)',
          order: 'event_time.asc',
        },
        { accessToken: token }
      );

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
      const token = resolveAccessToken();
      if (!token) {
        console.warn('⚠️ priorityAnalyticsService.getRecentPriorityRounds blocked - auth session not ready');
        return [];
      }

      const { data, error } = await postgrestSelect<any>(
        'match_period',
        {
          select: 'match_id,priority_assigned,priority_to,match!inner(user_id,event_date,fencer_1_name,fencer_2_name,result)',
          'match.user_id': `eq.${userId}`,
          priority_assigned: 'not.is.null',
          'match.is_complete': 'eq.true',
          order: 'match.event_date.desc',
          limit,
        },
        { accessToken: token }
      );

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Get priority winners
      const matchIds = data.map(mp => mp.match_id);
      const { data: winnerEvents } = await postgrestSelect<any>(
        'match_event',
        {
          select: 'match_id,scoring_user_name,event_time',
          match_id: `in.(${matchIds.join(',')})`,
          event_type: 'eq.priority_winner',
        },
        { accessToken: token }
      );

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

// Account deletion service
export const accountService = {
  /**
   * Delete all user data and account
   * This function deletes all user-related data from the database in the correct order
   * to handle foreign key constraints, then deletes the auth user account.
   */
  async deleteAccount(
    userId: string,
    _accessToken?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ Starting account deletion for user:', userId);
      const token = resolveAccessToken(_accessToken);
      if (!token) {
        console.warn('⚠️ accountService.deleteAccount blocked - auth session not ready');
        return { success: false, error: 'Auth session not ready' };
      }

      // Get all matches for this user first (needed for deleting related events and periods)
      const { data: userMatches, error: matchesError } = await postgrestSelect<{ match_id: string }>(
        'match',
        {
          select: 'match_id',
          user_id: `eq.${userId}`,
        },
        { accessToken: token }
      );

      if (matchesError) {
        console.error('❌ Error fetching user matches:', matchesError);
        return { success: false, error: matchesError.message };
      }

      const matchIds = userMatches?.map(m => m.match_id) || [];
      console.log(`📋 Found ${matchIds.length} matches to delete`);

      // Delete in order (handle foreign keys):
      // 1. Delete match events (by match_id or user_id)
      if (matchIds.length > 0) {
        const { error: eventsError } = await postgrestDelete(
          'match_event',
          { match_id: `in.(${matchIds.join(',')})` },
          { accessToken: token }
        );
        
        if (eventsError) {
          console.error('❌ Error deleting match events:', eventsError);
          // Continue - some events might not have match_id
        }
      } else {
        // No matches found for user; nothing to delete in match_event
      }

      // 2. Delete match periods (by match_id)
      if (matchIds.length > 0) {
        const { error: periodsError } = await postgrestDelete(
          'match_period',
          { match_id: `in.(${matchIds.join(',')})` },
          { accessToken: token }
        );
        
        if (periodsError) {
          console.error('❌ Error deleting match periods:', periodsError);
          return { success: false, error: periodsError.message };
        }
      }

      // 3. Delete matches
      const { error: matchesDeleteError } = await postgrestDelete(
        'match',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (matchesDeleteError) {
        console.error('❌ Error deleting matches:', matchesDeleteError);
        return { success: false, error: matchesDeleteError.message };
      }

      // 4. Delete weekly session logs (table has user_id, not target_id)
      const { error: sessionLogsError } = await postgrestDelete(
        'weekly_session_log',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );

      if (sessionLogsError) {
        console.error('❌ Error deleting weekly session logs:', sessionLogsError);
        // Continue - not critical
      }

      // 5. Delete weekly targets
      const { error: targetsDeleteError } = await postgrestDelete(
        'weekly_target',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (targetsDeleteError) {
        console.error('❌ Error deleting weekly targets:', targetsDeleteError);
        return { success: false, error: targetsDeleteError.message };
      }

      // 6. Delete weekly completion history
      const { error: historyError } = await postgrestDelete(
        'weekly_completion_history',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (historyError) {
        console.error('❌ Error deleting weekly completion history:', historyError);
        return { success: false, error: historyError.message };
      }

      // 7. Delete goals
      const { error: goalsError } = await postgrestDelete(
        'goal',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (goalsError) {
        console.error('❌ Error deleting goals:', goalsError);
        return { success: false, error: goalsError.message };
      }

      // 8. Delete diary entries
      const { error: diaryError } = await postgrestDelete(
        'diary_entry',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (diaryError) {
        console.error('❌ Error deleting diary entries:', diaryError);
        return { success: false, error: diaryError.message };
      }

      // 9. Delete match approvals
      const { error: approvalsError } = await postgrestDelete(
        'match_approval',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (approvalsError) {
        console.error('❌ Error deleting match approvals:', approvalsError);
        // Continue - not critical
      }

      // 10. Delete fencing remote sessions (by referee_id)
      const { error: remoteError } = await postgrestDelete(
        'fencing_remote',
        { referee_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (remoteError) {
        console.error('❌ Error deleting fencing remote sessions:', remoteError);
        // Continue - not critical
      }

      // 11. Delete user subscriptions (has ON DELETE CASCADE, but explicit for clarity)
      const { error: subscriptionsError } = await postgrestDelete(
        'user_subscriptions',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (subscriptionsError) {
        console.error('❌ Error deleting user subscriptions:', subscriptionsError);
        // Continue - might not have subscription
      }

      // 12. Delete app_user record
      const { error: appUserError } = await postgrestDelete(
        'app_user',
        { user_id: `eq.${userId}` },
        { accessToken: token }
      );
      
      if (appUserError) {
        console.error('❌ Error deleting app_user:', appUserError);
        return { success: false, error: appUserError.message };
      }

      // 13. Delete auth user account via Edge Function (service role)
      const { data: deleteAuthResult, error: authError } = await supabase.functions.invoke(
        'delete-account',
        {
          body: { userId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (authError) {
        console.error('❌ Error deleting auth user:', authError);
        return { success: false, error: `Failed to delete auth account: ${authError.message}` };
      }

      if (!deleteAuthResult || !deleteAuthResult.success) {
        const errorMsg = deleteAuthResult?.error || 'Unknown error deleting auth account';
        console.error('❌ Auth deletion failed:', errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('✅ Account deletion completed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Unexpected error during account deletion:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }
};

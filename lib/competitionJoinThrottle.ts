import AsyncStorage from '@react-native-async-storage/async-storage';

const JOIN_THROTTLE_STORAGE_KEY = 'competition_join_throttle_v1';

export const COMPETITION_JOIN_MAX_INVALID_ATTEMPTS = 5;
export const COMPETITION_JOIN_COOLDOWN_MS = 5 * 60 * 1000;

type JoinThrottleState = {
  invalidAttempts: number;
  cooldownUntil: number | null;
};

const DEFAULT_STATE: JoinThrottleState = {
  invalidAttempts: 0,
  cooldownUntil: null,
};

const readState = async (): Promise<JoinThrottleState> => {
  try {
    const stored = await AsyncStorage.getItem(JOIN_THROTTLE_STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    const parsed = JSON.parse(stored) as Partial<JoinThrottleState>;
    return {
      invalidAttempts: Number(parsed.invalidAttempts ?? 0) || 0,
      cooldownUntil:
        typeof parsed.cooldownUntil === 'number' ? parsed.cooldownUntil : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
};

const writeState = async (state: JoinThrottleState): Promise<void> => {
  try {
    await AsyncStorage.setItem(JOIN_THROTTLE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-blocking state persistence.
  }
};

const normalizeStateForNow = (state: JoinThrottleState, now: number): JoinThrottleState => {
  if (!state.cooldownUntil) {
    return state;
  }
  if (state.cooldownUntil > now) {
    return state;
  }
  return DEFAULT_STATE;
};

export const getJoinCooldownRemainingMs = async (): Promise<number> => {
  const now = Date.now();
  const state = normalizeStateForNow(await readState(), now);
  if (!state.cooldownUntil) {
    if (state !== DEFAULT_STATE) {
      await writeState(state);
    }
    return 0;
  }
  return Math.max(0, state.cooldownUntil - now);
};

export const registerInvalidJoinAttempt = async (): Promise<{
  attemptsLeft: number;
  cooldownUntil: number | null;
}> => {
  const now = Date.now();
  const state = normalizeStateForNow(await readState(), now);

  if (state.cooldownUntil && state.cooldownUntil > now) {
    return {
      attemptsLeft: 0,
      cooldownUntil: state.cooldownUntil,
    };
  }

  const nextAttempts = state.invalidAttempts + 1;
  if (nextAttempts >= COMPETITION_JOIN_MAX_INVALID_ATTEMPTS) {
    const cooldownUntil = now + COMPETITION_JOIN_COOLDOWN_MS;
    await writeState({
      invalidAttempts: 0,
      cooldownUntil,
    });
    return {
      attemptsLeft: 0,
      cooldownUntil,
    };
  }

  const nextState: JoinThrottleState = {
    invalidAttempts: nextAttempts,
    cooldownUntil: null,
  };
  await writeState(nextState);

  return {
    attemptsLeft: COMPETITION_JOIN_MAX_INVALID_ATTEMPTS - nextAttempts,
    cooldownUntil: null,
  };
};

export const resetJoinThrottle = async (): Promise<void> => {
  await writeState(DEFAULT_STATE);
};


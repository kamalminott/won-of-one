import type { User } from '@supabase/supabase-js';
import * as Updates from 'expo-updates';
import { analytics } from './analytics';
import {
  subscriptionService,
  type MatchScoringAccessResult,
  type MatchScoringAccessReason,
} from './subscriptionService';

export const MATCH_ACCESS_CHECK_TIMEOUT_MS = 2500;

export type TimedMatchAccessOutcome = 'allowed' | 'denied' | 'deferred';

export type TimedMatchAccessResult = {
  outcome: TimedMatchAccessOutcome;
  reason: MatchScoringAccessReason | 'timeout';
  durationMs: number;
  timedOut: boolean;
  accessResult: MatchScoringAccessResult | null;
};

const getResolvedUpdateChannel = () => {
  const manifest = Updates.manifest as
    | {
        extra?: {
          expoConfig?: {
            updates?: {
              requestHeaders?: Record<string, string | undefined>;
            };
          };
        };
      }
    | undefined;

  const manifestChannel =
    manifest?.extra?.expoConfig?.updates?.requestHeaders?.['expo-channel-name'] || null;

  return Updates.channel || manifestChannel;
};

export const shouldEnforceMatchPaywall = () => getResolvedUpdateChannel() === 'production';

export const buildMatchPaywallRoute = (entryPoint: string) => ({
  pathname: '/paywall' as const,
  params: {
    source: 'auto',
    gate: 'second_match_attempt',
    entryPoint,
  },
});

export const requireMatchScoringAccess = async ({
  user,
  accessToken,
  entryPoint,
  competitionMode = false,
}: {
  user?: User | null;
  accessToken?: string | null;
  entryPoint: string;
  competitionMode?: boolean;
}): Promise<MatchScoringAccessResult> => {
  if (!shouldEnforceMatchPaywall()) {
    return {
      allowed: true,
      reason: 'first_match_free',
      gateStatus: subscriptionService.getFirstMatchGateStatusFromMetadata(
        user?.user_metadata ?? null
      ),
    };
  }

  const result = await subscriptionService.getMatchScoringAccess(user, accessToken);

  if (!result.allowed) {
    analytics.capture('match_start_paywall_triggered', {
      entry_point: entryPoint,
      competition_mode: competitionMode,
      first_match_mode: result.gateStatus.firstCompletedMode,
    });
  }

  return result;
};

export const resolveTimedMatchAccess = async ({
  user,
  accessToken,
  entryPoint,
  competitionMode = false,
  timeoutMs = MATCH_ACCESS_CHECK_TIMEOUT_MS,
}: {
  user?: User | null;
  accessToken?: string | null;
  entryPoint: string;
  competitionMode?: boolean;
  timeoutMs?: number;
}): Promise<TimedMatchAccessResult> => {
  const startedAt = Date.now();
  analytics.capture('match_access_check_started', {
    entry_point: entryPoint,
    competition_mode: competitionMode,
  });

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ type: 'timeout' }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ type: 'timeout' }), timeoutMs);
  });

  try {
    const result = await Promise.race([
      requireMatchScoringAccess({
        user,
        accessToken,
        entryPoint,
        competitionMode,
      }).then((accessResult) => ({ type: 'access' as const, accessResult })),
      timeoutPromise,
    ]);

    const durationMs = Date.now() - startedAt;

    if (result.type === 'timeout') {
      analytics.capture('match_access_check_timed_out', {
        entry_point: entryPoint,
        competition_mode: competitionMode,
        duration_ms: durationMs,
        timeout_ms: timeoutMs,
      });
      return {
        outcome: 'deferred',
        reason: 'timeout',
        durationMs,
        timedOut: true,
        accessResult: null,
      };
    }

    const { accessResult } = result;

    if (accessResult.reason === 'error') {
      analytics.capture('match_access_check_failed', {
        entry_point: entryPoint,
        competition_mode: competitionMode,
        duration_ms: durationMs,
        reason: accessResult.reason,
      });
      return {
        outcome: 'deferred',
        reason: accessResult.reason,
        durationMs,
        timedOut: false,
        accessResult,
      };
    }

    const outcome: TimedMatchAccessOutcome = accessResult.allowed ? 'allowed' : 'denied';
    analytics.capture('match_access_check_completed', {
      entry_point: entryPoint,
      competition_mode: competitionMode,
      duration_ms: durationMs,
      outcome,
      reason: accessResult.reason,
    });

    if (!accessResult.allowed) {
      analytics.capture('match_access_check_denied', {
        entry_point: entryPoint,
        competition_mode: competitionMode,
        duration_ms: durationMs,
        reason: accessResult.reason,
      });
    }

    return {
      outcome,
      reason: accessResult.reason,
      durationMs,
      timedOut: false,
      accessResult,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    analytics.capture('match_access_check_failed', {
      entry_point: entryPoint,
      competition_mode: competitionMode,
      duration_ms: durationMs,
      reason: error instanceof Error ? error.message : 'unknown_error',
    });

    return {
      outcome: 'deferred',
      reason: 'error',
      durationMs,
      timedOut: false,
      accessResult: null,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

import type { User } from '@supabase/supabase-js';
import * as Updates from 'expo-updates';
import { analytics } from './analytics';
import {
  subscriptionService,
  type MatchScoringAccessResult,
} from './subscriptionService';

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

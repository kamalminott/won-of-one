import { analytics } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type RealtimeConnectionState = 'idle' | 'connecting' | 'subscribed' | 'retrying' | 'exhausted';

type RealtimeChangePayload = {
  commit_timestamp?: string;
  [key: string]: unknown;
};

type UseCompetitionRealtimeOptions = {
  competitionId?: string;
  activeMatchId?: string | null;
  enabled?: boolean;
  surface:
    | 'hub'
    | 'overview'
    | 'participants'
    | 'poules'
    | 'rankings'
    | 'de'
    | 'manual'
    | 'remote'
    | 'final_standings';
  maxRetries?: number;
  onCompetitionEvent?: (payload: RealtimeChangePayload) => void;
  onMatchEvent?: (payload: RealtimeChangePayload) => void;
  onReconnectRefetch?: () => Promise<boolean | void> | boolean | void;
};

type UseCompetitionRealtimeResult = {
  connectionState: RealtimeConnectionState;
  retryAttempt: number;
  bannerText: string | null;
  correctionNotice: string | null;
  clearCorrectionNotice: () => void;
  retryNow: () => void;
};

const BASE_BACKOFF_MS = 600;
const MAX_BACKOFF_MS = 10000;
const DEFAULT_MAX_RETRIES = 5;

const isFailureStatus = (status: string): boolean =>
  status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED';

const parseCommitTimestampMs = (payload: RealtimeChangePayload): number => {
  const raw = payload.commit_timestamp;
  if (!raw) return Date.now();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const getBackoffDelayMs = (attempt: number): number => {
  const uncapped = BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(MAX_BACKOFF_MS, uncapped);
};

export function useCompetitionRealtime(
  options: UseCompetitionRealtimeOptions
): UseCompetitionRealtimeResult {
  const {
    competitionId,
    activeMatchId,
    enabled = true,
    surface,
    onCompetitionEvent,
    onMatchEvent,
    onReconnectRefetch,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('idle');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [correctionNotice, setCorrectionNotice] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const reconnectCycleRef = useRef(false);
  const needsReconnectRefetchRef = useRef(false);
  const disconnectHandledRef = useRef(false);
  const lastCompetitionEventAtRef = useRef(0);
  const lastMatchEventAtRef = useRef(0);
  const onCompetitionEventRef = useRef(onCompetitionEvent);
  const onMatchEventRef = useRef(onMatchEvent);
  const onReconnectRefetchRef = useRef(onReconnectRefetch);

  useEffect(() => {
    onCompetitionEventRef.current = onCompetitionEvent;
  }, [onCompetitionEvent]);

  useEffect(() => {
    onMatchEventRef.current = onMatchEvent;
  }, [onMatchEvent]);

  useEffect(() => {
    onReconnectRefetchRef.current = onReconnectRefetch;
  }, [onReconnectRefetch]);

  const clearCorrectionNotice = useCallback(() => {
    setCorrectionNotice(null);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (!retryTimerRef.current) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  const retryNow = useCallback(() => {
    if (!enabled || !competitionId) return;
    clearRetryTimer();
    disconnectHandledRef.current = false;
    retryAttemptRef.current = 0;
    setRetryAttempt(0);
    setBannerText(null);
    setConnectionState('connecting');
    setRetryNonce((previous) => previous + 1);
  }, [clearRetryTimer, competitionId, enabled]);

  const hasMatchSubscription = useMemo(
    () => Boolean(enabled && competitionId && activeMatchId),
    [activeMatchId, competitionId, enabled]
  );

  useEffect(() => {
    if (!enabled || !competitionId) {
      clearRetryTimer();
      disconnectHandledRef.current = false;
      retryAttemptRef.current = 0;
      reconnectCycleRef.current = false;
      needsReconnectRefetchRef.current = false;
      setRetryAttempt(0);
      setConnectionState('idle');
      setBannerText(null);
      return;
    }

    let disposed = false;
    let competitionSubscribed = false;
    let matchSubscribed = !hasMatchSubscription;

    const competitionChannel = supabase.channel(
      `competition:${competitionId}:${surface}:${retryNonce}`
    );

    const notifyCompetitionEvent = (payload: RealtimeChangePayload) => {
      const eventTimestampMs = parseCommitTimestampMs(payload);
      if (eventTimestampMs <= lastCompetitionEventAtRef.current) {
        return;
      }
      lastCompetitionEventAtRef.current = eventTimestampMs;
      onCompetitionEventRef.current?.(payload);
    };

    competitionChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_competition',
          filter: `id=eq.${competitionId}`,
        },
        (payload) => notifyCompetitionEvent(payload as unknown as RealtimeChangePayload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_competition_participant',
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => notifyCompetitionEvent(payload as unknown as RealtimeChangePayload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_pool',
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => notifyCompetitionEvent(payload as unknown as RealtimeChangePayload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_competition_match',
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => notifyCompetitionEvent(payload as unknown as RealtimeChangePayload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_competition_ranking',
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => notifyCompetitionEvent(payload as unknown as RealtimeChangePayload)
      );

    const matchChannel =
      hasMatchSubscription && activeMatchId
        ? supabase.channel(`match:${activeMatchId}:${surface}:${retryNonce}`)
        : null;

    if (matchChannel && activeMatchId) {
      matchChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_competition_match',
          filter: `id=eq.${activeMatchId}`,
        },
        (payload) => {
          const parsedPayload = payload as unknown as RealtimeChangePayload;
          const eventTimestampMs = parseCommitTimestampMs(parsedPayload);
          if (eventTimestampMs <= lastMatchEventAtRef.current) {
            return;
          }
          lastMatchEventAtRef.current = eventTimestampMs;
          onMatchEventRef.current?.(parsedPayload);
        }
      );
    }

    const cleanupChannels = async () => {
      await Promise.all([
        supabase.removeChannel(competitionChannel),
        matchChannel ? supabase.removeChannel(matchChannel) : Promise.resolve('ok'),
      ]);
    };

    const finalizeSubscribed = () => {
      if (!competitionSubscribed || !matchSubscribed || disposed) {
        return;
      }

      setConnectionState('subscribed');
      setBannerText(null);

      if (reconnectCycleRef.current || needsReconnectRefetchRef.current) {
        analytics.capture('competition_realtime_reconnected', {
          competition_id: competitionId,
          match_id: activeMatchId ?? null,
          surface,
          attempts: retryAttemptRef.current,
        });

        reconnectCycleRef.current = false;
        retryAttemptRef.current = 0;
        setRetryAttempt(0);

        if (needsReconnectRefetchRef.current && onReconnectRefetchRef.current) {
          needsReconnectRefetchRef.current = false;
          void Promise.resolve(onReconnectRefetchRef.current())
            .then((wasCorrected) => {
              if (!wasCorrected || disposed) return;
              setCorrectionNotice('Score updated from live feed.');
            })
            .catch(() => {
              // Keep realtime connected even if refetch callback fails.
            });
        } else {
          needsReconnectRefetchRef.current = false;
        }
      }
    };

    const scheduleReconnect = (status: string, channelScope: 'competition' | 'match') => {
      if (disposed || disconnectHandledRef.current) {
        return;
      }
      disconnectHandledRef.current = true;
      reconnectCycleRef.current = true;
      needsReconnectRefetchRef.current = true;

      const nextAttempt = retryAttemptRef.current + 1;
      retryAttemptRef.current = nextAttempt;
      setRetryAttempt(nextAttempt);

      analytics.capture('competition_realtime_disconnected', {
        competition_id: competitionId,
        match_id: activeMatchId ?? null,
        surface,
        channel_scope: channelScope,
        attempt: nextAttempt,
        status,
      });

      if (nextAttempt > maxRetries) {
        setConnectionState('exhausted');
        setBannerText('Live updates paused. Tap Retry to reconnect.');
        analytics.capture('competition_realtime_retry_exhausted', {
          competition_id: competitionId,
          match_id: activeMatchId ?? null,
          surface,
          max_retries: maxRetries,
        });
        return;
      }

      const delayMs = getBackoffDelayMs(nextAttempt);
      setConnectionState('retrying');
      setBannerText(`Reconnecting live updates (${nextAttempt}/${maxRetries})...`);

      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        if (disposed) return;
        disconnectHandledRef.current = false;
        setRetryNonce((previous) => previous + 1);
      }, delayMs);
    };

    setConnectionState(retryAttemptRef.current > 0 ? 'retrying' : 'connecting');

    competitionChannel.subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        competitionSubscribed = true;
        finalizeSubscribed();
        return;
      }

      if (isFailureStatus(status)) {
        void cleanupChannels();
        scheduleReconnect(status, 'competition');
      }
    });

    if (matchChannel) {
      matchChannel.subscribe((status) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          matchSubscribed = true;
          finalizeSubscribed();
          return;
        }

        if (isFailureStatus(status)) {
          void cleanupChannels();
          scheduleReconnect(status, 'match');
        }
      });
    }

    return () => {
      disposed = true;
      clearRetryTimer();
      void cleanupChannels();
    };
  }, [
    activeMatchId,
    clearRetryTimer,
    competitionId,
    enabled,
    hasMatchSubscription,
    maxRetries,
    retryNonce,
    surface,
  ]);

  return {
    connectionState,
    retryAttempt,
    bannerText,
    correctionNotice,
    clearCorrectionNotice,
    retryNow,
  };
}

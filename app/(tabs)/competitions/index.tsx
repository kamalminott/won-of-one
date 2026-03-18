import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_ROLE_LABELS,
  COMPETITION_STATUS_COLORS,
  COMPETITION_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { listCompetitionSummariesForUser } from '@/lib/clubCompetitionService';
import { supabase } from '@/lib/supabase';
import type { CompetitionSummary } from '@/types/competition';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CompetitionsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user, loading: authLoading, authReady, retryAuthHydration } = useAuth();

  const [activeCompetitions, setActiveCompetitions] = useState<CompetitionSummary[]>([]);
  const [pastCompetitions, setPastCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [realtimeBannerText, setRealtimeBannerText] = useState<string | null>(null);
  const hasLoadedCompetitionsSuccessfullyRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const realtimeRetryAttemptRef = useRef(0);
  const realtimeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeLastEventMsRef = useRef(0);
  const realtimeReconnectRef = useRef(false);
  const realtimeDisconnectHandledRef = useRef(false);
  const [realtimeNonce, setRealtimeNonce] = useState(0);

  const loadCompetitions = useCallback(async (options?: { forceBlockingLoader?: boolean }) => {
    const forceBlockingLoader = options?.forceBlockingLoader ?? false;

    if (authLoading || !authReady) {
      return;
    }

    if (!user?.id) {
      setActiveCompetitions([]);
      setPastCompetitions([]);
      setErrorText(null);
      setLoading(false);
      return;
    }

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const shouldBlock = forceBlockingLoader || !hasLoadedCompetitionsSuccessfullyRef.current;
    const canAttemptRecovery = !hasLoadedCompetitionsSuccessfullyRef.current;

    try {
      if (shouldBlock) {
        setLoading(true);
      }
      setErrorText(null);
      let summaries: Awaited<ReturnType<typeof listCompetitionSummariesForUser>>;

      try {
        summaries = await listCompetitionSummariesForUser(user.id);
      } catch (error) {
        if (!canAttemptRecovery) {
          throw error;
        }

        console.warn(
          'Competition hub initial load failed; retrying after auth rehydrate:',
          error
        );
        await retryAuthHydration();
        summaries = await listCompetitionSummariesForUser(user.id);
      }

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setActiveCompetitions(summaries.active);
      setPastCompetitions(summaries.past);
      hasLoadedCompetitionsSuccessfullyRef.current = true;
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      console.warn('Competition hub load failed:', error);
      if (!hasLoadedCompetitionsSuccessfullyRef.current) {
        setActiveCompetitions([]);
        setPastCompetitions([]);
      }
      setErrorText('Could not load competitions. Pull to refresh and try again.');
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [authLoading, authReady, retryAuthHydration, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !authReady) {
        setLoading(true);
        return;
      }

      if (!user?.id) {
        setActiveCompetitions([]);
        setPastCompetitions([]);
        setErrorText(null);
        setLoading(false);
        return;
      }

      analytics.capture('competition_hub_viewed');
      void loadCompetitions();
    }, [authLoading, authReady, loadCompetitions, user?.id])
  );

  useEffect(() => {
    if (authLoading || !authReady || !user?.id) {
      if (realtimeRetryTimerRef.current) {
        clearTimeout(realtimeRetryTimerRef.current);
        realtimeRetryTimerRef.current = null;
      }
      realtimeRetryAttemptRef.current = 0;
      realtimeDisconnectHandledRef.current = false;
      setRealtimeBannerText(null);
      if (authLoading || !authReady) {
        setLoading(true);
      } else {
        setActiveCompetitions([]);
        setPastCompetitions([]);
        setErrorText(null);
        setLoading(false);
      }
      return;
    }

    let disposed = false;
    const channel = supabase.channel(`competition-hub:${user.id}:${realtimeNonce}`);

    const onHubChange = (payload: { commit_timestamp?: string }) => {
      const parsed = payload.commit_timestamp ? Date.parse(payload.commit_timestamp) : Date.now();
      const eventMs = Number.isFinite(parsed) ? parsed : Date.now();
      if (eventMs <= realtimeLastEventMsRef.current) {
        return;
      }
      realtimeLastEventMsRef.current = eventMs;
      void loadCompetitions();
    };

    const scheduleReconnect = (status: string) => {
      if (disposed || realtimeDisconnectHandledRef.current) {
        return;
      }

      realtimeDisconnectHandledRef.current = true;
      realtimeReconnectRef.current = true;
      const nextAttempt = realtimeRetryAttemptRef.current + 1;
      realtimeRetryAttemptRef.current = nextAttempt;

      analytics.capture('competition_realtime_disconnected', {
        competition_id: null,
        match_id: null,
        surface: 'hub',
        channel_scope: 'competition',
        attempt: nextAttempt,
        status,
      });

      if (nextAttempt > 5) {
        setRealtimeBannerText('Live updates paused. Tap Retry to reconnect.');
        analytics.capture('competition_realtime_retry_exhausted', {
          competition_id: null,
          match_id: null,
          surface: 'hub',
          max_retries: 5,
        });
        return;
      }

      const delayMs = Math.min(10000, 600 * 2 ** Math.max(0, nextAttempt - 1));
      setRealtimeBannerText(`Reconnecting live updates (${nextAttempt}/5)...`);
      if (realtimeRetryTimerRef.current) {
        clearTimeout(realtimeRetryTimerRef.current);
      }
      realtimeRetryTimerRef.current = setTimeout(() => {
        if (disposed) return;
        realtimeDisconnectHandledRef.current = false;
        setRealtimeNonce((previous) => previous + 1);
      }, delayMs);
    };

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_competition_participant',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => onHubChange(payload as { commit_timestamp?: string })
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_competition',
        },
        (payload) => onHubChange(payload as { commit_timestamp?: string })
      );

    channel.subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        realtimeDisconnectHandledRef.current = false;
        if (realtimeRetryTimerRef.current) {
          clearTimeout(realtimeRetryTimerRef.current);
          realtimeRetryTimerRef.current = null;
        }
        if (realtimeReconnectRef.current) {
          analytics.capture('competition_realtime_reconnected', {
            competition_id: null,
            match_id: null,
            surface: 'hub',
            attempts: realtimeRetryAttemptRef.current,
          });
          realtimeReconnectRef.current = false;
          void loadCompetitions();
        }
        realtimeRetryAttemptRef.current = 0;
        setRealtimeBannerText(null);
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        void supabase.removeChannel(channel);
        scheduleReconnect(status);
      }
    });

    return () => {
      disposed = true;
      if (realtimeRetryTimerRef.current) {
        clearTimeout(realtimeRetryTimerRef.current);
        realtimeRetryTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [authLoading, authReady, loadCompetitions, realtimeNonce, user?.id]);

  const onRetryRealtime = () => {
    realtimeRetryAttemptRef.current = 0;
    realtimeDisconnectHandledRef.current = false;
    if (realtimeRetryTimerRef.current) {
      clearTimeout(realtimeRetryTimerRef.current);
      realtimeRetryTimerRef.current = null;
    }
    setRealtimeBannerText(null);
    setRealtimeNonce((previous) => previous + 1);
  };

  const onRefresh = async () => {
    if (authLoading || !authReady || !user?.id) {
      return;
    }
    setRefreshing(true);
    await loadCompetitions();
    setRefreshing(false);
  };

  const hasActive = activeCompetitions.length > 0;
  const hasPast = pastCompetitions.length > 0;
  const hasRenderableData = hasActive || hasPast;
  const showBlockingLoader =
    loading && !hasLoadedCompetitionsSuccessfullyRef.current && !hasRenderableData;
  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 16;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: contentBottomPadding,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.purple.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Competition Hub</Text>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => router.push('/(tabs)/competitions/create')}
            style={[styles.actionButton, styles.primaryButton]}
          >
            <Text style={styles.primaryButtonText}>Create Competition</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/competitions/join')}
            style={[styles.actionButton, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Join</Text>
          </Pressable>
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        <CompetitionRealtimeBanner
          bannerText={realtimeBannerText}
          onRetry={onRetryRealtime}
        />
        {loading && hasRenderableData ? (
          <InlineLoadingNotice text="Refreshing competitions..." />
        ) : null}

        {showBlockingLoader ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.purple.primary} />
            {!authReady ? (
              <Text style={styles.loadingText}>Syncing your session...</Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active</Text>
              {hasActive ? (
                activeCompetitions.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                  />
                ))
              ) : (
                <EmptyState text="No active competitions yet." />
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Past</Text>
              {hasPast ? (
                pastCompetitions.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                  />
                ))
              ) : (
                <EmptyState text="No past competitions yet." />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CompetitionCard({ competition }: { competition: CompetitionSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        analytics.capture('competition_opened', {
          competition_id: competition.id,
          status: competition.status,
        });
        router.push({
          pathname: '/(tabs)/competitions/overview',
          params: {
            competitionId: competition.id,
          },
        });
      }}
      style={styles.card}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle}>{competition.name}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: COMPETITION_STATUS_COLORS[competition.status] },
          ]}
        >
          <Text style={styles.statusText}>
            {COMPETITION_STATUS_LABELS[competition.status]}
          </Text>
        </View>
      </View>

      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>
          {competition.weapon.toUpperCase()} • {competition.participantCount}{' '}
          participants
        </Text>
        <Text style={styles.roleText}>
          {COMPETITION_ROLE_LABELS[competition.role]}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function InlineLoadingNotice({ text }: { text: string }) {
  return (
    <View style={styles.inlineLoadingNotice}>
      <ActivityIndicator color={Colors.purple.primary} size="small" />
      <Text style={styles.inlineLoadingText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.purple.primary,
    flex: 1.6,
  },
  secondaryButton: {
    backgroundColor: '#212121',
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.4)',
    flex: 1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#E9D7FF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#9D9D9D',
    fontSize: 13,
    fontWeight: '500',
  },
  inlineLoadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.18)',
    backgroundColor: '#191919',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  inlineLoadingText: {
    color: '#C9C9C9',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.2)',
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    color: '#9D9D9D',
    fontSize: 13,
    fontWeight: '500',
  },
  roleText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    padding: 14,
  },
  emptyText: {
    color: '#9D9D9D',
    fontSize: 14,
  },
  errorText: {
    color: '#FF7675',
    fontSize: 13,
    marginBottom: 12,
  },
});

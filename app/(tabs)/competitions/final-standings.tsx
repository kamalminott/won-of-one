import { BackButton } from '@/components/BackButton';
import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_PARTICIPANT_STATUS_COLORS,
  COMPETITION_PARTICIPANT_STATUS_LABELS,
  COMPETITION_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import { analytics } from '@/lib/analytics';
import { getCompetitionFinalStandingsData } from '@/lib/clubCompetitionService';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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

const MEDAL_META = {
  gold: { emoji: '🥇', label: 'Gold', color: '#D97706' },
  silver: { emoji: '🥈', label: 'Silver', color: '#94A3B8' },
  bronze: { emoji: '🥉', label: 'Bronze', color: '#B45309' },
} as const;

export default function FinalStandingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ competitionId?: string }>();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCompetitionFinalStandingsData>>>(
    null
  );
  const standingsVersionRef = useRef('');

  const loadData = useCallback(
    async (showSpinner = true): Promise<string | null> => {
      if (!user?.id || !competitionId) {
        setLoading(false);
        setData(null);
        setErrorText('Competition was not found.');
        standingsVersionRef.current = '';
        return null;
      }

      if (showSpinner) {
        setLoading(true);
      }
      setErrorText(null);

      const payload = await getCompetitionFinalStandingsData({
        userId: user.id,
        competitionId,
      });

      if (!payload) {
        setData(null);
        setLoading(false);
        setRefreshing(false);
        setErrorText('You do not have access to this competition.');
        standingsVersionRef.current = '';
        return null;
      }

      setData(payload);
      const version = `${payload.competition.updated_at}:${payload.competition.status}:${payload.standings
        .map(
          (entry) =>
            `${entry.participant.id}:${entry.positionLabel}:${entry.medal ?? 'none'}:${entry.deExitRoundLabel ?? 'none'}:${entry.participant.status}`
        )
        .join('|')}`;
      standingsVersionRef.current = version;
      setLoading(false);
      setRefreshing(false);
      return version;
    },
    [competitionId, user?.id]
  );

  const {
    bannerText: realtimeBannerText,
    correctionNotice: realtimeCorrectionNotice,
    clearCorrectionNotice,
    retryNow: retryRealtime,
  } = useCompetitionRealtime({
    competitionId,
    enabled: Boolean(user?.id && competitionId),
    surface: 'final_standings',
    onCompetitionEvent: () => {
      void loadData(false);
    },
    onReconnectRefetch: async () => {
      const before = standingsVersionRef.current;
      const after = await loadData(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      analytics.capture('final_standings_viewed', {
        competition_id: competitionId,
      });
      void loadData(true);
    }, [competitionId, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;

  const standingsCountText = useMemo(() => {
    if (!data) return '';
    return `${data.standings.length} participants`;
  }, [data]);

  const onBack = () => {
    if (!competitionId) {
      router.replace('/(tabs)/competitions');
      return;
    }
    router.replace({
      pathname: '/(tabs)/competitions/overview',
      params: { competitionId },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.purple.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{errorText ?? 'Final standings unavailable.'}</Text>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Overview</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
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
        <View style={styles.backRow}>
          <BackButton
            onPress={onBack}
            style={styles.backIconButton}
          />
        </View>

        <Text style={styles.title}>Final Standings</Text>
        <CompetitionRealtimeBanner
          bannerText={realtimeBannerText}
          correctionNotice={realtimeCorrectionNotice}
          onRetry={retryRealtime}
          onDismissCorrection={clearCorrectionNotice}
        />
        <Text style={styles.subtitle}>
          {data.competition.name} • {COMPETITION_STATUS_LABELS[data.competition.status]}
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {data.isProvisional ? 'Provisional Standings' : 'Final Standings'}
          </Text>
          <Text style={styles.metaText}>{standingsCountText}</Text>
          <Text style={styles.noteText}>
            Bronze medals: two participants can finish in 3rd place.
          </Text>
        </View>

        <View style={styles.card}>
          {data.standings.length === 0 ? (
            <Text style={styles.emptyText}>No standings available yet.</Text>
          ) : (
            data.standings.map((entry) => {
              const medalMeta = entry.medal ? MEDAL_META[entry.medal] : null;
              const positionChipText =
                entry.position != null ? `#${entry.position}` : entry.positionLabel;
              const detailSegments: string[] = [];

              if (entry.deExitRoundLabel === 'Champion') {
                detailSegments.push('Competition winner');
              } else if (entry.deExitRoundLabel) {
                detailSegments.push(`Eliminated in ${entry.deExitRoundLabel}`);
              } else if (entry.isPending) {
                detailSegments.push('Still in contention');
              }

              if (entry.seedRank != null) {
                detailSegments.push(`Seed ${entry.seedRank}`);
              }

              if (entry.participant.status !== 'active') {
                detailSegments.push(
                  COMPETITION_PARTICIPANT_STATUS_LABELS[entry.participant.status]
                );
              }

              return (
                <View
                  key={entry.participant.id}
                  style={[
                    styles.row,
                    medalMeta && styles.medalRow,
                    entry.participant.isSelf && styles.selfRow,
                  ]}
                >
                  <View style={styles.rowLeft}>
                    <View
                      style={[
                        styles.positionChip,
                        medalMeta && { backgroundColor: medalMeta.color },
                      ]}
                    >
                      <Text style={styles.positionChipText}>
                        {medalMeta ? medalMeta.emoji : positionChipText}
                      </Text>
                    </View>
                    <View style={styles.nameWrap}>
                      <View style={styles.nameRow}>
                        <Text style={styles.nameText}>{entry.participant.display_name}</Text>
                        {entry.participant.isSelf ? (
                          <View style={styles.selfBadge}>
                            <Text style={styles.selfBadgeText}>You</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.detailText}>
                        {detailSegments.length > 0 ? detailSegments.join(' • ') : ' '}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowRight}>
                    <Text style={styles.rankValue}>{positionChipText}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            COMPETITION_PARTICIPANT_STATUS_COLORS[entry.participant.status],
                        },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {COMPETITION_PARTICIPANT_STATUS_LABELS[entry.participant.status]}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  backRow: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#1F1F1F',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#9D9D9D',
    fontSize: 13,
    marginBottom: 2,
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.24)',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    color: '#A9A9A9',
    fontSize: 13,
  },
  noteText: {
    color: '#E9D7FF',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyText: {
    color: '#A0A0A0',
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    backgroundColor: '#171717',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  medalRow: {
    borderColor: 'rgba(250,204,21,0.4)',
    backgroundColor: 'rgba(250,204,21,0.08)',
  },
  selfRow: {
    borderColor: 'rgba(139,92,246,0.55)',
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  positionChip: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#313131',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  nameWrap: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  selfBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.45)',
    backgroundColor: 'rgba(200,166,255,0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  selfBadgeText: {
    color: '#EBD8FF',
    fontSize: 10,
    fontWeight: '700',
  },
  detailText: {
    color: '#A9A9A9',
    fontSize: 12,
    lineHeight: 17,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rankValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF7675',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#D8D8D8',
    fontSize: 14,
    fontWeight: '600',
  },
});

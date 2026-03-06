import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_ROLE_LABELS,
  COMPETITION_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import {
  generateCompetitionDeTableau,
  getCompetitionRankingsData,
  lockCompetitionRankings,
} from '@/lib/clubCompetitionService';
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RankingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ competitionId?: string }>();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<'lock' | 'generate' | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCompetitionRankingsData>>>(null);
  const rankingsVersionRef = useRef('');

  const loadData = useCallback(
    async (showSpinner = true): Promise<string | null> => {
      if (!user?.id || !competitionId) {
        setLoading(false);
        setData(null);
        setErrorText('Competition was not found.');
        rankingsVersionRef.current = '';
        return null;
      }

      if (showSpinner) {
        setLoading(true);
      }
      setErrorText(null);

      const payload = await getCompetitionRankingsData({
        userId: user.id,
        competitionId,
      });

      if (!payload) {
        setData(null);
        setLoading(false);
        setRefreshing(false);
        setErrorText('You do not have access to this competition.');
        rankingsVersionRef.current = '';
        return null;
      }

      setData(payload);
      const version = `${payload.competition.updated_at}:${payload.competition.status}:${payload.rankings
        .map(
          (entry) =>
            `${entry.participant.id}:${entry.ranking.rank}:${entry.ranking.wins}:${entry.ranking.losses}:${entry.ranking.indicator}:${entry.ranking.hits_scored}:${entry.ranking.hits_received}`
        )
        .join('|')}`;
      rankingsVersionRef.current = version;
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
    surface: 'rankings',
    onCompetitionEvent: () => {
      void loadData(false);
    },
    onReconnectRefetch: async () => {
      const before = rankingsVersionRef.current;
      const after = await loadData(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      analytics.capture('rankings_viewed', {
        competition_id: competitionId,
      });
      void loadData(true);
    }, [competitionId, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const onLockRankings = () => {
    if (!data) return;
    Alert.alert(
      'Lock rankings?',
      'This freezes ranking order and blocks further poule score edits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          onPress: async () => {
            setActionKey('lock');
            const result = await lockCompetitionRankings({
              competitionId: data.competition.id,
            });
            setActionKey(null);
            if (!result.ok) {
              setErrorText(result.message);
              return;
            }

            analytics.capture('rankings_locked', {
              competition_id: data.competition.id,
            });

            await loadData(true);
          },
        },
      ]
    );
  };

  const onGenerateDe = () => {
    if (!data) return;
    Alert.alert(
      'Generate DE tableau?',
      'This creates the seeded elimination bracket and applies automatic byes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate DE',
          onPress: async () => {
            setActionKey('generate');
            const result = await generateCompetitionDeTableau({
              competitionId: data.competition.id,
            });
            setActionKey(null);
            if (!result.ok) {
              setErrorText(result.message);
              return;
            }

            analytics.capture('de_generated', {
              competition_id: data.competition.id,
              participant_count: result.data.participant_count,
              bracket_size: result.data.bracket_size,
              match_count: result.data.match_count,
            });

            await loadData(true);
            router.push({
              pathname: '/(tabs)/competitions/de-tableau',
              params: { competitionId: data.competition.id },
            });
          },
        },
      ]
    );
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
        <Text style={styles.errorText}>{errorText ?? 'Rankings data unavailable.'}</Text>
        <Pressable
          onPress={() => router.replace('/(tabs)/competitions')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Hub</Text>
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
            paddingBottom: insets.bottom + 20,
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
        <Text style={styles.title}>Rankings</Text>
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
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.metaText}>
            {data.competition.weapon.toUpperCase()} • {COMPETITION_ROLE_LABELS[data.currentUserRole]}
          </Text>
          <Text style={styles.metaText}>{data.tieBreakCaption}</Text>
          {data.hasWithdrawalAdjustments ? (
            <Text style={styles.noteText}>
              Withdrawal annulments applied: bouts involving withdrawn fencers are excluded.
            </Text>
          ) : null}

          {data.currentUserRole === 'organiser' ? (
            <View style={styles.controlWrap}>
              {data.canLockRankings ? (
                <ActionButton
                  text="Lock Rankings"
                  onPress={onLockRankings}
                  loading={actionKey === 'lock'}
                  disabled={actionKey === 'generate'}
                  primary
                />
              ) : null}
              {data.canGenerateDe ? (
                <ActionButton
                  text="Generate DE"
                  onPress={onGenerateDe}
                  loading={actionKey === 'generate'}
                  disabled={actionKey === 'lock'}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Standings</Text>
          {data.rankings.length === 0 ? (
            <Text style={styles.emptyText}>No ranking data yet.</Text>
          ) : (
            data.rankings.map((entry) => {
              const { ranking, participant } = entry;
              return (
                <View
                  key={participant.id}
                  style={styles.row}
                >
                  <View style={styles.rowLeft}>
                    <Text style={styles.rankValue}>#{ranking.rank}</Text>
                    <View>
                      <Text style={styles.nameText}>{participant.display_name}</Text>
                      <Text style={styles.subMetaText}>
                        W {ranking.wins} • L {ranking.losses} • IND {ranking.indicator}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.statText}>HS {ranking.hits_scored}</Text>
                    <Text style={styles.statText}>HR {ranking.hits_received}</Text>
                    <Text style={styles.statText}>Win% {(ranking.win_pct * 100).toFixed(1)}</Text>
                    {participant.status === 'withdrawn' ? (
                      <Text style={styles.withdrawnText}>Withdrawn</Text>
                    ) : null}
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

function ActionButton({
  text,
  onPress,
  disabled,
  loading = false,
  primary = false,
}: {
  text: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.actionButton,
        primary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        (disabled || loading) && styles.actionButtonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : '#E9D7FF'} size="small" />
      ) : (
        <Text
          style={[
            styles.actionButtonText,
            primary ? styles.actionButtonTextPrimary : styles.actionButtonTextSecondary,
          ]}
        >
          {text}
        </Text>
      )}
    </Pressable>
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
    lineHeight: 17,
  },
  controlWrap: {
    marginTop: 4,
    gap: 8,
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.purple.primary,
  },
  actionButtonSecondary: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.45)',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  actionButtonTextSecondary: {
    color: '#E9D7FF',
  },
  row: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    backgroundColor: '#171717',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 86,
  },
  rankValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 36,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  subMetaText: {
    color: '#A9A9A9',
    fontSize: 12,
    marginTop: 2,
  },
  statText: {
    color: '#D7D7D7',
    fontSize: 12,
    fontWeight: '600',
  },
  withdrawnText: {
    color: '#FF7675',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    color: '#9D9D9D',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#FF7675',
    fontSize: 13,
    lineHeight: 18,
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

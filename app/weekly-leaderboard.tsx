import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { getCountryDisplay } from '@/lib/countryUtils';
import { matchService } from '@/lib/database';
import { formatUtcResetCountdown, formatUtcWeekRange, getUtcWeekWindow } from '@/lib/weeklyLeaderboard';
import { WeeklyLeaderboardData, WeeklyLeaderboardEntry, WeeklyLeaderboardMetricData } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LEADERBOARD_PAGE_LIMIT = 50;

type LeaderboardMetric = 'wins' | 'matches';
type LeaderboardPeriod = 'weekly' | 'allTime';

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }
  return `${words[0].slice(0, 1)}${words[words.length - 1].slice(0, 1)}`.toUpperCase();
};

const getMetricValue = (entry: WeeklyLeaderboardEntry, metric: LeaderboardMetric) =>
  metric === 'wins' ? entry.wins : entry.matchesPlayed;

const getMetricLabel = (metric: LeaderboardMetric) =>
  metric === 'wins' ? 'Wins' : 'Matches';

const getMetricLabelLower = (metric: LeaderboardMetric) =>
  metric === 'wins' ? 'wins' : 'matches';

const getMedalColor = (rank: number) => {
  switch (rank) {
    case 1:
      return '#F5C451';
    case 2:
      return '#C7CEDA';
    case 3:
      return '#D18A5B';
    default:
      return '#FFFFFF';
  }
};

const getPodiumGradient = (rank: number): [string, string] => {
  switch (rank) {
    case 1:
      return ['#A68BFF', '#6C5CE7'];
    case 2:
      return ['#8A7DE2', '#5D50BB'];
    case 3:
      return ['#7B69D8', '#5147A6'];
    default:
      return ['#6C5CE7', '#5D50BB'];
  }
};

export default function WeeklyLeaderboardScreen() {
  const { width, height } = useWindowDimensions();
  const { user, session } = useAuth();
  const [leaderboard, setLeaderboard] = useState<WeeklyLeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [activeMetric, setActiveMetric] = useState<LeaderboardMetric>('wins');
  const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod>('weekly');

  useEffect(() => {
    analytics.screen('Weekly Leaderboard');
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    if (!user?.id) {
      setLeaderboard(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await matchService.getGlobalWeeklyLeaderboard(
        LEADERBOARD_PAGE_LIMIT,
        session?.access_token
      );
      setLeaderboard(data);
    } catch (error) {
      console.warn('Failed to load leaderboard screen:', error);
      setLeaderboard(null);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const fallbackWeekWindow = getUtcWeekWindow(now);
  const countdownText = formatUtcResetCountdown(
    leaderboard?.nextResetUtc ?? fallbackWeekWindow.nextResetUtc,
    now
  );
  const weekRangeText = leaderboard
    ? formatUtcWeekRange(leaderboard.weekStartUtc, leaderboard.nextResetUtc)
    : formatUtcWeekRange(fallbackWeekWindow.weekStartUtc, fallbackWeekWindow.nextResetUtc);

  const activeMetricData: WeeklyLeaderboardMetricData | null = activePeriod === 'weekly'
    ? (activeMetric === 'wins' ? leaderboard?.winsLeaderboard ?? null : leaderboard?.matchesLeaderboard ?? null)
    : (activeMetric === 'wins'
      ? leaderboard?.allTimeWinsLeaderboard ?? null
      : leaderboard?.allTimeMatchesLeaderboard ?? null);

  const totalRankedUsers = activePeriod === 'weekly'
    ? leaderboard?.totalRankedUsers ?? 0
    : leaderboard?.allTimeTotalRankedUsers ?? 0;

  const activeEntries = activeMetricData?.entries ?? [];
  const currentUserEntry = activeMetricData?.currentUserEntry ?? null;
  const isCurrentUserInTopThree = !!currentUserEntry && currentUserEntry.rank <= 3;
  const standingEntries = activeEntries.filter((entry) => entry.rank > 3);
  const shouldAppendCurrentUser = !!currentUserEntry
    && currentUserEntry.rank > 3
    && !standingEntries.some((entry) => entry.userId === currentUserEntry.userId);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerSafeArea: {
      backgroundColor: 'rgba(33, 33, 33, 1)',
    },
    stickyHeader: {
      backgroundColor: 'rgba(33, 33, 33, 1)',
      paddingHorizontal: width * 0.05,
      paddingTop: height * 0.004,
      paddingBottom: height * 0.018,
      flexDirection: 'row',
      alignItems: 'center',
    },
    contentSafeArea: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    headerSide: {
      width: width * 0.14,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerSideSpacer: {
      width: width * 0.14,
    },
    headerCopy: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
    },
    title: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.055,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    scrollContent: {
      paddingHorizontal: width * 0.05,
      paddingTop: height * 0.016,
      paddingBottom: height * 0.06,
      gap: height * 0.018,
    },
    sectionShell: {
      backgroundColor: '#1D1D1D',
      borderRadius: width * 0.05,
      borderWidth: 1,
      borderColor: '#2E2E2E',
      overflow: 'hidden',
    },
    periodTabsShell: {
      backgroundColor: '#262626',
      borderRadius: width * 0.045,
      padding: width * 0.012,
      flexDirection: 'row',
      gap: width * 0.02,
    },
    periodTabButton: {
      flex: 1,
      borderRadius: width * 0.035,
      paddingVertical: height * 0.013,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodTabButtonActive: {
      backgroundColor: '#FFFFFF',
    },
    periodTabText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.033,
      color: 'rgba(255, 255, 255, 0.72)',
    },
    periodTabTextActive: {
      color: '#6C5CE7',
    },
    positionShell: {
      borderRadius: width * 0.05,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(108, 92, 231, 0.55)',
      backgroundColor: '#1D1D1D',
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: width * 0.035,
      elevation: 8,
    },
    positionGradient: {
      paddingHorizontal: width * 0.05,
      paddingVertical: height * 0.02,
      gap: height * 0.014,
    },
    positionTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: width * 0.03,
    },
    positionHeading: {
      flex: 1,
    },
    positionEyebrow: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.028,
      color: Colors.purple.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.85,
      marginBottom: height * 0.004,
    },
    positionTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.042,
      color: '#FFFFFF',
      marginBottom: height * 0.003,
    },
    positionRange: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.03,
      color: 'rgba(196, 181, 253, 0.88)',
    },
    positionPill: {
      backgroundColor: 'rgba(108, 92, 231, 0.38)',
      borderRadius: width * 0.035,
      paddingHorizontal: width * 0.034,
      paddingVertical: height * 0.008,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: 'rgba(196, 181, 253, 0.55)',
    },
    positionPillText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.028,
      color: '#F5F0FF',
    },
    positionStats: {
      flexDirection: 'row',
      gap: width * 0.03,
    },
    positionStatCard: {
      flex: 1,
      backgroundColor: 'rgba(108, 92, 231, 0.22)',
      borderRadius: width * 0.04,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.016,
      borderWidth: 1,
      borderColor: 'rgba(167, 139, 250, 0.45)',
    },
    positionStatLabel: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.027,
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: height * 0.005,
    },
    positionStatValue: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.052,
      color: '#FFFFFF',
      letterSpacing: -0.4,
    },
    positionCaption: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.031,
      color: 'rgba(233, 228, 255, 0.88)',
      lineHeight: width * 0.044,
    },
    metricTabsShell: {
      backgroundColor: '#1D1D1D',
      borderRadius: width * 0.05,
      borderWidth: 1,
      borderColor: '#2E2E2E',
      padding: width * 0.014,
      flexDirection: 'row',
      gap: width * 0.024,
    },
    metricTabButton: {
      flex: 1,
      borderRadius: width * 0.04,
      paddingVertical: height * 0.013,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    metricTabButtonActive: {
      backgroundColor: '#FFFFFF',
      borderColor: '#FFFFFF',
    },
    metricTabText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.032,
      color: '#FFFFFF',
    },
    metricTabTextActive: {
      color: '#6C5CE7',
    },
    podiumShell: {
      backgroundColor: '#1D1D1D',
      borderRadius: width * 0.05,
      borderWidth: 1,
      borderColor: '#2E2E2E',
      paddingHorizontal: width * 0.05,
      paddingTop: height * 0.02,
      paddingBottom: height * 0.024,
    },
    podiumHeader: {
      marginBottom: height * 0.02,
    },
    sectionEyebrow: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.027,
      color: 'rgba(255, 255, 255, 0.54)',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: height * 0.004,
    },
    sectionTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.042,
      color: '#FFFFFF',
      marginBottom: height * 0.003,
    },
    sectionSubtitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.66)',
    },
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: width * 0.03,
    },
    podiumSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    podiumSlotCenter: {
      marginBottom: 0,
    },
    podiumSpacer: {
      height: height * 0.26,
      justifyContent: 'flex-end',
    },
    podiumAvatar: {
      width: width * 0.15,
      height: width * 0.15,
      borderRadius: width * 0.075,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.01,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    podiumAvatarCurrent: {
      borderColor: '#FFFFFF',
    },
    podiumAvatarText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      color: '#FFFFFF',
    },
    podiumName: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.031,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: height * 0.004,
      minHeight: width * 0.056,
    },
    podiumMeta: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.026,
      color: 'rgba(255, 255, 255, 0.78)',
      textAlign: 'center',
      marginBottom: height * 0.008,
      minHeight: width * 0.058,
    },
    podiumScoreChip: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: width * 0.035,
      paddingHorizontal: width * 0.03,
      paddingVertical: height * 0.006,
      marginBottom: height * 0.012,
    },
    podiumScoreText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.03,
      color: '#FFFFFF',
    },
    pedestal: {
      width: '100%',
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: height * 0.014,
      gap: height * 0.004,
    },
    pedestalFirst: {
      minHeight: height * 0.16,
    },
    pedestalSecond: {
      minHeight: height * 0.125,
    },
    pedestalThird: {
      minHeight: height * 0.11,
    },
    pedestalRank: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.085,
      color: '#FFFFFF',
      lineHeight: width * 0.09,
    },
    standingsShell: {
      backgroundColor: '#1D1D1D',
      borderRadius: width * 0.05,
      borderWidth: 1,
      borderColor: '#2E2E2E',
      overflow: 'hidden',
    },
    standingsHeader: {
      paddingHorizontal: width * 0.045,
      paddingTop: height * 0.018,
      paddingBottom: height * 0.012,
      borderBottomWidth: 1,
      borderBottomColor: '#2E2E2E',
    },
    columnHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: width * 0.045,
      paddingVertical: height * 0.012,
      backgroundColor: '#232323',
    },
    columnText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.027,
      color: 'rgba(255, 255, 255, 0.6)',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    rankColumn: {
      width: width * 0.12,
    },
    nameColumn: {
      flex: 1,
    },
    statColumn: {
      width: width * 0.2,
      alignItems: 'flex-end',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: width * 0.045,
      paddingVertical: height * 0.014,
      borderTopWidth: 1,
      borderTopColor: '#2A2A2A',
      gap: width * 0.02,
    },
    rowHighlighted: {
      backgroundColor: 'rgba(108, 92, 231, 0.18)',
      borderTopColor: 'rgba(108, 92, 231, 0.32)',
    },
    rankValue: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.036,
      color: '#FFFFFF',
    },
    nameCell: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      gap: width * 0.03,
    },
    avatar: {
      width: width * 0.09,
      height: width * 0.09,
      borderRadius: width * 0.045,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarHighlighted: {
      backgroundColor: '#6C5CE7',
    },
    avatarText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.033,
      color: '#FFFFFF',
    },
    nameBlock: {
      flex: 1,
      minWidth: 0,
    },
    nameText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.036,
      color: '#FFFFFF',
    },
    rowMetaText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.028,
      color: 'rgba(255, 255, 255, 0.66)',
      marginTop: height * 0.002,
    },
    statValue: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.036,
      color: '#FFFFFF',
      textAlign: 'right',
    },
    emptyShell: {
      backgroundColor: '#1D1D1D',
      borderRadius: width * 0.05,
      borderWidth: 1,
      borderColor: '#2E2E2E',
      paddingHorizontal: width * 0.05,
      paddingVertical: height * 0.05,
      gap: height * 0.01,
    },
    emptyTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.042,
      color: '#FFFFFF',
    },
    emptyText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.032,
      color: 'rgba(255, 255, 255, 0.76)',
      lineHeight: width * 0.045,
    },
    loadingState: {
      paddingVertical: height * 0.08,
      alignItems: 'center',
      justifyContent: 'center',
      gap: height * 0.015,
    },
    loadingText: {
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.036,
      color: '#FFFFFF',
    },
  });

  const renderPositionCard = () => {
    const positionValue = currentUserEntry ? `#${currentUserEntry.rank}` : 'Off board';
    const statValue = currentUserEntry ? getMetricValue(currentUserEntry, activeMetric) : 0;
    const supportingCopy = currentUserEntry
      ? `${statValue} ${getMetricLabelLower(activeMetric)} ${activePeriod === 'weekly' ? 'this week' : 'all time'}`
      : activePeriod === 'weekly'
        ? 'Complete a match to place this week.'
        : 'Complete a match to place on the all-time board.';

    return (
      <View style={styles.positionShell}>
        <LinearGradient
          colors={['#4A3A7A', '#32285A', '#1E1A2E', '#1D1D1D']}
          locations={[0, 0.35, 0.72, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.positionGradient}
        >
          <View style={styles.positionTopRow}>
            <View style={styles.positionHeading}>
              <Text style={styles.positionEyebrow}>{activePeriod === 'weekly' ? 'Weekly' : 'All Time'}</Text>
              <Text style={styles.positionTitle}>Your Position</Text>
              <Text style={styles.positionRange}>
                {activePeriod === 'weekly' ? weekRangeText : 'Lifetime rankings'}
              </Text>
            </View>
            <View style={styles.positionPill}>
              <Text style={styles.positionPillText}>
                {activePeriod === 'weekly' ? countdownText : 'Lifetime'}
              </Text>
            </View>
          </View>

          <View style={styles.positionStats}>
            <View style={styles.positionStatCard}>
              <Text style={styles.positionStatLabel}>Rank</Text>
              <Text style={styles.positionStatValue}>{positionValue}</Text>
            </View>
            <View style={styles.positionStatCard}>
              <Text style={styles.positionStatLabel}>{getMetricLabel(activeMetric)}</Text>
              <Text style={styles.positionStatValue}>{statValue}</Text>
            </View>
          </View>

          <Text style={styles.positionCaption}>{supportingCopy}</Text>
        </LinearGradient>
      </View>
    );
  };

  const renderPodiumSlot = (rank: number, center = false) => {
    const entry = activeEntries.find((item) => item.rank === rank) ?? null;

    if (!entry) {
      return <View style={[styles.podiumSlot, styles.podiumSpacer]} />;
    }

    const metricValue = getMetricValue(entry, activeMetric);
    const isCurrentUser = currentUserEntry?.userId === entry.userId;
    const countryDisplay = getCountryDisplay(entry.countryCode);

    return (
      <View style={[styles.podiumSlot, center && styles.podiumSlotCenter]}>
        <View style={[styles.podiumAvatar, isCurrentUser && styles.podiumAvatarCurrent]}>
          <Text style={styles.podiumAvatarText}>
            {getInitials(entry.displayName)}
          </Text>
        </View>
        <Text style={styles.podiumName} numberOfLines={2}>
          {entry.displayName}
        </Text>
        <Text style={styles.podiumMeta} numberOfLines={1}>
          {countryDisplay || ' '}
        </Text>
        <View style={styles.podiumScoreChip}>
          <Text style={styles.podiumScoreText}>{metricValue}</Text>
        </View>
        <LinearGradient
          colors={getPodiumGradient(rank)}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.pedestal,
            rank === 1 ? styles.pedestalFirst : rank === 2 ? styles.pedestalSecond : styles.pedestalThird,
          ]}
        >
          <Ionicons name="medal" size={width * 0.048} color={getMedalColor(rank)} />
          <Text style={styles.pedestalRank}>{rank}</Text>
        </LinearGradient>
      </View>
    );
  };

  const renderStandingsRow = (entry: WeeklyLeaderboardEntry) => {
    const isCurrentUser = currentUserEntry?.userId === entry.userId;
    const countryDisplay = getCountryDisplay(entry.countryCode);
    const rowMeta = [countryDisplay, isCurrentUser && !isCurrentUserInTopThree ? 'Your current position' : null]
      .filter(Boolean)
      .join(' • ') || null;

    return (
      <View
        key={entry.userId}
        style={[styles.row, isCurrentUser && styles.rowHighlighted]}
      >
        <View style={styles.rankColumn}>
          <Text style={styles.rankValue}>#{entry.rank}</Text>
        </View>

        <View style={styles.nameColumn}>
          <View style={styles.nameCell}>
            <View style={[styles.avatar, isCurrentUser && styles.avatarHighlighted]}>
              <Text style={styles.avatarText}>
                {getInitials(entry.displayName)}
              </Text>
            </View>
            <View style={styles.nameBlock}>
              <Text style={styles.nameText} numberOfLines={1}>
                {entry.displayName}
              </Text>
              {rowMeta ? (
                <Text style={styles.rowMetaText}>{rowMeta}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{getMetricValue(entry, activeMetric)}</Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyShell}>
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading leaderboard</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.emptyShell}>
        <Text style={styles.emptyTitle}>
          {leaderboard ? 'No matches scored yet' : 'Leaderboard unavailable'}
        </Text>
        <Text style={styles.emptyText}>
          {leaderboard
            ? activePeriod === 'weekly'
              ? 'Be the first to get on the board by scoring a completed match this week.'
              : 'No completed matches have been recorded for the all-time board yet.'
            : 'The leaderboard could not be loaded right now. Pull to refresh or reopen this screen.'}
        </Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.headerSafeArea} edges={['top', 'left', 'right']}>
          <View style={styles.stickyHeader}>
            <View style={styles.headerRow}>
              <View style={styles.headerSide}>
                <BackButton />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Leaderboard</Text>
              </View>
              <View style={styles.headerSideSpacer} />
            </View>
          </View>
        </SafeAreaView>

        <SafeAreaView style={styles.contentSafeArea} edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.periodTabsShell}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setActivePeriod('weekly')}
                style={[styles.periodTabButton, activePeriod === 'weekly' && styles.periodTabButtonActive]}
              >
                <Text style={[styles.periodTabText, activePeriod === 'weekly' && styles.periodTabTextActive]}>
                  Weekly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setActivePeriod('allTime')}
                style={[styles.periodTabButton, activePeriod === 'allTime' && styles.periodTabButtonActive]}
              >
                <Text style={[styles.periodTabText, activePeriod === 'allTime' && styles.periodTabTextActive]}>
                  All Time
                </Text>
              </TouchableOpacity>
            </View>

            {renderPositionCard()}

            <View style={styles.metricTabsShell}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setActiveMetric('wins')}
                style={[styles.metricTabButton, activeMetric === 'wins' && styles.metricTabButtonActive]}
              >
                <Text style={[styles.metricTabText, activeMetric === 'wins' && styles.metricTabTextActive]}>
                  Wins
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setActiveMetric('matches')}
                style={[styles.metricTabButton, activeMetric === 'matches' && styles.metricTabButtonActive]}
              >
                <Text style={[styles.metricTabText, activeMetric === 'matches' && styles.metricTabTextActive]}>
                  Matches
                </Text>
              </TouchableOpacity>
            </View>

            {!leaderboard || activeEntries.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <View style={styles.podiumShell}>
                  <View style={styles.podiumHeader}>
                    <Text style={styles.sectionEyebrow}>
                      {activePeriod === 'weekly' ? 'This Week' : 'All Time'}
                    </Text>
                    <Text style={styles.sectionTitle}>Top 3</Text>
                    <Text style={styles.sectionSubtitle}>
                      Ranked by {getMetricLabelLower(activeMetric)}
                    </Text>
                  </View>

                  <View style={styles.podiumRow}>
                    {renderPodiumSlot(2)}
                    {renderPodiumSlot(1, true)}
                    {renderPodiumSlot(3)}
                  </View>
                </View>

                <View style={styles.standingsShell}>
                  <View style={styles.standingsHeader}>
                    <Text style={styles.sectionTitle}>Standings</Text>
                    <Text style={styles.sectionSubtitle}>
                      {standingEntries.length > 0
                        ? `Ranks 4+ by ${getMetricLabelLower(activeMetric)}`
                        : totalRankedUsers > 0
                          ? 'Only podium places are occupied right now.'
                          : 'No standings yet.'}
                    </Text>
                  </View>

                  <View style={styles.columnHeaderRow}>
                    <View style={styles.rankColumn}>
                      <Text style={styles.columnText}>Rank</Text>
                    </View>
                    <View style={styles.nameColumn}>
                      <Text style={styles.columnText}>Fencer</Text>
                    </View>
                    <View style={styles.statColumn}>
                      <Text style={styles.columnText}>{getMetricLabel(activeMetric)}</Text>
                    </View>
                  </View>

                  {standingEntries.map(renderStandingsRow)}
                  {shouldAppendCurrentUser ? renderStandingsRow(currentUserEntry) : null}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

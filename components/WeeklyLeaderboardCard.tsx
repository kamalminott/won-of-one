import { WeeklyLeaderboardData, WeeklyLeaderboardEntry } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface WeeklyLeaderboardCardProps {
  leaderboard: WeeklyLeaderboardData | null;
  isLoading?: boolean;
  onPress: () => void;
}

const getEntryLabel = (
  entry: WeeklyLeaderboardEntry,
  currentUserEntry?: WeeklyLeaderboardEntry | null
) => {
  if (currentUserEntry?.userId === entry.userId) {
    return 'You';
  }

  return entry.displayName;
};

export const WeeklyLeaderboardCard: React.FC<WeeklyLeaderboardCardProps> = ({
  leaderboard,
  isLoading = false,
  onPress,
}) => {
  const { width, height } = useWindowDimensions();

  const topEntries = leaderboard?.winsLeaderboard.entries.slice(0, 2) ?? [];
  const currentUserEntry = leaderboard?.winsLeaderboard.currentUserEntry ?? null;
  const currentUserIsInTopEntries = !!currentUserEntry && topEntries.some(
    (entry) => entry.userId === currentUserEntry.userId
  );

  const styles = StyleSheet.create({
    shell: {
      borderRadius: width * 0.05,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#D2A3F0',
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 7,
    },
    card: {
      minHeight: height * 0.145,
      paddingHorizontal: width * 0.045,
      paddingTop: height * 0.016,
      paddingBottom: height * 0.015,
      justifyContent: 'space-between',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: height * 0.008,
      gap: width * 0.03,
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.043,
      color: '#FFFFFF',
      marginBottom: height * 0.002,
    },
    subtitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.029,
      color: 'rgba(255, 255, 255, 0.76)',
    },
    countdownPill: {
      backgroundColor: '#FFFFFF',
      borderRadius: width * 0.035,
      paddingHorizontal: width * 0.03,
      paddingVertical: height * 0.006,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: width * 0.014,
    },
    countdownText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.026,
      color: '#6C5CE7',
    },
    rows: {
      gap: height * 0.005,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: width * 0.025,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    rankText: {
      width: width * 0.075,
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.031,
      color: 'rgba(255, 255, 255, 0.86)',
    },
    nameText: {
      flex: 1,
      minWidth: 0,
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.031,
      color: '#FFFFFF',
    },
    statText: {
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.88)',
    },
    footer: {
      marginTop: height * 0.01,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: width * 0.03,
    },
    youChip: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.032,
      paddingVertical: height * 0.008,
    },
    youText: {
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.029,
      color: '#FFFFFF',
    },
    helperText: {
      flex: 1,
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.028,
      color: 'rgba(255, 255, 255, 0.82)',
      lineHeight: width * 0.041,
    },
    emptyBody: {
      flex: 1,
      justifyContent: 'center',
      gap: height * 0.006,
    },
    emptyTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.034,
      color: '#FFFFFF',
    },
    emptyText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.8)',
      lineHeight: width * 0.042,
    },
  });

  const renderRows = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyBody}>
          <Text style={styles.emptyTitle}>Loading this week&apos;s table</Text>
          <Text style={styles.emptyText}>Pulling the latest wins and matches played from the global board.</Text>
        </View>
      );
    }

    if (!leaderboard) {
      return (
        <View style={styles.emptyBody}>
          <Text style={styles.emptyTitle}>Leaderboard unavailable</Text>
          <Text style={styles.emptyText}>The weekly board could not be loaded right now. Tap to try again.</Text>
        </View>
      );
    }

    if (topEntries.length === 0) {
      return (
        <View style={styles.emptyBody}>
          <Text style={styles.emptyTitle}>No matches scored yet this week</Text>
          <Text style={styles.emptyText}>Be the first to get on the global board by scoring a match.</Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.rows}>
          {topEntries.map((entry) => (
            <View key={entry.userId} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rankText}>#{entry.rank}</Text>
                <Text style={styles.nameText} numberOfLines={1}>
                  {getEntryLabel(entry, currentUserEntry)}
                </Text>
              </View>
              <Text style={styles.statText}>{entry.wins}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          {currentUserEntry && !currentUserIsInTopEntries ? (
            <View style={styles.youChip}>
              <Text style={styles.youText}>
                You are #{currentUserEntry.rank} • {currentUserEntry.wins}
              </Text>
            </View>
          ) : (
            <Text style={styles.helperText}>
              {currentUserEntry
                ? `You are in the top ${Math.min(2, leaderboard.totalRankedUsers)} this week.`
                : 'Score a match to get your name onto the board.'}
            </Text>
          )}

        </View>
      </>
    );
  };

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.shell}>
      <LinearGradient
        colors={['rgba(210, 164, 241, 0.32)', 'rgba(153, 157, 249, 0.32)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Leaderboard</Text>
            <Text style={styles.subtitle}>Ranked by wins</Text>
          </View>
          <View style={styles.countdownPill}>
            <Text style={styles.countdownText}>View Leaderboard</Text>
            <Ionicons name="chevron-forward" size={width * 0.034} color="#6C5CE7" />
          </View>
        </View>

        {renderRows()}
      </LinearGradient>
    </TouchableOpacity>
  );
};

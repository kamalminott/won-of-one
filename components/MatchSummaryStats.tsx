import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface Match {
  id: string;
  opponent: string;
  opponentImage: string;
  outcome: 'victory' | 'defeat';
  score: string;
  matchType: 'competition' | 'training';
  date: string;
  userScore: number;
  opponentScore: number;
  bestRun: number;
}

interface MatchSummaryStatsProps {
  match: Match;
  customStyle?: object;
}

export const MatchSummaryStats: React.FC<MatchSummaryStatsProps> = ({ match, customStyle = {} }) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      padding: width * 0.04,
      marginBottom: height * 0.02,
      marginHorizontal: width * 0.04,
      left: 0,
      right: 0,
    },
    topSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.02,
    },
    outcomeText: {
      fontSize: Math.round(width * 0.05),
      fontWeight: '700',
      color: '#FFFFFF',
    },
    winPill: {
      backgroundColor: '#324F42',
      borderRadius: width * 0.04,
      paddingHorizontal: width * 0.03,
      paddingVertical: height * 0.01,
      flexDirection: 'row',
      alignItems: 'center',
    },
    winText: {
      color: '#DDFFF8',
      fontWeight: '600',
      marginLeft: width * 0.01,
      fontSize: Math.round(width * 0.035),
    },
    dividerLine: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      marginBottom: height * 0.02,
    },
    statsSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statColumn: {
      flex: 1,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: Math.round(width * 0.05),
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: height * 0.005,
    },
    statLabel: {
      fontSize: Math.round(width * 0.025),
      color: 'rgba(255, 255, 255, 0.6)',
      textAlign: 'center',
    },
    verticalDivider: {
      width: 1,
      height: height * 0.06,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      marginHorizontal: width * 0.01,
    },
  });

  return (
    <View style={styles.container}>
      {/* Top Section - Match Outcome */}
      <View style={styles.topSection}>
        <Text style={styles.outcomeText}>
          {match.outcome === 'victory' ? 'Win' : 'Loss'} {match.userScore} - {match.opponentScore}
        </Text>
        <View style={styles.winPill}>
          <Ionicons name="checkmark" size={16} color="white" />
          <Text style={styles.winText}>
            {match.outcome === 'victory' ? 'Win' : 'Loss'}
          </Text>
        </View>
      </View>

      {/* Divider Line */}
      <View style={styles.dividerLine} />

      {/* Bottom Section - Key Statistics */}
      <View style={styles.statsSection}>
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{match.userScore}</Text>
          <Text style={styles.statLabel}>Touches For</Text>
        </View>
        
        <View style={styles.verticalDivider} />
        
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{match.opponentScore}</Text>
          <Text style={styles.statLabel}>Touches Against</Text>
        </View>
        
        <View style={styles.verticalDivider} />
        
        <View style={styles.statColumn}>
          <Text style={styles.statNumber}>{match.bestRun}</Text>
          <Text style={styles.statLabel}>Best Run</Text>
        </View>
      </View>
    </View>
  );
};

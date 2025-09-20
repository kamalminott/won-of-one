import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface Match {
  id: string;
  opponent: string;
  opponentImage: string;
  userImage?: string;
  userName?: string;
  outcome?: 'victory' | 'defeat' | null;
  score: string;
  matchType: 'competition' | 'training';
  date: string;
  userScore: number;
  opponentScore: number;
  bestRun: number;
  fencer1Name?: string;
  fencer2Name?: string;
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
    scoreSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.03,
    },
    outcomeText: {
      fontSize: Math.round(width * 0.05),
      fontWeight: '700',
      color: '#FFFFFF',
    },
    userImageContainer: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: '#324F42',
    },
    userImage: {
      width: '100%',
      height: '100%',
    },
    userImagePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: '#324F42',
      justifyContent: 'center',
      alignItems: 'center',
    },
    userInitials: {
      color: '#DDFFF8',
      fontWeight: '700',
      fontSize: Math.round(width * 0.04),
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
        <View style={styles.scoreSection}>
          <View style={styles.userImageContainer}>
            {match.userImage ? (
              <Image 
                source={{ uri: match.userImage }} 
                style={styles.userImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.userImagePlaceholder}>
                <Text style={styles.userInitials}>
                  {match.userName ? match.userName.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.outcomeText}>
            {match.userScore} - {match.opponentScore}
          </Text>
        </View>
        {match.outcome && (
          <View style={styles.winPill}>
            <Ionicons 
              name={match.outcome === 'victory' ? "checkmark" : "close"} 
              size={16} 
              color="white" 
            />
            <Text style={styles.winText}>
              {match.outcome === 'victory' ? 'Win' : 'Loss'}
            </Text>
          </View>
        )}
      </View>

      {/* Divider Line */}
      <View style={styles.dividerLine} />

      {/* Bottom Section - Key Statistics */}
      <View style={styles.statsSection}>
        {match.outcome ? (
          <>
            {/* User-focused view when there's an outcome */}
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
              <Text style={styles.statNumber}>
                {match.userScore - match.opponentScore > 0 ? '+' : ''}{match.userScore - match.opponentScore}
              </Text>
              <Text style={styles.statLabel}>Score Difference</Text>
            </View>
          </>
        ) : (
          <>
            {/* Neutral view when no user outcome (anonymous match) */}
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>{match.userScore}</Text>
              <Text style={styles.statLabel}>{match.fencer1Name || 'Fencer 1'}</Text>
            </View>
            
            <View style={styles.verticalDivider} />
            
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>{match.opponentScore}</Text>
              <Text style={styles.statLabel}>{match.fencer2Name || 'Fencer 2'}</Text>
            </View>
            
            <View style={styles.verticalDivider} />
            
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>
                {Math.abs(match.userScore - match.opponentScore)}
              </Text>
              <Text style={styles.statLabel}>Point Margin</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

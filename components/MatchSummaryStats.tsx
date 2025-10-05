import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
      width: width * 0.9, // 358px equivalent
      height: height * 0.28, // 227px equivalent
      alignSelf: 'center',
      marginTop: height * 0.02,
      marginBottom: height * 0.025,
      position: 'relative',
      overflow: 'visible',
    },
    gradientContainer: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#D1A3F0',
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 8,
      overflow: 'visible',
    },
    winPill: {
      position: 'absolute',
      top: -17, // Half of pill height (34px / 2 = 17px) to make it exactly half inside/outside
      left: '50%',
      marginLeft: -37.5, // Half of pill width (75px / 2)
      width: 75,
      height: 34,
      backgroundColor: '#4D4159',
      borderWidth: 2,
      borderColor: '#D1A3F0',
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 7,
      zIndex: 10,
    },
    winPillText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'System',
    },
    winPillIcon: {
      width: 14,
      height: 14,
    },
    playerContainer: {
      position: 'absolute',
      top: 42, // 198px - 156px
      width: 60,
      height: 89,
    },
    leftPlayer: {
      left: 36,
    },
    rightPlayer: {
      right: 36,
    },
    playerImage: {
      width: 60,
      height: 60,
      borderRadius: 30,
    },
    playerName: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: 'System',
    },
    scoreContainer: {
      position: 'absolute',
      top: 66, // 222px - 156px
      left: '50%',
      marginLeft: -42, // Half of score width (84px / 2)
      width: 84,
      height: 41,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scoreText: {
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: 'System',
    },
    horizontalDivider: {
      position: 'absolute',
      top: 147, // 303px - 156px
      left: 16,
      right: 16,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    statsContainer: {
      position: 'absolute',
      top: 163, // 319px - 156px
      left: 0,
      right: 0,
      height: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 32,
    },
    statColumn: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    statNumber: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 4,
      fontFamily: 'System',
    },
    statLabel: {
      color: '#9D9D9D',
      fontSize: 12,
      fontWeight: '400',
      textAlign: 'center',
      fontFamily: 'System',
    },
    verticalDivider: {
      position: 'absolute',
      top:178, // Center between the numbers and labels
      width: 1,
      height: 36,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    leftDivider: {
      left: 122, // 129px - 32px
    },
    rightDivider: {
      right: 102, // 279px - 200px (right side)
    },
  });

  return (
    <View style={styles.container}>
      {/* Win Pill */}
      {match.outcome === 'victory' && (
        <View style={styles.winPill}>
          <Ionicons name="checkmark" size={14} color="#FFFFFF" style={styles.winPillIcon} />
          <Text style={styles.winPillText}>Win</Text>
        </View>
      )}

      {/* Loss Pill */}
      {match.outcome === 'defeat' && (
        <View style={styles.winPill}>
          <Ionicons name="close" size={14} color="#FFFFFF" style={styles.winPillIcon} />
          <Text style={styles.winPillText}>Loss</Text>
        </View>
      )}

      <LinearGradient
        colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientContainer}
      >

        {/* Left Player */}
        <View style={[styles.playerContainer, styles.leftPlayer]}>
          <Image
            source={{ uri: match.userImage || 'https://via.placeholder.com/60x60' }}
            style={styles.playerImage}
          />
          <Text style={styles.playerName}>
            {match.userName ? match.userName.split(' ')[0] : match.fencer1Name ? match.fencer1Name.split(' ')[0] : 'Player 1'}
          </Text>
        </View>

        {/* Right Player */}
        <View style={[styles.playerContainer, styles.rightPlayer]}>
          <Image
            source={{ uri: match.opponentImage || 'https://via.placeholder.com/60x60' }}
            style={styles.playerImage}
          />
          <Text style={styles.playerName}>
            {match.opponent ? match.opponent.split(' ')[0] : match.fencer2Name ? match.fencer2Name.split(' ')[0] : 'Player 2'}
          </Text>
        </View>

        {/* Score */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {match.userScore} - {match.opponentScore}
          </Text>
        </View>

        {/* Horizontal Divider */}
        <View style={styles.horizontalDivider} />

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{match.userScore}</Text>
            <Text style={styles.statLabel}>Touches For</Text>
          </View>
          
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{match.opponentScore}</Text>
            <Text style={styles.statLabel}>Touches Against</Text>
          </View>
          
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>
              {match.userScore > match.opponentScore 
                ? `+${match.userScore - match.opponentScore}` 
                : match.userScore < match.opponentScore 
                  ? `-${match.opponentScore - match.userScore}` 
                  : '0'
              }
            </Text>
            <Text style={styles.statLabel}>Score Diff</Text>
          </View>
        </View>

        {/* Vertical Dividers */}
        <View style={[styles.verticalDivider, styles.leftDivider]} />
        <View style={[styles.verticalDivider, styles.rightDivider]} />
      </LinearGradient>
    </View>
  );
};

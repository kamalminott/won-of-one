import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { LossPill } from './LossPill';
import { MatchTypePill } from './MatchTypePill';
import { WinPill } from './WinPill';

interface Match {
  id: string;
  opponentName: string;
  opponentImage: string;
  date: string;
  matchType: 'Competition' | 'Training';
  outcome: 'Victory' | 'Defeat';
  playerScore: number;
  opponentScore: number;
}

interface RecentMatchCardProps {
  match: Match;
  customStyle?: object;
}

export const RecentMatchCard: React.FC<RecentMatchCardProps> = ({ 
  match, 
  customStyle = {} 
}) => {
  const { width, height } = useWindowDimensions();

  const handleCardPress = () => {
    router.push({
      pathname: '/match-history-details',
      params: { 
        matchId: match.id,
        opponentName: match.opponentName,
        opponentImage: match.opponentImage,
        youScore: match.playerScore.toString(),
        opponentScore: match.opponentScore.toString(),
        matchType: match.matchType,
        date: match.date,
        duration: '02:30', // This would come from match data in real app
        location: 'Metro Field House', // This would come from match data in real app
        isWin: (match.outcome === 'Victory').toString() // Pass win status based on outcome
      }
    });
  };

  const styles = StyleSheet.create({
    matchCard: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.025,
      padding: width * 0.04,
      marginBottom: height * 0.015,
      ...customStyle,
    },
    matchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.015,
    },
    profileImage: {
      width: width * 0.12,
      height: width * 0.12,
      borderRadius: width * 0.06,
      marginRight: width * 0.03,
    },
    opponentInfo: {
      flex: 1,
    },
    opponentName: {
      fontSize: width * 0.04,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.01,
      lineHeight: width * 0.045,
    },
    matchDate: {
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.6)',
    },
    outcomeBadgeContainer: {
      alignItems: 'flex-end',
    },
    separator: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      marginVertical: height * 0.015,
    },
    matchDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    scoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.01,
    },
    scoreDot: {
      width: width * 0.025,
      height: width * 0.025,
      borderRadius: width * 0.0125,
    },
    scoreText: {
      color: 'white',
      fontSize: width * 0.06,
      fontWeight: '700',
    },
    scoreTextVictory: {
      color: 'rgb(179, 241, 229)',
      fontSize: width * 0.06,
      fontWeight: '700',
    },
    scoreTextDefeat: {
      color: 'rgb(251, 198, 198)',
      fontSize: width * 0.06,
      fontWeight: '700',
    },
  });

  const getScoreDotColor = (isPlayerScore: boolean) => {
    if (isPlayerScore) {
      return '#0D9488'; // Teal color for player score
    } else {
      return '#DC2626'; // Red color for opponent score
    }
  };

  return (
    <TouchableOpacity 
      style={styles.matchCard}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      {/* Opponent Info */}
      <View style={styles.matchHeader}>
        <Image
          source={{ uri: match.opponentImage }}
          style={styles.profileImage}
          contentFit="cover"
        />
        <View style={styles.opponentInfo}>
          <Text style={styles.opponentName} numberOfLines={2} ellipsizeMode="tail">
            {match.opponentName}
          </Text>
          <Text style={styles.matchDate}>{match.date}</Text>
        </View>
        <View style={styles.outcomeBadgeContainer}>
          {match.outcome === 'Victory' ? (
            <WinPill />
          ) : (
            <LossPill />
          )}
        </View>
      </View>

      {/* Separator Line */}
      <View style={styles.separator} />

      {/* Match Details */}
      <View style={styles.matchDetails}>
        <MatchTypePill text={match.matchType} />

        <View style={styles.scoreContainer}>
          <View
            style={[
              styles.scoreDot,
              { backgroundColor: getScoreDotColor(true) },
            ]}
          />
          <Text style={match.outcome === 'Victory' ? styles.scoreTextVictory : styles.scoreTextDefeat}>{match.playerScore}</Text>
          <Text style={match.outcome === 'Victory' ? styles.scoreTextVictory : styles.scoreTextDefeat}> - </Text>
          <Text style={match.outcome === 'Victory' ? styles.scoreTextVictory : styles.scoreTextDefeat}>{match.opponentScore}</Text>
          <View
            style={[
              styles.scoreDot,
              { backgroundColor: getScoreDotColor(false) },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

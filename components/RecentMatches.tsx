import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface Match {
  id: string;
  youScore: number;
  opponentScore: number;
  date: string;
  opponentName: string;
}

interface RecentMatchesProps {
  matches: Match[];
  onViewAll: () => void;
}

export const RecentMatches: React.FC<RecentMatchesProps> = ({
  matches,
  onViewAll,
}) => {
  const { width, height } = useWindowDimensions();

  const handleMatchPress = (match: Match) => {
    router.push('/match-details');
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: height * 0.01,
      width: '100%',
      overflow: 'hidden', // Prevent content from overflowing
      position: 'relative', // Ensure proper positioning context
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.015,
    },
    title: {
      fontSize: width * 0.05,
      fontWeight: '700',
      color: 'white',
    },
    viewAll: {
      fontSize: width * 0.04,
      color: Colors.purple.primary,
      fontWeight: '600',
    },
    matchesContainer: {
      width: '100%',
    },
    matchCard: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.035,
      padding: width * 0.025,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.012,
      // Add subtle shadow for better touch feedback
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      // Add border for better definition
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    playerSection: {
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: Colors.gray.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.008,
    },
    avatarText: {
      color: 'white',
      fontSize: width * 0.035,
      fontWeight: '600',
    },
    playerLabel: {
      fontSize: width * 0.03,
      color: Colors.gray.light,
      fontWeight: '500',
    },
    scoreSection: {
      alignItems: 'center',
      flex: 1,
    },
    scoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.01,
    },
    scoreDot: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
      marginHorizontal: width * 0.02,
    },
    score: {
      fontSize: width * 0.04,
      fontWeight: '700',
      color: 'white',
    },
    date: {
      fontSize: width * 0.03,
      color: Colors.gray.light,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: height * 0.015,
      marginBottom: height * 0.02, // Add bottom margin to ensure dots stay above tab bar
      gap: width * 0.02,
    },
    dot: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
      backgroundColor: Colors.gray.medium,
    },
    dotActive: {
      backgroundColor: Colors.red.accent,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Matches</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.matchesContainer}>
        {matches.map((match) => (
          <TouchableOpacity 
            key={match.id} 
            style={styles.matchCard}
            onPress={() => handleMatchPress(match)}
            activeOpacity={0.7}
          >
            <View style={styles.playerSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>You</Text>
              </View>
              <Text style={styles.playerLabel}>You</Text>
            </View>
            
            <View style={styles.scoreSection}>
              <View style={styles.scoreContainer}>
                <View style={[
                  styles.scoreDot, 
                  { backgroundColor: match.youScore > match.opponentScore ? Colors.green.accent : Colors.red.accent }
                ]} />
                <Text style={styles.score}>{`${match.youScore} - ${match.opponentScore}`}</Text>
                <View style={[
                  styles.scoreDot, 
                  { backgroundColor: match.youScore > match.opponentScore ? Colors.red.accent : Colors.green.accent }
                ]} />
              </View>
              <Text style={styles.date}>{match.date}</Text>
            </View>
            
            <View style={styles.playerSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{match.opponentName.charAt(0)}</Text>
              </View>
              <Text style={styles.playerLabel}>{match.opponentName}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.pagination}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

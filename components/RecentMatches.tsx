import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Match {
  id: string;
  youScore: number;
  opponentScore: number;
  date: string;
  opponentName: string;
  opponentAvatar?: string;
}

interface RecentMatchesProps {
  matches: Match[];
  onViewAll: () => void;
}

export const RecentMatches: React.FC<RecentMatchesProps> = ({
  matches,
  onViewAll,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Matches</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.matchesContainer}>
        {matches.map((match) => {
          const isWinner = match.youScore > match.opponentScore;
          const youDotColor = isWinner ? Colors.green.accent : Colors.red.accent;
          const opponentDotColor = isWinner ? Colors.red.accent : Colors.green.accent;
          
          return (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.playerSection}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>S</Text>
                </View>
                <Text style={styles.playerLabel}>You</Text>
              </View>
              
              <View style={styles.scoreSection}>
                <View style={styles.scoreContainer}>
                  <View style={[styles.scoreDot, { backgroundColor: youDotColor }]} />
                  <Text style={styles.score}>{`${match.youScore} - ${match.opponentScore}`}</Text>
                  <View style={[styles.scoreDot, { backgroundColor: opponentDotColor }]} />
                </View>
                <Text style={styles.date}>{match.date}</Text>
              </View>
              
              <View style={styles.playerSection}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{match.opponentName.charAt(0)}</Text>
                </View>
                <Text style={styles.playerLabel}>{match.opponentName}</Text>
              </View>
            </View>
          );
        })}
      </View>
      
      {/* Pagination dots */}
      <View style={styles.pagination}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  viewAll: {
    fontSize: 16,
    color: Colors.purple.primary,
    fontWeight: '600',
  },
  matchesContainer: {
    width: '100%',
  },
  matchCard: {
    backgroundColor: Colors.gray.dark,
    borderRadius: 16,
    padding: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playerSection: {
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  playerLabel: {
    fontSize: 12,
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
    marginBottom: 8,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  score: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  date: {
    fontSize: 12,
    color: Colors.gray.light,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray.medium,
  },
  dotActive: {
    backgroundColor: Colors.red.accent,
  },
});

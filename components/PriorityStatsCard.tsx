import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { priorityAnalyticsService } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface PriorityStats {
  totalPriorityRounds: number;
  priorityWins: number;
  priorityLosses: number;
  priorityWinRate: number;
}

export const PriorityStatsCard = () => {
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const [priorityStats, setPriorityStats] = useState<PriorityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPriorityStats = async () => {
      if (user?.id) {
        try {
          const stats = await priorityAnalyticsService.getPriorityStats(user.id);
          setPriorityStats(stats);
        } catch (error) {
          console.error('Error fetching priority stats:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchPriorityStats();
  }, [user]);

  if (loading) {
    return (
      <View style={[styles.card, { width: width * 0.9, alignSelf: 'center' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.yellow.accent} />
          <Text style={styles.loadingText}>Loading priority stats...</Text>
        </View>
      </View>
    );
  }

  if (!priorityStats || priorityStats.totalPriorityRounds === 0) {
    return (
      <View style={[styles.card, { width: width * 0.9, alignSelf: 'center' }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={32} color="#9D9D9D" />
          <Text style={styles.emptyTitle}>No Priority Rounds Yet</Text>
          <Text style={styles.emptySubtitle}>
            Priority rounds happen when matches end in a tie after Period 3
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { width: width * 0.9, alignSelf: 'center' }]}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={24} color={Colors.yellow.accent} />
        <Text style={styles.title}>Priority Round Stats</Text>
      </View>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{priorityStats.totalPriorityRounds}</Text>
          <Text style={styles.statLabel}>Total Rounds</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.green.accent }]}>
            {priorityStats.priorityWins}
          </Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.red.accent }]}>
            {priorityStats.priorityLosses}
          </Text>
          <Text style={styles.statLabel}>Losses</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.yellow.accent }]}>
            {priorityStats.priorityWinRate}%
          </Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
      </View>
      
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { 
              width: `${priorityStats.priorityWinRate}%`,
              backgroundColor: priorityStats.priorityWinRate >= 50 ? Colors.green.accent : Colors.red.accent
            }
          ]} 
        />
      </View>
      
      <Text style={styles.progressText}>
        {priorityStats.priorityWinRate >= 50 ? '🎉' : '💪'} 
        {priorityStats.priorityWinRate >= 50 
          ? ' Great priority performance!' 
          : ' Keep practicing those pressure situations!'
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
  },
  
  statLabel: {
    fontSize: 12,
    color: '#9D9D9D',
    fontWeight: '500',
    textAlign: 'center',
  },
  
  progressBar: {
    height: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  
  progressText: {
    fontSize: 14,
    color: '#9D9D9D',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  
  loadingText: {
    color: '#9D9D9D',
    fontSize: 14,
  },
  
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginTop: 12,
    marginBottom: 8,
  },
  
  emptySubtitle: {
    fontSize: 14,
    color: '#9D9D9D',
    textAlign: 'center',
    lineHeight: 20,
  },
});

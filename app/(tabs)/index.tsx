import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GoalCard } from '@/components/GoalCard';
import { ProgressCard } from '@/components/ProgressCard';
import { RecentMatches } from '@/components/RecentMatches';
import { SummaryCard } from '@/components/SummaryCard';
import { UserHeader } from '@/components/UserHeader';
import { Colors } from '@/constants/Colors';

export default function HomeScreen() {
  // Mock data - in real app this would come from state/API
  const mockMatches = [
    {
      id: '1',
      youScore: 5,
      opponentScore: 2,
      date: '11/6/2025',
      opponentName: 'Alex',
    },
    {
      id: '2',
      youScore: 3,
      opponentScore: 5,
      date: '11/5/2025',
      opponentName: 'Sarah',
    },
  ];



  const handleSettings = () => {
    Alert.alert('Settings', 'Settings opened!');
  };

  const handleSetNewGoal = () => {
    Alert.alert('Set New Goal', 'New goal creation started!');
  };

  const handleUpdateGoal = () => {
    Alert.alert('Update Goal', 'Goal update started!');
  };

  const handleViewAllMatches = () => {
    Alert.alert('View All Matches', 'Opening match history!');
  };

  const handleAddNewMatch = () => {
    Alert.alert('Add New Match', 'New match creation started!');
  };

  return (
    <>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.stickyHeader}>
          <UserHeader
            userName="Sophia"
            streak={7}
            onSettingsPress={handleSettings}
          />
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <ProgressCard
            title="Sessions this Week"
            current={3}
            total={5}
            daysRemaining={3}
          />
          
          <View style={styles.summaryRow}>
            <SummaryCard
              icon={<Text style={styles.icon}>🕐</Text>}
              value="12h 30m"
              label="Hours Trained"
              backgroundColor={Colors.pink.light}
            />
            <SummaryCard
              icon={<Text style={styles.icon}>🏆</Text>}
              value="91%"
              label="Win Rate"
              backgroundColor={Colors.blue.light}
            />
          </View>
          
          <GoalCard
            daysLeft={2}
            title="Goal"
            description="3 Sparing Sessions"
            progress={75}
            onSetNewGoal={handleSetNewGoal}
            onUpdateGoal={handleUpdateGoal}
          />
          
          <TouchableOpacity style={styles.addMatchLink} onPress={handleAddNewMatch}>
            <Text style={styles.addMatchText}>Add new match</Text>
            <Text style={styles.addMatchIcon}>+</Text>
          </TouchableOpacity>
          
          <RecentMatches
            matches={mockMatches}
            onViewAll={handleViewAllMatches}
          />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  stickyHeader: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 0,
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  addMatchLink: {
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 20,
    gap: 8,
  },
  addMatchText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '500',
  },
  addMatchIcon: {
    color: Colors.purple.light || '#A78BFA',
    fontSize: 16,
    fontWeight: '600',
  },
});

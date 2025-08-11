import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoalCard } from '@/components/GoalCard';
import { ProgressCard } from '@/components/ProgressCard';
import { QuickActions } from '@/components/QuickActions';
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
  ];

  const quickActions = [
    {
      id: 'train-now',
      title: 'Train Now',
      icon: '🏋️',
      onPress: () => Alert.alert('Train Now', 'Training session started!'),
    },
    {
      id: 'log-match',
      title: 'Log Match',
      icon: '⚔️',
      onPress: () => Alert.alert('Log Match', 'Match logging started!'),
    },
    {
      id: 'mindset',
      title: 'Mindset',
      icon: '🧠',
      onPress: () => Alert.alert('Mindset', 'Mindset tools opened!'),
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

  return (
    <>
      <ExpoStatusBar style="light" />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <UserHeader
          userName="Sophia"
          onSettingsPress={handleSettings}
        />
        
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
        
        <RecentMatches
          matches={mockMatches}
          onViewAll={handleViewAllMatches}
        />
        
        <QuickActions actions={quickActions} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  icon: {
    fontSize: 24,
  },
});

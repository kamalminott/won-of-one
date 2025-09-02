import { router } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalCard } from '@/components/GoalCard';
import { ProgressCard } from '@/components/ProgressCard';
import { RecentMatches } from '@/components/RecentMatches';
import { SummaryCard } from '@/components/SummaryCard';
import { UserHeader } from '@/components/UserHeader';
import { Colors } from '@/constants/Colors';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  
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
    router.push('/settings');
  };

  const handleSetNewGoal = () => {
    Alert.alert('Set New Goal', 'New goal creation started!');
  };

  const handleUpdateGoal = () => {
    Alert.alert('Update Goal', 'Goal update started!');
  };

  const handleViewAllMatches = () => {
    router.push('/recent-matches');
  };

  const handleAddNewMatch = () => {
    router.push('/add-match');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerSafeArea: {
      backgroundColor: Colors.dark.background,
    },
    safeArea: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    stickyHeader: {
      backgroundColor: Colors.dark.background,
      paddingHorizontal: '5%',
      paddingVertical: height * 0.02,
      zIndex: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    contentContainer: {
      padding: '4%',
      paddingTop: 0,
      paddingBottom: height * 0.25, // Increased padding to ensure RecentMatches dots stay above tab bar
      width: '100%',
    },
    recentMatchesWrapper: {
      width: '100%',
      marginBottom: height * 0.1, // Ensure RecentMatches stays above tab bar
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: height * 0.008,
    },
    icon: {
      fontSize: width * 0.06,
    },
    addMatchLink: {
      marginBottom: height * 0.015,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: '5%',
      gap: width * 0.02,
    },
    addMatchText: {
      color: '#9CA3AF',
      fontSize: width * 0.04,
      fontWeight: '500',
    },
    addMatchIcon: {
      color: Colors.purple.light || '#A78BFA',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    loginButton: {
      backgroundColor: Colors.purple.primary,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.01,
      borderRadius: 8,
    },
    loginButtonText: {
      color: '#FFFFFF',
      fontSize: width * 0.035,
      fontWeight: '600',
    },
  });

  return (
    <>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        {/* Header with top safe area */}
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.stickyHeader}>
            <UserHeader
              userName="Sophia"
              streak={7}
              onSettingsPress={handleSettings}
            />
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={() => router.push('/login')}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        
        {/* Content with bottom safe area */}
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.contentContainer}>
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
            
            <View style={styles.recentMatchesWrapper}>
              <RecentMatches
                matches={mockMatches}
                onViewAll={handleViewAllMatches}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

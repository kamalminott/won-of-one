import { router, useFocusEffect } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalCard } from '@/components/GoalCard';
import { ProgressCard } from '@/components/ProgressCard';
import { RecentMatches } from '@/components/RecentMatches';
import { SummaryCard } from '@/components/SummaryCard';
import { UserHeader } from '@/components/UserHeader';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { goalService, matchService, userService } from '@/lib/database';
import { SimpleGoal, SimpleMatch } from '@/types/database';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const { user, loading, signOut } = useAuth();
  
  // State for real data
  const [matches, setMatches] = useState<SimpleMatch[]>([]);
  const [goals, setGoals] = useState<SimpleGoal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch data when user is available
  useEffect(() => {
    if (user && !loading) {
      fetchUserData();
    }
  }, [user, loading]);

  // Refresh data when screen comes into focus (e.g., when returning from set-goal page)
  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        fetchUserData();
      }
    }, [user, loading])
  );

  const fetchUserData = async () => {
    if (!user) {
      console.log('No user found, skipping data fetch');
      return;
    }
    
    console.log('Fetching data for user:', user.id);
    setDataLoading(true);
    try {
      // First, ensure user exists in app_user table
      const existingUser = await userService.getUserById(user.id);
      if (!existingUser) {
        console.log('User not found in app_user table, creating...');
        await userService.createUser(user.id, user.email || '');
      }
      
      // Fetch matches and goals in parallel
      const [matchesData, goalsData] = await Promise.all([
        matchService.getRecentMatches(user.id, 5),
        goalService.getActiveGoals(user.id)
      ]);
      
      console.log('Fetched matches:', matchesData);
      console.log('Fetched goals:', goalsData);
      console.log('Goals count:', goalsData.length);
      
      setMatches(matchesData);
      setGoals(goalsData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleSetNewGoal = () => {
    // This will be handled by the GoalCard modal
    console.log('Set new goal clicked');
  };

  const handleUpdateGoal = () => {
    Alert.alert('Update Goal', 'Goal update started!');
  };

  const handleViewAllMatches = () => {
    router.push('/recent-matches');
  };

  const calculateDaysLeft = (deadline: string): number => {
    const today = new Date();
    const goalDeadline = new Date(deadline);
    const timeDiff = goalDeadline.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return Math.max(0, daysLeft); // Don't show negative days
  };

  const handleAddNewMatch = () => {
    router.push('/add-match');
  };

  const handleSwipeRight = () => {
    router.push('/recent-matches');
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
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

  // Show loading screen while checking authentication or loading data
  if (loading || dataLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: 'white', fontSize: 18 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        {/* Header with top safe area */}
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.stickyHeader}>
            <UserHeader
              userName={user?.email?.split('@')[0] || 'Guest'}
              streak={7}
              onSettingsPress={handleSettings}
            />
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogout}
            >
              <Text style={styles.loginButtonText}>Logout</Text>
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
            
            {goals.length > 0 ? (
              <GoalCard
                daysLeft={calculateDaysLeft(goals[0].deadline)}
                title={goals[0].title}
                description={goals[0].description}
                progress={goals[0].progress}
                onSetNewGoal={handleSetNewGoal}
                onUpdateGoal={handleUpdateGoal}
                onGoalSaved={async (goalData) => {
                  console.log('Goal saved callback triggered with data:', goalData);
                  if (user) {
                    try {
                      console.log('Saving goal to database...');
                      const newGoal = await goalService.createGoal(goalData, user.id);
                      console.log('Goal saved result:', newGoal);
                      if (newGoal) {
                        Alert.alert('Success', 'Goal created successfully!');
                        fetchUserData(); // Refresh data after saving
                      } else {
                        Alert.alert('Error', 'Failed to create goal');
                      }
                    } catch (error) {
                      console.error('Error saving goal:', error);
                      Alert.alert('Error', 'Failed to create goal');
                    }
                  }
                }} // Save goal to database and refresh data
                useModal={true}
              />
            ) : (
              <GoalCard
                daysLeft={0}
                title="No Active Goals"
                description="Set a new goal to track your progress"
                progress={0}
                onSetNewGoal={handleSetNewGoal}
                onUpdateGoal={handleUpdateGoal}
                onGoalSaved={async (goalData) => {
                  console.log('Goal saved callback triggered with data:', goalData);
                  if (user) {
                    try {
                      console.log('Saving goal to database...');
                      const newGoal = await goalService.createGoal(goalData, user.id);
                      console.log('Goal saved result:', newGoal);
                      if (newGoal) {
                        Alert.alert('Success', 'Goal created successfully!');
                        fetchUserData(); // Refresh data after saving
                      } else {
                        Alert.alert('Error', 'Failed to create goal');
                      }
                    } catch (error) {
                      console.error('Error saving goal:', error);
                      Alert.alert('Error', 'Failed to create goal');
                    }
                  }
                }} // Save goal to database and refresh data
                useModal={true}
              />
            )}
            
            <View style={styles.recentMatchesWrapper}>
              <RecentMatches
                matches={matches}
                onViewAll={handleViewAllMatches}
                onAddNewMatch={handleAddNewMatch}
                onSwipeRight={handleSwipeRight}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

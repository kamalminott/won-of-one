import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddNewMatchButton } from '@/components/AddNewMatchButton';
import { GoalCard, GoalCardRef } from '@/components/GoalCard';
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
  const { user, loading, signOut, userName, profileImage } = useAuth();
  const params = useLocalSearchParams();
  const goalCardRef = useRef<GoalCardRef>(null);
  
  // State for real data
  const [matches, setMatches] = useState<SimpleMatch[]>([]);
  const [goals, setGoals] = useState<SimpleGoal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [winRate, setWinRate] = useState<number>(0);
  const [trainingTime, setTrainingTime] = useState<{ value: string; label: string }>({ value: '0m', label: 'Minutes Trained' });
  const [weeklySessions, setWeeklySessions] = useState<{ current: number; total: number; daysRemaining: number }>({ current: 0, total: 5, daysRemaining: 0 });

  // Fetch data when user is available
  useEffect(() => {
    if (user && !loading) {
      fetchUserData();
    } else if (!user && !loading) {
      // No user logged in, stop data loading
      setDataLoading(false);
    }
  }, [user, loading]);

  // Refresh data when screen comes into focus (e.g., when returning from set-goal page)
  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        fetchUserData();
      } else if (!user && !loading) {
        // No user logged in, stop data loading
        setDataLoading(false);
      }
    }, [user, loading])
  );

  // Redirect to login if no user is logged in
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user]);

  // Auto-open goal modal when returning from completed goal
  useEffect(() => {
    if (params.autoOpenGoalModal === 'true' && !dataLoading && goalCardRef.current) {
      // Small delay to ensure UI is ready and data is loaded
      const timer = setTimeout(() => {
        console.log('🎯 Auto-opening goal modal after celebration');
        goalCardRef.current?.openModal();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [params.autoOpenGoalModal, dataLoading]);

  const fetchUserData = async () => {
    if (!user) {
      console.log('No user found, skipping data fetch');
      setDataLoading(false);
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
      
      // Clean up any old completed goals that weren't auto-deactivated
      const deactivatedCount = await goalService.deactivateAllCompletedGoals(user.id);
      if (deactivatedCount > 0) {
        console.log(`🧹 Cleaned up ${deactivatedCount} old completed goals`);
      }
      
      // Deactivate any expired goals (past deadline and not completed)
      const expiredCount = await goalService.deactivateExpiredGoals(user.id);
      if (expiredCount > 0) {
        console.log(`⏰ Auto-deactivated ${expiredCount} expired goal(s)`);
      }
      
      // Fetch matches, goals, and training time data in parallel
      const [matchesData, goalsData, trainingTimeData] = await Promise.all([
        matchService.getRecentMatches(user.id, 5),
        goalService.getActiveGoals(user.id),
        matchService.getAllMatchesForTrainingTime(user.id)
      ]);
      
      console.log('Fetched matches:', matchesData);
      console.log('Fetched goals:', goalsData);
      console.log('Goals count:', goalsData.length);
      console.log('Fetched training time data:', trainingTimeData);
      
      // Calculate win rate from matches
      const calculatedWinRate = calculateWinRate(matchesData);
      console.log('Calculated win rate:', calculatedWinRate + '%');
      
      // Calculate total training time
      const totalSeconds = trainingTimeData.reduce((sum, match) => sum + (match.bout_length_s || 0), 0);
      const formattedTrainingTime = formatTrainingTime(totalSeconds);
      console.log('Total training time (seconds):', totalSeconds);
      console.log('Formatted training time:', formattedTrainingTime);
      
      // Calculate weekly sessions
      const calculatedWeeklySessions = calculateWeeklySessions(matchesData);
      console.log('Weekly sessions:', calculatedWeeklySessions);
      
      setMatches(matchesData);
      setGoals(goalsData);
      setWinRate(calculatedWinRate);
      setTrainingTime(formattedTrainingTime);
      setWeeklySessions(calculatedWeeklySessions);
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
    router.push('/match-history');
  };

  const calculateDaysLeft = (deadline: string): number => {
    const today = new Date();
    const goalDeadline = new Date(deadline);
    const timeDiff = goalDeadline.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return Math.max(0, daysLeft); // Don't show negative days
  };

  const calculateWinRate = (matches: SimpleMatch[]): number => {
    if (matches.length === 0) return 0;
    
    const wins = matches.filter(match => match.isWin).length;
    const winPercentage = (wins / matches.length) * 100;
    return Math.round(winPercentage); // Round to nearest whole number
  };

  const calculateWeeklySessions = (matches: SimpleMatch[]): { current: number; total: number; daysRemaining: number } => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday = 0
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Filter matches for current week
    const weeklyMatches = matches.filter(match => {
      const matchDate = new Date(match.date);
      return matchDate >= startOfWeek && matchDate <= endOfWeek;
    });
    
    // Get unique days (sessions) from matches
    const uniqueDays = new Set(
      weeklyMatches.map(match => {
        const matchDate = new Date(match.date);
        return matchDate.toDateString(); // "Mon Jan 15 2024"
      })
    );
    
    const current = uniqueDays.size; // Number of unique days with fencing
    const total = 5; // Target sessions (days) per week
    const daysRemaining = Math.max(0, 6 - now.getDay()); // Days left in week (Sunday=0, Saturday=6)
    
    console.log('Current day of week:', now.getDay(), 'Days remaining:', daysRemaining);
    console.log('Current sessions:', current, 'Target sessions:', total);
    
    return { current, total, daysRemaining };
  };

  const formatTrainingTime = (totalSeconds: number): { value: string; label: string } => {
    if (totalSeconds < 60) { // Less than 1 minute
      return { value: `${totalSeconds}s`, label: 'Seconds Trained' };
    } else if (totalSeconds < 3600) { // Less than 1 hour
      const minutes = Math.floor(totalSeconds / 60);
      return { value: `${minutes}m`, label: 'Minutes Trained' };
    } else if (totalSeconds < 86400) { // Less than 24 hours
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return { 
        value: minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`, 
        label: 'Hours Trained' 
      };
    } else { // 24+ hours
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      return { 
        value: hours > 0 ? `${days}d ${hours}h` : `${days}d`, 
        label: 'Days Trained' 
      };
    }
  };

  const handleAddNewMatch = () => {
    router.push('/add-match');
  };

  const handleSwipeRight = () => {
    router.push('/match-history');
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
    addButtonContainer: {
      alignItems: 'flex-end',
      marginBottom: height * 0.005,
    },
    recentMatchesWrapper: {
      width: '100%',
      marginTop: -height * 0.015, // Move up closer to content above
      marginBottom: height * 0.1, // Ensure RecentMatches stays above tab bar
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: height * 0.008,
    },
    icon: {
      fontSize: width * 0.05,
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
        <Text style={{ color: 'white', fontSize: 14, marginTop: 10 }}>
          Auth Loading: {loading ? 'Yes' : 'No'}
        </Text>
        <Text style={{ color: 'white', fontSize: 14 }}>
          Data Loading: {dataLoading ? 'Yes' : 'No'}
        </Text>
        <Text style={{ color: 'white', fontSize: 14 }}>
          User: {user ? 'Logged In' : 'Not Logged In'}
        </Text>
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        {/* Header with top safe area */}
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.stickyHeader}>
            <UserHeader
              userName={userName}
              streak={7}
              avatarUrl={profileImage || undefined}
              onSettingsPress={handleSettings}
            />
          </View>
        </SafeAreaView>
        
        {/* Content with bottom safe area */}
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.contentContainer}>
            <ProgressCard
              title="Sessions this Week"
              current={weeklySessions.current}
              total={weeklySessions.total}
              daysRemaining={weeklySessions.daysRemaining}
            />
            
            <View style={styles.summaryRow}>
              <SummaryCard
                icon={<Text style={styles.icon}>🕐</Text>}
                value={trainingTime.value}
                label={trainingTime.label}
                backgroundColor={Colors.pink.light}
              />
              <SummaryCard
                icon={<Text style={styles.icon}>🏆</Text>}
                value={`${winRate}%`}
                label="Win Rate"
                backgroundColor={Colors.blue.light}
              />
            </View>
            
            {goals.length > 0 ? (
              (() => {
                // Calculate window matches for insights
                const goal = goals[0];
                let windowMatches = matches;
                
                if (goal.match_window && goal.starting_match_count !== undefined) {
                  // Get matches since goal was created
                  const matchesSinceGoal = matches.slice(0, matches.length - goal.starting_match_count);
                  // Limit to window size
                  windowMatches = matchesSinceGoal.slice(0, goal.match_window);
                }
                
                const windowWins = windowMatches.filter(m => m.isWin).length;
                const windowLosses = windowMatches.filter(m => !m.isWin).length;
                
                return (
                  <GoalCard
                    ref={goalCardRef}
                    goalId={goal.id}
                    daysLeft={calculateDaysLeft(goal.deadline)}
                    title={goal.title}
                    description={goal.description}
                    progress={goal.progress}
                    targetValue={goal.targetValue}
                    currentValue={goal.currentValue}
                    matchWindow={goal.match_window}
                    totalMatches={windowMatches.length}
                    currentRecord={{
                      wins: windowWins,
                      losses: windowLosses
                    }}
                    onSetNewGoal={handleSetNewGoal}
                    onUpdateGoal={handleUpdateGoal}
                onGoalSaved={async (goalData) => {
                  console.log('Goal saved callback triggered with data:', goalData);
                  if (user) {
                    try {
                      // If this is a windowed goal, add starting match count
                      if (goalData.match_window) {
                        const currentMatches = await matchService.getRecentMatches(user.id, 10000);
                        goalData.starting_match_count = currentMatches.length;
                        console.log('Adding starting_match_count:', goalData.starting_match_count);
                      }
                      
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
                }}
                onGoalDeleted={async (goalId) => {
                  console.log('🗑️ onGoalDeleted callback triggered with goalId:', goalId);
                  try {
                    const success = await goalService.deleteGoal(goalId);
                    console.log('Delete result:', success);
                    
                    if (success) {
                      console.log('✅ Goal deleted, refreshing home screen...');
                      
                      // Small delay to ensure database update propagates
                      setTimeout(async () => {
                        await fetchUserData();
                        console.log('✅ Home screen refreshed after deletion');
                        Alert.alert('Success', 'Goal deleted successfully');
                      }, 100);
                    } else {
                      console.log('❌ Delete failed');
                      Alert.alert('Error', 'Failed to delete goal');
                    }
                  } catch (error) {
                    console.error('❌ Exception during delete:', error);
                    Alert.alert('Error', 'Failed to delete goal');
                  }
                }}
                useModal={true}
              />
                );
              })()
            ) : (
              <GoalCard
                ref={goalCardRef}
                daysLeft={0}
                title="No Active Goals"
                description="Set a new goal to track your progress"
                progress={0}
                targetValue={0}
                currentValue={0}
                onSetNewGoal={handleSetNewGoal}
                onUpdateGoal={handleUpdateGoal}
                onGoalSaved={async (goalData) => {
                  console.log('Goal saved callback triggered with data:', goalData);
                  if (user) {
                    try {
                      // If this is a windowed goal, add starting match count
                      if (goalData.match_window) {
                        const currentMatches = await matchService.getRecentMatches(user.id, 10000);
                        goalData.starting_match_count = currentMatches.length;
                        console.log('Adding starting_match_count:', goalData.starting_match_count);
                      }
                      
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
            
            <View style={styles.addButtonContainer}>
              <AddNewMatchButton onPress={handleAddNewMatch} />
            </View>
            
            <View style={styles.recentMatchesWrapper}>
              <RecentMatches
                matches={matches}
                onViewAll={handleViewAllMatches}
                onSwipeRight={handleSwipeRight}
                userName={userName}
                userProfileImage={profileImage}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

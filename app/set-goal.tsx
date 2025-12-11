import { router, useFocusEffect } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { GoalCard } from '@/components/GoalCard';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { goalService } from '@/lib/database';
import { SimpleGoal } from '@/types/database';
import { analytics } from '@/lib/analytics';

export default function SetGoalScreen() {
  const { width, height } = useWindowDimensions();
  const { user, loading } = useAuth();
  const [goals, setGoals] = useState<SimpleGoal[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      analytics.screen('SetGoal');
    }, [])
  );

  // Fetch user's goals when component mounts
  useEffect(() => {
    if (user && !loading) {
      fetchUserGoals();
    }
  }, [user, loading]);

  const fetchUserGoals = async () => {
    if (!user) return;
    
    setDataLoading(true);
    try {
      console.log('Fetching goals for user:', user.id);
      const goalsData = await goalService.getActiveGoals(user.id);
      console.log('Fetched goals in set-goal page:', goalsData);
      setGoals(goalsData);
    } catch (error) {
      console.error('Error fetching goals:', error);
      Alert.alert('Error', 'Failed to load goals');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSetNewGoal = () => {
    // This will open the modal within the GoalCard
    console.log('Setting new goal...');
  };

  const handleUpdateGoal = () => {
    // This will open the modal within the GoalCard
    console.log('Updating goal...');
  };

  const handleGoalCreated = async (goalData: any) => {
    console.log('handleGoalCreated called with data:', goalData);
    
    if (!user) {
      console.log('No user found in handleGoalCreated');
      Alert.alert('Error', 'You must be logged in to create goals');
      return;
    }

    try {
      console.log('Creating goal with data:', goalData);
      console.log('User ID:', user.id);
      
      // Create goal in database
      const newGoal = await goalService.createGoal(goalData, user.id);
      
      console.log('Created goal result:', newGoal);
      
      if (newGoal) {
        Alert.alert('Success', 'Goal created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              // Refresh goals and go back to home
              console.log('Refreshing goals after creation...');
              fetchUserGoals();
              router.back();
            }
          }
        ]);
      } else {
        Alert.alert('Error', 'Failed to create goal');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      Alert.alert('Error', 'Failed to create goal');
    }
  };

  const handleBack = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
      paddingTop: height * 0.06,
      paddingHorizontal: width * 0.05,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.03,
    },
    backButton: {
      padding: width * 0.02,
      marginRight: width * 0.02,
    },
    backButtonText: {
      color: Colors.purple.primary,
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    title: {
      fontSize: width * 0.06,
      fontWeight: '700',
      color: 'white',
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Set New Goal</Text>
        </View>
        
        <View style={styles.content}>
          <GoalCard
            daysLeft={30}
            title="Create Your Goal"
            description="Set a new goal to track your progress"
            progress={0}
            onSetNewGoal={handleSetNewGoal}
            onUpdateGoal={handleUpdateGoal}
            onGoalSaved={handleGoalCreated}
            useModal={true}
          />
        </View>
      </View>
    </>
  );
}

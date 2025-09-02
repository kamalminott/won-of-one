import { router } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { GoalCard } from '@/components/GoalCard';
import { Colors } from '@/constants/Colors';

export default function SetGoalScreen() {
  const { width, height } = useWindowDimensions();

  const handleSetNewGoal = () => {
    // This will open the modal within the ModalGoalCard
    console.log('Setting new goal...');
  };

  const handleUpdateGoal = () => {
    // This will open the modal within the ModalGoalCard
    console.log('Updating goal...');
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
               />
        </View>
      </View>
    </>
  );
}

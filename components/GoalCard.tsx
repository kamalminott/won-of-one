import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { CircularProgress } from './CircularProgress';

interface GoalCardProps {
  daysLeft: number;
  title: string;
  description: string;
  progress: number;
  onSetNewGoal: () => void;
  onUpdateGoal: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  daysLeft,
  title,
  description,
  progress,
  onSetNewGoal,
  onUpdateGoal,
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: Colors.gray.dark,
      borderRadius: width * 0.04,
      padding: width * 0.025,
      marginBottom: height * 0.01,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: height * 0.008,
    },
    daysLeftTag: {
      backgroundColor: Colors.yellow.accent,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.003,
      borderRadius: width * 0.03,
    },
    daysLeftTagText: {
      fontSize: width * 0.025,
      fontWeight: '600',
      color: Colors.gray.dark,
    },
    title: {
      fontSize: width * 0.045,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.001,
    },
    description: {
      fontSize: width * 0.033,
      color: Colors.gray.light,
      marginBottom: height * 0.0005,
    },
    contentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.012,
    },
    textSection: {
      flex: 1,
      marginRight: width * 0.04,
    },
    progressSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -height * 0.04,
    },
    progressCircle: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressText: {
      position: 'absolute',
      fontSize: width * 0.032,
      fontWeight: '700',
      color: 'white',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: width * 0.02,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.gray.light,
      paddingVertical: height * 0.008,
      paddingHorizontal: width * 0.025,
      borderRadius: width * 0.015,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: 'white',
      fontSize: width * 0.028,
      fontWeight: '600',
    },
    primaryButton: {
      flex: 1,
      backgroundColor: Colors.purple.primary,
      paddingVertical: height * 0.008,
      paddingHorizontal: width * 0.025,
      borderRadius: width * 0.015,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: 'white',
      fontSize: width * 0.028,
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.daysLeftTag}>
          <Text style={styles.daysLeftTagText}>{daysLeft} days left</Text>
        </View>
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      <View style={styles.contentRow}>
        <View style={styles.textSection}>
          <Text style={styles.description}>
            Track your progress and stay motivated
          </Text>
        </View>
        
        <View style={styles.progressSection}>
          <View style={styles.progressCircle}>
            <CircularProgress
              size={width * 0.15}
              strokeWidth={width * 0.01}
              progress={progress}
              progressColor={Colors.purple.primary}
            />
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onSetNewGoal}>
          <Text style={styles.secondaryButtonText}>Set New Goal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.primaryButton} onPress={onUpdateGoal}>
          <Text style={styles.primaryButtonText}>Update Goal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.daysLeftTag}>
          <Text style={styles.daysLeftText}>{`${daysLeft} days left`}</Text>
        </View>
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      <View style={styles.progressSection}>
        <View style={styles.progressCircle}>
          <CircularProgress
            progress={progress}
            size={100}
            strokeWidth={8}
            backgroundColor={Colors.gray.light}
            progressColor={Colors.red.accent}
          />
          <Text style={styles.progressText}>{`${progress}%`}</Text>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray.dark,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  daysLeftTag: {
    backgroundColor: Colors.yellow.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  daysLeftText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray.dark,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: Colors.gray.light,
    marginBottom: 20,
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressCircle: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.gray.light,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.purple.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

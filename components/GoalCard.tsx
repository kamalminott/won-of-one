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
      
      <View style={styles.contentRow}>
        <View style={styles.textSection}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        
        <View style={styles.progressSection}>
          <View style={styles.progressCircle}>
            <CircularProgress
              progress={progress}
              size={60}
              strokeWidth={5}
              backgroundColor={Colors.gray.light}
              progressColor={Colors.red.accent}
            />
            <Text style={styles.progressText}>{`${progress}%`}</Text>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray.dark,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  daysLeftTag: {
    backgroundColor: Colors.yellow.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  daysLeftText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gray.dark,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: Colors.gray.light,
    marginBottom: 0,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  textSection: {
    flex: 1,
    marginRight: 16,
  },
  progressSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircle: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.gray.light,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.purple.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ProgressCardProps {
  title: string;
  current: number;
  total: number;
  subtitle?: string;
  daysRemaining?: number;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  current,
  total,
  subtitle,
  daysRemaining,
}) => {
  const progress = current / total;
  
  return (
    <View style={styles.container}>
              <LinearGradient
          colors={Colors.purple.gradient as [string, string]}
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.progressText}>{`${current}/${total}`}</Text>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 50}%` }]} />
            </View>
          </View>
          
          {daysRemaining && (
            <Text style={styles.daysRemaining}>{`Days remaining: ${daysRemaining}`}</Text>
          )}
          
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
        
        {/* Decorative background shape */}
        <View style={styles.decorativeShape} />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gradientBackground: {
    padding: 10,
    position: 'relative',
  },
  content: {
    zIndex: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
  },
  progressBarContainer: {
    marginBottom: 12,
    width: '50%',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  daysRemaining: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  decorativeShape: {
    position: 'absolute',
    right: 15,
    top: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
});

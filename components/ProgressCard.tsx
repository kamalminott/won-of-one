import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
  const { width, height } = useWindowDimensions();
  const progress = current / total;
  
  const styles = StyleSheet.create({
    container: {
      borderRadius: width * 0.04,
      overflow: 'hidden',
      marginBottom: height * 0.01,
    },
    gradientBackground: {
      padding: width * 0.025,
      position: 'relative',
    },
    content: {
      zIndex: 2,
    },
    title: {
      fontSize: Math.round(width * 0.04),
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.008,
    },
    progressText: {
      fontSize: Math.round(width * 0.05),
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.015,
    },
    progressBarContainer: {
      marginBottom: height * 0.015,
      width: '50%',
    },
    progressBar: {
      height: height * 0.008,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: width * 0.008,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: 'white',
      borderRadius: width * 0.008,
    },
    daysRemaining: {
      fontSize: Math.round(width * 0.03),
      color: 'rgba(255, 255, 255, 0.8)',
    },
    subtitle: {
      fontSize: Math.round(width * 0.035),
      color: 'rgba(255, 255, 255, 0.7)',
      marginTop: height * 0.01,
    },
    decorativeShape: {
      position: 'absolute',
      top: -height * 0.05,
      right: -width * 0.05,
      width: width * 0.2,
      height: height * 0.2,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.1,
      zIndex: 1,
    },
  });
  
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

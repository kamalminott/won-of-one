import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CircularProgressProps {
  progress: number;
  size: number;
  strokeWidth: number;
  backgroundColor?: string;
  progressColor?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size,
  strokeWidth,
  backgroundColor = Colors.gray.light,
  progressColor = Colors.red.accent,
}) => {

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background circle */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          },
        ]}
      />
      
      {/* Progress circle using border radius trick */}
      <View
        style={[
          styles.progressCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: progressColor,
            borderTopColor: backgroundColor,
            borderRightColor: backgroundColor,
            transform: [
              { rotate: `${-90 + (progress / 100) * 360}deg` }
            ],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    borderStyle: 'solid',
  },
  progressCircle: {
    position: 'absolute',
    borderStyle: 'solid',
  },
});

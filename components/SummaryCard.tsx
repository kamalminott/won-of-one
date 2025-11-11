import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface SummaryCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  backgroundColor: string;
  isTall?: boolean; // Optional prop to make card taller
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  icon,
  value,
  label,
  backgroundColor,
  isTall = false,
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: width * 0.025,
      paddingVertical: isTall ? height * 0.02 : height * 0.015, // Smaller when isTall is true
      borderRadius: width * 0.03,
      marginHorizontal: width * 0.008,
      borderWidth: 1,
      borderColor: 'transparent', // Invisible border - forces iOS to respect borderRadius
      overflow: 'hidden', // Ensures content respects borderRadius
    },
    iconContainer: {
      marginRight: width * 0.02,
    },
    content: {
      flex: 1,
    },
    value: {
      fontSize: isTall ? width * 0.045 : width * 0.04, // Slightly smaller when tall
      fontWeight: '700',
      color: Colors.gray.dark,
      marginBottom: height * 0.003,
    },
    label: {
      fontSize: isTall ? width * 0.032 : width * 0.028, // Slightly smaller when tall
      color: Colors.gray.medium,
      fontWeight: '500',
    },
  });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.content}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
};

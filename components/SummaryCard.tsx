import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface SummaryCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  backgroundColor: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  icon,
  value,
  label,
  backgroundColor,
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: width * 0.025,
      paddingVertical: height * 0.015,
      borderRadius: width * 0.03,
      marginHorizontal: width * 0.008,
    },
    iconContainer: {
      marginRight: width * 0.02,
    },
    content: {
      flex: 1,
    },
    value: {
      fontSize: width * 0.04,
      fontWeight: '700',
      color: Colors.gray.dark,
      marginBottom: height * 0.003,
    },
    label: {
      fontSize: width * 0.028,
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

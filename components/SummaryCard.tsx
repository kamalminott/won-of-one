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
      padding: width * 0.03,
      borderRadius: width * 0.035,
      marginHorizontal: width * 0.008,
    },
    iconContainer: {
      marginRight: width * 0.025,
    },
    content: {
      flex: 1,
    },
    value: {
      fontSize: width * 0.045,
      fontWeight: '700',
      color: Colors.gray.dark,
      marginBottom: height * 0.004,
    },
    label: {
      fontSize: width * 0.032,
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

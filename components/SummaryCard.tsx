import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  iconContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gray.dark,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: Colors.gray.medium,
    fontWeight: '500',
  },
});

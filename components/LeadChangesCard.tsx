import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

interface LeadChangesCardProps {
  leadChanges: number;
}

export default function LeadChangesCard({ leadChanges }: LeadChangesCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>Lead Changes</Text>
      <View style={styles.statContent}>
        <View style={styles.statItem}>
          <View style={styles.statCircle}>
            <Text style={styles.statValue}>{leadChanges}</Text>
          </View>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    width: '48%',
    height: width * 0.35,
    backgroundColor: '#2A2A2A',
    borderRadius: width * 0.05,
    padding: width * 0.05,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: width * 0.01 },
    shadowOpacity: 0.04,
    shadowRadius: width * 0.075,
    elevation: 8,
  },
  statTitle: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.04,
    fontWeight: '500',
    color: 'white',
    marginBottom: width * 0.04,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statCircle: {
    width: width * 0.14,
    height: width * 0.14,
    borderRadius: width * 0.07,
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: width * 0.02,
  },
  statValue: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.06,
    fontWeight: '700',
    color: 'white',
  },
  statLabel: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.03,
    fontWeight: '400',
    color: 'white',
  },
});

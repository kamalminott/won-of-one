import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { CircularProgressWithChild } from 'react-native-circular-progress-indicator';

const { width } = Dimensions.get('window');

interface TimeLeadingCardProps {
  fencer1Name: string;
  fencer2Name: string;
  timeLeading: {
    fencer1: number;
    fencer2: number;
    tied: number;
  };
}

export default function TimeLeadingCard({ 
  fencer1Name, 
  fencer2Name, 
  timeLeading 
}: TimeLeadingCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>Time Leading</Text>
      <View style={styles.timeLeadingContent}>
        {/* Circular Progress Indicators */}
        <View style={styles.circularProgressRow}>
          <View style={styles.circularProgressContainer}>
            <CircularProgressWithChild
              value={timeLeading.fencer1}
              radius={width * 0.055}
              duration={1500}
              maxValue={100}
              activeStrokeColor={'#FF7675'}
              inActiveStrokeColor={'#393939'}
              strokeLinecap={'round'}
              activeStrokeWidth={width * 0.012}
              inActiveStrokeWidth={width * 0.008}
            >
              <Text style={styles.percentageText}>{timeLeading.fencer1}%</Text>
            </CircularProgressWithChild>
            {/* Legend below circle */}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF7675' }]} />
              <Text style={styles.legendText}>{fencer1Name}</Text>
            </View>
          </View>

          <View style={styles.circularProgressContainer}>
            <CircularProgressWithChild
              value={timeLeading.fencer2}
              radius={width * 0.055}
              duration={1500}
              maxValue={100}
              activeStrokeColor={'#00B894'}
              inActiveStrokeColor={'#393939'}
              strokeLinecap={'round'}
              activeStrokeWidth={width * 0.012}
              inActiveStrokeWidth={width * 0.008}
            >
              <Text style={styles.percentageText}>{timeLeading.fencer2}%</Text>
            </CircularProgressWithChild>
            {/* Legend below circle */}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#00B894' }]} />
              <Text style={styles.legendText}>{fencer2Name}</Text>
            </View>
          </View>

          <View style={styles.circularProgressContainer}>
            <CircularProgressWithChild
              value={timeLeading.tied}
              radius={width * 0.055}
              duration={1500}
              maxValue={100}
              activeStrokeColor={'#FFFFFF'}
              inActiveStrokeColor={'#393939'}
              strokeLinecap={'round'}
              activeStrokeWidth={width * 0.012}
              inActiveStrokeWidth={width * 0.008}
            >
              <Text style={styles.percentageText}>{timeLeading.tied}%</Text>
            </CircularProgressWithChild>
            {/* Legend below circle */}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFFFFF' }]} />
              <Text style={styles.legendText}>Tied</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: width * 0.05,
    padding: width * 0.05,
    marginBottom: width * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: width * 0.01 },
    shadowOpacity: 0.04,
    shadowRadius: width * 0.075,
    elevation: 8,
    width: '48%',
    height: width * 0.35,
  },
  statTitle: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.04,
    fontWeight: '500',
    color: 'white',
    marginBottom: width * 0.04,
  },
  timeLeadingContent: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: width * 0.03,
    paddingHorizontal: 0,
  },
  circularProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: 0,
  },
  circularProgressContainer: {
    alignItems: 'center',
    minWidth: width * 0.08,
    maxWidth: width * 0.1,
  },
  percentageText: {
    fontSize: width * 0.0275,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: width * 0.02,
    gap: width * 0.015,
  },
  legendDot: {
    width: width * 0.02,
    height: width * 0.02,
    borderRadius: width * 0.01,
  },
  legendText: {
    fontSize: width * 0.0225,
    color: '#FFFFFF',
    fontWeight: '400',
    textAlign: 'center',
    flexShrink: 1,
  },
});

import React from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ScoreProgressionChart, ScoringEvent } from './ScoreProgressionChart';

// Sample scoring events for testing
const sampleEvents: ScoringEvent[] = [
  { tMin: 0.5, scorer: 'user' },
  { tMin: 1.2, scorer: 'opponent' },
  { tMin: 2.1, scorer: 'user' },
  { tMin: 3.0, scorer: 'user' },
  { tMin: 4.5, scorer: 'opponent' },
  { tMin: 5.2, scorer: 'user' },
  { tMin: 6.8, scorer: 'opponent' },
  { tMin: 7.5, scorer: 'user' },
];

export const ScoreProgressionChartDemo: React.FC = () => {
  const { width } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1A1A1A',
      padding: width * 0.04,
    },
    title: {
      fontSize: Math.round(width * 0.06),
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      marginBottom: width * 0.06,
    },
    variantTitle: {
      fontSize: Math.round(width * 0.045),
      fontWeight: '600',
      color: 'white',
      marginTop: width * 0.06,
      marginBottom: width * 0.03,
    },
    description: {
      fontSize: Math.round(width * 0.035),
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: width * 0.04,
      lineHeight: Math.round(width * 0.05),
    },
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Score Progression Chart Variants</Text>
      
      <Text style={styles.description}>
        This demo shows all three visualization variants of the ScoreProgressionChart component.
        Each variant displays the same scoring events but with different visual representations.
        {'\n\n'}💡 Tap on any data point to see detailed information in a tooltip popup!
      </Text>

      <Text style={styles.variantTitle}>1. Dual Axis (Default)</Text>
      <Text style={styles.description}>
        One chart with shared X-axis (time) and dual Y-axes (left: user, right: opponent).
        Both lines are displayed on the same chart with different scales.
      </Text>
      <ScoreProgressionChart
        events={sampleEvents}
        variant="dualAxis"
        title="Dual Axis Chart"
        height={200}
      />

      <Text style={styles.variantTitle}>2. Stacked Charts</Text>
      <Text style={styles.description}>
        Two vertically stacked charts sharing the same X-axis.
        Top chart shows user scores, bottom chart shows opponent scores.
      </Text>
      <ScoreProgressionChart
        events={sampleEvents}
        variant="stacked"
        title="Stacked Charts"
        stackedHeights={{ top: 100, bottom: 100 }}
      />

      <Text style={styles.variantTitle}>3. Score Gap</Text>
      <Text style={styles.description}>
        Single chart showing the score differential (user - opponent).
        Positive values indicate user leading, negative values indicate opponent leading.
      </Text>
      <ScoreProgressionChart
        events={sampleEvents}
        variant="gap"
        title="Score Gap Chart"
        height={200}
      />

      <View style={{ height: 50 }} />
    </ScrollView>
  );
};

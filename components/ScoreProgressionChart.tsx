import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Shadow } from 'react-native-shadow-2';

interface ScoreProgressionChartProps {
  title?: string;
  customStyle?: object;
}

export const ScoreProgressionChart: React.FC<ScoreProgressionChartProps> = ({
  title = 'Score Progression',
  customStyle = {}
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.03,
      padding: width * 0.03,
      marginBottom: height * 0.015,
      marginHorizontal: width * 0.04,
      left: 0,
      right: 0,
    },
    title: {
      fontSize: Math.round(width * 0.035),
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.015,
      textAlign: 'center',
      alignSelf: 'center',
    },
    chartWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      width: '100%',
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: height * 0.015,
      gap: width * 0.04,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    legendDot: {
      width: width * 0.03,
      height: width * 0.03,
      borderRadius: width * 0.015,
      marginRight: width * 0.02,
    },
    legendText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: Math.round(width * 0.035),
    },
  });

  // Sample data showing both players' score progression
  const chartData = [
    { value: 0, dataPointText: '0' },
    { value: 5, dataPointText: '5' },
    { value: 8, dataPointText: '8' },
    { value: 12, dataPointText: '12' },
    { value: 15, dataPointText: '15' },
  ];

  return (
    <Shadow distance={8} startColor="rgba(0, 0, 0, 0.1)">
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        
        <View style={styles.chartWrapper}>
          <LineChart
            data={chartData}
            secondaryData={[
              { value: 0, dataPointText: '0' },
              { value: 3, dataPointText: '3' },
              { value: 6, dataPointText: '6' },
              { value: 9, dataPointText: '9' },
              { value: 12, dataPointText: '12' },
            ]}
            height={height * 0.15}
            width={width * 0.8}
            color="#10B981"
            secondaryLineConfig={{
              color: '#EF4444',
              thickness: 3,
              dataPointsColor: '#EF4444',
            }}
            thickness={3}
            dataPointsColor="#10B981"
            dataPointsRadius={4}
            curved
            showVerticalLines
            verticalLinesColor="rgba(255, 255, 255, 0.1)"
            yAxisColor="rgba(255, 255, 255, 0.3)"
            xAxisColor="rgba(255, 255, 255, 0.3)"
            yAxisTextStyle={{ color: 'rgba(255, 255, 255, 0.7)' }}
          />
        </View>
        
        {/* Legend showing both players */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>You (15)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Opponent (12)</Text>
          </View>
        </View>
      </View>
    </Shadow>
  );
};

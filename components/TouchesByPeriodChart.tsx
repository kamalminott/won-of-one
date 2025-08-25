import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface TouchesByPeriodChartProps {
  title?: string;
  customStyle?: object;
}

export const TouchesByPeriodChart: React.FC<TouchesByPeriodChartProps> = ({
  title = 'Touches by Period',
  customStyle = {}
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.02,
      padding: width * 0.04,
      marginHorizontal: width * 0.01,
      flex: 1,
      height: height * 0.22,
      marginBottom: height * 0.01,
    },
    title: {
      fontSize: Math.round(width * 0.04),
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.008,
      textAlign: 'center',
    },
    chartContainer: {
      alignItems: 'flex-start',
      justifyContent: 'center',
      overflow: 'hidden',
      width: '100%',
      paddingBottom: height * 0.01,
      paddingLeft: 0,
      marginLeft: -(width * 0.03),
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: height * 0.01,
      gap: width * 0.04,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    legendDot: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
      marginRight: width * 0.015,
    },
    legendText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: Math.round(width * 0.025),
    },
  });

  // Sample data for touches by period - both user and opponent side by side
  const chartData = [
    { value: 4, label: 'P1', frontColor: '#10B981' },
    { value: 3, label: 'P1', frontColor: '#EF4444' },
    { value: 6, label: 'P2', frontColor: '#10B981' },
    { value: 5, label: 'P2', frontColor: '#EF4444' },
    { value: 8, label: 'P3', frontColor: '#10B981' },
    { value: 7, label: 'P3', frontColor: '#EF4444' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.chartContainer}>
        <BarChart
          data={chartData}
          height={height * 0.12}
          width={width * 0.35}
          barWidth={Math.round(width * 0.035)}
          spacing={Math.round(width * 0.02)}
          hideRules
          xAxisColor="rgba(255, 255, 255, 0.3)"
          yAxisColor="rgba(255, 255, 255, 0.3)"
          yAxisTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.02), marginRight: Math.round(width * 0.015) }}
          xAxisLabelTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.02) }}
          barBorderRadius={Math.round(width * 0.008)}
        />
      </View>
      
      {/* Legend showing both players */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Opponent</Text>
        </View>
      </View>
    </View>
  );
};

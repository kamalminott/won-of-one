import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Colors } from '@/constants/Colors';

interface TouchTimelineChartProps {
  userData?: Array<{ value: number; label: string }>;
  opponentData?: Array<{ value: number; label: string }>;
}

export const TouchTimelineChart: React.FC<TouchTimelineChartProps> = ({
  userData = [
    { value: 0, label: '0:00' },
    { value: 2, label: '0:30' },
    { value: 3, label: '1:00' },
    { value: 5, label: '1:30' },
    { value: 4, label: '2:00' },
    { value: 6, label: '2:30' },
    { value: 5, label: '3:00' },
    { value: 7, label: '3:50' },
  ],
  opponentData = [
    { value: 0, label: '0:00' },
    { value: 1, label: '0:30' },
    { value: 2, label: '1:00' },
    { value: 3, label: '1:30' },
    { value: 4, label: '2:00' },
    { value: 3, label: '2:30' },
    { value: 4, label: '3:00' },
    { value: 5, label: '3:50' },
  ]
}) => {
  const { width, height } = useWindowDimensions();

  const userChartData = userData.map((item, index) => ({
    value: item.value,
    label: item.label,
    dataPointText: item.value.toString(),
    dataPointColor: Colors.green.accent,
    dataPointRadius: width * 0.01,
  }));

  const opponentChartData = opponentData.map((item, index) => ({
    value: item.value,
    label: item.label,
    dataPointText: item.value.toString(),
    dataPointColor: Colors.red.accent,
    dataPointRadius: width * 0.01,
  }));

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      padding: width * 0.03,
      marginBottom: height * 0.03,
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
    },
    title: {
      fontSize: width * 0.045,
      fontWeight: '500',
      color: 'white',
      marginBottom: height * 0.02,
    },
    chartContainer: {
      height: height * 0.22,
      alignItems: 'center',
      justifyContent: 'center',
    },


    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: height * 0.015,
      gap: width * 0.04,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.015,
    },
    legendDot: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
    },
    legendText: {
      color: 'white',
      fontSize: width * 0.035,
      fontWeight: '500',
    },
    yAxisLabels: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'space-between',
      paddingVertical: height * 0.02,
    },
    yAxisLabel: {
      color: '#9D9D9D',
      fontSize: width * 0.03,
      fontWeight: '400',
      textAlign: 'right',
      width: width * 0.08,
    },
    xAxisLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: height * 0.01,
      paddingHorizontal: width * 0.02,
    },
    xAxisLabel: {
      color: '#9D9D9D',
      fontSize: width * 0.03,
      fontWeight: '400',
      textAlign: 'center',
      flex: 1,
    },
    gridLines: {
      position: 'absolute',
      left: width * 0.08,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'space-between',
    },
    gridLine: {
      width: '100%',
      height: 1,
      backgroundColor: '#464646',
      opacity: 0.3,
    },
  });

  const yAxisData = [
    { value: 30, label: '30' },
    { value: 20, label: '20' },
    { value: 10, label: '10' },
    { value: 0, label: '0' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Touch Timeline</Text>
      
      <View style={styles.chartContainer}>
        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.green.accent }]} />
            <Text style={styles.legendText}>You</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.red.accent }]} />
            <Text style={styles.legendText}>Opponent</Text>
          </View>
        </View>

        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          {yAxisData.map((item, index) => (
            <Text key={index} style={styles.yAxisLabel}>
              {item.label}
            </Text>
          ))}
        </View>

        {/* Grid lines */}
        <View style={styles.gridLines}>
          {yAxisData.map((item, index) => (
            <View key={index} style={styles.gridLine} />
          ))}
        </View>

        {/* Single LineChart with Multiple Datasets using secondaryData */}
        <LineChart
          data={userChartData}
          secondaryData={opponentChartData}
          width={width * 0.8}
          height={height * 0.18}
          hideDataPoints={false}
          thickness={3}
          startFillColor="transparent"
          endFillColor="transparent"
          initialSpacing={0}
          endSpacing={0}
          noOfSections={3}
          yAxisColor="transparent"
          xAxisColor="transparent"
          yAxisTextStyle={{ color: 'transparent' }}
          xAxisLabelTextStyle={{ color: 'transparent' }}
          curved
          isAnimated
          animationDuration={1000}
          color={Colors.green.accent}
          secondaryLineConfig={{
            color: Colors.red.accent,
            thickness: 3,
            dataPointsColor: Colors.red.accent,
          }}
          dataPointsColor={Colors.green.accent}
          dataPointsRadius={width * 0.01}
        />

        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          {userData.map((item, index) => (
            <Text key={index} style={styles.xAxisLabel}>
              {item.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};

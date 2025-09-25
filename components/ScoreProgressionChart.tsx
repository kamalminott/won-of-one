import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LineChart as RNChartKit } from 'react-native-chart-kit';
import { LineChart } from 'react-native-gifted-charts';

// Types
type ScoringEvent = { tMin: number; scorer: 'user' | 'opponent' };

type ScoreSeries = { x: number; y: number }[];

type BuildScoreSeriesResult = {
  userSeries: ScoreSeries;
  oppSeries: ScoreSeries;
  gapSeries: ScoreSeries;
  xDomain: [number, number];
  yDomains: {
    user: [number, number];
    opponent: [number, number];
    gap: [number, number];
  };
};

type TooltipData = {
  time: string;
  scorer: 'user' | 'opponent';
  userScore: number;
  opponentScore: number;
  gap?: number;
  x: number;
  y: number;
};

// Utility function to build score series from events
const buildScoreSeries = (events: ScoringEvent[]): BuildScoreSeriesResult => {
  if (events.length === 0) {
    return {
      userSeries: [{ x: 0, y: 0 }],
      oppSeries: [{ x: 0, y: 0 }],
      gapSeries: [{ x: 0, y: 0 }],
      xDomain: [0, 1],
      yDomains: {
        user: [0, 1],
        opponent: [0, 1],
        gap: [-1, 1]
      }
    };
  }

  // Sort events by time
  const sortedEvents = [...events].sort((a, b) => a.tMin - b.tMin);
  
  const startTime = sortedEvents[0].tMin;
  const endTime = sortedEvents[sortedEvents.length - 1].tMin;
  
  // Initialize series with starting point
  const userSeries: ScoreSeries = [{ x: startTime, y: 0 }];
  const oppSeries: ScoreSeries = [{ x: startTime, y: 0 }];
  const gapSeries: ScoreSeries = [{ x: startTime, y: 0 }];
  
  let userScore = 0;
  let oppScore = 0;
  
  // Process each event
  for (const event of sortedEvents) {
    if (event.scorer === 'user') {
      userScore++;
    } else {
      oppScore++;
    }
    
    // Add step points for both series
    userSeries.push({ x: event.tMin, y: userScore });
    oppSeries.push({ x: event.tMin, y: oppScore });
    gapSeries.push({ x: event.tMin, y: userScore - oppScore });
  }
  
  // Calculate domains
  const xDomain: [number, number] = [startTime, endTime];
  const userMax = Math.max(...userSeries.map(p => p.y));
  const oppMax = Math.max(...oppSeries.map(p => p.y));
  const gapMax = Math.max(...gapSeries.map(p => Math.abs(p.y)));
  
  const yDomains = {
    user: [0, Math.max(userMax, 1)] as [number, number],
    opponent: [0, Math.max(oppMax, 1)] as [number, number],
    gap: [-Math.max(gapMax, 1), Math.max(gapMax, 1)] as [number, number]
  };
  
  return {
    userSeries,
    oppSeries,
    gapSeries,
    xDomain,
    yDomains
  };
};

interface ScoreProgressionChartProps {
  // New API
  events?: ScoringEvent[];
  variant?: 'dualAxis' | 'stacked' | 'gap';
  height?: number;
  stackedHeights?: { top: number; bottom: number };
  styleOverrides?: Partial<{
    container: object;
    title: object;
    chartWrapper: object;
    legend: object;
    legendItem: object;
    legendDot: object;
    legendText: object;
  }>;
  
  // Legacy API (for backward compatibility)
  title?: string;
  customStyle?: object;
  scoreProgression?: {
    userData: Array<{ x: string; y: number }>;
    opponentData: Array<{ x: string; y: number }>;
  };
  userScore?: number;
  opponentScore?: number;
  userLabel?: string;
  opponentLabel?: string;
}

export const ScoreProgressionChart: React.FC<ScoreProgressionChartProps> = ({
  // New API
  events,
  variant = 'dualAxis',
  height,
  stackedHeights = { top: 80, bottom: 80 },
  styleOverrides,
  
  // Legacy API
  title = 'Score Progression',
  customStyle = {},
  scoreProgression,
  userScore = 0,
  opponentScore = 0,
  userLabel = 'You',
  opponentLabel = 'Opponent'
}) => {
  const { width, height: screenHeight } = useWindowDimensions();

  // Tooltip state
  // Victory Native handles tooltips natively, no need for state management

  // Memoized data transformation
  const chartData = useMemo(() => {
    if (events && events.length > 0) {
      return buildScoreSeries(events);
    }
    
    // Fallback to legacy data format
    if (scoreProgression && (scoreProgression.userData.length > 0 || scoreProgression.opponentData.length > 0)) {
      // Debug logging for original data
      console.log('📊 Original Score Progression Data:');
      console.log('📊 User data:', scoreProgression.userData);
      console.log('📊 Opponent data:', scoreProgression.opponentData);
      console.log('📊 User data length:', scoreProgression.userData.length);
      console.log('📊 Opponent data length:', scoreProgression.opponentData.length);
      console.log('📊 First user point:', scoreProgression.userData[0]);
      console.log('📊 First opponent point:', scoreProgression.opponentData[0]);
      
      // Check for duplicate Y values
      const userYValues = scoreProgression.userData.map(p => p.y);
      const opponentYValues = scoreProgression.opponentData.map(p => p.y);
      console.log('📊 User Y values:', userYValues);
      console.log('📊 Opponent Y values:', opponentYValues);
      console.log('📊 Duplicate user Y values:', userYValues.filter((value, index) => userYValues.indexOf(value) !== index));
      console.log('📊 Duplicate opponent Y values:', opponentYValues.filter((value, index) => opponentYValues.indexOf(value) !== index));
      
      // Convert legacy format directly to chart data, preserving actual Y values
      const userSeries: ScoreSeries = scoreProgression.userData.map(point => {
        const timeStr = point.x.replace(/[()]/g, ''); // Remove parentheses
        const [minutes, seconds] = timeStr.split(':').map(Number);
        const totalSeconds = (minutes * 60) + seconds; // Convert to total seconds
        console.log(`📊 Converting user point: "${point.x}" -> "${timeStr}" -> ${totalSeconds}s`);
        return { x: totalSeconds, y: point.y }; // Use seconds instead of decimal minutes
      });
      
      const oppSeries: ScoreSeries = scoreProgression.opponentData.map(point => {
        const timeStr = point.x.replace(/[()]/g, ''); // Remove parentheses
        const [minutes, seconds] = timeStr.split(':').map(Number);
        const totalSeconds = (minutes * 60) + seconds; // Convert to total seconds
        console.log(`📊 Converting opponent point: "${point.x}" -> "${timeStr}" -> ${totalSeconds}s`);
        return { x: totalSeconds, y: point.y }; // Use seconds instead of decimal minutes
      });
      
      // Calculate gap series
      const gapSeries: ScoreSeries = [];
      const allTimes = new Set([...userSeries.map(p => p.x), ...oppSeries.map(p => p.x)]);
      const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
      
      for (const time of sortedTimes) {
        const userPoint = userSeries.find(p => p.x === time);
        const oppPoint = oppSeries.find(p => p.x === time);
        const userScore = userPoint ? userPoint.y : (userSeries.find(p => p.x < time)?.y || 0);
        const oppScore = oppPoint ? oppPoint.y : (oppSeries.find(p => p.x < time)?.y || 0);
        gapSeries.push({ x: time, y: userScore - oppScore });
      }
      
      // Calculate domains
      const xDomain: [number, number] = sortedTimes.length > 0 ? [sortedTimes[0], sortedTimes[sortedTimes.length - 1]] : [0, 1];
      const userMax = Math.max(...userSeries.map(p => p.y));
      const oppMax = Math.max(...oppSeries.map(p => p.y));
      const gapMax = Math.max(...gapSeries.map(p => Math.abs(p.y)));
      
      const yDomains = {
        user: [0, Math.max(userMax, 1)] as [number, number],
        opponent: [0, Math.max(oppMax, 1)] as [number, number],
        gap: [-Math.max(gapMax, 1), Math.max(gapMax, 1)] as [number, number]
      };
      
      return {
        userSeries,
        oppSeries,
        gapSeries,
        xDomain,
        yDomains
      };
    }
    
    return buildScoreSeries([]);
  }, [events, scoreProgression]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.03,
      padding: width * 0.03,
      marginBottom: screenHeight * 0.015,
      marginHorizontal: width * 0.04,
      left: 0,
      right: 0,
      overflow: 'hidden',
    },
    title: {
      fontSize: Math.round(width * 0.035),
      fontWeight: '600',
      color: 'white',
      marginBottom: screenHeight * 0.015,
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
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: screenHeight * 0,
      gap: width * 0.03,
      paddingHorizontal: width * 0.02,
      flexWrap: 'wrap',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    legendDot: {
      width: width * 0.025,
      height: width * 0.025,
      borderRadius: width * 0.0125,
      marginRight: width * 0.015,
    },
    legendText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: Math.round(width * 0.03),
      flexShrink: 1,
    },
    // Victory Native handles tooltips natively, no custom styles needed
  });

  // Convert chart data to LineChart format
  const userChartData = chartData.userSeries.map(item => ({
    value: item.y,
    dataPointText: item.y.toString(),
    label: `(${Math.floor(item.x)}:${Math.round((item.x % 1) * 60).toString().padStart(2, '0')})`
  }));

  const opponentChartData = chartData.oppSeries.map(item => ({
    value: item.y,
    dataPointText: item.y.toString(),
    label: `(${Math.floor(item.x)}:${Math.round((item.x % 1) * 60).toString().padStart(2, '0')})`
  }));

  // Debug logging
  console.log('📊 Chart Data Debug:');
  console.log('📊 User series:', chartData.userSeries);
  console.log('📊 Opponent series:', chartData.oppSeries);
  console.log('📊 User chart data:', userChartData);
  console.log('📊 Opponent chart data:', opponentChartData);

  const gapChartData = chartData.gapSeries.map(item => ({
    value: item.y,
    dataPointText: item.y.toString(),
    label: `(${Math.floor(item.x)}:${Math.round((item.x % 1) * 60).toString().padStart(2, '0')})`
  }));

  // Determine chart height
  const chartHeight = height || screenHeight * 0.25; // Increased from 0.15 to 0.25 for larger chart

  // Victory Native handles tooltips natively, so we don't need these functions anymore

  // Victory Native handles tooltips natively with VictoryVoronoiContainer

  // Render different variants
  const renderChart = () => {
    switch (variant) {
      case 'dualAxis':
        // Create combined time points for both series
        const allTimePoints = new Set([
          ...chartData.userSeries.map(p => p.x),
          ...chartData.oppSeries.map(p => p.x)
        ]);
        
        const sortedTimePoints = Array.from(allTimePoints).sort((a, b) => a - b);
        
        console.log('📊 Chart data debug:');
        console.log('📊 User series:', chartData.userSeries);
        console.log('📊 Opponent series:', chartData.oppSeries);
        console.log('📊 All time points:', Array.from(allTimePoints));
        console.log('📊 Sorted time points:', sortedTimePoints);
        
        // Create data for React Native Chart Kit with proper alignment
        const timeLabels = sortedTimePoints.map(time => {
          const minutes = Math.floor(time / 60);
          const seconds = Math.round(time % 60);
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        });
        
        // Scrollable for > 9 data points, static for ≤ 9 data points
        const isScrollable = timeLabels.length > 9;
        const pointWidth = 60; // Width per data point for scrollable chart
        const scrollableChartWidth = Math.max(width * 0.9, timeLabels.length * pointWidth);
        
        // Always use all labels - no filtering
        const displayLabels = timeLabels;
        
        console.log('📊 Time labels:', timeLabels);
        console.log('📊 Display labels:', displayLabels);
        console.log('📊 Is scrollable:', isScrollable);
        console.log('📊 Chart width:', isScrollable ? scrollableChartWidth : width * 0.9);
        
        // Create user data array aligned with time points - ensure no duplicate Y values
        const userData = sortedTimePoints.map(time => {
          // Find the last user score at or before this time point
          const lastUserPoint = chartData.userSeries
            .filter(p => p.x <= time)
            .sort((a, b) => b.x - a.x)[0];
          return lastUserPoint ? lastUserPoint.y : 0;
        });
        
        // Create opponent data array aligned with time points - ensure no duplicate Y values
        const opponentData = sortedTimePoints.map(time => {
          // Find the last opponent score at or before this time point
          const lastOppPoint = chartData.oppSeries
            .filter(p => p.x <= time)
            .sort((a, b) => b.x - a.x)[0];
          return lastOppPoint ? lastOppPoint.y : 0;
        });
        
        // Use the original data without padding to prevent extending beyond X-axis
        const maxUserScore = Math.max(...userData, 0);
        const maxOpponentScore = Math.max(...opponentData, 0);
        const maxScore = Math.max(maxUserScore, maxOpponentScore, 5); // Minimum range of 0-5
        
        // Use original data without padding
        const paddedUserData = [...userData];
        const paddedOpponentData = [...opponentData];
        const paddedLabels = [...timeLabels];
        
        console.log('📊 Chart Kit Labels:', timeLabels);
        console.log('📊 User Data:', userData);
        console.log('📊 Opponent Data:', opponentData);
        console.log('📊 User Data length:', userData.length);
        console.log('📊 Opponent Data length:', opponentData.length);
        console.log('📊 Unique User Y values:', [...new Set(userData)]);
        console.log('📊 Unique Opponent Y values:', [...new Set(opponentData)]);
        
        const chartData_kit = {
          labels: displayLabels,
          datasets: [
            {
              data: paddedUserData,
              color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green for user
              strokeWidth: 3,
            },
            {
              data: paddedOpponentData,
              color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red for opponent
              strokeWidth: 3,
            }
          ]
        };

        // Calculate maxValue BEFORE using it in chartConfig
        const maxValue = Math.max(
          ...chartData.userSeries.map(p => p.y),
          ...chartData.oppSeries.map(p => p.y),
          1
        );
        
        const chartConfig = {
          backgroundColor: "#2B2B2B", // Match the card background color
          backgroundGradientFrom: "#2B2B2B",
          backgroundGradientTo: "#2B2B2B",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: {
            borderRadius: 16,
            paddingLeft: 10 // Increased padding to ensure y-axis labels are visible
          },
          propsForDots: {
            r: "4",
            strokeWidth: "2",
            stroke: "#fff"
          },
          propsForBackgroundLines: {
            strokeDasharray: "",
            stroke: "rgba(255, 255, 255, 0.3)",
            strokeWidth: 1
          },
          propsForLabels: {
            fontSize: 10,
            fill: "rgba(255, 255, 255, 0.7)"
          },
          propsForVerticalLabels: {
            fontSize: 10,
            fill: "rgba(255, 255, 255, 0.7)",
            rotation: 0
          },
          // Y-axis label configuration - try different approach
          propsForHorizontalLabels: {
            fontSize: 12,
            fill: "rgba(255, 255, 255, 0.9)",
            fontWeight: "500"
          },
          // Force y-axis labels to show
          formatYLabel: (yValue: string) => yValue,
          count: Math.min(maxValue, 5) // Ensure we have proper segments
        };

        const chartComponent = (
          <TouchableOpacity
            onPress={() => {
              console.log('📊 Chart tapped - tooltip functionality can be added here');
            }}
            activeOpacity={0.8}
          >
            <RNChartKit
              data={chartData_kit}
              width={isScrollable ? scrollableChartWidth : width * 0.85}
              height={chartHeight - 40}
              chartConfig={chartConfig}
              bezier={false}
              style={{
                marginVertical: 0,
                borderRadius: 16
              }}
              withDots={true}
              withShadow={false}
              withScrollableDot={false}
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLines={true}
              withHorizontalLines={true}
              fromZero={true}
              segments={Math.min(maxValue, 5)}
            />
          </TouchableOpacity>
        );

        return (
          <View style={{ height: chartHeight, width: width * 1, overflow: 'visible', marginLeft: 0, paddingLeft: width * 0.02 }}>
            {isScrollable ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: width * 0.1 }}
              >
                {chartComponent}
              </ScrollView>
            ) : (
              chartComponent
            )}
          </View>
        );
        
      case 'stacked':
        return (
          <View>
            {/* Top chart - User */}
            <LineChart
              data={userChartData}
              height={stackedHeights.top}
              width={width * 0.8}
              color="#10B981"
              thickness={3}
              dataPointsColor="#10B981"
              dataPointsRadius={4}
              curved
              showVerticalLines
              verticalLinesColor="rgba(255, 255, 255, 0.1)"
              yAxisColor="rgba(255, 255, 255, 0.3)"
              xAxisColor="rgba(255, 255, 255, 0.3)"
              yAxisTextStyle={{ color: 'rgba(255, 255, 255, 0.7)' }}
              xAxisLabelTextStyle={{ color: 'transparent', fontSize: Math.round(width * 0.025) }}
            />
            {/* Bottom chart - Opponent */}
            <LineChart
              data={opponentChartData}
              height={stackedHeights.bottom}
              width={width * 0.8}
              color="#EF4444"
              thickness={3}
              dataPointsColor="#EF4444"
              dataPointsRadius={4}
              curved
              showVerticalLines
              verticalLinesColor="rgba(255, 255, 255, 0.1)"
              yAxisColor="rgba(255, 255, 255, 0.3)"
              xAxisColor="rgba(255, 255, 255, 0.3)"
              yAxisTextStyle={{ color: 'rgba(255, 255, 255, 0.7)' }}
              xAxisLabelTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.025) }}
            />
          </View>
        );
        
      case 'gap':
        return (
          <LineChart
            data={gapChartData}
            height={chartHeight}
            width={width * 0.8}
            color="#10B981"
            thickness={3}
            dataPointsColor="#10B981"
            dataPointsRadius={4}
            curved
            showVerticalLines
            verticalLinesColor="rgba(255, 255, 255, 0.1)"
            yAxisColor="rgba(255, 255, 255, 0.3)"
            xAxisColor="rgba(255, 255, 255, 0.3)"
            yAxisTextStyle={{ color: 'rgba(255, 255, 255, 0.7)' }}
            xAxisLabelTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.025) }}
            rulesColor="rgba(255, 255, 255, 0.3)"
            rulesType="solid"
          />
        );
        
      default:
        return (
          <LineChart
            data={userChartData}
            height={chartHeight}
            width={width * 0.8}
            color="#10B981"
            thickness={3}
            dataPointsColor="#10B981"
            dataPointsRadius={4}
            curved
            showVerticalLines
            verticalLinesColor="rgba(255, 255, 255, 0.1)"
            yAxisColor="rgba(255, 255, 255, 0.3)"
            xAxisColor="rgba(255, 255, 255, 0.3)"
            yAxisTextStyle={{ color: 'rgba(255, 255, 255, 0.7)' }}
            xAxisLabelTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.025) }}
          />
        );
    }
  };

  // Render legend based on variant
  const renderLegend = () => {
    // Determine if chart is scrollable for dualAxis variant - use same logic as chart rendering
    let isScrollable = false;
    if (variant === 'dualAxis' && events) {
      // Calculate timeLabels the same way as in chart rendering
      const allTimePoints = new Set([
        ...chartData.userSeries.map(p => p.x),
        ...chartData.oppSeries.map(p => p.x)
      ]);
      const sortedTimePoints = Array.from(allTimePoints).sort((a, b) => a - b);
      isScrollable = sortedTimePoints.length > 9;
    }
    
    // Apply different styles based on scrollability
    console.log('📊 Legend scrollable check:', { isScrollable, variant, eventsLength: events?.length });
    const legendStyle = isScrollable 
      ? [styles.legend, { marginTop: -(screenHeight * 0.070) }]
      : [styles.legend, { marginTop: -(screenHeight * 0.025) }];
    
    switch (variant) {
      case 'dualAxis':
        return (
          <View style={legendStyle}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>{userLabel} ({userScore})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>{opponentLabel} ({opponentScore})</Text>
            </View>
          </View>
        );
        
      case 'gap':
        return (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Score Gap ({userLabel} − {opponentLabel})</Text>
            </View>
          </View>
        );
        
      default:
        return (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>{userLabel} ({userScore})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>{opponentLabel} ({opponentScore})</Text>
            </View>
          </View>
        );
    }
  };

  // Victory Native handles tooltips natively, no need for custom tooltip rendering

  return (
    <View style={[styles.container, styleOverrides?.container]}>
      <Text style={[styles.title, styleOverrides?.title]}>{title}</Text>
      
      <View style={[styles.chartWrapper, styleOverrides?.chartWrapper]}>
        {renderChart()}
      </View>
      
      {renderLegend()}
    </View>
  );
};

// Export the utility function for external use
export { buildScoreSeries };
export type { BuildScoreSeriesResult, ScoreSeries, ScoringEvent };


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Shadow } from 'react-native-shadow-2';

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
  opponentScore = 0
}) => {
  const { width, height: screenHeight } = useWindowDimensions();

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide tooltip after 3 seconds
  useEffect(() => {
    if (tooltip) {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltip(null);
      }, 3000);
    }
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [tooltip]);

  // Memoized data transformation
  const chartData = useMemo(() => {
    if (events && events.length > 0) {
      return buildScoreSeries(events);
    }
    
    // Fallback to legacy data format
    if (scoreProgression && scoreProgression.userData && scoreProgression.userData.length > 0) {
      // Convert legacy format to new format
      const userEvents: ScoringEvent[] = [];
      const oppEvents: ScoringEvent[] = [];
      
      scoreProgression.userData.forEach((point, index) => {
        if (index > 0) { // Skip initial point
          const timeStr = point.x.replace(/[()]/g, ''); // Remove parentheses
          const [minutes, seconds] = timeStr.split(':').map(Number);
          const tMin = minutes + (seconds / 60);
          userEvents.push({ tMin, scorer: 'user' });
        }
      });
      
      scoreProgression.opponentData.forEach((point, index) => {
        if (index > 0) { // Skip initial point
          const timeStr = point.x.replace(/[()]/g, ''); // Remove parentheses
          const [minutes, seconds] = timeStr.split(':').map(Number);
          const tMin = minutes + (seconds / 60);
          oppEvents.push({ tMin, scorer: 'opponent' });
        }
      });
      
      const allEvents = [...userEvents, ...oppEvents].sort((a, b) => a.tMin - b.tMin);
      return buildScoreSeries(allEvents);
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
      justifyContent: 'center',
      marginTop: screenHeight * 0.015,
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
    tooltip: {
      position: 'absolute',
      backgroundColor: '#1A1A1A',
      borderRadius: width * 0.02,
      padding: width * 0.03,
      minWidth: width * 0.25,
      maxWidth: width * 0.4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 1000,
    },
    tooltipText: {
      color: 'white',
      fontSize: Math.round(width * 0.03),
      fontWeight: '500',
      marginBottom: width * 0.01,
    },
    tooltipTime: {
      color: '#10B981',
      fontSize: Math.round(width * 0.032),
      fontWeight: '600',
      marginBottom: width * 0.015,
    },
    tooltipScores: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: width * 0.01,
    },
    tooltipScore: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: Math.round(width * 0.028),
    },
    tooltipGap: {
      color: '#10B981',
      fontSize: Math.round(width * 0.03),
      fontWeight: '600',
      textAlign: 'center',
      marginTop: width * 0.01,
    },
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

  const gapChartData = chartData.gapSeries.map(item => ({
    value: item.y,
    dataPointText: item.y.toString(),
    label: `(${Math.floor(item.x)}:${Math.round((item.x % 1) * 60).toString().padStart(2, '0')})`
  }));

  // Determine chart height
  const chartHeight = height || screenHeight * 0.15;

  // Handle tooltip data point press
  const handleDataPointPress = (data: any, index: number, seriesType: 'user' | 'opponent' | 'gap' = 'user') => {
    if (!chartData.userSeries.length) return;

    // Find the corresponding data point in our series
    let pointData: { x: number; y: number } | null = null;
    let scorer: 'user' | 'opponent' = 'user';

    if (seriesType === 'user') {
      pointData = chartData.userSeries[index];
      scorer = 'user';
    } else if (seriesType === 'opponent') {
      pointData = chartData.oppSeries[index];
      scorer = 'opponent';
    } else if (seriesType === 'gap') {
      pointData = chartData.gapSeries[index];
      // For gap, we need to determine who scored at this point
      const userPoint = chartData.userSeries[index];
      const oppPoint = chartData.oppSeries[index];
      if (userPoint && oppPoint) {
        // Find the most recent scoring event at this time
        const time = userPoint.x;
        const scoringEvents = events || [];
        const eventAtTime = scoringEvents.find((e: ScoringEvent) => Math.abs(e.tMin - time) < 0.1);
        scorer = eventAtTime?.scorer || 'user';
      }
    }

    if (!pointData) return;

    // Calculate time string
    const minutes = Math.floor(pointData.x);
    const seconds = Math.round((pointData.x % 1) * 60);
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Get scores at this point
    const userScoreAtTime = chartData.userSeries[index]?.y || 0;
    const opponentScoreAtTime = chartData.oppSeries[index]?.y || 0;
    const gapAtTime = userScoreAtTime - opponentScoreAtTime;

    // Calculate approximate position (this is a rough estimate)
    const chartWidth = width * 0.8;
    const xPosition = (index / Math.max(chartData.userSeries.length - 1, 1)) * chartWidth;
    const yPosition = chartHeight * 0.3; // Rough estimate for tooltip position

    setTooltip({
      time: timeString,
      scorer,
      userScore: userScoreAtTime,
      opponentScore: opponentScoreAtTime,
      gap: gapAtTime,
      x: xPosition,
      y: yPosition,
    });
  };

  // Render different variants
  const renderChart = () => {
    switch (variant) {
      case 'dualAxis':
        return (
          <LineChart
            data={userChartData}
            secondaryData={opponentChartData}
            height={chartHeight}
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
            xAxisLabelTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.025) }}
            onPress={(data: any, index: number) => handleDataPointPress(data, index, 'user')}
          />
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
              onPress={(data: any, index: number) => handleDataPointPress(data, index, 'user')}
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
              onPress={(data: any, index: number) => handleDataPointPress(data, index, 'opponent')}
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
            onPress={(data: any, index: number) => handleDataPointPress(data, index, 'gap')}
          />
        );
        
      default:
        return null;
    }
  };

  // Render legend based on variant
  const renderLegend = () => {
    switch (variant) {
      case 'gap':
        return (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Score Gap (You − Opponent)</Text>
            </View>
          </View>
        );
        
      default:
        return (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>You ({userScore})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Opponent ({opponentScore})</Text>
            </View>
          </View>
        );
    }
  };

  // Render tooltip component
  const renderTooltip = () => {
    if (!tooltip) return null;

    return (
      <View
        style={[
          styles.tooltip,
          {
            left: Math.max(10, Math.min(tooltip.x - width * 0.125, width * 0.6)),
            top: Math.max(10, tooltip.y - 60),
          },
        ]}
      >
        <Text style={styles.tooltipTime}>{tooltip.time}</Text>
        <Text style={styles.tooltipText}>
          {tooltip.scorer === 'user' ? 'You scored' : 'Opponent scored'}
        </Text>
        
        {variant === 'gap' ? (
          <Text style={styles.tooltipGap}>
            Gap: {tooltip.gap && tooltip.gap > 0 ? '+' : ''}{tooltip.gap}
          </Text>
        ) : (
          <View style={styles.tooltipScores}>
            <Text style={[styles.tooltipScore, { color: '#10B981' }]}>
              You: {tooltip.userScore}
            </Text>
            <Text style={[styles.tooltipScore, { color: '#EF4444' }]}>
              Opponent: {tooltip.opponentScore}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Shadow distance={8} startColor="rgba(0, 0, 0, 0.1)">
      <View style={[styles.container, styleOverrides?.container]}>
        <Text style={[styles.title, styleOverrides?.title]}>{title}</Text>
        
        <View style={[styles.chartWrapper, styleOverrides?.chartWrapper]}>
          {renderChart()}
          {renderTooltip()}
        </View>
        
        {renderLegend()}
      </View>
    </Shadow>
  );
};

// Export the utility function for external use
export { buildScoreSeries };
export type { BuildScoreSeriesResult, ScoreSeries, ScoringEvent };


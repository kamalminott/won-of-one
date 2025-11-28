import React, { useMemo, useRef } from 'react';
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
  userPosition?: 'left' | 'right'; // Position of user in match header (left = fencer_1, right = fencer_2)
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
  opponentLabel = 'Opponent',
  userPosition // Position of user in match header (left = fencer_1, right = fencer_2)
}) => {
  const { width, height: screenHeight } = useWindowDimensions();

  // Add comprehensive logging for received props
  const userDataLength = scoreProgression?.userData?.length ?? 0;
  const opponentDataLength = scoreProgression?.opponentData?.length ?? 0;
  const userDataLastY = userDataLength > 0 
    ? scoreProgression?.userData?.[userDataLength - 1]?.y ?? null
    : null;
  const opponentDataLastY = opponentDataLength > 0 
    ? scoreProgression?.opponentData?.[opponentDataLength - 1]?.y ?? null
    : null;

  console.log('📊 [SCORE PROGRESSION CHART] Received props:', {
    userScore,
    opponentScore,
    userLabel,
    opponentLabel,
    userPosition,
    hasScoreProgression: !!scoreProgression,
    scoreProgressionUserDataLength: userDataLength,
    scoreProgressionOpponentDataLength: opponentDataLength,
    scoreProgressionUserLastY: userDataLastY,
    scoreProgressionOpponentLastY: opponentDataLastY,
  });

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
        // Handle time format like "00:08" or "(8:00)" 
        const timeStr = point.x.replace(/[()]/g, ''); // Remove parentheses if present
        const [minutes, seconds] = timeStr.split(':').map(Number);
        const totalSeconds = (minutes * 60) + seconds; // Convert to total seconds
        console.log(`📊 Converting user point: "${point.x}" -> "${timeStr}" -> ${totalSeconds}s`);
        return { x: totalSeconds, y: point.y };
      });

      const oppSeries: ScoreSeries = scoreProgression.opponentData.map(point => {
        // Handle time format like "00:08" or "(8:00)"
        const timeStr = point.x.replace(/[()]/g, ''); // Remove parentheses if present
        const [minutes, seconds] = timeStr.split(':').map(Number);
        const totalSeconds = (minutes * 60) + seconds; // Convert to total seconds
        console.log(`📊 Converting opponent point: "${point.x}" -> "${timeStr}" -> ${totalSeconds}s`);
        return { x: totalSeconds, y: point.y };
      });

      // Prepend starting point (0, 0) at time 0 to show the 0→1 transition for first score
      // Find the earliest time point to use as the starting time
      const initialTimes = [...userSeries.map(p => p.x), ...oppSeries.map(p => p.x)];
      const earliestTime = initialTimes.length > 0 ? Math.min(...initialTimes) : 0;
      const startTime = 0; // Always start at time 0 to show the 0→1 transition
      
      // Only add starting point if series don't already start at 0 with score 0
      if (userSeries.length === 0 || userSeries[0].x !== startTime || userSeries[0].y !== 0) {
        userSeries.unshift({ x: startTime, y: 0 });
      }
      if (oppSeries.length === 0 || oppSeries[0].x !== startTime || oppSeries[0].y !== 0) {
        oppSeries.unshift({ x: startTime, y: 0 });
      }
      
      // Calculate gap series from the updated series (which now include starting points)
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
      
      // Use final scores from props if available, otherwise use calculated max
      // This ensures Y-axis shows full range even if progression data was capped
      const finalUserMax = userScore > 0 ? Math.max(userMax, userScore) : Math.max(userMax, 1);
      const finalOppMax = opponentScore > 0 ? Math.max(oppMax, opponentScore) : Math.max(oppMax, 1);
      
      const yDomains = {
        user: [0, finalUserMax] as [number, number],
        opponent: [0, finalOppMax] as [number, number],
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
  }, [events, scoreProgression, userScore, opponentScore]);

  // Track seen Y-axis labels to prevent duplicates
  // Use a unique key based on chart data to reset when data changes
  const seenYLabelsRef = useRef<{ 
    key: string; 
    set: Set<string>; 
    lastValidLabel: string; // Track last valid label to return for duplicates (prevents gaps)
  }>({ 
    key: '', 
    set: new Set(),
    lastValidLabel: '0'
  });

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.03,
      paddingTop: width * 0.03,
      paddingHorizontal: width * 0.03,
      paddingBottom: width * 0.002, // Further reduced to bring legends closer to bottom
      marginBottom: screenHeight * 0.015,
      marginHorizontal: width * 0.02, // Reduced from 0.04 to make graph wider
      left: 0,
      right: 0,
      overflow: 'hidden', // Prevent scrollable chart from spilling outside container
    },
    title: {
      fontSize: Math.round(width * 0.035),
      fontWeight: '600',
      color: 'white',
      marginBottom: screenHeight * 0.003, // Further reduced to bring graph closer to title
      textAlign: 'center',
      alignSelf: 'center',
    },
    chartWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
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
          // Find the highest user score at or before this time point
          const userPointsAtOrBefore = chartData.userSeries.filter(p => p.x <= time);
          const maxUserScore = userPointsAtOrBefore.length > 0 ? Math.max(...userPointsAtOrBefore.map(p => p.y)) : 0;
          return maxUserScore;
        });
        
        // Create opponent data array aligned with time points - ensure no duplicate Y values
        const opponentData = sortedTimePoints.map(time => {
          // Find the highest opponent score at or before this time point
          const oppPointsAtOrBefore = chartData.oppSeries.filter(p => p.x <= time);
          const maxOppScore = oppPointsAtOrBefore.length > 0 ? Math.max(...oppPointsAtOrBefore.map(p => p.y)) : 0;
          return maxOppScore;
        });
        
        // Use the original data without padding to prevent extending beyond X-axis
        const maxUserScore = Math.max(...userData, 0);
        const maxOpponentScore = Math.max(...opponentData, 0);
        
        console.log('�� [SCORE PROGRESSION CHART] Y-axis calculation:', {
          fromProgressionData: {
            maxUserScore,
            maxOpponentScore,
          },
          fromProps: {
            userScore,
            opponentScore,
          },
        });

        // Use final scores from props to ensure Y-axis shows full range but keep the scale aligned to real data
        // Dropping the hard minimum of 5 prevents the library from creating fractional steps that round into duplicate labels
        const finalMaxUserScore = userScore > 0 ? Math.max(maxUserScore, userScore) : maxUserScore;
        const finalMaxOpponentScore = opponentScore > 0 ? Math.max(maxOpponentScore, opponentScore) : maxOpponentScore;
        const maxScore = Math.max(finalMaxUserScore, finalMaxOpponentScore);
        
        console.log('�� [SCORE PROGRESSION CHART] Final Y-axis calculation:', {
          finalMaxUserScore,
          finalMaxOpponentScore,
          maxScore,
          calculation: {
            step1_userMax: userScore > 0 
              ? `Math.max(${maxUserScore}, ${userScore}) = ${finalMaxUserScore}`
              : `from progression = ${finalMaxUserScore}`,
            step2_oppMax: opponentScore > 0
              ? `Math.max(${maxOpponentScore}, ${opponentScore}) = ${finalMaxOpponentScore}`
              : `from progression = ${finalMaxOpponentScore}`,
            step3_final: `Math.max(${finalMaxUserScore}, ${finalMaxOpponentScore}) = ${maxScore}`,
          },
        });
        
        // Use original data without padding
        const paddedUserData = [...userData];
        const paddedOpponentData = [...opponentData];
        const paddedLabels = [...timeLabels];
        const dataMaxValue = Math.max(
          paddedUserData.length ? Math.max(...paddedUserData) : 0,
          paddedOpponentData.length ? Math.max(...paddedOpponentData) : 0
        );
        
        console.log('📊 Chart Kit Labels:', timeLabels);
        console.log('📊 User Data:', userData);
        console.log('📊 Opponent Data:', opponentData);
        console.log('📊 User Data length:', userData.length);
        console.log('📊 Opponent Data length:', opponentData.length);
        console.log('📊 Unique User Y values:', [...new Set(userData)].sort((a, b) => a - b));
        console.log('📊 Unique Opponent Y values:', [...new Set(opponentData)].sort((a, b) => a - b));
        console.log('📊 User Y values (sorted):', userData);
        console.log('📊 Opponent Y values (sorted):', opponentData);
        
        // Chart always renders: first dataset (red) = fencer_1 (left), second dataset (green) = fencer_2 (right)
        // This matches the header order: fencer_1_name (left) - fencer_2_name (right)
        // userData = fencer_1 (left position), opponentData = fencer_2 (right position) - position-based from database
        // Legend will show correct names and colors to match this
        console.log('📊 [CHART] Rendering with:', {
          userLabel,
          opponentLabel,
          userPosition,
          userDataLength: paddedUserData.length,
          opponentDataLength: paddedOpponentData.length,
          firstUserValue: paddedUserData[0],
          firstOpponentValue: paddedOpponentData[0]
        });
        
        // Use maxScore calculated from props to ensure Y-axis shows full range
        // This ensures the chart displays correctly even if progression data was capped
        // maxScore already accounts for userScore and opponentScore props
        const maxValue = Math.max(maxScore, dataMaxValue);
        
        // Calculate segments to show only integer values from 0 to max data value
        // Keeping segments at or below the highest plotted score avoids fractional steps that round into duplicates
        const yAxisCeiling = Math.max(Math.floor(dataMaxValue), 1);
        const calculatedSegments = Math.max(1, Math.min(yAxisCeiling, 10)); // Between 1 and 10 segments
        
        // Calculate the exact Y-axis values we expect to show (0 to yAxisCeiling, integers only)
        const desiredYValues = Array.from({ length: yAxisCeiling + 1 }, (_, i) => i);
        console.log('📊 [Y-AXIS] Desired Y-axis values:', desiredYValues, 'maxValue:', maxValue, 'dataMaxValue:', dataMaxValue, 'segments:', calculatedSegments);
        
        // Ensure the chart data doesn't exceed maxValue to prevent the chart from generating extra labels
        // This helps prevent the chart from generating labels based on data points that exceed the range
        const normalizedUserData = paddedUserData.map(val => Math.min(val, maxValue));
        const normalizedOpponentData = paddedOpponentData.map(val => Math.min(val, maxValue));
        
        // Colors by identity (match legend): user = red, opponent = green
        // Dataset order is identity-based (dataset[0] = user, dataset[1] = opponent)
        const userLineColor = (opacity = 1) => `rgba(255, 118, 117, ${opacity})`;
        const opponentLineColor = (opacity = 1) => `rgba(0, 184, 148, ${opacity})`;
        const datasetColors = [userLineColor, opponentLineColor];
        
        const chartData_kit = {
          labels: displayLabels,
          datasets: [
            {
              data: normalizedUserData, // fencer_1 (left position) - normalized to prevent extra labels
              color: datasetColors[0],
              strokeWidth: 3,
            },
            {
              data: normalizedOpponentData, // fencer_2 (right position) - normalized to prevent extra labels
              color: datasetColors[1],
              strokeWidth: 3,
            }
          ]
        };
        
        // Create a unique key based on chart data to detect when data actually changes
        // Only reset the Set when chart data changes, not on every render
        const chartDataKey = JSON.stringify({
          userSeries: chartData.userSeries.map(p => `${p.x}-${p.y}`),
          oppSeries: chartData.oppSeries.map(p => `${p.x}-${p.y}`),
          maxValue,
          segments: calculatedSegments
        });
        
        // Reset Set only when chart data actually changes
        // Ensure ref is properly initialized
        if (!seenYLabelsRef.current.set) {
          seenYLabelsRef.current.set = new Set();
          seenYLabelsRef.current.lastValidLabel = '0';
        }
        if (!seenYLabelsRef.current.lastValidLabel) {
          seenYLabelsRef.current.lastValidLabel = '0';
        }
        if (seenYLabelsRef.current.key !== chartDataKey) {
          seenYLabelsRef.current.set.clear();
          seenYLabelsRef.current.key = chartDataKey;
          seenYLabelsRef.current.lastValidLabel = '0';
          console.log('📊 [Y-AXIS] Chart data changed, resetting seen labels', {
            maxValue,
            segments: calculatedSegments,
            chartDataKey
          });
        }
        
        const chartConfig = {
          backgroundColor: "#2B2B2B", // Match the card background color
          backgroundGradientFrom: "#2B2B2B",
          backgroundGradientTo: "#2B2B2B",
          decimalPlaces: 0, // Force integer labels - CRITICAL for preventing fractional labels
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: {
            borderRadius: 16,
            paddingLeft: 30 // Increased padding to ensure y-axis labels are visible
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
          // Y-axis label configuration
          propsForHorizontalLabels: {
            fontSize: 12,
            fill: "rgba(255, 255, 255, 0.9)",
            fontWeight: "500"
          },
          // formatYLabel in chartConfig - may not be called by library, but keeping for compatibility
          formatYLabel: (yValue: string) => {
            console.log('📊 [Y-AXIS] formatYLabel (chartConfig) called with:', yValue);
            if (!seenYLabelsRef.current.set) {
              seenYLabelsRef.current.set = new Set();
              seenYLabelsRef.current.lastValidLabel = '0';
            }
            if (!seenYLabelsRef.current.lastValidLabel) {
              seenYLabelsRef.current.lastValidLabel = '0';
            }
            const roundedValue = Math.round(parseFloat(yValue)).toString();
            if (seenYLabelsRef.current.set.has(roundedValue)) {
              console.log('📊 [Y-AXIS] ❌ Duplicate (chartConfig):', roundedValue, '- returning same value to overlap');
              // Return the same value so duplicates overlap instead of leaving gaps
              return roundedValue;
            }
            seenYLabelsRef.current.set.add(roundedValue);
            seenYLabelsRef.current.lastValidLabel = roundedValue;
            console.log('📊 [Y-AXIS] ✅ New label (chartConfig):', roundedValue);
            return roundedValue;
          }
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
              width={isScrollable ? scrollableChartWidth : width * 0.8}
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
              segments={calculatedSegments}
              formatYLabel={(yValue: string) => {
                // This is a fallback - formatYLabel in chartConfig should work, but this ensures it's called
                console.log('📊 [Y-AXIS] formatYLabel (component prop) called with:', yValue);
                // Use the same deduplication logic
                if (!seenYLabelsRef.current.set) {
                  seenYLabelsRef.current.set = new Set();
                  seenYLabelsRef.current.lastValidLabel = '0';
                }
                if (!seenYLabelsRef.current.lastValidLabel) {
                  seenYLabelsRef.current.lastValidLabel = '0';
                }
                const roundedValue = Math.round(parseFloat(yValue)).toString();
                if (seenYLabelsRef.current.set.has(roundedValue)) {
                  console.log('📊 [Y-AXIS] ❌ Duplicate (component prop):', roundedValue, '- returning same value to overlap');
                  // Return the same value so duplicates overlap instead of leaving gaps
                  return roundedValue;
                }
                seenYLabelsRef.current.set.add(roundedValue);
                seenYLabelsRef.current.lastValidLabel = roundedValue;
                console.log('📊 [Y-AXIS] ✅ New label (component prop):', roundedValue);
                return roundedValue;
              }}
            />
          </TouchableOpacity>
        );

        return (
          <View style={{ height: chartHeight, width: width * 1, overflow: 'hidden', marginLeft: 0, paddingLeft: width * 0.02 }}>
            {isScrollable ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: width * 0.05 }}
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
              color="#FF7675"
              thickness={3}
              dataPointsColor="#FF7675"
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
              color="#00B894"
              thickness={3}
              dataPointsColor="#00B894"
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
            color="#FF7675"
            thickness={3}
            dataPointsColor="#FF7675"
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
            color="#FF7675"
            thickness={3}
            dataPointsColor="#FF7675"
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
    
    // Legend order should match header: userLabel (left) - opponentLabel (right)
    // Header always shows: fencer_1_name (left) - fencer_2_name (right)
    // userLabel = fencer_1_name (left position), opponentLabel = fencer_2_name (right position)
    // So legend should always show: userLabel (left) - opponentLabel (right) to match header
    // Legend colors by identity: user = red, opponent = green
    const leftColor = '#FF7675';
    const rightColor = '#00B894';
    
    console.log('📊 [SCORE PROGRESSION CHART] Rendering legend:', {
      userLabel,
      opponentLabel,
      userPosition,
      userScore,
      opponentScore,
      leftColor,
      rightColor,
      chartUserDataLength: chartData.userSeries.length,
      chartOpponentDataLength: chartData.oppSeries.length,
      chartUserFirstPoint: chartData.userSeries[0],
      chartOpponentFirstPoint: chartData.oppSeries[0],
    });
    
    const leftLegendItem = (
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: leftColor }]} />
        <Text style={styles.legendText}>{userLabel} ({userScore})</Text>
      </View>
    );
    
    const rightLegendItem = (
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: rightColor }]} />
        <Text style={styles.legendText}>{opponentLabel} ({opponentScore})</Text>
      </View>
    );
    
    switch (variant) {
      case 'dualAxis':
        return (
          <View style={legendStyle}>
            {leftLegendItem}
            {rightLegendItem}
          </View>
        );
        
      case 'gap':
        return (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF7675' }]} />
              <Text style={styles.legendText}>Score Gap ({userLabel} − {opponentLabel})</Text>
            </View>
          </View>
        );
        
      default:
        return (
          <View style={styles.legend}>
            {leftLegendItem}
            {rightLegendItem}
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

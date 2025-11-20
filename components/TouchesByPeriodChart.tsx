import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface TouchesByPeriodChartProps {
  title?: string;
  customStyle?: object;
  touchesByPeriod?: {
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  };
  userLabel?: string;
  opponentLabel?: string;
  userPosition?: 'left' | 'right'; // Position of user in match header (left = fencer_1, right = fencer_2)
}

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  period: string;
  player: 'user' | 'opponent';
  touches: number;
}

export const TouchesByPeriodChart: React.FC<TouchesByPeriodChartProps> = ({
  title = 'Touches by Period',
  customStyle = {},
  touchesByPeriod,
  userLabel = 'You',
  opponentLabel = 'Opponent',
  userPosition // Position of user in match header (left = fencer_1, right = fencer_2)
}) => {
  const { width, height } = useWindowDimensions();
  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    period: '',
    player: 'user',
    touches: 0
  });
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide tooltip after 3 seconds
  useEffect(() => {
    if (tooltip.visible) {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltip(prev => ({ ...prev, visible: false }));
      }, 3000);
    }
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [tooltip.visible]);

  // Handle bar press
  const handleBarPress = (data: any, index: number) => {
    // Find which period and player this bar represents
    const periodIndex = Math.floor(index / 2); // Each period has 2 bars (user + opponent)
    const isUserBar = index % 2 === 0; // Even indices are user bars, odd are opponent bars
    
    let period = '';
    let touches = 0;
    let player: 'user' | 'opponent' = 'user';
    
    // Use the actual data object instead of the individual bar data
    const currentData = touchesByPeriod || defaultData;
    
    if (periodIndex === 0) {
      period = 'P1';
      touches = isUserBar ? currentData.period1.user : currentData.period1.opponent;
      player = isUserBar ? 'user' : 'opponent';
    } else if (periodIndex === 1) {
      period = 'P2';
      touches = isUserBar ? currentData.period2.user : currentData.period2.opponent;
      player = isUserBar ? 'user' : 'opponent';
    } else if (periodIndex === 2) {
      period = 'P3';
      touches = isUserBar ? currentData.period3.user : currentData.period3.opponent;
      player = isUserBar ? 'user' : 'opponent';
    }

    // Show tooltip
    setTooltip({
      visible: true,
      x: 50, // Fixed position for now
      y: 50,
      period,
      player,
      touches
    });
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.02,
      padding: width * 0.04,
      marginHorizontal: 0, // No margin - rowContainer handles alignment
      flex: 1,
      height: height * 0.22,
      marginBottom: height * 0.01,
      overflow: 'hidden',
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
      overflow: 'visible',
      width: '100%',
      paddingBottom: height * 0.01,
      paddingLeft: 0,
      marginLeft: -(width * 0.07),
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: -(height * 0.010),
      gap: width * 0.02,
      paddingHorizontal: width * 0.01,
      flexWrap: 'wrap',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    legendDot: {
      width: width * 0.018,
      height: width * 0.018,
      borderRadius: width * 0.009,
      marginRight: width * 0.01,
    },
    legendText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: Math.round(width * 0.022),
      flexShrink: 1,
    },
    tooltip: {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderRadius: width * 0.02,
      padding: width * 0.03,
      zIndex: 1000,
      minWidth: width * 0.2,
    },
    tooltipText: {
      color: 'white',
      fontSize: Math.round(width * 0.03),
      fontWeight: '600',
      textAlign: 'center',
    },
    tooltipSubtext: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: Math.round(width * 0.025),
      textAlign: 'center',
      marginTop: 2,
    },
  });

  // Use real data or fallback to default values
  const defaultData = {
    period1: { user: 0, opponent: 0 },
    period2: { user: 0, opponent: 0 },
    period3: { user: 0, opponent: 0 }
  };

  const data = touchesByPeriod || defaultData;

  // Assign colors based on userPosition
  // data.period1.user = fencer1 (left position) touches
  // data.period1.opponent = fencer2 (right position) touches
  // When userPosition === 'left': user is fencer1 (red), opponent is fencer2 (green)
  // When userPosition === 'right': user is fencer2 (red), opponent is fencer1 (green)
  const fencer1Color = userPosition === 'left' ? '#FF7675' : '#00B894'; // Red if user, green if opponent
  const fencer2Color = userPosition === 'right' ? '#FF7675' : '#00B894'; // Red if user, green if opponent
  
  // Chart data for touches by period - only show periods with touches, but always show both bars
  const chartData = [];
  
  // Only add periods that have touches (user or opponent), but always show both bars for that period
  if (data.period1.user > 0 || data.period1.opponent > 0) {
    chartData.push(
      { value: data.period1.user, label: 'P1', frontColor: fencer1Color }, // fencer1 (left)
      { value: data.period1.opponent > 0 ? data.period1.opponent : 0.1, label: 'P1', frontColor: fencer2Color } // fencer2 (right)
    );
  }
  
  if (data.period2.user > 0 || data.period2.opponent > 0) {
    chartData.push(
      { value: data.period2.user, label: 'P2', frontColor: fencer1Color }, // fencer1 (left)
      { value: data.period2.opponent > 0 ? data.period2.opponent : 0.1, label: 'P2', frontColor: fencer2Color } // fencer2 (right)
    );
  }
  
  if (data.period3.user > 0 || data.period3.opponent > 0) {
    chartData.push(
      { value: data.period3.user, label: 'P3', frontColor: fencer1Color }, // fencer1 (left)
      { value: data.period3.opponent > 0 ? data.period3.opponent : 0.1, label: 'P3', frontColor: fencer2Color } // fencer2 (right)
    );
  }

  // Calculate the maximum value for Y-axis scaling
  const maxValue = Math.max(
    data.period1.user,
    data.period1.opponent,
    data.period2.user,
    data.period2.opponent,
    data.period3.user,
    data.period3.opponent
  );
  
  // Set Y-axis maximum to the highest score, with a minimum of 1 for visibility
  // Ensure it's a whole number and round up to the next integer
  const yAxisMaxValue = Math.max(Math.ceil(maxValue), 1);

  // Render tooltip
  const renderTooltip = () => {
    if (!tooltip.visible) return null;

    const playerName = tooltip.player === 'user' ? userLabel : opponentLabel;
    
    return (
      <View style={[styles.tooltip, { left: tooltip.x, top: tooltip.y }]}>
        <Text style={styles.tooltipText}>
          {tooltip.touches} {tooltip.touches === 1 ? 'Touch' : 'Touches'}
        </Text>
        <Text style={styles.tooltipSubtext}>
          {playerName} in {tooltip.period}
        </Text>
      </View>
    );
  };


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
          yAxisTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.025), marginRight: -(width * 0.02) }}
          formatYLabel={(value) => Math.round(value).toString()}
          xAxisLabelTextStyle={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: Math.round(width * 0.02) }}
          barBorderRadius={Math.round(width * 0.008)}
          maxValue={yAxisMaxValue}
          yAxisSuffix=""
          noOfSections={Math.min(yAxisMaxValue, 5)}
          showYAxisIndices={true}
          yAxisIndicesColor="rgba(255, 255, 255, 0.3)"
          yAxisIndicesWidth={1}
          onPress={(data: any, index: number) => handleBarPress(data, index)}
        />
      </View>
      
      {/* Legend showing both players - order matches header position */}
      {/* Header always shows: fencer_1_name (left) - fencer_2_name (right) */}
      {/* userLabel = fencer_1_name (left), opponentLabel = fencer_2_name (right) */}
      {/* So legend should always show: userLabel (left) - opponentLabel (right) */}
      {(() => {
        const leftColor = userPosition === 'left' ? '#FF7675' : '#00B894';
        const rightColor = userPosition === 'right' ? '#FF7675' : '#00B894';
        console.log('📊 [TOUCHES BY PERIOD CHART] Rendering legend:', {
          userLabel,
          opponentLabel,
          userPosition,
          leftColor,
          rightColor,
          touchesByPeriod: touchesByPeriod ? {
            period1: touchesByPeriod.period1,
            period2: touchesByPeriod.period2,
            period3: touchesByPeriod.period3,
          } : 'null',
        });
        return null;
      })()}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: userPosition === 'left' ? '#FF7675' : '#00B894' }]} />
          <Text style={styles.legendText}>{userLabel}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: userPosition === 'right' ? '#FF7675' : '#00B894' }]} />
          <Text style={styles.legendText}>{opponentLabel}</Text>
        </View>
      </View>
      
      {/* Tooltip */}
      {renderTooltip()}
    </View>
  );
};

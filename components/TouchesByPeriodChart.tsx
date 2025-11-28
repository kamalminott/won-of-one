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

  // Handle bar press using metadata on each bar to avoid index assumptions
  const handleBarPress = (data: any) => {
    const period = data.period || '';
    const player: 'user' | 'opponent' = data.player || 'user';
    const touches = data.originalValue ?? data.value ?? 0;

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

  // Colors by identity to match legend: user = red, opponent = green
  const userColor = '#FF7675';
  const opponentColor = '#00B894';
  
  // Chart data for touches by period - always include all periods to keep ordering stable
  const chartData = [
    {
      value: data.period1.user > 0 ? data.period1.user : 0.1,
      originalValue: data.period1.user,
      label: 'P1',
      frontColor: userColor,
      period: 'P1',
      player: 'user'
    },
    {
      value: data.period1.opponent > 0 ? data.period1.opponent : 0.1,
      originalValue: data.period1.opponent,
      label: 'P1',
      frontColor: opponentColor,
      period: 'P1',
      player: 'opponent'
    },
    {
      value: data.period2.user > 0 ? data.period2.user : 0.1,
      originalValue: data.period2.user,
      label: 'P2',
      frontColor: userColor,
      period: 'P2',
      player: 'user'
    },
    {
      value: data.period2.opponent > 0 ? data.period2.opponent : 0.1,
      originalValue: data.period2.opponent,
      label: 'P2',
      frontColor: opponentColor,
      period: 'P2',
      player: 'opponent'
    },
    {
      value: data.period3.user > 0 ? data.period3.user : 0.1,
      originalValue: data.period3.user,
      label: 'P3',
      frontColor: userColor,
      period: 'P3',
      player: 'user'
    },
    {
      value: data.period3.opponent > 0 ? data.period3.opponent : 0.1,
      originalValue: data.period3.opponent,
      label: 'P3',
      frontColor: opponentColor,
      period: 'P3',
      player: 'opponent'
    },
  ];

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
      
      {/* Legend showing both players with fixed identity colors: user=red, opponent=green */}
      {(() => {
        const leftColor = '#FF7675';  // user
        const rightColor = '#00B894'; // opponent
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
          <View style={[styles.legendDot, { backgroundColor: '#FF7675' }]} />
          <Text style={styles.legendText}>{userLabel}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00B894' }]} />
          <Text style={styles.legendText}>{opponentLabel}</Text>
        </View>
      </View>
      
      {/* Tooltip */}
      {renderTooltip()}
    </View>
  );
};

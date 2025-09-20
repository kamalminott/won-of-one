import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { KeyStatsCard } from './KeyStatsCard';
import { MatchNotesCard } from './MatchNotesCard';
import { ScoreProgressionChart } from './ScoreProgressionChart';
import { TouchesByPeriodChart } from './TouchesByPeriodChart';

interface MatchSummaryCardProps {
  onEdit?: () => void;
  onSeeFullSummary?: () => void;
  onCancelMatch?: () => void;
  onSaveMatch?: () => void;
  customStyle?: object;
  scoreProgression?: {
    userData: Array<{ x: string; y: number }>;
    opponentData: Array<{ x: string; y: number }>;
  };
  userScore?: number;
  opponentScore?: number;
  bestRun?: number;
  yellowCards?: number;
  redCards?: number;
  matchDurationSeconds?: number;
  touchesByPeriod?: {
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  };
  notes?: string;
  onNotesChange?: (notes: string) => void;
  onNotesPress?: () => void;
  userLabel?: string;
  opponentLabel?: string;
}

export const MatchSummaryCard: React.FC<MatchSummaryCardProps> = ({
  onEdit,
  onSeeFullSummary,
  onCancelMatch,
  onSaveMatch,
  customStyle = {},
  scoreProgression,
  userScore = 0,
  opponentScore = 0,
  bestRun = 0,
  yellowCards = 0,
  redCards = 0,
  matchDurationSeconds = 0,
  touchesByPeriod,
  notes = '',
  onNotesChange,
  onNotesPress,
  userLabel = 'You',
  opponentLabel = 'Opponent'
}) => {
  const { width, height } = useWindowDimensions();

  // Sample data for charts
  const lineChartData = [
    { value: 0, dataPointText: '0' },
    { value: 5, dataPointText: '5' },
    { value: 8, dataPointText: '8' },
    { value: 12, dataPointText: '12' },
    { value: 15, dataPointText: '15' },
  ];

  const barChartData = [
    { value: 4, label: 'P1' },
    { value: 6, label: 'P2' },
    { value: 8, label: 'P3' },
  ];

  const styles = StyleSheet.create({
    container: {
      ...customStyle,
    },
    buttonContainer: {
      marginTop: height * 0.02,
    },
    saveButton: {
      backgroundColor: '#6C5CE7',
      paddingVertical: height * 0.015,
      paddingHorizontal: width * 0.04,
      borderRadius: width * 0.02,
      alignItems: 'center',
      width: '100%',
    },
    saveButtonText: {
      color: 'white',
      fontSize: Math.round(width * 0.04),
      fontWeight: '600',
    },
    cancelButton: {
      backgroundColor: '#2B2B2B',
      paddingVertical: height * 0.015,
      paddingHorizontal: width * 0.04,
      borderRadius: width * 0.02,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#EF4444',
      marginTop: height * 0.02,
      width: '100%',
    },
    cancelButtonText: {
      color: '#EF4444',
      fontSize: Math.round(width * 0.04),
      fontWeight: '600',
    },
    rowContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: height * 0.002,
      gap: width * 0.02,
      marginHorizontal: width * 0.02,
    },
  });

  return (
    <View style={styles.container}>
      {/* Top card with win pill has been removed */}
      
      {/* Score Progression Chart */}
      <ScoreProgressionChart 
        scoreProgression={scoreProgression} 
        userScore={userScore}
        opponentScore={opponentScore}
        userLabel={userLabel}
        opponentLabel={opponentLabel}
      />
      
      {/* Touches by Period Chart and Key Stats Card - Side by Side */}
      <View style={styles.rowContainer}>
        <TouchesByPeriodChart 
          touchesByPeriod={touchesByPeriod}
          userLabel={userLabel}
          opponentLabel={opponentLabel}
        />
        <KeyStatsCard 
          bestRun={bestRun} 
          yellowCards={yellowCards}
          redCards={redCards}
          matchDurationSeconds={matchDurationSeconds}
        />
      </View>
      
      {/* Match Notes Card */}
      <MatchNotesCard 
        notes={notes}
        onNotesChange={onNotesChange}
        onPress={onNotesPress}
        isPreview={true}
        customStyle={{ marginHorizontal: 0 }}
      />
      
      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.saveButton} onPress={onSaveMatch}>
          <Text style={styles.saveButtonText}>Save Match</Text>
        </TouchableOpacity>
      </View>
      
      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={onCancelMatch}>
        <Text style={styles.cancelButtonText}>Cancel Match</Text>
      </TouchableOpacity>
    </View>
  );
};

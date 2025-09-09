import { BackButton } from '@/components/BackButton';
import { MatchSummaryCard } from '@/components/MatchSummaryCard';
import { MatchSummaryStats } from '@/components/MatchSummaryStats';
import { Colors } from '@/constants/Colors';
import { matchService } from '@/lib/database';
import { Match } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MatchSummaryScreen() {
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [bestRun, setBestRun] = useState<number>(0);
  const [scoreProgression, setScoreProgression] = useState<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }>({ userData: [], opponentData: [] });
  const [touchesByPeriod, setTouchesByPeriod] = useState<{
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  }>({
    period1: { user: 0, opponent: 0 },
    period2: { user: 0, opponent: 0 },
    period3: { user: 0, opponent: 0 }
  });
  const [loading, setLoading] = useState(true);

  // Fetch match data from database
  useEffect(() => {
    const fetchMatchData = async () => {
      if (params.matchId) {
        try {
          const matchData = await matchService.getMatchById(params.matchId as string);
          console.log('📊 Fetched match data for summary:', matchData);
          console.log('⏱️ ACTUAL MATCH DURATION (bout_length_s):', matchData?.bout_length_s, 'seconds');
          console.log('⏱️ MATCH DURATION FORMATTED:', matchData?.bout_length_s ? `${Math.floor(matchData.bout_length_s / 60)}:${(matchData.bout_length_s % 60).toString().padStart(2, '0')}` : 'N/A');
          setMatch(matchData);
          
          // Calculate best run and score progression if we have match data and user info
          if (matchData && matchData.fencer_1_name) {
            const calculatedBestRun = await matchService.calculateBestRun(
              params.matchId as string, 
              matchData.fencer_1_name,
              params.remoteId as string // Pass the remoteId to help find events
            );
            console.log('🏃 Calculated best run:', calculatedBestRun);
            setBestRun(calculatedBestRun);

            const calculatedScoreProgression = await matchService.calculateScoreProgression(
              params.matchId as string,
              matchData.fencer_1_name,
              params.remoteId as string
            );
            console.log('📈 Calculated score progression:', calculatedScoreProgression);
            setScoreProgression(calculatedScoreProgression);

            const calculatedTouchesByPeriod = await matchService.calculateTouchesByPeriod(
              params.matchId as string,
              matchData.fencer_1_name,
              params.remoteId as string
            );
            console.log('📊 Calculated touches by period:', calculatedTouchesByPeriod);
            setTouchesByPeriod(calculatedTouchesByPeriod);
          }
        } catch (error) {
          console.error('Error fetching match data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchMatchData();
  }, [params.matchId]);

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit match');
  };

  const handleSeeFullSummary = () => {
    // TODO: Navigate to full summary
    console.log('See full summary');
  };

  const handleCancelMatch = () => {
    // TODO: Implement cancel match
    console.log('Cancel match');
  };

  const handleSaveMatch = () => {
    // TODO: Implement save match
    console.log('Save match');
  };

  // Prepare match data for MatchSummaryStats
  const matchData = match ? {
    id: match.match_id,
    opponent: match.fencer_2_name || 'Opponent',
    opponentImage: 'https://example.com/opponent.jpg', // TODO: Add opponent image
    outcome: match.result === 'win' ? 'victory' as const : 'defeat' as const,
    score: `${match.final_score || 0}-${match.touches_against || 0}`,
    matchType: 'competition' as const, // TODO: Use actual match type
    date: new Date().toLocaleDateString(),
    userScore: match.final_score || 0,
    opponentScore: match.touches_against || 0,
    bestRun: bestRun, // Now using calculated best run from database
  } : null;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: height * 0.02,
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.02,
    },
    backButton: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: '#2e2e2e',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    title: {
      fontSize: Math.round(width * 0.06),
      fontWeight: '700',
      color: 'white',
    },
    editButton: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: '#2e2e2e',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: height * 0.05,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18 }}>Loading match data...</Text>
      </SafeAreaView>
    );
  }

  if (!match || !matchData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18 }}>Match not found</Text>
        <TouchableOpacity onPress={handleBack} style={{ marginTop: 20, padding: 10, backgroundColor: '#2e2e2e', borderRadius: 8 }}>
          <Text style={{ color: 'white' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.title}>Match Summary</Text>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Ionicons name="pencil" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Recent Match Card - Full Width */}
        <MatchSummaryStats match={matchData} />

        {/* Match Summary Card */}
        <MatchSummaryCard
          onEdit={handleEdit}
          onSeeFullSummary={handleSeeFullSummary}
          onCancelMatch={handleCancelMatch}
          onSaveMatch={handleSaveMatch}
          scoreProgression={scoreProgression}
          userScore={match?.final_score || 0}
          opponentScore={match?.touches_against || 0}
          bestRun={bestRun}
          yellowCards={match?.yellow_cards || 0}
          redCards={match?.red_cards || 0}
          matchDurationSeconds={match?.bout_length_s || 0}
          touchesByPeriod={touchesByPeriod}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

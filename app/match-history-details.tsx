import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import MatchSummaryCardWithBorder from '@/components/MatchSummaryCardWithBorder';
import { ScoreProgressionChart } from '@/components/ScoreProgressionChart';
import { useAuth } from '@/contexts/AuthContext';
import { matchService } from '@/lib/database';
import { supabase } from '@/lib/supabase';

import { Colors } from '@/constants/Colors';

interface MatchDetailsProps {
  matchId: string;
  youScore: number;
  opponentScore: number;
  opponentName: string;
  opponentImage?: string;
  date: string;
  duration: string;
  matchType: string;
  location: string;
}

export default function MatchDetailsScreen() {
  const { width, height } = useWindowDimensions();
  const { userName, profileImage } = useAuth();
  const params = useLocalSearchParams();
  const [matchInsights, setMatchInsights] = useState({
    avgTimeBetweenTouches: '22s',
    longestScoringDrought: '45s',
    touchStreaks: '3 in a row'
  });
  
  const [matchNotes, setMatchNotes] = useState('');
  
  const [scoreProgression, setScoreProgression] = useState<{
    userData: Array<{ x: string; y: number }>;
    opponentData: Array<{ x: string; y: number }>;
  }>({
    userData: [],
    opponentData: []
  });
  
  
  // Get match data from route params
  const matchData: MatchDetailsProps = {
    matchId: params.matchId as string || '1',
    youScore: params.youScore ? parseInt(params.youScore as string) : 0,  // Fixed: Check if param exists first
    opponentScore: params.opponentScore ? parseInt(params.opponentScore as string) : 0,  // Fixed: Check if param exists first
    opponentName: params.opponentName as string || 'Alex',
    opponentImage: params.opponentImage as string,
    date: params.date as string || 'Today',
    duration: params.duration as string || '02:30',
    matchType: params.matchType as string || 'Training',
    location: params.location as string || 'Metro Field House'
  };

  // Calculate match insights from real data
  const calculateMatchInsights = async () => {
    try {
      // Get match events for this match
      const { data: matchEvents, error } = await supabase
        .from('match_event')
        .select('*')
        .eq('match_id', matchData.matchId)
        .order('timestamp', { ascending: true });

      if (error || !matchEvents || matchEvents.length === 0) {
        console.log('No match events found for insights calculation');
        return;
      }

      // Calculate average time between touches
      let totalTimeBetweenTouches = 0;
      let touchCount = 0;

      for (let i = 1; i < matchEvents.length; i++) {
        const currentEvent = new Date(matchEvents[i].timestamp);
        const previousEvent = new Date(matchEvents[i - 1].timestamp);
        const timeDiff = (currentEvent.getTime() - previousEvent.getTime()) / 1000; // Convert to seconds
        
        totalTimeBetweenTouches += timeDiff;
        touchCount++;
      }

      const avgTime = touchCount > 0 ? Math.round(totalTimeBetweenTouches / touchCount) : 0;

      // Debug: Log all events to see what we're working with
      console.log('🔍 Match Events Debug:', {
        totalEvents: matchEvents.length,
        userName: userName,
        eventScorers: matchEvents.map(e => e.scoring_user_name),
        uniqueScorers: [...new Set(matchEvents.map(e => e.scoring_user_name))]
      });

      // Calculate longest scoring drought (longest time between ANY scoring events)
      let longestDrought = 0;
      
      if (matchEvents.length > 1) {
        for (let i = 1; i < matchEvents.length; i++) {
          const currentEvent = new Date(matchEvents[i].timestamp);
          const previousEvent = new Date(matchEvents[i - 1].timestamp);
          const timeDiff = (currentEvent.getTime() - previousEvent.getTime()) / 1000;
          
          if (timeDiff > longestDrought) {
            longestDrought = timeDiff;
          }
        }
      }

      // Calculate touch streaks (consecutive scoring events by user)
      let currentStreak = 0;
      let maxStreak = 0;
      let lastScorerWasUser = false;

      // Try different variations of userName matching
      const userNameVariations = [
        userName,
        userName?.toLowerCase(),
        userName?.toUpperCase(),
        'You',
        'you'
      ].filter(Boolean);

      console.log('🔍 Checking userName variations:', userNameVariations);

      for (const event of matchEvents) {
        const isUserScoring = userNameVariations.some(variation => 
          event.scoring_user_name === variation
        );
        
        if (isUserScoring) {
          if (lastScorerWasUser) {
            currentStreak++;
          } else {
            currentStreak = 1;
          }
          maxStreak = Math.max(maxStreak, currentStreak);
          lastScorerWasUser = true;
        } else {
          lastScorerWasUser = false;
          currentStreak = 0;
        }
      }

      console.log('🔍 Calculated insights:', {
        avgTime,
        longestDrought: Math.round(longestDrought),
        maxStreak
      });
      
      setMatchInsights({
        avgTimeBetweenTouches: `${avgTime}s`,
        longestScoringDrought: longestDrought > 0 ? `${Math.round(longestDrought)}s` : 'No data',
        touchStreaks: maxStreak > 1 ? `${maxStreak} in a row` : maxStreak === 1 ? '1 touch' : 'No data'
      });

    } catch (error) {
      console.error('Error calculating match insights:', error);
    }
  };

  // Fetch score progression data
  const fetchScoreProgression = async () => {
    try {
      const progression = await matchService.calculateScoreProgression(
        matchData.matchId, 
        userName || 'You'
      );
      console.log('📊 fetchScoreProgression received:', progression);
      setScoreProgression(progression);
    } catch (error) {
      console.error('Error fetching score progression:', error);
    }
  };

  // Fetch match notes
  const fetchMatchNotes = async () => {
    try {
      // First try to get notes from match table
      const { data: match, error } = await supabase
        .from('match')
        .select('*')
        .eq('match_id', matchData.matchId)
        .single();

      if (error) {
        console.log('No match found for notes:', error);
        return;
      }

      // Check if notes field exists and has content
      if (match && 'notes' in match && match.notes) {
        setMatchNotes(match.notes);
        console.log('📝 Match notes loaded from match table:', match.notes);
      } else {
        console.log('📝 No notes found in match record or notes field does not exist');
        // Could implement alternative storage like a separate notes table if needed
      }
    } catch (error) {
      console.error('Error fetching match notes:', error);
    }
  };


  // Load match insights, score progression, and notes when component mounts
  useEffect(() => {
    calculateMatchInsights();
    fetchScoreProgression();
    fetchMatchNotes();
  }, [matchData.matchId]);

  // Debug score progression state changes
  useEffect(() => {
    console.log('📊 scoreProgression state changed:', scoreProgression);
  }, [scoreProgression]);

  const handleBack = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: height * 0.10, // Further reduced height
      backgroundColor: '#212121',
      zIndex: 1,
    },
    header: {
      backgroundColor: 'transparent', // Make header transparent since background is behind it
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.06, // Add top padding for safe area
      paddingBottom: height * 0.01, // Reduced bottom padding
      zIndex: 2, // Ensure header content is above background
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: width * 0.05,
      fontWeight: '600',
      color: 'white',
      flex: 1,
      textAlign: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.01, // Add some top padding for better spacing
      paddingBottom: height * 0.04, // Add bottom padding for better scrolling
    },
    section: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      padding: width * 0.04,
      marginBottom: height * 0.03,
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
    },
    chartSection: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      padding: 0, // No padding to let chart handle its own spacing
      marginBottom: height * 0.03,
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
      overflow: 'hidden', // Ensure content doesn't overflow the rounded corners
    },
    sectionTitle: {
      fontSize: width * 0.046, // 18px equivalent
      fontWeight: '500',
      color: 'white',
      marginBottom: height * 0.02,
      fontFamily: 'Articulat CF',
      lineHeight: height * 0.03, // 24px equivalent
    },
    insightRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: height * 0.015,
      borderBottomWidth: 1,
      borderBottomColor: '#464646',
    },
    insightRowLast: {
      borderBottomWidth: 0,
    },
    insightLabel: {
      fontSize: width * 0.04,
      color: '#9D9D9D',
      fontWeight: '400',
      textTransform: 'capitalize',
    },
    insightValue: {
      fontSize: width * 0.045,
      color: 'white',
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    notesContainer: {
      width: '100%', // Fit the parent section container
      minHeight: height * 0.09,
      backgroundColor: '#1F1F1F',
      borderRadius: width * 0.03,
      borderWidth: 1,
      borderColor: '#3A3A3A',
      padding: width * 0.04,
      marginTop: height * 0.01,
      justifyContent: 'flex-start',
    },
    notesText: {
      fontSize: width * 0.035, // 14px equivalent
      color: '#9D9D9D',
      lineHeight: height * 0.027, // 22px equivalent
      letterSpacing: 0.02,
      fontFamily: 'Articulat CF',
      fontWeight: '400',
    },
  });

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <ExpoStatusBar style="light" hidden />
      <SafeAreaView style={styles.container} edges={[]}>
        {/* Header Background - Extends to top of screen */}
        <View style={styles.headerBackground} />
        
        {/* Header Content - Positioned within safe area */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <BackButton onPress={handleBack} />
            <Text style={styles.title}>Match History Details</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Match Summary Card with Gradient Border */}
          <MatchSummaryCardWithBorder
            leftPlayerName={userName || "You"}
            leftPlayerImage={profileImage}
            rightPlayerName={matchData.opponentName}
            rightPlayerImage={matchData.opponentImage}
            youScore={matchData.youScore}
            opponentScore={matchData.opponentScore}
            duration={matchData.duration}
            matchType={matchData.matchType}
            isWin={params.isWin === 'true' || matchData.youScore > matchData.opponentScore}
          />

          {/* Score Progression Timeline */}
          <View style={styles.chartSection}>
            <ScoreProgressionChart 
              scoreProgression={scoreProgression}
              userScore={matchData.youScore}
              opponentScore={matchData.opponentScore}
              userLabel={userName || 'You'}
              opponentLabel={matchData.opponentName || 'Opponent'}
            />
          </View>

          {/* Match Insights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Insights</Text>
            <View style={styles.insightRow}>
              <Text style={styles.insightLabel}>Avg. Time Between Touches</Text>
              <Text style={styles.insightValue}>{matchInsights.avgTimeBetweenTouches}</Text>
            </View>
            <View style={styles.insightRow}>
              <Text style={styles.insightLabel}>Longest Scoring Drought</Text>
              <Text style={styles.insightValue}>{matchInsights.longestScoringDrought}</Text>
            </View>
            <View style={[styles.insightRow, styles.insightRowLast]}>
              <Text style={styles.insightLabel}>Touch Streaks</Text>
              <Text style={styles.insightValue}>{matchInsights.touchStreaks}</Text>
            </View>
          </View>

          {/* Match Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Notes</Text>
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>
                {matchNotes || 'No match notes'}
              </Text>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}

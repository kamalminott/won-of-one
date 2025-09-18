import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    youScore: parseInt(params.youScore as string) || 5,
    opponentScore: parseInt(params.opponentScore as string) || 3,
    opponentName: params.opponentName as string || 'Alex',
    opponentImage: params.opponentImage as string || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
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
      setScoreProgression(progression);
    } catch (error) {
      console.error('Error fetching score progression:', error);
    }
  };


  // Load match insights and score progression when component mounts
  useEffect(() => {
    calculateMatchInsights();
    fetchScoreProgression();
  }, [matchData.matchId]);

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    console.log('Edit match details');
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
    backButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    title: {
      fontSize: width * 0.05,
      fontWeight: '600',
      color: 'white',
      flex: 1,
      textAlign: 'center',
      marginLeft: width * 0.06, // Offset for back button
    },
    editButton: {
      width: width * 0.055,
      height: width * 0.055,
      borderRadius: width * 0.0275,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editButtonText: {
      color: 'white',
      fontSize: width * 0.035,
      fontWeight: '600',
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
    sectionTitle: {
      fontSize: width * 0.045,
      fontWeight: '500',
      color: 'white',
      marginBottom: height * 0.02,
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
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Match History Details</Text>
            <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
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
            leftPlayerImage={profileImage || "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"}
            rightPlayerName={matchData.opponentName}
            rightPlayerImage={matchData.opponentImage || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"}
            youScore={matchData.youScore}
            opponentScore={matchData.opponentScore}
            duration={matchData.duration}
            matchType={matchData.matchType}
            isWin={params.isWin === 'true' || matchData.youScore > matchData.opponentScore}
          />

          {/* Score Progression Timeline */}
          <ScoreProgressionChart 
            scoreProgression={scoreProgression}
            userScore={matchData.youScore}
            opponentScore={matchData.opponentScore}
          />

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

        </ScrollView>
      </SafeAreaView>
    </>
  );
}

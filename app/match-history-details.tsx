import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import MatchSummaryCardWithBorder from '@/components/MatchSummaryCardWithBorder';
import { ScoreProgressionChart } from '@/components/ScoreProgressionChart';
import { useAuth } from '@/contexts/AuthContext';
import { matchService } from '@/lib/database';
import { supabase } from '@/lib/supabase';

import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

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
  const { userName, profileImage, user } = useAuth();
  const params = useLocalSearchParams();
  type MatchInsights = {
    avgTimeBetweenTouches: string;
    longestScoringDrought: string;
    touchStreaks: string;
    doubleTouches: string;
  };

  const EMPTY_MATCH_INSIGHTS: MatchInsights = {
    avgTimeBetweenTouches: 'No data',
    longestScoringDrought: 'No data',
    touchStreaks: 'No data',
    doubleTouches: '0',
  };

  const [matchInsights, setMatchInsights] = useState<MatchInsights>(EMPTY_MATCH_INSIGHTS);
  
  const [matchNotes, setMatchNotes] = useState('');
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [scoreProgression, setScoreProgression] = useState<{
    userData: Array<{ x: string; y: number }>;
    opponentData: Array<{ x: string; y: number }>;
  }>({
    userData: [],
    opponentData: []
  });
  
  // Normalize name for comparison (handles case, whitespace, etc.)
  const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.trim().toLowerCase();
  };
  
  // Get first name from full name
  const getFirstName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.split(' ')[0];
  };

  // Calculate match insights from real data
  const calculateMatchInsights = async () => {
    if (!match?.match_id) {
      setMatchInsights(EMPTY_MATCH_INSIGHTS);
      return;
    }
    
    try {
      // Get match events for this match
      const { data: matchEvents, error } = await supabase
        .from('match_event')
        .select('*')
        .eq('match_id', match.match_id)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching match events for insights calculation:', error);
        setMatchInsights(EMPTY_MATCH_INSIGHTS);
        return;
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for insights calculation');
        setMatchInsights(EMPTY_MATCH_INSIGHTS);
        return;
      }

      // Build cancelled set and filter to scoring events only, excluding cancelled
      const cancelledEventIds = new Set<string>();
      for (const event of matchEvents) {
        if ((event.event_type || '').toLowerCase() === 'cancel' && event.cancelled_event_id) {
          cancelledEventIds.add(event.cancelled_event_id);
        }
      }

      const scoringTypes = new Set(['touch', 'double', 'double_touch', 'double_hit']);
      const scoringEvents = matchEvents
        .filter(ev => {
          const type = (ev.event_type || '').toLowerCase();
          if (type === 'cancel') return false;
          if (ev.match_event_id && cancelledEventIds.has(ev.match_event_id)) return false;
          return scoringTypes.has(type);
        })
        .sort((a, b) => {
          const aElapsed = typeof a.match_time_elapsed === 'number' ? a.match_time_elapsed : null;
          const bElapsed = typeof b.match_time_elapsed === 'number' ? b.match_time_elapsed : null;
          if (aElapsed !== null && bElapsed !== null && aElapsed !== bElapsed) {
            return aElapsed - bElapsed;
          }
          const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return aTime - bTime;
        });

      if (scoringEvents.length === 0) {
        setMatchInsights(EMPTY_MATCH_INSIGHTS);
        return;
      }

      const allHaveElapsed = scoringEvents.every(e => typeof e.match_time_elapsed === 'number');
      const firstTimestampMs = scoringEvents[0]?.timestamp ? new Date(scoringEvents[0].timestamp).getTime() : null;

      const getSeconds = (event: any) => {
        if (allHaveElapsed && typeof event.match_time_elapsed === 'number') return event.match_time_elapsed;
        if (event.timestamp && firstTimestampMs !== null) {
          const ms = new Date(event.timestamp).getTime();
          return Number.isFinite(ms) ? Math.max(0, Math.round((ms - firstTimestampMs) / 1000)) : 0;
        }
        if (typeof event.match_time_elapsed === 'number') return event.match_time_elapsed;
        if (event.timestamp) {
          const ms = new Date(event.timestamp).getTime();
          return Number.isFinite(ms) ? Math.round(ms / 1000) : 0;
        }
        return 0;
      };

      // Calculate average time between scoring touches
      const canComputeIntervals = scoringEvents.length > 1;
      let totalTimeBetweenTouches = 0;
      let touchCount = 0;

      for (let i = 1; i < scoringEvents.length; i++) {
        const currentSeconds = getSeconds(scoringEvents[i]);
        const previousSeconds = getSeconds(scoringEvents[i - 1]);
        const timeDiff = Math.max(0, currentSeconds - previousSeconds);
        
        totalTimeBetweenTouches += timeDiff;
        touchCount++;
      }

      const avgTime = touchCount > 0 ? Math.round(totalTimeBetweenTouches / touchCount) : 0;

      // Debug: Log all events to see what we're working with
      console.log('🔍 Match Events Debug:', {
        totalEvents: matchEvents.length,
        scoringEvents: scoringEvents.length,
        cancelled: cancelledEventIds.size,
        userName: userName,
        eventScorers: scoringEvents.map(e => e.scoring_user_name),
        uniqueScorers: [...new Set(scoringEvents.map(e => e.scoring_user_name))]
      });

      // Calculate longest scoring drought (longest time between ANY scoring events)
      let longestDrought = 0;
      const doubleTypes = new Set(['double', 'double_touch', 'double_hit']);
      const doubleTouchCount = scoringEvents.filter(ev => doubleTypes.has((ev.event_type || '').toLowerCase())).length;
      
      if (scoringEvents.length > 1) {
        for (let i = 1; i < scoringEvents.length; i++) {
          const currentSeconds = getSeconds(scoringEvents[i]);
          const previousSeconds = getSeconds(scoringEvents[i - 1]);
          const timeDiff = Math.max(0, currentSeconds - previousSeconds);
          
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

      const normalizedUserVariations = userNameVariations.map(variation => normalizeName(variation));

      for (const event of scoringEvents) {
        const eventType = (event.event_type || '').toLowerCase();

        // In epee, a double touch should break the streak (it doesn't belong to either fencer)
        if (doubleTypes.has(eventType)) {
          currentStreak = 0;
          lastScorerWasUser = false;
          continue;
        }

        const scorerName = normalizeName(event.scoring_user_name);
        const isUserScoring = scorerName
          ? normalizedUserVariations.some(variation => scorerName === variation)
          : false;
        
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
        avgTimeBetweenTouches: canComputeIntervals ? `${avgTime}s` : 'No data',
        longestScoringDrought: canComputeIntervals ? `${Math.round(longestDrought)}s` : 'No data',
        touchStreaks: maxStreak > 1 ? `${maxStreak} in a row` : maxStreak === 1 ? '1 touch' : 'No data',
        doubleTouches: `${doubleTouchCount}`
      });

    } catch (error) {
      console.error('Error calculating match insights:', error);
      setMatchInsights(EMPTY_MATCH_INSIGHTS);
    }
  };

  // Fetch score progression data
  const fetchScoreProgression = async () => {
    if (!match?.match_id) return;
    
    try {
      // Determine which fencer is the user (for mapping)
      const normalizedUserName = normalizeName(userName);
      const isFencer1User = normalizedUserName && match.fencer_1_name
        ? normalizeName(match.fencer_1_name) === normalizedUserName
        : false;
      const isFencer2User = normalizedUserName && match.fencer_2_name
        ? normalizeName(match.fencer_2_name) === normalizedUserName
        : false;

      // Use anonymous progression to avoid relying on name matching (handles epee double touches and swapped fencers)
      const progression = await matchService.calculateAnonymousScoreProgression(
        match.match_id
      );
      const mappedProgression = isFencer1User
        ? { userData: progression.fencer1Data, opponentData: progression.fencer2Data }
        : isFencer2User
        ? { userData: progression.fencer2Data, opponentData: progression.fencer1Data }
        : { userData: progression.fencer1Data, opponentData: progression.fencer2Data };

      console.log('📊 fetchScoreProgression (anonymous) mapped:', {
        isFencer1User,
        isFencer2User,
        userDataLength: mappedProgression.userData?.length,
        opponentDataLength: mappedProgression.opponentData?.length,
        userFirst: mappedProgression.userData?.[0],
        opponentFirst: mappedProgression.opponentData?.[0],
      });

      // Align progression with DB totals when they don't match (avoid inflated scores from duplicate/double events)
      const dbUserScore = match?.final_score ?? 0;
      const dbOpponentScore = match?.touches_against ?? 0;
      const progressionUserTotal = mappedProgression.userData.length > 0 ? mappedProgression.userData[mappedProgression.userData.length - 1].y : 0;
      const progressionOpponentTotal = mappedProgression.opponentData.length > 0 ? mappedProgression.opponentData[mappedProgression.opponentData.length - 1].y : 0;
      const progressionMatchesDb = progressionUserTotal === dbUserScore && progressionOpponentTotal === dbOpponentScore;

      const trimProgression = (data: { x: string; y: number }[], maxY: number) => {
        const filtered = data.filter(point => point.y <= maxY);
        if (filtered.length === 0) {
          return maxY > 0 ? [{ x: '00:00', y: 0 }] : [];
        }
        return filtered;
      };

      const alignedProgression = progressionMatchesDb ? mappedProgression : {
        userData: trimProgression(mappedProgression.userData, dbUserScore),
        opponentData: trimProgression(mappedProgression.opponentData, dbOpponentScore),
      };

      if (!progressionMatchesDb) {
        console.warn('⚠️ [Match History Details] Progression totals differ from DB, aligning to DB scores', {
          matchId: match.match_id,
          progressionUserTotal,
          progressionOpponentTotal,
          dbUserScore,
          dbOpponentScore,
          userTrimmed: alignedProgression.userData.length,
          opponentTrimmed: alignedProgression.opponentData.length,
        });
      }

      setScoreProgression(alignedProgression);
    } catch (error) {
      console.error('Error fetching score progression:', error);
    }
  };

  // Fetch match notes
  const fetchMatchNotes = async () => {
    if (!match?.match_id) return;
    
    try {
      // Notes are already in the match object we fetched
      if (match && 'notes' in match && match.notes) {
        setMatchNotes(match.notes);
        console.log('📝 Match notes loaded from match object:', match.notes);
      } else {
        console.log('📝 No notes found in match record');
      }
    } catch (error) {
      console.error('Error fetching match notes:', error);
    }
  };


  // Fetch match data when component mounts
  useEffect(() => {
    const fetchMatch = async () => {
      if (!params.matchId) {
        console.log('⚠️ No matchId in params');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching match data for matchId:', params.matchId);
        const matchData = await matchService.getMatchById(params.matchId as string);
        console.log('✅ Match data fetched:', {
          matchId: matchData?.match_id,
          fencer1Name: matchData?.fencer_1_name,
          fencer2Name: matchData?.fencer_2_name,
          finalScore: matchData?.final_score,
          touchesAgainst: matchData?.touches_against
        });
        setMatch(matchData);
      } catch (error) {
        console.error('❌ Error fetching match:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [params.matchId]);

  // Load match insights, score progression, and notes when match is loaded
  useEffect(() => {
    if (match && match.match_id) {
      calculateMatchInsights();
      fetchScoreProgression();
      fetchMatchNotes();
    }
  }, [match?.match_id]);

  // Debug score progression state changes
  useEffect(() => {
    console.log('📊 scoreProgression state changed:', scoreProgression);
  }, [scoreProgression]);

  // Calculate display data based on match from database
  // Determine which fencer is the user and map names/scores correctly
  const normalizedUserName = normalizeName(userName);
  const isFencer1User = normalizedUserName && match?.fencer_1_name
    ? normalizeName(match.fencer_1_name) === normalizedUserName
    : false;
  const isFencer2User = normalizedUserName && match?.fencer_2_name
    ? normalizeName(match.fencer_2_name) === normalizedUserName
    : false;
  
  console.log('🔍 [Match History Details] User identification:', {
    userName,
    normalizedUserName,
    fencer1Name: match?.fencer_1_name,
    fencer2Name: match?.fencer_2_name,
    normalizedFencer1: match?.fencer_1_name ? normalizeName(match.fencer_1_name) : 'N/A',
    normalizedFencer2: match?.fencer_2_name ? normalizeName(match.fencer_2_name) : 'N/A',
    isFencer1User,
    isFencer2User
  });
  
  // Map position-based names (fencer_1 = left, fencer_2 = right)
  // These reflect the final positions after any swaps
  // IMPORTANT: We need to ensure we show the correct name for each position
  // If a fencer is the user, show user's name; if opponent, show opponent's name
  let leftPlayerName: string;
  let rightPlayerName: string;
  
  if (match && match.fencer_1_name !== null && match.fencer_1_name !== undefined && 
      match.fencer_2_name !== null && match.fencer_2_name !== undefined) {
    // Match data is loaded - get names from database
    let fencer1Name = match.fencer_1_name;
    let fencer2Name = match.fencer_2_name;
    
    // Handle "You" replacement for manual matches
    if (fencer1Name === 'You') {
      fencer1Name = userName || 'You';
    }
    if (fencer2Name === 'You') {
      fencer2Name = userName || 'You';
    }
    
    // Determine which fencer is the user and which is the opponent
    // Then assign names to left/right positions correctly
    if (isFencer1User) {
      // User is fencer_1 (left position), opponent is fencer_2 (right position)
      leftPlayerName = fencer1Name; // User's name
      rightPlayerName = fencer2Name; // Opponent's name
    } else if (isFencer2User) {
      // User is fencer_2 (right position), opponent is fencer_1 (left position)
      leftPlayerName = fencer1Name; // Opponent's name
      rightPlayerName = fencer2Name; // User's name
    } else {
      // Can't identify user - use database values as-is (fallback)
      // This handles edge cases where user name doesn't match either fencer
      leftPlayerName = fencer1Name;
      rightPlayerName = fencer2Name;
      
      // If both names are the same (data issue), try to use params
      if (fencer1Name === fencer2Name && params.opponentName) {
        console.warn('⚠️ [Match History Details] Both fencers have same name - using opponent from params');
        // Assume user is on left (old behavior)
        rightPlayerName = params.opponentName as string;
      }
    }
  } else {
    // Match data not loaded yet - use params as fallback
    leftPlayerName = userName || (params.opponentName ? 'Fencer 1' : 'Fencer 1');
    rightPlayerName = params.opponentName as string || 'Fencer 2';
  }
  
  console.log('🔍 [Match History Details] Position-based names:', {
    matchExists: !!match,
    fromDatabase: {
      fencer1: match?.fencer_1_name,
      fencer2: match?.fencer_2_name,
      fencer1Type: typeof match?.fencer_1_name,
      fencer2Type: typeof match?.fencer_2_name,
      fencer1IsNull: match?.fencer_1_name === null,
      fencer2IsNull: match?.fencer_2_name === null,
      fencer1IsUndefined: match?.fencer_1_name === undefined,
      fencer2IsUndefined: match?.fencer_2_name === undefined,
      fencer1IsEmpty: match?.fencer_1_name === '',
      fencer2IsEmpty: match?.fencer_2_name === ''
    },
    fromParams: {
      userName,
      opponentName: params.opponentName
    },
    final: {
      left: leftPlayerName,
      right: rightPlayerName
    },
    isFencer1User,
    isFencer2User,
    loading,
    bothNamesSame: leftPlayerName === rightPlayerName,
    note: (match && match.fencer_1_name !== null && match.fencer_1_name !== undefined) 
      ? 'Using database values (reflects swaps)' 
      : 'Using params fallback (assumes user on left)'
  });
  
  // Final safeguard: If both names are the same and match the user, use opponent from params
  if (leftPlayerName === rightPlayerName && leftPlayerName === userName && params.opponentName) {
    console.warn('⚠️ [Match History Details] Both names are user name - using opponent from params');
    // Assume user is on left (old behavior)
    rightPlayerName = params.opponentName as string;
  }
  
  // Determine which position has the user for image/display
  // If match data is available, use the calculated values
  // Otherwise, assume user is on left (old behavior before swaps were tracked)
  const leftIsUser = match ? isFencer1User : true;
  const rightIsUser = match ? isFencer2User : false;
  const weaponType = match?.weapon_type || (params.weaponType as string | undefined);
  
  // Prefer progression totals when available; fallback to entity-based scores from DB/params
  const progressionUserTotal = scoreProgression.userData.length > 0 ? scoreProgression.userData[scoreProgression.userData.length - 1].y : 0;
  const progressionOpponentTotal = scoreProgression.opponentData.length > 0 ? scoreProgression.opponentData[scoreProgression.opponentData.length - 1].y : 0;
  const dbUserScore = match ? (match.final_score || 0) : (params.youScore ? parseInt(params.youScore as string) : 0);
  const dbOpponentScore = match ? (match.touches_against || 0) : (params.opponentScore ? parseInt(params.opponentScore as string) : 0);
  const progressionMatchesDb = progressionUserTotal === dbUserScore && progressionOpponentTotal === dbOpponentScore;
  const userScore = progressionMatchesDb && progressionUserTotal > 0 ? progressionUserTotal : dbUserScore;
  const opponentScore = progressionMatchesDb && progressionOpponentTotal > 0 ? progressionOpponentTotal : dbOpponentScore;

  // Map to left/right (positions) based on which fencer is the user
  const leftScore = match 
    ? (isFencer1User 
      ? userScore   // User is fencer_1 (left)
      : isFencer2User 
      ? opponentScore // User is fencer_2 (right), so left is opponent
      : dbUserScore) // Fallback
    : (params.youScore ? parseInt(params.youScore as string) : 0);
  const rightScore = match
    ? (isFencer1User 
      ? opponentScore  // User is fencer_1 (left), right is opponent
      : isFencer2User 
      ? userScore      // User is fencer_2 (right)
      : dbOpponentScore) // Fallback
    : (params.opponentScore ? parseInt(params.opponentScore as string) : 0);

  console.log('🔍 [Match History Details] Position-based scores:', {
    fromDatabase: {
      final_score: match?.final_score,
      touches_against: match?.touches_against
    },
    fromProgression: {
      user: progressionUserTotal,
      opponent: progressionOpponentTotal
    },
    entityMapping: {
      isFencer1User,
      isFencer2User
    },
    final: {
      left: leftScore,
      right: rightScore,
      userScore,
      opponentScore
    },
    note: 'Mapped entity-based scores to position-based scores with progression fallback'
  });
  
  // Get user's name for labels (could be on left or right)
  const userFencerName = match
    ? (isFencer1User 
      ? (match.fencer_1_name || userName || 'You')
      : isFencer2User 
      ? (match.fencer_2_name || userName || 'You')
      : (match.fencer_1_name || userName || 'You'))
    : (userName || 'You');
  const opponentFencerName = match
    ? (isFencer1User 
      ? (match.fencer_2_name || 'Opponent')
      : isFencer2User 
      ? (match.fencer_1_name || 'Opponent')
      : (match.fencer_2_name || 'Opponent'))
    : (params.opponentName as string || 'Opponent');
  
  // Format duration
  const duration = match?.bout_length_s 
    ? `${Math.floor(match.bout_length_s / 60)}:${(match.bout_length_s % 60).toString().padStart(2, '0')}`
    : (params.duration as string || '02:30');
  
  // Get match type
  const matchType = match?.match_type || (params.matchType as string) || 'Training';

  const handleBack = () => {
    router.back();
  };

  const handleDelete = () => {
    const matchId = (params.matchId as string) || match?.match_id;

    if (!matchId) {
      console.log('No match ID provided for deletion');
      Alert.alert('Error', 'Cannot delete match: match ID not found');
      return;
    }

    Alert.alert(
      'Delete Match',
      'Are you sure you want to delete this match? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting match:', matchId);
              const success = await matchService.deleteMatch(matchId);

              if (success) {
                console.log('✅ Match deleted successfully');
                Alert.alert('Success', 'Match deleted successfully');
                router.push('/(tabs)');
              } else {
                console.error('❌ Failed to delete match');
                Alert.alert('Error', 'Failed to delete match. Please try again.');
              }
            } catch (error) {
              console.error('❌ Error deleting match:', error);
              Alert.alert('Error', 'Failed to delete match. Please try again.');
            }
          },
        },
      ]
    );
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.03,
    },
    headerActionButton: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: '#2A2A2A',
      alignItems: 'center',
      justifyContent: 'center',
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
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleDelete} style={styles.headerActionButton}>
                <Ionicons name="trash-outline" size={22} color="#FF7675" />
              </TouchableOpacity>
            </View>
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
            leftPlayerName={getFirstName(leftPlayerName)}
            leftPlayerImage={leftIsUser ? (profileImage || undefined) : undefined}
            rightPlayerName={getFirstName(rightPlayerName)}
            rightPlayerImage={rightIsUser ? (profileImage || undefined) : undefined}
            youScore={userScore}
            opponentScore={opponentScore}
            duration={duration}
            matchType={matchType}
            isWin={params.isWin === 'true' || userScore > opponentScore}
          />

          {/* Score Progression Timeline */}
          <View style={styles.chartSection}>
            <ScoreProgressionChart 
              scoreProgression={scoreProgression}
              userScore={userScore}
              opponentScore={opponentScore}
              userLabel={getFirstName(userFencerName) || userName || 'You'}
              opponentLabel={getFirstName(opponentFencerName) || 'Opponent'}
              userPosition={isFencer1User ? 'left' : isFencer2User ? 'right' : 'left'}
              weaponType={weaponType}
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
            <View style={styles.insightRow}>
              <Text style={styles.insightLabel}>Touch Streaks</Text>
              <Text style={styles.insightValue}>{matchInsights.touchStreaks}</Text>
            </View>
            <View style={[styles.insightRow, styles.insightRowLast]}>
              <Text style={styles.insightLabel}>Double Touches</Text>
              <Text style={styles.insightValue}>{matchInsights.doubleTouches}</Text>
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

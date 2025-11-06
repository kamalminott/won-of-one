import { BounceBackTimeCard, LeadChangesCard, LongestRunCard, TimeLeadingCard } from '@/components';
import { ScoreProgressionChart } from '@/components/ScoreProgressionChart';
import { TouchesByPeriodChart } from '@/components/TouchesByPeriodChart';
import { matchService } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function NeutralMatchSummary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [matchData, setMatchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [touchesByPeriod, setTouchesByPeriod] = useState<{
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  }>({
    period1: { user: 0, opponent: 0 },
    period2: { user: 0, opponent: 0 },
    period3: { user: 0, opponent: 0 }
  });
  const [scoreProgression, setScoreProgression] = useState<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }>({ userData: [], opponentData: [] });
  const [leadChanges, setLeadChanges] = useState<number>(0);
  const [timeLeading, setTimeLeading] = useState<{
    fencer1: number;
    fencer2: number;
    tied: number;
  }>({ fencer1: 0, fencer2: 0, tied: 100 });
  const [bounceBackTimes, setBounceBackTimes] = useState<{
    fencer1: number;
    fencer2: number;
  }>({ fencer1: 0, fencer2: 0 });
  const [longestRuns, setLongestRuns] = useState<{
    fencer1: number;
    fencer2: number;
  }>({ fencer1: 0, fencer2: 0 });

  // Extract match data from params
  const {
    matchId,
    aliceScore,
    bobScore,
    aliceCards,
    bobCards,
    matchDuration,
    fencer1Name,
    fencer2Name,
  } = params;

  // Function to calculate longest runs from match events
  const calculateLongestRuns = async (matchId: string) => {
    try {
      const { data: matchEvents, error } = await supabase
        .from('match_event')
        .select('scoring_user_name, match_time_elapsed')
        .eq('match_id', matchId)
        .order('match_time_elapsed', { ascending: true });

      if (error) {
        console.error('Error fetching match events for longest runs:', error);
        return { fencer1: 0, fencer2: 0 };
      }

      if (!matchEvents || matchEvents.length === 0) {
        return { fencer1: 0, fencer2: 0 };
      }

      let fencer1CurrentRun = 0;
      let fencer2CurrentRun = 0;
      let fencer1LongestRun = 0;
      let fencer2LongestRun = 0;

      // Process events chronologically to find consecutive scoring streaks
      for (const event of matchEvents) {
        if (event.scoring_user_name === fencer1Name) {
          // Fencer 1 scored - increment their run, reset fencer 2's run
          fencer1CurrentRun++;
          fencer2CurrentRun = 0;
          
          // Update longest run if current run is longer
          if (fencer1CurrentRun > fencer1LongestRun) {
            fencer1LongestRun = fencer1CurrentRun;
          }
        } else if (event.scoring_user_name === fencer2Name) {
          // Fencer 2 scored - increment their run, reset fencer 1's run
          fencer2CurrentRun++;
          fencer1CurrentRun = 0;
          
          // Update longest run if current run is longer
          if (fencer2CurrentRun > fencer2LongestRun) {
            fencer2LongestRun = fencer2CurrentRun;
          }
        }
      }

      console.log('📊 Calculated longest runs:', {
        fencer1: fencer1LongestRun,
        fencer2: fencer2LongestRun,
        totalEvents: matchEvents.length
      });

      return {
        fencer1: fencer1LongestRun,
        fencer2: fencer2LongestRun
      };
    } catch (error) {
      console.error('Error calculating longest runs:', error);
      return { fencer1: 0, fencer2: 0 };
    }
  };

  // Function to calculate bounce back times from match events
  const calculateBounceBackTimes = async (matchId: string) => {
    try {
      const { data: matchEvents, error } = await supabase
        .from('match_event')
        .select('scoring_user_name, match_time_elapsed')
        .eq('match_id', matchId)
        .order('match_time_elapsed', { ascending: true });

      if (error) {
        console.error('Error fetching match events for bounce back times:', error);
        return { fencer1: 0, fencer2: 0 };
      }

      if (!matchEvents || matchEvents.length < 2) {
        return { fencer1: 0, fencer2: 0 };
      }

      const fencer1BounceBackTimes: number[] = [];
      const fencer2BounceBackTimes: number[] = [];

      // Track the last time each fencer was scored against
      let lastFencer1ScoredAgainst: number | null = null;
      let lastFencer2ScoredAgainst: number | null = null;

      // Process events chronologically
      for (const event of matchEvents) {
        const currentTime = event.match_time_elapsed || 0;

        if (event.scoring_user_name === fencer1Name) {
          // Fencer 1 scored - check if fencer 2 was scored against recently
          if (lastFencer2ScoredAgainst !== null) {
            const bounceBackTime = currentTime - lastFencer2ScoredAgainst;
            fencer2BounceBackTimes.push(bounceBackTime);
          }
          lastFencer2ScoredAgainst = currentTime;
        } else if (event.scoring_user_name === fencer2Name) {
          // Fencer 2 scored - check if fencer 1 was scored against recently
          if (lastFencer1ScoredAgainst !== null) {
            const bounceBackTime = currentTime - lastFencer1ScoredAgainst;
            fencer1BounceBackTimes.push(bounceBackTime);
          }
          lastFencer1ScoredAgainst = currentTime;
        }
      }

      // Calculate average bounce back times
      const fencer1AvgBounceBack = fencer1BounceBackTimes.length > 0 
        ? Math.round(fencer1BounceBackTimes.reduce((sum, time) => sum + time, 0) / fencer1BounceBackTimes.length)
        : 0;
      
      const fencer2AvgBounceBack = fencer2BounceBackTimes.length > 0 
        ? Math.round(fencer2BounceBackTimes.reduce((sum, time) => sum + time, 0) / fencer2BounceBackTimes.length)
        : 0;

      console.log('📊 Calculated bounce back times:', {
        fencer1: fencer1AvgBounceBack,
        fencer2: fencer2AvgBounceBack,
        fencer1BounceBackTimes,
        fencer2BounceBackTimes
      });

      return {
        fencer1: fencer1AvgBounceBack,
        fencer2: fencer2AvgBounceBack
      };
    } catch (error) {
      console.error('Error calculating bounce back times:', error);
      return { fencer1: 0, fencer2: 0 };
    }
  };

  // Function to calculate time leading percentages from match events
  const calculateTimeLeading = async (matchId: string) => {
    try {
      console.log('🔍 TIME LEADING DEBUG - Starting calculation for matchId:', matchId);
      console.log('🔍 TIME LEADING DEBUG - Fencer names:', { fencer1Name, fencer2Name });
      
      const { data: matchEvents, error } = await supabase
        .from('match_event')
        .select('scoring_user_name, match_time_elapsed')
        .eq('match_id', matchId)
        .order('match_time_elapsed', { ascending: true });

      if (error) {
        console.error('Error fetching match events for time leading:', error);
        return { fencer1: 0, fencer2: 0, tied: 100 };
      }

      console.log('🔍 TIME LEADING DEBUG - Match events found:', matchEvents?.length || 0);
      if (matchEvents && matchEvents.length > 0) {
        console.log('🔍 TIME LEADING DEBUG - Sample events:', matchEvents.slice(0, 3));
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('🔍 TIME LEADING DEBUG - No events found, returning default values');
        return { fencer1: 0, fencer2: 0, tied: 100 };
      }

      let aliceScore = 0;
      let bobScore = 0;
      let fencer1LeadingTime = 0;
      let fencer2LeadingTime = 0;
      let tiedTime = 0;
      let lastTime = 0;

      // Process each scoring event chronologically
      for (let i = 0; i < matchEvents.length; i++) {
        const event = matchEvents[i];
        const currentTime = event.match_time_elapsed || 0;
        
        // Calculate time leading BEFORE this event (based on current scores)
        const timeDiff = currentTime - lastTime;
        
        console.log(`🔍 TIME LEADING DEBUG - Event ${i}: scorer="${event.scoring_user_name}", time=${currentTime}`);
        console.log(`🔍 TIME LEADING DEBUG - Before event: aliceScore=${aliceScore}, bobScore=${bobScore}, timeDiff=${timeDiff}`);
        
        // Determine who was leading during this time period (BEFORE the event)
        if (aliceScore > bobScore) {
          fencer1LeadingTime += timeDiff;
          console.log(`🔍 TIME LEADING DEBUG - Fencer1 was leading for ${timeDiff}s`);
        } else if (bobScore > aliceScore) {
          fencer2LeadingTime += timeDiff;
          console.log(`🔍 TIME LEADING DEBUG - Fencer2 was leading for ${timeDiff}s`);
        } else {
          tiedTime += timeDiff;
          console.log(`🔍 TIME LEADING DEBUG - Tied for ${timeDiff}s`);
        }

        // Update scores AFTER calculating time leading
        if (event.scoring_user_name === fencer1Name) {
          aliceScore++;
          console.log(`🔍 TIME LEADING DEBUG - Fencer1 scored! New aliceScore: ${aliceScore}`);
        } else if (event.scoring_user_name === fencer2Name) {
          bobScore++;
          console.log(`🔍 TIME LEADING DEBUG - Fencer2 scored! New bobScore: ${bobScore}`);
        } else {
          console.log(`🔍 TIME LEADING DEBUG - Unknown scorer: ${event.scoring_user_name}`);
        }

        lastTime = currentTime;
      }

      // Handle time from last event to actual match end (not remaining time)
      // The match ended at the last event time, so no additional time should be added
      console.log(`🔍 TIME LEADING DEBUG - Final calculation: match ended at ${lastTime}s, aliceScore=${aliceScore}, bobScore=${bobScore}`);
      console.log(`🔍 TIME LEADING DEBUG - No additional time added - match ended at last event`);

      // Calculate percentages
      const totalTime = fencer1LeadingTime + fencer2LeadingTime + tiedTime;
      const fencer1Percentage = totalTime > 0 ? Math.round((fencer1LeadingTime / totalTime) * 100) : 0;
      const fencer2Percentage = totalTime > 0 ? Math.round((fencer2LeadingTime / totalTime) * 100) : 0;
      const tiedPercentage = 100 - fencer1Percentage - fencer2Percentage;

      console.log('📊 Calculated time leading:', {
        fencer1: fencer1Percentage,
        fencer2: fencer2Percentage,
        tied: tiedPercentage,
        totalTime,
        fencer1LeadingTime,
        fencer2LeadingTime,
        tiedTime,
        finalAliceScore: aliceScore,
        finalBobScore: bobScore
      });

      return {
        fencer1: fencer1Percentage,
        fencer2: fencer2Percentage,
        tied: tiedPercentage
      };
    } catch (error) {
      console.error('Error calculating time leading:', error);
      return { fencer1: 0, fencer2: 0, tied: 100 };
    }
  };

  // Function to calculate lead changes from match events
  const calculateLeadChanges = async (matchId: string) => {
    try {
      const { data: matchEvents, error } = await supabase
        .from('match_event')
        .select('scoring_user_name, match_time_elapsed')
        .eq('match_id', matchId)
        .order('match_time_elapsed', { ascending: true });

      if (error) {
        console.error('Error fetching match events for lead changes:', error);
        return 0;
      }

      if (!matchEvents || matchEvents.length === 0) {
        return 0;
      }

      let leadChanges = 0;
      let currentLeader: string | null = null;
      let aliceScore = 0;
      let bobScore = 0;

      // Process each scoring event chronologically
      for (const event of matchEvents) {
        if (event.scoring_user_name === fencer1Name) {
          aliceScore++;
        } else if (event.scoring_user_name === fencer2Name) {
          bobScore++;
        }

        // Check if lead has changed
        let newLeader: string | null = null;
        if (aliceScore > bobScore) {
          newLeader = fencer1Name as string;
        } else if (bobScore > aliceScore) {
          newLeader = fencer2Name as string;
        } else {
          newLeader = null; // Tied
        }

        // If leader changed (and we're not at 0-0), count as lead change
        if (newLeader !== currentLeader && (aliceScore > 0 || bobScore > 0)) {
          if (currentLeader !== null) { // Don't count the first score as a lead change
            leadChanges++;
          }
          currentLeader = newLeader;
        }
      }

      console.log('📊 Calculated lead changes:', leadChanges);
      return leadChanges;
    } catch (error) {
      console.error('Error calculating lead changes:', error);
      return 0;
    }
  };

  useEffect(() => {
    const loadMatchData = async () => {
      try {
        if (matchId) {
          // Check if this is an offline match
          const isOffline = params.isOffline === 'true' || (matchId as string).startsWith('offline_');
          
          if (isOffline) {
            // Use params data directly for offline matches
            console.log('📱 Loading offline match from params');
            
            const matchFromParams = {
              match_id: matchId as string,
              fencer_1_name: params.fencer1Name as string || 'Fencer 1',
              fencer_2_name: params.fencer2Name as string || 'Fencer 2',
              final_score: parseInt(params.aliceScore as string || '0'),
              touches_against: parseInt(params.bobScore as string || '0'),
              bout_length_s: parseInt(params.matchDuration as string || '0'),
              yellow_cards: JSON.parse(params.aliceCards as string || '{"yellow":0,"red":0}').yellow + 
                           JSON.parse(params.bobCards as string || '{"yellow":0,"red":0}').yellow,
              red_cards: JSON.parse(params.aliceCards as string || '{"yellow":0,"red":0}').red + 
                         JSON.parse(params.bobCards as string || '{"yellow":0,"red":0}').red,
              period_number: parseInt(params.periodNumber as string || '1'),
              score_spp: parseInt(params.scoreSpp as string || '0'),
              score_by_period: params.scoreByPeriod ? JSON.parse(params.scoreByPeriod as string) : undefined,
              is_complete: true,
              source: 'remote',
              event_date: new Date().toISOString().split('T')[0],
            };
            
            setMatchData(matchFromParams);
            
            // Set touches by period from params
            if (params.scoreByPeriod) {
              const scoreByPeriod = JSON.parse(params.scoreByPeriod as string);
              setTouchesByPeriod({
                period1: { user: scoreByPeriod.period1?.user || 0, opponent: scoreByPeriod.period1?.opponent || 0 },
                period2: { user: scoreByPeriod.period2?.user || 0, opponent: scoreByPeriod.period2?.opponent || 0 },
                period3: { user: scoreByPeriod.period3?.user || 0, opponent: scoreByPeriod.period3?.opponent || 0 },
              });
            }
            
            // Simplified stats for offline matches (no event data available)
            setScoreProgression({ userData: [], opponentData: [] });
            setLeadChanges(0);
            setTimeLeading({ fencer1: 0, fencer2: 0, tied: 100 });
            setBounceBackTimes({ fencer1: 0, fencer2: 0 });
            setLongestRuns({ fencer1: 0, fencer2: 0 });
            
            setLoading(false);
            return;
          }
          
          // Online match - fetch from database
          const data = await matchService.getMatchById(matchId as string);
          setMatchData(data);
          
          // Fetch actual period scores from match_period table
          try {
            const { data: matchPeriods, error: periodsError } = await supabase
              .from('match_period')
              .select('period_number, fencer_1_score, fencer_2_score')
              .eq('match_id', matchId as string)
              .order('period_number', { ascending: true });

            if (periodsError) {
              console.error('Error fetching match periods:', periodsError);
              throw periodsError;
            }

            if (matchPeriods && matchPeriods.length > 0) {
              console.log('📊 Found match periods:', matchPeriods);
              
              // Initialize with zeros
              const touchesByPeriodData = {
                period1: { user: 0, opponent: 0 },
                period2: { user: 0, opponent: 0 },
                period3: { user: 0, opponent: 0 }
              };

              // Sort periods by period_number to ensure correct order
              const sortedPeriods = matchPeriods.sort((a, b) => (a.period_number || 0) - (b.period_number || 0));
              
              // Fill in actual period scores (touches scored PER period, not cumulative)
              sortedPeriods.forEach((period, index) => {
                const periodNum = period.period_number || 1;
                const currentFencer1Score = period.fencer_1_score || 0;
                const currentFencer2Score = period.fencer_2_score || 0;
                
                // Get previous period's cumulative scores (0 if first period)
                const previousFencer1Score = index > 0 ? (sortedPeriods[index - 1].fencer_1_score || 0) : 0;
                const previousFencer2Score = index > 0 ? (sortedPeriods[index - 1].fencer_2_score || 0) : 0;
                
                // Calculate touches scored DURING this period
                const fencer1TouchesThisPeriod = currentFencer1Score - previousFencer1Score;
                const fencer2TouchesThisPeriod = currentFencer2Score - previousFencer2Score;
                
                if (periodNum === 1) {
                  touchesByPeriodData.period1.user = fencer1TouchesThisPeriod;
                  touchesByPeriodData.period1.opponent = fencer2TouchesThisPeriod;
                } else if (periodNum === 2) {
                  touchesByPeriodData.period2.user = fencer1TouchesThisPeriod;
                  touchesByPeriodData.period2.opponent = fencer2TouchesThisPeriod;
                } else if (periodNum === 3) {
                  touchesByPeriodData.period3.user = fencer1TouchesThisPeriod;
                  touchesByPeriodData.period3.opponent = fencer2TouchesThisPeriod;
                }
              });

              console.log('📊 Using actual period scores from database:', touchesByPeriodData);
              setTouchesByPeriod(touchesByPeriodData);
              
              // Also fetch score progression data
              if (data && data.fencer_1_name) {
                try {
                  const calculatedScoreProgression = await matchService.calculateAnonymousScoreProgression(
                    matchId as string
                  );
                  console.log('📈 Calculated anonymous score progression from database:', calculatedScoreProgression);
                  
                  // Check if we got meaningful data for both players
                  const hasFencer1Data = calculatedScoreProgression.fencer1Data.length > 0;
                  const hasFencer2Data = calculatedScoreProgression.fencer2Data.length > 0;
                  
                  console.log('📈 DATA VALIDATION:', {
                    hasFencer1Data,
                    hasFencer2Data,
                    fencer1DataLength: calculatedScoreProgression.fencer1Data.length,
                    fencer2DataLength: calculatedScoreProgression.fencer2Data.length
                  });
                  
                  if (hasFencer1Data && hasFencer2Data) {
                    console.log('📈 Using real anonymous score progression data from database');
                    // Convert to the format expected by the chart component
                    const scoreProgression = {
                      userData: calculatedScoreProgression.fencer1Data,
                      opponentData: calculatedScoreProgression.fencer2Data
                    };
                    setScoreProgression(scoreProgression);
                  } else {
                    console.log('📈 Anonymous score progression data incomplete, using real data where available');
                    // Use the real data we have and create simple fallback for missing data
                    const aliceScoreNum = parseInt(aliceScore as string) || 0;
                    const bobScoreNum = parseInt(bobScore as string) || 0;
                    const matchDurationNum = parseInt(matchDuration as string) || 1;
                    
                    let finalFencer1Data = calculatedScoreProgression.fencer1Data;
                    let finalFencer2Data = calculatedScoreProgression.fencer2Data;
                    
                    // If fencer 1 data is missing, create simple fallback
                    if (!hasFencer1Data && aliceScoreNum > 0) {
                      const finalTime = `${Math.floor(matchDurationNum/60)}:${(matchDurationNum%60).toString().padStart(2, '0')}`;
                      finalFencer1Data = [
                        { x: "0:00", y: 0 },
                        { x: finalTime, y: aliceScoreNum }
                      ];
                    }
                    
                    // If fencer 2 data is missing, create simple fallback
                    if (!hasFencer2Data && bobScoreNum > 0) {
                      const finalTime = `${Math.floor(matchDurationNum/60)}:${(matchDurationNum%60).toString().padStart(2, '0')}`;
                      finalFencer2Data = [
                        { x: "0:00", y: 0 },
                        { x: finalTime, y: bobScoreNum }
                      ];
                    }
                    
                    const mixedScoreProgression = {
                      userData: finalFencer1Data,
                      opponentData: finalFencer2Data
                    };
                    
                    console.log('📈 Using mixed anonymous score progression (real + fallback):', mixedScoreProgression);
                    setScoreProgression(mixedScoreProgression);
                  }
                } catch (error) {
                  console.error('Error calculating score progression:', error);
                  
                  // Create simple fallback score progression from final scores
                  const aliceScoreNum = parseInt(aliceScore as string) || 0;
                  const bobScoreNum = parseInt(bobScore as string) || 0;
                  const matchDurationNum = parseInt(matchDuration as string) || 1;
                  
                  const finalTime = `${Math.floor(matchDurationNum/60)}:${(matchDurationNum%60).toString().padStart(2, '0')}`;
                  
                  const fallbackScoreProgression = {
                    userData: [
                      { x: "0:00", y: 0 },
                      { x: finalTime, y: aliceScoreNum }
                    ],
                    opponentData: [
                      { x: "0:00", y: 0 },
                      { x: finalTime, y: bobScoreNum }
                    ]
                  };
                  
                  console.log('📈 ERROR: Simple fallback score progression:', fallbackScoreProgression);
                  setScoreProgression(fallbackScoreProgression);
                }
              }
            } else {
              console.log('📊 No match periods found, using final scores as fallback');
              // Fallback to final scores if no period data
              const aliceScoreNum = parseInt(aliceScore as string) || 0;
              const bobScoreNum = parseInt(bobScore as string) || 0;
              
              const touchesByPeriodData = {
                period1: { user: aliceScoreNum, opponent: bobScoreNum },
                period2: { user: 0, opponent: 0 },
                period3: { user: 0, opponent: 0 }
              };
              
              setTouchesByPeriod(touchesByPeriodData);
            }
          } catch (error) {
            console.error('Error fetching period data:', error);
            // Fallback to final scores
            const aliceScoreNum = parseInt(aliceScore as string) || 0;
            const bobScoreNum = parseInt(bobScore as string) || 0;
            
            const touchesByPeriodData = {
              period1: { user: aliceScoreNum, opponent: bobScoreNum },
              period2: { user: 0, opponent: 0 },
              period3: { user: 0, opponent: 0 }
            };
            
            setTouchesByPeriod(touchesByPeriodData);
          }
        }

        // Calculate lead changes, time leading, bounce back times, and longest runs
        if (matchId) {
          try {
            const calculatedLeadChanges = await calculateLeadChanges(matchId as string);
            setLeadChanges(calculatedLeadChanges);
            
            const calculatedTimeLeading = await calculateTimeLeading(matchId as string);
            console.log('🔍 TIME LEADING DEBUG - Setting state with calculated values:', calculatedTimeLeading);
            setTimeLeading(calculatedTimeLeading);
            
            const calculatedBounceBackTimes = await calculateBounceBackTimes(matchId as string);
            setBounceBackTimes(calculatedBounceBackTimes);
            
            const calculatedLongestRuns = await calculateLongestRuns(matchId as string);
            setLongestRuns(calculatedLongestRuns);
          } catch (error) {
            console.error('Error calculating match statistics:', error);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading match data:', error);
        setLoading(false);
      }
    };

    loadMatchData();
  }, [matchId, params.isOffline]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to get initials from a name
  const getInitials = (name: string | undefined): string => {
    if (!name || name.trim() === '') {
      return '?';
    }
    
    const trimmedName = name.trim();
    const words = trimmedName.split(' ').filter(word => word.length > 0);
    
    if (words.length === 0) {
      return '?';
    } else if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    } else {
      return words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase();
    }
  };

  // Debug logging
  console.log('🔍 TIME LEADING DEBUG - Component render with timeLeading state:', timeLeading);
  console.log('🔍 TIME LEADING DEBUG - Fencer names from params:', { fencer1Name, fencer2Name });
  
  // Temporary test values to verify UI is working
  const testTimeLeading = {
    fencer1: 45,
    fencer2: 35,
    tied: 20
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
            <Text style={styles.loadingText}>Loading match summary...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const aliceScoreNum = parseInt(aliceScore as string) || 0;
  const bobScoreNum = parseInt(bobScore as string) || 0;
  const matchDurationNum = parseInt(matchDuration as string) || 0;
  const aliceCardsData = aliceCards ? JSON.parse(aliceCards as string) : { yellow: 0, red: 0 };
  const bobCardsData = bobCards ? JSON.parse(bobCards as string) : { yellow: 0, red: 0 };

  // Extract first names only
  const fencer1FirstName = (fencer1Name as string).split(' ')[0];
  const fencer2FirstName = (fencer2Name as string).split(' ')[0];

  // Calculate winner
  const winner = aliceScoreNum > bobScoreNum ? fencer1FirstName : bobScoreNum > aliceScoreNum ? fencer2FirstName : 'Tied';
  const scoreDiff = Math.abs(aliceScoreNum - bobScoreNum);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="light" />
        
        {/* Overlay to color the OS status bar area without affecting layout */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: '#212121', zIndex: 1 }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top * 0.3 }]}>
        {/* Title - Centered */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Neutral Match Summary</Text>
        </View>
      </View>

      {/* Offline Match Indicator */}
      {(params.isOffline === 'true' || (matchId as string)?.startsWith('offline_')) && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color="white" />
          <Text style={styles.offlineBannerText}>
            Saved offline - Will sync when you're online
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Match Result Card with Gradient Border */}
        <View style={styles.resultCardContainer}>
          {/* Win Badge */}
          <View style={styles.winBadge}>
            <Text style={styles.winText}>Results</Text>
          </View>
          
          {/* Card with Gradient Border */}
          <View style={styles.resultCardBorder}>
            <LinearGradient
              colors={['#D2A3F0', '#989DFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.resultCardGradientBorder}
            >
              <View style={styles.resultCard}>
                {/* Left Player */}
                <View style={styles.leftPlayerContainer}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerInitials}>{getInitials(fencer1Name as string)}</Text>
                  </View>
                  <Text 
                    style={styles.playerName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {fencer1FirstName}
                  </Text>
                </View>

                {/* Right Player */}
                <View style={styles.rightPlayerContainer}>
                  <View style={styles.playerAvatar}>
                    <Text style={styles.playerInitials}>{getInitials(fencer2Name as string)}</Text>
                  </View>
                  <Text 
                    style={styles.playerName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {fencer2FirstName}
                  </Text>
                </View>

                {/* Score Container */}
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreText}>{aliceScoreNum} - {bobScoreNum}</Text>
                  <Text style={styles.durationText}>Duration: {formatTime(matchDurationNum)}</Text>
                  <View style={styles.trophyPill}>
                    <Ionicons name="trophy-outline" size={16} color="#FFFFFF" />
                    <Text 
                      style={styles.trophyPillText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {aliceScoreNum > bobScoreNum 
                        ? `${fencer1FirstName} win by ${aliceScoreNum - bobScoreNum} point${aliceScoreNum - bobScoreNum !== 1 ? 's' : ''}`
                        : `${fencer2FirstName} win by ${bobScoreNum - aliceScoreNum} point${bobScoreNum - aliceScoreNum !== 1 ? 's' : ''}`
                      }
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Two Column Layout for Meta and Touches */}
        <View style={styles.twoColumnContainer}>
          {/* Minimal Meta Card */}
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Minimal Meta</Text>
            
            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="flash" size={20} color="white" />
              </View>
              <View style={styles.metaContent}>
                <Text style={styles.metaValue}>Foil</Text>
                <Text style={styles.metaLabel}>Weapon</Text>
              </View>
            </View>

            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="calendar" size={20} color="white" />
              </View>
              <View style={styles.metaContent}>
                <Text style={styles.metaValue}>{formatDate(new Date().toISOString())}</Text>
                <Text style={styles.metaLabel}>Date</Text>
              </View>
            </View>

            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="time" size={20} color="white" />
              </View>
              <View style={styles.metaContent}>
                <Text style={styles.metaValue}>{formatTime(matchDurationNum)}</Text>
                <Text style={styles.metaLabel}>Duration</Text>
              </View>
            </View>
          </View>

          {/* Touches by Period Chart Card */}
          <View style={styles.touchesChartCard}>
            <Text style={styles.chartTitle}>Touches by Period</Text>
            <TouchesByPeriodChart 
              title=""
              touchesByPeriod={touchesByPeriod}
              userLabel={fencer1Name as string}
              opponentLabel={fencer2Name as string}
            />
          </View>
        </View>

        {/* Score Progression Chart Card */}
        <View style={styles.scoreProgressionCard}>
          <Text style={styles.chartTitle}>Score Progression</Text>
          <ScoreProgressionChart 
            title=""
            scoreProgression={scoreProgression}
            userScore={aliceScoreNum}
            opponentScore={bobScoreNum}
            userLabel={fencer1Name as string}
            opponentLabel={fencer2Name as string}
            styleOverrides={{
              container: {
                marginHorizontal: 0, // Remove chart's own margin - wrapper handles it
              },
            }}
          />
        </View>

        {/* Two Column Layout for Lead Changes and Time Leading */}
        <View style={styles.twoColumnContainer}>
          {/* Lead Changes Card */}
          <LeadChangesCard leadChanges={leadChanges} />

          {/* Time Leading Card */}
          <TimeLeadingCard 
            fencer1Name={fencer1Name as string}
            fencer2Name={fencer2Name as string}
            timeLeading={timeLeading}
          />
        </View>

        {/* Two Column Layout for Bounce Back and Longest Run */}
        <View style={styles.twoColumnContainer}>
          {/* Bounce Back Time Card */}
          <BounceBackTimeCard 
            fencer1Name={fencer1Name as string}
            fencer2Name={fencer2Name as string}
            bounceBackTimes={bounceBackTimes}
          />

          {/* Longest Run Card */}
          <LongestRunCard 
            fencer1Name={fencer1Name as string}
            fencer2Name={fencer2Name as string}
            longestRuns={longestRuns}
          />
        </View>

        {/* Cards Section - Hidden */}
        {/* <View style={styles.cardsSection}>
          <Text style={styles.cardsTitle}>Cards</Text>
          <View style={styles.cardsContent}>
            <View style={styles.cardItem}>
              <View style={styles.cardAvatar}>
                <Text style={styles.cardInitials}>{getInitials(fencer1Name as string)}</Text>
              </View>
              <Text 
                style={styles.cardName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {fencer1FirstName}
              </Text>
            </View>
            
            <View style={styles.cardsScore}>
              <View style={styles.cardIndicator}>
                <View style={[styles.cardSquare, { backgroundColor: '#FDCB6E' }]} />
                <Text style={styles.cardsScoreText}>{aliceCardsData.yellow + aliceCardsData.red} - {bobCardsData.yellow + bobCardsData.red}</Text>
                <View style={[styles.cardSquare, { backgroundColor: '#FC5655' }]} />
              </View>
            </View>
            
            <View style={styles.cardItem}>
              <Text 
                style={styles.cardName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {fencer2FirstName}
              </Text>
              <View style={styles.cardAvatar}>
                <Text style={styles.cardInitials}>{getInitials(fencer2Name as string)}</Text>
              </View>
            </View>
          </View>
        </View> */}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.startNewMatchButton}
            onPress={() => router.push('/(tabs)/remote')}
          >
            <Ionicons name="add-circle-outline" size={24} color="white" />
            <Text style={styles.startNewMatchButtonText}>Start New Match</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backToHomeButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Ionicons name="home-outline" size={24} color="white" />
            <Text style={styles.backToHomeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#212121',
    zIndex: 2,
  },
  headerTitle: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.05,
    fontWeight: '700',
    color: 'white',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ECDC4',
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.04,
    gap: width * 0.025,
    marginHorizontal: width * 0.04,
    marginTop: height * 0.01,
    marginBottom: height * 0.015,
    borderRadius: width * 0.02,
  },
  offlineBannerText: {
    color: 'white',
    fontSize: width * 0.035,
    fontWeight: '600',
  },
  resultCardContainer: {
    marginHorizontal: 0,
    marginTop: 20,
    marginBottom: 20,
    position: 'relative',
  },
  winBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: '#4D4159',
    borderWidth: 2,
    borderColor: '#D1A3F0',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: height * 0.007,
    minWidth: width * 0.16,
  },
  winIcon: {
    color: 'white',
    fontSize: width * 0.035,
    fontWeight: '600',
    marginRight: width * 0.0175,
    lineHeight: width * 0.055,
    marginTop: -width * 0.005,
  },
  winText: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.04,
    fontWeight: '600',
    lineHeight: width * 0.055,
    color: '#FFFFFF',
    marginTop: -width * 0.005,
  },
  resultCardBorder: {
    width: '92%',
    height: 160,
    borderRadius: 24,
    padding: 5,
    alignSelf: 'center',
  },
  resultCardGradientBorder: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  resultCard: {
    flex: 1,
    margin: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(77, 65, 89, 1)',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
    position: 'relative',
  },
  leftPlayerContainer: {
    position: 'absolute',
    width: 60,
    height: 89,
    left: 20,
    top: 32,
    alignItems: 'center',
  },
  rightPlayerContainer: {
    position: 'absolute',
    width: 60,
    height: 89,
    right: 20,
    top: 32,
    alignItems: 'center',
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#393939',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  playerName: {
    position: 'absolute',
    width: 60,
    height: 22,
    left: 0,
    top: 68,
    fontSize: width * 0.04,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  scoreContainer: {
    position: 'absolute',
    width: '80%', // Responsive width
    height: height * 0.12, // Responsive height
    left: '50%',
    marginLeft: '-40%', // Half of 80% to center
    top: height * 0.04, // Responsive top position
    alignItems: 'center',
  },
  scoreText: {
    position: 'absolute',
    width: '90%', // Responsive width within container
    height: height * 0.05, // Responsive height
    left: '5%', // Center within the 90% width
    top: 0,
    fontSize: width * 0.075,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  durationText: {
    position: 'absolute',
    width: '80%', // Match the score container width
    height: height * 0.025, // Responsive height
    left: '10%', // Center within the 80% width
    top: height * 0.042, // Moved up further - Responsive top position
    fontSize: width * 0.035,
    fontWeight: '500',
    color: '#9D9D9D',
    textAlign: 'center',
  },
  trophyPill: {
    backgroundColor: '#625971',
    borderRadius: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: width * 0.01,
    paddingVertical: height * 0.0,
    gap: 0,
    alignSelf: 'center',
    marginTop: height * 0.066, // Moved up further - Responsive
    minHeight: height * 0.035,
    minWidth: width * 0.35,
    marginHorizontal: 0,
  },
  trophyPillText: {
    fontSize: width * 0.028,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'System',
    flex: 1,
    flexWrap: 'wrap',
    textAlignVertical: 'center',
  },
  twoColumnContainer: {
    flexDirection: 'row',
    paddingHorizontal: width * 0.04,
    marginBottom: 20,
    gap: 8,
  },
  metaCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  metaTitle: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.04,
    fontWeight: '500',
    color: 'white',
    marginBottom: width * 0.07,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  metaIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: -12,
  },
  metaContent: {
    flex: 1,
  },
  metaValue: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.04,
    fontWeight: '500',
    color: 'white',
    marginBottom: width * 0.01,
  },
  metaLabel: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.03,
    fontWeight: '400',
    color: 'white',
  },
  touchesChartCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  scoreProgressionCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: width * 0.04, // Match other cards' width (4% margin on each side = 92% width)
    marginBottom: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  chartTitle: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.045,
    fontWeight: '500',
    color: 'white',
    marginBottom: width * 0.04,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  statTitle: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.04,
    fontWeight: '500',
    color: 'white',
    marginBottom: width * 0.04,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.04,
    fontWeight: '500',
    color: 'white',
  },
  statLabel: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.03,
    fontWeight: '400',
    color: 'white',
  },
  bounceBackCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  longestRunCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  bounceBackContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bounceBackItem: {
    alignItems: 'center',
  },
  bounceBackCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bounceBackValue: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.045,
    fontWeight: '700',
    color: 'white',
  },
  bounceBackLabel: {
    fontFamily: 'Articulat CF',
    fontSize: width * 0.03,
    fontWeight: '400',
    color: 'white',
  },
  cardsSection: {
    backgroundColor: '#2A2A2A',
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  cardsTitle: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginBottom: 16,
  },
  cardsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardItem: {
    alignItems: 'center',
  },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#393939',
    borderWidth: 1,
    borderColor: 'white',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  cardName: {
    fontFamily: 'Articulat CF',
    fontSize: 12,
    fontWeight: '400',
    color: 'white',
  },
  cardsScore: {
    alignItems: 'center',
  },
  cardIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#393939',
    borderRadius: 86,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  cardSquare: {
    width: 14,
    height: 18,
    borderRadius: 3,
  },
  cardsScoreText: {
    fontFamily: 'Articulat CF',
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  actionButtonsContainer: {
    flexDirection: 'column', // Changed from 'row' to 'column'
    gap: height * 0.02, // Changed to height-based gap for vertical spacing
    paddingHorizontal: width * 0.04,
    paddingVertical: height * 0.03,
    paddingBottom: height * 0.05,
  },
  startNewMatchButton: {
    width: '100%', // Changed from flex: 1 to full width
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: height * 0.018,
    borderRadius: width * 0.03,
    gap: width * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startNewMatchButtonText: {
    color: 'white',
    fontSize: width * 0.04,
    fontWeight: '600',
  },
  backToHomeButton: {
    width: '100%', // Changed from flex: 1 to full width
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: height * 0.018,
    borderRadius: width * 0.03,
    gap: width * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backToHomeButtonText: {
    color: 'white',
    fontSize: width * 0.04,
    fontWeight: '600',
  },
});
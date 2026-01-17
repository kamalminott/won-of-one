import { GoalCelebrationModal } from '@/components/GoalCelebrationModal';
import { MatchSummaryCard } from '@/components/MatchSummaryCard';
import { MatchSummaryStats } from '@/components/MatchSummaryStats';
import { SetNewGoalPrompt } from '@/components/SetNewGoalPrompt';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { goalService, matchService } from '@/lib/database';
import { postgrestSelect } from '@/lib/postgrest';
import { userProfileImageStorageKey, userProfileImageUrlStorageKey } from '@/lib/storageKeys';
import { Match } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MatchSummaryScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user, userName, session } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [bestRun, setBestRun] = useState<number>(0);
  const [highestMomentum, setHighestMomentum] = useState<number>(0);
  const [doubleTouchCount, setDoubleTouchCount] = useState<number>(0);
  const [scoreProgression, setScoreProgression] = useState<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }>({ userData: [], opponentData: [] });
  const [userCardCounts, setUserCardCounts] = useState<{ yellow: number; red: number }>({ yellow: 0, red: 0 });
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
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completedGoal, setCompletedGoal] = useState<any>(null);
  const [completedGoalId, setCompletedGoalId] = useState<string | null>(null);
  const [showNewGoalPrompt, setShowNewGoalPrompt] = useState(false);
  const [matchType, setMatchType] = useState<'training' | 'competition'>('training');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [promptFencer1Name, setPromptFencer1Name] = useState('');
  const [promptFencer2Name, setPromptFencer2Name] = useState('');
  const [promptTargets, setPromptTargets] = useState({ fencer1: false, fencer2: false });
  const [showOpponentNameModal, setShowOpponentNameModal] = useState(false);
  const [opponentNameInput, setOpponentNameInput] = useState('');
  const [opponentNameTarget, setOpponentNameTarget] = useState<'fencer1' | 'fencer2'>('fencer2');

  // Track screen view
  useFocusEffect(
    useCallback(() => {
      analytics.screen('MatchSummary');
      if (params.matchId) {
        analytics.matchSummaryViewed({ match_id: params.matchId as string });
      }
    }, [params.matchId])
  );

  // Load user profile data
  useEffect(() => {
    loadUserProfileData();
  }, []);


  const loadUserProfileData = async () => {
    await loadUserProfileImage();
  };


  const loadUserProfileImage = async () => {
    try {
      const savedImage =
        (await AsyncStorage.getItem(userProfileImageStorageKey(user?.id))) ||
        (await AsyncStorage.getItem(userProfileImageUrlStorageKey(user?.id)));
      if (savedImage) {
        setUserProfileImage(savedImage);
      }
    } catch (error) {
      console.error('Error loading user profile image:', error);
    }
  };


  // Fetch match data from database or use params for offline matches
  useEffect(() => {
    const fetchMatchData = async () => {
      if (params.matchId) {
        // Check if this is an offline match
        const isOffline = params.isOffline === 'true' || (params.matchId as string).startsWith('offline_');
        
        if (isOffline) {
          // Use params data directly for offline matches
          const matchFromParams: Match = {
            match_id: params.matchId as string,
            user_id: user?.id || '',
            fencer_1_name: params.fencer1Name as string || 'Fencer 1',
            fencer_2_name: params.fencer2Name as string || 'Fencer 2',
            final_score: parseInt(params.finalScore as string || params.aliceScore as string || '0'),
            touches_against: parseInt(params.touchesAgainst as string || params.bobScore as string || '0'),
            result: params.result !== null && params.result !== undefined ? (params.result as string) : undefined,
            score_diff: params.scoreDiff ? parseInt(params.scoreDiff as string) : undefined,
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
            event_date: new Date().toISOString(),
          };
          
          setMatch(matchFromParams);

          const leftCards = JSON.parse(params.aliceCards as string || '{"yellow":0,"red":0}');
          const rightCards = JSON.parse(params.bobCards as string || '{"yellow":0,"red":0}');
          const normalizedUser = normalizeName(userName);
          const isFencer1User = normalizedUser && normalizeName(matchFromParams.fencer_1_name) === normalizedUser;
          const isFencer2User = normalizedUser && normalizeName(matchFromParams.fencer_2_name) === normalizedUser;
          const userCards = isFencer1User ? leftCards : isFencer2User ? rightCards : leftCards;
          setUserCardCounts({
            yellow: userCards.yellow || 0,
            red: userCards.red || 0,
          });
          
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
          setBestRun(0);
          setHighestMomentum(0);
          setDoubleTouchCount(0);
          setScoreProgression({ userData: [], opponentData: [] });
          
          setLoading(false);
          return;
        }
        
        // Online match - fetch from database
        try {
          const matchData = await matchService.getMatchById(
            params.matchId as string,
            session?.access_token
          );
          if (!matchData) {
            console.warn('⚠️ Match not found, showing missing match state', params.matchId);
            setMatch(null);
            setLoading(false);
            return;
          }
          setMatch(matchData);
          
          // Load existing notes if available
          if (matchData?.notes) {
            setNotes(matchData.notes);
          }
          
          // Load match type from database
          if (matchData?.match_type) {
            const type = matchData.match_type.toLowerCase() === 'training' ? 'training' : 'competition';
            setMatchType(type);
          }
          
          // Calculate best run and score progression if we have match data and user info
          if (matchData && matchData.fencer_1_name) {
            // Determine which fencer is the user (for calculations)
            const normalizedUserName = userName ? userName.trim().toLowerCase() : '';
            const isFencer1User = normalizedUserName && matchData.fencer_1_name
              ? matchData.fencer_1_name.trim().toLowerCase() === normalizedUserName
              : false;
            const isFencer2User = normalizedUserName && matchData.fencer_2_name
              ? matchData.fencer_2_name.trim().toLowerCase() === normalizedUserName
              : false;
            
            // Use the actual user's name for calculations (could be fencer_1 or fencer_2)
            const userFencerName = isFencer1User 
              ? (matchData.fencer_1_name || 'You')
              : isFencer2User 
              ? (matchData.fencer_2_name || 'You')
              : (matchData.fencer_1_name || 'You'); // Fallback to fencer_1 if no user match

            const userCards = await fetchUserCardCounts(params.matchId as string);
            setUserCardCounts(userCards);
            
            const calculatedBestRun = await matchService.calculateBestRun(
              params.matchId as string,
              userFencerName,
              params.remoteId as string, // Pass the remoteId to help find events
              session?.access_token
            );
            setBestRun(calculatedBestRun);
            const sabreWeaponType = matchData.weapon_type || (params.weaponType as string | undefined);
            const sabreMomentum = isSabreWeapon(sabreWeaponType)
              ? (calculatedBestRun >= 2 ? calculatedBestRun : 0)
              : 0;
            setHighestMomentum(sabreMomentum);
            if (isEpeeWeapon(matchData.weapon_type)) {
              const calculatedDoubleTouches = await matchService.calculateDoubleTouchCount(
                params.matchId as string,
                session?.access_token
              );
              setDoubleTouchCount(calculatedDoubleTouches);
            } else {
              setDoubleTouchCount(0);
            }

            // Use calculateAnonymousScoreProgression to get position-based data directly from database
            // Same approach as header: use fencer_1_name (left) and fencer_2_name (right) from database
            // This returns fencer1Data/fencer2Data which matches the header's fencer_1_name/fencer_2_name
            const calculatedScoreProgression = await matchService.calculateAnonymousScoreProgression(
              params.matchId as string,
              session?.access_token
            );
        // Map progression to user/opponent based on which fencer is the user
        // Map progression to user/opponent based on which fencer is the user
        const scoreProgData = isFencer1User ? {
          userData: calculatedScoreProgression.fencer1Data, // user on left
          opponentData: calculatedScoreProgression.fencer2Data
            } : {
              userData: calculatedScoreProgression.fencer2Data, // user on right
              opponentData: calculatedScoreProgression.fencer1Data
            };
            console.log('📈 [MATCH SUMMARY] Setting scoreProgression:', {
              userDataLength: scoreProgData.userData.length,
              opponentDataLength: scoreProgData.opponentData.length,
              userDataFirst: scoreProgData.userData[0],
              opponentDataFirst: scoreProgData.opponentData[0],
            });
            setScoreProgression(scoreProgData);
            // Precompute progression totals to validate other derived data
            const progressionFencer1Total = scoreProgData.userData.length > 0 ? scoreProgData.userData[scoreProgData.userData.length - 1].y : 0;
            const progressionFencer2Total = scoreProgData.opponentData.length > 0 ? scoreProgData.opponentData[scoreProgData.opponentData.length - 1].y : 0;

            const clampTouches = (data: { period1: { user: number; opponent: number }; period2: { user: number; opponent: number }; period3: { user: number; opponent: number }; }) => ({
              period1: { user: Math.max(0, data.period1.user), opponent: Math.max(0, data.period1.opponent) },
              period2: { user: Math.max(0, data.period2.user), opponent: Math.max(0, data.period2.opponent) },
              period3: { user: Math.max(0, data.period3.user), opponent: Math.max(0, data.period3.opponent) },
            });

            // Use position-based touchesByPeriod from match_period table (same approach as header and neutral match summary)
            // Same approach as header: use fencer_1_name (left) and fencer_2_name (right) from database
            const { data: matchPeriods, error: periodsError } = await postgrestSelect<{
              period_number: number | null;
              fencer_1_score: number | null;
              fencer_2_score: number | null;
            }>(
              'match_period',
              {
                select: 'period_number,fencer_1_score,fencer_2_score',
                match_id: `eq.${params.matchId as string}`,
                order: 'period_number.asc',
              },
              session?.access_token ? { accessToken: session?.access_token } : { allowAnon: true }
            );

            if (periodsError) {
              console.error('Error fetching match periods:', periodsError);
              // Fallback to entity-based calculation
              const calculatedTouchesByPeriod = await matchService.calculateTouchesByPeriod(
                params.matchId as string,
                userFencerName,
                params.remoteId as string,
                undefined,
                undefined,
                session?.access_token
              );
              setTouchesByPeriod(calculatedTouchesByPeriod);
            } else if (matchPeriods && matchPeriods.length > 0) {
              // Initialize with zeros - chart expects 'user' and 'opponent', but these represent fencer1 and fencer2
              const touchesByPeriodData = {
                period1: { user: 0, opponent: 0 }, // user = fencer1 (left), opponent = fencer2 (right)
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
                
                // Map fencer1/fencer2 to user/opponent for chart component (matches header: fencer_1 = left, fencer_2 = right)
                if (periodNum === 1) {
                  touchesByPeriodData.period1.user = fencer1TouchesThisPeriod; // fencer1 -> user (left)
                  touchesByPeriodData.period1.opponent = fencer2TouchesThisPeriod; // fencer2 -> opponent (right)
                } else if (periodNum === 2) {
                  touchesByPeriodData.period2.user = fencer1TouchesThisPeriod; // fencer1 -> user (left)
                  touchesByPeriodData.period2.opponent = fencer2TouchesThisPeriod; // fencer2 -> opponent (right)
                } else if (periodNum === 3) {
                  touchesByPeriodData.period3.user = fencer1TouchesThisPeriod; // fencer1 -> user (left)
                  touchesByPeriodData.period3.opponent = fencer2TouchesThisPeriod; // fencer2 -> opponent (right)
                }
              });
              
              console.log('📊 [MATCH SUMMARY] Using position-based period scores from database:', {
                touchesByPeriodData,
                period1User: touchesByPeriodData.period1.user,
                period1Opponent: touchesByPeriodData.period1.opponent,
                period2User: touchesByPeriodData.period2.user,
                period2Opponent: touchesByPeriodData.period2.opponent,
                period3User: touchesByPeriodData.period3.user,
                period3Opponent: touchesByPeriodData.period3.opponent,
              });
              // Remap to user/opponent based on which fencer is the user
              const mappedTouchesByPeriodRaw = isFencer1User ? touchesByPeriodData : {
                period1: { user: touchesByPeriodData.period1.opponent, opponent: touchesByPeriodData.period1.user },
                period2: { user: touchesByPeriodData.period2.opponent, opponent: touchesByPeriodData.period2.user },
                period3: { user: touchesByPeriodData.period3.opponent, opponent: touchesByPeriodData.period3.user },
              };
              const mappedTouchesByPeriod = clampTouches(mappedTouchesByPeriodRaw);

              // If period totals don't match progression totals, fall back to event-derived calculation
              const periodUserTotal = mappedTouchesByPeriod.period1.user + mappedTouchesByPeriod.period2.user + mappedTouchesByPeriod.period3.user;
              const periodOpponentTotal = mappedTouchesByPeriod.period1.opponent + mappedTouchesByPeriod.period2.opponent + mappedTouchesByPeriod.period3.opponent;
              const totalsMatch = periodUserTotal === progressionFencer1Total && periodOpponentTotal === progressionFencer2Total;
              if (!totalsMatch) {
                console.warn('⚠️ [MATCH SUMMARY] Period totals mismatch progression totals, recalculating from events', {
                  periodUserTotal,
                  periodOpponentTotal,
                  progressionFencer1Total,
                  progressionFencer2Total
                });
                const recalculatedRaw = await matchService.calculateTouchesByPeriod(
                  params.matchId as string,
                  userFencerName,
                  params.remoteId as string,
                  progressionFencer1Total,
                  progressionFencer2Total,
                  session?.access_token
                );
                const recalculatedMappedRaw = isFencer1User ? recalculatedRaw : {
                  period1: { user: recalculatedRaw.period1.opponent, opponent: recalculatedRaw.period1.user },
                  period2: { user: recalculatedRaw.period2.opponent, opponent: recalculatedRaw.period2.user },
                  period3: { user: recalculatedRaw.period3.opponent, opponent: recalculatedRaw.period3.user },
                };
                const recalculated = clampTouches(recalculatedMappedRaw);
                setTouchesByPeriod(recalculated);
              } else {
                setTouchesByPeriod(mappedTouchesByPeriod);
              }
            } else {
              // No period data - fallback to entity-based calculation
              const calculatedTouchesByPeriod = await matchService.calculateTouchesByPeriod(
                params.matchId as string,
                userFencerName,
                params.remoteId as string,
                undefined,
                undefined,
                session?.access_token
              );
              setTouchesByPeriod(calculatedTouchesByPeriod);
            }
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
  }, [params.matchId, params.isOffline]);

  // Initialize match type from match data
  useEffect(() => {
    if (match?.match_type) {
      setMatchType(match.match_type as 'training' | 'competition');
    }
  }, [match?.match_type]);

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
  };

  const handleSeeFullSummary = () => {
    // TODO: Navigate to full summary
  };

  const handleCancelMatch = async () => {
    if (!match?.match_id) {
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Cancel Match',
      'Are you sure you want to cancel this match? This will permanently delete the match from your history.',
      [
        {
          text: 'Keep Match',
          style: 'cancel',
        },
        {
          text: 'Delete Match',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the match from the database
              const success = await matchService.deleteMatch(
                match.match_id,
                undefined,
                session?.access_token
              );
              
              if (success) {
                // Navigate back to home screen
                router.replace('/(tabs)');
              } else {
                console.error('❌ Failed to delete match');
                Alert.alert('Error', 'Failed to cancel match. Please try again.');
              }
            } catch (error) {
              console.error('Error canceling match:', error);
              Alert.alert('Error', 'An error occurred while canceling the match.');
            }
          },
        },
      ]
    );
  };

  const normalizePlaceholderName = (value?: string | null) => {
    if (!value) return '';
    return value.trim().toLowerCase();
  };

  const placeholderNameValues = new Set([
    '',
    'tap to add name',
    'guest',
    'guest 1',
    'guest 2',
    'unknown',
    'fencer 1',
    'fencer 2',
  ]);

  const isPlaceholderName = (value?: string | null) => {
    return placeholderNameValues.has(normalizePlaceholderName(value));
  };

  const saveMatchWithNames = async (overrideNames?: { fencer1?: string; fencer2?: string }) => {
    if (!match || !user?.id) {
      return;
    }

    try {
      // Update match type in the database
      if (match.match_id) {
        const trimmedFencer1Name = (overrideNames?.fencer1 ?? match.fencer_1_name ?? '').trim();
        const trimmedFencer2Name = (overrideNames?.fencer2 ?? match.fencer_2_name ?? '').trim();
        if (isPlaceholderName(trimmedFencer1Name) || isPlaceholderName(trimmedFencer2Name)) {
          Alert.alert('Names required', 'Please enter both fencer names before saving.');
          return;
        }
        await matchService.updateMatch(
          match.match_id,
          {
            match_type: matchType,
            fencer_1_name: trimmedFencer1Name,
            fencer_2_name: trimmedFencer2Name,
          },
          session?.access_token
        );
        await matchService.updateMatchEventNamesIfPlaceholder(
          match.match_id,
          trimmedFencer1Name,
          trimmedFencer2Name,
          session?.access_token
        );
        setMatch(prev => prev ? {
          ...prev,
          fencer_1_name: trimmedFencer1Name,
          fencer_2_name: trimmedFencer2Name,
        } : prev);
      }
      
      // Check if completed goal info was passed from remote.tsx (for remote matches)
      const hasCompletedGoalFromRemote = params.completedGoalData;
      if (hasCompletedGoalFromRemote) {
        try {
          const goalData = JSON.parse(params.completedGoalData as string);
          setCompletedGoal(goalData);
          // Get the goal ID from the active goals
          const activeGoals = await goalService.getActiveGoals(user.id, session?.access_token);
          const matchingGoal = activeGoals.find(g => g.title === goalData.title);
          if (matchingGoal) {
            setCompletedGoalId(matchingGoal.id);
          }
          setShowCelebration(true);
          analytics.goalCompleted({ goal_type: goalData.title || 'unknown' });
          analytics.capture('achievement_unlocked', {
            achievement_type: 'goal',
            goal_title: goalData.title || 'unknown',
            goal_id: matchingGoal?.id,
            target_value: goalData.targetValue,
            current_value: goalData.currentValue,
          });
          // Don't navigate yet - wait for user to close celebration
          return;
        } catch (error) {
          console.error('Error parsing completed goal data:', error);
        }
      }
      
      // Check if failed goal info was passed from remote.tsx (for remote matches)
      const hasFailedGoalFromRemote = params.failedGoalTitle && params.failedGoalReason;
      
      // Update goals based on match result (only if user participated AND match is not already complete)
      // Remote matches are already complete and goals already updated
      if (match.user_id && match.result && !match.is_complete) {
        const result = await goalService.updateGoalsAfterMatch(
          user.id, 
          match.result as 'win' | 'loss', 
          match.final_score || 0,
          match.touches_against || 0,
          session?.access_token
        );
        
        // Check if any goals were completed
        if (result.completedGoals && result.completedGoals.length > 0) {
          // Show celebration for the first completed goal
          const goalData = result.completedGoals[0];
          setCompletedGoal(goalData);
          // Store the goal ID from the activeGoals list
          const activeGoals = await goalService.getActiveGoals(user.id, session?.access_token);
          const matchingGoal = activeGoals.find(g => g.title === goalData.title);
          if (matchingGoal) {
            setCompletedGoalId(matchingGoal.id);
          }
          setShowCelebration(true);
          analytics.goalCompleted({ goal_type: goalData.title || 'unknown' });
          analytics.capture('achievement_unlocked', {
            achievement_type: 'goal',
            goal_title: goalData.title || 'unknown',
            goal_id: matchingGoal?.id,
            target_value: goalData.targetValue,
            current_value: goalData.currentValue,
          });
          // Don't navigate yet - wait for user to close celebration
          return;
        }
        
        // Check if any goals failed - pass to home screen
        if (result.failedGoals && result.failedGoals.length > 0) {
          const failedGoal = result.failedGoals[0]; // Show first failed goal
          router.push({
            pathname: '/(tabs)',
            params: {
              showFailedGoalAlert: 'true',
              failedGoalTitle: failedGoal.title,
              failedGoalReason: failedGoal.reason,
            }
          });
          return; // Don't navigate normally
        }
      } else if (hasFailedGoalFromRemote) {
        // Remote match with failed goal - pass through to home screen
        router.push({
          pathname: '/(tabs)',
          params: {
            showFailedGoalAlert: 'true',
            failedGoalTitle: params.failedGoalTitle as string,
            failedGoalReason: params.failedGoalReason as string,
          }
        });
        return; // Don't navigate normally
      } else {
      }
      
      // Navigate back to home page
      router.push('/(tabs)');
      
    } catch (error) {
      console.error('Error saving match:', error);
    }
  };

  const handleSaveMatch = async () => {
    if (!match || !user?.id) {
      return;
    }

    const needsFencer1 = isPlaceholderName(match.fencer_1_name);
    const needsFencer2 = isPlaceholderName(match.fencer_2_name);
    if (needsFencer1 || needsFencer2) {
      setPromptTargets({ fencer1: needsFencer1, fencer2: needsFencer2 });
      setPromptFencer1Name(needsFencer1 ? '' : match.fencer_1_name || '');
      setPromptFencer2Name(needsFencer2 ? '' : match.fencer_2_name || '');
      setShowNamePrompt(true);
      return;
    }

    await saveMatchWithNames();
  };

  const handleSaveMatchWithNames = async () => {
    if (!match) {
      return;
    }

    const trimmedFencer1 = promptFencer1Name.trim();
    const trimmedFencer2 = promptFencer2Name.trim();

    if (promptTargets.fencer1 && isPlaceholderName(trimmedFencer1)) {
      Alert.alert('Name required', 'Please enter the missing name before saving.');
      return;
    }
    if (promptTargets.fencer2 && isPlaceholderName(trimmedFencer2)) {
      Alert.alert('Name required', 'Please enter the missing name before saving.');
      return;
    }

    setShowNamePrompt(false);
    await saveMatchWithNames({
      fencer1: promptTargets.fencer1 ? trimmedFencer1 : match.fencer_1_name || '',
      fencer2: promptTargets.fencer2 ? trimmedFencer2 : match.fencer_2_name || '',
    });
  };

  const openOpponentNameModal = () => {
    if (!match) {
      return;
    }
    const target = isFencer1User ? 'fencer2' : isFencer2User ? 'fencer1' : 'fencer2';
    const currentName = target === 'fencer1' ? match.fencer_1_name : match.fencer_2_name;
    setOpponentNameTarget(target);
    setOpponentNameInput(currentName || '');
    setShowOpponentNameModal(true);
  };

  const handleSaveOpponentName = async () => {
    if (!match) {
      return;
    }
    const trimmed = opponentNameInput.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter the opponent name.');
      return;
    }

    const nextFencer1Name = opponentNameTarget === 'fencer1' ? trimmed : (match.fencer_1_name || '');
    const nextFencer2Name = opponentNameTarget === 'fencer2' ? trimmed : (match.fencer_2_name || '');
    const isOfflineMatch = params.isOffline === 'true' || (params.matchId as string)?.startsWith('offline_');

    try {
      if (!isOfflineMatch && match.match_id && session?.access_token) {
        await matchService.updateMatch(
          match.match_id,
          {
            fencer_1_name: nextFencer1Name,
            fencer_2_name: nextFencer2Name,
          },
          session?.access_token
        );
        await matchService.updateMatchEventNamesIfPlaceholder(
          match.match_id,
          nextFencer1Name,
          nextFencer2Name,
          session?.access_token
        );
      }

      setMatch(prev => prev ? {
        ...prev,
        fencer_1_name: nextFencer1Name,
        fencer_2_name: nextFencer2Name,
      } : prev);
      setShowOpponentNameModal(false);
    } catch (error) {
      console.error('Error updating opponent name:', error);
      Alert.alert('Error', 'Failed to update opponent name. Please try again.');
    }
  };

  const handleNotesPress = () => {
    setShowNotesModal(true);
  };

  const handleCelebrationClose = () => {
    setShowCelebration(false);
    // Show the "Set New Goal?" prompt
    setShowNewGoalPrompt(true);
  };

  const handleSetNewGoal = async () => {
    setShowNewGoalPrompt(false);
    
    // Deactivate the completed goal
    if (completedGoalId) {
      await goalService.deactivateGoal(completedGoalId, session?.access_token);
    }
    
    setCompletedGoal(null);
    setCompletedGoalId(null);
    
    // Navigate to home with auto-open flag to trigger goal modal
    router.push({
      pathname: '/(tabs)',
      params: {
        autoOpenGoalModal: 'true',
      }
    });
  };

  const handleLater = async () => {
    setShowNewGoalPrompt(false);
    
    // Deactivate the completed goal
    if (completedGoalId) {
      await goalService.deactivateGoal(completedGoalId, session?.access_token);
    }
    
    setCompletedGoal(null);
    setCompletedGoalId(null);
    
    // Navigate to home WITHOUT auto-open flag (user chose "Later")
    router.push('/(tabs)');
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
  };

  const handleSaveNotes = async () => {
    if (match?.match_id) {
      try {
        await matchService.updateMatch(
          match.match_id,
          { notes: notes },
          session?.access_token
        );
      } catch (error) {
        console.error('❌ Error saving notes:', error);
      }
    }
    setShowNotesModal(false);
  };

  const handleCancelNotes = () => {
    setShowNotesModal(false);
  };

  // Helper function to get first name from full name
  const getFirstName = (fullName: string | undefined | null): string => {
    if (!fullName || !fullName.trim()) return '';
    return fullName.trim().split(' ')[0];
  };

  const isSabreWeapon = (weapon?: string | null) => {
    const normalized = (weapon || '').toLowerCase();
    return normalized === 'sabre' || normalized === 'saber';
  };
  const isEpeeWeapon = (weapon?: string | null) => {
    const normalized = (weapon || '').toLowerCase();
    return normalized === 'epee';
  };

  // Prepare match data for MatchSummaryStats
  const normalizeName = (value?: string | null) => {
    if (!value) return '';
    return value.trim().toLowerCase();
  };

  const getResetSegmentValue = (value?: number | null) => {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };

  const filterByLatestResetSegment = (events: any[]) => {
    if (!events || events.length === 0) return [];
    const latestSegment = events.reduce(
      (max, ev) => Math.max(max, getResetSegmentValue(ev.reset_segment)),
      0
    );
    return events.filter(ev => getResetSegmentValue(ev.reset_segment) === latestSegment);
  };

  const buildUserCardCounts = (events: any[]) => {
    const normalizedUser = normalizeName(userName);
    const cancelledEventIds = new Set<string>();
    const seen = new Set<string>();
    let yellow = 0;
    let red = 0;

    const applyYellow = () => {
      if (red === 0) {
        if (yellow === 0) {
          yellow = 1;
        } else {
          yellow = 0;
          red += 1;
        }
      } else {
        yellow = 0;
        red += 1;
      }
    };

    for (const event of events) {
      const eventType = (event.event_type || '').toLowerCase();
      if (eventType === 'cancel' && event.cancelled_event_id) {
        cancelledEventIds.add(event.cancelled_event_id);
      }
    }

    for (const event of events) {
      const eventType = (event.event_type || '').toLowerCase();
      if (eventType === 'cancel') {
        continue;
      }
      if (event.match_event_id && cancelledEventIds.has(event.match_event_id)) {
        continue;
      }
      if (!event.card_given) {
        continue;
      }

      const isUserEvent = (user?.id && event.scoring_user_id === user.id)
        || (normalizedUser && normalizeName(event.scoring_user_name) === normalizedUser);
      if (!isUserEvent) {
        continue;
      }

      const timeKey = event.event_time || event.timestamp || '';
      const compositeKey = `${event.scoring_user_id || event.scoring_user_name || 'unknown'}|${event.card_given}|${timeKey}|${event.match_time_elapsed ?? 'noElapsed'}`;
      if (seen.has(compositeKey)) {
        continue;
      }
      seen.add(compositeKey);

      if (event.card_given === 'yellow') {
        applyYellow();
      } else if (event.card_given === 'red') {
        red += 1;
      }
    }

    return { yellow, red };
  };

  const fetchUserCardCounts = async (matchId: string) => {
    if (!matchId) {
      return { yellow: 0, red: 0 };
    }

    try {
      const { data: events, error } = await postgrestSelect<{
        match_event_id: string;
        event_type: string | null;
        card_given: string | null;
        scoring_user_id: string | null;
        scoring_user_name: string | null;
        event_time: string | null;
        timestamp: string | null;
        match_time_elapsed: number | null;
        cancelled_event_id: string | null;
        reset_segment: number | null;
      }>(
        'match_event',
        {
          select: 'match_event_id,event_type,card_given,scoring_user_id,scoring_user_name,event_time,timestamp,match_time_elapsed,cancelled_event_id,reset_segment',
          match_id: `eq.${matchId}`,
          order: 'event_time.asc,timestamp.asc',
        },
        session?.access_token ? { accessToken: session?.access_token } : { allowAnon: true }
      );

      if (error) {
        console.error('Error fetching match events for user card counts:', error);
        return { yellow: 0, red: 0 };
      }

      const filteredEvents = filterByLatestResetSegment(events || []);
      return buildUserCardCounts(filteredEvents);
    } catch (error) {
      console.error('Error calculating user card counts:', error);
      return { yellow: 0, red: 0 };
    }
  };

  // Parse "MM:SS" or "(M:SS)" into total seconds
  const parseTimeLabelToSeconds = (label?: string | null) => {
    if (!label) return 0;
    const cleaned = label.replace(/[()]/g, '');
    const parts = cleaned.split(':');
    if (parts.length !== 2) return 0;
    const [m, s] = parts.map(Number);
    if (Number.isNaN(m) || Number.isNaN(s)) return 0;
    return m * 60 + s;
  };

  // Get the max elapsed time from score progression (fallback if bout_length_s is stale)
  const getProgressionDurationSeconds = () => {
    const userTimes = scoreProgression.userData.map(p => parseTimeLabelToSeconds(p.x));
    const opponentTimes = scoreProgression.opponentData.map(p => parseTimeLabelToSeconds(p.x));
    return Math.max(0, ...userTimes, ...opponentTimes);
  };

  const normalizedUserName = normalizeName(userName);
  const isFencer1User = normalizedUserName && match?.fencer_1_name
    ? normalizeName(match.fencer_1_name) === normalizedUserName
    : false;
  const isFencer2User = normalizedUserName && match?.fencer_2_name
    ? normalizeName(match.fencer_2_name) === normalizedUserName
    : false;

  // Progression totals (already mapped to user/opponent orientation)
  const progressionUserTotal = scoreProgression.userData.length > 0
    ? scoreProgression.userData[scoreProgression.userData.length - 1].y
    : 0;
  const progressionOpponentTotal = scoreProgression.opponentData.length > 0
    ? scoreProgression.opponentData[scoreProgression.opponentData.length - 1].y
    : 0;

  // Fallbacks from DB (position-based)
  const hasKnownUser = isFencer1User || isFencer2User;

  // DB totals are stored in user/opponent orientation (final_score = user, touches_against = opponent)
  const dbUserScore = match?.final_score ?? 0;
  const dbOpponentScore = match?.touches_against ?? 0;

  // If progression totals don't match DB, prefer DB to avoid undercounted progressions (e.g., sabre deduping)
  const progressionMatchesDb = progressionUserTotal === dbUserScore && progressionOpponentTotal === dbOpponentScore;

  // Derive user/opponent scores with orientation; prefer progression totals when available
  const userScoreFinal = progressionMatchesDb && progressionUserTotal > 0 ? progressionUserTotal : dbUserScore;
  const opponentScoreFinal = progressionMatchesDb && progressionOpponentTotal > 0 ? progressionOpponentTotal : dbOpponentScore;

  // Map to header positions (fencer_1 = left, fencer_2 = right)
  const fencer1ScoreFinal = hasKnownUser
    ? (isFencer1User ? userScoreFinal : opponentScoreFinal)
    : (match?.final_score ?? userScoreFinal);
  const fencer2ScoreFinal = hasKnownUser
    ? (isFencer1User ? opponentScoreFinal : userScoreFinal)
    : (match?.touches_against ?? opponentScoreFinal);

  const userPosition = isFencer1User ? 'left' : isFencer2User ? 'right' : 'left';
  const userLabelForCard = isFencer1User
    ? getFirstName(match?.fencer_1_name) || 'Fencer 1'
    : isFencer2User
    ? getFirstName(match?.fencer_2_name) || 'Fencer 2'
    : getFirstName(match?.fencer_1_name) || 'Fencer 1';
  const opponentLabelForCard = isFencer1User
    ? getFirstName(match?.fencer_2_name) || 'Fencer 2'
    : isFencer2User
    ? getFirstName(match?.fencer_1_name) || 'Fencer 1'
    : getFirstName(match?.fencer_2_name) || 'Fencer 2';
  const namePromptTitle = hasKnownUser && (promptTargets.fencer1 !== promptTargets.fencer2)
    ? 'Add opponent name?'
    : 'Add fencer names?';
  const opponentEditLabel = hasKnownUser
    ? 'Opponent name'
    : opponentNameTarget === 'fencer1'
      ? 'Fencer 1 name'
      : 'Fencer 2 name';
  const getPromptLabel = (target: 'fencer1' | 'fencer2') => {
    if (hasKnownUser) {
      if (target === 'fencer1' && isFencer1User) return 'Your name';
      if (target === 'fencer2' && isFencer2User) return 'Your name';
      return 'Opponent name';
    }
    return target === 'fencer1' ? 'Fencer 1 name' : 'Fencer 2 name';
  };
  const weaponType = match?.weapon_type || (params.weaponType as string | undefined);

  const matchData = match ? {
    id: match.match_id,
    opponent: match.fencer_2_name || 'Opponent',
    opponentImage: 'https://example.com/opponent.jpg', // TODO: Add opponent image
    userImage: userProfileImage || undefined, // Use loaded profile image
    userName: userName || match.fencer_1_name || 'User',
    outcome: (match.user_id && match.result === 'win') ? 'victory' as const : 
             (match.user_id && match.result === 'loss') ? 'defeat' as const : 
             null, // No outcome for anonymous matches (user_id is null)
    score: `${fencer1ScoreFinal}-${fencer2ScoreFinal}`,
    matchType: matchType, // Use match type from database
    date: new Date().toLocaleDateString(),
    // Use entity-based logic to determine which score belongs to the user, prefer progression totals
    userScore: userScoreFinal,
    opponentScore: opponentScoreFinal,
    bestRun: bestRun, // Now using calculated best run from database
    fencer1Name: match.fencer_1_name,
    fencer2Name: match.fencer_2_name,
    isFencer1User,
    isFencer2User,
    // Map position-based scores (fencer_1 = left, fencer_2 = right) using oriented totals
    fencer1Score: fencer1ScoreFinal,
    fencer2Score: fencer2ScoreFinal,
  } : null;

  // Clamp score progression to the header totals so penalties/cards don't push the chart past the displayed score
  useEffect(() => {
    const clampSeries = (series: { x: string; y: number }[], cap: number) =>
      series.map(point => (point.y > cap ? { ...point, y: cap } : point));

    const exceedsHeader =
      scoreProgression.userData.some(p => p.y > userScoreFinal) ||
      scoreProgression.opponentData.some(p => p.y > opponentScoreFinal);

    if (exceedsHeader) {
      const clamped = {
        userData: clampSeries(scoreProgression.userData, userScoreFinal),
        opponentData: clampSeries(scoreProgression.opponentData, opponentScoreFinal),
      };
      setScoreProgression(clamped);
      console.log('📉 [MATCH SUMMARY] Clamped score progression to header totals', {
        userScoreFinal,
        opponentScoreFinal,
        lastUser: scoreProgression.userData[scoreProgression.userData.length - 1]?.y,
        lastOpponent: scoreProgression.opponentData[scoreProgression.opponentData.length - 1]?.y,
      });
    }
  }, [scoreProgression, userScoreFinal, opponentScoreFinal]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: height * 0.02,
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.02,
    },
    title: {
      fontSize: Math.round(width * 0.06),
      fontWeight: '700',
      color: 'white',
      textAlign: 'center',
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: height * 0.02, // Add space for the pill to show
      paddingBottom: height * 0.08, // Responsive padding to prevent navigation bar overlap
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
      marginBottom: height * 0.015,
      borderRadius: width * 0.02,
    },
    offlineBannerText: {
      color: 'white',
      fontSize: width * 0.035,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: width * 0.025,
    },
    modalContainer: {
      width: width * 0.95,
      maxWidth: width * 0.95,
    },
    modalContent: {
      borderRadius: width * 0.04,
      padding: width * 0.05,
      borderWidth: 1,
      borderColor: Colors.glassyGradient.borderColor,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.02,
    },
    modalTitle: {
      fontSize: Math.round(width * 0.06),
      fontWeight: '700',
      color: 'white',
    },
    closeButton: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: '#404040',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.02,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      minHeight: height * 0.25,
      marginBottom: height * 0.02,
    },
    textInput: {
      color: 'white',
      fontSize: Math.round(width * 0.04),
      padding: width * 0.03,
      textAlignVertical: 'top',
      minHeight: height * 0.25,
    },
    namePromptBody: {
      gap: height * 0.02,
      marginBottom: height * 0.02,
    },
    namePromptField: {
      gap: height * 0.008,
    },
    namePromptLabel: {
      color: 'rgba(255, 255, 255, 0.75)',
      fontSize: Math.round(width * 0.035),
      fontWeight: '500',
    },
    namePromptInputContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.02,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: width * 0.03,
      paddingVertical: height * 0.012,
    },
    namePromptInput: {
      color: 'white',
      fontSize: Math.round(width * 0.04),
    },
    modalFooter: {
      alignItems: 'center',
    },
    characterCount: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: Math.round(width * 0.03),
      marginBottom: height * 0.015,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: width * 0.03,
    },
    cancelButton: {
      flex: 1,
      paddingHorizontal: width * 0.06,
      paddingVertical: height * 0.015,
      borderRadius: width * 0.02,
      backgroundColor: '#404040',
      borderWidth: 1,
      borderColor: '#E0E0E0',
      alignItems: 'center',
    },
    cancelButtonText: {
      color: 'white',
      fontSize: Math.round(width * 0.04),
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      paddingHorizontal: width * 0.06,
      paddingVertical: height * 0.015,
      borderRadius: width * 0.02,
      backgroundColor: '#6C5CE7',
      alignItems: 'center',
    },
    saveButtonText: {
      color: 'white',
      fontSize: Math.round(width * 0.04),
      fontWeight: '600',
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
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" style={{ marginBottom: 20 }} />
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
            Match Not Found
          </Text>
          <Text style={{ color: '#9D9D9D', fontSize: 16, textAlign: 'center', marginBottom: 30, lineHeight: 22 }}>
            The match you're looking for couldn't be found.{'\n'}
            This might happen if the match was deleted or if there was an error during completion.
          </Text>
          <TouchableOpacity 
            onPress={handleBack} 
            style={{ 
              backgroundColor: '#6250F2', 
              paddingHorizontal: 30, 
              paddingVertical: 15, 
              borderRadius: 25,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10
            }}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <View style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Match Summary</Text>
        </View>

        {/* Offline Match Indicator */}
        {(params.isOffline === 'true' || (params.matchId as string)?.startsWith('offline_')) && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color="white" />
            <Text style={styles.offlineBannerText}>
              Saved offline - Will sync when you're online
            </Text>
          </View>
        )}
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
          {/* Recent Match Card - Full Width */}
          <MatchSummaryStats 
            match={matchData} 
            matchType={matchType}
            onMatchTypeChange={setMatchType}
            showMatchTypeSelector={!!user}
            onEditOpponentName={openOpponentNameModal}
          />

        {/* Match Summary Card */}
          <MatchSummaryCard
            onEdit={handleEdit}
            onSeeFullSummary={handleSeeFullSummary}
            onCancelMatch={handleCancelMatch}
            onSaveMatch={handleSaveMatch}
            scoreProgression={scoreProgression}
            userScore={userScoreFinal}
            opponentScore={opponentScoreFinal}
            bestRun={bestRun}
            yellowCards={userCardCounts.yellow}
            redCards={userCardCounts.red}
            highestMomentum={highestMomentum}
            doubleTouchCount={doubleTouchCount}
            matchDurationSeconds={Math.max(match?.bout_length_s || 0, getProgressionDurationSeconds())}
            touchesByPeriod={touchesByPeriod}
            notes={notes}
            onNotesChange={handleNotesChange}
            onNotesPress={handleNotesPress}
            userLabel={userLabelForCard}
            opponentLabel={opponentLabelForCard}
            weaponType={weaponType}
            userPosition={userPosition}
          />
      </ScrollView>

      {/* Notes Modal */}
      <Modal
        visible={showNotesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelNotes}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => Keyboard.dismiss()}
        >
          <KeyboardAvoidingView 
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 50}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalContainer}>
                <LinearGradient
                  colors={Colors.glassyGradient.colors}
                  style={styles.modalContent}
                  start={Colors.glassyGradient.start}
                  end={Colors.glassyGradient.end}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Match Notes</Text>
                    <TouchableOpacity onPress={handleCancelNotes} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      value={notes}
                      onChangeText={handleNotesChange}
                      placeholder="Add your thoughts about this match..."
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      multiline
                      maxLength={500}
                      autoFocus
                    />
                  </View>
                  
                  <View style={styles.modalFooter}>
                    <Text style={styles.characterCount}>
                      {notes.length}/500
                    </Text>
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity onPress={handleCancelNotes} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSaveNotes} style={styles.saveButton}>
                        <Text style={styles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Edit Opponent Name Modal */}
      <Modal
        visible={showOpponentNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOpponentNameModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => Keyboard.dismiss()}
        >
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 50}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalContainer}>
                <LinearGradient
                  colors={Colors.glassyGradient.colors}
                  style={styles.modalContent}
                  start={Colors.glassyGradient.start}
                  end={Colors.glassyGradient.end}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Edit Opponent Name</Text>
                    <TouchableOpacity onPress={() => setShowOpponentNameModal(false)} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.namePromptBody}>
                    <View style={styles.namePromptField}>
                      <Text style={styles.namePromptLabel}>{opponentEditLabel}</Text>
                      <View style={styles.namePromptInputContainer}>
                        <TextInput
                          style={styles.namePromptInput}
                          value={opponentNameInput}
                          onChangeText={setOpponentNameInput}
                          placeholder="Enter name"
                          placeholderTextColor="rgba(255, 255, 255, 0.5)"
                          autoCapitalize="words"
                          returnKeyType="done"
                          autoFocus
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalFooter}>
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity onPress={() => setShowOpponentNameModal(false)} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSaveOpponentName} style={styles.saveButton}>
                        <Text style={styles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Save Match Name Prompt */}
      <Modal
        visible={showNamePrompt}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNamePrompt(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => Keyboard.dismiss()}
        >
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 50}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalContainer}>
                <LinearGradient
                  colors={Colors.glassyGradient.colors}
                  style={styles.modalContent}
                  start={Colors.glassyGradient.start}
                  end={Colors.glassyGradient.end}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{namePromptTitle}</Text>
                    <TouchableOpacity onPress={() => setShowNamePrompt(false)} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.namePromptBody}>
                    {promptTargets.fencer1 && (
                      <View style={styles.namePromptField}>
                        <Text style={styles.namePromptLabel}>{getPromptLabel('fencer1')}</Text>
                        <View style={styles.namePromptInputContainer}>
                          <TextInput
                            style={styles.namePromptInput}
                            value={promptFencer1Name}
                            onChangeText={setPromptFencer1Name}
                            placeholder="Enter name"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            autoCapitalize="words"
                            returnKeyType="done"
                          />
                        </View>
                      </View>
                    )}
                    {promptTargets.fencer2 && (
                      <View style={styles.namePromptField}>
                        <Text style={styles.namePromptLabel}>{getPromptLabel('fencer2')}</Text>
                        <View style={styles.namePromptInputContainer}>
                          <TextInput
                            style={styles.namePromptInput}
                            value={promptFencer2Name}
                            onChangeText={setPromptFencer2Name}
                            placeholder="Enter name"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            autoCapitalize="words"
                            returnKeyType="done"
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.modalFooter}>
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity onPress={() => setShowNamePrompt(false)} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSaveMatchWithNames} style={styles.saveButton}>
                        <Text style={styles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Goal Celebration Modal */}
      <GoalCelebrationModal
        visible={showCelebration}
        goalData={completedGoal}
        onClose={handleCelebrationClose}
      />

      {/* Set New Goal Prompt Modal */}
      <SetNewGoalPrompt
        visible={showNewGoalPrompt}
        completedGoal={completedGoal}
        onSetGoal={handleSetNewGoal}
        onLater={handleLater}
      />
    </View>
  );
}

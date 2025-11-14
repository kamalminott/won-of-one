import { GoalCelebrationModal } from '@/components/GoalCelebrationModal';
import { MatchSummaryCard } from '@/components/MatchSummaryCard';
import { MatchSummaryStats } from '@/components/MatchSummaryStats';
import { SetNewGoalPrompt } from '@/components/SetNewGoalPrompt';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { goalService, matchService } from '@/lib/database';
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
  const { user, userName, profileImage } = useAuth();
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
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [completedGoal, setCompletedGoal] = useState<any>(null);
  const [completedGoalId, setCompletedGoalId] = useState<string | null>(null);
  const [showNewGoalPrompt, setShowNewGoalPrompt] = useState(false);
  const [matchType, setMatchType] = useState<'training' | 'competition'>('training');

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
      const savedImage = await AsyncStorage.getItem('user_profile_image');
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
          console.log('📱 Loading offline match from params');
          
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
          setScoreProgression({ userData: [], opponentData: [] });
          
          setLoading(false);
          return;
        }
        
        // Online match - fetch from database
        try {
          const matchData = await matchService.getMatchById(params.matchId as string);
          console.log('📊 Fetched match data for summary:', matchData);
          console.log('⏱️ ACTUAL MATCH DURATION (bout_length_s):', matchData?.bout_length_s, 'seconds');
          console.log('⏱️ MATCH DURATION FORMATTED:', matchData?.bout_length_s ? `${Math.floor(matchData.bout_length_s / 60)}:${(matchData.bout_length_s % 60).toString().padStart(2, '0')}` : 'N/A');
          setMatch(matchData);
          
          // Load existing notes if available
          if (matchData?.notes) {
            console.log('📝 Loading existing notes:', matchData.notes);
            setNotes(matchData.notes);
          }
          
          // Load match type from database
          if (matchData?.match_type) {
            const type = matchData.match_type.toLowerCase() === 'training' ? 'training' : 'competition';
            console.log('🏷️ Loading match type from database:', type);
            setMatchType(type);
          }
          
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
              matchData.fencer_1_name || 'You'
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
    console.log('Edit match');
  };

  const handleSeeFullSummary = () => {
    // TODO: Navigate to full summary
    console.log('See full summary');
  };

  const handleCancelMatch = async () => {
    if (!match?.match_id) {
      console.log('No match ID available for deletion');
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
              console.log('🗑️ Canceling and deleting match:', match.match_id);
              
              // Delete the match from the database
              const success = await matchService.deleteMatch(match.match_id);
              
              if (success) {
                console.log('✅ Match deleted successfully');
                
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

  const handleSaveMatch = async () => {
    if (!match || !user?.id) {
      console.log('No match or user data available for saving');
      return;
    }

    try {
      console.log('💾 Saving match and updating goals...');
      
      // Update match type in the database
      if (match.match_id) {
        await matchService.updateMatch(match.match_id, { 
          match_type: matchType 
        });
        console.log(`✅ Match type updated to: ${matchType}`);
      }
      
      // Check if completed goal info was passed from remote.tsx (for remote matches)
      const hasCompletedGoalFromRemote = params.completedGoalData;
      if (hasCompletedGoalFromRemote) {
        try {
          const goalData = JSON.parse(params.completedGoalData as string);
          console.log('🎉 Showing celebration for completed goal from remote:', goalData);
          setCompletedGoal(goalData);
          // Get the goal ID from the active goals
          const activeGoals = await goalService.getActiveGoals(user.id);
          const matchingGoal = activeGoals.find(g => g.title === goalData.title);
          if (matchingGoal) {
            setCompletedGoalId(matchingGoal.id);
          }
          setShowCelebration(true);
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
          match.touches_against || 0
        );
        console.log('✅ Goals updated successfully');
        
        // Check if any goals were completed
        if (result.completedGoals && result.completedGoals.length > 0) {
          // Show celebration for the first completed goal
          console.log('🎉 Showing celebration for completed goal:', result.completedGoals[0]);
          const goalData = result.completedGoals[0];
          setCompletedGoal(goalData);
          // Store the goal ID from the activeGoals list
          const activeGoals = await goalService.getActiveGoals(user.id);
          const matchingGoal = activeGoals.find(g => g.title === goalData.title);
          if (matchingGoal) {
            setCompletedGoalId(matchingGoal.id);
          }
          setShowCelebration(true);
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
        console.log('🔄 Passing failed goal from remote to home screen');
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
        console.log('ℹ️ Skipping goal update - match already complete or anonymous');
      }
      
      // Navigate back to home page
      router.push('/(tabs)');
      
    } catch (error) {
      console.error('Error saving match:', error);
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
      console.log('🔒 Deactivating completed goal:', completedGoalId);
      await goalService.deactivateGoal(completedGoalId);
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
      console.log('🔒 Deactivating completed goal:', completedGoalId);
      await goalService.deactivateGoal(completedGoalId);
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
        console.log('💾 Saving notes to database:', notes);
        await matchService.updateMatch(match.match_id, {
          notes: notes
        });
        console.log('✅ Notes saved successfully');
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

  // Prepare match data for MatchSummaryStats
  const matchData = match ? {
    id: match.match_id,
    opponent: match.fencer_2_name || 'Opponent',
    opponentImage: 'https://example.com/opponent.jpg', // TODO: Add opponent image
    userImage: userProfileImage || undefined, // Use loaded profile image
    userName: userName || match.fencer_1_name || 'User',
    outcome: (match.user_id && match.result === 'win') ? 'victory' as const : 
             (match.user_id && match.result === 'loss') ? 'defeat' as const : 
             null, // No outcome for anonymous matches (user_id is null)
    score: `${match.final_score || 0}-${match.touches_against || 0}`,
    matchType: matchType, // Use match type from database
    date: new Date().toLocaleDateString(),
    userScore: match.final_score || 0,
    opponentScore: match.touches_against || 0,
    bestRun: bestRun, // Now using calculated best run from database
    fencer1Name: match.fencer_1_name,
    fencer2Name: match.fencer_2_name
  } : null;

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
          />

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
          notes={notes}
          onNotesChange={handleNotesChange}
          onNotesPress={handleNotesPress}
          userLabel={match?.user_id 
            ? getFirstName(userName || match?.fencer_1_name) || 'You'
            : getFirstName(match?.fencer_1_name) || 'Fencer 1'}
          opponentLabel={getFirstName(match?.fencer_2_name) || 'Opponent'}
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
            behavior={Platform.OS === 'ios' ? 'position' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 50}
            style={{ 
              flex: 1, 
              justifyContent: Platform.OS === 'ios' ? 'center' : 'center',
              marginTop: Platform.OS === 'android' ? height * 0.15 : 0
            }}
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

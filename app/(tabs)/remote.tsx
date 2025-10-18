import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import useDynamicLayout from '@/hooks/useDynamicLayout';
import { fencingRemoteService, goalService, matchEventService, matchPeriodService, matchService } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, InteractionManager, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function RemoteScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useDynamicLayout();
  const router = useRouter();
  const { user, userName } = useAuth();
  
  // Responsive breakpoints for small screens - simplified for consistency across devices
  
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const [aliceScore, setAliceScore] = useState(0);
  const [bobScore, setBobScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [matchTime, setMatchTime] = useState(180); // 3 minutes in seconds
  const [period1Time, setPeriod1Time] = useState(0); // in seconds
  const [period2Time, setPeriod2Time] = useState(0); // in seconds
  const [period3Time, setPeriod3Time] = useState(0); // in seconds
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editTimeInput, setEditTimeInput] = useState('');
  const [showResetPopup, setShowResetPopup] = useState(false);
  const [fencerPositions, setFencerPositions] = useState({ alice: 'left', bob: 'right' });
  const [isSwapping, setIsSwapping] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(true); // Automatically enabled
  const [fencerNames, setFencerNames] = useState({ 
    alice: 'Alice', 
    bob: 'Bob' 
  });
  
  // Image states
  const [opponentImages, setOpponentImages] = useState({
    alice: null as string | null,
    bob: null as string | null,
  });
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedFencer, setSelectedFencer] = useState<'alice' | 'bob' | null>(null);
  const [isCompletingMatch, setIsCompletingMatch] = useState(false);

  // Get user display name from context
  const userDisplayName = userName || 'You';
  
  // Debug logging removed
  
  // Test function to manually check stored images
  const testImageLoading = async () => {
    try {
      const aliceImage = await AsyncStorage.getItem('opponent_image_alice');
      const bobImage = await AsyncStorage.getItem('opponent_image_bob');
      console.log('Direct AsyncStorage check - Alice:', aliceImage, 'Bob:', bobImage);
    } catch (error) {
      console.error('Error checking AsyncStorage:', error);
    }
  };
  
  // Load stored images on component mount
  useEffect(() => {
    loadStoredImages();
    testImageLoading(); // Test function to verify AsyncStorage
    // Removed loadPersistedMatchState() - now handled only on focus
  }, []);

  // Save match state when scores or other important state changes
  useEffect(() => {
    // Only save if there's an active match
    const hasActiveMatch = aliceScore > 0 || bobScore > 0 || currentPeriod > 1 || 
                          period1Time > 0 || period2Time > 0 || period3Time > 0 || isPlaying;
    
    if (hasActiveMatch) {
      saveMatchState();
    }
  }, [aliceScore, bobScore, currentPeriod, isPlaying, period1Time, period2Time, period3Time]);

  // Handle focus/blur events for match persistence
  useFocusEffect(
    useCallback(() => {
      resumePromptShownRef.current = false; // reset for this focus

      let cancelled = false;

      const run = async () => {
        // wait until nav animations & interactions are done — Alert/Modal will show immediately
        await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));

        console.log('🎯 Checking resume conditions:', {
          cancelled,
          hasNavigatedAwayRef: hasNavigatedAwayRef.current,
          resumePromptShown: resumePromptShownRef.current
        });
        
        if (!cancelled && hasNavigatedAwayRef.current && !resumePromptShownRef.current && !isActivelyUsingAppRef.current) {
          // Check if there's actually a saved match state worth resuming
          const savedState = await AsyncStorage.getItem('ongoing_match_state');
          if (savedState) {
            const matchState = JSON.parse(savedState);
            const hasActiveMatch = matchState.aliceScore > 0 || matchState.bobScore > 0 || matchState.currentPeriod > 1;
            
            if (hasActiveMatch) {
              console.log('🎯 Showing resume prompt - active match found');
              resumePromptShownRef.current = true;
              // force the prompt
              await loadPersistedMatchState({ forcePrompt: true });
            } else {
              console.log('🎯 No active match to resume - clearing flag');
              setHasNavigatedAway(false);
            }
          } else {
            console.log('🎯 No saved state - clearing flag');
            setHasNavigatedAway(false);
          }
        } else {
          console.log('🎯 Skipping resume prompt - conditions not met');
          // Reset navigation flag when screen gains focus normally
          if (hasNavigatedAwayRef.current) {
            setHasNavigatedAway(false);
          }
        }
      };

      run();

      return () => {
        // Only mark as navigated away if we're not actively using the app
        if (!isActivelyUsingAppRef.current) {
          setHasNavigatedAway(true);
        }
        // don't await in cleanup
        saveMatchState();
        if (isPlaying) pauseTimer();
        cancelled = true;
      };
    }, [isPlaying]) // keep deps minimal (no hasNavigatedAway here!)
  );

  const loadStoredImages = async () => {
    try {
      const aliceImage = await AsyncStorage.getItem('opponent_image_alice');
      const bobImage = await AsyncStorage.getItem('opponent_image_bob');
      const userImage = await AsyncStorage.getItem('user_profile_image');
      
      console.log('Loaded images - Alice:', aliceImage, 'Bob:', bobImage, 'User:', userImage);
      
      setOpponentImages({
        alice: aliceImage,
        bob: bobImage,
      });
      setUserProfileImage(userImage);
    } catch (error) {
      console.error('Error loading stored images:', error);
    }
  };

  // Load user profile image from profile page
  useEffect(() => {
    const loadUserProfileImage = async () => {
      try {
        const userImage = await AsyncStorage.getItem('user_profile_image');
        if (userImage) {
          setUserProfileImage(userImage);
        }
      } catch (error) {
        console.error('Error loading user profile image:', error);
      }
    };

    loadUserProfileImage();
  }, []);

  // Helper function to validate if an image URI is valid
  const isValidImage = (imageUri: string | undefined): boolean => {
    return !!(
      imageUri &&
      imageUri !== 'https://via.placeholder.com/60x60' &&
      !imageUri.includes('example.com') &&
      !imageUri.includes('placeholder') &&
      (imageUri.startsWith('http') || imageUri.startsWith('file://'))
    );
  };

  // Helper function to render profile image or initials
  const renderProfileImage = (imageUri: string | undefined, name: string | undefined, isUser: boolean = false) => {
    const initials = getInitials(name);

    if (isValidImage(imageUri) && !imageLoadErrors.has(imageUri)) {
      return (
        <Image 
          source={{ uri: imageUri }} 
          style={styles.profileImage}
          resizeMode="cover"
          onError={(error) => {
            console.log('❌ Image failed to load, will show initials instead:', error);
            setImageLoadErrors(prev => new Set(prev).add(imageUri));
          }}
          onLoad={() => {
            console.log('✅ Image loaded successfully');
          }}
        />
      );
    }

    return (
      <View style={[styles.profileImageContainer, { backgroundColor: '#393939', borderWidth: 1, borderColor: '#FFFFFF' }]}>
        <Text style={styles.profileInitials}>{initials}</Text>
      </View>
    );
  };

  const saveImage = async (key: string, imageUri: string) => {
    try {
      await AsyncStorage.setItem(key, imageUri);
    } catch (error) {
      console.error('Error saving image:', error);
    }
  };

  // Match state persistence functions
  const saveMatchState = async () => {
    try {
      // Only save if there's an active match or match has started
      const hasMatchStarted = aliceScore > 0 || bobScore > 0 || currentPeriod > 1 || 
                             period1Time > 0 || period2Time > 0 || period3Time > 0;
      
      if (!hasMatchStarted && !isPlaying) {
        // No active match to save
        await AsyncStorage.removeItem('ongoing_match_state');
        console.log('💾 No active match - cleared any saved state');
        return;
      }

      const matchState = {
        currentPeriod,
        aliceScore,
        bobScore,
        isPlaying: false, // Always pause when saving
        matchTime,
        period1Time,
        period2Time,
        period3Time,
        fencerNames,
        fencerPositions,
        showUserProfile,
        matchStartTime: matchStartTime?.toISOString(),
        lastEventTime: lastEventTime?.toISOString(),
        totalPausedTime,
        savedAt: new Date().toISOString()
      };
      
      // Log what's being saved in match state
      console.log('💾 SAVING MATCH STATE:', {
        aliceScore,
        bobScore,
        currentPeriod,
        fencerNames,
        matchStartTime: matchStartTime?.toISOString(),
        lastEventTime: lastEventTime?.toISOString(),
        totalPausedTime,
        matchId: currentMatchPeriod?.match_id
      });
      
      // Note: Individual scoring events with timing are stored in match_event table, not in match state
      console.log('💾 NOTE: Individual scoring events are stored in database (match_event table), not in match state');

      await AsyncStorage.setItem('ongoing_match_state', JSON.stringify(matchState));
      console.log('💾 Match state saved:', matchState);
    } catch (error) {
      console.error('Error saving match state:', error);
    }
  };

  const loadPersistedMatchState = async (opts?: { forcePrompt?: boolean }) => {
    const forcePrompt = !!opts?.forcePrompt;
    try {
      const savedState = await AsyncStorage.getItem('ongoing_match_state');
      if (!savedState) {
        console.log('💾 No saved match state found');
        return;
      }

      const matchState = JSON.parse(savedState);
      const savedAt = new Date(matchState.savedAt);
      const now = new Date();
      const minutesSinceLastSave = (now.getTime() - savedAt.getTime()) / (1000 * 60);

      // Clear old saved states (older than 1 hour)
      if (minutesSinceLastSave > 60) {
        await AsyncStorage.removeItem('ongoing_match_state');
        console.log('💾 Cleared old match state (1+ hours old)');
        return;
      }

      // Check if there's actually a match to restore
      const hasMatchData = matchState.aliceScore > 0 || matchState.bobScore > 0 || 
                          matchState.currentPeriod > 1 || matchState.period1Time > 0 || 
                          matchState.period2Time > 0 || matchState.period3Time > 0;

      if (!hasMatchData) {
        await AsyncStorage.removeItem('ongoing_match_state');
        console.log('💾 Cleared empty match state');
        return;
      }

      // previous guards – now skip them when forced
      if (!forcePrompt) {
        if (isChangingScore) {
          console.log('💾 Score is being changed - skipping dialog to prevent conflicts');
          return;
        }
        
        if (!hasNavigatedAwayRef.current) {
          console.log('💾 User has not navigated away - skipping dialog');
          return;
        }
      }

      // Check if this is a completed match
      if (matchState.isCompleted) {
        // Completed match dialog
        const timeText = minutesSinceLastSave < 1 ? 'just now' : 
                        minutesSinceLastSave < 2 ? '1 minute ago' : 
                        `${Math.round(minutesSinceLastSave)} minutes ago`;
        
        Alert.alert(
          '🏁 Completed Match Found',
          `You have a completed match from ${timeText}:\n\n` +
          `${matchState.fencerNames?.alice || 'Alice'}: ${matchState.aliceScore}\n` +
          `${matchState.fencerNames?.bob || 'Bob'}: ${matchState.bobScore}\n` +
          `Period: ${matchState.currentPeriod}\n\n` +
          'What would you like to do?',
          [
            {
              text: 'Delete Match',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.removeItem('ongoing_match_state');
                setHasNavigatedAway(false); // Reset navigation flag
                resetAll(); // Reset the entire match state
                console.log('💾 User chose to delete completed match');
              }
            },
            {
              text: 'Resume Match',
              onPress: () => {
                setHasNavigatedAway(false); // Reset navigation flag
                console.log('🔄 User chose to resume completed match');
                restoreMatchState(matchState);
              }
            }
          ]
        );
      } else {
        // Active match dialog
        const timeText = minutesSinceLastSave < 1 ? 'just now' : 
                        minutesSinceLastSave < 2 ? '1 minute ago' : 
                        `${Math.round(minutesSinceLastSave)} minutes ago`;
        
        Alert.alert(
          '🔄 Resume Your Match?',
          `You have a paused match from ${timeText}:\n\n` +
          `${matchState.fencerNames?.alice || 'Alice'}: ${matchState.aliceScore}\n` +
          `${matchState.fencerNames?.bob || 'Bob'}: ${matchState.bobScore}\n` +
          `Period: ${matchState.currentPeriod}\n\n` +
          'Would you like to resume this match?',
          [
            {
              text: 'Start New Match',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.removeItem('ongoing_match_state');
                setHasNavigatedAway(false); // Reset navigation flag
                resetAll(); // Reset the entire match state
                console.log('💾 User chose to start new match - cleared saved state and reset match');
              }
            },
            {
              text: 'Resume Match',
              onPress: () => {
                setHasNavigatedAway(false); // Reset navigation flag
                console.log('🔄 User chose to resume match');
                restoreMatchState(matchState);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error loading match state:', error);
    }
  };

  const restoreMatchState = (matchState: any) => {
    try {
      console.log('🔄 Restoring match state:', matchState);
      
      setCurrentPeriod(matchState.currentPeriod || 1);
      setAliceScore(matchState.aliceScore || 0);
      setBobScore(matchState.bobScore || 0);
      setIsPlaying(false); // Always start paused when resuming
      setIsCompletingMatch(false); // Always reset completion flag when restoring
      setMatchTime(matchState.matchTime || 180);
      setPeriod1Time(matchState.period1Time || 0);
      setPeriod2Time(matchState.period2Time || 0);
      setPeriod3Time(matchState.period3Time || 0);
      
      // If this was a completed match, clear the completed flag
      if (matchState.isCompleted) {
        console.log('🔄 Resuming completed match - clearing completed flag');
        const updatedState = { ...matchState, isCompleted: false };
        AsyncStorage.setItem('ongoing_match_state', JSON.stringify(updatedState));
      }
      
      if (matchState.fencerNames) {
        setFencerNames(matchState.fencerNames);
      }
      if (matchState.fencerPositions) {
        setFencerPositions(matchState.fencerPositions);
      }
      if (typeof matchState.showUserProfile === 'boolean') {
        setShowUserProfile(matchState.showUserProfile);
      }

      // Restore time tracking if available
      if (matchState.matchStartTime) {
        setMatchStartTime(new Date(matchState.matchStartTime));
      }
      if (matchState.lastEventTime) {
        setLastEventTime(new Date(matchState.lastEventTime));
      }
      if (matchState.totalPausedTime) {
        setTotalPausedTime(matchState.totalPausedTime);
      }

      console.log('✅ Match state restored successfully');
    } catch (error) {
      console.error('Error restoring match state:', error);
    }
  };

  // Timer control functions (pauseTimer already exists in the file)

  const clearMatchState = async () => {
    try {
      await AsyncStorage.removeItem('ongoing_match_state');
      setHasNavigatedAway(false); // Reset navigation flag
      console.log('💾 Match state cleared from persistence');
    } catch (error) {
      console.error('Error clearing match state:', error);
    }
  };

  // Enhanced reset function that clears both UI state and persistence
  const resetAllWithPersistence = async () => {
    console.log('🔄 Starting Reset All with persistence clearing...');
    
    // Clear persisted match state first
    await clearMatchState();
    
    // Reset all UI state to initial values
    setCurrentPeriod(1);
    setAliceScore(0);
    setBobScore(0);
    setIsPlaying(false);
    setIsCompletingMatch(false);
    isActivelyUsingAppRef.current = false; // Reset active usage flag
    setMatchTime(180);
    setPeriod1Time(0);
    setPeriod2Time(0);
    setPeriod3Time(0);
    
    // Reset fencer info to defaults
    setFencerNames({ alice: 'Alice', bob: 'Bob' });
    setFencerPositions({ alice: 'left', bob: 'right' });
    setShowUserProfile(true);
    
    // Reset time tracking
    setMatchStartTime(null);
    setLastEventTime(null);
    setTotalPausedTime(0);
    
    console.log('✅ Reset All completed with persistence clearing');
  };

  const handleImageSelection = (fencer: 'alice' | 'bob') => {
    setSelectedFencer(fencer);
    setShowImagePicker(true);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    if (!selectedFencer) return;

    try {
      let result;
      
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission required', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission required', 'Photo library permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const storageKey = `opponent_image_${selectedFencer}`;
        
        console.log('Selected image URI:', imageUri);
        console.log('Storage key:', storageKey);
        
        await saveImage(storageKey, imageUri);
        
        setOpponentImages(prev => {
          const newImages = {
            ...prev,
            [selectedFencer]: imageUri,
          };
          console.log('Updated opponent images:', newImages);
          return newImages;
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    } finally {
      setShowImagePicker(false);
      setSelectedFencer(null);
    }
  };
  
  // Remote session state
  const [remoteSession, setRemoteSession] = useState<any>(null);
  
  // Match period state
  const [currentMatchPeriod, setCurrentMatchPeriod] = useState<any>(null);
  
  // Event tracking state
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const [matchStartTime, setMatchStartTime] = useState<Date | null>(null);
  const [totalPausedTime, setTotalPausedTime] = useState<number>(0); // in milliseconds
  const [pauseStartTime, setPauseStartTime] = useState<Date | null>(null);
  
  // We'll use null for opponent scoring and store opponent name in meta field

  // Helper function to calculate actual match time (excluding pauses)
  const getActualMatchTime = useCallback(() => {
    if (!matchStartTime) return 0;
    
    const now = new Date();
    const totalElapsed = now.getTime() - matchStartTime.getTime();
    const actualMatchTime = totalElapsed - totalPausedTime;
    
    console.log('⏱️ Match time calculation:', {
      totalElapsed: totalElapsed,
      totalPausedTime: totalPausedTime,
      actualMatchTime: actualMatchTime
    });
    
    return Math.max(0, actualMatchTime);
  }, [matchStartTime, totalPausedTime]);

  // Helper function to create match events with all required fields
  const createMatchEvent = async (scorer: 'user' | 'opponent', cardGiven?: string, newAliceScore?: number, newBobScore?: number) => {
    if (!remoteSession) {
      console.log('❌ No remote session - cannot create match event');
      return;
    }
    
    // Verify the remote session still exists in the database
    const { data: sessionCheck, error: sessionError } = await supabase
      .from('fencing_remote')
      .select('remote_id')
      .eq('remote_id', remoteSession.remote_id)
      .single();
    
    if (sessionError || !sessionCheck) {
      console.error('❌ Remote session no longer exists in database:', sessionError);
      return;
    }

    const now = new Date();
    const actualMatchTime = getActualMatchTime();
    const secondsSinceLastEvent = lastEventTime 
      ? Math.floor((now.getTime() - lastEventTime.getTime()) / 1000)
      : 0;
    
    console.log('🔍 Time calculation:', {
      now: now.toISOString(),
      lastEventTime: lastEventTime?.toISOString(),
      secondsSinceLastEvent,
      actualMatchTime: actualMatchTime,
      totalPausedTime: totalPausedTime
    });

    // Calculate score_diff based on user toggle and position
    let scoreDiff: number | null = null;
    if (showUserProfile && user) {
      // Use new scores if provided, otherwise use current state scores
      const currentAliceScore = newAliceScore !== undefined ? newAliceScore : aliceScore;
      const currentBobScore = newBobScore !== undefined ? newBobScore : bobScore;
      
      // User toggle is on - calculate from user's perspective
      const userScore = toggleCardPosition === 'left' ? currentAliceScore : currentBobScore;
      const opponentScore = toggleCardPosition === 'left' ? currentBobScore : currentAliceScore;
      scoreDiff = userScore - opponentScore;
      
      console.log('🔍 Score diff calculation:', {
        showUserProfile,
        toggleCardPosition,
        aliceScore: currentAliceScore,
        bobScore: currentBobScore,
        userScore,
        opponentScore,
        scoreDiff,
        usingNewScores: newAliceScore !== undefined || newBobScore !== undefined
      });
    }
    // If user toggle is off, score_diff remains null

    // Calculate actual match time elapsed (excluding paused time)
    const totalElapsed = now.getTime() - (matchStartTime?.getTime() || now.getTime());
    const actualMatchTimeMs = totalElapsed - totalPausedTime;
    
    // Use the actual match timer time instead of wall clock time
    // matchTime is the total match duration (e.g., 180 seconds)
    // timeRemaining is how much time is left on the timer
    // So elapsed time = matchTime - timeRemaining
    const matchTimeElapsed = Math.max(0, matchTime - timeRemaining);
    
    
    // Display the time elapsed that will be used for x-axis
    const minutes = Math.floor(matchTimeElapsed / 60);
    const seconds = matchTimeElapsed % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    console.log(`🕐 TIME ELAPSED FOR X-AXIS: ${timeString} (${matchTimeElapsed} seconds)`);
    
    // Determine the actual scorer name - use the names that will be stored in fencer_1_name/fencer_2_name
    const fencer1Name = showUserProfile && toggleCardPosition === 'left' ? userDisplayName : fencerNames.alice;
    const fencer2Name = showUserProfile && toggleCardPosition === 'right' ? userDisplayName : fencerNames.bob;
    
    // Determine who actually scored
    let scoringUserName;
    if (showUserProfile) {
      // User vs opponent mode: use scorer parameter
      scoringUserName = scorer === 'user' ? fencer1Name : fencer2Name;
    } else {
      // Anonymous mode: use which score actually changed to determine actual fencer
      // Check if Alice score changed (newAliceScore is defined) or Bob score changed (newBobScore is defined)
      if (newAliceScore !== undefined) {
        scoringUserName = fencerNames.alice; // Alice scored
      } else if (newBobScore !== undefined) {
        scoringUserName = fencerNames.bob; // Bob scored
      } else {
        // Fallback - shouldn't happen
        scoringUserName = fencerNames.alice;
      }
    }
    
    
    // Display the complete scoring event information
    console.log(`🎯 SCORING EVENT: ${scoringUserName} scored at ${timeString} (${matchTimeElapsed}s elapsed)`);
    console.log(`🎯 SCORING DEBUG: scorer="${scorer}", showUserProfile=${showUserProfile}, toggleCardPosition="${toggleCardPosition}"`);
    console.log(`🎯 SCORING DEBUG: fencer1Name="${fencer1Name}", fencer2Name="${fencer2Name}"`);
    console.log(`🎯 SCORING DEBUG: newAliceScore=${newAliceScore}, newBobScore=${newBobScore}, fencerNames.alice="${fencerNames.alice}", fencerNames.bob="${fencerNames.bob}"`);

    const eventData = {
      match_id: currentMatchPeriod?.match_id || null, // Add match_id to link event to match
      fencing_remote_id: remoteSession.remote_id,
      match_period_id: currentMatchPeriod?.match_period_id || null,
      event_time: now.toISOString(),
      event_type: "touch",
      scoring_user_id: scorer === 'user' ? user?.id : null,
      scoring_user_name: scoringUserName, // Use the determined scorer name
      fencer_1_name: fencer1Name,
      fencer_2_name: fencer2Name,
      card_given: cardGiven || null, // Only tracks actual cards: 'yellow', 'red', or null
      score_diff: scoreDiff,
      seconds_since_last_event: secondsSinceLastEvent,
      match_time_elapsed: matchTimeElapsed // Store actual match timer time
    };

    await matchEventService.createMatchEvent(eventData);
    setLastEventTime(now);
  };

  // Create remote session if it doesn't exist
  const ensureRemoteSession = async () => {
    if (remoteSession) return remoteSession;
    
    if (!user) {
      console.log('❌ No user - cannot create remote session');
      return null;
    }

    try {
      console.log('Creating remote session...');
      const session = await fencingRemoteService.createRemoteSession({
        referee_id: user.id,
        fencer_1_id: showUserProfile ? user.id : undefined, // Only set fencer_1_id if user toggle is on
        fencer_1_name: showUserProfile ? userDisplayName : fencerNames.alice, // Use Alice when user toggle is off
        fencer_2_name: fencerNames.bob, // Always Bob for fencer 2
        scoring_mode: "15-point",
        device_serial: "REMOTE_001"
      });
      
      console.log('Remote session created:', session);
      setRemoteSession(session);
      return session;
    } catch (error) {
      console.error('Error creating remote session:', error);
      return null;
    }
  };

  // Create a new match period
  const createMatchPeriod = async (session?: any, playClickTime?: string) => {
    const activeSession = session || remoteSession;
    if (!activeSession) {
      console.log('❌ No remote session - cannot create match period');
      return null;
    }

    try {
      console.log('🔄 Creating match period...', { currentPeriod, aliceScore, bobScore });
      
      // First, create a match record from the remote session
      // Only pass user.id if showUserProfile is true (user toggle is on)
      const userId = showUserProfile && user ? user.id : null;
      const match = await matchService.createMatchFromRemote(activeSession, userId);
      if (!match) {
        console.error('❌ Failed to create match record');
        return null;
      }
      
      console.log('✅ Match created:', match.match_id);
      
      // Use the exact time when Play was clicked as match start time
      const matchStartTime = playClickTime || new Date().toISOString();
      console.log('🕐 Setting match period start time to Play click time:', matchStartTime);
      
      // Now create the match period with the proper match_id
      const periodData = {
        match_id: match.match_id, // Use the actual match_id from the match table
        period_number: currentPeriod, // Use currentPeriod instead of periodNumber
        start_time: matchStartTime, // Use current time when Play is clicked
        fencer_1_score: aliceScore,
        fencer_2_score: bobScore,
        fencer_1_cards: aliceCards.yellow + aliceCards.red,
        fencer_2_cards: bobCards.yellow + bobCards.red,
        priority_assigned: priorityFencer || undefined,
        priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
      };
      
      console.log('🔄 Creating match period with data:', periodData);
      const period = await matchPeriodService.createMatchPeriod(periodData);
      
      if (period) {
        console.log('✅ Match period created successfully:', period);
        setCurrentMatchPeriod(period);
        return period;
      } else {
        console.error('❌ Failed to create match period');
        return null;
      }
    } catch (error) {
      console.error('❌ Error creating match period:', error);
      return null;
    }
  };

  // Update current match period with latest scores and cards
  const updateCurrentPeriod = async () => {
    if (!currentMatchPeriod) return;

    try {
      await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
        fencer_1_score: aliceScore,
        fencer_2_score: bobScore,
        fencer_1_cards: aliceCards.yellow + aliceCards.red,
        fencer_2_cards: bobCards.yellow + bobCards.red,
        priority_assigned: priorityFencer || undefined,
        priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
        timestamp: new Date().toISOString(), // Update timestamp when period is updated
      });
    } catch (error) {
      console.error('Error updating match period:', error);
    }
  };

  // Complete the current match
  const completeMatch = async () => {
    if (!currentMatchPeriod || !remoteSession) {
      console.error('Cannot complete match: missing period or session');
      return;
    }

    try {
      console.log('Completing match...');
      setIsCompletingMatch(true); // Prevent further score changes
      
      // Calculate total match duration: (completed periods * full period time) + current period elapsed
      const completedPeriods = currentPeriod - 1;
      const currentPeriodElapsed = matchTime - timeRemaining;
      const matchDuration = (completedPeriods * matchTime) + currentPeriodElapsed;
      
      console.log('🕐 Match duration calculation:', {
        completedPeriods,
        currentPeriod,
        timeRemaining,
        matchTime,
        currentPeriodElapsed,
        calculatedDuration: matchDuration
      });
      
      // Determine result based on user_id presence
      let result: string | null = null;
      let finalScore: number;
      let touchesAgainst: number;
      let scoreDiff: number | null;

      if (user?.id && showUserProfile) {
        // User is registered AND toggle is on - determine their position and result
        const userScore = toggleCardPosition === 'left' ? aliceScore : bobScore;
        const opponentScore = toggleCardPosition === 'left' ? bobScore : aliceScore;

        finalScore = userScore;
        touchesAgainst = opponentScore;
        scoreDiff = userScore - opponentScore;
        result = userScore > opponentScore ? 'win' : 'loss';
      } else {
        // User toggle is off OR no registered user - record as anonymous match
        finalScore = aliceScore;
        touchesAgainst = bobScore;
        scoreDiff = null; // No score_diff when no user is present
        result = null; // No win/loss determination
      }

      // Calculate period-based data
      let touchesByPeriod;
      let periodNumber;
      let scoreSpp;
      let scoreByPeriod;

      if (user?.id && showUserProfile) {
        // User match - use existing logic
        const effectiveUserName = userDisplayName;
        touchesByPeriod = await matchService.calculateTouchesByPeriod(currentMatchPeriod.match_id, effectiveUserName, undefined, finalScore, touchesAgainst);
        
        // Calculate period number (count non-zero periods)
        periodNumber = [touchesByPeriod.period1, touchesByPeriod.period2, touchesByPeriod.period3]
          .filter(period => period.user > 0 || period.opponent > 0).length;
        
        // Calculate score per period (user only) - round to integer
        scoreSpp = periodNumber > 0 ? Math.round(finalScore / periodNumber) : 0;
        
        // Structure score by period data
        scoreByPeriod = {
          period1: { user: touchesByPeriod.period1.user, opponent: touchesByPeriod.period1.opponent },
          period2: { user: touchesByPeriod.period2.user, opponent: touchesByPeriod.period2.opponent },
          period3: { user: touchesByPeriod.period3.user, opponent: touchesByPeriod.period3.opponent }
        };
      } else {
        // Anonymous match - use match_period data directly
        console.log('📊 Anonymous match - using match_period data directly');
        
        // Get the actual match period data
        const { data: matchPeriods } = await supabase
          .from('match_period')
          .select('fencer_1_score, fencer_2_score, period_number')
          .eq('match_id', currentMatchPeriod.match_id)
          .order('period_number', { ascending: true });

        if (matchPeriods && matchPeriods.length > 0) {
          const period = matchPeriods[0]; // Use first period
          
          // For anonymous matches, both fencers are equal participants
          periodNumber = 1; // All touches in first period for now
          scoreSpp = Math.round((period.fencer_1_score + period.fencer_2_score) / periodNumber);
          
          // Structure score by period data using actual fencer scores
          scoreByPeriod = {
            period1: { user: period.fencer_1_score, opponent: period.fencer_2_score },
            period2: { user: 0, opponent: 0 },
            period3: { user: 0, opponent: 0 }
          };
          
          touchesByPeriod = {
            period1: { user: period.fencer_1_score, opponent: period.fencer_2_score },
            period2: { user: 0, opponent: 0 },
            period3: { user: 0, opponent: 0 }
          };
        } else {
          // Fallback if no period data
          periodNumber = 1;
          scoreSpp = Math.round((aliceScore + bobScore) / periodNumber);
          
          scoreByPeriod = {
            period1: { user: aliceScore, opponent: bobScore },
            period2: { user: 0, opponent: 0 },
            period3: { user: 0, opponent: 0 }
          };
          
          touchesByPeriod = {
            period1: { user: aliceScore, opponent: bobScore },
            period2: { user: 0, opponent: 0 },
            period3: { user: 0, opponent: 0 }
          };
        }
      }

      console.log('📊 Period calculations:', {
        periodNumber,
        scoreSpp,
        scoreByPeriod,
        touchesByPeriod
      });

      // 1. Update match with final scores and completion status
      const updatedMatch = await matchService.updateMatch(currentMatchPeriod.match_id, {
        final_score: finalScore,
        // touches_against is a generated column - don't set it explicitly
        result: result, // Will be 'win'/'loss' if user exists, null if no user
        score_diff: scoreDiff,
        bout_length_s: matchDuration > 0 ? matchDuration : undefined,
        yellow_cards: aliceCards.yellow + bobCards.yellow,
        red_cards: aliceCards.red + bobCards.red,
        is_complete: true, // Mark as complete
        period_number: periodNumber,
        score_spp: scoreSpp,
        score_by_period: scoreByPeriod,
      });

      let failedGoalData: any = null; // Declare in outer scope
      
      if (updatedMatch) {
        console.log('Match completed successfully:', updatedMatch);
        
        // Update goals if user is registered and match has a result
        if (user?.id && result) {
          console.log('🎯 Updating goals after match completion...');
          try {
            const goalResult = await goalService.updateGoalsAfterMatch(
              user.id,
              result as 'win' | 'loss',
              finalScore,
              touchesAgainst
            );
            console.log('✅ Goals updated successfully:', goalResult);
            
            // Store failed goal info to pass through navigation
            if (goalResult.failedGoals && goalResult.failedGoals.length > 0) {
              failedGoalData = goalResult.failedGoals[0];
            }
          } catch (goalError) {
            console.error('❌ Error updating goals:', goalError);
          }
        }
      }

      // 2. End the current period
      await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
        end_time: new Date().toISOString(),
        fencer_1_score: aliceScore,
        fencer_2_score: bobScore,
        fencer_1_cards: aliceCards.yellow + aliceCards.red,
        fencer_2_cards: bobCards.yellow + bobCards.red,
        timestamp: new Date().toISOString(), // Update timestamp when period is completed
      });

      // 3. Match completion is tracked by is_complete in match table

      console.log('Match completion process finished');
      
      // 4. Navigate to appropriate match summary based on user toggle
      if (user?.id && showUserProfile) {
        // User is registered AND toggle is on - go to regular match summary
        const navParams: any = {
          matchId: currentMatchPeriod.match_id,
          remoteId: remoteSession.remote_id,
          // Pass current match state for display
          aliceScore: aliceScore.toString(),
          bobScore: bobScore.toString(),
          aliceCards: JSON.stringify(aliceCards),
          bobCards: JSON.stringify(bobCards),
          matchDuration: matchDuration.toString(),
          result: result || '',
          fencer1Name: fencerNames.alice,
          fencer2Name: fencerNames.bob,
        };
        
        // Pass failed goal info if any
        if (failedGoalData) {
          navParams.failedGoalTitle = failedGoalData.title;
          navParams.failedGoalReason = failedGoalData.reason;
        }
        
        router.push({
          pathname: '/match-summary',
          params: navParams
        });
      } else {
        // User toggle is off OR no registered user - go to neutral match summary
        router.push({
          pathname: '/neutral-match-summary',
          params: {
            matchId: currentMatchPeriod.match_id,
            remoteId: remoteSession.remote_id,
            // Pass current match state for display
            aliceScore: aliceScore.toString(),
            bobScore: bobScore.toString(),
            aliceCards: JSON.stringify(aliceCards),
            bobCards: JSON.stringify(bobCards),
            matchDuration: matchDuration.toString(),
            result: result || '',
            fencer1Name: fencerNames.alice,
            fencer2Name: fencerNames.bob,
          }
        });
      }

      // 5. Reset the remote to clean state after completion
      // The match data is now saved in the database and accessible elsewhere
      setCurrentMatchPeriod(null);
      setRemoteSession(null);
      setAliceScore(0);
      setBobScore(0);
      setAliceCards({ yellow: 0, red: 0 });
      setBobCards({ yellow: 0, red: 0 });
      setCurrentPeriod(1);
          setTimeRemaining(matchTime);
    setIsPlaying(false);
    setPriorityFencer(null);
    setPriorityLightPosition(null);
      setIsAssigningPriority(false);
      setIsInjuryTimer(false);
      setIsBreakTime(false);
      setScoreChangeCount(0);
      setShowScoreWarning(false);
      setPendingScoreAction(null);
      setPreviousMatchState(null);
      setIsManualReset(false);
      setLastEventTime(null); // Reset event timing
      
      // Save completed match state instead of clearing it
      const completedMatchState = {
        aliceScore,
        bobScore,
        currentPeriod,
        matchTime,
        period1Time,
        period2Time,
        period3Time,
        fencerNames,
        isCompleted: true, // Mark as completed
        savedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem('ongoing_match_state', JSON.stringify(completedMatchState));
      setHasNavigatedAway(false); // Reset navigation flag
      console.log('💾 Saved completed match state for potential resume');
      
    } catch (error) {
      console.error('Error completing match:', error);
    }
  };

  const [showEditNamesPopup, setShowEditNamesPopup] = useState(false);
    const [editAliceName, setEditAliceName] = useState('');
  const [editBobName, setEditBobName] = useState('');
  const [scoreChangeCount, setScoreChangeCount] = useState(0);
  const [showScoreWarning, setShowScoreWarning] = useState(false);
  const [pendingScoreAction, setPendingScoreAction] = useState<(() => void) | null>(null);
 
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds

  const [pulseOpacity, setPulseOpacity] = useState(1); // For pulsing animation
  const [isBreakTime, setIsBreakTime] = useState(false); // For break timer
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(60); // 1 minute break
  const [breakTimerRef, setBreakTimerRef] = useState<number | null>(null); // Break timer reference
  const [isManualReset, setIsManualReset] = useState(false); // Flag to prevent auto-sync during manual reset
  const [hasMatchStarted, setHasMatchStarted] = useState(false); // Track if match has been started
  const [isAssigningPriority, setIsAssigningPriority] = useState(false); // Track if priority is being assigned
  const [isChangingScore, setIsChangingScore] = useState(false); // Flag to prevent state restoration during score changes
  const [hasNavigatedAway, setHasNavigatedAway] = useState(false); // Flag to track if user has navigated away
  const [priorityLightPosition, setPriorityLightPosition] = useState<'left' | 'right' | null>(null); // Track where priority light is
  const [priorityFencer, setPriorityFencer] = useState<'alice' | 'bob' | null>(null); // Track which fencer has priority

  // Mirror hasNavigatedAway into a ref to avoid stale closures
  const hasNavigatedAwayRef = useRef(hasNavigatedAway);
  useEffect(() => { hasNavigatedAwayRef.current = hasNavigatedAway; }, [hasNavigatedAway]);

  // Prevent double prompts
  const resumePromptShownRef = useRef(false);
  // Track if user is actively using the app (to prevent resume prompts during normal interaction)
  const isActivelyUsingAppRef = useRef(false);
  const [showPriorityPopup, setShowPriorityPopup] = useState(false); // Track if priority popup should be shown
  const [aliceYellowCards, setAliceYellowCards] = useState<number[]>([]); // Track Alice's yellow cards
  const [bobYellowCards, setBobYellowCards] = useState<number[]>([]); // Track Bob's yellow cards
  const [aliceRedCards, setAliceRedCards] = useState<number[]>([]); // Track Alice's red cards
  const [bobRedCards, setBobRedCards] = useState<number[]>([]); // Track Bob's red cards
  const [isInjuryTimer, setIsInjuryTimer] = useState(false); // Track if injury timer is active
  const [injuryTimeRemaining, setInjuryTimeRemaining] = useState(300); // 5 minutes in seconds
  const [injuryTimerRef, setInjuryTimerRef] = useState<number | null>(null); // Injury timer reference
  const [previousMatchState, setPreviousMatchState] = useState<{
    timeRemaining: number;
    wasPlaying: boolean;
  } | null>(null);

  // NEW CLEAN CARD SYSTEM - Simple state structure
  const [aliceCards, setAliceCards] = useState<{ yellow: 0 | 1; red: number }>({ yellow: 0, red: 0 });
  const [bobCards, setBobCards] = useState<{ yellow: 0 | 1; red: number }>({ yellow: 0, red: 0 });

  // Use useRef for timer to ensure proper cleanup
  const timerRef = useRef<number | null>(null);
  const currentPeriodRef = useRef<number>(1); // Ref to track current period value

  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Profile emojis for fencer cards
  const [aliceProfileEmoji, setAliceProfileEmoji] = useState('👩');
  const [bobProfileEmoji, setBobProfileEmoji] = useState('👨');

  const [toggleCardPosition, setToggleCardPosition] = useState<'left' | 'right'>('left'); // Track which card has the toggle

  // Match History Logging
  const [matchHistory, setMatchHistory] = useState<Array<{
    type: 'score' | 'card';
    fencer: 'alice' | 'bob';
    action: 'increase' | 'decrease' | 'yellow' | 'red';
    timestamp: number; // Time elapsed in match
    score: number; // Score after the change (for score events)
    cards: { alice: number; bob: number }; // Card state after change (for card events)
    period: number;
  }>>([]);

  // Logging function for match events
  const logMatchEvent = (
    type: 'score' | 'card',
    fencer: 'alice' | 'bob', 
    action: 'increase' | 'decrease' | 'yellow' | 'red'
  ) => {
    const newEntry = {
      type,
      fencer,
      action,
      timestamp: matchTime - timeRemaining,
      score: aliceScore + bobScore, // Total match score
      cards: {
        alice: aliceCards.yellow + aliceCards.red,
        bob: bobCards.yellow + bobCards.red
      },
      period: currentPeriod
    };
    
    setMatchHistory(prev => [...prev, newEntry]);
    console.log(`Match Event Logged: ${fencer} ${action} at ${formatTime(newEntry.timestamp)} (Period ${currentPeriod})`);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (breakTimerRef) {
        clearInterval(breakTimerRef);
      }
      if (injuryTimerRef) {
        clearInterval(injuryTimerRef);
      }
    };
  }, [breakTimerRef, injuryTimerRef]);

  // Sync timeRemaining with matchTime when matchTime changes
  useEffect(() => {
    if (!isManualReset) {
      setTimeRemaining(matchTime);
    }
  }, [matchTime, isManualReset]);

  // Pause timer when component loses focus (app goes to background)
  useEffect(() => {
    const handleAppStateChange = () => {
      if (isPlaying && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setIsPlaying(false);
      }
    };

    // Add event listener for app state changes
    // Note: In React Native, you might want to use AppState from react-native
    // For now, we'll handle this in the cleanup effect
    
    return () => {
      handleAppStateChange();
    };
  }, [isPlaying]);

  // Note: No need to restore match data when returning to remote
  // Completed matches are saved in database and accessible elsewhere
  // Remote should always start fresh for new matches

  // Add a function to handle app state changes
  const handleAppStateChange = useCallback((nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      if (isPlaying && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setIsPlaying(false);
      }
    }
  }, [isPlaying]);

  // Pulsing animation effect for low time
  useEffect(() => {
    if (timeRemaining <= 30 && timeRemaining > 0) {
      const interval = setInterval(() => {
        setPulseOpacity(prev => prev === 1 ? 0.5 : 1);
      }, 500);
      
      return () => clearInterval(interval);
    } else {
      setPulseOpacity(1);
    }
  }, [timeRemaining]);

  // Note: Removed conflicting useFocusEffect that was resetting all state

  const incrementPeriod = async () => {
    if (currentPeriod < 3) {
      const newPeriod = currentPeriod + 1;
      
      // End the current period if it exists
      if (currentMatchPeriod) {
        console.log('🏁 Ending current period:', currentPeriod);
        await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
          end_time: new Date().toISOString(),
          fencer_1_score: aliceScore,
          fencer_2_score: bobScore,
          fencer_1_cards: aliceCards.yellow + aliceCards.red,
          fencer_2_cards: bobCards.yellow + bobCards.red,
        });
        
        // Create new period record for the next period
        console.log('🆕 Creating new period:', newPeriod);
        const periodData = {
          match_id: currentMatchPeriod.match_id,
          period_number: newPeriod,
          start_time: new Date().toISOString(),
          fencer_1_score: aliceScore, // Carry over current scores
          fencer_2_score: bobScore,
          fencer_1_cards: aliceCards.yellow + aliceCards.red,
          fencer_2_cards: bobCards.yellow + bobCards.red,
          priority_assigned: priorityFencer || undefined,
          priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
        };
        
        const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
        if (newPeriodRecord) {
          console.log('✅ New period created successfully:', newPeriodRecord);
          setCurrentMatchPeriod(newPeriodRecord);
        }
      }
      
      setCurrentPeriod(newPeriod);
      currentPeriodRef.current = newPeriod; // Update ref
    }
  };

  const decrementPeriod = async () => {
    if (currentPeriod > 1) {
      const newPeriod = currentPeriod - 1;
      
      // Note: Decrementing period is unusual in a real match, but we'll support it
      // We need to find the previous period record
      if (currentMatchPeriod) {
        const { data: previousPeriod } = await supabase
          .from('match_period')
          .select('*')
          .eq('match_id', currentMatchPeriod.match_id)
          .eq('period_number', newPeriod)
          .single();
        
        if (previousPeriod) {
          setCurrentMatchPeriod(previousPeriod);
        }
      }
      
      setCurrentPeriod(newPeriod);
      currentPeriodRef.current = newPeriod; // Update ref
    }
  };

  const incrementAliceScore = async () => {
    setIsChangingScore(true);
    setHasNavigatedAway(false); // Reset navigation flag when changing scores
    isActivelyUsingAppRef.current = true; // Mark that user is actively using the app
    
    // Prevent score changes if match is being completed
    if (isCompletingMatch) {
      console.log('🚫 Score change blocked - match is being completed');
      setIsChangingScore(false);
      return;
    }
    
    // Ensure remote session exists (create if first score)
    const session = await ensureRemoteSession();
    
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => async () => {
          const newAliceScore = aliceScore + 1;
          setAliceScore(newAliceScore);
          setScoreChangeCount(0); // Reset counter
          
          // Check if Alice reached 15 points (match should end)
          if (newAliceScore >= 15) {
            console.log('🏁 Alice reached 15 points - match should end');
            setIsCompletingMatch(true);
          }
          
          // Create match event for the score - determine if Alice is user or opponent
          const aliceIsUser = showUserProfile && toggleCardPosition === 'left';
          await createMatchEvent(aliceIsUser ? 'user' : 'opponent', undefined, newAliceScore, undefined);
          
          // Pause timer if it's currently running
          if (isPlaying) {
            pauseTimer();
          }
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      const newAliceScore = aliceScore + 1;
      setAliceScore(newAliceScore);
      
      // Update remote session scores
      if (remoteSession) {
        await fencingRemoteService.updateRemoteScores(remoteSession.remote_id, newAliceScore, bobScore);
      }
      
      logMatchEvent('score', 'alice', 'increase'); // Log the score increase
      
      // Check if Alice reached 15 points (match should end)
      if (newAliceScore >= 15) {
        console.log('🏁 Alice reached 15 points - match should end');
        setIsCompletingMatch(true);
      }
      
      // Create match event for the score - determine if Alice is user or opponent
      const aliceIsUser = showUserProfile && toggleCardPosition === 'left';
      await createMatchEvent(aliceIsUser ? 'user' : 'opponent', undefined, newAliceScore, undefined);
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      const newAliceScore = aliceScore + 1;
      setAliceScore(newAliceScore);
      
      // Update remote session scores
      if (remoteSession) {
        await fencingRemoteService.updateRemoteScores(remoteSession.remote_id, newAliceScore, bobScore);
      }
      
      logMatchEvent('score', 'alice', 'increase'); // Log the score increase
      setScoreChangeCount(0); // Reset counter for new match
      
      // Check if Alice reached 15 points (match should end)
      if (newAliceScore >= 15) {
        console.log('🏁 Alice reached 15 points - match should end');
        setIsCompletingMatch(true);
      }
      
      // Create match event for the score - determine if Alice is user or opponent
      const aliceIsUser = showUserProfile && toggleCardPosition === 'left';
      await createMatchEvent(aliceIsUser ? 'user' : 'opponent', undefined, newAliceScore, undefined);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => setIsChangingScore(false), 100);
  };
  
  const decrementAliceScore = () => {
    setIsChangingScore(true);
    setHasNavigatedAway(false); // Reset navigation flag when changing scores
    isActivelyUsingAppRef.current = true; // Mark that user is actively using the app
    
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setAliceScore(Math.max(0, aliceScore - 1));
          setScoreChangeCount(0); // Reset counter
          setIsChangingScore(false);
          
          // Pause timer if it's currently running
          if (isPlaying) {
            pauseTimer();
          }
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setAliceScore(Math.max(0, aliceScore - 1));
      logMatchEvent('score', 'alice', 'decrease'); // Log the score decrease
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      setAliceScore(Math.max(0, aliceScore - 1));
      logMatchEvent('score', 'alice', 'decrease'); // Log the score decrease
      setScoreChangeCount(0); // Reset counter for new match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => setIsChangingScore(false), 100);
  };
  
  const incrementBobScore = async () => {
    setIsChangingScore(true);
    setHasNavigatedAway(false); // Reset navigation flag when changing scores
    isActivelyUsingAppRef.current = true; // Mark that user is actively using the app
    
    // Prevent score changes if match is being completed
    if (isCompletingMatch) {
      console.log('🚫 Score change blocked - match is being completed');
      setIsChangingScore(false);
      return;
    }
    
    // Ensure remote session exists (create if first score)
    const session = await ensureRemoteSession();
    
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => async () => {
          const newBobScore = bobScore + 1;
          setBobScore(newBobScore);
          setScoreChangeCount(0); // Reset counter
          
          // Check if Bob reached 15 points (match should end)
          if (newBobScore >= 15) {
            console.log('🏁 Bob reached 15 points - match should end');
            setIsCompletingMatch(true);
          }
          
          // Create match event for the score - determine if Bob is user or opponent
          const bobIsUser = showUserProfile && toggleCardPosition === 'right';
          await createMatchEvent(bobIsUser ? 'user' : 'opponent', undefined, undefined, newBobScore);
          
          // Pause timer if it's currently running
          if (isPlaying) {
            pauseTimer();
          }
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      const newBobScore = bobScore + 1;
      setBobScore(newBobScore);
      
      // Update remote session scores
      if (remoteSession) {
        await fencingRemoteService.updateRemoteScores(remoteSession.remote_id, aliceScore, newBobScore);
      }
      
      logMatchEvent('score', 'bob', 'increase'); // Log the score increase
      
      // Check if Bob reached 15 points (match should end)
      if (newBobScore >= 15) {
        console.log('🏁 Bob reached 15 points - match should end');
        setIsCompletingMatch(true);
      }
      
      // Create match event for the score - determine if Bob is user or opponent
      const bobIsUser = showUserProfile && toggleCardPosition === 'right';
      await createMatchEvent(bobIsUser ? 'user' : 'opponent', undefined, undefined, newBobScore);
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      const newBobScore = bobScore + 1;
      setBobScore(newBobScore);
      
      // Update remote session scores
      if (remoteSession) {
        await fencingRemoteService.updateRemoteScores(remoteSession.remote_id, aliceScore, newBobScore);
      }
      
      logMatchEvent('score', 'bob', 'increase'); // Log the score increase
      setScoreChangeCount(0); // Reset counter for new match
      
      // Check if Bob reached 15 points (match should end)
      if (newBobScore >= 15) {
        console.log('🏁 Bob reached 15 points - match should end');
        setIsCompletingMatch(true);
      }
      
      // Create match event for the score - determine if Bob is user or opponent
      const bobIsUser = showUserProfile && toggleCardPosition === 'right';
      await createMatchEvent(bobIsUser ? 'user' : 'opponent', undefined, undefined, newBobScore);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => setIsChangingScore(false), 100);
  };
  
  const decrementBobScore = () => {
    setIsChangingScore(true);
    setHasNavigatedAway(false); // Reset navigation flag when changing scores
    isActivelyUsingAppRef.current = true; // Mark that user is actively using the app
    
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setBobScore(Math.max(0, bobScore - 1));
          setScoreChangeCount(0); // Reset counter
          setIsChangingScore(false);
          
          // Pause timer if it's currently running
          if (isPlaying) {
            pauseTimer();
          }
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setBobScore(Math.max(0, bobScore - 1));
      logMatchEvent('score', 'bob', 'decrease'); // Log the score decrease
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      setBobScore(Math.max(0, bobScore - 1));
      logMatchEvent('score', 'bob', 'decrease'); // Log the score decrease
      setScoreChangeCount(0); // Reset counter for new match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => setIsChangingScore(false), 100);
  };

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pauseTimer();
    } else {
      // Record the exact time when Play is clicked
      const playClickTime = new Date().toISOString();
      console.log('🎮 Play button clicked at:', playClickTime);
      
      // Set match start time if this is the first time starting
      if (!matchStartTime) {
        setMatchStartTime(new Date());
        console.log('🕐 Match start time set to:', new Date().toISOString());
      }
      
      // Ensure match completion flag is reset when starting
      setIsCompletingMatch(false);
      
      // Mark that user is actively using the app
      isActivelyUsingAppRef.current = true;
      
      // Create remote session when starting timer
      const session = await ensureRemoteSession();
      if (!session) {
        console.log('❌ Failed to create remote session - cannot start match');
        return;
      }
      
      // Create match period only if one doesn't already exist (first time starting match)
      if (!currentMatchPeriod) {
        console.log('🆕 Creating new match period (first time starting match)');
        await createMatchPeriod(session, playClickTime);
      } else {
        console.log('⏯️ Match period already exists, resuming match');
      }
      startTimer();
      setScoreChangeCount(0); // Reset score change counter when starting timer
    }
  }, [isPlaying, timeRemaining, matchTime, ensureRemoteSession, createMatchPeriod, currentMatchPeriod, matchStartTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditTime = () => {
    if (isPlaying) {
      Alert.alert(
        'Timer Running',
        'Cannot edit timer while it is running. Please pause or stop the timer first.',
        [{ text: 'OK' }]
      );
      return;
    }
    setEditTimeInput(formatTime(matchTime));
    setShowEditPopup(true);
  };

  const handleSaveTime = () => {
    const [minutes, seconds] = editTimeInput.split(':').map(Number);
    if (!isNaN(minutes) && !isNaN(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
      const totalSeconds = minutes * 60 + seconds;
      if (totalSeconds <= 599) { // Max 9:59
        setMatchTime(totalSeconds);
        // Only update timeRemaining if timer is not currently playing
        if (!isPlaying) {
          setTimeRemaining(totalSeconds);
        }
        setShowEditPopup(false);
        setEditTimeInput('');
      }
    }
  };

  const resetScores = useCallback(() => {
    setAliceScore(0);
    setBobScore(0);
    setHasNavigatedAway(false); // Reset navigation flag
    logMatchEvent('score', 'alice', 'decrease'); // Log score reset
    logMatchEvent('score', 'bob', 'decrease'); // Log score reset
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const resetPeriod = useCallback(() => {
    setCurrentPeriod(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const resetTime = useCallback(() => {
    // Stop timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setHasMatchStarted(false); // Reset match started state
    // Reset only the timer, keep current period
    setMatchTime(180); // 3 minutes in seconds
    setTimeRemaining(180); // Same as matchTime = no paused state
    setPriorityLightPosition(null); // Reset priority light
    setPriorityFencer(null); // Reset priority fencer
    setShowPriorityPopup(false); // Reset priority popup
    setAliceYellowCards([]); // Reset Alice's yellow cards
    setBobYellowCards([]); // Reset Bob's yellow cards
    setAliceRedCards([]); // Reset Alice's red cards
    setBobRedCards([]); // Reset Bob's red cards
    
    // Reset the new card state structure
    setAliceCards({ yellow: 0, red: 0 }); // Reset Alice's new card state
    setBobCards({ yellow: 0, red: 0 }); // Reset Bob's new card state
    
    // Reset injury timer state
    setIsInjuryTimer(false);
    setInjuryTimeRemaining(300);
    if (injuryTimerRef) {
      clearInterval(injuryTimerRef);
      setInjuryTimerRef(null);
    }
    
    setScoreChangeCount(0); // Reset score change counter
    setShowScoreWarning(false); // Reset warning popup
    setPendingScoreAction(null); // Reset pending action
    setPreviousMatchState(null); // Reset previous match state
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsManualReset(true); // Set flag to prevent auto-sync
  }, []);

  const resetAll = useCallback(async () => {
    try {
      console.log('🔄 Starting Reset All - cleaning up database records...');
      setIsCompletingMatch(false); // Reset the completion flag
      isActivelyUsingAppRef.current = false; // Reset active usage flag
      console.log('🔍 Current state:', { 
        currentMatchPeriod: currentMatchPeriod ? 'exists' : 'null',
        remoteSession: remoteSession ? 'exists' : 'null',
        matchId: currentMatchPeriod?.match_id,
        remoteId: remoteSession?.remote_id
      });
      
      // 1. Clean up database records first
      if (currentMatchPeriod && remoteSession) {
        console.log('🗑️ Deleting match and related records...');
        
        // Delete the match and all related records
        const matchDeleted = await matchService.deleteMatch(currentMatchPeriod.match_id, remoteSession.remote_id);
        if (matchDeleted) {
          console.log('✅ Match and related records deleted successfully');
        } else {
          console.error('❌ Failed to delete match records');
        }
        
        // Delete the remote session
        const sessionDeleted = await fencingRemoteService.deleteRemoteSession(remoteSession.remote_id);
        if (sessionDeleted) {
          console.log('✅ Remote session deleted successfully');
        } else {
          console.error('❌ Failed to delete remote session');
        }
        
        // Clear the current match period and remote session state
        setCurrentMatchPeriod(null);
        setRemoteSession(null);
      } else {
        console.log('⚠️ No active match to clean up - currentMatchPeriod or remoteSession is null');
        console.log('🔍 Debug info:', {
          currentMatchPeriod: currentMatchPeriod,
          remoteSession: remoteSession
        });
        
        // Even if no active session, try to clean up any incomplete records
        console.log('🧹 Attempting to clean up any incomplete records...');
        try {
          // Find incomplete matches (no timestamp filter since created_at doesn't exist)
          const { data: incompleteMatches, error: recentError } = await supabase
            .from('match')
            .select('match_id, is_complete')
            .eq('is_complete', false);
          
          if (recentError) {
            console.error('❌ Error finding incomplete matches:', recentError);
          } else if (incompleteMatches && incompleteMatches.length > 0) {
            console.log('🗑️ Found incomplete matches:', incompleteMatches.length);
            // Delete these incomplete matches and their related records
            for (const match of incompleteMatches) {
              await matchService.deleteMatch(match.match_id);
            }
            console.log('✅ Cleaned up incomplete matches');
          } else {
            console.log('✅ No incomplete matches found');
          }
        } catch (error) {
          console.error('❌ Error during incomplete records cleanup:', error);
        }
      }
      
      // 3. Clean up any orphaned records (match_period, match_event, fencing_remote)
      console.log('🧹 Running comprehensive orphaned records cleanup...');
      try {
        // Clean up orphaned match_period records
        const { data: allPeriods, error: periodsError } = await supabase
          .from('match_period')
          .select('match_period_id, match_id');
        
        if (periodsError) {
          console.error('❌ Error fetching match periods:', periodsError);
        } else if (allPeriods && allPeriods.length > 0) {
          const { data: existingMatches, error: matchesError } = await supabase
            .from('match')
            .select('match_id');
          
          if (matchesError) {
            console.error('❌ Error fetching existing matches:', matchesError);
          } else {
            const existingMatchIds = new Set(existingMatches?.map(m => m.match_id) || []);
            const orphanedPeriods = allPeriods.filter(period => !existingMatchIds.has(period.match_id));
            
            if (orphanedPeriods.length > 0) {
              console.log('🗑️ Found orphaned match_period records:', orphanedPeriods.length);
              const { error: deleteError } = await supabase
                .from('match_period')
                .delete()
                .in('match_period_id', orphanedPeriods.map(p => p.match_period_id));
              
              if (deleteError) {
                console.error('❌ Error deleting orphaned periods:', deleteError);
              } else {
                console.log('✅ Cleaned up orphaned match_period records');
              }
            } else {
              console.log('✅ No orphaned match_period records found');
            }
          }
        }

        // Clean up orphaned match_event records (those without valid match_id or fencing_remote_id)
        const { data: allEvents, error: eventsError } = await supabase
          .from('match_event')
          .select('match_event_id, match_id, fencing_remote_id');
        
        if (eventsError) {
          console.error('❌ Error fetching match events:', eventsError);
        } else if (allEvents && allEvents.length > 0) {
          // Get all existing match_ids and fencing_remote_ids
          const { data: existingMatches } = await supabase.from('match').select('match_id');
          const { data: existingRemotes } = await supabase.from('fencing_remote').select('remote_id');
          
          const existingMatchIds = new Set(existingMatches?.map(m => m.match_id) || []);
          const existingRemoteIds = new Set(existingRemotes?.map(r => r.remote_id) || []);
          
          // Find orphaned events (events with match_id or fencing_remote_id not in their respective tables)
          const orphanedEvents = allEvents.filter(event => 
            (event.match_id && !existingMatchIds.has(event.match_id)) ||
            (event.fencing_remote_id && !existingRemoteIds.has(event.fencing_remote_id))
          );
          
          if (orphanedEvents.length > 0) {
            console.log('🗑️ Found orphaned match_event records:', orphanedEvents.length);
            const { error: deleteError } = await supabase
              .from('match_event')
              .delete()
              .in('match_event_id', orphanedEvents.map(e => e.match_event_id));
            
            if (deleteError) {
              console.error('❌ Error deleting orphaned events:', deleteError);
            } else {
              console.log('✅ Cleaned up orphaned match_event records');
            }
          } else {
            console.log('✅ No orphaned match_event records found');
          }
        }

        // Clean up orphaned fencing_remote records (those without linked matches)
        const { data: allRemotes, error: remotesError } = await supabase
          .from('fencing_remote')
          .select('remote_id, linked_match_id');
        
        if (remotesError) {
          console.error('❌ Error fetching fencing_remote records:', remotesError);
        } else if (allRemotes && allRemotes.length > 0) {
          const { data: existingMatches } = await supabase.from('match').select('match_id');
          const existingMatchIds = new Set(existingMatches?.map(m => m.match_id) || []);
          
          // Find orphaned remotes (remotes with linked_match_id not in match table)
          const orphanedRemotes = allRemotes.filter(remote => 
            remote.linked_match_id && !existingMatchIds.has(remote.linked_match_id)
          );
          
          if (orphanedRemotes.length > 0) {
            console.log('🗑️ Found orphaned fencing_remote records:', orphanedRemotes.length);
            const { error: deleteError } = await supabase
              .from('fencing_remote')
              .delete()
              .in('remote_id', orphanedRemotes.map(r => r.remote_id));
            
            if (deleteError) {
              console.error('❌ Error deleting orphaned remotes:', deleteError);
            } else {
              console.log('✅ Cleaned up orphaned fencing_remote records');
            }
          } else {
            console.log('✅ No orphaned fencing_remote records found');
          }
        }
        
      } catch (error) {
        console.error('❌ Error during comprehensive cleanup:', error);
      }
      
      // 2. Stop all timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (breakTimerRef) {
      clearInterval(breakTimerRef);
    }
      if (injuryTimerRef) {
        clearInterval(injuryTimerRef);
        setInjuryTimerRef(null);
      }
      
      // 3. Reset all UI state
    setIsPlaying(false);
    setHasMatchStarted(false); // Reset match started state
    setCurrentPeriod(1); // Reset to period 1
    currentPeriodRef.current = 1; // Reset ref
    setMatchTime(180); // 3 minutes in seconds
    setTimeRemaining(180); // Same as matchTime = no paused state
    setAliceScore(0); // Reset scores
    setBobScore(0);
    setIsBreakTime(false); // Reset break state
    setBreakTimeRemaining(60); // Reset break timer
    setScoreChangeCount(0); // Reset score change counter
    setShowScoreWarning(false); // Reset warning popup
    setHasNavigatedAway(false); // Reset navigation flag
      setLastEventTime(null); // Reset event timing
    setPendingScoreAction(null); // Reset pending action
    setPreviousMatchState(null); // Reset previous match state

    setPriorityLightPosition(null); // Reset priority light
    setPriorityFencer(null); // Reset priority fencer
    setShowPriorityPopup(false); // Reset priority popup
    setAliceYellowCards([]); // Reset Alice's yellow cards
    setBobYellowCards([]); // Reset Bob's yellow cards
    setAliceRedCards([]); // Reset Alice's red cards
    setBobRedCards([]); // Reset Bob's red cards
    
    // Reset the new card state structure
    setAliceCards({ yellow: 0, red: 0 }); // Reset Alice's new card state
    setBobCards({ yellow: 0, red: 0 }); // Reset Bob's new card state
    
    // Reset injury timer state
    setIsInjuryTimer(false);
    setInjuryTimeRemaining(300);
    
      console.log('✅ Reset All completed successfully');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsManualReset(true); // Set flag to prevent auto-sync
      
    } catch (error) {
      console.error('❌ Error during Reset All:', error);
      // Still reset UI state even if database cleanup fails
      // ... (fallback UI reset logic could go here)
    }
  }, [breakTimerRef, currentMatchPeriod, remoteSession]);

  const swapFencers = useCallback(() => {
    if (isSwapping) return; // Prevent multiple swaps during animation
    
    setIsSwapping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Swap all fencer data
    const tempAliceScore = aliceScore;
    const tempBobScore = bobScore;
    const tempAliceName = fencerNames.alice;
    const tempBobName = fencerNames.bob;
    const tempAliceYellowCards = aliceYellowCards;
    const tempBobYellowCards = bobYellowCards;
    const tempAliceRedCards = aliceRedCards;
    const tempBobRedCards = bobRedCards;
    const tempAliceCards = aliceCards;
    const tempBobCards = bobCards;
    const tempAliceEmoji = aliceProfileEmoji;
    const tempBobEmoji = bobProfileEmoji;
    
    // Animate the swap
    setTimeout(() => {
      // Swap scores
      setAliceScore(tempBobScore);
      setBobScore(tempAliceScore);
      
      // Swap names
      setFencerNames({
        alice: tempBobName,
        bob: tempAliceName
      });
      
      // Swap emojis
      setAliceProfileEmoji(tempBobEmoji);
      setBobProfileEmoji(tempAliceEmoji);
      
      // Swap cards
      setAliceYellowCards(tempBobYellowCards);
      setBobYellowCards(tempAliceYellowCards);
      setAliceRedCards(tempBobRedCards);
      setBobRedCards(tempAliceRedCards);
      setAliceCards(tempBobCards);
      setBobCards(tempAliceCards);
      
      // Swap positions
      setFencerPositions(prev => ({
        alice: prev.alice === 'left' ? 'right' : 'left',
        bob: prev.bob === 'left' ? 'right' : 'left'
      }));
      
      // Swap toggle position
      setToggleCardPosition(prev => prev === 'left' ? 'right' : 'left');
      
      console.log('🔄 Fencers swapped successfully');
      
      // Reset swapping state after animation
      setTimeout(() => {
        setIsSwapping(false);
      }, 300);
    }, 150);
  }, [isSwapping, aliceScore, bobScore, fencerNames, aliceYellowCards, bobYellowCards, aliceRedCards, bobRedCards, aliceCards, bobCards, aliceProfileEmoji, bobProfileEmoji, toggleCardPosition]);

  const toggleUserProfile = useCallback(() => {
    setShowUserProfile(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const openEditNamesPopup = useCallback(() => {
    // Auto-fill user's name when toggle is on, based on card position
    if (showUserProfile) {
      if (toggleCardPosition === 'left') {
        setEditAliceName(userDisplayName); // User is on the left (Alice)
        setEditBobName(fencerNames.bob);
      } else {
        setEditAliceName(fencerNames.alice);
        setEditBobName(userDisplayName); // User is on the right (Bob)
      }
    } else {
    setEditAliceName(fencerNames.alice);
    setEditBobName(fencerNames.bob);
    }
    setShowEditNamesPopup(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [fencerNames, showUserProfile, userDisplayName, toggleCardPosition]);

  const handleFencerNameClick = useCallback((fencer: 'alice' | 'bob') => {
    // Don't allow editing if user profile is shown and this is the user's position
    if (showUserProfile) {
      if ((fencer === 'alice' && toggleCardPosition === 'left') || 
          (fencer === 'bob' && toggleCardPosition === 'right')) {
        // This is the user's name, don't allow editing
        return;
      }
    }
    
    // Open the edit names popup
    openEditNamesPopup();
  }, [showUserProfile, toggleCardPosition, openEditNamesPopup]);

  const saveFencerName = useCallback(() => {
    if (editAliceName.trim() && editBobName.trim()) {
      // Preserve user's name when toggle is on, based on card position
      if (showUserProfile) {
        if (toggleCardPosition === 'left') {
          setFencerNames({
            alice: userDisplayName, // Keep user's name on left
            bob: editBobName.trim() // Save opponent's name on right
          });
        } else {
          setFencerNames({
            alice: editAliceName.trim(), // Save opponent's name on left
            bob: userDisplayName // Keep user's name on right
          });
        }
      } else {
      setFencerNames({
        alice: editAliceName.trim(),
        bob: editBobName.trim()
      });
      }
      setShowEditNamesPopup(false);
      setEditAliceName('');
      setEditBobName('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [editAliceName, editBobName, showUserProfile, userDisplayName, toggleCardPosition]);

  const cancelEditName = useCallback(() => {
    setShowEditNamesPopup(false);
    setEditAliceName('');
    setEditBobName('');
  }, []);

  const resetTimer = useCallback(() => {
    // If timer is running, pause it first
    if (isPlaying) {
      pauseTimer();
    }
    // Show custom reset options popup
    setShowResetPopup(true);
  }, [isPlaying]);

  const resetToOriginalTime = useCallback(() => {
    // Reset timer to original match time
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setTimeRemaining(matchTime);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [matchTime]);

  const pauseTimer = useCallback(() => {
    if (isPlaying && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsPlaying(false);
      
      // Track pause start time
      setPauseStartTime(new Date());
      
      // Don't reset score change counter when pausing - keep tracking for the current match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isPlaying]);

  const startTimer = useCallback(() => {
    setIsPlaying(true);
    setHasMatchStarted(true); // Mark that match has been started
    setScoreChangeCount(0); // Reset score change counter when starting
    setHasNavigatedAway(false); // Reset navigation flag when starting match
    
    // If resuming from pause, add the paused time to total
    if (pauseStartTime) {
      const pausedDuration = Date.now() - pauseStartTime.getTime();
      setTotalPausedTime(prev => prev + pausedDuration);
      setPauseStartTime(null);
      console.log('⏸️ Resuming from pause, added', pausedDuration, 'ms to total paused time');
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const startTime = Date.now();
    const initialTime = timeRemaining;
    
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const newTimeRemaining = Math.max(0, initialTime - elapsed);
      
      setTimeRemaining(newTimeRemaining);
      
      // No need to track total match time during timer - we'll calculate it at the end
      
      // Haptic feedback for low time
      if (newTimeRemaining === 30 || newTimeRemaining === 10) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      
      if (newTimeRemaining <= 0) {
        // Timer finished
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsPlaying(false);
        // Haptic feedback for timer completion
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Get the current period value to avoid stale closure
        const currentPeriodValue = currentPeriodRef.current;
        
        // SIMPLE PERIOD LOGIC - Period 1 and 2 show break popup, Period 3 shows completion
        if (currentPeriodValue === 1 || currentPeriodValue === 2) {
          // Period 1 or 2 - show break popup
          Alert.alert(
            'Match Time Complete!',
            'Would you like to take a 1-minute break?',
            [
              { 
                text: 'No', 
                style: 'cancel',
                onPress: async () => {
                  // Go to next period
                  const nextPeriod = currentPeriodValue + 1;
                  
                  // End current period and create new one
                  if (currentMatchPeriod) {
                    await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
                      end_time: new Date().toISOString(),
                      fencer_1_score: aliceScore,
                      fencer_2_score: bobScore,
                      fencer_1_cards: aliceCards.yellow + aliceCards.red,
                      fencer_2_cards: bobCards.yellow + bobCards.red,
                    });
                    
                    const periodData = {
                      match_id: currentMatchPeriod.match_id,
                      period_number: nextPeriod,
                      start_time: new Date().toISOString(),
                      fencer_1_score: aliceScore,
                      fencer_2_score: bobScore,
                      fencer_1_cards: aliceCards.yellow + aliceCards.red,
                      fencer_2_cards: bobCards.yellow + bobCards.red,
                      priority_assigned: priorityFencer || undefined,
                      priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
                    };
                    
                    const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
                    if (newPeriodRecord) {
                      setCurrentMatchPeriod(newPeriodRecord);
                    }
                  }
                  
                  setCurrentPeriod(nextPeriod);
                  currentPeriodRef.current = nextPeriod; // Update ref
                  setTimeRemaining(matchTime);
                  setIsPlaying(false);
                  
                  
                  // Show next period ready message
                  setTimeout(() => {
                    Alert.alert('Next Round!', `Period ${nextPeriod} ready. Timer set to ${formatTime(matchTime)}.`);
                  }, 100);
                  
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              },
              { 
                text: 'Yes', 
                onPress: () => {
                  startBreakTimer();
                }
              }
            ]
          );
        } else if (currentPeriodValue === 3) {
          // Period 3 - check if scores are tied
          if (aliceScore === bobScore) {
            // Scores are tied - show priority assignment popup
            setShowPriorityPopup(true);
          } else {
            // Scores are not tied - show match completion
            Alert.alert('Match Complete!', 'All periods have been completed. Great job!', [
              { 
                text: 'OK', 
                onPress: () => {
                  setTimeRemaining(0);
                  // Navigate to match summary
                  router.push('/match-summary');
                }
              }
            ]);
          }
        }
      }
    }, 100); // Update more frequently for smoother countdown
  }, [timeRemaining, currentPeriod, matchTime, router]);

  const resumeTimer = useCallback(() => {
    if (!isPlaying && timeRemaining > 0) {
      setIsPlaying(true);
      setHasMatchStarted(true); // Mark that match has been resumed
      setScoreChangeCount(0); // Reset score change counter when resuming
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const startTime = Date.now();
      const initialTime = timeRemaining;
      
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const newTimeRemaining = Math.max(0, initialTime - elapsed);
        
        setTimeRemaining(newTimeRemaining);
        
        // Haptic feedback for low time
        if (newTimeRemaining === 30 || newTimeRemaining === 10) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        
        if (newTimeRemaining <= 0) {
          // Timer finished
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsPlaying(false);
          // Haptic feedback for timer completion
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Get the current period value to avoid stale closure
          const currentPeriodValue = currentPeriodRef.current;
          
          // SIMPLE PERIOD LOGIC - Period 1 and 2 show break popup, Period 3 shows completion
          if (currentPeriodValue === 1 || currentPeriodValue === 2) {
            // Period 1 or 2 - show break popup
            Alert.alert(
              'Match Time Complete!',
              'Would you like to take a 1-minute break?',
              [
                { 
                  text: 'No', 
                  style: 'cancel',
                  onPress: async () => {
                    // Go to next period
                    const nextPeriod = currentPeriodValue + 1;
                    
                    // End current period and create new one
                    if (currentMatchPeriod) {
                      await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
                        end_time: new Date().toISOString(),
                        fencer_1_score: aliceScore,
                        fencer_2_score: bobScore,
                        fencer_1_cards: aliceCards.yellow + aliceCards.red,
                        fencer_2_cards: bobCards.yellow + bobCards.red,
                      });
                      
                      const periodData = {
                        match_id: currentMatchPeriod.match_id,
                        period_number: nextPeriod,
                        start_time: new Date().toISOString(),
                        fencer_1_score: aliceScore,
                        fencer_2_score: bobScore,
                        fencer_1_cards: aliceCards.yellow + aliceCards.red,
                        fencer_2_cards: bobCards.yellow + bobCards.red,
                        priority_assigned: priorityFencer || undefined,
                        priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
                      };
                      
                      const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
                      if (newPeriodRecord) {
                        setCurrentMatchPeriod(newPeriodRecord);
                      }
                    }
                    
                    setCurrentPeriod(nextPeriod);
                    currentPeriodRef.current = nextPeriod; // Update ref
                    setTimeRemaining(matchTime);
                    setIsPlaying(false);
                    
                    
                    // Show next period ready message
                    setTimeout(() => {
                      Alert.alert('Next Round!', `Period ${nextPeriod} ready. Timer set to ${formatTime(matchTime)}.`);
                    }, 100);
                    
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                },
                { 
                  text: 'Yes', 
                  onPress: () => {
                    startBreakTimer();
                  }
                }
              ]
            );
          } else if (currentPeriodValue === 3) {
            // Period 3 - check if scores are tied
            if (aliceScore === bobScore) {
              // Scores are tied - show priority assignment popup
              setShowPriorityPopup(true);
            } else {
              // Scores are not tied - show match completion
              Alert.alert('Match Complete!', 'All periods have been completed. Great job!', [
                { 
                  text: 'OK', 
                  onPress: () => {
                    setTimeRemaining(0);
                    // Navigate to match summary
                    router.push('/match-summary');
                  }
                }
              ]);
            }
          }
        }
      }, 100); // Update more frequently for smoother countdown
    }
  }, [isPlaying, timeRemaining, currentPeriod, matchTime, router]);

  const addTime = useCallback((seconds: number) => {
    if (isPlaying || (!isPlaying && timeRemaining > 0 && timeRemaining < matchTime) || isBreakTime || hasMatchStarted) {
      // When actively playing, paused, during break time, or after match has started, don't allow adding time
      return;
    } else {
      // Only allow adding time when timer is ready (not started yet)
      setTimeRemaining(prev => prev + seconds);
      setMatchTime(prev => prev + seconds);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isPlaying, timeRemaining, matchTime, isBreakTime, hasMatchStarted]);

  const subtractTime = useCallback((seconds: number) => {
    if (isPlaying || (!isPlaying && timeRemaining > 0 && timeRemaining < matchTime) || isBreakTime || hasMatchStarted) {
      // When actively playing, paused, during break time, or after match has started, don't allow subtracting time
      return;
    } else {
      // Only allow subtracting time when timer is ready (not started yet)
      setTimeRemaining(prev => Math.max(0, prev - seconds));
      setMatchTime(prev => Math.max(0, prev - seconds)); // Allow going to 0
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isPlaying, timeRemaining, matchTime, isBreakTime, hasMatchStarted]);

  const startBreakTimer = () => {
    console.log('Starting break timer');
    
    // Set break time state FIRST - this should make the break timer display appear
    setIsBreakTime(true);
    setBreakTimeRemaining(60); // 1 minute
    
    // Stop the main timer completely
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Update other states
    setIsPlaying(false);
    
    // Start the break countdown
    const interval = setInterval(() => {
      setBreakTimeRemaining(prev => {
        if (prev <= 0) {
          // Break finished
          clearInterval(interval);
          setIsBreakTime(false);
          setBreakTimeRemaining(60);
          
          // Increment period and create new period record
          const nextPeriod = Math.min(currentPeriod + 1, 3);
          
          // End current period and create new one
          if (currentMatchPeriod && nextPeriod > currentPeriod) {
            (async () => {
              await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
                end_time: new Date().toISOString(),
                fencer_1_score: aliceScore,
                fencer_2_score: bobScore,
                fencer_1_cards: aliceCards.yellow + aliceCards.red,
                fencer_2_cards: bobCards.yellow + bobCards.red,
              });
              
              const periodData = {
                match_id: currentMatchPeriod.match_id,
                period_number: nextPeriod,
                start_time: new Date().toISOString(),
                fencer_1_score: aliceScore,
                fencer_2_score: bobScore,
                fencer_1_cards: aliceCards.yellow + aliceCards.red,
                fencer_2_cards: bobCards.yellow + bobCards.red,
                priority_assigned: priorityFencer || undefined,
                priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
              };
              
              const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
              if (newPeriodRecord) {
                setCurrentMatchPeriod(newPeriodRecord);
              }
            })();
          }
          
          setCurrentPeriod(nextPeriod);
          currentPeriodRef.current = nextPeriod; // Update ref
          
          
          // Restart main timer from where it was paused
          setIsManualReset(true); // Prevent auto-sync
          setTimeRemaining(matchTime);
          setIsPlaying(false);
          
          // Re-enable auto-sync after a short delay
          setTimeout(() => {
            setIsManualReset(false);
          }, 200);
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Break Complete!', 'Period incremented. Timer ready to continue.');
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    
    setBreakTimerRef(interval);
  };

  const skipBreak = () => {
    // Stop break timer if running
    if (breakTimerRef) {
      clearInterval(breakTimerRef);
    }
    
    // Reset break state
    setIsBreakTime(false);
    setBreakTimeRemaining(60);
    
    // Increment period and create new period record
    const nextPeriod = Math.min(currentPeriod + 1, 3);
    
    // End current period and create new one
    if (currentMatchPeriod && nextPeriod > currentPeriod) {
      (async () => {
        await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
          end_time: new Date().toISOString(),
          fencer_1_score: aliceScore,
          fencer_2_score: bobScore,
          fencer_1_cards: aliceCards.yellow + aliceCards.red,
          fencer_2_cards: bobCards.yellow + bobCards.red,
        });
        
        const periodData = {
          match_id: currentMatchPeriod.match_id,
          period_number: nextPeriod,
          start_time: new Date().toISOString(),
          fencer_1_score: aliceScore,
          fencer_2_score: bobScore,
          fencer_1_cards: aliceCards.yellow + aliceCards.red,
          fencer_2_cards: bobCards.yellow + bobCards.red,
          priority_assigned: priorityFencer || undefined,
          priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
        };
        
        const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
        if (newPeriodRecord) {
          setCurrentMatchPeriod(newPeriodRecord);
        }
      })();
    }
    
    setCurrentPeriod(nextPeriod);
    currentPeriodRef.current = nextPeriod; // Update ref
    
    
    // Reset timer for next period
    setTimeRemaining(matchTime);
    setIsPlaying(false);
    
    // Show next period ready message
    setTimeout(() => {
      Alert.alert('Break Skipped!', `Period ${nextPeriod} ready. Timer set to ${formatTime(matchTime)}.`);
    }, 100);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const assignPriorityWithAnimation = (finalFencer: 'alice' | 'bob') => {
    setIsAssigningPriority(true);
    setPriorityFencer(null);
    
    // Determine final position based on fencer
    const finalPosition = finalFencer === 'alice' ? 
      (fencerPositions.alice === 'left' ? 'left' : 'right') : 
      (fencerPositions.alice === 'left' ? 'right' : 'left');
    
    // Animation duration and speed
    const totalDuration = 3000; // 3 seconds total
    const lightSwitchInterval = 150; // Light switches every 150ms
    const totalSwitches = Math.floor(totalDuration / lightSwitchInterval);
    
    let switchCount = 0;
    let currentPosition: 'left' | 'right' = 'left';
    
    // Start the light animation
    const animationInterval = setInterval(() => {
      setPriorityLightPosition(currentPosition);
      
      // Switch position
      currentPosition = currentPosition === 'left' ? 'right' : 'left';
      switchCount++;
      
      // Add haptic feedback for each switch
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Stop animation and assign final priority
      if (switchCount >= totalSwitches) {
        clearInterval(animationInterval);
        
        // Ensure animation ends on the randomly selected position
        setPriorityLightPosition(finalPosition);
        setPriorityFencer(finalFencer);
        setIsAssigningPriority(false);
        
        // Show priority result
        setTimeout(() => {
          Alert.alert(
            'Priority Assigned!', 
            `${finalFencer === 'alice' ? fencerNames.alice : fencerNames.bob} has priority!`,
            [{ text: 'OK' }]
          );
        }, 500);
        
        // Success haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, lightSwitchInterval);
  };

  const assignPriority = () => {
    if (isAssigningPriority) return; // Prevent multiple assignments
    
    // Determine random priority
    const randomValue = Math.random();
    const finalFencer = randomValue < 0.5 ? 'alice' : 'bob';
    
    // Use shared animation function
    assignPriorityWithAnimation(finalFencer);
  };

  const autoAssignPriority = () => {
    if (isAssigningPriority) return; // Prevent multiple assignments
    
    // Determine random priority
    const randomValue = Math.random();
    const finalFencer = randomValue < 0.5 ? 'alice' : 'bob';
    
    // Close popup immediately
    setShowPriorityPopup(false);
    
    // Use shared animation function
    assignPriorityWithAnimation(finalFencer);
  };

  const startInjuryTimer = () => {
    if (isInjuryTimer) return; // Prevent multiple injury timers
    
    // Store the current match time state before starting injury timer
    const previousMatchTime = timeRemaining;
    const wasMatchPlaying = isPlaying;
    
    // Pause the main match timer if it's running
    if (isPlaying) {
      pauseTimer();
    }
    
    setIsInjuryTimer(true);
    setInjuryTimeRemaining(300); // 5 minutes
    
    // Store the previous match state to restore later
    setPreviousMatchState({
      timeRemaining: previousMatchTime,
      wasPlaying: wasMatchPlaying
    });
    
    // Start the injury countdown
    const interval = setInterval(() => {
      setInjuryTimeRemaining(prev => {
        if (prev <= 0) {
          // Injury time finished
          clearInterval(interval);
          setIsInjuryTimer(false);
          setInjuryTimeRemaining(300);
          
          // Restore the previous match state
          if (previousMatchState) {
            setTimeRemaining(previousMatchState.timeRemaining);
            if (previousMatchState.wasPlaying) {
              // Resume the match timer if it was playing before
              startTimer();
            }
          }
          
          // Show injury time complete message
          Alert.alert('Injury Time Complete!', 'The 5-minute injury time has ended.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    
    setInjuryTimerRef(interval);
    
    // Haptic feedback for starting injury timer
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const skipInjuryTimer = () => {
    if (!isInjuryTimer) return;
    
    // Stop the injury timer
    if (injuryTimerRef) {
      clearInterval(injuryTimerRef);
    }
    setIsInjuryTimer(false);
    setInjuryTimeRemaining(300);
    
    // Restore the previous match state
    if (previousMatchState) {
      setTimeRemaining(previousMatchState.timeRemaining);
      // Always return to paused state, don't auto-resume
      // User must manually click resume to continue the match
    }
    
    // Clear the stored previous state
    setPreviousMatchState(null);
    
    // Haptic feedback for skipping injury timer
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const stopInjuryTimer = () => {
    if (!isInjuryTimer) return;
    
    if (injuryTimerRef) {
      clearInterval(injuryTimerRef);
    }
    setIsInjuryTimer(false);
    setInjuryTimeRemaining(300);
    
    // Haptic feedback for stopping injury timer
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };



  const handleTimeInputChange = (text: string) => {
    // Remove any non-numeric characters except colon
    const cleaned = text.replace(/[^0-9:]/g, '');
    
    // Handle colon navigation and re-insertion
    if (cleaned.length <= 5) {
      let formatted = cleaned;
      
      // If user is typing and we have at least 2 digits, insert colon
      if (cleaned.length >= 2 && !cleaned.includes(':')) {
        formatted = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
      }
      
      // If user is deleting and we have a colon, handle navigation
      if (cleaned.length < editTimeInput.length && editTimeInput.includes(':')) {
        // Allow deletion through the colon
        if (cleaned.length === 2 && !cleaned.includes(':')) {
          // User deleted the colon, keep the format
          formatted = cleaned;
        } else if (cleaned.length === 1 && editTimeInput.length === 3) {
          // User is at the beginning, allow single digit
          formatted = cleaned;
        }
      }
      
      setEditTimeInput(formatted);
    }
  };

  const handleTimeInputSelectionChange = (event: any) => {
    const { selection } = event.nativeEvent;
    const text = editTimeInput;
    
    // If cursor is at position 2 (right after first digit), move it to position 3 (after colon)
    if (selection.start === 2 && text.length >= 3 && text[2] === ':') {
      // Don't change selection, let user navigate natural
    }
  };

  const handleCancelEdit = () => {
    setShowEditPopup(false);
    setEditTimeInput('');
  };

  const getTimerDisplayStyles = () => {
    // Timer Ready State (never started, can edit)
    if (!hasMatchStarted && !isPlaying && timeRemaining === matchTime) {
      return {
        timerDisplayMargin: height * 0.02, // Consistent margin for ready state
      };
    }
    
    // Match Active State (running or paused)
    if (hasMatchStarted && !isBreakTime) {
      return {
        timerDisplayMargin: height * 0.04, // Consistent margin for active state
      };
    }
    
    // Break State
    if (isBreakTime) {
      return {
        timerDisplayMargin: height * 0.03, // Consistent margin for break state
      };
    }
    
    // Default state
    return {
      timerDisplayMargin: height * 0.03,
    };
  };

  const timerStyles = getTimerDisplayStyles();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerSafeArea: {
      backgroundColor: Colors.dark.background,
    },
    safeArea: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    stickyHeader: {
      backgroundColor: Colors.dark.background,
      paddingHorizontal: '5%',
      paddingVertical: height * 0.02,
      zIndex: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: '5%',
      paddingTop: layout.adjustPadding(height * -0.025, 'top'), // Reverted back from -0.06
      paddingBottom: layout.adjustPadding(height * 0.02, 'bottom'),
      overflow: 'visible', // Allow pill to show outside bounds
    },
    
    // Match Timer Section
    matchTimerCard: {
      // Background will be handled by LinearGradient
      borderWidth: width * 0.005,
      borderColor: Colors.timerBackground.borderColors[0],
      borderRadius: width * 0.03,
      padding: width * 0.008,
      marginTop: layout.adjustMargin(-height * 0.015, 'top'), // Reverted back from -0.035
      marginBottom: layout.adjustMargin(height * 0.001, 'bottom'),
      position: 'relative',
      overflow: 'visible', // Allow pill to show outside card bounds
      // Shadow effects
      shadowColor: Colors.timerBackground.shadowColor,
      shadowOffset: Colors.timerBackground.shadowOffset,
      shadowOpacity: Colors.timerBackground.shadowOpacity,
      shadowRadius: Colors.timerBackground.shadowRadius,
      elevation: Colors.timerBackground.elevation,
    },
    timerLabel: {
      position: 'absolute',
      width: width * 0.24, // Fixed width like Win badge
      height: height * 0.03, // Fixed height
      left: '50%', // Center horizontally
      marginLeft: -(width * 0.24) / 2, // Half of width to center properly
      top: -height * 0.028, // Moved pill higher up, more outside card
      backgroundColor: Colors.yellow.accent,
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    timerLabelText: {
      fontSize: width * 0.025,
      fontWeight: '600',
      color: Colors.gray.dark,
    },
    timerDisplay: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.003,
      marginTop: 0,
      width: '100%',
    },
    countdownDisplay: {
      alignItems: 'center',
      justifyContent: 'center',
      height: height * 0.035, // Much smaller height for injury timer
      width: '100%',
      // Timer background styling removed - now handled by main container
      borderRadius: width * 0.02,
    },
    countdownText: {
      fontSize: width * 0.10, // Increased from 0.06 for better visibility
      color: 'white',
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: height * 0.001 },
      textShadowRadius: width * 0.002,
      marginTop: -(height * 0.03), // Moved up from -0.008
    },
    countdownTextWarning: {
      fontSize: width * 0.10, // Increased from 0.12 for better visibility
      color: Colors.yellow.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: height * 0.002 },
      textShadowRadius: width * 0.005,
      marginTop: -(height * 0.03), // Moved up from -0.015
    },
    countdownTextDanger: {
      fontSize: width * 0.16, // Increased from 0.12 for better visibility
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.03), // Moved up from -0.015
    },
    countdownTextDangerPulse: {
      fontSize: width * 0.16, // Increased from 0.12 for better visibility
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.03), // Moved up from -0.015
    },

    timerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.005,
    },
    editButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editButtonText: {
      fontSize: width * 0.04,
    },
    completeMatchCircle: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: width * 0.12,
      height: width * 0.12,
      borderRadius: width * 0.06,
      backgroundColor: Colors.green.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    completeMatchFlag: {
      fontSize: width * 0.06,
    },
    periodControl: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#E6DDFF',
      borderRadius: width * 0.03,
      padding: width * 0.025,
      marginTop: height * 0.002,
      borderWidth: width * 0.0025,
      borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    periodButton: {
      width: width * 0.07,
      height: width * 0.07,
      borderRadius: width * 0.035,
      backgroundColor: 'rgb(98,80,242)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: height * 0.004 },
      shadowOpacity: 0.3,
      shadowRadius: width * 0.01,
      elevation: 6,
      borderWidth: width * 0.005,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    periodButtonText: {
      fontSize: width * 0.05,
      fontWeight: '700',
      color: 'white',
    },
    periodDisplay: {
      alignItems: 'center',
    },
    periodText: {
      fontSize: width * 0.03,
      color: Colors.gray.dark,
      fontWeight: '500',
    },
    periodNumber: {
      fontSize: width * 0.04,
      color: Colors.gray.dark,
      fontWeight: '700',
    },

    // Fencers Section
    fencersHeading: {
      fontSize: width * 0.05, // Smaller font on Nexus S, minimum 16px
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.005, // Smaller margin on Nexus S
      marginTop: height * -0.01, // Smaller margin on Nexus S
    },
    fencersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.005, // Smaller margin on Nexus S
      marginLeft: width * 0.05, // Smaller margin on Nexus S
    },
    editNamesButton: {
      width: width * 0.06, // Smaller button on Nexus S
      height: width * 0.06, // Smaller button on Nexus S
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.05, // Smaller margin on Nexus S
    },
    editNamesButtonText: {
      fontSize: width * 0.04, // Smaller font on Nexus S, minimum 12px
    },
    fencersContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: height * 0.015, // Smaller margin on Nexus S
      gap: width * 0.03, // Smaller gap on Nexus S
    },
    fencerCard: {
      width: width * 0.42, // Slightly wider on Nexus S for better fit
      padding: width * 0.04, // Smaller padding on Nexus S
      minHeight: height * 0.25, // Smaller height on Nexus S
      backgroundColor: Colors.purple.primary,
      borderRadius: width * 0.03,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      transform: [{ scale: 1 }],
    },
    fencerCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: height * 0.01,
    },
    profileContainer: {
      alignItems: 'center',
    },
    profilePicture: {
      width: width * 0.16, // Smaller profile on Nexus S
      height: width * 0.16, // Smaller profile on Nexus S
      borderRadius: width * 0.08,
      backgroundColor: Colors.gray.medium,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    profileInitial: {
      fontSize: width * 0.075, // Smaller font on Nexus S, minimum 20px
      fontWeight: '700',
      color: 'white',
    },
    profileImage: {
      width: '100%',
      height: '100%',
      borderRadius: width * 0.08,
      backgroundColor: 'transparent',
    },
    cameraIcon: {
      position: 'absolute',
      bottom: -width * 0.008,
      right: -width * 0.008,
      width: width * 0.07,
      height: width * 0.07,
      borderRadius: width * 0.035,
      backgroundColor: Colors.blue.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraIconText: {
      fontSize: width * 0.035,
    },
    priorityStar: {
      width: width * 0.09,
      height: width * 0.09,
      borderRadius: width * 0.045,
      backgroundColor: Colors.yellow.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starIcon: {
      fontSize: width * 0.045,
    },
    fencerName: {
      fontSize: width * 0.055, // Smaller font on Nexus S, minimum 14px
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.006, // Smaller margin on Nexus S
      textAlign: 'center',
    },
    fencerNameContainer: {
      // Container for clickable fencer names
      paddingVertical: height * 0.005,
      paddingHorizontal: width * 0.01,
      borderRadius: width * 0.01,
      maxWidth: '100%',
      minHeight: height * 0.03, // Fixed minimum height to prevent layout shifts
      justifyContent: 'center',
      alignItems: 'center',
    },
    fencerScore: {
      fontSize: width * 0.105, // Smaller font on Nexus S, minimum 32px
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.015,
    },
    scoreControls: {
      flexDirection: 'row',
      gap: width * 0.035,
    },
    scoreButton: {
      width: width * 0.12, // Smaller buttons on Nexus S
      height: width * 0.12, // Smaller buttons on Nexus S
      borderRadius: width * 0.06,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2, // Thinner border on Nexus S
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    scoreButtonText: {
      fontSize: width * 0.065, // Smaller font on Nexus S, minimum 16px
      fontWeight: '700',
      color: 'white',
    },
    swapButton: {
      width: width * 0.13, // Smaller button on Nexus S
      height: width * 0.13, // Smaller button on Nexus S
      borderRadius: width * 0.065,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      borderWidth: 1, // Thinner border on Nexus S
      borderColor: '#FFFFFF',
    },
    swapIcon: {
      fontSize: width * 0.065, // Smaller font on Nexus S, minimum 16px
      color: 'white',
    },

    // Bottom Controls
    bottomControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
      gap: width * 0.05, // Smaller gap on Nexus S
    },
    decorativeCards: {
      flexDirection: 'row',
      gap: width * 0.03,
    },
    decorativeCard: {
      width: width * 0.08, // Smaller cards on Nexus S
      height: width * 0.12, // Smaller height on Nexus S
      borderRadius: width * 0.015,
    },
    cardRed: {
      backgroundColor: Colors.red.accent,
    },
    cardYellow: {
      backgroundColor: Colors.yellow.accent,
    },
    cardBlack: {
      backgroundColor: Colors.gray.dark,
    },
    yellowCardsContainer: {
      flexDirection: 'row',
      gap: width * 0.02,
      marginTop: height * 0.005,
      marginLeft: width * 0.02,
    },
    yellowCard: {
      width: width * 0.035, // Much smaller cards
      height: width * 0.035, // Much smaller cards
      backgroundColor: Colors.yellow.accent,
      borderRadius: width * 0.01,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: height * 0.001 },
      shadowOpacity: 0.2,
      shadowRadius: width * 0.006,
      elevation: 3,
    },
    yellowCardText: {
      fontSize: width * 0.022, // Much smaller font
      color: 'white',
      fontWeight: '700',
    },
    redCardText: {
      fontSize: width * 0.022, // Much smaller font
      color: 'white',
      fontWeight: '700',
    },
    assignPriorityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.02, // Smaller gap on Nexus S
      backgroundColor: Colors.purple.primary,
      paddingHorizontal: width * 0.03, // Smaller padding on Nexus S
      paddingVertical: height * 0.012, // Smaller padding on Nexus S
      borderRadius: width * 0.03,
    },
    assignPriorityIcon: {
      fontSize: width * 0.05, // Smaller font on Nexus S, minimum 14px
    },
    assignPriorityText: {
      fontSize: width * 0.04, // Smaller font on Nexus S, minimum 12px
      fontWeight: '600',
      color: 'white',
    },

    // Play Controls
    playControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 0,
      marginTop: height * 0.005, // Reduced top margin for more compact card
      gap: width * 0.04, // Smaller gap on Nexus S
      width: '100%',
    },
    playButton: {
      flex: 1,
      marginRight: width * 0.04, // Smaller margin on Nexus S
      backgroundColor: Colors.green.accent,
      paddingVertical: height * 0.012, // Smaller padding on Nexus S
      borderRadius: width * 0.03,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: width * 0.02, // Smaller gap on Nexus S
    },
    playIcon: {
      fontSize: width * 0.05, // Smaller font on Nexus S, minimum 14px
    },
    playText: {
      fontSize: width * 0.04, // Smaller font on Nexus S, minimum 12px
      fontWeight: '600',
      color: 'white',
    },
    resetButton: {
      width: width * 0.06, // Smaller button on Nexus S
      height: width * 0.06, // Smaller button on Nexus S
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetIcon: {
      fontSize: width * 0.05, // Smaller font on Nexus S, minimum 14px
    },



    // Edit Time Popup
    popupOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    popupContainer: {
      backgroundColor: Colors.purple.dark || '#4C1D95',
      borderRadius: width * 0.04,
      padding: width * 0.06,
      width: '95%',
      maxWidth: width * 0.9,
      alignItems: 'center',
    },
    popupTitle: {
      fontSize: width * 0.045,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.025,
      textAlign: 'center',
    },
    popupMessage: {
      fontSize: width * 0.04,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: height * 0.025,
      textAlign: 'center',
      lineHeight: height * 0.025,
    },
    timeInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.02,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      fontSize: width * 0.06,
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
      width: '100%',
      marginBottom: height * 0.015,
    },
    inputHint: {
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.6)',
      textAlign: 'center',
      marginBottom: height * 0.03,
    },
    popupButtons: {
      flexDirection: 'column',
      gap: height * 0.015,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: Colors.gray.medium,
      borderRadius: width * 0.02,
      paddingHorizontal: width * 0.05,
      paddingVertical: height * 0.015,
      width: width * 0.35,
      alignItems: 'center',
      flexWrap: 'nowrap',
    },
    cancelButtonText: {
      fontSize: width * 0.035,
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
      flexWrap: 'nowrap',
    },
    saveButton: {
      backgroundColor: Colors.purple.primary,
      borderRadius: width * 0.02,
      paddingHorizontal: width * 0.05,
      paddingVertical: height * 0.015,
      width: width * 0.35,
      alignItems: 'center',
      flexWrap: 'nowrap',
    },
    saveButtonText: {
      fontSize: width * 0.035,
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
      flexWrap: 'nowrap',
    },

    // Add Time Controls
    addTimeControls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: height * 0.005, // Smaller margin on Nexus S
      marginBottom: height * 0.01, // Smaller margin on Nexus S
      width: '100%',
    },
    addTimeButton: {
      backgroundColor: Colors.purple.primary,
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.04, // Smaller padding on Nexus S
      paddingVertical: height * 0.008, // Smaller padding on Nexus S
      minWidth: width * 0.18, // Smaller width on Nexus S
      alignItems: 'center',
    },
    addTimeButtonText: {
      fontSize: width * 0.04, // Smaller font on Nexus S, minimum 12px
      fontWeight: '600',
      color: 'white',
    },


    countdownWarningText: {
      fontSize: width * 0.03, // Reduced from 0.04 to 0.03 to fit better
      color: Colors.yellow.accent,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: height * 0.001, // Increased from 0.003 to 0.008 for better separation from period card
    },

    // Match Status Display
    matchStatusContainer: {
      alignItems: 'center',
      marginBottom: height * 0.01,
    },
    matchStatusText: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
      marginBottom: height * 0.005,
      marginTop: height * 0.01,
    },
    matchStatusSubtext: {
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
    },

    // Sliding Switch Styles
    slidingSwitch: {
      width: width * 0.12,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    switchTrack: {
      width: '100%',
      height: '100%',
      borderRadius: width * 0.03,
      position: 'absolute',
      top: 0,
      left: 0,
    },
    switchThumb: {
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: width * 0.025,
      backgroundColor: 'white',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: height * 0.003 },
      shadowOpacity: 0.2,
      shadowRadius: width * 0.01,
      elevation: 5,
      zIndex: 3,
      position: 'absolute',
      top: width * 0.005,
      left: width * 0.005,
    },

    // Edit Names Popup
    nameInputContainer: {
      width: '100%',
      marginBottom: height * 0.02,
    },
    nameInputLabel: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.01,
    },
    nameInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.02,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      fontSize: width * 0.06,
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
      width: '100%',
      minWidth: width * 0.6,
    },
    priorityLight: {
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: width * 0.025,
      borderWidth: width * 0.005,
      borderColor: Colors.yellow.accent,
      position: 'absolute',
      top: width * 0.005,
      right: width * 0.005,
    },
    priorityLightRight: {
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: width * 0.025,
      borderWidth: width * 0.005,
      borderColor: Colors.yellow.accent,
      position: 'absolute',
      top: width * 0.005,
      left: width * 0.005,
    },
    decorativeCardCount: {
      fontSize: width * 0.03,
      color: 'white',
      fontWeight: '700',
      marginTop: height * 0.005,
    },
    redCardsContainer: {
      flexDirection: 'row',
      gap: width * 0.02,
      marginTop: height * 0.01,
      marginLeft: width * 0.02,
    },
    redCard: {
      width: width * 0.035, // Much smaller cards
      height: width * 0.035, // Much smaller cards
      backgroundColor: Colors.red.accent,
      borderRadius: width * 0.01,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: height * 0.001 },
      shadowOpacity: 0.2,
      shadowRadius: width * 0.006,
      elevation: 3,
    },
    cardCountContainer: {
      flexDirection: 'row',
      gap: width * 0.02,
      alignItems: 'center',
    },
    aliceCard: {
      backgroundColor: 'rgb(252,187,187)',
    },
    bobCard: {
      backgroundColor: 'rgb(176,232,236)',
    },
    fencerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.01,
    },
    profileSection: {
      alignItems: 'center',
    },
    profileImageContainer: {
      width: width * 0.16,
      height: width * 0.16,
      borderRadius: width * 0.08,
      backgroundColor: Colors.gray.medium,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    profileImageText: {
      fontSize: width * 0.075,
      fontWeight: '700',
      color: 'white',
    },
    profileInitials: {
      color: '#FFFFFF',
      fontSize: width * 0.06,
      fontWeight: '500',
      textAlign: 'center',
    },
    fencerDetails: {
      alignItems: 'center',
    },
    toggleSwitch: {
      width: width * 0.12,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    toggleThumb: {
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: width * 0.025,
      backgroundColor: 'white',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: height * 0.003 },
      shadowOpacity: 0.2,
      shadowRadius: width * 0.01,
      elevation: 5,
      zIndex: 3,
      position: 'absolute',
      top: width * 0.005,
      left: width * 0.005,
    },
    swapButtonText: {
      fontSize: width * 0.065,
      fontWeight: '700',
      color: 'white',
    },

    // Complete Match Button
    completeMatchButton: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.01, // Smaller margin on Nexus S
      gap: width * 0.05, // Smaller gap on Nexus S
    },
    completeButton: {
      width: width * 0.35, // Slightly wider on Nexus S for better fit
      height: width * 0.06, // Smaller height on Nexus S
      borderRadius: width * 0.03,
      backgroundColor: Colors.green.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completeButtonText: {
      fontSize: width * 0.04, // Smaller font on Nexus S, minimum 12px
      fontWeight: '600',
      color: 'white',
    },
  });

  // Pure logic functions (exported so you can unit test if you want)
  const applyYellow = (prev: { yellow: 0 | 1; red: number }): { yellow: 0 | 1; red: number } => {
    // Case A: no reds yet
    if (prev.red === 0) {
      // First yellow -> show 1 yellow
      if (prev.yellow === 0) return { yellow: 1, red: 0 };
      // Second yellow -> convert to 1 red, clear yellow
      return { yellow: 0, red: 1 };
    }

    // Case B: already have at least one red
    // Every new yellow adds another red immediately; yellow remains cleared.
    return { yellow: 0, red: prev.red + 1 };
  };

  const resetAliceCards = () => {
    console.log('🔄 RESETTING ALICE CARDS');
    setAliceCards({ yellow: 0, red: 0 });
    setAliceYellowCards([]);
    setAliceRedCards([]);
    
    // Log the card resets
    logMatchEvent('card', 'alice', 'yellow'); // Log yellow card reset
    logMatchEvent('card', 'alice', 'red'); // Log red card reset
    
    console.log('  All cards cleared for Alice');
  };

  const resetBobCards = () => {
    console.log('🔄 RESETTING BOB CARDS');
    setBobCards({ yellow: 0, red: 0 });
    setBobYellowCards([]);
    setBobRedCards([]);
    
    // Log the card resets
    logMatchEvent('card', 'bob', 'yellow'); // Log yellow card reset
    logMatchEvent('card', 'bob', 'red'); // Log red card reset
    
    console.log('  All cards cleared for Bob');
  };

  const resetAllCards = () => {
    console.log('🔄 RESETTING ALL CARDS FOR BOTH FENCERS');
    // Reset Alice's cards
    setAliceCards({ yellow: 0, red: 0 });
    setAliceYellowCards([]);
    setAliceRedCards([]);
    
    // Reset Bob's cards  
    setBobCards({ yellow: 0, red: 0 });
    setBobYellowCards([]);
    setBobRedCards([]);
    
    // Log the card resets
    logMatchEvent('card', 'alice', 'yellow'); // Log yellow card reset
    logMatchEvent('card', 'alice', 'red'); // Log red card reset
    logMatchEvent('card', 'bob', 'yellow'); // Log yellow card reset
    logMatchEvent('card', 'bob', 'red'); // Log red card reset
    
    console.log('  All cards cleared for both Alice and Bob');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const addYellowCardToAlice = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    // Pause timer when card is issued
    if (isPlaying) {
      pauseTimer();
    }
    
    // NEW CLEAN LOGIC: Use pure function with case statement
    setAliceCards(prev => {
      const newState = applyYellow(prev);
      console.log('🟡 ALICE - Adding Yellow Card:');
      console.log('  Previous state:', prev);
      console.log('  New state:', newState);
      
      // Update the display arrays to match the new state
      if (newState.yellow === 1) {
        setAliceYellowCards([1]);
        setAliceRedCards([]);
        console.log('  → Display: 1 yellow card');
      } else {
        setAliceYellowCards([]);
        setAliceRedCards([newState.red]);
        console.log('  → Display: 1 red card with "' + newState.red + '" inside');
        
        // If this yellow card resulted in a red card, give opponent a point
        if (newState.red > prev.red) {
          setBobScore(prevScore => prevScore + 1);
          console.log('🔴 Alice yellow converted to red → Bob gets +1 point');
          logMatchEvent('card', 'alice', 'red'); // Log the red card conversion
        }
      }
      
      return newState;
    });
    
    // Create match event for the yellow card
    await createMatchEvent('user', 'yellow');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addYellowCardToBob = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    // Pause timer when card is issued
    if (isPlaying) {
      pauseTimer();
    }
    
    // NEW CLEAN LOGIC: Use pure function with case statement
    setBobCards(prev => {
      const newState = applyYellow(prev);
      console.log('🟡 BOB - Adding Yellow Card:');
      console.log('  Previous state:', prev);
      console.log('  New state:', newState);
      
      // Update the display arrays to match the new state
      if (newState.yellow === 1) {
        setBobYellowCards([1]);
        setBobRedCards([]);
        console.log('  → Display: 1 yellow card');
      } else {
        setBobYellowCards([]);
        setBobRedCards([newState.red]);
        console.log('  → Display: 1 red card with "' + newState.red + '" inside');
        
        // If this yellow card resulted in a red card, give opponent a point
        if (newState.red > prev.red) {
          setAliceScore(prevScore => prevScore + 1);
          console.log('🔴 Bob yellow converted to red → Alice gets +1 point');
          logMatchEvent('card', 'bob', 'red'); // Log the red card conversion
        }
      }
      
      return newState;
    });
    
    // Create match event for the yellow card
    await createMatchEvent('opponent', 'yellow');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Red card management functions
  const addRedCardToAlice = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    if (aliceRedCards.length > 0) {
      // Show popup asking if user wants to remove or add
      Alert.alert(
        'Red Cards',
        'Alice already has red cards. What would you like to do?',
        [
          {
            text: 'Remove One',
            style: 'destructive',
            onPress: () => {
              const newRedCount = Math.max(0, aliceRedCards[0] - 1);
              if (newRedCount === 0) {
                setAliceRedCards([]);
                setAliceCards(prev => ({ ...prev, red: 0 }));
              } else {
                setAliceRedCards([newRedCount]);
                setAliceCards(prev => ({ ...prev, red: newRedCount }));
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          },
          {
            text: 'Add Another',
            onPress: async () => {
              // Pause timer when card is issued
              if (isPlaying) {
                pauseTimer();
              }
              const newRedCount = aliceRedCards[0] + 1;
              setAliceRedCards([newRedCount]);
              setAliceCards(prev => ({ ...prev, red: newRedCount }));
              // Give opponent (Bob) 1 point for Alice's red card
              setBobScore(prev => prev + 1);
              console.log('🔴 Alice red card issued → Bob gets +1 point');
              // Create match event for the red card
              await createMatchEvent('user', 'red');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
          {
            text: 'Reset All Cards',
            style: 'destructive',
            onPress: () => {
              resetAliceCards();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      // Pause timer when card is issued
      if (isPlaying) {
        pauseTimer();
      }
      // First red card - add directly
      setAliceRedCards([1]);
      setAliceCards(prev => ({ ...prev, red: 1 }));
      // Give opponent (Bob) 1 point for Alice's red card
      setBobScore(prev => prev + 1);
      console.log('🔴 Alice red card issued → Bob gets +1 point');
      // Create match event for the red card
      await createMatchEvent('user', 'red');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const addRedCardToBob = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    if (bobRedCards.length > 0) {
      // Show popup asking if user wants to remove or add
      Alert.alert(
        'Red Cards',
        'Bob already has red cards. What would you like to do?',
        [
          {
            text: 'Remove One',
            style: 'destructive',
            onPress: () => {
              const newRedCount = Math.max(0, bobRedCards[0] - 1);
              if (newRedCount === 0) {
                setBobRedCards([]);
                setBobCards(prev => ({ ...prev, red: 0 }));
              } else {
                setBobRedCards([newRedCount]);
                setBobCards(prev => ({ ...prev, red: newRedCount }));
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          },
          {
            text: 'Add Another',
            onPress: async () => {
              // Pause timer when card is issued
              if (isPlaying) {
                pauseTimer();
              }
              const newRedCount = bobRedCards[0] + 1;
              setBobRedCards([newRedCount]);
              setBobCards(prev => ({ ...prev, red: newRedCount }));
              // Give opponent (Alice) 1 point for Bob's red card
              setAliceScore(prev => prev + 1);
              console.log('🔴 Bob red card issued → Alice gets +1 point');
              // Create match event for the red card
              await createMatchEvent('opponent', 'red');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
          {
            text: 'Reset All Cards',
            style: 'destructive',
            onPress: () => {
              resetBobCards();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      // Pause timer when card is issued
      if (isPlaying) {
        pauseTimer();
      }
      // First red card - add directly
      setBobRedCards([1]);
      setBobCards(prev => ({ ...prev, red: 1 }));
      // Give opponent (Alice) 1 point for Bob's red card
      setAliceScore(prev => prev + 1);
      console.log('🔴 Bob red card issued → Alice gets +1 point');
      // Create match event for the red card
      await createMatchEvent('opponent', 'red');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Add missing popup button styles
  const popupButtonStyles = StyleSheet.create({
    popupButton: {
      paddingHorizontal: width * 0.06,
      paddingVertical: height * 0.015,
      borderRadius: width * 0.02,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: width * 0.3,
    },
    popupButtonPrimary: {
      backgroundColor: Colors.purple.primary,
    },
    popupButtonSecondary: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    popupButtonPrimaryText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    popupButtonSecondaryText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header with top safe area */}
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.stickyHeader}>
            {/* Empty header for now, but keeps structure consistent */}
          </View>
        </SafeAreaView>
        
        {/* Content with bottom safe area */}
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.contentContainer}>
          {/* Match Timer Section */}
      <View style={{ overflow: 'visible', position: 'relative' }}>
        {/* Period Label - Positioned outside card */}
        <View style={styles.timerLabel}>
          <Text style={styles.timerLabelText}>Match Timer</Text>
        </View>
        
        <LinearGradient
          colors={Colors.timerBackground.colors}
          style={styles.matchTimerCard}
          start={Colors.timerBackground.start}
          end={Colors.timerBackground.end}
        >
          <View style={styles.timerHeader}>
          {!isPlaying && !hasMatchStarted && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditTime}>
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
          )}
          {hasMatchStarted && (
            <TouchableOpacity 
              style={styles.completeMatchCircle} 
              onPress={completeMatch}
            >
              <Text style={styles.completeMatchFlag}>🏁</Text>
            </TouchableOpacity>
          )}
        </View>
        

        
        <View style={[styles.timerDisplay, { marginTop: timerStyles.timerDisplayMargin }]}>
          {/* Debug overlay removed */}
           
 
          
          {/* Break Timer Display - shows when break is active (absolute priority) */}
          {isBreakTime && (
            <View style={styles.countdownDisplay}>
              <Text style={[styles.countdownText, { color: Colors.yellow.accent }]}>
                {formatTime(breakTimeRemaining)}
              </Text>
              <Text style={styles.countdownWarningText}>
                🍃 Break Time - Next: Period {Math.min(currentPeriod + 1, 3)}
              </Text>
            </View>
          )}
          
          {/* Injury Timer Display - shows when injury timer is active (higher priority than match timer) */}
          {!isBreakTime && isInjuryTimer && (
            <View style={[styles.countdownDisplay, { 
              backgroundColor: hasMatchStarted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
              borderWidth: width * 0.003,
              borderColor: hasMatchStarted ? '#EF4444' : '#6B7280',
              borderRadius: width * 0.02,
              paddingVertical: height * 0.01,
              paddingHorizontal: width * 0.025,
              minHeight: height * 0.06,
              marginBottom: height * 0.01,
              opacity: hasMatchStarted ? 1 : 0.6
            }]}>
              <Text style={[styles.countdownText, { 
                color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                fontSize: width * 0.045 
              }]}>
                {formatTime(injuryTimeRemaining)}
              </Text>
              <Text style={[styles.countdownWarningText, { 
                color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                fontSize: width * 0.022 
              }]}>
                🏥 INJURY TIME - 5:00
              </Text>
              {previousMatchState && (
                <Text style={[styles.countdownWarningText, { 
                  color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                  fontSize: width * 0.018 
                }]}>
                  Match paused at {formatTime(previousMatchState.timeRemaining)}
                </Text>
              )}
            </View>
          )}
          
          {/* Other Timer Displays - only show when NOT break time AND NOT injury time */}
          {!isBreakTime && !isInjuryTimer && (
            <>
              {/* Countdown Display - only shows when actively playing */}
              {isPlaying && (
                <View style={styles.countdownDisplay}>
                  {timeRemaining <= 30 ? (
                    <Text style={[styles.countdownTextDangerPulse, { opacity: pulseOpacity }]}>
                      {formatTime(timeRemaining)}
                    </Text>
                  ) : timeRemaining <= 60 ? (
                    <Text style={styles.countdownTextWarning}>
                      {formatTime(timeRemaining)}
                    </Text>
                  ) : (
                    <Text style={styles.countdownText}>
                      {formatTime(timeRemaining)}
                    </Text>
                  )}
                  
                  {/* Countdown warning */}
                  {timeRemaining <= 30 && timeRemaining > 0 && (
                    <Text style={[styles.countdownWarningText, { marginTop: height * -0.005 }]}>
                      ⚠️ Time is running out!
                    </Text>
                  )}
                  
                  {/* Final countdown warning */}
                  {timeRemaining <= 10 && timeRemaining > 0 && (
                    <Text style={[styles.countdownWarningText, { color: Colors.red.accent, fontSize: width * 0.035 }]}>
                      🚨 FINAL COUNTDOWN!
                    </Text>
                  )}
                </View>
              )}
              
              {/* Match Ended Display - shows when timer reaches 0:00 (but NEVER during break) */}
              {!isPlaying && timeRemaining === 0 && hasMatchStarted && currentPeriod === 3 && (
                <View style={styles.countdownDisplay}>
                  <Text style={[styles.countdownText, { color: Colors.red.accent }]}>
                    0:00
                  </Text>
                  <Text style={styles.countdownWarningText}>
                    {aliceScore === bobScore ? '🏁 Match Ended in Tie!' : '🏁 Match Complete!'}
                  </Text>
                </View>
              )}
              
              {/* Period Ready Display - shows when timer reaches 0:00 but NOT final period */}
              {!isPlaying && timeRemaining === 0 && hasMatchStarted && (currentPeriod === 1 || currentPeriod === 2) && (
                <View style={styles.countdownDisplay}>
                  <Text style={[styles.countdownText, { color: Colors.orange.accent }]}>
                    0:00
                  </Text>
                  <Text style={styles.countdownWarningText}>
                    🍃 Period {currentPeriod} Complete - Break Time!
                  </Text>
                </View>
              )}
              
              {/* Timer Picker - shows when not playing and not paused (allows time editing) */}
              {!isPlaying && timeRemaining === matchTime && (
                <View style={styles.countdownDisplay}>
                  <Text style={styles.countdownText}>
                    {formatTime(matchTime)}
                  </Text>
                </View>
              )}
              
              {/* Paused Timer Display - shows when timer is paused */}
              {!isPlaying && timeRemaining > 0 && timeRemaining < matchTime && (
                <View style={styles.countdownDisplay}>
                  <Text style={styles.countdownText}>
                    {formatTime(timeRemaining)}
                  </Text>
                </View>
              )}
            </>
          )}
          
          {/* Add Time Controls */}
          {!isPlaying && timeRemaining === matchTime && !hasMatchStarted && (
            <View style={styles.addTimeControls}>
              <TouchableOpacity 
                style={styles.addTimeButton} 
                onPress={() => addTime(30)}
              >
                <Text style={styles.addTimeButtonText}>+30s</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addTimeButton} 
                onPress={() => addTime(60)}
              >
                <Text style={styles.addTimeButtonText}>+1m</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.addTimeButton, { backgroundColor: Colors.gray.medium }]} 
                onPress={() => subtractTime(60)}
              >
                <Text style={styles.addTimeButtonText}>-1m</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.addTimeButton, { backgroundColor: Colors.gray.medium }]} 
                onPress={() => subtractTime(30)}
              >
                <Text style={styles.addTimeButtonText}>-30s</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Period Control - moved to bottom of card */}
        <View style={styles.periodControl}>
          <TouchableOpacity style={styles.periodButton} onPress={decrementPeriod}>
            <Ionicons name="remove" size={16} color="white" />
          </TouchableOpacity>
          <View style={styles.periodDisplay}>
            <Text style={styles.periodText}>Period</Text>
            <Text style={styles.periodNumber}>{currentPeriod}/3</Text>
          </View>
          <TouchableOpacity style={styles.periodButton} onPress={incrementPeriod}>
            <Ionicons name="add" size={16} color="white" />
          </TouchableOpacity>
        </View>
        
      </LinearGradient>
      </View>

      {/* Match Status Display */}
      <View style={styles.matchStatusContainer}>
        <Text style={styles.matchStatusText}>
          {isBreakTime ? '🍃 Break Time' : isPlaying ? '🟢 Match in Progress' : timeRemaining === 0 ? '🔴 Match Ended' : timeRemaining < matchTime ? '⏸️ Match Paused' : '⚪ Timer Ready'}
        </Text>
        {isBreakTime && (
          <Text style={styles.matchStatusSubtext}>
            Break in progress
          </Text>
        )}
      </View>

      {/* Fencers Section */}
                            <View style={[styles.fencersHeader, { 
                marginTop: (hasMatchStarted && aliceYellowCards.length === 0 && aliceRedCards.length === 0 && bobYellowCards.length === 0 && bobRedCards.length === 0)
                  ? -(height * 0.02)  // Move up when match in progress and no cards
                  : -(height * 0.035)  // Original positioning for other states
              }]}>
        <Text style={styles.fencersHeading}>Fencers</Text>
        <TouchableOpacity 
          style={styles.editNamesButton}
          onPress={openEditNamesPopup}
        >
          <Ionicons name="pencil" size={16} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={[
        styles.fencersContainer,
        // Reduce margin when match is in progress and no cards issued
        (hasMatchStarted && aliceYellowCards.length === 0 && aliceRedCards.length === 0 && bobYellowCards.length === 0 && bobRedCards.length === 0) ? {
          marginBottom: height * 0.005, // Reduce margin from 0.015 to 0.005
        } : {}
      ]}>
        {/* Alice's Card */}
        <View style={[
          styles.fencerCard, 
          { backgroundColor: 'rgb(252,187,187)' },
          // Make fencer card smaller when timer is ready AND cards are present
          (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
            width: width * 0.42, // Keep width at 0.42 (same as non-conditional)
            padding: width * 0.03, // Reduce padding from 0.04 to 0.03
            minHeight: height * 0.22, // Reduce height from 0.25 to 0.22
          } : 
          // Make fencer cards longer when match is in progress and no cards issued
          (hasMatchStarted && aliceYellowCards.length === 0 && aliceRedCards.length === 0 && bobYellowCards.length === 0 && bobRedCards.length === 0) ? {
            width: width * 0.42, // Keep width at 0.42
            padding: width * 0.04, // Keep normal padding
            minHeight: height * 0.32, // Increase height from 0.25 to 0.32
          } : {}
        ]}>
          {/* Sliding Switch - Top Left - Only show when toggle is on left card */}
          {toggleCardPosition === 'left' && (
            <View style={[styles.slidingSwitch, { 
              position: 'absolute', 
              top: width * 0.02, 
              left: width * 0.02, 
              zIndex: 5 
            }]}>
              <TouchableOpacity 
                style={[
                  styles.switchTrack, 
                  { backgroundColor: showUserProfile ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' }
                ]}
                onPress={() => setShowUserProfile(!showUserProfile)}
              >
                <View style={[
                  styles.switchThumb, 
                  { 
                    transform: [{ translateX: showUserProfile ? width * 0.065 : 0 }]
                  }
                ]}>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.profileContainer}>
            <TouchableOpacity 
              style={styles.profilePicture}
              onPress={() => {
                if (toggleCardPosition === 'left' && showUserProfile) {
                  // User profile - no image selection, just show profile image
                  return;
                } else {
                  // Opponent profile - allow image selection
                  handleImageSelection('alice');
                }
              }}
            >
              {toggleCardPosition === 'left' && showUserProfile ? (
                // User profile - show user image or initials
                renderProfileImage(userProfileImage, userDisplayName, true)
              ) : (
                // Opponent profile - show opponent image or initials
                renderProfileImage(opponentImages.alice, fencerNames.alice, false)
              )}
              {!(toggleCardPosition === 'left' && showUserProfile) && (
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Yellow Cards Display */}
          {aliceYellowCards.length > 0 && aliceRedCards.length === 0 && (
            <View style={styles.yellowCardsContainer}>
              {aliceYellowCards.map((cardNumber, index) => (
                <View key={index} style={styles.yellowCard}>
                  <Text style={styles.yellowCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Red Cards Display */}
          {aliceRedCards.length > 0 && (
            <View style={styles.redCardsContainer}>
              {aliceRedCards.map((cardNumber, index) => (
                <View key={index} style={styles.redCard}>
                  <Text style={styles.redCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Priority Light Indicator */}
          {(isAssigningPriority || priorityFencer === 'alice') && (
            <View style={[
              styles.priorityLight,
              {
                backgroundColor: priorityLightPosition === 'left' ? Colors.yellow.accent : 'transparent',
                borderColor: priorityLightPosition === 'left' ? Colors.yellow.accent : 'transparent'
              }
            ]} />
          )}
          
          <TouchableOpacity 
            onPress={() => handleFencerNameClick('alice')}
            activeOpacity={0.7}
            style={styles.fencerNameContainer}
          >
            <Text 
              style={[styles.fencerName, {color: 'black'}]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {toggleCardPosition === 'left' && showUserProfile ? userDisplayName.split(' ')[0] : fencerNames.alice.split(' ')[0]}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.fencerScore, {color: 'black'}]}>{aliceScore.toString().padStart(2, '0')}</Text>
          
          <View style={styles.scoreControls}>
            <TouchableOpacity style={[styles.scoreButton, {
              backgroundColor: 'rgb(255,255,255)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.1)'
            }]} onPress={decrementAliceScore}>
              <Ionicons name="remove" size={28} color="black" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.scoreButton, {
              backgroundColor: 'rgb(255,255,255)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.1)'
            }]} onPress={incrementAliceScore}>
              <Ionicons name="add" size={28} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Fencers Button */}
        <LinearGradient
          colors={['#D6A4F0', '#969DFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.swapButton, { position: 'absolute', zIndex: 10, alignSelf: 'center' }]}
        >
          <TouchableOpacity 
            style={{ 
              width: '100%', 
              height: '100%', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }} 
            onPress={swapFencers}
          >
            <Ionicons name="swap-horizontal" size={28} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Bob's Card */}
        <View style={[
          styles.fencerCard, 
          {backgroundColor: 'rgb(176,232,236)'},
          // Make fencer card smaller when timer is ready AND cards are present
          (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
            width: width * 0.42, // Keep width at 0.42 (same as non-conditional)
            padding: width * 0.03, // Reduce padding from 0.04 to 0.03
            minHeight: height * 0.22, // Reduce height from 0.25 to 0.22
          } : 
          // Make fencer cards longer when match is in progress and no cards issued
          (hasMatchStarted && aliceYellowCards.length === 0 && aliceRedCards.length === 0 && bobYellowCards.length === 0 && bobRedCards.length === 0) ? {
            width: width * 0.42, // Keep width at 0.42
            padding: width * 0.04, // Keep normal padding
            minHeight: height * 0.32, // Increase height from 0.25 to 0.32
          } : {}
        ]}>
          {/* Sliding Switch - Top Right - Only show when toggle is on right card */}
          {toggleCardPosition === 'right' && (
            <View style={[styles.slidingSwitch, { 
              position: 'absolute', 
              top: width * 0.02, 
              right: width * 0.02, // Position on right side instead of left
              zIndex: 5 
            }]}>
              <TouchableOpacity 
                style={[
                  styles.switchTrack, 
                  { backgroundColor: showUserProfile ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' }
                ]}
                onPress={() => setShowUserProfile(!showUserProfile)}
              >
                <View style={[
                  styles.switchThumb, 
                  { 
                    transform: [{ translateX: showUserProfile ? width * 0.065 : 0 }]
                  }
                ]}>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.profileContainer}>
            <TouchableOpacity 
              style={styles.profilePicture}
              onPress={() => {
                if (toggleCardPosition === 'right' && showUserProfile) {
                  // User profile - no image selection, just show profile image
                  return;
                } else {
                  // Opponent profile - allow image selection
                  handleImageSelection('bob');
                }
              }}
            >
              {toggleCardPosition === 'right' && showUserProfile ? (
                // User profile - show user image or initials
                renderProfileImage(userProfileImage, userDisplayName, true)
              ) : (
                // Opponent profile - show opponent image or initials
                renderProfileImage(opponentImages.bob, fencerNames.bob, false)
              )}
              {!(toggleCardPosition === 'right' && showUserProfile) && (
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Yellow Cards Display */}
          {bobYellowCards.length > 0 && bobRedCards.length === 0 && (
            <View style={styles.yellowCardsContainer}>
              {bobYellowCards.map((cardNumber, index) => (
                <View key={index} style={styles.yellowCard}>
                  <Text style={styles.yellowCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Red Cards Display */}
          {bobRedCards.length > 0 && (
            <View style={styles.redCardsContainer}>
              {bobRedCards.map((cardNumber, index) => (
                <View key={index} style={styles.redCard}>
                  <Text style={styles.redCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Priority Light Indicator */}
          {(isAssigningPriority || priorityFencer === 'bob') && (
            <View style={[
              priorityLightPosition === 'right' ? styles.priorityLightRight : styles.priorityLight,
              {
                backgroundColor: priorityLightPosition === 'right' ? Colors.yellow.accent : 'transparent',
                borderColor: priorityLightPosition === 'right' ? Colors.yellow.accent : 'transparent'
              }
            ]} />
          )}
          
          <TouchableOpacity 
            onPress={() => handleFencerNameClick('bob')}
            activeOpacity={0.7}
            style={styles.fencerNameContainer}
          >
            <Text 
              style={[styles.fencerName, {color: 'black'}]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {toggleCardPosition === 'right' && showUserProfile ? userDisplayName.split(' ')[0] : fencerNames.bob.split(' ')[0]}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.fencerScore, {color: 'black'}]}>{bobScore.toString().padStart(2, '0')}</Text>
          
          <View style={styles.scoreControls}>
            <TouchableOpacity style={[styles.scoreButton, {
              backgroundColor: 'rgb(255,255,255)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.1)'
            }]} onPress={decrementBobScore}>
              <Ionicons name="remove" size={28} color="black" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.scoreButton, {
              backgroundColor: 'rgb(255,255,255)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.1)'
            }]} onPress={incrementBobScore}>
              <Ionicons name="add" size={28} color="black" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={[
        styles.bottomControls,
        // Only make controls smaller when timer is ready AND cards are present
        (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
          marginBottom: height * 0.002, // Reduce bottom margin
          gap: width * 0.03, // Reduce gap between elements
        } : {}
      ]}>
        <View style={[
          styles.decorativeCards,
          // Only make cards smaller when timer is ready AND cards are present
          (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
            gap: width * 0.02, // Reduce gap between cards
          } : {}
        ]}>
          <TouchableOpacity style={[
            styles.decorativeCard, 
            styles.cardYellow,
            // Only make individual cards smaller when timer is ready AND cards are present
            (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
              width: width * 0.07, // Reduce width
              height: width * 0.10, // Reduce height
            } : {}
          ]} onPress={addYellowCardToAlice}>
            {aliceYellowCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.yellow.accent }]}>
                {aliceYellowCards.length}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[
            styles.decorativeCard, 
            styles.cardRed,
            // Only make individual cards smaller when timer is ready AND cards are present
            (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
              width: width * 0.07, // Reduce width
              height: width * 0.10, // Reduce height
            } : {}
          ]} onPress={addRedCardToAlice}>
            {aliceRedCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.red.accent }]}>
                {aliceRedCards[0]}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.assignPriorityButton, 
            {
              backgroundColor: (currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ?
                Colors.yellow.accent :
                hasMatchStarted ? (isInjuryTimer ? '#EF4444' : Colors.purple.primary) : '#6B7280'
            },
            // Only make button smaller when timer is ready AND cards are present
            (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
              paddingHorizontal: width * 0.025, // Reduce horizontal padding
              paddingVertical: height * 0.010, // Reduce vertical padding
            } : {},
            // Grey out when match hasn't started
            !hasMatchStarted && {
              opacity: 0.6
            }
          ]}
          onPress={
            hasMatchStarted ? (
              (currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ?
                () => setShowPriorityPopup(true) :
                (isInjuryTimer ? skipInjuryTimer : startInjuryTimer)
            ) : undefined
          }
          disabled={!hasMatchStarted}
        >
          <Text style={styles.assignPriorityIcon}>
            {(currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ? '🎲' : '🏥'}
          </Text>
          <Text style={styles.assignPriorityText}>
            {(currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ?
              'Assign Priority' :
              (isInjuryTimer ? 'Skip Injury' : 'Injury Timer')
            }
          </Text>
        </TouchableOpacity>
        <View style={[
          styles.decorativeCards,
          // Only make cards smaller when timer is ready AND cards are present
          (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
            gap: width * 0.02, // Reduce gap between cards
          } : {}
        ]}>
          <TouchableOpacity style={[
            styles.decorativeCard, 
            styles.cardYellow,
            // Only make individual cards smaller when timer is ready AND cards are present
            (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
              width: width * 0.07, // Reduce width
              height: width * 0.10, // Reduce height
            } : {}
          ]} onPress={addYellowCardToBob}>
            {bobYellowCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.yellow.accent }]}>
                {bobYellowCards.length}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[
            styles.decorativeCard, 
            styles.cardRed,
            // Only make individual cards smaller when timer is ready AND cards are present
            (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
              width: width * 0.07, // Reduce width
              height: width * 0.10, // Reduce height
            } : {}
          ]} onPress={addRedCardToBob}>
            {bobRedCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.red.accent }]}>
                {bobRedCards[0]}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

              {/* Play, Reset, and Complete Match Controls - REBUILT */}
              <View style={[
          {
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          marginVertical: height * 0.012,
          marginTop: height * 0.006,
          paddingHorizontal: width * 0.04,
            backgroundColor: 'transparent',
          borderRadius: width * 0.02,
          gap: height * 0.012, // Reduced gap between elements
          marginBottom: layout.adjustMargin(height * 0.02, 'bottom') + layout.getPlatformAdjustments().bottomNavOffset
          }
        ]}>
        
        {/* Play and Reset Row */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}>
          {/* Play Button / Skip Button */}
          <TouchableOpacity 
            style={{
              flex: 1,
              backgroundColor: '#2A2A2A',
              paddingVertical: layout.adjustPadding(height * 0.045, 'bottom'), // Increased from 0.035
              paddingHorizontal: width * 0.05,
              borderRadius: width * 0.02,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginRight: width * 0.025,
              borderWidth: width * 0.005,
              borderColor: 'white',
              minHeight: layout.adjustPadding(height * 0.14, 'bottom'), // Increased from 0.12
              opacity: (timeRemaining === 0 && !isBreakTime && !isInjuryTimer) ? 0.6 : 1
            }} 
            onPress={async () => {
              console.log('Play button onPress started - isInjuryTimer:', isInjuryTimer, 'isBreakTime:', isBreakTime, 'timeRemaining:', timeRemaining);
              
              // Skip button during injury time
              if (isInjuryTimer) {
                console.log('Skipping - injury timer active');
                skipInjuryTimer();
                return;
              }
              
              // Skip button during break time
              if (isBreakTime) {
                console.log('Skipping - break time active');
                skipBreak();
                return;
              }
              
              // Prevent action when timer is at 0:00
              if (timeRemaining === 0) {
                console.log('Skipping - timer at 0:00');
                return;
              }
              
              console.log('Play button pressed - isPlaying:', isPlaying, 'timeRemaining:', timeRemaining, 'matchTime:', matchTime);
              // Use the togglePlay function which handles all cases correctly
              console.log('About to call togglePlay...');
              try {
                await togglePlay();
                console.log('togglePlay completed successfully');
              } catch (error) {
                console.error('Error in togglePlay:', error);
              }
            }}
          >
            <Ionicons 
              name={
                isInjuryTimer ? 'play-forward' : 
                isBreakTime ? 'play-forward' : 
                isPlaying ? 'pause' : 
                'play'
              }
              size={width * 0.045} 
              color="white" 
              style={{marginRight: width * 0.015}}
            />
            <Text style={{fontSize: width * 0.035, fontWeight: '600', color: 'white'}}>
              {isInjuryTimer ? 'Skip Injury' : 
               isBreakTime ? 'Skip Break' : 
               isPlaying ? 'Pause' : 
               (!isPlaying && timeRemaining < matchTime && timeRemaining > 0) ? 'Resume' : 'Play'}
            </Text>
          </TouchableOpacity>
          
          {/* Reset Button */}
                      <TouchableOpacity 
              style={{
              width: width * 0.15,
                backgroundColor: '#FB5D5C',
              paddingVertical: layout.adjustPadding(height * 0.012, 'bottom'),
              borderRadius: width * 0.05,
                alignItems: 'center',
                justifyContent: 'center',
              borderWidth: width * 0.005,
                borderColor: 'transparent',
              minHeight: layout.adjustPadding(height * 0.055, 'bottom'),
              shadowColor: '#6C5CE7',
              shadowOffset: { width: 0, height: height * 0.005 },
              shadowOpacity: 0.25,
              shadowRadius: width * 0.035,
              elevation: 8
            }} 
            onPress={resetTimer}
          >
            <Ionicons name="refresh" size={24} color="white" />
          </TouchableOpacity>
        </View>

      </View>

      {/* Edit Time Popup */}
      {showEditPopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>Edit Match Time</Text>
            <TextInput
              style={styles.timeInput}
              value={editTimeInput}
              onChangeText={handleTimeInputChange}
              onSelectionChange={handleTimeInputSelectionChange}
              placeholder="0:00"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              keyboardType="numeric"
              autoFocus
              maxLength={5}
              selectTextOnFocus
              contextMenuHidden={false}
            />
            <Text style={styles.inputHint}>Format: M:SS or MM:SS</Text>
            <View style={styles.popupButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTime}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Reset Options Popup */}
      {showResetPopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>Reset Options</Text>
            <Text style={styles.inputHint}>What would you like to reset?</Text>
            <View style={styles.popupButtons}>
              <TouchableOpacity style={styles.saveButton} onPress={() => {
                resetScores();
                setShowResetPopup(false);
              }}>
                <Text style={styles.saveButtonText}>Reset Scores</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => {
                resetTime();
                setShowResetPopup(false);
              }}>
                <Text style={styles.saveButtonText}>Reset Time</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => {
                resetPeriod();
                setShowResetPopup(false);
              }}>
                <Text style={styles.saveButtonText}>Reset Period</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: Colors.yellow.accent }]} onPress={() => {
                resetAllCards();
                setShowResetPopup(false);
              }}>
                <Text style={styles.saveButtonText}>Reset Cards</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: Colors.red.accent }]} onPress={async () => {
                await resetAll();
                setShowResetPopup(false);
              }}>
                <Text style={styles.saveButtonText}>Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowResetPopup(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit Names Popup */}
      {showEditNamesPopup && (
        <View style={styles.popupOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={[styles.popupContainer, { marginTop: height * 0.1 }]}>
              <Text style={styles.popupTitle}>Edit Fencer Names</Text>
              <Text style={styles.inputHint}>Enter new names for both fencers:</Text>
              
              <View style={styles.nameInputContainer}>
                <Text style={styles.nameInputLabel}>
                  Left Fencer {showUserProfile && toggleCardPosition === 'left' ? '(You)' : ''}:
                </Text>
                <TextInput
                  style={[
                    styles.nameInput,
                    showUserProfile && toggleCardPosition === 'left' && { 
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.5)'
                    }
                  ]}
                  value={editAliceName}
                  onChangeText={showUserProfile && toggleCardPosition === 'left' ? undefined : setEditAliceName}
                  placeholder={showUserProfile && toggleCardPosition === 'left' ? "Your name (auto-filled)" : "Enter name"}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  autoFocus={!(showUserProfile && toggleCardPosition === 'left')}
                  maxLength={20}
                  returnKeyType="next"
                  editable={!(showUserProfile && toggleCardPosition === 'left')}
                />
              </View>
              
              <View style={styles.nameInputContainer}>
                <Text style={styles.nameInputLabel}>
                  Right Fencer {showUserProfile && toggleCardPosition === 'right' ? '(You)' : ''}:
                </Text>
                <TextInput
                  style={[
                    styles.nameInput,
                    showUserProfile && toggleCardPosition === 'right' && { 
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.5)'
                    }
                  ]}
                  value={editBobName}
                  onChangeText={showUserProfile && toggleCardPosition === 'right' ? undefined : setEditBobName}
                  placeholder={showUserProfile && toggleCardPosition === 'right' ? "Your name (auto-filled)" : "Enter name"}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  autoFocus={showUserProfile && toggleCardPosition === 'right'}
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={saveFencerName}
                  editable={!(showUserProfile && toggleCardPosition === 'right')}
                />
              </View>
              
              <View style={styles.popupButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={cancelEditName}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={saveFencerName}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}



      {/* Score Warning Popup */}
      {showScoreWarning && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>⚠️ Multiple Score Changes</Text>
            <Text style={styles.inputHint}>
              You have increased or decreased the score more than once during this active match. Are you sure you want to do this?
            </Text>
            
            <View style={styles.popupButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => {
                setShowScoreWarning(false);
                setPendingScoreAction(null);
                setScoreChangeCount(0); // Reset counter
              }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => {
                if (pendingScoreAction) {
                  pendingScoreAction();
                }
                setShowScoreWarning(false);
                setPendingScoreAction(null);
              }}>
                <Text style={styles.saveButtonText}>Yes, Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Priority Assignment Popup */}
      {showPriorityPopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>🏁 Match Ended in Tie!</Text>
            <Text style={styles.inputHint}>
              The match ended with a score of {aliceScore}-{bobScore} after Period 3. Would you like to assign priority to determine the winner?
            </Text>
            
            <View style={styles.popupButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPriorityPopup(false)}>
                <Text style={styles.cancelButtonText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={autoAssignPriority}>
                <Text style={styles.saveButtonText}>Yes, Assign Priority</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Image Picker Modal */}
      {showImagePicker && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>Select Image</Text>
            <Text style={styles.popupMessage}>
              Choose how you want to add a photo for {selectedFencer === 'alice' ? fencerNames.alice : fencerNames.bob}
            </Text>
            <View style={styles.popupButtons}>
              <TouchableOpacity 
                style={[popupButtonStyles.popupButton, popupButtonStyles.popupButtonSecondary]} 
                onPress={() => setShowImagePicker(false)}
              >
                <Text style={popupButtonStyles.popupButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[popupButtonStyles.popupButton, popupButtonStyles.popupButtonPrimary]} 
                onPress={() => pickImage('camera')}
              >
                <Text style={popupButtonStyles.popupButtonPrimaryText}>📷 Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[popupButtonStyles.popupButton, popupButtonStyles.popupButtonPrimary]} 
                onPress={() => pickImage('library')}
              >
                <Text style={popupButtonStyles.popupButtonPrimaryText}>🖼️ Photo Library</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
          </View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

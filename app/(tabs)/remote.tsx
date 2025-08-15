import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';

export default function RemoteScreen() {
  const { width, height } = useWindowDimensions();
  
  const [currentPeriod, setCurrentPeriod] = useState(3);
  const [aliceScore, setAliceScore] = useState(3);
  const [bobScore, setBobScore] = useState(2);
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
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [fencerNames, setFencerNames] = useState({ alice: 'Alice', bob: 'Bob' });
  const [showEditNamesPopup, setShowEditNamesPopup] = useState(false);
  const [editAliceName, setEditAliceName] = useState('');
  const [editBobName, setEditBobName] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  const [swipeProgress, setSwipeProgress] = useState(0); // 0 to 1 for swipe progress
  const [isSwiping, setIsSwiping] = useState(false);
  const [pulseOpacity, setPulseOpacity] = useState(1); // For pulsing animation
  const [isBreakTime, setIsBreakTime] = useState(false); // For break timer
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(60); // 1 minute break
  const [breakTimerRef, setBreakTimerRef] = useState<number | null>(null); // Break timer reference
  const [isManualReset, setIsManualReset] = useState(false); // Flag to prevent auto-sync during manual reset

  // Use useRef for timer to ensure proper cleanup
  const timerRef = useRef<number | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (breakTimerRef) {
        clearInterval(breakTimerRef);
      }
    };
  }, [breakTimerRef]);

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

  const incrementPeriod = () => {
    if (currentPeriod < 5) setCurrentPeriod(currentPeriod + 1);
  };

  const decrementPeriod = () => {
    if (currentPeriod > 1) setCurrentPeriod(currentPeriod - 1);
  };

  const incrementAliceScore = () => setAliceScore(aliceScore + 1);
  const decrementAliceScore = () => setAliceScore(Math.max(0, aliceScore - 1));
  const incrementBobScore = () => setBobScore(bobScore + 1);
  const decrementBobScore = () => setBobScore(Math.max(0, bobScore - 1));

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPlaying(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Start timer
      setIsPlaying(true);
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
          
          // Ask user if they want a break
          Alert.alert(
            'Match Time Complete!',
            'Would you like to take a 1-minute break?',
            [
              { 
                text: 'No', 
                style: 'cancel',
                onPress: () => {
                  // Automatically increment period and prepare for next round
                  const newPeriod = Math.min(currentPeriod + 1, 5);
                  
                  // Update period first
                  setCurrentPeriod(newPeriod);
                  
                  // Update timer
                  setTimeRemaining(matchTime);
                  
                  // Ensure timer is not playing
                  setIsPlaying(false);
                  
                  // Show confirmation with new period value
                  setTimeout(() => {
                    Alert.alert('Next Round!', `Period ${newPeriod} ready. Timer set to ${formatTime(matchTime)}.`);
                  }, 100);
                  
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              },
              { 
                text: 'Yes', 
                onPress: () => {
                  // Start break timer
                  startBreakTimer();
                }
              }
            ]
          );
        }
      }, 100); // Update more frequently for smoother countdown
    }
  }, [isPlaying, timeRemaining, currentPeriod, matchTime]);

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
    // Reset only the timer, keep current period
    setMatchTime(180); // 3 minutes in seconds
    setTimeRemaining(180); // Same as matchTime = no paused state
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsManualReset(true); // Set flag to prevent auto-sync
  }, []);

  const resetAll = useCallback(() => {
    setTimeRemaining(180);
    setMatchTime(180);
    setCurrentPeriod(1);
    setAliceScore(0);
    setBobScore(0);
    setBreakTimeRemaining(0);
    setIsBreakTime(false);
    setIsPlaying(false);
    setSwipeProgress(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const swapFencers = useCallback(() => {
    if (isSwapping) return; // Prevent multiple swaps during animation
    
    setIsSwapping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate the swap
    setTimeout(() => {
      setFencerPositions(prev => ({
        alice: prev.alice === 'left' ? 'right' : 'left',
        bob: prev.bob === 'left' ? 'right' : 'left'
      }));
      
      // Reset swapping state after animation
      setTimeout(() => {
        setIsSwapping(false);
      }, 300);
    }, 150);
  }, [isSwapping]);

  const toggleUserProfile = useCallback(() => {
    setShowUserProfile(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const openEditNamesPopup = useCallback(() => {
    setEditAliceName(fencerNames.alice);
    setEditBobName(fencerNames.bob);
    setShowEditNamesPopup(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [fencerNames]);

  const saveFencerName = useCallback(() => {
    if (editAliceName.trim() && editBobName.trim()) {
      setFencerNames({
        alice: editAliceName.trim(),
        bob: editBobName.trim()
      });
      setShowEditNamesPopup(false);
      setEditAliceName('');
      setEditBobName('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [editAliceName, editBobName]);

  const cancelEditName = useCallback(() => {
    setShowEditNamesPopup(false);
    setEditAliceName('');
    setEditBobName('');
  }, []);

  const resetTimer = useCallback(() => {
    // Show custom reset options popup
    setShowResetPopup(true);
  }, []);

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isPlaying]);

  const resumeTimer = useCallback(() => {
    if (!isPlaying && timeRemaining > 0) {
      setIsPlaying(true);
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
          // Show alert when timer completes
          Alert.alert('Time Up!', 'The match time has expired.', [
            { text: 'OK', onPress: () => setTimeRemaining(0) }
          ]);
        }
      }, 100); // Update more frequently for smoother countdown
    }
  }, [isPlaying, timeRemaining]);

  const addTime = useCallback((seconds: number) => {
    if (isPlaying || (!isPlaying && timeRemaining > 0 && timeRemaining < matchTime)) {
      // When actively playing or paused, don't allow adding time
      return;
    } else {
      // Only allow adding time when timer is ready (not started yet)
      setTimeRemaining(prev => prev + seconds);
      setMatchTime(prev => prev + seconds);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isPlaying, timeRemaining, matchTime]);

  const subtractTime = useCallback((seconds: number) => {
    if (isPlaying || (!isPlaying && timeRemaining > 0 && timeRemaining < matchTime)) {
      // When actively playing or paused, don't allow subtracting time
      return;
    } else {
      // Only allow subtracting time when timer is ready (not started yet)
      setTimeRemaining(prev => Math.max(0, prev - seconds));
      setMatchTime(prev => Math.max(0, prev - seconds)); // Allow going to 0
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isPlaying, timeRemaining, matchTime]);

  const startBreakTimer = useCallback(() => {
    console.log('Starting break timer');
    setIsBreakTime(true);
    setBreakTimeRemaining(60); // 1 minute
    
    const interval = setInterval(() => {
      setBreakTimeRemaining(prev => {
        if (prev <= 0) {
          // Break finished
          console.log('Break finished, incrementing period');
          clearInterval(interval);
          setIsBreakTime(false);
          setBreakTimeRemaining(60);
          
          // Increment period
          setCurrentPeriod(prev => {
            const newPeriod = Math.min(prev + 1, 5);
            console.log('Break: Setting new period to:', newPeriod);
            return newPeriod;
          });
          
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
  }, [matchTime]);

  const handleSwipeGesture = (event: any) => {
    const { translationX, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      setIsSwiping(true);
      // Calculate progress based on swipe distance (responsive width)
      const maxSwipeDistance = width * 0.9; // 90% of screen width
      const progress = Math.max(0, Math.min(1, translationX / maxSwipeDistance));
      setSwipeProgress(progress);
    } else if (state === State.END) {
      setIsSwiping(false);
      if (swipeProgress >= 0.8) { // 80% swipe required to complete
        // Complete the match
        Alert.alert('Match Completed!', 'The match has been completed successfully.');
        setSwipeProgress(0); // Reset progress
      } else {
        // Reset progress if not swiped far enough
        setSwipeProgress(0);
      }
    }
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
      padding: '3%',
      paddingTop: height * 0.04,
      paddingBottom: height * 0.02,
      overflow: 'hidden',
    },
    
    // Match Timer Section
    matchTimerCard: {
      backgroundColor: 'rgba(76, 29, 149, 0.4)',
      borderWidth: 2,
      borderColor: 'rgba(168, 85, 247, 0.6)',
      borderRadius: width * 0.04,
      padding: width * 0.01,
      marginTop: height * 0.03,
      marginBottom: height * 0.003,
      position: 'relative',
    },
    timerLabel: {
      backgroundColor: Colors.yellow.accent,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.004,
      borderRadius: width * 0.04,
      position: 'absolute',
      top: height * -0.01,
      left: '50%',
      transform: [{ translateX: -width * 0.08 }],
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
      height: height * 0.08,
      width: '100%',
    },
    countdownText: {
      fontSize: width * 0.12,
      color: 'white',
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    countdownTextWarning: {
      fontSize: width * 0.12,
      color: Colors.yellow.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    countdownTextDanger: {
      fontSize: width * 0.12,
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    countdownTextDangerPulse: {
      fontSize: width * 0.12,
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },

    timerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.01,
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
    periodControl: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgb(230,222,255)',
      borderRadius: width * 0.03,
      padding: width * 0.025,
      marginTop: height * 0.01,
      borderWidth: 1,
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
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
      borderWidth: 2,
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
      fontSize: width * 0.05,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.005,
      marginTop: height * -0.01,
    },
    fencersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.005,
    },
    editNamesButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editNamesButtonText: {
      fontSize: width * 0.04,
    },
    fencersContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: height * 0.015,
      gap: width * 0.03,
    },
    fencerCard: {
      width: width * 0.42,
      padding: width * 0.04,
      minHeight: height * 0.25,
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
      width: width * 0.16,
      height: width * 0.16,
      borderRadius: width * 0.08,
      backgroundColor: Colors.gray.medium,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    profileInitial: {
      fontSize: width * 0.075,
      fontWeight: '700',
      color: 'white',
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
      fontSize: width * 0.055,
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.006,
    },
    fencerScore: {
      fontSize: width * 0.105,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.015,
    },
    scoreControls: {
      flexDirection: 'row',
      gap: width * 0.045,
    },
    scoreButton: {
      width: width * 0.105,
      height: width * 0.105,
      borderRadius: width * 0.0525,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    scoreButtonText: {
      fontSize: width * 0.075,
      fontWeight: '700',
      color: 'white',
    },
    swapButton: {
      width: width * 0.13,
      height: width * 0.13,
      borderRadius: width * 0.065,
      backgroundColor: Colors.purple.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    swapIcon: {
      fontSize: width * 0.065,
    },

    // Bottom Controls
    bottomControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.015,
    },
    decorativeCards: {
      flexDirection: 'row',
      gap: width * 0.02,
    },
    decorativeCard: {
      width: width * 0.04,
      height: width * 0.04,
      borderRadius: width * 0.01,
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
    assignPriorityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.02,
      backgroundColor: Colors.purple.primary,
      paddingHorizontal: width * 0.03,
      paddingVertical: height * 0.012,
      borderRadius: width * 0.03,
    },
    assignPriorityIcon: {
      fontSize: width * 0.05,
    },
    assignPriorityText: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
    },

    // Play Controls
    playControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.01,
      gap: width * 0.04,
      width: '100%',
    },
    playButton: {
      flex: 1,
      marginRight: width * 0.04,
      backgroundColor: Colors.green.accent,
      paddingVertical: height * 0.012,
      borderRadius: width * 0.03,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: width * 0.02,
    },
    playIcon: {
      fontSize: width * 0.05,
    },
    playText: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
    },
    resetButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetIcon: {
      fontSize: width * 0.05,
    },

    // Swipe to Complete Styles
    swipeContainer: {
      marginBottom: height * 0.01,
      alignItems: 'center',
      overflow: 'hidden',
    },
    swipeTrack: {
      width: width * 0.95,
      height: height * 0.05,
      backgroundColor: '#6A35F7',
      borderRadius: height * 0.01,
      position: 'relative',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    swipeMainText: {
      fontSize: width * 0.04,
      fontWeight: '700',
      color: 'white',
      textAlign: 'center',
      position: 'absolute',
      width: '100%',
      zIndex: 1,
    },
    swipeThumb: {
      position: 'absolute',
      left: width * 0.01,
      top: height * 0.003,
      width: width * 0.1,
      height: width * 0.1,
      backgroundColor: 'white',
      borderRadius: width * 0.025,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 2,
    },
    swipeThumbText: {
      fontSize: width * 0.045,
      color: '#374151',
      fontWeight: '700',
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
      width: '80%',
      maxWidth: width * 0.75,
      alignItems: 'center',
    },
    popupTitle: {
      fontSize: width * 0.045,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.025,
      textAlign: 'center',
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
      width: width * 0.25,
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
      width: width * 0.25,
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
      marginTop: height * 0.005,
      marginBottom: height * 0.01,
      width: '100%',
    },
    addTimeButton: {
      backgroundColor: Colors.purple.primary,
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.008,
      minWidth: width * 0.18,
      alignItems: 'center',
    },
    addTimeButtonText: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
    },

    // Timer Progress Bar
    timerProgressContainer: {
      width: '100%',
      height: height * 0.008,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: height * 0.004,
      marginBottom: height * 0.008,
      overflow: 'hidden',
    },
    timerProgressBar: {
      height: '100%',
      backgroundColor: 'transparent',
      borderRadius: height * 0.004,
    },
    timerProgressFill: {
      height: '100%',
      borderRadius: height * 0.004,
    },
    countdownWarningText: {
      fontSize: width * 0.04,
      color: Colors.yellow.accent,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: height * 0.005,
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
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
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
    },
  });

  return (
    <View style={styles.container}>
      {/* Match Timer Section */}
      <View style={styles.matchTimerCard}>
        <View style={styles.timerHeader}>
          <View style={styles.timerLabel}>
            <Text style={styles.timerLabelText}>Match Timer</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleEditTime}>
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.timerDisplay}>
          {/* Timer Progress Bar */}
          {isPlaying && (
            <View style={styles.timerProgressContainer}>
              <View style={styles.timerProgressBar}>
                <View 
                  style={[
                    styles.timerProgressFill, 
                    { 
                      width: `${(timeRemaining / matchTime) * 100}%`,
                      backgroundColor: timeRemaining <= 30 ? Colors.red.accent : 
                                   timeRemaining <= 60 ? Colors.yellow.accent : Colors.green.accent
                    }
                  ]} 
                />
              </View>
            </View>
          )}
          
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
                <Text style={styles.countdownWarningText}>
                  ⚠️ Time is running out!
                </Text>
              )}
              
              {/* Final countdown warning */}
              {timeRemaining <= 10 && timeRemaining > 0 && (
                <Text style={[styles.countdownWarningText, { color: Colors.red.accent, fontSize: width * 0.045 }]}>
                  🚨 FINAL COUNTDOWN!
                </Text>
              )}
            </View>
          )}
          
          {/* Break Timer Display - shows when break is active */}
          {isBreakTime && (
            <View style={styles.countdownDisplay}>
              <Text style={[styles.countdownText, { color: Colors.yellow.accent }]}>
                {formatTime(breakTimeRemaining)}
              </Text>
              <Text style={styles.countdownWarningText}>
                🍃 Break Time - Period {currentPeriod}
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
        </View>
        
        {/* Add Time Controls */}
        {!isPlaying && timeRemaining === matchTime && (
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

        {/* Period Control - moved to bottom of card */}
        <View style={styles.periodControl}>
          <TouchableOpacity style={styles.periodButton} onPress={decrementPeriod}>
            <Text style={styles.periodButtonText}>-</Text>
          </TouchableOpacity>
          <View style={styles.periodDisplay}>
            <Text style={styles.periodText}>Period</Text>
            <Text style={styles.periodNumber}>{currentPeriod}/3</Text>
          </View>
          <TouchableOpacity style={styles.periodButton} onPress={incrementPeriod}>
            <Text style={styles.periodButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Match Status Display */}
      <View style={styles.matchStatusContainer}>
        <Text style={styles.matchStatusText}>
          {isBreakTime ? '🍃 Break Time' : isPlaying ? '🟢 Match in Progress' : timeRemaining === 0 ? '🔴 Match Ended' : timeRemaining < matchTime ? '⏸️ Match Paused' : '⚪ Timer Ready'}
        </Text>
        {isPlaying && (
          <Text style={styles.matchStatusSubtext}>
            Time remaining: {formatTime(timeRemaining)}
          </Text>
        )}
        {isBreakTime && (
          <Text style={styles.matchStatusSubtext}>
            Break time: {formatTime(breakTimeRemaining)} - Next: Period {Math.min(currentPeriod + 1, 5)}
          </Text>
        )}
      </View>

      {/* Fencers Section */}
      <View style={styles.fencersHeader}>
        <Text style={styles.fencersHeading}>Fencers</Text>
        <TouchableOpacity 
          style={styles.editNamesButton}
          onPress={openEditNamesPopup}
        >
          <Text style={styles.editNamesButtonText}>✏️</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.fencersContainer}>
        {/* Swap Button - positioned in front */}
        <TouchableOpacity style={[styles.swapButton, { position: 'absolute', zIndex: 10, left: width * 0.5 - width * 0.095 }]} onPress={swapFencers}>
          <Text style={styles.swapIcon}>↔️</Text>
        </TouchableOpacity>

        {/* Alice Card */}
        {fencerPositions.alice === 'left' ? (
          <View style={[styles.fencerCard, {backgroundColor: 'rgb(252,187,187)'}]}>
            {/* Sliding Switch - Top Left */}
            <View style={[styles.slidingSwitch, { 
              position: 'absolute', 
              top: width * 0.02, 
              left: width * 0.02, 
              zIndex: 5 
            }]}>
              <TouchableOpacity 
                style={[styles.switchTrack, { backgroundColor: showUserProfile ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' }]}
                onPress={toggleUserProfile}
              >
                <View style={[styles.switchThumb, { 
                  transform: [{ translateX: showUserProfile ? width * 0.065 : 0 }] 
                }]}>
                </View>
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileContainer}>
              <View style={styles.profilePicture}>
                <Text style={styles.profileInitial}>
                  {showUserProfile ? '👤' : '👨'}
                </Text>
                <View style={styles.cameraIcon}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
              </View>
            </View>
            
            <Text style={[styles.fencerName, {color: 'black'}]}>
              {showUserProfile ? 'You' : fencerNames.alice}
            </Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>-</Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.fencerCard, {backgroundColor: 'rgb(252,187,187)'}]}>
            {/* Sliding Switch - Top Left */}
            <View style={[styles.slidingSwitch, { 
              position: 'absolute', 
              top: width * 0.02, 
              left: width * 0.02, 
              zIndex: 5 
            }]}>
              <TouchableOpacity 
                style={[styles.switchTrack, { backgroundColor: showUserProfile ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' }]}
                onPress={toggleUserProfile}
              >
                <View style={[styles.switchThumb, { 
                  transform: [{ translateX: showUserProfile ? width * 0.065 : 0 }] 
                }]}>
                </View>
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileContainer}>
              <View style={styles.profilePicture}>
                <Text style={styles.profileInitial}>
                  {showUserProfile ? '👤' : '👨'}
                </Text>
                <View style={styles.cameraIcon}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
              </View>
            </View>
            
            <Text style={[styles.fencerName, {color: 'black'}]}>
              {showUserProfile ? 'You' : fencerNames.alice}
            </Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>-</Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bob Card */}
        {fencerPositions.bob === 'right' ? (
          <View style={[styles.fencerCard, {backgroundColor: 'rgb(176,232,236)'}]}>
            <View style={styles.profileContainer}>
              <View style={styles.profilePicture}>
                <Text style={styles.profileInitial}>👨</Text>
                <View style={styles.cameraIcon}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
              </View>
            </View>
            
            <Text style={[styles.fencerName, {color: 'black'}]}>{fencerNames.bob}</Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>-</Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.fencerCard, {backgroundColor: 'rgb(252,187,187)'}]}>
            <View style={styles.profileContainer}>
              <View style={styles.profilePicture}>
                <Text style={styles.profileInitial}>👨</Text>
                <View style={styles.cameraIcon}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
              </View>
            </View>
            
            <Text style={[styles.fencerName, {color: 'black'}]}>{fencerNames.alice}</Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>-</Text>
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
                <Text style={[styles.scoreButtonText, {color: 'black'}]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.decorativeCards}>
          <View style={[styles.decorativeCard, styles.cardRed]} />
          <View style={[styles.decorativeCard, styles.cardYellow]} />
          <View style={[styles.decorativeCard, styles.cardBlack]} />
        </View>
        
        <TouchableOpacity style={styles.assignPriorityButton}>
          <Text style={styles.assignPriorityIcon}>🎲</Text>
          <Text style={styles.assignPriorityText}>Assign Priority</Text>
        </TouchableOpacity>
        
        <View style={styles.decorativeCards}>
          <View style={[styles.decorativeCard, styles.cardBlack]} />
          <View style={[styles.decorativeCard, styles.cardRed]} />
          <View style={[styles.decorativeCard, styles.cardYellow]} />
        </View>
      </View>

      {/* Play and Reset Controls - REBUILT */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 10,
        marginTop: 5,
        paddingHorizontal: 15,
        backgroundColor: 'transparent',
        borderRadius: 8,
        minHeight: 60
      }}>
        
        {/* Play Button */}
        <TouchableOpacity 
          style={{
            flex: 1,
            backgroundColor: isPlaying ? '#F97316' : 
                             (!isPlaying && timeRemaining < matchTime && timeRemaining > 0) ? '#3B82F6' : 
                             '#10B981',
            paddingVertical: 10,
            paddingHorizontal: 15,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            marginRight: 8,
            borderWidth: 2,
            borderColor: 'white',
            minHeight: 45
          }} 
          onPress={() => {
            console.log('Play button pressed - isPlaying:', isPlaying, 'timeRemaining:', timeRemaining, 'matchTime:', matchTime);
            if (isPlaying) {
              console.log('Calling pauseTimer');
              pauseTimer();
            } else if (timeRemaining < matchTime && timeRemaining > 0) {
              console.log('Calling resumeTimer');
              resumeTimer();
            } else {
              console.log('Calling togglePlay');
              togglePlay();
            }
          }}
        >
          <Text style={{fontSize: 18, marginRight: 6}}>
            {isPlaying ? '⏸️' : '▶️'}
          </Text>
          <Text style={{fontSize: 14, fontWeight: '600', color: 'white'}}>
            {isPlaying ? 'Pause' : 
             (!isPlaying && timeRemaining < matchTime && timeRemaining > 0) ? 'Resume' : 'Play'}
          </Text>
        </TouchableOpacity>
        
        {/* Reset Button */}
        <TouchableOpacity 
          style={{
            width: 60,
            backgroundColor: '#374151',
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: 'white',
            minHeight: 45
          }} 
          onPress={resetTimer}
        >
          <Text style={{fontSize: 18}}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Swipe to Complete Match */}
      <GestureHandlerRootView>
        <PanGestureHandler onGestureEvent={handleSwipeGesture}>
          <View style={styles.swipeContainer}>
            <View style={styles.swipeTrack}>
              <Text style={styles.swipeMainText}>Complete The Match</Text>
              <View style={[styles.swipeThumb, { transform: [{ translateX: swipeProgress * (width * 0.6) }] }]}>
                <Text style={styles.swipeThumbText}>{'>>'}</Text>
              </View>
            </View>
          </View>
        </PanGestureHandler>
      </GestureHandlerRootView>

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
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: Colors.red.accent }]} onPress={() => {
                resetAll();
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
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>Edit Fencer Names</Text>
            <Text style={styles.inputHint}>Enter new names for both fencers:</Text>
            
            <View style={styles.nameInputContainer}>
              <Text style={styles.nameInputLabel}>Left Fencer:</Text>
              <TextInput
                style={styles.nameInput}
                value={editAliceName}
                onChangeText={setEditAliceName}
                placeholder="Enter name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                autoFocus
                maxLength={20}
              />
            </View>
            
            <View style={styles.nameInputContainer}>
              <Text style={styles.nameInputLabel}>Right Fencer:</Text>
              <TextInput
                style={styles.nameInput}
                value={editBobName}
                onChangeText={setEditBobName}
                placeholder="Enter name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                maxLength={20}
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
        </View>
      )}
    </View>
  );
}

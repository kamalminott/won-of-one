import { Colors } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';

export default function RemoteScreen() {
  const { width, height } = useWindowDimensions();
  
  const [currentPeriod, setCurrentPeriod] = useState(1);
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
  const [scoreChangeCount, setScoreChangeCount] = useState(0);
  const [showScoreWarning, setShowScoreWarning] = useState(false);
  const [pendingScoreAction, setPendingScoreAction] = useState<(() => void) | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  const [swipeProgress, setSwipeProgress] = useState(0); // 0 to 1 for swipe progress
  const [isSwiping, setIsSwiping] = useState(false);
  const [pulseOpacity, setPulseOpacity] = useState(1); // For pulsing animation
  const [isBreakTime, setIsBreakTime] = useState(false); // For break timer
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(60); // 1 minute break
  const [breakTimerRef, setBreakTimerRef] = useState<number | null>(null); // Break timer reference
  const [isManualReset, setIsManualReset] = useState(false); // Flag to prevent auto-sync during manual reset
  const [hasMatchStarted, setHasMatchStarted] = useState(false); // Track if match has been started
  const [isAssigningPriority, setIsAssigningPriority] = useState(false); // Track if priority is being assigned
  const [priorityLightPosition, setPriorityLightPosition] = useState<'left' | 'right' | null>(null); // Track where priority light is
  const [priorityFencer, setPriorityFencer] = useState<'alice' | 'bob' | null>(null); // Track which fencer has priority
  const [showPriorityPopup, setShowPriorityPopup] = useState(false); // Track if priority popup should be shown
  const [aliceYellowCards, setAliceYellowCards] = useState<number[]>([]); // Track Alice's yellow cards
  const [bobYellowCards, setBobYellowCards] = useState<number[]>([]); // Track Bob's yellow cards
  const [aliceRedCards, setAliceRedCards] = useState<number[]>([]); // Track Alice's red cards
  const [bobRedCards, setBobRedCards] = useState<number[]>([]); // Track Bob's red cards
  const [isInjuryTimer, setIsInjuryTimer] = useState(false); // Track if injury timer is active
  const [injuryTimeRemaining, setInjuryTimeRemaining] = useState(300); // 5 minutes in seconds
  const [injuryTimerRef, setInjuryTimerRef] = useState<number | null>(null); // Injury timer reference

  // Use useRef for timer to ensure proper cleanup
  const timerRef = useRef<number | null>(null);
  const currentPeriodRef = useRef<number>(1); // Ref to track current period value

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
    if (currentPeriod < 3) {
      const newPeriod = currentPeriod + 1;
      setCurrentPeriod(newPeriod);
      currentPeriodRef.current = newPeriod; // Update ref
    }
  };

  const decrementPeriod = () => {
    if (currentPeriod > 1) {
      const newPeriod = currentPeriod - 1;
      setCurrentPeriod(newPeriod);
      currentPeriodRef.current = newPeriod; // Update ref
    }
  };

  const incrementAliceScore = () => {
    // Only track score changes during active matches (when timer has started)
    if (isPlaying || (timeRemaining < matchTime && timeRemaining > 0)) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Changed from > 1 to >= 2 to show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setAliceScore(aliceScore + 1);
          setScoreChangeCount(0); // Reset counter
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setAliceScore(aliceScore + 1);
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
    } else {
      // Timer ready state or reset - no warning needed, just update score
      setAliceScore(aliceScore + 1);
      setScoreChangeCount(0); // Reset counter for new match
    }
  };
  
  const decrementAliceScore = () => {
    // Only track score changes during active matches (when timer has started)
    if (isPlaying || (timeRemaining < matchTime && timeRemaining > 0)) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Changed from > 1 to >= 2 to show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setAliceScore(Math.max(0, aliceScore - 1));
          setScoreChangeCount(0); // Reset counter
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setAliceScore(Math.max(0, aliceScore - 1));
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
    } else {
      // Timer ready state or reset - no warning needed, just update score
      setAliceScore(Math.max(0, aliceScore - 1));
      setScoreChangeCount(0); // Reset counter for new match
    }
  };
  
  const incrementBobScore = () => {
    // Only track score changes during active matches (when timer has started)
    if (isPlaying || (timeRemaining < matchTime && timeRemaining > 0)) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Changed from > 1 to >= 2 to show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setBobScore(bobScore + 1);
          setScoreChangeCount(0); // Reset counter
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setBobScore(bobScore + 1);
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
    } else {
      // Timer ready state or reset - no warning needed, just update score
      setBobScore(bobScore + 1);
      setScoreChangeCount(0); // Reset counter for new match
    }
  };
  
  const decrementBobScore = () => {
    // Only track score changes during active matches (when timer has started)
    if (isPlaying || (timeRemaining < matchTime && timeRemaining > 0)) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Changed from > 1 to >= 2 to show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setBobScore(Math.max(0, bobScore - 1));
          setScoreChangeCount(0); // Reset counter
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setBobScore(Math.max(0, bobScore - 1));
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
    } else {
      // Timer ready state or reset - no warning needed, just update score
      setBobScore(Math.max(0, bobScore - 1));
      setScoreChangeCount(0); // Reset counter for new match
    }
  };

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pauseTimer();
    } else {
      startTimer();
      setScoreChangeCount(0); // Reset score change counter when starting timer
    }
  }, [isPlaying, timeRemaining, matchTime]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsManualReset(true); // Set flag to prevent auto-sync
  }, []);

  const resetAll = useCallback(() => {
    // Stop timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (breakTimerRef) {
      clearInterval(breakTimerRef);
    }
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
    setPendingScoreAction(null); // Reset pending action
    setPriorityLightPosition(null); // Reset priority light
    setPriorityFencer(null); // Reset priority fencer
    setShowPriorityPopup(false); // Reset priority popup
    setAliceYellowCards([]); // Reset Alice's yellow cards
    setBobYellowCards([]); // Reset Bob's yellow cards
    setAliceRedCards([]); // Reset Alice's red cards
    setBobRedCards([]); // Reset Bob's red cards
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsManualReset(true); // Set flag to prevent auto-sync
  }, [breakTimerRef]);

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
      // Don't reset score change counter when pausing - keep tracking for the current match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isPlaying]);

  const startTimer = useCallback(() => {
    setIsPlaying(true);
    setHasMatchStarted(true); // Mark that match has been started
    setScoreChangeCount(0); // Reset score change counter when starting
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
                onPress: () => {
                  // Go to next period
                  const nextPeriod = currentPeriodValue + 1;
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
              { text: 'OK', onPress: () => setTimeRemaining(0) }
            ]);
          }
        }
      }
    }, 100); // Update more frequently for smoother countdown
  }, [timeRemaining, currentPeriod, matchTime]);

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
                  onPress: () => {
                    // Go to next period
                    const nextPeriod = currentPeriodValue + 1;
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
                { text: 'OK', onPress: () => setTimeRemaining(0) }
              ]);
            }
          }
        }
      }, 100); // Update more frequently for smoother countdown
    }
  }, [isPlaying, timeRemaining, currentPeriod, matchTime]);

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
          
          // Increment period
          setCurrentPeriod(prev => {
            const newPeriod = Math.min(prev + 1, 3);
            currentPeriodRef.current = newPeriod; // Update ref
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
  };

  const skipBreak = () => {
    // Stop break timer if running
    if (breakTimerRef) {
      clearInterval(breakTimerRef);
    }
    
    // Reset break state
    setIsBreakTime(false);
    setBreakTimeRemaining(60);
    
    // Increment period
    const nextPeriod = Math.min(currentPeriod + 1, 3);
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
    
    // Pause the main match timer if it's running
    if (isPlaying) {
      pauseTimer();
    }
    
    setIsInjuryTimer(true);
    setInjuryTimeRemaining(300); // 5 minutes
    
    // Start the injury countdown
    const interval = setInterval(() => {
      setInjuryTimeRemaining(prev => {
        if (prev <= 0) {
          // Injury time finished
          clearInterval(interval);
          setIsInjuryTimer(false);
          setInjuryTimeRemaining(300);
          
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

  const handleSwipeGesture = (event: any) => {
    const { translationX, state, velocityX } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      setIsSwiping(true);
      // Calculate progress based on full swipe box width minus button width
      const buttonWidth = height * 0.05; // Button width
      const maxSwipeDistance = (width * 0.95) - buttonWidth; // Full box width minus button width
      const progress = Math.max(0, Math.min(1, translationX / maxSwipeDistance));
      setSwipeProgress(progress);
      
      // Add haptic feedback during swipe
      if (progress > 0.5 && progress < 0.8) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else if (state === State.END) {
      setIsSwiping(false);
      
      // Check if swipe was completed based on distance and velocity
      const buttonWidth = height * 0.05;
      const maxSwipeDistance = (width * 0.95) - buttonWidth;
      const progress = Math.max(0, Math.min(1, translationX / maxSwipeDistance));
      const hasVelocity = Math.abs(velocityX) > 500; // Check if user swiped with intent
      
      if (progress >= 0.7 || (progress >= 0.5 && hasVelocity)) { // Lower threshold with velocity
        // Complete the match with haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Match Completed!', 'The match has been completed successfully.');
        setSwipeProgress(0); // Reset progress
      } else {
        // Reset progress with smooth animation
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const getTimerDisplayStyles = () => {
    // Timer Ready State (never started, can edit)
    if (!hasMatchStarted && !isPlaying && timeRemaining === matchTime) {
      return {
        timerDisplayMargin: height * 0.02, // Less margin for ready state
        progressBarMargin: height * 0.005, // Smaller progress bar margin
        showProgressBar: false // No progress bar in ready state
      };
    }
    
    // Match Active State (running or paused)
    if (hasMatchStarted && !isBreakTime) {
      return {
        timerDisplayMargin: height * 0.04, // More margin for active state
        progressBarMargin: height * 0.01, // Standard progress bar margin
        showProgressBar: true // Show progress bar
      };
    }
    
    // Break State
    if (isBreakTime) {
      return {
        timerDisplayMargin: height * 0.03, // Medium margin for break state
        progressBarMargin: height * 0.01, // Standard progress bar margin
        showProgressBar: false // No progress bar during break
      };
    }
    
    // Default state
    return {
      timerDisplayMargin: height * 0.03,
      progressBarMargin: height * 0.01,
      showProgressBar: false
    };
  };

  const timerStyles = getTimerDisplayStyles();

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
      transform: [{ translateX: -width * 0.08 }], // Moved more to the left
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
      height: height * 0.08, // Reverted back to original size
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
      marginTop: -(height * 0.015), // Reduced from -0.02 to prevent overlap with progress bar
    },
    countdownTextWarning: {
      fontSize: width * 0.12,
      color: Colors.yellow.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.015), // Reduced from -0.02 to prevent overlap with progress bar
    },
    countdownTextDanger: {
      fontSize: width * 0.12,
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.015), // Reduced from -0.02 to prevent overlap with progress bar
    },
    countdownTextDangerPulse: {
      fontSize: width * 0.12,
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.015), // Reduced from -0.02 to prevent overlap with progress bar
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
      marginTop: height * 0.01, // Reverted back to original size
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
      justifyContent: 'center',
      marginBottom: height * 0.005, // Reduced from 0.015 to 0.005
      gap: width * 0.05,
    },
    decorativeCards: {
      flexDirection: 'row',
      gap: width * 0.03,
    },
    decorativeCard: {
      width: width * 0.08,
      height: width * 0.12,
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
      marginTop: height * 0.01,
      marginLeft: width * 0.02,
    },
    yellowCard: {
      width: width * 0.06,
      height: width * 0.06,
      backgroundColor: Colors.yellow.accent,
      borderRadius: width * 0.015,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    yellowCardText: {
      fontSize: width * 0.035,
      color: 'white',
      fontWeight: '700',
    },
    redCardText: {
      fontSize: width * 0.035,
      color: 'white',
      fontWeight: '700',
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
      alignItems: 'center',
      overflow: 'visible', // Allow the button to move freely
    },
    swipeTrack: {
      width: width * 0.95,
      height: height * 0.05,
      backgroundColor: '#6A35F7',
      borderRadius: height * 0.01,
      position: 'relative',
      overflow: 'hidden', // Keep progress bar contained
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
    swipeProgressBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      borderRadius: height * 0.01,
      zIndex: 0,
    },
    swipeThumb: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: height * 0.05, // Same height as swipe box
      height: height * 0.05, // Same height as swipe box
      backgroundColor: 'white',
      borderRadius: height * 0.01, // Same border radius as swipe box
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3, // Match the swipe box shadow
      shadowRadius: 8, // Match the swipe box shadow
      elevation: 5,
      zIndex: 2,
      borderWidth: 1, // Add subtle border for definition
      borderColor: 'rgba(0, 0, 0, 0.1)', // Subtle border color
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
      fontSize: width * 0.03, // Reduced from 0.04 to 0.03 to fit better
      color: Colors.yellow.accent,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: height * 0.003, // Reduced from 0.005 to 0.003 for tighter spacing
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
      minWidth: width * 0.6,
    },
    priorityLight: {
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: width * 0.025,
      borderWidth: 2,
      borderColor: Colors.yellow.accent,
      position: 'absolute',
      top: width * 0.005,
      right: width * 0.005,
    },
    priorityLightRight: {
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: width * 0.025,
      borderWidth: 2,
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
      width: width * 0.06,
      height: width * 0.06,
      backgroundColor: Colors.red.accent,
      borderRadius: width * 0.015,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
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
    profileImage: {
      fontSize: width * 0.075,
      fontWeight: '700',
      color: 'white',
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
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
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
  });

  const addYellowCardToAlice = () => {
    if (aliceYellowCards.length > 0) {
      // Show popup asking if user wants to assign or remove
      Alert.alert(
        'Yellow Cards',
        'Alice already has yellow cards. What would you like to do?',
        [
          {
            text: 'Remove One',
            style: 'destructive',
            onPress: () => {
              setAliceYellowCards(prev => prev.slice(0, -1));
              // Recalculate red cards when removing yellow
              const newYellowCount = aliceYellowCards.length - 1;
              const newRedCount = Math.floor(newYellowCount / 2);
              setAliceRedCards(Array.from({ length: newRedCount }, (_, i) => i + 1));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          },
          {
            text: 'Add Another',
            onPress: () => {
              const newYellowCount = aliceYellowCards.length + 1;
              setAliceYellowCards(prev => [...prev, newYellowCount]);
              // Calculate red cards: every 2 yellow = 1 red
              const newRedCount = Math.floor(newYellowCount / 2);
              setAliceRedCards(Array.from({ length: newRedCount }, (_, i) => i + 1));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      // First card - add directly
      const newCardNumber = aliceYellowCards.length + 1;
      setAliceYellowCards(prev => [...prev, newCardNumber]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const addYellowCardToBob = () => {
    if (bobYellowCards.length > 0) {
      // Show popup asking if user wants to assign or remove
      Alert.alert(
        'Yellow Cards',
        'Bob already has yellow cards. What would you like to do?',
        [
          {
            text: 'Remove One',
            style: 'destructive',
            onPress: () => {
              setBobYellowCards(prev => prev.slice(0, -1));
              // Recalculate red cards when removing yellow
              const newYellowCount = bobYellowCards.length - 1;
              const newRedCount = Math.floor(newYellowCount / 2);
              setBobRedCards(Array.from({ length: newRedCount }, (_, i) => i + 1));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          },
          {
            text: 'Add Another',
            onPress: () => {
              const newYellowCount = bobYellowCards.length + 1;
              setBobYellowCards(prev => [...prev, newYellowCount]);
              // Calculate red cards: every 2 yellow = 1 red
              const newRedCount = Math.floor(newYellowCount / 2);
              setBobRedCards(Array.from({ length: newRedCount }, (_, i) => i + 1));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      // First card - add directly
      const newCardNumber = bobYellowCards.length + 1;
      setBobYellowCards(prev => [...prev, newCardNumber]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={styles.container}>
      {/* Match Timer Section */}
      <View style={styles.matchTimerCard}>
        <View style={styles.timerHeader}>
          <View style={styles.timerLabel}>
            <Text style={styles.timerLabelText}>Match Timer</Text>
          </View>
          {!isPlaying && !hasMatchStarted && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditTime}>
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Timer Progress Bar - moved outside to stay at top */}
        {timerStyles.showProgressBar && (
          <View style={[styles.timerProgressContainer, { marginTop: timerStyles.progressBarMargin }]}>
            <View style={styles.timerProgressBar}>
              <View 
                style={[
                  styles.timerProgressFill, 
                  { 
                    width: `${(timeRemaining / matchTime) * 100}%`,
                    backgroundColor: !isPlaying && timeRemaining > 0 && timeRemaining < matchTime ? 
                                 Colors.orange.accent : // Orange when paused
                                 timeRemaining <= 30 ? Colors.red.accent : 
                                 timeRemaining <= 60 ? Colors.yellow.accent : Colors.green.accent
                  }
                ]} 
              />
            </View>
          </View>
        )}
        
        <View style={[styles.timerDisplay, { marginTop: timerStyles.timerDisplayMargin }]}>
          {/* Debug overlay removed */}
           
           {/* Timer Progress Bar - REMOVED FROM HERE */}
          
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
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              borderWidth: 2,
              borderColor: '#EF4444',
              borderRadius: 12
            }]}>
              <Text style={[styles.countdownText, { color: '#EF4444', fontSize: width * 0.08 }]}>
                {formatTime(injuryTimeRemaining)}
              </Text>
              <Text style={[styles.countdownWarningText, { color: '#EF4444', fontSize: width * 0.035 }]}>
                🏥 INJURY TIME - 5:00
              </Text>
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
                    <Text style={styles.countdownWarningText}>
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
                    ⏰ Period {currentPeriod} Complete - Ready for Next!
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
        {isBreakTime && (
          <Text style={styles.matchStatusSubtext}>
            Break time: {formatTime(breakTimeRemaining)} - Next: Period {Math.min(currentPeriod + 1, 3)}
          </Text>
        )}
      </View>

      {/* Fencers Section */}
      <View style={[styles.fencersHeader, { marginTop: -(height * 0.015) }]}>
        <Text style={styles.fencersHeading}>Fencers</Text>
        <TouchableOpacity 
          style={styles.editNamesButton}
          onPress={openEditNamesPopup}
        >
          <Text style={styles.editNamesButtonText}>✏️</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.fencersContainer}>
        {/* Alice's Card */}
        <View style={[styles.fencerCard, { backgroundColor: 'rgb(252,187,187)' }]}>
          {/* Sliding Switch - Top Left */}
          <View style={[styles.slidingSwitch, { 
            position: 'absolute', 
            top: width * 0.02, 
            left: width * 0.02, 
            zIndex: 5 
          }]}>
            <TouchableOpacity 
              style={[styles.switchTrack, { backgroundColor: showUserProfile ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' }]}
              onPress={() => setShowUserProfile(!showUserProfile)}
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
                {showUserProfile ? '👤' : '👩'}
              </Text>
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
            </View>
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
            }]} onPress={decrementAliceScore} disabled={isPlaying || timeRemaining < matchTime}>
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
            }]} onPress={incrementAliceScore} disabled={isPlaying || timeRemaining < matchTime}>
              <Text style={[styles.scoreButtonText, {color: 'black'}]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Fencers Button */}
        <TouchableOpacity style={[styles.swapButton, { position: 'absolute', zIndex: 10, left: width * 0.5 - width * 0.095 }]} onPress={swapFencers}>
          <Text style={styles.swapIcon}>↔️</Text>
        </TouchableOpacity>

        {/* Bob's Card */}
        <View style={[styles.fencerCard, {backgroundColor: 'rgb(176,232,236)'}]}>
          <View style={styles.profileContainer}>
            <View style={styles.profilePicture}>
              <Text style={styles.profileInitial}>👨</Text>
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
            </View>
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
            }]} onPress={decrementBobScore} disabled={isPlaying || timeRemaining < matchTime}>
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
            }]} onPress={incrementBobScore} disabled={isPlaying || timeRemaining < matchTime}>
              <Text style={[styles.scoreButtonText, {color: 'black'}]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.decorativeCards}>
          <TouchableOpacity style={[styles.decorativeCard, styles.cardYellow]} onPress={addYellowCardToAlice}>
            {aliceYellowCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.yellow.accent }]}>
                {aliceYellowCards.length}
              </Text>
            )}
          </TouchableOpacity>
          <View style={[styles.decorativeCard, styles.cardRed]}>
            {aliceRedCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.red.accent }]}>
                {aliceRedCards.length}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.assignPriorityButton, {
            backgroundColor: (currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ?
              Colors.yellow.accent :
              isInjuryTimer ? '#EF4444' : Colors.purple.primary
          }]}
          onPress={
            (currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ?
              () => setShowPriorityPopup(true) :
              (isInjuryTimer ? stopInjuryTimer : startInjuryTimer)
          }
        >
          <Text style={styles.assignPriorityIcon}>
            {(currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ? '🎲' : '🏥'}
          </Text>
          <Text style={styles.assignPriorityText}>
            {(currentPeriod === 3 && timeRemaining === 0 && aliceScore === bobScore) ?
              'Assign Priority' :
              (isInjuryTimer ? `Stop (${formatTime(injuryTimeRemaining)})` : 'Injury Timer')
            }
          </Text>
        </TouchableOpacity>
        <View style={styles.decorativeCards}>
          <TouchableOpacity style={[styles.decorativeCard, styles.cardYellow]} onPress={addYellowCardToBob}>
            {bobYellowCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.yellow.accent }]}>
                {bobYellowCards.length}
              </Text>
            )}
          </TouchableOpacity>
          <View style={[styles.decorativeCard, styles.cardRed]}>
            {bobRedCards.length > 0 && (
              <Text style={[styles.decorativeCardCount, { color: Colors.red.accent }]}>
                {bobRedCards.length}
              </Text>
            )}
          </View>
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
        
        {/* Play Button / Skip Button */}
        <TouchableOpacity 
          style={{
            flex: 1,
            backgroundColor: isBreakTime ? '#F59E0B' : // Orange for skip button
                             isPlaying ? '#F97316' : 
                             (!isPlaying && timeRemaining < matchTime && timeRemaining > 0) ? '#3B82F6' : 
                             timeRemaining === 0 ? '#9CA3AF' : '#10B981',
            paddingVertical: 10,
            paddingHorizontal: 15,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            marginRight: 8,
            borderWidth: 2,
            borderColor: 'white',
            minHeight: 45,
            opacity: (timeRemaining === 0 && !isBreakTime) ? 0.6 : 1
          }} 
          onPress={() => {
            // Skip button during break time
            if (isBreakTime) {
              skipBreak();
              return;
            }
            
            // Prevent action when timer is at 0:00
            if (timeRemaining === 0) {
              return;
            }
            
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
            {isBreakTime ? '⏭️' : isPlaying ? '⏸️' : '▶️'}
          </Text>
          <Text style={{fontSize: 14, fontWeight: '600', color: 'white'}}>
            {isBreakTime ? 'Skip Break' : 
             isPlaying ? 'Pause' : 
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
          <View style={[styles.swipeContainer, { 
            marginTop: -(height * 0.01), // Negative margin to pull swipe container higher up
            marginBottom: height * 0.01 
          }]}>
            <View style={styles.swipeTrack}>
              <Text style={styles.swipeMainText}>Complete The Match</Text>
              {/* Progress indicator */}
              <View style={[styles.swipeProgressBar, { 
                width: `${swipeProgress * 100}%`,
                backgroundColor: swipeProgress > 0.5 ? '#10B981' : '#6A35F7'
              }]} />
              <View style={[styles.swipeThumb, { 
                transform: [{ translateX: swipeProgress * ((width * 0.95) - (height * 0.05)) }],
                opacity: 0.8 + (swipeProgress * 0.2), // Fade in as user swipes
              }]}>
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
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={[styles.popupContainer, { marginTop: height * 0.1 }]}>
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
                  returnKeyType="next"
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
                  returnKeyType="done"
                  onSubmitEditing={saveFencerName}
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
    </View>
  );
}

import { SwipeToCompleteButton } from '@/components/SwipeToCompleteButton';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RemoteScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
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
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setAliceScore(aliceScore + 1);
          setScoreChangeCount(0); // Reset counter
          
          // Pause timer if it's currently running
          if (isPlaying) {
            pauseTimer();
          }
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
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      setAliceScore(aliceScore + 1);
      setScoreChangeCount(0); // Reset counter for new match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  const decrementAliceScore = () => {
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
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      setAliceScore(Math.max(0, aliceScore - 1));
      setScoreChangeCount(0); // Reset counter for new match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  const incrementBobScore = () => {
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        setPendingScoreAction(() => () => {
          setBobScore(bobScore + 1);
          setScoreChangeCount(0); // Reset counter
          
          // Pause timer if it's currently running
          if (isPlaying) {
            pauseTimer();
          }
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
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      setBobScore(bobScore + 1);
      setScoreChangeCount(0); // Reset counter for new match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  const decrementBobScore = () => {
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
      
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      setBobScore(Math.max(0, bobScore - 1));
      setScoreChangeCount(0); // Reset counter for new match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    if (injuryTimerRef) {
      clearInterval(injuryTimerRef);
      setInjuryTimerRef(null);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsManualReset(true); // Set flag to prevent auto-sync
  }, [breakTimerRef]);

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
        timerDisplayMargin: height * 0.02, // Less margin for ready state
      };
    }
    
    // Match Active State (running or paused)
    if (hasMatchStarted && !isBreakTime) {
      return {
        timerDisplayMargin: height * 0.04, // More margin for active state
      };
    }
    
    // Break State
    if (isBreakTime) {
      return {
        timerDisplayMargin: height * 0.03, // Medium margin for break state
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
      padding: '1%',
      paddingTop: height * 0.005,
      paddingBottom: height * 0.002,
      overflow: 'hidden',
    },
    
    // Match Timer Section
    matchTimerCard: {
      // Background will be handled by LinearGradient
      borderWidth: 2,
      borderColor: Colors.timerBackground.borderColors[0],
      borderRadius: width * 0.04,
      padding: width * 0.01,
      marginTop: 0,
      marginBottom: height * 0.001,
      position: 'relative',
      // Shadow effects
      shadowColor: Colors.timerBackground.shadowColor,
      shadowOffset: Colors.timerBackground.shadowOffset,
      shadowOpacity: Colors.timerBackground.shadowOpacity,
      shadowRadius: Colors.timerBackground.shadowRadius,
      elevation: Colors.timerBackground.elevation,
    },
    timerLabel: {
      backgroundColor: Colors.yellow.accent,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.004,
      borderRadius: width * 0.04,
      position: 'absolute',
      top: height * 0.001, // Changed from negative to positive to move down in the card
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
      // Timer background styling removed - now handled by main container
      borderRadius: width * 0.03,
    },
    countdownText: {
      fontSize: width * 0.12,
      color: 'white',
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.015),
    },
    countdownTextWarning: {
      fontSize: width * 0.12,
      color: Colors.yellow.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.015),
    },
    countdownTextDanger: {
      fontSize: width * 0.12,
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.015),
    },
    countdownTextDangerPulse: {
      fontSize: width * 0.12,
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.015),
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
      backgroundColor: '#E6DDFF',
      borderRadius: width * 0.03,
      padding: width * 0.025,
      marginTop: height * 0.002, // Reduced for tighter spacing
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
      marginLeft: width * 0.05,
    },
    editNamesButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.05,
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
      gap: width * 0.035,
    },
    scoreButton: {
      width: width * 0.15,
      height: width * 0.15,
      borderRadius: width * 0.075,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    scoreButtonText: {
      fontSize: width * 0.065,
      fontWeight: '700',
      color: 'white',
    },
    swapButton: {
      width: width * 0.13,
      height: width * 0.13,
      borderRadius: width * 0.065,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: '#FFFFFF',
    },
    swapIcon: {
      fontSize: width * 0.065,
      color: 'white',
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
      marginTop: height * 0.005,
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
      marginBottom: height * 0.005,
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

    // Complete Match Button
    completeMatchButton: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.005,
      gap: width * 0.05,
    },
    completeButton: {
      width: width * 0.35,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: Colors.green.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completeButtonText: {
      fontSize: width * 0.04,
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
    console.log('  All cards cleared for Alice');
  };

  const resetBobCards = () => {
    console.log('🔄 RESETTING BOB CARDS');
    setBobCards({ yellow: 0, red: 0 });
    setBobYellowCards([]);
    setBobRedCards([]);
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
    
    console.log('  All cards cleared for both Alice and Bob');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const addYellowCardToAlice = () => {
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
        }
      }
      
      return newState;
    });
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addYellowCardToBob = () => {
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
        }
      }
      
      return newState;
    });
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Red card management functions
  const addRedCardToAlice = () => {
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
            onPress: () => {
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const addRedCardToBob = () => {
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
            onPress: () => {
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 5 }]}>
      {/* Match Timer Section */}
      <LinearGradient
        colors={Colors.timerBackground.colors}
        style={[
          styles.matchTimerCard,
          // Make match timer card smaller when timer is ready AND cards are present
          (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
            padding: width * 0.004, // Reduce padding even more
            marginTop: height * 0.003, // Reduce top margin even more
            marginBottom: height * 0.0005, // Reduce bottom margin even more
          } : {}
        ]}
        start={Colors.timerBackground.start}
        end={Colors.timerBackground.end}
      >
        <View style={styles.timerHeader}>
          <View style={styles.timerLabel}>
            <Text style={styles.timerLabelText}>Match Timer</Text>
          </View>
          {!isPlaying && !hasMatchStarted && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditTime}>
              <Ionicons name="pencil" size={16} color="white" />
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
              borderWidth: 2,
              borderColor: hasMatchStarted ? '#EF4444' : '#6B7280',
              borderRadius: 12,
              paddingVertical: height * 0.02,
              paddingHorizontal: width * 0.04,
              minHeight: height * 0.12,
              marginBottom: height * 0.02,
              opacity: hasMatchStarted ? 1 : 0.6
            }]}>
              <Text style={[styles.countdownText, { 
                color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                fontSize: width * 0.08 
              }]}>
                {formatTime(injuryTimeRemaining)}
              </Text>
              <Text style={[styles.countdownWarningText, { 
                color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                fontSize: width * 0.035 
              }]}>
                🏥 INJURY TIME - 5:00
              </Text>
              {previousMatchState && (
                <Text style={[styles.countdownWarningText, { 
                  color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                  fontSize: width * 0.03 
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
            <View style={styles.profilePicture}>
              <Text style={styles.profileInitial}>
                {toggleCardPosition === 'left' && showUserProfile ? '👤' : aliceProfileEmoji}
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
            {toggleCardPosition === 'left' && showUserProfile ? 'You' : fencerNames.alice}
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
              <Ionicons name="remove" size={36} color="black" />
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
              <Ionicons name="add" size={36} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Fencers Button */}
        <LinearGradient
          colors={['#D6A4F0', '#969DFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.swapButton, { position: 'absolute', zIndex: 10, left: width * 0.5 - width * 0.075 }]}
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
            <View style={styles.profilePicture}>
              <Text style={styles.profileInitial}>
                {toggleCardPosition === 'right' && showUserProfile ? '👤' : bobProfileEmoji}
              </Text>
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
          
          <Text style={[styles.fencerName, {color: 'black'}]}>
            {toggleCardPosition === 'right' && showUserProfile ? 'You' : fencerNames.bob}
          </Text>
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
              <Ionicons name="remove" size={36} color="black" />
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
              <Ionicons name="add" size={36} color="black" />
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

      {/* Play and Reset Controls - REBUILT */}
      <View style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginVertical: 10,
          marginTop: 5,
          paddingHorizontal: 15,
          backgroundColor: 'transparent',
          borderRadius: 8,
          minHeight: 60
        },
        // Add bottom margin when timer is ready AND cards are present to make room for swipe container
        (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
          marginBottom: height * 0.10, // Add moderate space below controls when cards present
        } : {}
      ]}>
        
        {/* Play Button / Skip Button */}
        <TouchableOpacity 
          style={{
            flex: 1,
            backgroundColor: '#2A2A2A',
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
            opacity: (timeRemaining === 0 && !isBreakTime && !isInjuryTimer) ? 0.6 : 1
          }} 
          onPress={() => {
            // Skip button during injury time
            if (isInjuryTimer) {
              skipInjuryTimer();
              return;
            }
            
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
          <Ionicons 
            name={
              isInjuryTimer ? 'play-forward' : 
              isBreakTime ? 'play-forward' : 
              isPlaying ? 'pause' : 
              'play'
            }
            size={18} 
            color="white" 
            style={{marginRight: 6}}
          />
          <Text style={{fontSize: 14, fontWeight: '600', color: 'white'}}>
            {isInjuryTimer ? 'Skip Injury' : 
             isBreakTime ? 'Skip Break' : 
             isPlaying ? 'Pause' : 
             (!isPlaying && timeRemaining < matchTime && timeRemaining > 0) ? 'Resume' : 'Play'}
          </Text>
        </TouchableOpacity>
        
        {/* Reset Button */}
        <TouchableOpacity 
          style={{
            width: 60,
            backgroundColor: '#FB5D5C',
            paddingVertical: 10,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: 'transparent',
            minHeight: 45,
            shadowColor: '#6C5CE7',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 14,
            elevation: 8
          }} 
          onPress={resetTimer}
        >
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Complete Match Button */}
      <View style={styles.completeMatchButton}>
        <SwipeToCompleteButton
          title="Complete The Match"
          customStyle={
            // Only move closer to bottom tab bar when timer is ready AND cards are present
            (!hasMatchStarted && (aliceYellowCards.length > 0 || aliceRedCards.length > 0 || bobYellowCards.length > 0 || bobRedCards.length > 0)) ? {
              position: 'absolute',
              bottom: height * 0.05, // Position from bottom when conditions met
              left: 0,
              right: 0,
              marginLeft: 2, // Move right only when cards are issued
            } : {
              position: 'relative', // Normal positioning when no cards or match in progress
              // No fixed marginTop - maintains natural distance from play button
              marginBottom: height * 0.01,
              // No marginLeft when no cards - stays in normal position
            }
          }
          onSwipeSuccess={() => {
            router.push('/match-summary');
          }}
        />
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
    </SafeAreaView>
  </GestureHandlerRootView>
  );
}

import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { Alert, Keyboard, Modal, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native';

// CircularProgress with fallback - native module not working after rebuild
// TODO: Investigate why native module isn't compiling in EAS build
const USE_NATIVE_CIRCULAR_PROGRESS = false; // Disabled until build issue is resolved

let CircularProgress: any;
let useNative = USE_NATIVE_CIRCULAR_PROGRESS;

if (useNative) {
  try {
    CircularProgress = require('react-native-circular-progress-indicator').default;
    if (typeof CircularProgress !== 'function') {
      throw new Error('CircularProgress is not a function');
    }
  } catch (error: any) {
    console.warn('⚠️ CircularProgress native module error:', error?.message);
    useNative = false;
  }
}

// Fallback component (always used for now)
if (!useNative || typeof CircularProgress !== 'function') {
  CircularProgress = ({ value = 0, radius = 40, children, activeStrokeColor, inActiveStrokeColor, activeStrokeWidth = 4, ...props }: any) => {
    const size = radius * 2;
    const progress = Math.min(Math.max(value, 0), 100);
    const strokeColor = activeStrokeColor || Colors.purple.primary;
    const inactiveColor = inActiveStrokeColor || 'rgba(255,255,255,0.3)';
    
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <View style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: activeStrokeWidth,
          borderColor: inactiveColor,
        }} />
        {progress > 0 && (
          <View style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: activeStrokeWidth,
            borderColor: 'transparent',
            borderTopColor: progress > 0 ? strokeColor : 'transparent',
            borderRightColor: progress > 25 ? strokeColor : 'transparent',
            borderBottomColor: progress > 50 ? strokeColor : 'transparent',
            borderLeftColor: progress > 75 ? strokeColor : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }} />
        )}
        <View style={{ zIndex: 1 }}>{children}</View>
      </View>
    );
  };
}

interface GoalCardProps {
  daysLeft: number;
  title: string;
  description: string;
  progress: number;
  targetValue?: number;
  currentValue?: number;
  onSetNewGoal: () => void;
  onUpdateGoal: () => void;
  onGoalSaved?: (goalData: any) => void;
  onGoalUpdated?: (goalId: string, updates: any) => void;
  onGoalDeleted?: (goalId: string) => void;
  goalId?: string;
  useModal?: boolean; // If true, use internal modal; if false, use onSetNewGoal callback
  matchWindow?: number; // For windowed goals
  totalMatches?: number; // Total matches played in user's history
  currentRecord?: { wins: number; losses: number }; // Current W-L record
}

export interface GoalCardRef {
  openModal: () => void;
}

export const GoalCard = forwardRef<GoalCardRef, GoalCardProps>(({
  daysLeft,
  title,
  description,
  progress,
  targetValue,
  currentValue,
  onSetNewGoal,
  onUpdateGoal,
  onGoalSaved,
  onGoalUpdated,
  onGoalDeleted,
  goalId,
  useModal = false,
  matchWindow,
  totalMatches,
  currentRecord,
}, ref) => {
  const { width, height } = useWindowDimensions();
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [isUpdatingGoal, setIsUpdatingGoal] = useState(false);
  const [goalType, setGoalType] = useState('Total Matches Played');
  const [targetValueInput, setTargetValueInput] = useState('10');
  const [timeframe, setTimeframe] = useState('Month');
  const [timeframeNumber, setTimeframeNumber] = useState('1');
  const [notes, setNotes] = useState('Focus on consistency this month.');
  const [showGoalTypeDropdown, setShowGoalTypeDropdown] = useState(false);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);
  const [showTimeframeNumberDropdown, setShowTimeframeNumberDropdown] = useState(false);
  const [matchesForWinRate, setMatchesForWinRate] = useState('20');
  const [matchesForDifferential, setMatchesForDifferential] = useState('15');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [enableMatchWindow, setEnableMatchWindow] = useState(false);

  // Expose openModal method to parent via ref
  useImperativeHandle(ref, () => ({
    openModal: () => {
      console.log('🎯 Opening goal modal via ref');
      setShowGoalModal(true);
    }
  }));

  const goalTypes = [
    { label: 'Total Matches Played', icon: '📊' },
    { label: 'Wins', icon: '🥇' },
    { label: 'Average Margin of Victory', icon: '🏆' },
    { label: 'Streaks', icon: '🔥' }
  ];

  const timeframes = ['Week', 'Month', 'Year'];
  const timeframeNumbers = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  const truncateDescription = (text: string, maxLength: number = 60): string => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength).trim() + '...';
  };

  const handleSetNewGoalClick = () => {
    if (useModal) {
      // Check if this is an update or new goal
      const isUpdate = title !== "No Active Goals";
      setIsUpdatingGoal(isUpdate);
      
      if (isUpdate) {
        // This is an update - pre-fill the form with current goal data
        setGoalType(title);
        setNotes(description);
        if (targetValue) {
          setTargetValueInput(targetValue.toString());
        }
      } else {
        // This is a new goal - reset form to defaults
        setGoalType('Total Matches Played');
        setTargetValueInput('10');
        setNotes('Focus on consistency this month.');
      }
      
      setShowGoalModal(true);
    } else {
      onSetNewGoal();
    }
  };



  const handleSaveGoal = () => {
    const targetValue = parseInt(targetValueInput);
    
    // Prepare goal data for database
    const goalData: any = {
      category: goalType,
      description: getGoalDescription(), // Use auto-generated description instead of notes
      target_value: targetValue,
      unit: timeframe,
      deadline: calculateDeadline(timeframe, timeframeNumber),
      tracking_mode: 'manual', // Default tracking mode
    };

    // Add match_window for goals that track over specific number of matches (only if enabled)
    if (enableMatchWindow && ['Wins', 'Average Margin of Victory'].includes(goalType)) {
      let windowSize = 0;
      switch (goalType) {
        case 'Wins':
          windowSize = parseInt(matchesForWinRate);
          break;
        case 'Average Margin of Victory':
          windowSize = parseInt(matchesForDifferential);
          break;
      }
      
      // Validate window for Wins goal
      if (goalType === 'Wins' && windowSize > 0) {
        if (windowSize < targetValue) {
          Alert.alert(
            'Invalid Goal',
            `You cannot win ${targetValue} matches out of only ${windowSize} matches. The window must be at least ${targetValue} matches.`,
            [{ text: 'OK' }]
          );
          return; // Don't save the goal
        }
      }
      
      // Only add window if user specified one (windowSize > 0)
      if (windowSize > 0) {
        goalData.match_window = windowSize;
        console.log('Adding match_window to goal:', windowSize);
      }
    }

    if (isUpdatingGoal && goalId) {
      // Update existing goal - perform validation before updating
      console.log('Updating existing goal:', goalId, 'with data:', goalData);
      
      // VALIDATION 1: Check if deadline is in the past
      const newDeadline = new Date(goalData.deadline);
      const now = new Date();
      if (newDeadline < now) {
        Alert.alert(
          'Invalid Deadline',
          'The deadline you selected is in the past. Please choose a future date.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // VALIDATION 2: For windowed goals - validate if already completed some matches
      if (goalData.match_window && matchWindow !== goalData.match_window && (currentValue || 0) > 0) {
        // Window size is changing and there's existing progress
        Alert.alert(
          'Warning: Changing Match Window',
          `Changing the match window will reset your goal tracking to start from your current match count.\n\nCurrent progress: ${currentValue || 0}/${targetValue}\n\nAre you sure you want to continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: () => {
                if (onGoalUpdated) {
                  onGoalUpdated(goalId, goalData);
                  setShowGoalModal(false);
                }
              }
            }
          ]
        );
        return;
      }
      
      // VALIDATION 3: Check if lowering target makes goal auto-complete
      if (targetValue && targetValue > goalData.target_value && (currentValue || 0) >= goalData.target_value) {
        Alert.alert(
          'Goal Already Achieved',
          `You've already achieved ${currentValue || 0} which meets your new target of ${goalData.target_value}!\n\nThis goal will be marked as complete.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Update Anyway', 
              onPress: () => {
                if (onGoalUpdated) {
                  onGoalUpdated(goalId, goalData);
                  setShowGoalModal(false);
                }
              }
            }
          ]
        );
        return;
      }
      
      // VALIDATION 4: For windowed goals - check if raising target makes goal impossible
      if (matchWindow && goalData.match_window && totalMatches !== undefined) {
        const windowSize = goalData.match_window;
        const matchesSinceGoalCreation = totalMatches - (matchWindow || 0);
        const remainingMatches = windowSize - matchesSinceGoalCreation;
        
        if (goalType === 'Wins' && remainingMatches >= 0) {
          const maxPossibleWins = (currentValue || 0) + remainingMatches;
          
          if (maxPossibleWins < goalData.target_value) {
            Alert.alert(
              'Impossible Goal',
              `You cannot achieve ${goalData.target_value} wins with only ${remainingMatches} matches remaining.\n\nMaximum possible: ${maxPossibleWins} wins`,
              [{ text: 'OK' }]
            );
            return;
          }
        }
      }
      
      // VALIDATION 5: Prevent removing match window from windowed goals with progress
      if (matchWindow && !goalData.match_window && (currentValue || 0) > 0) {
        Alert.alert(
          'Cannot Remove Match Window',
          `This goal is currently tracking progress over a specific window of matches.\n\nRemoving the window would invalidate your current progress (${currentValue || 0}/${targetValue}).\n\nPlease create a new goal instead.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (onGoalUpdated) {
        console.log('Calling onGoalUpdated callback...');
        onGoalUpdated(goalId, goalData);
      } else {
        console.log('No onGoalUpdated callback provided!');
      }
    } else {
      // Create new goal
      console.log('Creating new goal:', goalData);
      console.log('onGoalSaved callback exists:', !!onGoalSaved);
      
      if (onGoalSaved) {
        console.log('Calling onGoalSaved callback...');
        onGoalSaved(goalData);
      } else {
        console.log('No onGoalSaved callback provided!');
      }
    }
    
    setShowGoalModal(false);
  };

  const calculateDeadline = (timeframe: string, timeframeNumber: string): string => {
    const now = new Date();
    const number = parseInt(timeframeNumber);
    
    switch (timeframe) {
      case 'Day':
        now.setDate(now.getDate() + number);
        break;
      case 'Week':
        now.setDate(now.getDate() + (number * 7));
        break;
      case 'Month':
        now.setMonth(now.getMonth() + number);
        break;
      case 'Year':
        now.setFullYear(now.getFullYear() + number);
        break;
      default:
        now.setMonth(now.getMonth() + 1); // Default to 1 month
    }
    
    return now.toISOString().split('T')[0]; // Return date in YYYY-MM-DD format
  };

  const handleCancel = () => {
    setShowGoalModal(false);
    setShowGoalTypeDropdown(false);
    setShowTimeframeDropdown(false);
    setShowTimeframeNumberDropdown(false);
  };

  const handleDeleteGoal = () => {
    setShowOptionsMenu(false);
    
    if (!goalId) {
      Alert.alert('Error', 'Cannot delete goal - no goal ID provided');
      return;
    }
    
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('🗑️ Deleting goal:', goalId);
            if (onGoalDeleted) {
              onGoalDeleted(goalId);
            }
          },
        },
      ]
    );
  };

  const handleEditGoal = () => {
    setShowOptionsMenu(false);
    
    // Open the goal modal in edit mode and populate all fields
    setIsUpdatingGoal(true);
    setGoalType(title);
    // Note: description is auto-generated, no need to set notes
    
    // Set target value
    if (targetValue) {
      setTargetValueInput(targetValue.toString());
    }
    
    // Calculate and set timeframe from deadline
    if (daysLeft > 0) {
      if (daysLeft <= 7) {
        setTimeframe('Week');
        setTimeframeNumber('1');
      } else if (daysLeft <= 31) {
        setTimeframe('Month');
        setTimeframeNumber('1');
      } else if (daysLeft <= 365) {
        const months = Math.ceil(daysLeft / 30);
        setTimeframe('Month');
        setTimeframeNumber(months.toString());
      } else {
        const years = Math.ceil(daysLeft / 365);
        setTimeframe('Year');
        setTimeframeNumber(years.toString());
      }
    }
    
    // Set match window if exists
    if (matchWindow) {
      setEnableMatchWindow(true);
      if (title === 'Wins') {
        setMatchesForWinRate(matchWindow.toString());
      } else if (title === 'Average Margin of Victory') {
        setMatchesForDifferential(matchWindow.toString());
      }
    } else {
      setEnableMatchWindow(false);
    }
    
    setShowGoalModal(true);
  };

  const closeDropdowns = () => {
    setShowGoalTypeDropdown(false);
    setShowTimeframeDropdown(false);
    setShowTimeframeNumberDropdown(false);
  };

  const handleModalPress = () => {
    closeDropdowns();
  };

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const finishEditing = () => {
    if (editingField && tempValue) {
      const numValue = parseInt(tempValue);
      if (!isNaN(numValue) && numValue > 0) {
        switch (editingField) {
          case 'targetValue':
            setTargetValueInput(tempValue);
            break;
          case 'matchesForWinRate':
            setMatchesForWinRate(tempValue);
            break;
          case 'matchesForDifferential':
            setMatchesForDifferential(tempValue);
            break;
        }
      }
    }
    setEditingField(null);
    setTempValue('');
  };

  const handleTextChange = (text: string) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, '');
    setTempValue(numericText);
  };

  const incrementTarget = () => {
    const current = parseInt(targetValueInput);
    setTargetValueInput((current + 1).toString());
  };

  const decrementTarget = () => {
    const current = parseInt(targetValueInput);
    if (current > 1) {
      setTargetValueInput((current - 1).toString());
    }
  };

  const incrementMatches = (field: string) => {
    switch (field) {
      case 'winRate':
        const currentWinRate = parseInt(matchesForWinRate);
        setMatchesForWinRate((currentWinRate + 1).toString());
        break;
      case 'differential':
        const currentDifferential = parseInt(matchesForDifferential);
        setMatchesForDifferential((currentDifferential + 1).toString());
        break;
    }
  };

  const decrementMatches = (field: string) => {
    switch (field) {
      case 'winRate':
        const currentWinRate = parseInt(matchesForWinRate);
        if (currentWinRate > 1) {
          setMatchesForWinRate((currentWinRate - 1).toString());
        }
        break;
      case 'differential':
        const currentDifferential = parseInt(matchesForDifferential);
        if (currentDifferential > 1) {
          setMatchesForDifferential((currentDifferential - 1).toString());
        }
        break;
    }
  };

  const shouldShowMatchesField = () => {
    return ['Wins', 'Average Margin of Victory'].includes(goalType);
  };

  const getMatchesFieldLabel = () => {
    switch (goalType) {
      case 'Wins':
        return 'Out of Next X Matches (Optional)';
      case 'Average Margin of Victory':
        return 'Over Next X Matches';
      default:
        return '';
    }
  };

  const getMatchesFieldValue = () => {
    switch (goalType) {
      case 'Wins':
        return matchesForWinRate;
      case 'Average Margin of Victory':
        return matchesForDifferential;
      default:
        return '';
    }
  };

  const getMatchesFieldKey = () => {
    switch (goalType) {
      case 'Wins':
        return 'matchesForWinRate';
      case 'Average Margin of Victory':
        return 'matchesForDifferential';
      default:
        return '';
    }
  };

  const setMatchesFieldValue = (value: string) => {
    switch (goalType) {
      case 'Wins':
        setMatchesForWinRate(value);
        break;
      case 'Average Margin of Victory':
        setMatchesForDifferential(value);
        break;
    }
  };

  const incrementMatchesField = () => {
    switch (goalType) {
      case 'Wins':
        incrementMatches('winRate');
        break;
      case 'Average Margin of Victory':
        incrementMatches('differential');
        break;
    }
  };

  const decrementMatchesField = () => {
    switch (goalType) {
      case 'Wins':
        decrementMatches('winRate');
        break;
      case 'Average Margin of Victory':
        decrementMatches('differential');
        break;
    }
  };

  const getGoalDescription = () => {
    const number = parseInt(timeframeNumber);
    const isPlural = number > 1;
    
    switch (goalType) {
      case 'Total Matches Played':
        return `Play ${targetValueInput} matches in ${number} ${timeframe.toLowerCase()}${isPlural ? 's' : ''}`;
      case 'Wins':
        // Check if user enabled match window
        if (enableMatchWindow) {
          const windowSize = parseInt(matchesForWinRate);
          if (windowSize && windowSize > 0) {
            // Windowed wins goal: "Win X out of next Y matches"
            return `Win ${targetValueInput} out of your next ${windowSize} matches`;
          }
        }
        // Simple wins goal: "Win X matches"
        return `Win ${targetValueInput} matches in ${number} ${timeframe.toLowerCase()}${isPlural ? 's' : ''}`;
        
      case 'Average Margin of Victory':
        // Check if user enabled match window
        if (enableMatchWindow && matchesForDifferential) {
          const windowSize = parseInt(matchesForDifferential);
          return `Win by an average of ${targetValueInput}+ points over next ${windowSize} matches`;
        } else {
          return `Win by an average of ${targetValueInput}+ points (all-time)`;
        }
      case 'Streaks':
        return `Build a ${targetValueInput}-match winning streak`;
      default:
        return `Set a goal for ${number} ${timeframe.toLowerCase()}${isPlural ? 's' : ''}`;
    }
  };

  const shouldShowTimeframe = () => {
    return !['Streaks'].includes(goalType);
  };

  // Calculate warning state based on days left
  const getWarningState = (daysLeft: number): {
    state: 'normal' | 'warning' | 'urgent' | 'lastDay';
    color: string;
    message: string;
  } => {
    if (daysLeft === 0) {
      return {
        state: 'lastDay',
        color: '#FF7675',
        message: '🚨 LAST DAY! Expires today'
      };
    } else if (daysLeft === 1) {
      return {
        state: 'urgent',
        color: '#FF7675',
        message: '🚨 1 day left - URGENT!'
      };
    } else if (daysLeft === 2) {
      return {
        state: 'urgent',
        color: '#FF7675',
        message: '🚨 2 days left - Complete soon!'
      };
    } else if (daysLeft <= 5) {
      return {
        state: 'warning',
        color: '#FFA500',
        message: `⚠️ ${daysLeft} days left`
      };
    } else {
      return {
        state: 'normal',
        color: Colors.yellow.accent,
        message: `${daysLeft} days left`
      };
    }
  };

  const warningInfo = getWarningState(daysLeft);

  // Helper function to get color based on value and thresholds
  const getStatColor = (value: number, thresholds: { red: number; yellow: number }, inverse: boolean = false): string => {
    if (inverse) {
      // For values where lower is worse (e.g., losses allowed)
      if (value === 0) return '#FF7675'; // Red
      if (value <= thresholds.yellow) return '#FFB800'; // Yellow
      return 'white'; // Normal
    } else {
      // For values where higher is worse (e.g., win rate needed)
      if (value >= thresholds.red) return '#FF7675'; // Red
      if (value >= thresholds.yellow) return '#FFB800'; // Yellow
      return 'white'; // Normal
    }
  };

  // Render Progress Insights based on goal type
  const renderInsights = () => {
    if (!goalId || title === "No Active Goals" || !targetValue || currentValue === undefined) {
      return null;
    }

    const insights: Array<{ text: string; color?: string }> = [];

    switch (title) {
      case 'Total Matches Played':
        const matchesRemaining = targetValue - currentValue;
        const pacePerDay = daysLeft > 0 ? matchesRemaining / daysLeft : 0;
        const daysPerMatch = pacePerDay > 0 ? 1 / pacePerDay : 0;
        
        insights.push({ text: `• Completed: ${currentValue}/${targetValue} matches` });
        insights.push({ text: `• Remaining: ${matchesRemaining} matches` });
        if (daysLeft > 0 && matchesRemaining > 0) {
          if (daysPerMatch >= 1) {
            insights.push({ text: `• Pace: ~1 match every ${Math.round(daysPerMatch)} days` });
          } else {
            insights.push({ text: `• Pace: ~${Math.ceil(pacePerDay)} matches per day` });
          }
        }
        break;

      case 'Wins':
        if (matchWindow && totalMatches !== undefined && currentRecord) {
          // Windowed Wins - use currentRecord.wins instead of currentValue for accuracy
          const actualWins = currentRecord.wins;
          const actualLosses = currentRecord.losses;
          const matchesPlayed = Math.min(totalMatches, matchWindow);
          const winsNeeded = targetValue - actualWins;
          const matchesRemaining = matchWindow - matchesPlayed;
          
          // Calculate losses allowed: total allowed losses - losses already taken
          const totalLossesAllowed = matchWindow - targetValue; // e.g., Win 15/20 = 5 losses allowed total
          const lossesRemaining = totalLossesAllowed - actualLosses; // How many more losses can we afford
          
          const winRateNeeded = matchesRemaining > 0 ? (winsNeeded / matchesRemaining) * 100 : 0;
          
          insights.push({ text: `• Progress: ${matchesPlayed}/${matchWindow} matches (${currentRecord.wins}W-${currentRecord.losses}L)` });
          insights.push({ text: `• Wins: ${actualWins}/${targetValue} (need ${winsNeeded} more)` });
          insights.push({ 
            text: `• Losses remaining: ${Math.max(0, lossesRemaining)}/${totalLossesAllowed}`,
            color: getStatColor(lossesRemaining, { red: 0, yellow: 2 }, true)
          });
          if (matchesRemaining > 0) {
            insights.push({ 
              text: `• Win rate needed: ${Math.round(winRateNeeded)}%`,
              color: getStatColor(winRateNeeded, { red: 85, yellow: 70 }, false)
            });
          }
        } else {
          // Simple Wins
          const winsRemaining = targetValue - currentValue;
          const totalMatchesPlayed = currentRecord ? currentRecord.wins + currentRecord.losses : currentValue;
          const recordText = currentRecord ? `${currentRecord.wins}W-${currentRecord.losses}L` : `${currentValue}W`;
          
          insights.push({ text: `• Wins: ${currentValue}/${targetValue}` });
          insights.push({ text: `• Remaining: ${winsRemaining} wins` });
          insights.push({ text: `• Record: ${recordText}` });
        }
        break;

      case 'Average Margin of Victory':
        const gap = currentValue - targetValue;
        const matchesPlayed = matchWindow && totalMatches !== undefined ? Math.min(totalMatches, matchWindow) : 0;
        const matchesLeft = matchWindow ? matchWindow - matchesPlayed : 0;
        
        insights.push({ text: `• Current avg: ${currentValue.toFixed(1)} points` });
        insights.push({ text: `• Target avg: ${targetValue.toFixed(1)} points` });
        insights.push({ 
          text: `• Gap: ${gap >= 0 ? '+' : ''}${gap.toFixed(1)} points`,
          color: gap >= 0 ? '#00B894' : (gap >= -1 ? '#FFB800' : '#FF7675')
        });
        
        if (matchWindow && matchesLeft > 0) {
          insights.push({ text: `• Matches: ${matchesPlayed}/${matchWindow} played` });
          
          // Calculate what average is needed in remaining matches
          const totalNeeded = targetValue * matchWindow;
          const totalSoFar = currentValue * matchesPlayed;
          const neededInRemaining = (totalNeeded - totalSoFar) / matchesLeft;
          
          insights.push({ 
            text: `• Need avg: ${neededInRemaining.toFixed(1)} pts in next ${matchesLeft}`,
            color: getStatColor(neededInRemaining, { red: targetValue + 2, yellow: targetValue }, false)
          });
        }
        break;

      case 'Streaks':
        const streakWinsToGo = targetValue - currentValue;
        const fireEmojis = '🔥'.repeat(Math.min(currentValue, 10));
        
        insights.push({ text: `• Current: ${currentValue} wins ${fireEmojis}` });
        insights.push({ text: `• Target: ${targetValue} wins` });
        insights.push({ text: `• To go: ${streakWinsToGo} consecutive wins` });
        insights.push({ text: `• ⚠️ Any loss resets streak`, color: '#FFB800' });
        break;
    }

    return (
      <View style={styles.insightsContainer}>
        <Text style={styles.insightsTitle}>📊 Progress Insights</Text>
        {insights.map((insight, index) => (
          <Text key={index} style={[styles.insightText, insight.color && { color: insight.color }]}>
            {insight.text}
          </Text>
        ))}
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.04,
      padding: width * 0.025,
      marginBottom: height * 0.01,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.008,
    },
    daysLeftTag: {
      backgroundColor: Colors.yellow.accent,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.003,
      borderRadius: width * 0.03,
    },
    daysLeftTagText: {
      fontSize: width * 0.025,
      fontWeight: '600',
      color: Colors.gray.dark,
    },
    menuButton: {
      padding: width * 0.01,
      marginTop: -height * 0.009,
      marginRight: -width * 0.025,
    },
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuContainer: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      width: width * 0.5,
      paddingVertical: height * 0.01,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    menuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      gap: width * 0.03,
    },
    menuOptionText: {
      fontSize: width * 0.04,
      color: 'white',
      fontWeight: '500',
    },
    menuDivider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      marginHorizontal: width * 0.04,
    },
    deleteText: {
      color: '#FF7675',
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.02,
      marginTop: height * 0.01,
    },
    checkbox: {
      width: width * 0.05,
      height: width * 0.05,
      borderRadius: width * 0.01,
      borderWidth: 2,
      borderColor: Colors.purple.primary,
      backgroundColor: 'transparent',
      marginRight: width * 0.03,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxLabel: {
      fontSize: width * 0.035,
      color: 'white',
      flex: 1,
    },
    title: {
      fontSize: width * 0.045,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.001,
    },
    description: {
      fontSize: width * 0.033,
      color: Colors.gray.light,
      marginTop: height * 0.010, // Added space between heading and text
      marginBottom: height * 0.0005,
    },
    insightsContainer: {
      backgroundColor: '#1F1F1F',
      borderRadius: width * 0.02,
      padding: width * 0.025,
      paddingVertical: height * 0.01,
      marginTop: height * -0.035,
      marginBottom: height * 0.01,
      marginLeft: 0,
      marginRight: width * 0.18,
      borderWidth: 1,
      borderColor: '#3A3A3A',
    },
    insightsTitle: {
      fontSize: width * 0.032,
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.006,
    },
    insightText: {
      fontSize: width * 0.028,
      color: 'white',
      marginBottom: height * 0.003,
      lineHeight: width * 0.04,
    },
    contentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.012,
    },
    textSection: {
      width: width * 0.6, // Increased to 0.6 to prevent text wrapping
      maxWidth: width * 0.6, // Same as width to enforce limit
      marginRight: width * 0.04, // Further reduced margin
    },
    progressSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -height * 0.03,
    },
    progressCircle: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      width: width * 0.16,
      height: width * 0.16,
    },
    simpleProgressCircle: {
      width: width * 0.15,
      height: width * 0.15,
      borderRadius: width * 0.075,
      backgroundColor: Colors.purple.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    progressText: {
      position: 'absolute',
      fontSize: width * 0.045,
      fontWeight: '700',
      color: 'white',
      textAlign: 'center',
      width: '100%',
      height: '100%',
      textAlignVertical: 'center',
      lineHeight: width * 0.16, // Match the circle diameter for vertical centering
    },
    progressValueText: {
      fontSize: width * 0.045,
      fontWeight: '700',
      color: 'white',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: width * 0.02,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.gray.light,
      paddingVertical: height * 0.008,
      paddingHorizontal: width * 0.025,
      borderRadius: width * 0.015,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: 'white',
      fontSize: width * 0.028,
      fontWeight: '600',
    },
    primaryButton: {
      flex: 1,
      backgroundColor: Colors.purple.primary,
      paddingVertical: height * 0.008,
      paddingHorizontal: width * 0.025,
      borderRadius: width * 0.015,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: 'white',
      fontSize: width * 0.028,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContainer: {
      backgroundColor: 'rgb(42,42,42)',
      borderRadius: width * 0.04,
      width: width * 0.8,
      padding: width * 0.04,
      alignItems: 'center',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.02,
      width: '100%',
    },
    backButton: {
      padding: width * 0.02,
      marginRight: width * 0.02,
    },
    modalTitle: {
      fontSize: width * 0.045,
      fontWeight: '700',
      color: 'white',
      flex: 1,
    },
    goalForm: {
      width: '100%',
      marginBottom: height * 0.02,
    },
    formField: {
      marginBottom: height * 0.015,
    },
    fieldLabel: {
      fontSize: width * 0.03,
      color: '#FFFFFF',
      marginBottom: height * 0.005,
    },
    helperText: {
      fontSize: width * 0.025,
      color: 'rgba(255, 255, 255, 0.5)',
      fontStyle: 'italic',
      marginTop: height * 0.005,
    },
    dropdownContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.025,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.008,
      borderWidth: 1,
      borderColor: '#464646',
      position: 'relative',
    },
    dropdownDisabled: {
      backgroundColor: '#1A1A1A',
      borderColor: '#333333',
      opacity: 0.6,
    },
    dropdownText: {
      fontSize: width * 0.03,
      color: 'white',
      flex: 1,
    },
    dropdownTextDisabled: {
      color: 'rgba(255, 255, 255, 0.4)',
    },
    dropdownOptions: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: Colors.gray.dark,
      borderRadius: width * 0.015,
      padding: height * 0.008,
      zIndex: 1000,
      borderWidth: 1,
      borderColor: Colors.gray.light,
      marginTop: 2,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    dropdownOption: {
      paddingVertical: height * 0.008,
      paddingHorizontal: width * 0.02,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    dropdownOptionText: {
      fontSize: width * 0.03,
      color: 'white',
      fontWeight: '500',
    },
    targetValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.025,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.008,
      borderWidth: 1,
      borderColor: '#464646',
    },
    targetButton: {
      paddingHorizontal: width * 0.01,
      paddingVertical: height * 0.005,
    },
    targetButtonText: {
      fontSize: width * 0.035,
      fontWeight: '600',
      color: 'white',
    },
    targetValue: {
      fontSize: width * 0.03,
      color: 'white',
      fontWeight: '600',
      marginHorizontal: width * 0.01,
    },
    targetValueInput: {
      fontSize: width * 0.03,
      color: 'white',
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0,
      textAlign: 'center',
      width: width * 0.05, // Adjust as needed for input width
    },
    targetValueTouchable: {
      flex: 1,
      alignItems: 'center',
    },
    goalSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: height * 0.01,
      marginBottom: height * 0.02,
    },
    summaryLabel: {
      fontSize: width * 0.03,
      color: Colors.gray.light,
      marginRight: width * 0.01,
    },
    summaryText: {
      fontSize: width * 0.03,
      color: 'white',
      fontWeight: '600',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginTop: height * 0.02,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: '#2e2e2e',
      paddingVertical: height * 0.01,
      paddingHorizontal: width * 0.03,
      borderRadius: width * 0.015,
      alignItems: 'center',
      marginRight: width * 0.01,
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    cancelButtonText: {
      color: 'white',
      fontSize: width * 0.028,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      backgroundColor: Colors.purple.primary,
      paddingVertical: height * 0.01,
      paddingHorizontal: width * 0.03,
      borderRadius: width * 0.015,
      alignItems: 'center',
      marginLeft: width * 0.01,
    },
    saveButtonText: {
      color: 'white',
      fontSize: width * 0.028,
      fontWeight: '600',
    },
    timeframeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.025,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.008,
      borderWidth: 1,
      borderColor: '#464646',
      marginBottom: height * 0.015,
    },
    timeframeNumberContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: width * 0.02,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.008,
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.02,
      borderWidth: 1,
      borderColor: '#464646',
    },
    timeframeTypeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.008,
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.02,
      borderWidth: 1,
      borderColor: '#464646',
    },
  });

  return (
    <View style={styles.container}>
      {/* Only show header with days left pill if there's an active goal */}
      {goalId && title !== "No Active Goals" && (
        <View style={styles.header}>
          <View style={[styles.daysLeftTag, { backgroundColor: warningInfo.color }]}>
            <Text style={[
              styles.daysLeftTagText,
              warningInfo.state === 'lastDay' && { fontWeight: '700' }
            ]}>
              {warningInfo.message}
            </Text>
          </View>
          
          {/* Three-dot menu */}
          <TouchableOpacity 
            onPress={() => setShowOptionsMenu(true)}
            style={styles.menuButton}
          >
            <Ionicons name="ellipsis-vertical" size={width * 0.05} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
        </View>
      )}
      
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.contentRow}>
        <View style={styles.textSection}>
          {title === "No Active Goals" && (
            <Text style={styles.description} numberOfLines={1}>
              {description ? truncateDescription(description) : 'Track your progress and stay motivated'}
            </Text>
          )}
        </View>
        
        <View style={styles.progressSection}>
          <View style={styles.progressCircle}>
            <CircularProgress
              value={progress}
              radius={width * 0.08}
              activeStrokeColor={Colors.purple.primary}
              inActiveStrokeColor="rgba(255,255,255,0.3)"
              activeStrokeWidth={width * 0.012}
              inActiveStrokeWidth={width * 0.012}
              progressValueColor="transparent"
              showProgressValue={false}
              duration={1000}
              clockwise={true}
            />
            {/* Custom progress text overlay */}
            <Text style={styles.progressText}>
              {progress}%
            </Text>
          </View>
        </View>
      </View>
      
      {/* Progress Insights Section */}
      {renderInsights()}
      
      {title === "No Active Goals" && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSetNewGoalClick}>
            <Text style={styles.secondaryButtonText}>Set New Goal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Options Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity 
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuOption}
              onPress={handleEditGoal}
            >
              <Ionicons name="create-outline" size={width * 0.05} color="white" />
              <Text style={styles.menuOptionText}>Edit Goal</Text>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuOption}
              onPress={handleDeleteGoal}
            >
              <Ionicons name="trash-outline" size={width * 0.05} color="#FF7675" />
              <Text style={[styles.menuOptionText, styles.deleteText]}>Delete This Goal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Goal Modal (Create/Update) */}
      <Modal
        visible={showGoalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={handleModalPress}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {isUpdatingGoal ? 'Edit Goal' : 'Set a New Goal'}
              </Text>
            </View>

            {/* Goal Form */}
            <View style={styles.goalForm}>
              {/* Goal Type */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Goal Type</Text>
                <TouchableOpacity 
                  style={[
                    styles.dropdownContainer,
                    isUpdatingGoal && styles.dropdownDisabled
                  ]}
                  onPress={() => {
                    if (!isUpdatingGoal) {
                      setShowGoalTypeDropdown(!showGoalTypeDropdown);
                    }
                  }}
                  activeOpacity={isUpdatingGoal ? 1 : 0.7}
                  disabled={isUpdatingGoal}
                >
                  <Text style={[
                    styles.dropdownText,
                    isUpdatingGoal && styles.dropdownTextDisabled
                  ]}>
                    {goalType}
                  </Text>
                  {!isUpdatingGoal && (
                    <Ionicons 
                      name={showGoalTypeDropdown ? "chevron-up" : "chevron-down"} 
                      size={18} 
                      color="rgba(255, 255, 255, 0.7)" 
                    />
                  )}
                  {isUpdatingGoal && (
                    <Ionicons 
                      name="lock-closed" 
                      size={16} 
                      color="rgba(255, 255, 255, 0.4)" 
                    />
                  )}
                </TouchableOpacity>
                
                {isUpdatingGoal && (
                  <Text style={styles.helperText}>
                    Goal type cannot be changed after creation
                  </Text>
                )}
                
                {showGoalTypeDropdown && !isUpdatingGoal && (
                  <View style={styles.dropdownOptions}>
                    {goalTypes.map((type) => (
                      <TouchableOpacity
                        key={type.label}
                        style={styles.dropdownOption}
                        onPress={() => {
                          setGoalType(type.label);
                          setShowGoalTypeDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownOptionText}>{type.icon} {type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Target Value */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Target Value</Text>
                <View style={styles.targetValueContainer}>
                  <TouchableOpacity style={styles.targetButton} onPress={decrementTarget}>
                    <Text style={styles.targetButtonText}>-</Text>
                  </TouchableOpacity>
                  
                  {editingField === 'targetValue' ? (
                    <TextInput
                      style={styles.targetValueInput}
                      value={tempValue}
                      onChangeText={handleTextChange}
                      onBlur={finishEditing}
                      onSubmitEditing={finishEditing}
                      keyboardType="numeric"
                      autoFocus={true}
                      selectTextOnFocus={true}
                    />
                  ) : (
                    <TouchableOpacity 
                      style={styles.targetValueTouchable}
                      onPress={() => startEditing('targetValue', targetValueInput)}
                    >
                      <Text style={styles.targetValue}>{targetValueInput}</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity style={styles.targetButton} onPress={incrementTarget}>
                    <Text style={styles.targetButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Timeframe */}
              {shouldShowTimeframe() && (
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Timeframe</Text>
                  <View style={styles.timeframeContainer}>
                    <TouchableOpacity 
                      style={styles.timeframeNumberContainer}
                      onPress={() => setShowTimeframeNumberDropdown(!showTimeframeNumberDropdown)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownText}>{timeframeNumber}</Text>
                      <Ionicons 
                        name={showTimeframeNumberDropdown ? "chevron-up" : "chevron-down"} 
                        size={18} 
                        color="rgba(255, 255, 255, 0.7)" 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.timeframeTypeContainer}
                      onPress={() => setShowTimeframeDropdown(!showTimeframeDropdown)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownText}>{timeframe}</Text>
                      <Ionicons 
                        name={showTimeframeDropdown ? "chevron-up" : "chevron-down"} 
                        size={18} 
                        color="rgba(255, 255, 255, 0.7)" 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Timeframe Number Dropdown */}
                  {showTimeframeNumberDropdown && (
                    <View style={styles.dropdownOptions}>
                      {timeframeNumbers.map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={styles.dropdownOption}
                          onPress={() => {
                            setTimeframeNumber(num);
                            setShowTimeframeNumberDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownOptionText}>{num}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  {/* Timeframe Type Dropdown */}
                  {showTimeframeDropdown && (
                    <View style={styles.dropdownOptions}>
                      {timeframes.map((tf) => (
                        <TouchableOpacity
                          key={tf}
                          style={styles.dropdownOption}
                          onPress={() => {
                            setTimeframe(tf);
                            setShowTimeframeDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownOptionText}>{tf}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Conditional Matches Field with Checkbox */}
              {shouldShowMatchesField() && (
                <>
                  {/* Checkbox to enable match window */}
                  <TouchableOpacity 
                    style={styles.checkboxContainer}
                    onPress={() => setEnableMatchWindow(!enableMatchWindow)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkbox}>
                      {enableMatchWindow && (
                        <Ionicons name="checkmark" size={width * 0.04} color={Colors.purple.primary} />
                      )}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      {goalType === 'Wins' 
                        ? 'Track over specific number of matches' 
                        : 'Limit to next X matches'}
                    </Text>
                  </TouchableOpacity>

                  {/* Show matches field only if checkbox is enabled */}
                  {enableMatchWindow && (
                    <View style={styles.formField}>
                      <Text style={styles.fieldLabel}>{getMatchesFieldLabel()}</Text>
                      <View style={styles.targetValueContainer}>
                        <TouchableOpacity style={styles.targetButton} onPress={decrementMatchesField}>
                          <Text style={styles.targetButtonText}>-</Text>
                        </TouchableOpacity>
                        
                        {editingField === getMatchesFieldKey() ? (
                          <TextInput
                            style={styles.targetValueInput}
                            value={tempValue}
                            onChangeText={handleTextChange}
                            onBlur={finishEditing}
                            onSubmitEditing={finishEditing}
                            keyboardType="numeric"
                            autoFocus={true}
                            selectTextOnFocus={true}
                          />
                        ) : (
                          <TouchableOpacity 
                            style={styles.targetValueTouchable}
                            onPress={() => startEditing(getMatchesFieldKey(), getMatchesFieldValue())}
                          >
                            <Text style={styles.targetValue}>{getMatchesFieldValue()}</Text>
                          </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity style={styles.targetButton} onPress={incrementMatchesField}>
                          <Text style={styles.targetButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}


              {/* Goal Summary */}
              <View style={styles.goalSummary}>
                <Text style={styles.summaryLabel}>Goal: </Text>
                <Text style={styles.summaryText}>
                  {getGoalDescription()}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveGoal}>
                <Text style={styles.saveButtonText}>
                  {isUpdatingGoal ? 'Edit Goal' : 'Save Goal'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

GoalCard.displayName = 'GoalCard';

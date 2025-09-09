import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import CircularProgress from 'react-native-circular-progress-indicator';

interface GoalCardProps {
  daysLeft: number;
  title: string;
  description: string;
  progress: number;
  onSetNewGoal: () => void;
  onUpdateGoal: () => void;
  onGoalSaved?: (goalData: any) => void;
  useModal?: boolean; // If true, use internal modal; if false, use onSetNewGoal callback
}

export const GoalCard: React.FC<GoalCardProps> = ({
  daysLeft,
  title,
  description,
  progress,
  onSetNewGoal,
  onUpdateGoal,
  onGoalSaved,
  useModal = false,
}) => {
  const { width, height } = useWindowDimensions();
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalType, setGoalType] = useState('Total Matches Played');
  const [targetValue, setTargetValue] = useState('10');
  const [timeframe, setTimeframe] = useState('Month');
  const [timeframeNumber, setTimeframeNumber] = useState('1');
  const [notes, setNotes] = useState('Focus on consistency this month.');
  const [showGoalTypeDropdown, setShowGoalTypeDropdown] = useState(false);
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);
  const [showTimeframeNumberDropdown, setShowTimeframeNumberDropdown] = useState(false);
  const [matchesForWinRate, setMatchesForWinRate] = useState('20');
  const [matchesForPoints, setMatchesForPoints] = useState('10');
  const [matchesForDifferential, setMatchesForDifferential] = useState('15');
  const [matchesInARow, setMatchesInARow] = useState('5');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');

  const goalTypes = [
    { label: 'Total Matches Played', icon: '📊' },
    { label: 'Wins', icon: '🥇' },
    { label: 'Win Rate %', icon: '📈' },
    { label: 'Points Scored', icon: '🎯' },
    { label: 'Point Differential', icon: '➕' },
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
      setShowGoalModal(true);
    } else {
      onSetNewGoal();
    }
  };



  const handleSaveGoal = () => {
    // Prepare goal data for database
    const goalData = {
      category: goalType,
      description: notes,
      target_value: parseInt(targetValue),
      unit: timeframe,
      deadline: calculateDeadline(timeframe, timeframeNumber),
      tracking_mode: 'manual', // Default tracking mode
    };

    console.log('Saving goal:', goalData);
    console.log('onGoalSaved callback exists:', !!onGoalSaved);
    
    // Call the callback to save to database
    if (onGoalSaved) {
      console.log('Calling onGoalSaved callback...');
      onGoalSaved(goalData);
    } else {
      console.log('No onGoalSaved callback provided!');
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
            setTargetValue(tempValue);
            break;
          case 'matchesForWinRate':
            setMatchesForWinRate(tempValue);
            break;
          case 'matchesForPoints':
            setMatchesForPoints(tempValue);
            break;
          case 'matchesForDifferential':
            setMatchesForDifferential(tempValue);
            break;
          case 'matchesInARow':
            setMatchesInARow(tempValue);
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
    const current = parseInt(targetValue);
    setTargetValue((current + 1).toString());
  };

  const decrementTarget = () => {
    const current = parseInt(targetValue);
    if (current > 1) {
      setTargetValue((current - 1).toString());
    }
  };

  const incrementMatches = (field: string) => {
    switch (field) {
      case 'winRate':
        const currentWinRate = parseInt(matchesForWinRate);
        setMatchesForWinRate((currentWinRate + 1).toString());
        break;
      case 'points':
        const currentPoints = parseInt(matchesForPoints);
        setMatchesForPoints((currentPoints + 1).toString());
        break;
      case 'differential':
        const currentDifferential = parseInt(matchesForDifferential);
        setMatchesForDifferential((currentDifferential + 1).toString());
        break;
      case 'inARow':
        const currentInARow = parseInt(matchesInARow);
        setMatchesInARow((currentInARow + 1).toString());
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
      case 'points':
        const currentPoints = parseInt(matchesForPoints);
        if (currentPoints > 1) {
          setMatchesForPoints((currentPoints - 1).toString());
        }
        break;
      case 'differential':
        const currentDifferential = parseInt(matchesForDifferential);
        if (currentDifferential > 1) {
          setMatchesForDifferential((currentDifferential - 1).toString());
        }
        break;
      case 'inARow':
        const currentInARow = parseInt(matchesInARow);
        if (currentInARow > 1) {
          setMatchesInARow((currentInARow - 1).toString());
        }
        break;
    }
  };

  const shouldShowMatchesField = () => {
    return ['Win Rate %', 'Points Scored', 'Point Differential'].includes(goalType);
  };

  const getMatchesFieldLabel = () => {
    switch (goalType) {
      case 'Win Rate %':
        return 'Over Next X Matches';
      case 'Points Scored':
        return 'Over Next X Matches';
      case 'Point Differential':
        return 'Over Next X Matches';
      default:
        return '';
    }
  };

  const getMatchesFieldValue = () => {
    switch (goalType) {
      case 'Win Rate %':
        return matchesForWinRate;
      case 'Points Scored':
        return matchesForPoints;
      case 'Point Differential':
        return matchesForDifferential;
      default:
        return '';
    }
  };

  const getMatchesFieldKey = () => {
    switch (goalType) {
      case 'Win Rate %':
        return 'matchesForWinRate';
      case 'Points Scored':
        return 'matchesForPoints';
      case 'Point Differential':
        return 'matchesForDifferential';
      default:
        return '';
    }
  };

  const setMatchesFieldValue = (value: string) => {
    switch (goalType) {
      case 'Win Rate %':
        setMatchesForWinRate(value);
        break;
      case 'Points Scored':
        setMatchesForPoints(value);
        break;
      case 'Point Differential':
        setMatchesForDifferential(value);
        break;
    }
  };

  const incrementMatchesField = () => {
    switch (goalType) {
      case 'Win Rate %':
        incrementMatches('winRate');
        break;
      case 'Points Scored':
        incrementMatches('points');
        break;
      case 'Point Differential':
        incrementMatches('differential');
        break;
    }
  };

  const decrementMatchesField = () => {
    switch (goalType) {
      case 'Win Rate %':
        decrementMatches('winRate');
        break;
      case 'Points Scored':
        decrementMatches('points');
        break;
      case 'Point Differential':
        decrementMatches('differential');
        break;
    }
  };

  const getGoalDescription = () => {
    const number = parseInt(timeframeNumber);
    const isPlural = number > 1;
    
    switch (goalType) {
      case 'Total Matches Played':
        return `Play ${targetValue} matches in ${number} ${timeframe.toLowerCase()}${isPlural ? 's' : ''}`;
      case 'Wins':
        return `Win ${targetValue} matches in ${number} ${timeframe.toLowerCase()}${isPlural ? 's' : ''}`;
      case 'Win Rate %':
        return `Achieve ${targetValue}% win rate over next ${matchesForWinRate} matches`;
      case 'Points Scored':
        return `Score ${targetValue} touches in ${number} ${timeframe.toLowerCase()}${isPlural ? 's' : ''}`;
      case 'Point Differential':
        return `End +${targetValue} in point differential over ${matchesForDifferential} matches`;
      case 'Streaks':
        return `Win ${targetValue} matches in a row`;
      default:
        return `Set a goal for ${number} ${timeframe.toLowerCase()}${isPlural ? 's' : ''}`;
    }
  };

  const shouldShowTimeframe = () => {
    return !['Streaks'].includes(goalType);
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
      justifyContent: 'flex-start',
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
    contentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.012,
    },
    textSection: {
      width: width * 0.55, // Increased from 0.45 to 0.55
      maxWidth: width * 0.55, // Same as width to enforce limit
      marginRight: width * 0.04, // Further reduced margin
    },
    progressSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -height * 0.04,
    },
    progressCircle: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressText: {
      position: 'absolute',
      fontSize: width * 0.032,
      fontWeight: '700',
      color: 'white',
    },
    progressValueText: {
      fontSize: width * 0.032,
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
    dropdownText: {
      fontSize: width * 0.03,
      color: 'white',
      flex: 1,
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
    notesInput: {
      fontSize: width * 0.03,
      color: 'white',
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.025,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.01,
      borderWidth: 1,
      borderColor: '#464646',
      textAlignVertical: 'top',
      minHeight: height * 0.08,
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
      <View style={styles.header}>
        <View style={styles.daysLeftTag}>
          <Text style={styles.daysLeftTagText}>{daysLeft} days left</Text>
        </View>
      </View>
      
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.contentRow}>
        <View style={styles.textSection}>
          <Text style={styles.description}>
            {description ? truncateDescription(description) : 'Track your progress and stay motivated'}
          </Text>
        </View>
        
        <View style={styles.progressSection}>
          <View style={styles.progressCircle}>
            <CircularProgress
              value={progress}
              radius={width * 0.075}
              activeStrokeColor={Colors.purple.primary}
              inActiveStrokeColor="rgba(255,255,255,0.3)"
              activeStrokeWidth={width * 0.01}
              inActiveStrokeWidth={width * 0.01}
              progressValueColor="white"
              progressValueStyle={styles.progressValueText}
              valueSuffix="%"
              showProgressValue={true}
              duration={1000}
              clockwise={true}
            />
          </View>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        {title === "No Active Goals" ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSetNewGoalClick}>
            <Text style={styles.secondaryButtonText}>Set New Goal</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={onUpdateGoal}>
            <Text style={styles.primaryButtonText}>Update Goal</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Set New Goal Modal */}
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
          <TouchableOpacity 
            style={styles.modalContainer} 
            activeOpacity={1} 
            onPress={() => {}}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Set a New Goal</Text>
            </View>

            {/* Goal Form */}
            <View style={styles.goalForm}>
              {/* Goal Type */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Goal Type</Text>
                <TouchableOpacity 
                  style={styles.dropdownContainer}
                  onPress={() => setShowGoalTypeDropdown(!showGoalTypeDropdown)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownText}>{goalType}</Text>
                  <Ionicons 
                    name={showGoalTypeDropdown ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color="rgba(255, 255, 255, 0.7)" 
                  />
                </TouchableOpacity>
                
                {showGoalTypeDropdown && (
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
                      onPress={() => startEditing('targetValue', targetValue)}
                    >
                      <Text style={styles.targetValue}>{targetValue}</Text>
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

              {/* Conditional Matches Field */}
              {shouldShowMatchesField() && (
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

              {/* Matches in a Row Field for Streaks */}
              {goalType === 'Streaks' && (
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Matches in a Row</Text>
                  <View style={styles.targetValueContainer}>
                    <TouchableOpacity style={styles.targetButton} onPress={() => decrementMatches('inARow')}>
                      <Text style={styles.targetButtonText}>-</Text>
                    </TouchableOpacity>
                    
                    {editingField === 'matchesInARow' ? (
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
                        onPress={() => startEditing('matchesInARow', matchesInARow)}
                      >
                        <Text style={styles.targetValue}>{matchesInARow}</Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity style={styles.targetButton} onPress={() => incrementMatches('inARow')}>
                      <Text style={styles.targetButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Notes */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Focus on consistency this month."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

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
                <Text style={styles.saveButtonText}>Save Goal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

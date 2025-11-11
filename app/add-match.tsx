import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { matchService } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddMatchScreen() {
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  const { user, userName } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Helper function to get first name from full name
  const getFirstName = (fullName: string | undefined | null): string => {
    if (!fullName || !fullName.trim()) return 'Your';
    return fullName.trim().split(' ')[0];
  };
  
  const userFirstName = getFirstName(userName) || 'Your';
  
  // Helper function to get stable dimensions
  const getDimension = (percentage: number, base: number) => {
    return Math.round(base * percentage);
  };
  
  // Check if we're in edit mode
  const isEditMode = params.editMode === 'true';
  
  // Initialize state with params if in edit mode
  const [matchDate, setMatchDate] = useState(() => {
    if (isEditMode && params.date && params.time) {
      // Parse date and time from params
      const dateStr = params.date as string;
      const timeStr = params.time as string;
      // Simple parsing - you might want to make this more robust
      const [day, month, year] = dateStr.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      // Parse time
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        date.setHours(hours, minutes);
      }
      
      return date;
    }
    return new Date();
  });
  
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [opponentName, setOpponentName] = useState(params.opponentName as string || '');
  const [event, setEvent] = useState(params.matchType as string || 'Training');
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [weaponType, setWeaponType] = useState('Foil');
  const [showWeaponDropdown, setShowWeaponDropdown] = useState(false);
  const [notes, setNotes] = useState(params.notes as string || '');
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [editingScore, setEditingScore] = useState<'your' | 'opponent' | null>(null);
  const [tempScore, setTempScore] = useState('');
  const [yourScore, setYourScore] = useState(params.yourScore as string || '0');
  const [opponentScore, setOpponentScore] = useState(params.opponentScore as string || '0');
  const [isSaving, setIsSaving] = useState(false);
  const [hasStartedForm, setHasStartedForm] = useState(false);

  const pointDifferential = parseInt(yourScore) - parseInt(opponentScore);
  const isWinner = pointDifferential > 0;

  // Track screen view
  useFocusEffect(
    useCallback(() => {
      analytics.screen('AddMatch');
    }, [])
  );

  // Track form start when user begins filling
  useEffect(() => {
    if ((opponentName || event !== 'Training' || weaponType !== 'Foil' || notes) && !hasStartedForm) {
      setHasStartedForm(true);
      analytics.matchFormStarted();
    }
  }, [opponentName, event, weaponType, notes, hasStartedForm]);

  // Track form abandonment on unmount if not saved
  useEffect(() => {
    return () => {
      if (hasStartedForm && !isSaving) {
        const hasData = opponentName || event !== 'Training' || weaponType !== 'Foil' || notes;
        if (hasData) {
          analytics.formAbandon({ form_type: 'match' });
        }
      }
    };
  }, [hasStartedForm, isSaving, opponentName, event, weaponType, notes]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const getNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const selectDate = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setMatchDate(selectedDate);
    setShowCalendar(false);
    
    // Automatically open time picker after date selection
    setTimeout(() => {
      setShowTimePicker(true);
    }, 100);
  };

  const handleCalendarPress = () => {
    setCurrentMonth(new Date(matchDate));
    setShowCalendar(true);
  };

  const handleTimePress = () => {
    // Only close calendar if it's open, otherwise just open time picker
    if (showCalendar) {
      setShowCalendar(false);
      // Small delay to ensure calendar modal is closed before opening time picker
      setTimeout(() => {
        setShowTimePicker(true);
      }, 100);
    } else {
      setShowTimePicker(true);
    }
  };

  const handleSaveMatch = async () => {
    // Prevent double submissions
    if (isSaving) {
      console.log('⏳ Already saving match, ignoring duplicate request');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to save a match');
      return;
    }

    if (!opponentName.trim()) {
      Alert.alert('Error', 'Please enter an opponent name');
      return;
    }

    setIsSaving(true);
    try {
      console.log('💾 Saving manual match...', {
        matchDate,
        opponentName,
        event,
        weaponType,
        notes,
        yourScore,
        opponentScore
      });

      // Save to database
      const savedMatch = await matchService.createManualMatch({
        userId: user.id,
        opponentName: opponentName.trim(),
        yourScore: parseInt(yourScore),
        opponentScore: parseInt(opponentScore),
        matchType: event === 'Training' ? 'training' : 'competition',
        date: matchDate.toLocaleDateString('en-GB'),
        time: matchDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        notes: notes.trim() || undefined,
        weaponType: weaponType,
      });

      if (savedMatch) {
        console.log('✅ Match saved successfully:', savedMatch);
        
        // Track match save success
        analytics.matchSave({ 
          match_type: event === 'Training' ? 'training' : 'competition',
          weapon_type: weaponType
        });
        
        // Navigate to manual match summary page
        router.push({
          pathname: '/manual-match-summary',
          params: {
            matchId: savedMatch.match_id,
            yourScore,
            opponentScore,
            opponentName,
            matchType: event,
            date: matchDate.toLocaleDateString('en-GB'),
            time: matchDate.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            }),
            isWin: (parseInt(yourScore) > parseInt(opponentScore)).toString(),
            notes,
          }
        });
      } else {
        analytics.matchSaveFailure({ error_type: 'database_save_failed' });
        Alert.alert('Error', 'Failed to save match. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error saving match:', error);
      analytics.matchSaveFailure({ error_type: 'unexpected_error' });
      Alert.alert('Error', 'Failed to save match. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const closeWeaponDropdown = () => {
    setShowWeaponDropdown(false);
  };

  const closeEventDropdown = () => {
    setShowEventDropdown(false);
  };

  const openScoreModal = (scoreType: 'your' | 'opponent') => {
    setEditingScore(scoreType);
    setTempScore(scoreType === 'your' ? yourScore : opponentScore);
    setShowScoreModal(true);
  };

  const closeScoreModal = () => {
    setShowScoreModal(false);
    setEditingScore(null);
    setTempScore('');
  };

  const saveScore = () => {
    if (editingScore === 'your') {
      setYourScore(tempScore);
    } else if (editingScore === 'opponent') {
      setOpponentScore(tempScore);
    }
    closeScoreModal();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: getDimension(0.04, width),
      paddingVertical: getDimension(0.01, height),
      backgroundColor: 'rgba(33, 33, 33, 1)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
      width: getDimension(0.08, width),
      height: getDimension(0.08, width),
      borderRadius: getDimension(0.04, width),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: getDimension(0.02, width),
    },
    headerTitle: {
      fontSize: getDimension(0.05, width),
      fontWeight: '700',
      color: 'white',
    },
    content: {
      flex: 1,
      padding: getDimension(0.04, width),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: getDimension(0.04, width),
      paddingBottom: getDimension(0.02, height),
    },
    section: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: getDimension(0.03, width),
      padding: getDimension(0.025, width),
      marginBottom: getDimension(0.012, height),
    },
    sectionTitle: {
      fontSize: getDimension(0.045, width),
      fontWeight: '700',
      color: 'white',
      marginBottom: getDimension(0.012, height),
    },
    inputGroup: {
      marginBottom: getDimension(0.012, height),
    },
    inputLabel: {
      fontSize: getDimension(0.035, width),
      fontWeight: '500',
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: getDimension(0.004, height),
    },
    inputField: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.02, width),
      paddingHorizontal: getDimension(0.025, width),
      paddingVertical: getDimension(0.008, height),
      fontSize: getDimension(0.04, width),
      color: 'white',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    dateInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.02, width),
      paddingHorizontal: getDimension(0.01, width),
      paddingVertical: getDimension(0.004, height),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    dateInput: {
      flex: 1,
      fontSize: getDimension(0.04, width),
      color: 'white',
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingVertical: getDimension(0.01, height),
    },
    calendarIcon: {
      width: getDimension(0.08, width),
      height: getDimension(0.08, width),
      borderRadius: getDimension(0.015, width),
      backgroundColor: Colors.purple.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: getDimension(0.015, width),
    },
    dropdownContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.02, width),
      paddingHorizontal: getDimension(0.03, width),
      paddingVertical: getDimension(0.01, height),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    dropdownText: {
      fontSize: getDimension(0.04, width),
      color: 'white',
    },
    dropdownOptions: {
      position: 'absolute',
      top: getDimension(0.06, height),
      left: 0,
      right: 0,
      backgroundColor: Colors.dark.background,
      borderRadius: getDimension(0.02, width),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      maxHeight: getDimension(0.15, height),
      overflow: 'hidden',
      zIndex: 1000,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: getDimension(0.03, width),
      paddingVertical: getDimension(0.015, height),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    dropdownOptionText: {
      fontSize: getDimension(0.04, width),
      color: 'white',
      fontWeight: '500',
    },
    dropdownOptionSelected: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    dropdownOptionTextSelected: {
      color: Colors.purple.primary,
      fontWeight: '600',
    },
    scoreCardsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: getDimension(0.018, height),
      paddingHorizontal: getDimension(0.006, width),
      alignItems: 'flex-start',
    },
    scoreCard: {
      width: getDimension(0.24, width),
      height: getDimension(0.1, height),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.025, width),
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: getDimension(0.01, width),
      paddingTop: getDimension(0.008, height),
      overflow: 'hidden',
      // Add visual feedback for touch
      elevation: 2, // Android shadow
      shadowColor: '#000', // iOS shadow
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    scoreInputContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      maxHeight: getDimension(0.05, height),
      paddingHorizontal: getDimension(0.003, width),
      paddingVertical: getDimension(0.002, height),
      paddingTop: getDimension(0.002, height),
    },
    scoreLabel: {
      fontSize: getDimension(0.035, width),
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
      lineHeight: getDimension(0.04, width),
      marginTop: getDimension(0.001, height),
    },
    differentialCard: {
      width: getDimension(0.24, width),
      height: getDimension(0.1, height),
      borderRadius: getDimension(0.025, width),
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: getDimension(0.01, width),
      paddingTop: getDimension(0.008, height),
      overflow: 'hidden',
    },
    winnerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: getDimension(0.02, width),
      paddingHorizontal: getDimension(0.03, width),
      paddingVertical: getDimension(0.015, height),
    },
    winnerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    trophyIcon: {
      fontSize: getDimension(0.05, width),
      marginRight: getDimension(0.015, width),
    },
    winnerText: {
      fontSize: getDimension(0.04, width),
      fontWeight: '700',
      color: 'white',
    },
    winnerSubtext: {
      fontSize: getDimension(0.03, width),
      color: 'rgba(255, 255, 255, 0.7)',
      marginLeft: getDimension(0.008, width),
    },
    winBadge: {
      backgroundColor: Colors.green.accent,
      borderRadius: getDimension(0.02, width),
      paddingHorizontal: getDimension(0.03, width),
      paddingVertical: getDimension(0.008, height),
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkmarkIcon: {
      fontSize: getDimension(0.035, width),
      color: 'white',
      marginRight: getDimension(0.015, width),
    },
    winText: {
      fontSize: getDimension(0.035, width),
      fontWeight: '600',
      color: 'white',
    },
    saveButton: {
      borderRadius: getDimension(0.02, width),
      paddingVertical: getDimension(0.015, height),
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: getDimension(0.015, height),
      // Drop shadow effects from reusable gradientButton style
      shadowColor: Colors.gradientButton.shadowColor,
      shadowOffset: Colors.gradientButton.shadowOffset,
      shadowOpacity: Colors.gradientButton.shadowOpacity,
      shadowRadius: Colors.gradientButton.shadowRadius,
      elevation: Colors.gradientButton.elevation,
    },
    saveButtonText: {
      fontSize: getDimension(0.045, width),
      fontWeight: '700',
      color: 'white',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: Colors.dark.background,
      borderRadius: getDimension(0.03, width),
      padding: getDimension(0.04, width),
      width: getDimension(0.9, width), // Increased from 0.8 to accommodate all 7 columns
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: getDimension(0.05, width),
      fontWeight: '700',
      color: 'white',
      marginBottom: getDimension(0.02, height),
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginTop: getDimension(0.02, height),
    },
    modalButton: {
      paddingVertical: getDimension(0.01, height),
      paddingHorizontal: getDimension(0.05, width),
      borderRadius: getDimension(0.02, width),
    },
    modalButtonText: {
      fontSize: getDimension(0.04, width),
      fontWeight: '700',
      color: 'white',
    },
    modalButtonPrimary: {
      backgroundColor: Colors.purple.primary,
    },
    datePickerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: getDimension(0.02, height),
    },
    datePickerValue: {
      fontSize: getDimension(0.05, width),
      fontWeight: '700',
      color: 'white',
    },
    daysOfWeekContainer: {
      flexDirection: 'row',
      marginTop: getDimension(0.01, height),
      marginBottom: getDimension(0.01, height),
    },
    dayOfWeekText: {
      flex: 1,
      textAlign: 'center',
      fontSize: getDimension(0.035, width),
      color: 'rgba(255, 255, 255, 0.7)',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: getDimension(0.01, height),
      width: '100%',
      justifyContent: 'space-between',
    },
    calendarDayCell: {
      width: '13%', // Slightly smaller to ensure all 7 columns fit
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: getDimension(0.005, height),
    },
    calendarDayButton: {
      width: getDimension(0.12, width),
      aspectRatio: 1,
      borderRadius: getDimension(0.02, width),
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarDayButtonSelected: {
      backgroundColor: Colors.purple.primary,
      borderColor: Colors.purple.primary,
    },
    calendarDayButtonInactive: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    calendarDayText: {
      fontSize: getDimension(0.04, width),
      color: 'white',
    },
    calendarDayTextSelected: {
      color: 'white',
    },
    calendarDayTextInactive: {
      fontSize: getDimension(0.04, width),
      color: 'rgba(255, 255, 255, 0.3)',
    },
    timeSelectionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: getDimension(0.015, height),
      marginBottom: getDimension(0.02, height),
    },
    timeSelectionLabel: {
      fontSize: getDimension(0.04, width),
      color: 'white',
      marginRight: getDimension(0.015, width),
    },
    timeInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.02, width),
      paddingHorizontal: getDimension(0.03, width),
      paddingVertical: getDimension(0.01, height),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      minHeight: getDimension(0.05, height),
      // Add visual feedback for touch
      elevation: 2, // Android shadow
      shadowColor: '#000', // iOS shadow
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    timeInput: {
      flex: 1,
      fontSize: getDimension(0.04, width),
      color: 'white',
      textAlign: 'center',
      paddingVertical: getDimension(0.01, height),
    },
    timeInputText: {
      flex: 1,
      fontSize: getDimension(0.04, width),
      color: 'white',
      textAlign: 'center',
      paddingVertical: getDimension(0.01, height),
    },
    timePickerButton: {
      padding: getDimension(0.01, width),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.015, width),
      marginLeft: getDimension(0.02, width),
    },
    spinnerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginTop: getDimension(0.02, height),
      marginBottom: getDimension(0.02, height),
    },
    spinnerColumn: {
      alignItems: 'center',
      flex: 1,
    },
    spinnerColumnLabel: {
      fontSize: getDimension(0.04, width),
      color: 'white',
      marginBottom: getDimension(0.01, height),
      fontWeight: '600',
    },
    pickerWheel: {
      width: getDimension(0.25, width),
      height: getDimension(0.25, height),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.125, height),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      overflow: 'hidden',
      // Add subtle shadow for depth
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    picker: {
      width: '100%',
      height: '100%',
      backgroundColor: 'transparent',
      ...Platform.select({
        ios: {
          color: 'white',
        },
        android: {
          color: 'white',
          backgroundColor: 'transparent',
        },
      }),
    },
    pickerItem: {
      color: 'white',
      fontSize: getDimension(0.04, width),
      backgroundColor: 'transparent',
      ...Platform.select({
        ios: {
          backgroundColor: 'transparent',
        },
        android: {
          backgroundColor: 'transparent',
        },
      }),
    },
    pickerItemSelected: {
      ...Platform.select({
        ios: {
          color: 'white',
          fontWeight: '700',
        },
        android: {
          color: 'white',
          fontWeight: '700',
        },
      }),
    },
    currentTimeDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: getDimension(0.01, height),
      marginBottom: getDimension(0.02, height),
    },
    currentTimeLabel: {
      fontSize: getDimension(0.04, width),
      color: 'white',
      marginRight: getDimension(0.015, width),
    },
    currentTimeValue: {
      fontSize: getDimension(0.05, width),
      fontWeight: '700',
      color: 'white',
    },
    dropdownWrapper: {
      position: 'relative',
    },
    dropdownBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },
    scoreInput: {
      fontSize: getDimension(0.07, width),
      fontWeight: '700',
      color: 'white',
      textAlign: 'center',
      includeFontPadding: false,
      textAlignVertical: 'center',
      lineHeight: getDimension(0.07, width),
      overflow: 'hidden',
    },
    modalScoreInput: {
      fontSize: getDimension(0.08, width),
      fontWeight: '700',
      color: 'white',
      textAlign: 'center',
      paddingVertical: getDimension(0.02, height),
      paddingHorizontal: getDimension(0.04, width),
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.025, width),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      width: '100%',
      minHeight: getDimension(0.08, height),
      // Add visual feedback for touch
      elevation: 3, // Android shadow
      shadowColor: '#000', // iOS shadow
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor="rgba(33, 33, 33, 1)" translucent={false} />
      {/* Color the OS status bar area without affecting layout */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: 'rgba(33, 33, 33, 1)' }} />
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: getDimension(0.08, width), alignItems: 'flex-start' }}>
          <BackButton onPress={handleBack} />
        </View>
        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>
          {isEditMode ? 'Edit Match' : 'Add New Match'}
        </Text>
        <View style={{ width: getDimension(0.08, width) }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View>
            {/* Match Details Section */}
            <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Match Date</Text>
            <View style={styles.dateInputContainer}>
              <TextInput
                style={styles.dateInput}
                value={formatDate(matchDate)}
                placeholder="Select date"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                editable={false}
              />
              <TouchableOpacity 
                style={styles.calendarIcon} 
                onPress={handleCalendarPress}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="calendar" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Opponent Name</Text>
            <TextInput
              style={styles.inputField}
              value={opponentName}
              onChangeText={setOpponentName}
              placeholder="Enter opponent name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Event</Text>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity 
                style={styles.dropdownContainer}
                onPress={() => {
                  setShowEventDropdown(!showEventDropdown);
                  setShowWeaponDropdown(false); // Close weapon dropdown
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownText}>{event}</Text>
                <Ionicons 
                  name={showEventDropdown ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="rgba(255, 255, 255, 0.7)" 
                />
              </TouchableOpacity>
              
              {/* Event Dropdown Options */}
              {showEventDropdown && (
                <>
                  <View style={styles.dropdownOptions}>
                    {['Training', 'Competition'].map((eventType) => (
                      <TouchableOpacity
                        key={eventType}
                        style={[
                          styles.dropdownOption,
                          event === eventType && styles.dropdownOptionSelected
                        ]}
                        onPress={() => {
                          setEvent(eventType);
                          setShowEventDropdown(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          event === eventType && styles.dropdownOptionTextSelected
                        ]}>
                          {eventType}
                        </Text>
                        {event === eventType && (
                          <Ionicons name="checkmark" size={16} color={Colors.purple.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Backdrop to close dropdown */}
                  <TouchableOpacity
                    style={styles.dropdownBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowEventDropdown(false)}
                  />
                </>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weapon Type</Text>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity 
                style={styles.dropdownContainer}
                onPress={() => {
                  setShowWeaponDropdown(!showWeaponDropdown);
                  setShowEventDropdown(false); // Close event dropdown
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownText}>{weaponType}</Text>
                <Ionicons 
                  name={showWeaponDropdown ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="rgba(255, 255, 255, 0.7)" 
                />
              </TouchableOpacity>
              
              {/* Weapon Dropdown Options */}
              {showWeaponDropdown && (
                <>
                  <View style={styles.dropdownOptions}>
                    {['Foil', 'Sabre', 'Epee'].map((weapon) => (
                      <TouchableOpacity
                        key={weapon}
                        style={[
                          styles.dropdownOption,
                          weaponType === weapon && styles.dropdownOptionSelected
                        ]}
                        onPress={() => {
                          setWeaponType(weapon);
                          setShowWeaponDropdown(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          weaponType === weapon && styles.dropdownOptionTextSelected
                        ]}>
                          {weapon}
                        </Text>
                        {weaponType === weapon && (
                          <Ionicons name="checkmark" size={16} color={Colors.purple.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Backdrop to close dropdown */}
                  <TouchableOpacity
                    style={styles.dropdownBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowWeaponDropdown(false)}
                  />
                </>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={styles.inputField}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add match notes..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Match Outcome Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match Outcome</Text>
          
          <View style={styles.scoreCardsContainer}>
            <TouchableOpacity
              style={styles.scoreCard}
              onPress={() => openScoreModal('your')}
              activeOpacity={0.7}
            >
              <View style={styles.scoreInputContainer}>
                <Text style={styles.scoreInput}>{yourScore}</Text>
              </View>
              <Text style={styles.scoreLabel}>{userFirstName}'s Score</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.scoreCard}
              onPress={() => openScoreModal('opponent')}
              activeOpacity={0.7}
            >
              <View style={styles.scoreInputContainer}>
                <Text style={styles.scoreInput}>{opponentScore}</Text>
              </View>
              <Text style={styles.scoreLabel}>
                {opponentName || 'Opponent'} Score
              </Text>
            </TouchableOpacity>
            
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.differentialCard, { borderWidth: 2, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <View style={styles.scoreInputContainer}>
                <Text style={styles.scoreInput}>
                  {pointDifferential > 0 ? '+' : ''}{pointDifferential}
                </Text>
              </View>
              <Text style={styles.scoreLabel}>Point Differential</Text>
            </LinearGradient>
          </View>

          <View style={styles.winnerContainer}>
            <View style={styles.winnerLeft}>
              <Text style={styles.trophyIcon}>
                {isWinner ? '🏆' : '😔'}
              </Text>
              <Text style={styles.winnerText}>
                {isWinner ? 'You' : (opponentName || 'Opponent')}
              </Text>
              <Text style={styles.winnerSubtext}>
                {isWinner ? 'Winner' : 'Defeated'}
              </Text>
            </View>
            
            <View style={[styles.winBadge, { 
              backgroundColor: isWinner ? Colors.green.accent : Colors.red.accent 
            }]}>
              <Ionicons 
                name={isWinner ? "checkmark" : "close"} 
                size={14} 
                color="white" 
              />
              <Text style={styles.winText}>
                {isWinner ? 'Win' : 'Loss'}
              </Text>
            </View>
          </View>

          {/* Save Match Button */}
          <LinearGradient
            colors={Colors.gradientButton.colors}
            style={[styles.saveButton, { marginTop: getDimension(0.04, height) }]}
            start={Colors.gradientButton.start}
            end={Colors.gradientButton.end}
          >
            <TouchableOpacity 
              onPress={handleSaveMatch} 
              style={{ width: '100%', alignItems: 'center' }}
              disabled={isSaving}
            >
              <Text style={[styles.saveButtonText, isSaving && { opacity: 0.7 }]}>
                {isSaving ? 'Saving...' : (isEditMode ? 'Update Match' : 'Save Match')}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
          </View>
        </View>
        </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <Modal
        visible={showCalendar}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowCalendar(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            setShowCalendar(false);
          }}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>
              Select Date
            </Text>
            
            {/* Month Navigation */}
            <View style={styles.datePickerContainer}>
              <TouchableOpacity onPress={getPreviousMonth}>
                <Ionicons name="chevron-back" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.datePickerValue}>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={getNextMonth}>
                <Ionicons name="chevron-forward" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Days of Week Header */}
            <View style={styles.daysOfWeekContainer}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <Text key={index} style={styles.dayOfWeekText}>{day}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {Array.from({ length: 42 }).map((_, index) => {
                const day = index - getDaysInMonth(currentMonth).startingDayOfWeek + 1;
                const isCurrentMonth = day > 0 && day <= getDaysInMonth(currentMonth).daysInMonth;
                const isSelected = matchDate.getDate() === day && matchDate.getMonth() === currentMonth.getMonth() && matchDate.getFullYear() === currentMonth.getFullYear();

                return (
                  <View key={index} style={styles.calendarDayCell}>
                    {isCurrentMonth ? (
                      <TouchableOpacity
                        style={[
                          styles.calendarDayButton,
                          isSelected && styles.calendarDayButtonSelected
                        ]}
                        onPress={() => selectDate(day)}
                      >
                        <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.calendarDayButtonInactive}>
                        <Text style={styles.calendarDayTextInactive}></Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Time Selection */}
            <View style={styles.timeSelectionContainer}>
              <Text style={styles.timeSelectionLabel}>Time:</Text>
              <TouchableOpacity 
                style={styles.timeInputContainer}
                onPress={handleTimePress}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.timeInputText}>
                  {matchDate.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Text>
                <View style={styles.timePickerButton}>
                  <Ionicons name="time" size={20} color="white" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  setShowCalendar(false);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]} 
                onPress={() => {
                  setShowCalendar(false);
                }}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowTimePicker(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            setShowTimePicker(false);
          }}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>
              Select Time
            </Text>
            
            {/* Spinner Time Picker */}
            <View style={styles.spinnerContainer}>
              {/* Hour Column */}
              <View style={styles.spinnerColumn}>
                <Text style={styles.spinnerColumnLabel}>Hour</Text>
                <View style={styles.pickerWheel}>
                  <Picker
                    key={`hour-${matchDate.getHours()}`}
                    selectedValue={matchDate.getHours() === 0 ? 12 : (matchDate.getHours() > 12 ? matchDate.getHours() - 12 : matchDate.getHours())}
                    onValueChange={(itemValue) => {
                      const newDate = new Date(matchDate);
                      const currentHour = newDate.getHours();
                      const isPM = currentHour >= 12;
                      
                      // Convert 12-hour format back to 24-hour format
                      let newHour = itemValue === 12 ? 0 : itemValue;
                      if (isPM && newHour !== 0) {
                        newHour += 12;
                      }
                      
                      newDate.setHours(newHour);
                      setMatchDate(newDate);
                    }}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <Picker.Item 
                        key={i} 
                        label={(i === 0 ? 12 : i).toString()} 
                        value={i === 0 ? 12 : i} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>
              
              {/* Minute Column */}
              <View style={styles.spinnerColumn}>
                <Text style={styles.spinnerColumnLabel}>Minute</Text>
                <View style={styles.pickerWheel}>
                  <Picker
                    key={`minute-${matchDate.getMinutes()}`}
                    selectedValue={matchDate.getMinutes()}
                    onValueChange={(itemValue) => {
                      const newDate = new Date(matchDate);
                      newDate.setMinutes(itemValue);
                      setMatchDate(newDate);
                    }}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <Picker.Item 
                        key={i} 
                        label={i.toString().padStart(2, '0')} 
                        value={i} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>
              
              {/* AM/PM Column */}
              <View style={styles.spinnerColumn}>
                <Text style={styles.spinnerColumnLabel}>AM/PM</Text>
                <View style={styles.pickerWheel}>
                  <Picker
                    key={`ampm-${matchDate.getHours() >= 12 ? 'PM' : 'AM'}`}
                    selectedValue={matchDate.getHours() < 12 ? 'AM' : 'PM'}
                    onValueChange={(itemValue) => {
                      const newDate = new Date(matchDate);
                      const currentHour = newDate.getHours();
                      if (itemValue === 'PM' && currentHour < 12) {
                        newDate.setHours(currentHour + 12);
                      } else if (itemValue === 'AM' && currentHour >= 12) {
                        newDate.setHours(currentHour - 12);
                      }
                      setMatchDate(newDate);
                    }}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="AM" value="AM" />
                    <Picker.Item label="PM" value="PM" />
                  </Picker>
                </View>
              </View>
            </View>
            
            {/* Current Selection Display */}
            <View style={styles.currentTimeDisplay}>
              <Text style={styles.currentTimeLabel}>Selected Time:</Text>
              <Text style={styles.currentTimeValue}>
                {matchDate.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </Text>
            </View>
            
            {/* Back to Calendar Button */}
            <TouchableOpacity 
              style={[styles.modalButton, { marginBottom: getDimension(0.02, height) }]}
              onPress={() => {
                setShowTimePicker(false);
                setTimeout(() => {
                  setShowCalendar(true);
                }, 100);
              }}
            >
              <Text style={styles.modalButtonText}>← Back to Calendar</Text>
            </TouchableOpacity>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]} 
                onPress={() => {
                  setShowTimePicker(false);
                }}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Score Modal */}
      <Modal
        visible={showScoreModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          closeScoreModal();
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            closeScoreModal();
          }}
        >
          <TouchableOpacity 
            style={styles.modalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>
              {editingScore === 'your' ? `Edit ${userFirstName}'s Score` : 'Edit Opponent Score'}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Score</Text>
              <View style={{ marginTop: getDimension(0.015, height), marginBottom: getDimension(0.02, height) }}>
                <TextInput
                  style={styles.modalScoreInput}
                  value={tempScore}
                  onChangeText={setTempScore}
                  keyboardType="numeric"
                  maxLength={2}
                  textAlign="center"
                  placeholder="0"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  autoFocus={true}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={closeScoreModal}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]} 
                onPress={saveScore}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

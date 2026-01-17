import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { weeklyProgressService, weeklySessionLogService, weeklyTargetService } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

interface ProgressCardProps {
  activityType?: string; // Make it configurable
  onDataUpdate?: () => void; // Callback when data changes
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  activityType = 'Footwork',
  onDataUpdate,
}) => {
  const { width, height } = useWindowDimensions();
  const { user, session, authReady } = useAuth();
  const accessToken = session?.access_token ?? undefined;
  
  // State for current week progress
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTarget, setHasTarget] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(activityType);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [sessionCount, setSessionCount] = useState(3);
  
  // Track modal state for analytics
  const [modalOpenTime, setModalOpenTime] = useState<number | null>(null);
  const [modalSource, setModalSource] = useState<'splash' | 'edit' | 'completion' | 'unknown'>('unknown');
  const [modalSaved, setModalSaved] = useState(false);
  
  // Counter state for animated text
  const [counterText, setCounterText] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [lastWeekChecked, setLastWeekChecked] = useState<string>('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousProgress, setPreviousProgress] = useState(0);
  
  // Future week state
  const [isFutureWeek, setIsFutureWeek] = useState(false);
  const [futureWeekStart, setFutureWeekStart] = useState<Date | null>(null);
  const [futureWeekEnd, setFutureWeekEnd] = useState<Date | null>(null);
  const [daysUntilTarget, setDaysUntilTarget] = useState(0);
  const [weeksUntilTarget, setWeeksUntilTarget] = useState(0);
  
  // Dropdown menu state
  const [showEditDropdown, setShowEditDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  
  // Completion state
  const [isTargetComplete, setIsTargetComplete] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedTargetSessions, setCompletedTargetSessions] = useState(0);
  const [showWeekChoiceModal, setShowWeekChoiceModal] = useState(false);
  const [selectedCompletionAction, setSelectedCompletionAction] = useState<'keep' | 'increase' | 'custom'>('keep');
  
  const progress = total > 0 ? current / total : 0;
  
  // Get motivational message based on progress
  const getMotivationalMessage = () => {
    if (total === 0) return '';
    
    const remaining = total - current;
    const progressPercentage = (current / total) * 100;
    
    if (progressPercentage >= 100) {
      return "🎉 Target completed! Great job!";
    } else if (progressPercentage >= 80) {
      return `Almost there! ${remaining} session${remaining !== 1 ? 's' : ''} to go!`;
    } else if (progressPercentage > 50) {
      return `You are over halfway there! ${remaining} session${remaining !== 1 ? 's' : ''} remaining.`;
    } else if (progressPercentage >= 50) {
      return `You're halfway there! ${remaining} session${remaining !== 1 ? 's' : ''} remaining.`;
    } else if (progressPercentage >= 25) {
      return `Good start! ${remaining} session${remaining !== 1 ? 's' : ''} to reach your target.`;
    } else if (current > 0) {
      return `Keep going! ${remaining} session${remaining !== 1 ? 's' : ''} to reach your target.`;
    } else {
      return `Ready to start? Your target is ${total} session${total !== 1 ? 's' : ''} this week.`;
    }
  };
  
  const activityOptions = ['Footwork', '1-2-1 Lessons', 'Recovery', 'Video Review'];
  
  // Generate week options (current week + 5 following weeks)
  const generateWeekOptions = () => {
    const options = [];
    const today = new Date();
    
    for (let i = 0; i < 6; i++) {
      const weekStart = new Date(today);
      // Get Monday of the week
      const dayOfWeek = weekStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(weekStart.getDate() + daysToMonday + (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
      const startDay = weekStart.getDate();
      const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
      const endDay = weekEnd.getDate();
      
      options.push({
        id: i,
        label: `${startMonth} ${startDay} - ${endMonth} ${endDay}`,
        startDate: weekStart,
        endDate: weekEnd
      });
    }
    
    return options;
  };
  
  const weekOptions = generateWeekOptions();
  
  // Calculate days left for any week
  const calculateDaysLeftForWeek = (weekId: number) => {
    const weekData = weekOptions[weekId];
    const today = new Date();
    
    // If it's a future week, return 7 days
    if (today < weekData.startDate) {
      return 7;
    }
    
    // If it's a past week, return 1 day (never show 0 days)
    if (today > weekData.endDate) {
      return 1;
    }
    
    // For current week, count days from today to end of week (inclusive)
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(weekData.endDate.getFullYear(), weekData.endDate.getMonth(), weekData.endDate.getDate());
    
    // Simple calculation: days between today and end of week + 1 (to include today)
    const daysLeft = Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return Math.max(1, daysLeft); // Never return 0, minimum is 1 day
  };

  // Calculate days left for selected week
  const calculateDaysLeft = () => {
    return calculateDaysLeftForWeek(selectedWeek);
  };

  // Format days text (singular vs plural)
  const formatDaysText = (days: number) => {
    return days === 1 ? 'day left' : 'days left';
  };
  
  // Session counter functions
  const decrementSession = () => {
    setSessionCount(prev => Math.max(1, prev - 1));
  };
  
  const incrementSession = () => {
    setSessionCount(prev => Math.min(20, prev + 1)); // Cap at 20 sessions
  };

  // Fetch current week progress
  const fetchProgress = async () => {
    if (!user?.id) return;
    if (!authReady || !session?.access_token) {
      console.warn('⚠️ Progress fetch skipped - session not ready');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    console.log('📊 Fetching progress for:', { userId: user.id, activity: selectedActivity });
    
    const progressData = await weeklyProgressService.getCurrentWeekProgress(
      user.id,
      selectedActivity,
      accessToken
    );
    
    console.log('📈 Progress data received:', progressData);
    console.log('📈 Current hasTarget before update:', hasTarget);
    
    if (progressData && progressData.target_sessions > 0) {
      setCurrent(progressData.completed_sessions);
      setTotal(progressData.target_sessions);
      setDaysRemaining(progressData.days_left);
      setHasTarget(true);
      
      // Check if target is complete
      const isComplete = progressData.completed_sessions >= progressData.target_sessions;
      setIsTargetComplete(isComplete);
      
      console.log('✅ Updated state:', {
        current: progressData.completed_sessions,
        total: progressData.target_sessions,
        daysLeft: progressData.days_left,
        isComplete: isComplete,
        hasTarget: true
      });
    } else {
      // Check if there's a future week target
      console.log('🗑️ No current week target found, checking for future week targets...');
      await checkForFutureWeekTarget();
    }
    
    console.log('📈 Final hasTarget state after fetchProgress:', hasTarget);
    setIsLoading(false);
  };

  // Check for future week targets
  const checkForFutureWeekTarget = async () => {
    if (!user?.id) return;
    
    try {
      // Get all targets for this activity
      const allTargets = await weeklyTargetService.getAllTargetsForActivity(
        user.id,
        selectedActivity,
        accessToken
      );
      
      if (allTargets && allTargets.length > 0) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Find the next future target
        const futureTarget = allTargets.find(target => {
          const targetStart = new Date(target.week_start_date);
          return targetStart > today;
        });
        
        if (futureTarget) {
          const targetStart = new Date(futureTarget.week_start_date);
          const targetEnd = new Date(futureTarget.week_end_date);
          
          // Calculate days until target
          const timeDiff = targetStart.getTime() - today.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          const weeksDiff = Math.ceil(daysDiff / 7);
          
          setFutureWeekStart(targetStart);
          setFutureWeekEnd(targetEnd);
          setDaysUntilTarget(daysDiff);
          setWeeksUntilTarget(weeksDiff);
          setTotal(futureTarget.target_sessions);
          setCurrent(0);
          setIsFutureWeek(true);
          setHasTarget(true);
          
          console.log('🔮 Future week target found:', {
            start: targetStart.toISOString().split('T')[0],
            end: targetEnd.toISOString().split('T')[0],
            daysUntil: daysDiff,
            weeksUntil: weeksDiff,
            targetSessions: futureTarget.target_sessions
          });
        } else {
          // No future target found
          setCurrent(0);
          setTotal(0);
          setDaysRemaining(0);
          setHasTarget(false);
          setIsFutureWeek(false);
          console.log('🗑️ No future week target found');
        }
      } else {
        setCurrent(0);
        setTotal(0);
        setDaysRemaining(0);
        setHasTarget(false);
        setIsFutureWeek(false);
        console.log('🗑️ No targets found for activity');
      }
    } catch (error) {
      console.error('❌ Error checking for future week target:', error);
      setCurrent(0);
      setTotal(0);
      setDaysRemaining(0);
      setHasTarget(false);
      setIsFutureWeek(false);
    }
  };

  // Load progress on mount and when activity changes
  useEffect(() => {
    checkWeekBoundary();
    fetchProgress();
  }, [user?.id, selectedActivity, session?.access_token, authReady]);

  // Handle manual session increment (+1 button)
  const handleIncrementSession = async () => {
    if (!user?.id || isProcessing) return;
    if (!authReady || !session?.access_token) {
      Alert.alert('Finishing sign-in', 'Your session is still loading. Please wait a moment and try again.');
      return;
    }
    
    // Validation
    if (!selectedActivity || selectedActivity.trim() === '') {
      console.error('❌ Activity type is required');
      return;
    }
    
    setIsProcessing(true);
    setCounterText('+1');
    
    try {
      const session = await weeklySessionLogService.logSession(
        user.id,
        selectedActivity,
        undefined,
        undefined,
        undefined,
        accessToken
      );
      
      if (session) {
        // Check for target completion
        const newProgress = current + 1;
        if (newProgress >= total && total > 0) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 3000);
          
          // Store completed target sessions for modal
          setCompletedTargetSessions(total);
          
          // Mark target as complete in database
          try {
            // Get the current target to find its ID
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const dayOfWeek = today.getDay();
            const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() + daysToMonday);
            
            const currentTarget = await weeklyTargetService.getWeeklyTarget(
              user.id,
              selectedActivity,
              weekStart,
              accessToken
            );
            
            if (currentTarget && currentTarget.target_id) {
              await weeklyTargetService.markTargetComplete(
                currentTarget.target_id,
                accessToken
              );
              console.log('🎉 Target marked as complete!');
              
              // Show completion modal after a short delay
              setTimeout(() => {
                console.log('🎉 Showing completion modal for:', selectedActivity, 'sessions:', completedTargetSessions);
                setShowCompletionModal(true);
              }, 2000);
            }
          } catch (error) {
            console.error('❌ Error marking target as complete:', error);
          }
        }
        
        // Refresh progress
        await fetchProgress();
        onDataUpdate?.();
      } else {
        console.error('❌ Failed to log session');
      }
    } catch (error) {
      console.error('❌ Error logging session:', error);
    }
    
    // Reset to "1" after operation completes
    setTimeout(() => {
      setCounterText('1');
      setIsProcessing(false);
    }, 500);
  };

  // Handle manual session decrement
  const handleDecrementSession = async () => {
    if (!user?.id || isProcessing || current === 0) return; // Can't decrement if no sessions
    
    setIsProcessing(true);
    setCounterText('-1');
    
    // Get the most recent session for this week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const sessions = await weeklySessionLogService.getSessionsForWeek(
      user.id,
      weekStart,
      weekEnd,
      selectedActivity,
      accessToken
    );
    
    // Delete the most recent session
    if (sessions.length > 0) {
      const mostRecentSession = sessions[0]; // Already sorted by date descending
      await weeklySessionLogService.deleteSession(mostRecentSession.session_id, accessToken);
      
      // Refresh progress
      await fetchProgress();
      onDataUpdate?.();
    }
    
    // Reset to "1" after operation completes
    setTimeout(() => {
      setCounterText('1');
      setIsProcessing(false);
    }, 500);
  };

  // Handle save target
  const handleSaveTarget = async () => {
    if (isSavingTarget) return;
    setIsSavingTarget(true);

    try {
      if (!user?.id) {
        console.error('❌ No user ID available');
        Alert.alert('Not signed in', 'Please sign in and try again.');
        return;
      }

      if (!authReady || !session?.access_token) {
        console.warn('⚠️ Session not ready when saving target');
        Alert.alert('Finishing sign-in', 'Your session is still loading. Please wait a moment and try again.');
        return;
      }
      
      // Validation
      if (sessionCount < 1) {
        console.error('❌ Session count must be at least 1');
        Alert.alert('Invalid target', 'Session count must be at least 1.');
        return;
      }
      
      if (sessionCount > 20) {
        console.error('❌ Session count cannot exceed 20');
        Alert.alert('Invalid target', 'Session count cannot exceed 20.');
        return;
      }
      
      if (!selectedActivity || selectedActivity.trim() === '') {
        console.error('❌ Activity type is required');
        Alert.alert('Missing activity', 'Please choose an activity type.');
        return;
      }
      
      const selectedWeekData = weekOptions[selectedWeek];
      
      // Check if a target already exists for this specific week and activity type
      console.log('🔍 Checking for existing target:', {
        userId: user.id,
        activity: selectedActivity,
        weekStart: selectedWeekData.startDate,
        weekLabel: selectedWeekData.label
      });
      
      // Add a small delay to ensure any previous deletion operations have completed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const existingTarget = await weeklyTargetService.getWeeklyTarget(
        user.id,
        selectedActivity,
        selectedWeekData.startDate,
        accessToken
      );
      
      console.log('🔍 Existing target found:', existingTarget);
      
      if (existingTarget && existingTarget.target_sessions > 0) {
        console.log('⚠️ Target already exists for this week:', existingTarget);
        // Show error message to user
        Alert.alert(
          'Target Already Exists',
          `You already have a target set for ${selectedActivity} in ${selectedWeekData.label}. Please delete the existing target before setting a new one.`,
          [{ text: 'OK' }]
        );
        return;
      } else {
        console.log('✅ No existing target found for this week, proceeding with save');
      }
      console.log('💾 Saving target:', {
        userId: user.id,
        activity: selectedActivity,
        weekStart: selectedWeekData.startDate,
        weekEnd: selectedWeekData.endDate,
        targetSessions: sessionCount
      });
      
      const result = await weeklyTargetService.setWeeklyTarget(
        user.id,
        selectedActivity,
        selectedWeekData.startDate,
        selectedWeekData.endDate,
        sessionCount,
        accessToken
      );
      
      if (result) {
        console.log('✅ Target saved successfully:', result);
        
        // Track weekly training target creation
        analytics.progressTargetSet({ 
          activity_type: selectedActivity,
          target_sessions: sessionCount
        });
        
        // Update the activity type in the component state
        setSelectedActivity(selectedActivity);
        // Close modal with tracking (saved = true)
        setModalSaved(true);
        closeModalWithTracking(true, sessionCount);
        setShowEditModal(false);
        // Refresh progress in background
        await fetchProgress();
        onDataUpdate?.();
      } else {
        console.error('❌ Failed to save target - no result returned');
        Alert.alert('Save failed', 'We could not save your target. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error saving target:', error);
      Alert.alert('Save failed', 'We could not save your target. Please try again.');
    } finally {
      setIsSavingTarget(false);
    }
  };

  // Handle clear target
  const handleClearTarget = async () => {
    if (isSavingTarget) return;
    setIsSavingTarget(true);

    try {
      if (!user?.id) {
        Alert.alert('Not signed in', 'Please sign in and try again.');
        return;
      }

      if (!authReady || !session?.access_token) {
        Alert.alert('Finishing sign-in', 'Your session is still loading. Please wait a moment and try again.');
        return;
      }
    
      const selectedWeekData = weekOptions[selectedWeek];
      // Set target to 0 (or you could delete it)
      const result = await weeklyTargetService.setWeeklyTarget(
        user.id,
        selectedActivity,
        selectedWeekData.startDate,
        selectedWeekData.endDate,
        0,
        accessToken
      );
      
      if (result) {
        await fetchProgress();
        setModalSaved(true);
        closeModalWithTracking(true, 0); // Clearing target
        onDataUpdate?.();
      } else {
        Alert.alert('Save failed', 'We could not clear your target. Please try again.');
      }
    } finally {
      setIsSavingTarget(false);
    }
  };

  // Helper function to close modal with tracking
  const closeModalWithTracking = (saved: boolean, targetSessions?: number) => {
    if (modalOpenTime) {
      const timeOpenSeconds = Math.floor((Date.now() - modalOpenTime) / 1000);
      
      if (saved) {
        analytics.progressTargetModalClose({
          saved: true,
          activity_type: selectedActivity,
          target_sessions: targetSessions || sessionCount,
        });
      } else {
        // Track abandonment if modal was open for more than 2 seconds
        if (timeOpenSeconds > 2) {
          analytics.progressTargetModalAbandon({
            activity_type: selectedActivity,
            time_open_seconds: timeOpenSeconds,
          });
        }
        analytics.progressTargetModalClose({
          saved: false,
          activity_type: selectedActivity,
        });
      }
    }
    
    setShowModal(false);
    setModalOpenTime(null);
    setModalSaved(false);
    setModalSource('unknown');
  };

  // Handle edit target button press
  const handleEditTarget = () => {
    if (current > 0) {
      setShowWarningDialog(true);
    } else {
      setModalSource('edit');
      setModalSaved(false);
      setModalOpenTime(Date.now());
      analytics.progressTargetModalOpen({ 
        activity_type: selectedActivity, 
        source: 'edit' 
      });
      setShowEditModal(true);
    }
  };

  // Handle three dots menu toggle
  const handleThreeDotsPress = (event: any) => {
    if (!showEditDropdown) {
      // Calculate position relative to screen - ensure it stays within screen bounds
      const buttonX = width * 0.18 - width * 0.17; // Approximate button position
      const buttonY = height * 0.12; // Card height
      
      // Calculate dropdown position with screen bounds checking
      const dropdownWidth = width * 0.25; // minWidth from styles
      const dropdownX = Math.max(10, Math.min(buttonX - width * 0.05, width - dropdownWidth - 10));
      const dropdownY = buttonY + height * 0.08; // Lowered the dropdown (was height * 0.05)
      
      setDropdownPosition({
        x: dropdownX,
        y: dropdownY
      });
    }
    setShowEditDropdown(!showEditDropdown);
  };

  // Handle edit option from dropdown
  const handleEditFromDropdown = () => {
    setShowEditDropdown(false);
    handleEditTarget();
  };

  // Handle delete option from dropdown
  const handleDeleteFromDropdown = () => {
    setShowEditDropdown(false);
    handleDeleteTarget();
  };

  // Handle warning dialog responses
  const handleKeepProgress = () => {
    setShowWarningDialog(false);
    setShowEditModal(true);
  };

  const handleResetProgress = async () => {
    setShowWarningDialog(false);
    // Reset current progress to 0
    setCurrent(0);
    setShowEditModal(true);
  };

  const handleCancelEdit = () => {
    setShowWarningDialog(false);
    setShowEditModal(false);
  };

  // Handle delete target
  const handleDeleteTarget = async () => {
    if (!user?.id) return;
    
    try {
      let targetToDelete = null;
      
      if (isFutureWeek && futureWeekStart) {
        // For future week targets, use the future week start date
        console.log('🔍 Looking for future week target with week start:', futureWeekStart.toISOString().split('T')[0]);
        targetToDelete = await weeklyTargetService.getWeeklyTarget(
          user.id,
          selectedActivity,
          futureWeekStart,
          accessToken
        );
      } else {
        // For current week targets, use current week calculation
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() + daysToMonday);
        
        console.log('🔍 Looking for current week target with week start:', weekStart.toISOString().split('T')[0]);
        targetToDelete = await weeklyTargetService.getWeeklyTarget(
          user.id,
          selectedActivity,
          weekStart,
          accessToken
        );
      }
      
      if (targetToDelete && targetToDelete.target_id) {
        console.log('🎯 Found target to delete:', targetToDelete);
        // Delete the target from database
        const deleted = await weeklyTargetService.deleteWeeklyTarget(
          targetToDelete.target_id,
          accessToken
        );
        
        if (deleted) {
          console.log('✅ Target deleted successfully');
          
          // Only delete session logs for current week targets (not future week targets)
          if (!isFutureWeek) {
            try {
              // Calculate proper week boundaries (Monday to Sunday)
              const now = new Date();
              const currentWeekStart = new Date(now);
              const dayOfWeek = currentWeekStart.getDay();
              const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
              currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);
              currentWeekStart.setHours(0, 0, 0, 0);
              
              const currentWeekEnd = new Date(currentWeekStart);
              currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
              currentWeekEnd.setHours(23, 59, 59, 999);
              
              console.log('🗑️ Deleting sessions for week:', {
                start: currentWeekStart.toISOString(),
                end: currentWeekEnd.toISOString(),
                activity: selectedActivity
              });
              
              const sessions = await weeklySessionLogService.getSessionsForWeek(
                user.id,
                currentWeekStart,
                currentWeekEnd,
                selectedActivity,
                accessToken
              );
              
              console.log('📊 Found sessions to delete:', sessions.length);
              
              // Delete each session log
              for (const session of sessions) {
                if (session.session_id) {
                  const deleted = await weeklySessionLogService.deleteSession(
                    session.session_id,
                    accessToken
                  );
                  console.log('🗑️ Deleted session:', session.session_id, deleted);
                }
              }
              
              console.log('✅ Session logs deleted successfully');
            } catch (sessionError) {
              console.error('⚠️ Error deleting session logs:', sessionError);
              // Continue anyway - target is deleted
            }
          } else {
            console.log('🔮 Future week target deleted - no sessions to delete');
          }
          
          // Reset all progress data immediately
          setCurrent(0);
          setTotal(0);
          setDaysRemaining(0);
          setHasTarget(false);
          setIsFutureWeek(false);
          setFutureWeekStart(null);
          setFutureWeekEnd(null);
          setDaysUntilTarget(0);
          setWeeksUntilTarget(0);
          console.log('🔄 Reset local state - hasTarget set to false');
          
          // Close modal
          setShowEditModal(false);
          
          // Wait a moment for database operations to complete, then refresh
          setTimeout(async () => {
            console.log('🔄 Refreshing data after deletion...');
            await fetchProgress();
            console.log('🔄 After fetchProgress - hasTarget:', hasTarget);
            onDataUpdate?.();
          }, 500); // Small delay to ensure database operations complete
        } else {
          console.error('❌ Failed to delete target from database');
        }
      } else {
        // No target found, just reset local state
        console.log('🗑️ No target found, resetting local state');
        setCurrent(0);
        setTotal(0);
        setDaysRemaining(0);
        setHasTarget(false);
        setShowEditModal(false);
        
        // Wait a moment then refresh
        setTimeout(async () => {
          await fetchProgress();
          onDataUpdate?.();
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error deleting target:', error);
    }
  };

  // Handle completion modal actions
  const handleKeepSameTarget = () => {
    setSelectedCompletionAction('keep');
    setShowCompletionModal(false);
    setShowWeekChoiceModal(true);
  };

  const handleIncreaseChallenge = () => {
    setSelectedCompletionAction('increase');
    setShowCompletionModal(false);
    setShowWeekChoiceModal(true);
  };

  const handleSetCustomTarget = () => {
    console.log('🎯 User selected: Set custom target');
    setShowCompletionModal(false);
    setModalSource('completion');
    setModalSaved(false);
    setModalOpenTime(Date.now());
    analytics.progressTargetModalOpen({ 
      activity_type: selectedActivity, 
      source: 'completion' 
    });
    setShowModal(true);
  };

  const handleMaybeLater = () => {
    console.log('🎯 User selected: Maybe later');
    setShowCompletionModal(false);
  };

  // Handle week choice for completion actions
  const handleWeekChoice = async (weekChoice: 'this' | 'next') => {
    setShowWeekChoiceModal(false);
    
    try {
      let targetWeek;
      let targetSessions;
      
      if (weekChoice === 'this') {
        // Use current week
        targetWeek = weekOptions[selectedWeek];
        console.log('🎯 Setting target for current week:', targetWeek.label);
      } else {
        // Use next week
        const nextWeekIndex = selectedWeek + 1;
        targetWeek = weekOptions[nextWeekIndex];
        if (!targetWeek) {
          console.error('❌ No next week available');
          return;
        }
        console.log('🎯 Setting target for next week:', targetWeek.label);
      }
      
      // Determine target sessions based on selected action
      if (selectedCompletionAction === 'keep') {
        targetSessions = completedTargetSessions;
      } else if (selectedCompletionAction === 'increase') {
        targetSessions = completedTargetSessions + 1;
      } else {
        console.error('❌ Invalid completion action');
        return;
      }
      
      // If setting target for current week, we need to archive the old target
      if (weekChoice === 'this') {
        console.log('📦 Archiving completed target for current week before setting new one');
        try {
          // Get the current target to archive it
          const currentTarget = await weeklyTargetService.getWeeklyTarget(
            user?.id!,
            selectedActivity,
            targetWeek.startDate,
            accessToken
          );
          
          if (currentTarget && currentTarget.target_id) {
            // Mark the old target as complete and create history record
            await weeklyTargetService.markTargetComplete(
              currentTarget.target_id,
              accessToken
            );
            console.log('✅ Old target archived with completion history');
          }
        } catch (error) {
          console.error('❌ Error archiving old target:', error);
        }
      }
      
      await weeklyTargetService.setWeeklyTarget(
        user?.id!,
        selectedActivity,
        targetWeek.startDate,
        targetWeek.endDate,
        targetSessions,
        accessToken
      );
      
      // Reset progress to 0 for the new target
      setCurrent(0);
      setTotal(targetSessions);
      setDaysRemaining(7);
      setHasTarget(true);
      setIsTargetComplete(false);
      
      await fetchProgress();
      onDataUpdate?.();
      
      console.log('✅ Successfully set target for', weekChoice, 'week');
    } catch (error) {
      console.error('❌ Error setting target:', error);
    }
  };

  // Check for week boundary and handle reset
  const checkWeekBoundary = () => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    const dayOfWeek = currentWeekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
    
    if (lastWeekChecked && lastWeekChecked !== currentWeekKey) {
      console.log('🔄 New week detected, resetting progress...');
      // Reset progress for new week
      setCurrent(0);
      setTotal(0);
      setDaysRemaining(7);
      setHasTarget(false);
      // Refresh data for new week
      fetchProgress();
    }
    
    setLastWeekChecked(currentWeekKey);
  };
  
  const styles = StyleSheet.create({
    container: {
      width: '100%',
      height: height * 0.12,
      marginBottom: height * 0.012,
      position: 'relative',
      overflow: 'visible',
      zIndex: 1,
    },
    mainCard: {
      flex: 1,
      borderRadius: width * 0.05,
      borderWidth: width * 0.01,
      borderColor: '#D1A3F0',
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: width * 0.01 },
      shadowOpacity: 1,
      shadowRadius: width * 0.075,
      elevation: 8,
      overflow: 'hidden',
      backgroundColor: 'transparent', // Ensures gradient renders properly without background interference
    },
    // Days Left Pill
    daysLeftPill: {
      position: 'absolute',
      top: -height * 0.012, // Reduced half outside the card
      left: '50%',
      marginLeft: -width * 0.12, // Half of pill width
      width: width * 0.24,
      height: height * 0.028,
      backgroundColor: '#4D4159',
      borderWidth: width * 0.004,
      borderColor: '#D1A3F0',
      borderRadius: width * 0.028,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.004,
      gap: width * 0.012,
      zIndex: 10,
    },
    daysLeftText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.028,
      lineHeight: height * 0.016,
      color: '#FFFFFF',
      marginTop: -height * 0.001,
    },
    // Main content area
    mainContent: {
      position: 'absolute',
      left: width * 0.02, // Reduced from 0.06 to 0.02
      top: height * 0.02, // Moved upwards
      width: '65%',
      height: '80%',
    },
    title: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.034,
      lineHeight: height * 0.018,
      color: '#FFFFFF',
      marginBottom: height * 0.001,
      marginLeft: -width * 0.08, // Move title closer to edit button
    },
    progressText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.044,
      lineHeight: height * 0.024,
      color: '#FFFFFF',
      marginBottom: height * 0.008,
    },
    progressBar: {
      width: '100%',
      height: height * 0.009,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: width * 0.12,
      marginBottom: height * 0.008,
    },
    progressFill: {
      height: height * 0.009,
      backgroundColor: '#FFFFFF',
      borderRadius: width * 0.12,
      width: `${progress * 100}%`,
    },
    subtitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.024,
      lineHeight: height * 0.016,
      color: '#FFFFFF',
      marginTop: height * 0.002,
    },
    // Control bar
    controlBar: {
      position: 'absolute',
      right: width * 0.028,
      top: height * 0.01, // Moved further upwards
      width: width * 0.09,
      height: height * 0.096,
      backgroundColor: '#625971',
      borderRadius: width * 0.12,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: height * 0.002,
    },
    controlButton: {
      width: width * 0.064,
      height: width * 0.064,
      borderRadius: width * 0.12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upButton: {
      backgroundColor: '#4A4159',
    },
    downButton: {
      backgroundColor: '#42405A',
    },
    plusOneText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.028,
      lineHeight: height * 0.02,
      color: '#FFFFFF',
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: '#171717',
    },
    modalHeader: {
      width: '100%',
      height: height * 0.15,
      backgroundColor: '#212121',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.07,
    },
    headerButton: {
      width: width * 0.11,
      height: width * 0.11,
      backgroundColor: '#343434',
      borderRadius: width * 0.055,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.034,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    modalCard: {
      position: 'absolute',
      width: '90%',
      height: height * 0.6,
      left: '5%',
      top: height * 0.18,
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: width * 0.01 },
      shadowOpacity: 1,
      shadowRadius: width * 0.075,
      elevation: 8,
      padding: width * 0.05,
      overflow: 'visible', // Allow dropdowns to extend beyond card bounds
      zIndex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.02,
    },
    sectionTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
    },
    closeButton: {
      width: width * 0.09,
      height: width * 0.09,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownContainer: {
      position: 'relative',
      marginBottom: height * 0.02,
      zIndex: 20000, // Higher than week dropdown to appear on top
    },
    dropdown: {
      width: width * 0.4,
      height: height * 0.05,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
    },
    dropdownText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: '#FFFFFF',
    },
    dropdownMenu: {
      position: 'absolute',
      top: height * 0.055,
      left: 0,
      width: width * 0.4,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: width * 0.005 },
      shadowOpacity: 0.25,
      shadowRadius: width * 0.02,
      elevation: 25, // Higher elevation for Android than week dropdown
      zIndex: 20001, // Higher than week dropdown menu to appear on top
    },
    dropdownItem: {
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedDropdownItem: {
      backgroundColor: 'rgba(108, 92, 231, 0.3)',
    },
    dropdownItemText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.025,
      color: '#FFFFFF',
    },
    selectedDropdownItemText: {
      fontWeight: '700',
      color: '#FFFFFF',
    },
    dateRange: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: '#CDCDCD',
      marginBottom: height * 0.02,
    },
    targetTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: height * 0.02,
    },
    sessionCounter: {
      width: '100%',
      height: height * 0.08,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.02,
    },
    counterButton: {
      width: width * 0.12,
      height: width * 0.12,
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.075,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
    },
    statusText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: '#CDCDCD',
      textAlign: 'center',
      marginBottom: height * 0.02,
    },
    saveButton: {
      width: '100%',
      height: height * 0.065,
      backgroundColor: '#6C5CE7',
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.02,
      shadowColor: 'rgba(108, 92, 231, 0.25)',
      shadowOffset: { width: 0, height: width * 0.01 },
      shadowOpacity: 1,
      shadowRadius: width * 0.035,
      elevation: 8,
    },
    saveButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: '#FFFFFF',
    },
    clearButton: {
      width: '100%',
      height: height * 0.065,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#FF7675',
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: '#FF7675',
    },
    // Week dropdown styles
    weekDropdownContainer: {
      position: 'relative',
      marginBottom: height * 0.02,
      zIndex: 10000, // Ensure dropdown appears above all other content
    },
    weekDropdown: {
      width: '100%',
      height: height * 0.05,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
    },
    weekDropdownText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: '#FFFFFF',
    },
    weekDropdownMenu: {
      position: 'absolute',
      top: height * 0.055,
      left: 0,
      width: '100%',
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: width * 0.005 },
      shadowOpacity: 0.25,
      shadowRadius: width * 0.02,
      elevation: 20, // Higher elevation for Android
      zIndex: 10001, // Higher than container to ensure it's on top
    },
    weekDropdownItem: {
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedWeekDropdownItem: {
      backgroundColor: 'rgba(108, 92, 231, 0.3)',
    },
    weekDropdownItemText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.025,
      color: '#FFFFFF',
    },
    selectedWeekDropdownItemText: {
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // Splash screen styles
    splashContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: width * 0.05,
    },
    splashTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.038, // Reduced from 0.045
      lineHeight: height * 0.028, // Reduced from 0.032
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: height * 0.003, // Reduced from 0.005
    },
    splashSubtitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '400',
      fontSize: width * 0.03, // Reduced from 0.035
      lineHeight: height * 0.022, // Reduced from 0.024
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
      marginBottom: height * 0.008, // Reduced from 0.015
    },
    setTargetButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: width * 0.035, // Reduced from 0.04
      paddingHorizontal: width * 0.05, // Reduced from 0.06
      paddingVertical: height * 0.01, // Reduced from 0.012
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    setTargetButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.035, // Reduced from 0.04
      lineHeight: height * 0.025, // Reduced from 0.028
      color: '#6C5CE7',
    },
    // Title row styles
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      paddingLeft: width * 0.18, // Keep original padding
      gap: width * 0.15, // Increase gap to move title more to the right
    },
    editButton: {
      padding: width * 0.008, // Smaller padding
      borderRadius: width * 0.015, // More circular
      marginTop: -height * 0.01, // Move button upwards
      marginLeft: -width * 0.17, // Move button more to the right
    },
    editButtonContainer: {
      position: 'relative',
      zIndex: 1000,
    },
    dropdownOverlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    editDropdownMenu: {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderRadius: width * 0.02,
      paddingVertical: width * 0.01,
      paddingHorizontal: width * 0.02,
      minWidth: width * 0.25,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 10,
    },
    editDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: width * 0.015,
      paddingHorizontal: width * 0.02,
      gap: width * 0.02,
    },
    editDropdownItemText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      color: '#FFFFFF',
    },
    // Warning dialog styles
    warningOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: width * 0.05,
    },
    warningDialog: {
      backgroundColor: '#2C2C2C',
      borderRadius: width * 0.04,
      padding: width * 0.05,
      width: '100%',
      maxWidth: width * 0.8,
    },
    warningTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.045,
      lineHeight: height * 0.032,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: height * 0.02,
    },
    warningMessage: {
      fontFamily: 'Articulat CF',
      fontWeight: '400',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
      marginBottom: height * 0.03,
    },
    warningButtons: {
      gap: height * 0.01,
    },
    warningButton: {
      backgroundColor: '#6C5CE7',
      borderRadius: width * 0.04,
      paddingVertical: height * 0.015,
      alignItems: 'center',
    },
    resetButton: {
      backgroundColor: '#FF7675',
    },
    warningButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: '#FFFFFF',
    },
    resetButtonText: {
      color: '#FFFFFF',
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderRadius: width * 0.04,
      paddingVertical: height * 0.015,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    cancelButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: 'rgba(255, 255, 255, 0.8)',
    },
    // Motivational message styles
    motivationalMessage: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.025, // Reduced from 0.032
      lineHeight: height * 0.018, // Reduced from 0.022
      color: 'rgba(255, 255, 255, 0.9)',
      textAlign: 'center',
      marginTop: -height * 0.015, // Increased negative margin for more overlap
      marginBottom: height * 0.005,
      paddingLeft: width * 0.088, // Move message even further to the right
    },
    // Celebration styles
    celebrationOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(108, 92, 231, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: width * 0.04,
      zIndex: 10,
    },
    celebrationText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: height * 0.01,
    },
    celebrationSubtext: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: 'rgba(255, 255, 255, 0.9)',
      textAlign: 'center',
    },
    // Missing styles for edit modal
    backButton: {
      padding: width * 0.01,
      borderRadius: width * 0.02,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      left: width * 0.02,
      top: '50%',
      transform: [{ translateY: width * 0.11 }], // Move even further down to align with text
    },
    headerSpacer: {
      width: width * 0.11, // Same width as back button to balance the layout
    },
    dropdownLabel: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: height * 0.01,
    },
    sessionContainer: {
      marginBottom: height * 0.02,
    },
    sessionLabel: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: height * 0.01,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
    },
    // Progress row styles
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.01,
      paddingLeft: width * 0.01, // Reduced left padding
      gap: width * 0.03, // Add space between counter and progress bar
    },
    // Delete button styles
    deleteButton: {
      backgroundColor: '#FF7675',
      borderRadius: width * 0.04,
      paddingVertical: height * 0.015,
      paddingHorizontal: width * 0.06,
      alignItems: 'center',
      marginTop: height * 0.01,
    },
    deleteButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: '#FFFFFF',
    },
    // Future week styles
    futureWeekContent: {
      marginTop: height * 0.01,
      paddingLeft: width * 0.02,
    },
    countdownText: {
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.032,
      lineHeight: height * 0.02,
      color: '#FFFFFF',
      marginBottom: height * 0.008,
    },
    futureTargetText: {
      fontFamily: 'Articulat CF',
      fontWeight: '400',
      fontSize: width * 0.028,
      lineHeight: height * 0.018,
      color: '#FFFFFF',
      opacity: 0.9,
    },
    // Future week pill styles (matching regular daysLeftPill styling)
    futureWeekPill: {
      position: 'absolute',
      top: -height * 0.008,
      right: width * 0.04,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: width * 0.04,
      paddingHorizontal: width * 0.03,
      paddingVertical: height * 0.005,
      zIndex: 10,
    },
    futureWeekPillText: {
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.028,
      lineHeight: height * 0.016,
      color: '#FFFFFF',
    },
    // Completion modal styles
    completionModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: width * 0.08,
    },
    completionModalContent: {
      backgroundColor: '#1F1F1F',
      borderRadius: width * 0.06,
      padding: width * 0.06,
      width: '100%',
      maxWidth: width * 0.9,
    },
    completionTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: height * 0.02,
    },
    completionMessage: {
      fontFamily: 'Articulat CF',
      fontWeight: '400',
      fontSize: width * 0.035,
      color: '#CCCCCC',
      textAlign: 'center',
      marginBottom: height * 0.03,
      lineHeight: height * 0.025,
    },
    suggestionButtons: {
      marginBottom: height * 0.03,
    },
    suggestionButton: {
      backgroundColor: '#2B2B2B',
      borderRadius: width * 0.03,
      padding: width * 0.04,
      marginBottom: height * 0.01,
      borderWidth: 1,
      borderColor: '#3A3A3A',
    },
    suggestionButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.038,
      color: '#FFFFFF',
      marginBottom: height * 0.005,
    },
    suggestionSubtext: {
      fontFamily: 'Articulat CF',
      fontWeight: '400',
      fontSize: width * 0.03,
      color: '#999999',
    },
    completionActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: width * 0.03,
    },
    completionActionButton: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: width * 0.03,
      paddingVertical: height * 0.015,
      borderWidth: 1,
      borderColor: '#3A3A3A',
      alignItems: 'center',
    },
    completionActionText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      color: '#FFFFFF',
    },
    // Week choice modal styles
    weekChoiceButtons: {
      flexDirection: 'row',
      gap: width * 0.03,
      marginBottom: height * 0.03,
    },
    weekChoiceButton: {
      flex: 1,
      backgroundColor: Colors.purple.primary,
      borderRadius: width * 0.03,
      paddingVertical: height * 0.02,
      paddingHorizontal: width * 0.04,
      alignItems: 'center',
    },
    weekChoiceButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '600',
      fontSize: width * 0.04,
      color: '#FFFFFF',
      marginBottom: height * 0.005,
    },
    weekChoiceSubtext: {
      fontFamily: 'Articulat CF',
      fontWeight: '400',
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'center',
    },
  });
  
  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        activeOpacity={1}
        onPress={() => {
          setShowEditDropdown(false);
          analytics.capture('progress_card_tapped', {
            activity_type: selectedActivity,
            has_target: hasTarget,
            is_future_week: isFutureWeek,
          });
        }}
      >
        {hasTarget ? (
          <>
            {/* Days Left Pill or Future Week Pill */}
            <View style={isFutureWeek ? styles.futureWeekPill : styles.daysLeftPill}>
              <Text style={isFutureWeek ? styles.futureWeekPillText : styles.daysLeftText}>
                {isFutureWeek ? 
                  `${futureWeekStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${futureWeekEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` :
                  `${daysRemaining || 5} Days Left`
                }
              </Text>
            </View>

            <LinearGradient
              colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
              style={styles.mainCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              {/* Main Content */}
              <View style={styles.mainContent}>
                {isFutureWeek ? (
                  // Future Week Content
                  <>
                    <View style={styles.titleRow}>
                      <View style={styles.editButtonContainer}>
                        <TouchableOpacity 
                          style={styles.editButton}
                          onPress={handleThreeDotsPress}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="ellipsis-vertical" size={width * 0.04} color="#FFFFFF" />
                        </TouchableOpacity>
                        
                      </View>
                      <Text style={styles.title}>Are you ready for your training week?</Text>
                    </View>
                    
                    <View style={styles.futureWeekContent}>
                      <Text style={styles.countdownText}>
                        {weeksUntilTarget > 1 ? `${weeksUntilTarget} weeks until target begins` :
                         daysUntilTarget > 1 ? `${daysUntilTarget} days until target begins` :
                         daysUntilTarget === 1 ? '1 day until target begins' :
                         'Target begins tomorrow'}
                      </Text>
                      
                      <Text style={styles.futureTargetText}>
                        {selectedActivity}: {total} sessions
                      </Text>
                    </View>
                  </>
                ) : (
                  // Current Week Content
                  <>
                    <View style={styles.titleRow}>
                      <View style={styles.editButtonContainer}>
                        <TouchableOpacity 
                          style={styles.editButton}
                          onPress={handleThreeDotsPress}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="ellipsis-vertical" size={width * 0.04} color="#FFFFFF" />
                        </TouchableOpacity>
                        
                      </View>
                      <Text style={styles.title}>{selectedActivity}</Text>
                    </View>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressText}>{`${current}/${total}`}</Text>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${Math.min((current / total) * 100, 100)}%` }]} />
                      </View>
                    </View>
                    
                    <Text style={styles.motivationalMessage}>{getMotivationalMessage()}</Text>
                  </>
                )}
              </View>

              {/* Control Bar - Only show for current week */}
              {!isFutureWeek && (
                <View style={styles.controlBar}>
                <TouchableOpacity 
                  style={[styles.controlButton, styles.upButton]}
                  onPress={handleIncrementSession}
                  disabled={isProcessing}
                >
                  <Ionicons name="chevron-up" size={width * 0.036} color="#FFFFFF" />
                </TouchableOpacity>
                
                <Text style={styles.plusOneText}>{counterText}</Text>
                
                <TouchableOpacity 
                  style={[styles.controlButton, styles.downButton]}
                  onPress={handleDecrementSession}
                  disabled={isProcessing}
                >
                  <Ionicons name="chevron-down" size={width * 0.036} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              )}
            </LinearGradient>
          </>
        ) : (
          /* Splash Screen */
          <LinearGradient
            colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
            style={styles.mainCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={styles.splashContent}>
              <Text style={styles.splashTitle}>Set Your Weekly Training Target</Text>
              <Text style={styles.splashSubtitle}>Track your progress and stay motivated</Text>
              <TouchableOpacity 
                style={styles.setTargetButton}
                onPress={() => {
                  setSelectedActivity(activityType); // Reset to default activity type
                  setModalSource('splash');
                  setModalSaved(false);
                  setModalOpenTime(Date.now());
                  analytics.progressTargetModalOpen({ 
                    activity_type: activityType, 
                    source: 'splash' 
                  });
                  setShowModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.setTargetButtonText}>Set Target</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}
        
        {/* Celebration Overlay */}
        {showCelebration && (
          <View style={styles.celebrationOverlay}>
            <Text style={styles.celebrationText}>🎉 Target Completed! 🎉</Text>
            <Text style={styles.celebrationSubtext}>Amazing work!</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Set Weekly Target Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => closeModalWithTracking(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => {
            setShowDropdown(false);
            setShowWeekDropdown(false);
          }}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={[styles.headerButton, { position: 'absolute', left: width * 0.04, top: height * 0.085 }]}
              onPress={() => closeModalWithTracking(false)}
            >
              <Ionicons name="arrow-back" size={width * 0.048} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Performance Tracker</Text>
          </View>

          {/* Modal Content */}
          <TouchableOpacity 
            style={styles.modalCard}
            activeOpacity={1}
            onPress={() => {
              setShowDropdown(false);
              setShowWeekDropdown(false);
            }} // Prevent dropdowns from closing when clicking card
          >
            {/* Set Weekly Target Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Set Weekly Target</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => closeModalWithTracking(false)}
              >
                <Ionicons name="close" size={width * 0.04} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Activity Type Dropdown */}
            <View style={styles.dropdownContainer}>
              <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => {
                  setShowWeekDropdown(false); // Close week dropdown when opening activity dropdown
                  setShowDropdown(!showDropdown);
                }}
              >
                <Text style={styles.dropdownText}>{selectedActivity}</Text>
                <Ionicons 
                  name={showDropdown ? "chevron-up" : "chevron-down"} 
                  size={width * 0.036} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              
              {showDropdown && (
                <View style={styles.dropdownMenu}>
                  {activityOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.dropdownItem,
                        selectedActivity === option && styles.selectedDropdownItem
                      ]}
                      onPress={() => {
                        setSelectedActivity(option);
                        setShowDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        selectedActivity === option && styles.selectedDropdownItemText
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Week Selection Dropdown */}
            <View style={styles.weekDropdownContainer}>
              <TouchableOpacity 
                style={styles.weekDropdown}
                onPress={() => {
                  setShowDropdown(false); // Close activity dropdown when opening week dropdown
                  setShowWeekDropdown(!showWeekDropdown);
                }}
              >
                <Text style={styles.weekDropdownText}>
                  {weekOptions[selectedWeek].label} - {calculateDaysLeft()} {formatDaysText(calculateDaysLeft())}
                </Text>
                <Ionicons 
                  name={showWeekDropdown ? "chevron-up" : "chevron-down"} 
                  size={width * 0.036} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              
              {showWeekDropdown && (
                <View style={styles.weekDropdownMenu}>
                  {weekOptions.map((week) => (
                    <TouchableOpacity
                      key={week.id}
                      style={[
                        styles.weekDropdownItem,
                        selectedWeek === week.id && styles.selectedWeekDropdownItem
                      ]}
                      onPress={() => {
                        setSelectedWeek(week.id);
                        setShowWeekDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.weekDropdownItemText,
                        selectedWeek === week.id && styles.selectedWeekDropdownItemText
                      ]}>
                        {week.label} - {calculateDaysLeftForWeek(week.id)} {formatDaysText(calculateDaysLeftForWeek(week.id))}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Target For This Week */}
            <Text style={styles.targetTitle}>Target For This Week</Text>

            {/* Session Counter */}
            <View style={styles.sessionCounter}>
              <TouchableOpacity 
                style={styles.counterButton}
                onPress={decrementSession}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={width * 0.04} color="#FFFFFF" />
              </TouchableOpacity>
              
              <Text style={styles.sessionText}>Sessions {sessionCount}</Text>
              
              <TouchableOpacity 
                style={styles.counterButton}
                onPress={incrementSession}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={width * 0.04} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Status Message */}
            <Text style={styles.statusText}>
              {current > 0 
                ? `${current} session${current !== 1 ? 's' : ''} logged this week.` 
                : 'No sessions logged yet.'}
            </Text>

            {/* Action Buttons */}
            <TouchableOpacity 
              style={[styles.saveButton, isSavingTarget && { opacity: 0.6 }]}
              onPress={handleSaveTarget}
              disabled={isSavingTarget}
            >
              <Text style={styles.saveButtonText}>
                {isSavingTarget ? 'Saving...' : 'Save Target'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.clearButton, isSavingTarget && { opacity: 0.6 }]}
              onPress={handleClearTarget}
              disabled={isSavingTarget}
            >
              <Text style={styles.clearButtonText}>Clear Target</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Warning Dialog */}
      <Modal
        visible={showWarningDialog}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.warningOverlay}>
          <View style={styles.warningDialog}>
            <Text style={styles.warningTitle}>Edit Target</Text>
            <Text style={styles.warningMessage}>
              You have {current} session{current !== 1 ? 's' : ''} logged this week. 
              What would you like to do?
            </Text>
            <View style={styles.warningButtons}>
              <TouchableOpacity 
                style={styles.warningButton}
                onPress={handleKeepProgress}
              >
                <Text style={styles.warningButtonText}>Keep Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.warningButton, styles.resetButton]}
                onPress={handleResetProgress}
              >
                <Text style={[styles.warningButtonText, styles.resetButtonText]}>Reset Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Target Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setShowEditModal(false)}
            >
              <Ionicons name="arrow-back" size={width * 0.048} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Edit Target</Text>
            
            <View style={styles.headerSpacer} />
          </View>

          <TouchableOpacity 
            style={styles.modalCard}
            activeOpacity={1}
            onPress={() => {
              setShowDropdown(false);
              setShowWeekDropdown(false);
            }}
          >
            {/* Activity Selection */}
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownLabel}>Activity Type</Text>
              <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => {
                  setShowWeekDropdown(false); // Close week dropdown when opening activity dropdown
                  setShowDropdown(!showDropdown);
                }}
              >
                <Text style={styles.dropdownText}>{selectedActivity}</Text>
                <Ionicons 
                  name={showDropdown ? "chevron-up" : "chevron-down"} 
                  size={width * 0.04} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              
              {showDropdown && (
                <View style={styles.dropdownMenu}>
                  {activityOptions.map((activity) => (
                    <TouchableOpacity
                      key={activity}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedActivity(activity);
                        setShowDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{activity}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Session Count */}
            <View style={styles.sessionContainer}>
              <Text style={styles.sessionLabel}>Target Sessions</Text>
              <View style={styles.sessionRow}>
                <TouchableOpacity 
                  style={styles.counterButton}
                  onPress={decrementSession}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={width * 0.04} color="#FFFFFF" />
                </TouchableOpacity>
                
                <Text style={styles.sessionText}>Sessions {sessionCount}</Text>
                
                <TouchableOpacity 
                  style={styles.counterButton}
                  onPress={incrementSession}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={width * 0.04} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity 
              style={[styles.saveButton, isSavingTarget && { opacity: 0.6 }]}
              onPress={handleSaveTarget}
              disabled={isSavingTarget}
            >
              <Text style={styles.saveButtonText}>
                {isSavingTarget ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeleteTarget}
            >
              <Text style={styles.deleteButtonText}>Delete Target</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Completion Modal */}
      <Modal
        visible={showCompletionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCompletionModal(false)}
      >
        <View style={styles.completionModalOverlay}>
          <View style={styles.completionModalContent}>
            <Text style={styles.completionTitle}>🎉 Target Completed!</Text>
            <Text style={styles.completionMessage}>
              Amazing work! You completed your {selectedActivity} target. Ready for next week?
            </Text>
            
            <View style={styles.suggestionButtons}>
              <TouchableOpacity 
                style={styles.suggestionButton}
                onPress={handleKeepSameTarget}
              >
                <Text style={styles.suggestionButtonText}>Keep the same target</Text>
                <Text style={styles.suggestionSubtext}>({completedTargetSessions} sessions)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.suggestionButton}
                onPress={handleIncreaseChallenge}
              >
                <Text style={styles.suggestionButtonText}>Increase challenge</Text>
                <Text style={styles.suggestionSubtext}>({completedTargetSessions + 1} sessions)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.suggestionButton}
                onPress={handleSetCustomTarget}
              >
                <Text style={styles.suggestionButtonText}>Set custom target</Text>
                <Text style={styles.suggestionSubtext}>(Choose your own)</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.completionActions}>
              <TouchableOpacity 
                style={styles.completionActionButton}
                onPress={handleMaybeLater}
              >
                <Text style={styles.completionActionText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Week Choice Modal */}
      <Modal
        visible={showWeekChoiceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWeekChoiceModal(false)}
      >
        <View style={styles.completionModalOverlay}>
          <View style={styles.completionModalContent}>
            <Text style={styles.completionTitle}>Choose Your Week</Text>
            <Text style={styles.completionMessage}>
              Do you want to set another target for this week or next week?
            </Text>
            
            <View style={styles.weekChoiceButtons}>
              <TouchableOpacity 
                style={styles.weekChoiceButton}
                onPress={() => handleWeekChoice('this')}
              >
                <Text style={styles.weekChoiceButtonText}>This Week</Text>
                <Text style={styles.weekChoiceSubtext}>
                  {weekOptions[selectedWeek].label}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.weekChoiceButton}
                onPress={() => handleWeekChoice('next')}
              >
                <Text style={styles.weekChoiceButtonText}>Next Week</Text>
                <Text style={styles.weekChoiceSubtext}>
                  {weekOptions[selectedWeek + 1]?.label || 'Next week'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.completionActions}>
              <TouchableOpacity 
                style={styles.completionActionButton}
                onPress={() => setShowWeekChoiceModal(false)}
              >
                <Text style={styles.completionActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Dropdown Modal */}
      <Modal
        visible={showEditDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowEditDropdown(false)}
        >
          <View style={[styles.editDropdownMenu, {
            position: 'absolute',
            top: dropdownPosition.y,
            left: dropdownPosition.x,
          }]}>
            <TouchableOpacity 
              style={styles.editDropdownItem}
              onPress={handleEditFromDropdown}
            >
              <Ionicons name="pencil" size={width * 0.035} color="#FFFFFF" />
              <Text style={styles.editDropdownItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.editDropdownItem}
              onPress={handleDeleteFromDropdown}
            >
              <Ionicons name="trash" size={width * 0.035} color="#FF6B6B" />
              <Text style={[styles.editDropdownItemText, { color: '#FF6B6B' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

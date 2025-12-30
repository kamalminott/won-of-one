import { analytics } from '@/lib/analytics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, InteractionManager, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddNewMatchButton } from '@/components/AddNewMatchButton';
import { GoalCard, GoalCardRef } from '@/components/GoalCard';
import { ProgressCard } from '@/components/ProgressCard';
import { RecentMatches } from '@/components/RecentMatches';
import { SummaryCard } from '@/components/SummaryCard';
import { UserHeader } from '@/components/UserHeader';
import { CompleteProfilePrompt } from '@/components/CompleteProfilePrompt';
import { HomeSkeleton } from '@/components/HomeSkeleton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { goalService, matchService, userService } from '@/lib/database';
import { SimpleGoal, SimpleMatch } from '@/types/database';

const FALLBACK_NAME_VALUES = new Set(['user', 'guest user', 'guest', 'unknown']);
const PROFILE_NAME_SETTLE_DELAY_MS = 800;
const PROFILE_CHECK_TIMEOUT_MS = 5000;
const USER_NAME_WAIT_TIMEOUT_MS = 3000;
const HOME_LOAD_TIMEOUT_MS = 12000;

const isPlaceholderName = (name: string, email?: string | null) => {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  if (FALLBACK_NAME_VALUES.has(normalized)) return true;
  const emailPrefix = email?.split('@')[0]?.trim().toLowerCase();
  if (emailPrefix && normalized === emailPrefix) return true;
  return false;
};

const getAuthMetadataName = (authUser?: { user_metadata?: Record<string, any> } | null) => {
  if (!authUser?.user_metadata) return '';
  const metadata = authUser.user_metadata;
  return (
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    [metadata.given_name, metadata.family_name].filter(Boolean).join(' ')
  );
};

const profileCompletedStorageKey = (userId: string) => `profile_completed:${userId}`;

export default function HomeScreen() {
  // console.log('🏠 HomeScreen rendered!');
  const { width, height } = useWindowDimensions();
  const { user, loading, userName, profileImage, isPasswordRecovery } = useAuth();
  const params = useLocalSearchParams();
  const goalCardRef = useRef<GoalCardRef>(null);
  const trimmedUserName = userName.trim();
  const authMetadataName = getAuthMetadataName(user)?.trim() || '';
  const metadataNameReady = !!authMetadataName && !isPlaceholderName(authMetadataName, user?.email);
  const effectiveUserName = trimmedUserName || (metadataNameReady ? authMetadataName : '');
  const normalizedUserName = effectiveUserName.toLowerCase();
  const isUserNameReady =
    effectiveUserName.length > 0 && !isPlaceholderName(effectiveUserName, user?.email);
  const [profileNameStatus, setProfileNameStatus] = useState<'unknown' | 'missing' | 'present'>('unknown');
  const [userNameWaitTimedOut, setUserNameWaitTimedOut] = useState(false);
  const shouldHoldForProfileCheck = !!user && !loading && profileNameStatus === 'unknown';
  const shouldHoldForUserName =
    !!user &&
    !loading &&
    profileNameStatus === 'present' &&
    !isUserNameReady &&
    !userNameWaitTimedOut;
  
  // State for real data
  const [matches, setMatches] = useState<SimpleMatch[]>([]);
  const [goals, setGoals] = useState<SimpleGoal[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [, setIsRefreshing] = useState(false);
  const [winRate, setWinRate] = useState<number>(0);
  const [trainingTime, setTrainingTime] = useState<{ value: string; label: string }>({ value: '0m', label: 'Minutes Trained' });
  const [matchCounts, setMatchCounts] = useState<{ totalMatches: number; winMatches: number } | null>(null);
  const [showCompleteProfilePrompt, setShowCompleteProfilePrompt] = useState(false);

  const fetchInFlightRef = useRef(false);
  const lastFetchAtMsRef = useRef(0);
  const lastHeavyRefreshAtMsRef = useRef(0);
  const liveDataAppliedRef = useRef(false);
  const trainingTimeRef = useRef(trainingTime);
  const userNameRef = useRef(userName);
  const profilePromptShownRef = useRef(false);
  const profilePromptSuppressedRef = useRef(false);
  const shouldShowCompleteProfilePrompt = showCompleteProfilePrompt || profileNameStatus === 'missing';
  const handleProfilePromptCompleted = useCallback(() => {
    profilePromptSuppressedRef.current = true;
    setShowCompleteProfilePrompt(false);
    setProfileNameStatus('present');
  }, []);

  const handleProfilePromptDismiss = useCallback(() => {
    if (profileNameStatus === 'missing') {
      return;
    }
    setShowCompleteProfilePrompt(false);
  }, [profileNameStatus]);

  useEffect(() => {
    trainingTimeRef.current = trainingTime;
  }, [trainingTime]);

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // Hydrate from cache ASAP so the Home screen feels instant
  useEffect(() => {
    if (!user || loading) return;

    let cancelled = false;
    const cacheKey = `home_cache_v2:${user.id}`;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (!raw || cancelled) return;

        const cached = JSON.parse(raw) as Partial<{
          version: number;
          matches: SimpleMatch[];
          goals: SimpleGoal[];
          winRate: number;
          trainingTime: { value: string; label: string };
          matchCounts: { totalMatches: number; winMatches: number } | null;
        }>;

        if (cached.version !== 2) return;
        if (liveDataAppliedRef.current) return;

        if (Array.isArray(cached.matches)) setMatches(cached.matches);
        if (Array.isArray(cached.goals)) setGoals(cached.goals);
        if (typeof cached.winRate === 'number') setWinRate(cached.winRate);
        if (cached.trainingTime?.value && cached.trainingTime?.label) setTrainingTime(cached.trainingTime);
        if (cached.matchCounts) setMatchCounts(cached.matchCounts);

        setHasLoadedOnce(true);
      } catch (error) {
        console.warn('Failed to hydrate Home cache:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  // Redirect to login if no user is logged in (but wait for auth to finish loading)
  useEffect(() => {
    // Don't redirect while auth is still loading
    if (loading) {
      return;
    }
    
    // Only redirect if we're sure there's no user (after loading completes)
    if (!user) {
      // console.log('⚠️ [HOME] No user found after auth loaded, redirecting to login');
      router.replace('/login');
    }
  }, [user, loading]);

  // If the app is in password recovery mode, force the reset screen so users cannot bypass it
  useEffect(() => {
    if (isPasswordRecovery) {
      router.replace('/reset-password');
    }
  }, [isPasswordRecovery]);

  useEffect(() => {
    profilePromptShownRef.current = false;
    profilePromptSuppressedRef.current = false;
    setProfileNameStatus('unknown');
    setShowCompleteProfilePrompt(false);
    setUserNameWaitTimedOut(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loading || isPasswordRecovery) return;

    let cancelled = false;
    const key = profileCompletedStorageKey(user.id);

    AsyncStorage.getItem(key)
      .then(flag => {
        if (cancelled) return;
        if (flag === 'true') {
          profilePromptSuppressedRef.current = true;
          setProfileNameStatus('present');
          setShowCompleteProfilePrompt(false);
        }
      })
      .catch(error => {
        console.warn('Failed to load profile completion flag:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, isPasswordRecovery]);

  useEffect(() => {
    if (!user || loading || isPasswordRecovery) return;
    if (!isUserNameReady) return;
    if (profileNameStatus === 'present') return;

    profilePromptSuppressedRef.current = true;
    setProfileNameStatus('present');
    setShowCompleteProfilePrompt(false);
  }, [user?.id, loading, isPasswordRecovery, isUserNameReady, profileNameStatus]);

  useEffect(() => {
    if (!user || loading || isPasswordRecovery || profileNameStatus !== 'unknown') {
      return;
    }
    if (profilePromptSuppressedRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      console.warn('Profile name check timed out. Allowing access and showing prompt.');
      setProfileNameStatus('missing');
      setShowCompleteProfilePrompt(true);
    }, PROFILE_CHECK_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [user?.id, loading, isPasswordRecovery, profileNameStatus]);

  useEffect(() => {
    if (!user || loading || profileNameStatus !== 'present') {
      if (userNameWaitTimedOut) {
        setUserNameWaitTimedOut(false);
      }
      return;
    }

    if (isUserNameReady) {
      if (userNameWaitTimedOut) {
        setUserNameWaitTimedOut(false);
      }
      return;
    }

    const timeoutId = setTimeout(() => {
      console.warn('User name not ready in time. Continuing with fallback.');
      setUserNameWaitTimedOut(true);
    }, USER_NAME_WAIT_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [user?.id, loading, profileNameStatus, isUserNameReady, userNameWaitTimedOut]);

  useEffect(() => {
    if (!user || loading || isPasswordRecovery) return;
    if (profilePromptShownRef.current) return;
    if (profilePromptSuppressedRef.current) return;

    let cancelled = false;
    profilePromptShownRef.current = true;

    const resolveProfileName = async () => {
      const fetchNameState = async () => {
        const existingUser = await userService.getUserById(user.id);
        const dbName = existingUser?.name?.trim() || '';
        const metadataName = getAuthMetadataName(user)?.trim() || '';
        const localName = (userNameRef.current || '').trim();
        const candidateName = dbName || localName || metadataName;
        return { existingUser, dbName, metadataName, localName, candidateName };
      };

      const decideStatus = async () => {
        try {
        const { existingUser, dbName, candidateName } = await fetchNameState();
        if (cancelled) return null;

        const isMissingName = isPlaceholderName(candidateName, user.email);

        return { isMissingName };
      } catch (error) {
          console.warn('Failed to check profile name:', error);
          return { isMissingName: true };
        }
      };

      let status = await decideStatus();
      if (!status || cancelled) return;

      if (!status.isMissingName) {
        setProfileNameStatus('present');
        setShowCompleteProfilePrompt(false);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, PROFILE_NAME_SETTLE_DELAY_MS));
      if (cancelled) return;

      status = await decideStatus();
      if (!status || cancelled) return;

      if (!status.isMissingName) {
        setProfileNameStatus('present');
        setShowCompleteProfilePrompt(false);
        return;
      }

      if (profilePromptSuppressedRef.current) {
        return;
      }

      setShowCompleteProfilePrompt(true);
      setProfileNameStatus('missing');
    };

    void resolveProfileName();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, loading, isPasswordRecovery]);

  useEffect(() => {
    if (!user || loading) return;
    if (!hasLoadedOnce) {
      fetchUserData();
    }
  }, [user?.id, loading, hasLoadedOnce, fetchUserData]);

  useEffect(() => {
    if (!user || loading || hasLoadedOnce) return;

    const timeoutId = setTimeout(() => {
      console.warn('Home data load timed out. Showing cached or empty state.');
      setHasLoadedOnce(true);
    }, HOME_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [user?.id, loading, hasLoadedOnce]);

  // PAYWALL DISABLED - Commented out subscription check
  // Check subscription status and redirect to paywall if needed
  // useEffect(() => {
  //   const checkSubscription = async () => {
  //     if (!user || loading) return;

  //     try {
  //       const subscriptionInfo = await subscriptionService.getSubscriptionInfo();
        
  //       // If user has no active subscription and no active trial, show paywall
  //       if (!subscriptionInfo.isActive && !subscriptionInfo.isTrial) {
  //         console.log('🔒 No active subscription or trial, redirecting to paywall');
  //         router.replace('/paywall');
  //       } else if (subscriptionInfo.isTrial && subscriptionInfo.expiresAt) {
  //         // Check if trial has expired
  //         const now = new Date();
  //         const expiresAt = subscriptionInfo.expiresAt;
  //         if (now >= expiresAt) {
  //           console.log('⏰ Trial expired, redirecting to paywall');
  //           router.replace('/paywall');
  //         } else {
  //           console.log('✅ Trial active, allowing access');
  //         }
  //       } else if (subscriptionInfo.isActive) {
  //         console.log('✅ Active subscription, allowing access');
  //       }
  //     } catch (error) {
  //       console.error('Error checking subscription:', error);
  //       // On error, allow access (fail open) - you can change this to fail closed if preferred
  //     }
  //   };

  //   if (user && !loading) {
  //     checkSubscription();
  //   }
  // }, [user, loading]);

  // Screen tracking and identify
  useEffect(() => {
    analytics.screen('Home');
    analytics.dashboardImpression();
    if (user) {
      analytics.identify(user.id);
    }
  }, [user]);

  // Auto-open goal modal when returning from completed goal
  useEffect(() => {
    if (params.autoOpenGoalModal === 'true' && hasLoadedOnce && goalCardRef.current) {
      // Small delay to ensure UI is ready and data is loaded
      const timer = setTimeout(() => {
        // console.log('🎯 Auto-opening goal modal after celebration');
        goalCardRef.current?.openModal();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [params.autoOpenGoalModal, hasLoadedOnce]);

  // Show alert when goal fails
  useEffect(() => {
    if (params.showFailedGoalAlert === 'true' && params.failedGoalTitle && hasLoadedOnce) {
      const timer = setTimeout(() => {
        Alert.alert(
          '💥 Goal Failed',
          `"${params.failedGoalTitle}" is no longer achievable.\n\n${params.failedGoalReason}\n\nWould you like to set a new goal?`,
          [
            { 
              text: 'Later', 
              style: 'cancel',
              onPress: () => {
                // Clear the params to prevent alert from showing again
                router.setParams({ 
                  showFailedGoalAlert: undefined,
                  failedGoalTitle: undefined,
                  failedGoalReason: undefined 
                });
              }
            },
            { 
              text: 'Set New Goal', 
              onPress: () => {
                // Clear params first
                router.setParams({ 
                  showFailedGoalAlert: undefined,
                  failedGoalTitle: undefined,
                  failedGoalReason: undefined 
                });
                // Then open goal modal
                goalCardRef.current?.openModal();
              }
            }
          ]
        );
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [params.showFailedGoalAlert, params.failedGoalTitle, params.failedGoalReason, hasLoadedOnce]);

  const fetchUserData = useCallback(async () => {
    if (!user?.id) {
      setHasLoadedOnce(true);
      return;
    }

    const nowMs = Date.now();
    if (fetchInFlightRef.current) return;
    if (nowMs - lastFetchAtMsRef.current < 500) return; // Prevent double-fetch on initial focus
    lastFetchAtMsRef.current = nowMs;
    fetchInFlightRef.current = true;

    setIsRefreshing(true);

    const userId = user.id;
    const userEmail = user.email || '';
    const cacheKey = `home_cache_v2:${userId}`;

    try {
      // Fetch lightweight stats/goals first (small payload)
      const [goalsData, counts] = await Promise.all([
        goalService.getActiveGoals(userId),
        matchService.getMatchCounts(userId),
      ]);

      const maxMatchWindow = goalsData.reduce((max, goal) => Math.max(max, goal.match_window ?? 0), 0);
      const matchLimit = Math.min(Math.max(20, maxMatchWindow), 200);

      const matchesData = await matchService.getRecentMatches(userId, matchLimit);

      const calculatedWinRate =
        counts.totalMatches > 0 ? Math.round((counts.winMatches / counts.totalMatches) * 100) : 0;

      setMatches(matchesData);
      setGoals(goalsData);
      setMatchCounts(counts);
      setWinRate(calculatedWinRate);
      setHasLoadedOnce(true);
      liveDataAppliedRef.current = true;

      void AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          version: 2,
          matches: matchesData,
          goals: goalsData,
          winRate: calculatedWinRate,
          trainingTime: trainingTimeRef.current,
          matchCounts: counts,
        })
      ).catch(error => console.warn('Failed to persist Home cache:', error));

      // Defer heavy work so the initial render is fast (and don't run it on every focus)
      const HEAVY_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
      const shouldRunHeavyRefresh = nowMs - lastHeavyRefreshAtMsRef.current > HEAVY_REFRESH_INTERVAL_MS;
      if (shouldRunHeavyRefresh) {
        lastHeavyRefreshAtMsRef.current = nowMs;

        InteractionManager.runAfterInteractions(() => {
          void (async () => {
          try {
            // Ensure user exists in app_user table (non-blocking)
            const existingUser = await userService.getUserById(userId);
            if (!existingUser) {
              const provider = user?.app_metadata?.provider;
              const providers = Array.isArray(user?.app_metadata?.providers)
                ? user?.app_metadata?.providers
                : [];
              const isEmailProvider = provider === 'email' || providers.includes('email');
              await userService.createUser(
                userId,
                userEmail,
                undefined,
                undefined,
                isEmailProvider ? undefined : { fallbackEmailForName: null }
              );
            }
          } catch (error) {
            console.warn('Failed to ensure app_user exists:', error);
          }

          try {
            await goalService.deactivateAllCompletedGoals(userId);
            await goalService.deactivateExpiredGoals(userId);
          } catch (error) {
            console.warn('Failed to run goal cleanup:', error);
          }

          try {
            const trainingTimeData = await matchService.getAllMatchesForTrainingTime(userId);
            const totalSeconds = trainingTimeData.reduce((sum, match) => sum + (match.bout_length_s || 0), 0);
            const formattedTrainingTime = formatTrainingTime(totalSeconds);
            setTrainingTime(formattedTrainingTime);

            void AsyncStorage.setItem(
              cacheKey,
              JSON.stringify({
                version: 2,
                matches: matchesData,
                goals: goalsData,
                winRate: calculatedWinRate,
                trainingTime: formattedTrainingTime,
                matchCounts: counts,
              })
            ).catch(error => console.warn('Failed to persist Home cache:', error));
          } catch (error) {
            console.warn('Failed to fetch training time:', error);
          }
          })();
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load data');
      setHasLoadedOnce(true);
    } finally {
      setIsRefreshing(false);
      fetchInFlightRef.current = false;
    }
  }, [user?.id, user?.email]);

  // Refresh data when screen comes into focus (e.g., when returning from set-goal page)
  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        fetchUserData();
      }
    }, [user, loading, fetchUserData])
  );

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleSetNewGoal = () => {
    // This will be handled by the GoalCard modal
    // console.log('Set new goal clicked');
  };

  const handleUpdateGoal = () => {
    Alert.alert('Update Goal', 'Goal update started!');
  };

  const handleViewAllMatches = () => {
    analytics.capture('recent_matches_view_all');
    router.push('/match-history');
  };

  const calculateDaysLeft = (deadline: string): number => {
    const today = new Date();
    const goalDeadline = new Date(deadline);
    const timeDiff = goalDeadline.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return Math.max(0, daysLeft); // Don't show negative days
  };

  const formatTrainingTime = (totalSeconds: number): { value: string; label: string } => {
    if (totalSeconds < 60) { // Less than 1 minute
      return { value: `${totalSeconds}s`, label: 'Seconds Trained' };
    } else if (totalSeconds < 3600) { // Less than 1 hour
      const minutes = Math.floor(totalSeconds / 60);
      return { value: `${minutes}m`, label: 'Minutes Trained' };
    } else if (totalSeconds < 86400) { // Less than 24 hours
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return { 
        value: minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`, 
        label: 'Hours Trained' 
      };
    } else { // 24+ hours
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      return { 
        value: hours > 0 ? `${days}d ${hours}h` : `${days}d`, 
        label: 'Days Trained' 
      };
    }
  };

  const handleAddNewMatch = () => {
    analytics.quickActionClick({ action: 'log_match' });
    router.push('/add-match');
  };

  const handleSwipeRight = () => {
    router.push('/match-history');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerSafeArea: {
      backgroundColor: 'rgba(33, 33, 33, 1)',
    },
    safeArea: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    stickyHeader: {
      backgroundColor: 'rgba(33, 33, 33, 1)',
      paddingHorizontal: '5%',
      paddingVertical: height * 0.008,
      zIndex: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    contentContainer: {
      padding: '4%',
      paddingTop: 0,
      paddingBottom: height * 0.25, // Increased padding to ensure RecentMatches dots stay above tab bar
      width: '100%',
    },
    progressCardContainer: {
      marginTop: height * 0.005,
    },
    addButtonContainer: {
      alignItems: 'flex-end',
      marginBottom: height * 0.005,
    },
    recentMatchesWrapper: {
      width: '100%',
      marginTop: -height * 0.015, // Move up closer to content above
      marginBottom: height * 0.1, // Ensure RecentMatches stays above tab bar
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: height * 0.008,
    },
    icon: {
      fontSize: width * 0.05,
    },

    loginButton: {
      backgroundColor: Colors.purple.primary,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.01,
      borderRadius: 8,
    },
    loginButtonText: {
      color: '#FFFFFF',
      fontSize: width * 0.035,
      fontWeight: '600',
    },
  });

  // Show loading screen while checking authentication
  if (loading || shouldHoldForProfileCheck || shouldHoldForUserName) {
    return (
      <>
        <HomeSkeleton />
        <CompleteProfilePrompt
          visible={shouldShowCompleteProfilePrompt}
          onDismiss={handleProfilePromptDismiss}
          onCompleted={handleProfilePromptCompleted}
        />
      </>
    );
  }

  if (!user) {
    return null;
  }

  if (!hasLoadedOnce) {
    return (
      <>
        <HomeSkeleton />
        <CompleteProfilePrompt
          visible={shouldShowCompleteProfilePrompt}
          onDismiss={handleProfilePromptDismiss}
          onCompleted={handleProfilePromptCompleted}
        />
      </>
    );
  }

  return (
    <>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        {/* Header with top safe area */}
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.stickyHeader}>
            <UserHeader
              userName={effectiveUserName}
              streak={7}
              avatarUrl={profileImage || undefined}
              onSettingsPress={handleSettings}
            />
          </View>
        </SafeAreaView>
        
        {/* Content with bottom safe area */}
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.contentContainer}>
            <View style={styles.progressCardContainer}>
              <ProgressCard
                activityType="Footwork"
              />
            </View>
            
            <View style={styles.summaryRow}>
              <SummaryCard
                icon={<Text style={[styles.icon, { fontSize: goals.length === 0 ? width * 0.055 : width * 0.05 }]}>🕐</Text>}
                value={trainingTime.value}
                label={trainingTime.label}
                backgroundColor={Colors.pink.light}
                isTall={goals.length === 0} // Smaller when no active goals
              />
              <SummaryCard
                icon={<Text style={[styles.icon, { fontSize: goals.length === 0 ? width * 0.055 : width * 0.05 }]}>🏆</Text>}
                value={`${winRate}%`}
                label="Win Rate"
                backgroundColor={Colors.blue.light}
                isTall={goals.length === 0} // Smaller when no active goals
              />
            </View>
            
            {goals.length > 0 ? (
              (() => {
                // Calculate window matches for insights
                const goal = goals[0];
                let windowMatches = matches;

                let matchesSinceGoalCreation: number | undefined;
                if (goal.match_window && goal.starting_match_count !== undefined && matchCounts) {
                  matchesSinceGoalCreation = Math.max(0, matchCounts.totalMatches - goal.starting_match_count);
                }

                if (goal.match_window) {
                  const matchesToConsider =
                    matchesSinceGoalCreation === undefined
                      ? goal.match_window
                      : Math.min(goal.match_window, matchesSinceGoalCreation);
                  windowMatches = matches.slice(0, matchesToConsider);
                }
                
                const windowWins = windowMatches.filter(m => m.isWin).length;
                const windowLosses = windowMatches.filter(m => !m.isWin).length;
                
                // console.log('🔍 Frontend record calculation:', {
                //   windowWins,
                //   windowLosses,
                //   totalWindowMatches: windowMatches.length
                // });
                
                // For windowed goals, calculate progress from actual window wins
                // For non-windowed goals, use the progress from backend
                let calculatedProgress = goal.progress;
                if (goal.match_window && goal.title === 'Wins') {
                  const rawProgress = goal.targetValue > 0 ? Math.round((windowWins / goal.targetValue) * 100) : 0;
                  calculatedProgress = Math.max(0, Math.min(rawProgress, 100));
                  // console.log('🎯 Windowed goal progress calculation:', {
                  //   windowWins,
                  //   targetValue: goal.targetValue,
                  //   rawProgress,
                  //   calculatedProgress
                  // });
                }
                
                return (
                  <GoalCard
                    ref={goalCardRef}
                    goalId={goal.id}
                    daysLeft={calculateDaysLeft(goal.deadline)}
                    title={goal.title}
                    description={goal.description}
                    progress={calculatedProgress}
                    targetValue={goal.targetValue}
                    currentValue={goal.currentValue}
                    matchWindow={goal.match_window}
                    totalMatches={matchesSinceGoalCreation ?? windowMatches.length}
                    currentRecord={{
                      wins: windowWins,
                      losses: windowLosses
                    }}
                    onSetNewGoal={handleSetNewGoal}
                    onUpdateGoal={handleUpdateGoal}
                onGoalSaved={async (goalData) => {
                  // console.log('Goal saved callback triggered with data:', goalData);
                  if (user) {
                    try {
                      // If this is a windowed goal, add starting match count
                      if (goalData.match_window) {
                        const { totalMatches } = await matchService.getMatchCounts(user.id);
                        goalData.starting_match_count = totalMatches;
                        // console.log('Adding starting_match_count:', goalData.starting_match_count);
                      }
                      
                      // console.log('Saving goal to database...');
                      const newGoal = await goalService.createGoal(goalData, user.id);
                      // console.log('Goal saved result:', newGoal);
                      if (newGoal) {
                        // Track goal creation
                        analytics.goalSaved({ 
                          goal_type: goalData.category || 'unknown',
                          target: goalData.target_value
                        });
                        
                        Alert.alert('Success', 'Goal created successfully!');
                        fetchUserData(); // Refresh data after saving
                      } else {
                        Alert.alert('Error', 'Failed to create goal');
                      }
                    } catch (error) {
                      console.error('Error saving goal:', error);
                      Alert.alert('Error', 'Failed to create goal');
                    }
                  }
                }}
                onGoalUpdated={async (goalId, updates) => {
                  // console.log('🔄 onGoalUpdated callback triggered with goalId:', goalId, 'updates:', updates);
                  try {
                    // If match_window is being added or modified, recalculate starting_match_count
                    if (updates.match_window !== undefined && user) {
                      const { totalMatches } = await matchService.getMatchCounts(user.id);
                      updates.starting_match_count = totalMatches;
                      // console.log('🔄 Recalculating starting_match_count for window change:', updates.starting_match_count);
                    }
                    
                    const updatedGoal = await goalService.updateGoal(goalId, updates);
                    // console.log('Update result:', updatedGoal);
                    
                    if (updatedGoal && user) {
                      // Get goal type for tracking
                      const goal = goals.find(g => g.id === goalId);
                      analytics.goalSaved({ 
                        goal_type: goal?.title || 'unknown',
                        target: updates.target_value
                      });
                      
                      // console.log('✅ Goal updated, recalculating progress...');
                      
                      // Recalculate progress if target, window, or deadline changed
                      const needsRecalculation = 
                        updates.target_value !== undefined || 
                        updates.match_window !== undefined || 
                        updates.deadline !== undefined;
                      
                      if (needsRecalculation) {
                        await goalService.recalculateGoalProgress(goalId, user.id);
                        // console.log('✅ Progress recalculated');
                      }
                      
                      // Small delay to ensure database update propagates
                      setTimeout(async () => {
                        await fetchUserData();
                        // console.log('✅ Home screen refreshed after update');
                        Alert.alert('Success', 'Goal updated successfully!');
                      }, 100);
                    } else {
                      // console.log('❌ Update failed');
                      Alert.alert('Error', 'Failed to update goal');
                    }
                  } catch (error) {
                    console.error('❌ Exception during update:', error);
                    Alert.alert('Error', 'Failed to update goal');
                  }
                }}
                onGoalDeleted={async (goalId) => {
                  // console.log('🗑️ onGoalDeleted callback triggered with goalId:', goalId);
                  try {
                    // Get goal type before deletion for tracking
                    const goal = goals.find(g => g.id === goalId);
                    const goalType = goal?.title || 'unknown';
                    
                    const success = await goalService.deleteGoal(goalId);
                    // console.log('Delete result:', success);
                    
                    if (success) {
                      analytics.goalDeleted({ goal_type: goalType });
                      // console.log('✅ Goal deleted, refreshing home screen...');
                      
                      // Small delay to ensure database update propagates
                      setTimeout(async () => {
                        await fetchUserData();
                        // console.log('✅ Home screen refreshed after deletion');
                        Alert.alert('Success', 'Goal deleted successfully');
                      }, 100);
                    } else {
                      // console.log('❌ Delete failed');
                      Alert.alert('Error', 'Failed to delete goal');
                    }
                  } catch (error) {
                    console.error('❌ Exception during delete:', error);
                    Alert.alert('Error', 'Failed to delete goal');
                  }
                }}
                useModal={true}
              />
                );
              })()
            ) : (
              <GoalCard
                ref={goalCardRef}
                daysLeft={0}
                title="No Active Goals"
                description="Set a new goal to track your progress"
                progress={0}
                targetValue={0}
                currentValue={0}
                onSetNewGoal={handleSetNewGoal}
                onUpdateGoal={handleUpdateGoal}
                onGoalSaved={async (goalData) => {
                  // console.log('Goal saved callback triggered with data:', goalData);
                  if (user) {
                    try {
                      // If this is a windowed goal, add starting match count
                      if (goalData.match_window) {
                        const { totalMatches } = await matchService.getMatchCounts(user.id);
                        goalData.starting_match_count = totalMatches;
                        // console.log('Adding starting_match_count:', goalData.starting_match_count);
                      }
                      
                      // console.log('Saving goal to database...');
                      const newGoal = await goalService.createGoal(goalData, user.id);
                      // console.log('Goal saved result:', newGoal);
                      if (newGoal) {
                        // Track goal creation
                        analytics.goalSaved({ 
                          goal_type: goalData.category || 'unknown',
                          target: goalData.target_value
                        });
                        
                        Alert.alert('Success', 'Goal created successfully!');
                        fetchUserData(); // Refresh data after saving
                      } else {
                        Alert.alert('Error', 'Failed to create goal');
                      }
                    } catch (error) {
                      console.error('Error saving goal:', error);
                      Alert.alert('Error', 'Failed to create goal');
                    }
                  }
                }} // Save goal to database and refresh data
                useModal={true}
              />
            )}
            
            <View style={styles.addButtonContainer}>
              <AddNewMatchButton onPress={handleAddNewMatch} />
            </View>
            
            <View style={styles.recentMatchesWrapper}>
              <RecentMatches
                matches={matches}
                onViewAll={handleViewAllMatches}
                onSwipeRight={handleSwipeRight}
                userName={effectiveUserName}
                userProfileImage={profileImage}
                hasActiveGoals={goals.length > 0}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
      <CompleteProfilePrompt
        visible={shouldShowCompleteProfilePrompt}
        onDismiss={handleProfilePromptDismiss}
        onCompleted={handleProfilePromptCompleted}
      />
    </>
  );
}

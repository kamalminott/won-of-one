import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import useDynamicLayout from '@/hooks/useDynamicLayout';
import { analytics } from '@/lib/analytics';
import { trackFeatureFirstUse, trackOnce } from '@/lib/analyticsTracking';
import { fencingRemoteService, goalService, matchEventService, matchPeriodService, matchService, userService } from '@/lib/database';
import { networkService } from '@/lib/networkService';
import { offlineCache } from '@/lib/offlineCache';
import { offlineRemoteService } from '@/lib/offlineRemoteService';
import { postgrestSelect, postgrestSelectOne } from '@/lib/postgrest';
import { sessionTracker } from '@/lib/sessionTracker';
import { userProfileImageStorageKey, userProfileImageUrlStorageKey } from '@/lib/storageKeys';
import type { MatchPeriod } from '@/types/database';
import { setupAutoSync } from '@/lib/syncManager';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Image, InteractionManager, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
// Native module not working after rebuild - using View fallback
const USE_GESTURE_HANDLER = false; // Disabled until build issue is resolved

// Default fallback
let GestureHandlerRootView: typeof View = View;

if (USE_GESTURE_HANDLER) {
  if (USE_GESTURE_HANDLER) {
    try {
      const gestureModule = require('react-native-gesture-handler');
      GestureHandlerRootView = gestureModule.GestureHandlerRootView || View;
    } catch (e) {
      GestureHandlerRootView = View;
    }
  }
}

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

// Helper function to get display name (full text for placeholder, first name for actual names)
const getDisplayName = (name: string): string => {
  if (name === 'Tap to add name') {
    return name; // Return full placeholder text
  }
  // For actual names, return only the first name
  return name.split(' ')[0];
};

const loadWeaponSvg = async (source: number): Promise<string> => {
  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return readAsStringAsync(uri);
};

export default function RemoteScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useDynamicLayout();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, userName, session } = useAuth();
  const accessToken = session?.access_token ?? null;
  
  // Responsive breakpoints for small screens - simplified for consistency across devices
  
  const [currentPeriod, setCurrentPeriod] = useState(1);
  // Entity-based score state (position-agnostic)
  const [scores, setScores] = useState({ fencerA: 0, fencerB: 0 });
  const scoresRef = useRef({ fencerA: 0, fencerB: 0 }); // Ref to track current scores for timer callbacks
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasMatchStarted, setHasMatchStarted] = useState(false); // Track if match has been started
  const [matchTime, setMatchTime] = useState(180); // 3 minutes in seconds
  const [period1Time, setPeriod1Time] = useState(0); // in seconds
  const [period2Time, setPeriod2Time] = useState(0); // in seconds
  const [period3Time, setPeriod3Time] = useState(0); // in seconds
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editTimeInput, setEditTimeInput] = useState('');
  const [showResetPopup, setShowResetPopup] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [showFinishMatchConfirm, setShowFinishMatchConfirm] = useState(false);
  // Entity-based position mapping (tracks which entity is on left/right)
  const [fencerPositions, setFencerPositions] = useState({ fencerA: 'left' as 'left' | 'right', fencerB: 'right' as 'left' | 'right' });
  const [isSwapping, setIsSwapping] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(true); // Automatically enabled
  // Track which entity is the user (stable across swaps)
  const [userEntity, setUserEntity] = useState<'fencerA' | 'fencerB'>('fencerA');
  const isSwappingRef = useRef(false); // Track if we're currently swapping to prevent name overwrites
  // Entity-based name state (position-agnostic)
  const [fencerNames, setFencerNames] = useState({ 
    fencerA: 'Tap to add name', 
    fencerB: 'Tap to add name' 
  });
  
  // Image states (entity-based)
  const [opponentImages, setOpponentImages] = useState({
    fencerA: null as string | null,
    fencerB: null as string | null,
  });
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedFencer, setSelectedFencer] = useState<'fencerA' | 'fencerB' | null>(null);
  const [isCompletingMatch, setIsCompletingMatch] = useState(false);
  const [isResetting, setIsResetting] = useState(false); // Flag to prevent operations during reset
  
  // Weapon selection state
  const [selectedWeapon, setSelectedWeapon] = useState<'foil' | 'epee' | 'sabre'>('foil');
  const isSabre = selectedWeapon === 'sabre';
  const weaponIconSize = width * 0.045;
  const [weaponSvgs, setWeaponSvgs] = useState<{ foil?: string; epee?: string; sabre?: string }>({});

  useEffect(() => {
    let isMounted = true;
    const loadSvgs = async () => {
      try {
        const [foilSvg, epeeSvg, sabreSvg] = await Promise.all([
          loadWeaponSvg(require('../../assets/icons/weapons/foil.svg')),
          loadWeaponSvg(require('../../assets/icons/weapons/epee.svg')),
          loadWeaponSvg(require('../../assets/icons/weapons/sabre.svg')),
        ]);
        if (isMounted) {
          setWeaponSvgs({ foil: foilSvg, epee: epeeSvg, sabre: sabreSvg });
        }
      } catch (error) {
        console.error('❌ Failed to load weapon SVGs:', error);
      }
    };

    loadSvgs();

    return () => {
      isMounted = false;
    };
  }, []);
  const preferredWeaponRef = useRef<'foil' | 'epee' | 'sabre'>('foil');
  const weaponSelectionLockedRef = useRef(false);
  const [isDoubleHitPressed, setIsDoubleHitPressed] = useState(false);
  
  // Momentum tracking for Sabre Match Insights
  const [momentumStreak, setMomentumStreak] = useState<{
    lastScorer: 'fencerA' | 'fencerB' | null;
    count: number;
  }>({ lastScorer: null, count: 0 });
  const previousScoresRef = useRef({ fencerA: 0, fencerB: 0 });
  // Monotonic elapsed tracker for sabre (no timer) so events stay unique
  const sabreElapsedRef = useRef(0);
  
  // Sabre-specific break tracking
  const [breakTriggered, setBreakTriggered] = useState(false); // Track if break at 8 was offered
  
  // Offline status indicators
  const [isOffline, setIsOffline] = useState(false);
  const [pendingMatchesCount, setPendingMatchesCount] = useState(0);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false); // Controls offline banner visibility
  const [showPendingBanner, setShowPendingBanner] = useState(false); // Controls pending items banner visibility
  const wasOfflineRef = useRef(false); // Track previous offline state
  const pendingBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Track pending banner timeout
  const lastPendingCountRef = useRef(0); // Track previous pending count to detect increases
  const bannerShownForPendingRef = useRef(false); // Track if we've shown banner for current pending items
  const hasShownPendingBannerRef = useRef(false); // Track if we've already shown pending banner for current session

  // Get user display name from context
  const userDisplayName = userName || 'You';
  
  // Debug logging removed
  
  // Test function to manually check stored images
  const testImageLoading = async () => {
    try {
      const aliceImage = await AsyncStorage.getItem('opponent_image_alice');
      const bobImage = await AsyncStorage.getItem('opponent_image_bob');
      // console.log('Direct AsyncStorage check - Alice:', aliceImage, 'Bob:', bobImage);
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

  // Load user's preferred weapon from profile
  useEffect(() => {
    const loadPreferredWeapon = async () => {
      const normalizePreferredWeapon = (value: string | null | undefined) => {
        const normalized = (value || '').toLowerCase();
        if (normalized === 'saber') return 'sabre';
        if (normalized === 'foil' || normalized === 'epee' || normalized === 'sabre') return normalized;
        return null;
      };

      const shouldAutoApply = () => {
        return (
          !weaponSelectionLockedRef.current &&
          !hasMatchStarted &&
          !isPlaying &&
          scores.fencerA === 0 &&
          scores.fencerB === 0 &&
          currentPeriod === 1
        );
      };

      const setPreferredWeapon = (weapon: 'foil' | 'epee' | 'sabre') => {
        preferredWeaponRef.current = weapon;
        if (shouldAutoApply()) {
          setSelectedWeapon(weapon);
        }
      };

      // First try cached value (works offline and updates instantly)
      try {
        const cached = await AsyncStorage.getItem('preferred_weapon');
        const cachedWeapon = normalizePreferredWeapon(cached);
        if (cachedWeapon) {
          setPreferredWeapon(cachedWeapon);
        }
      } catch (error) {
        console.error('Error loading cached preferred weapon:', error);
      }

      if (!user?.id) {
        // Default to foil if no user
        setPreferredWeapon('foil');
        return;
      }

      try {
        const userData = await userService.getUserById(user.id, accessToken);
        const preferredWeapon = normalizePreferredWeapon(userData?.preferred_weapon) || 'foil';
        await AsyncStorage.setItem('preferred_weapon', preferredWeapon);
        setPreferredWeapon(preferredWeapon);
      } catch (error) {
        console.error('Error loading preferred weapon:', error);
        // Fallback to the last known preference; otherwise foil
        if (!preferredWeaponRef.current) {
          setPreferredWeapon('foil');
        }
      }
    };

    loadPreferredWeapon();
  }, [user?.id, accessToken]);

  // Track if we need to set fencer names after toggle is turned off
  const pendingFencerNamesRef = useRef<{ fencer1Name: string; fencer2Name: string } | null>(null);
  // Ensure anonymous params only initialize names once per param set
  const initializedAnonNamesRef = useRef<string | null>(null);
  // Track whether we've applied anonymous params for current focus
  const appliedAnonThisFocusRef = useRef(false);
  // Track if user has manually toggled the profile switch (so we don't override)
  const userHasToggledProfileRef = useRef(false);
  // Store baseline anonymous names so we can restore them when toggle is turned off
  const anonBaselineNamesRef = useRef<{ fencerA: string; fencerB: string } | null>(null);
  // Track if we handled a resetAll request from params for this focus
  const resetAllFromParamsHandledRef = useRef(false);
  // Track if keep-toggle-off flow has been manually edited so we stop auto-writes
  const keepToggleOffLockedRef = useRef(false);
  // Preserve locked names for keep-toggle-off flows
  const keepToggleOffLockedNamesRef = useRef<{ fencerA: string; fencerB: string } | null>(null);
  // Prevent restore loop
  const restoringLockedNamesRef = useRef(false);
  // Track if we've already applied the "change one fencer" params (prevent re-applying on re-renders)
  const changeOneFencerAppliedRef = useRef(false);
  // Helper: only allow automatic toggle OFF when user hasn't manually chosen a state
  const autoToggleOff = useCallback((reason: string) => {
    if (hasMatchStarted) {
      console.log(`⏭️ Skipping auto toggle OFF (${reason}) because match already started`);
      return;
    }
    if (userHasToggledProfileRef.current) {
      console.log(`⏭️ Skipping auto toggle OFF (${reason}) because user manually set toggle`, {
        keepToggleOff: params?.keepToggleOff === 'true',
        hasMatchStarted,
        lock: keepToggleOffLockedRef.current,
        fencerNames
      });
      return;
    }
    console.log(`↩️ Auto toggle OFF (${reason})`, {
      keepToggleOff: params?.keepToggleOff === 'true',
      hasMatchStarted,
      lock: keepToggleOffLockedRef.current,
      fencerNames
    });
    setShowUserProfile(false);
  }, [hasMatchStarted, fencerNames, params?.keepToggleOff]);

  const clearIncomingMatchParams = useCallback(() => {
    router.setParams({
      resetAll: undefined,
      resetNames: undefined,
      changeOneFencer: undefined,
      keepToggleOff: undefined,
      isAnonymous: undefined,
      fencer1Name: undefined,
      fencer2Name: undefined,
    });
  }, [router]);

  // Clear anonymous init guard whenever screen loses focus so new visits can re-init
  useFocusEffect(
    useCallback(() => {
      initializedAnonNamesRef.current = null;
      appliedAnonThisFocusRef.current = false;
      userHasToggledProfileRef.current = false;
      anonBaselineNamesRef.current = null;
      keepToggleOffLockedRef.current = false;
      keepToggleOffLockedNamesRef.current = null;
      pendingFencerNamesRef.current = null;
      resetAllFromParamsHandledRef.current = false;
      changeOneFencerAppliedRef.current = false;
      return () => {
        initializedAnonNamesRef.current = null;
        appliedAnonThisFocusRef.current = false;
        userHasToggledProfileRef.current = false;
        anonBaselineNamesRef.current = null;
        keepToggleOffLockedRef.current = false;
        keepToggleOffLockedNamesRef.current = null;
        pendingFencerNamesRef.current = null;
        resetAllFromParamsHandledRef.current = false;
        changeOneFencerAppliedRef.current = false;
      };
    }, [])
  );

  // Refresh cached preferred weapon on focus so changes on the Profile page apply to new matches
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const normalizePreferredWeapon = (value: string | null | undefined) => {
        const normalized = (value || '').toLowerCase();
        if (normalized === 'saber') return 'sabre';
        if (normalized === 'foil' || normalized === 'epee' || normalized === 'sabre') return normalized;
        return null;
      };

      const shouldAutoApply = () => {
        return (
          !weaponSelectionLockedRef.current &&
          !hasMatchStarted &&
          !isPlaying &&
          scores.fencerA === 0 &&
          scores.fencerB === 0 &&
          currentPeriod === 1
        );
      };

      const refresh = async () => {
        try {
          const cached = await AsyncStorage.getItem('preferred_weapon');
          const cachedWeapon = normalizePreferredWeapon(cached);
          if (!cachedWeapon || cancelled) return;

          preferredWeaponRef.current = cachedWeapon;
          if (shouldAutoApply()) {
            setSelectedWeapon(cachedWeapon);
          }
        } catch (error) {
          console.error('Error refreshing cached preferred weapon:', error);
        }
      };

      refresh();
      return () => {
        cancelled = true;
      };
    }, [currentPeriod, hasMatchStarted, isPlaying, scores.fencerA, scores.fencerB])
  );

  // If coming from neutral summary with resetAll flag, fully reset state/persistence once per focus, then apply incoming name params
  useEffect(() => {
    const needsReset = params.resetAll === 'true';
    if (!needsReset || resetAllFromParamsHandledRef.current) return;

    resetAllFromParamsHandledRef.current = true;
    keepToggleOffLockedRef.current = false;
    keepToggleOffLockedNamesRef.current = null;
    restoringLockedNamesRef.current = false;
    pendingFencerNamesRef.current = null;
    anonBaselineNamesRef.current = null;
    appliedAnonThisFocusRef.current = false;
    initializedAnonNamesRef.current = null;
    userHasToggledProfileRef.current = false; // allow toggle to be set by params

    const applyParamsAfterReset = () => {
      // Keep same fencers (anonymous)
      if (params.isAnonymous === 'true' && params.fencer1Name && params.fencer2Name) {
      const fencerAName = params.fencer1Name as string;
      const fencerBName = params.fencer2Name as string;
      setFencerNames({
        fencerA: fencerAName,
        fencerB: fencerBName,
      });
      autoToggleOff('resetAll anon apply');
      initializedAnonNamesRef.current = `${fencerAName}||${fencerBName}`;
      anonBaselineNamesRef.current = { fencerA: fencerAName, fencerB: fencerBName };
      appliedAnonThisFocusRef.current = true;
      return;
    }

      // Change one fencer (keep one, reset the other)
      if (params.resetNames === 'true' && params.changeOneFencer === 'true') {
        if (params.fencer1Name) {
          // Keep first fencer, reset second
          const fencerAName = params.fencer1Name as string;
          setFencerNames({
            fencerA: fencerAName,
            fencerB: 'Tap to add name',
          });
          autoToggleOff('resetAll changeOne apply');
          anonBaselineNamesRef.current = { fencerA: fencerAName, fencerB: 'Tap to add name' };
          keepToggleOffLockedRef.current = true;
          keepToggleOffLockedNamesRef.current = { fencerA: fencerAName, fencerB: 'Tap to add name' };
          console.log('🧭 [resetAll changeOne] Applied params and locked', {
            fencerA: fencerAName,
            fencerB: 'Tap to add name'
          });
          return;
        } else if (params.fencer2Name) {
          // Keep second fencer, reset first
          const fencerBName = params.fencer2Name as string;
          setFencerNames({
            fencerA: 'Tap to add name',
            fencerB: fencerBName,
          });
          autoToggleOff('resetAll changeOne apply');
          anonBaselineNamesRef.current = { fencerA: 'Tap to add name', fencerB: fencerBName };
          keepToggleOffLockedRef.current = true;
          keepToggleOffLockedNamesRef.current = { fencerA: 'Tap to add name', fencerB: fencerBName };
          console.log('🧭 [resetAll changeOne] Applied params and locked', {
            fencerA: 'Tap to add name',
            fencerB: fencerBName
          });
          return;
        }
      }

      // Change both fencers
      if (params.resetNames === 'true') {
        setFencerNames({
          fencerA: 'Tap to add name',
          fencerB: 'Tap to add name',
        });
        autoToggleOff('resetAll changeBoth apply');
        anonBaselineNamesRef.current = { fencerA: 'Tap to add name', fencerB: 'Tap to add name' };
        keepToggleOffLockedRef.current = true;
        console.log('🧭 [resetAll changeBoth] Applied params and locked');
        return;
      }
    };

    (async () => {
      try {
        await performResetAll(false);
      } catch (error) {
        console.error('Error running resetAllWithPersistence from params:', error);
      } finally {
        applyParamsAfterReset();
        clearIncomingMatchParams();
      }
    })();
  }, [params.resetAll, params.isAnonymous, params.fencer1Name, params.fencer2Name, params.resetNames, params.changeOneFencer, autoToggleOff, clearIncomingMatchParams]);

  // Check for fencer names from params (e.g., when coming from neutral match summary)
  useEffect(() => {
    if (params.resetAll === 'true') {
      return;
    }
    // Handle reset names request (e.g., "Different Fencers" from neutral match summary)
    // If this is an anonymous match that's already been applied, don't force toggle/name changes here
    if (
      params.isAnonymous === 'true' &&
      params.fencer1Name &&
      params.fencer2Name &&
      appliedAnonThisFocusRef.current
    ) {
      return;
    }
    // If user has already edited names in keep-toggle-off flow, skip param-driven overwrites
    if (params.keepToggleOff === 'true' && keepToggleOffLockedRef.current) {
      return;
    }

    if (params.resetNames === 'true' && params.keepToggleOff === 'true') {
      // Clear any pending names first
      pendingFencerNamesRef.current = null;
      
      // Handle "Change One Fencer" option
      // Only apply once - if already applied, skip (allows user to edit names freely)
      if (params.changeOneFencer === 'true' && !keepToggleOffLockedRef.current && !changeOneFencerAppliedRef.current) {
        if (params.fencer1Name) {
          // Keep first fencer, reset second
          if (!showUserProfile) {
            setTimeout(() => {
              // Check lock again inside setTimeout - user may have edited in the meantime
              if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                console.log('⏭️ [changeOne flow] Skipping fencer1 update - user has edited or already applied');
                return;
              }
              setFencerNames({
                fencerA: params.fencer1Name as string,
                fencerB: 'Tap to add name',
              });
              anonBaselineNamesRef.current = { fencerA: params.fencer1Name as string, fencerB: 'Tap to add name' };
              keepToggleOffLockedRef.current = true;
              changeOneFencerAppliedRef.current = true; // Mark as applied
              console.log('🧭 [changeOne flow] Applied fencer1, locked baseline', anonBaselineNamesRef.current);
            }, 50);
          } else {
            autoToggleOff('changeOne resetNames anon effect');
            setTimeout(() => {
              // Check lock again inside setTimeout - user may have edited in the meantime
              if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                console.log('⏭️ [changeOne flow] Skipping fencer1 update (toggle on) - user has edited or already applied');
                return;
              }
              setFencerNames({
                fencerA: params.fencer1Name as string,
                fencerB: 'Tap to add name',
              });
              anonBaselineNamesRef.current = { fencerA: params.fencer1Name as string, fencerB: 'Tap to add name' };
              keepToggleOffLockedRef.current = true;
              changeOneFencerAppliedRef.current = true; // Mark as applied
              console.log('🧭 [changeOne flow] Applied fencer1 (toggle on), locked baseline', anonBaselineNamesRef.current);
            }, 100);
          }
          return; // Don't process other params
        } else if (params.fencer2Name) {
          // Keep second fencer, reset first
          if (!showUserProfile) {
            setTimeout(() => {
              // Check lock again inside setTimeout - user may have edited in the meantime
              if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                console.log('⏭️ [changeOne flow] Skipping fencer2 update - user has edited or already applied');
                return;
              }
              setFencerNames({
                fencerA: 'Tap to add name',
                fencerB: params.fencer2Name as string,
              });
              anonBaselineNamesRef.current = { fencerA: 'Tap to add name', fencerB: params.fencer2Name as string };
              keepToggleOffLockedRef.current = true;
              changeOneFencerAppliedRef.current = true; // Mark as applied
              console.log('🧭 [changeOne flow] Applied fencer2, locked baseline', anonBaselineNamesRef.current);
            }, 50);
          } else {
            autoToggleOff('changeOne resetNames anon effect');
            setTimeout(() => {
              // Check lock again inside setTimeout - user may have edited in the meantime
              if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                console.log('⏭️ [changeOne flow] Skipping fencer2 update (toggle on) - user has edited or already applied');
                return;
              }
              setFencerNames({
                fencerA: 'Tap to add name',
                fencerB: params.fencer2Name as string,
              });
              anonBaselineNamesRef.current = { fencerA: 'Tap to add name', fencerB: params.fencer2Name as string };
              keepToggleOffLockedRef.current = true;
              changeOneFencerAppliedRef.current = true; // Mark as applied
              console.log('🧭 [changeOne flow] Applied fencer2 (toggle on), locked baseline', anonBaselineNamesRef.current);
            }, 100);
          }
          return; // Don't process other params
        }
      }
      
      // Handle "Change Both Fencers" option
      // console.log('🔄 [useEffect] Resetting both fencer names while keeping toggle off');
      // If toggle is already off, keep it off and reset names
          if (!showUserProfile) {
            // Use setTimeout to ensure this runs after any other effects
            setTimeout(() => {
              // console.log('🔄 [useEffect setTimeout] Setting both names to "Tap to add name"');
              setFencerNames({
                fencerA: 'Tap to add name',
                fencerB: 'Tap to add name',
              });
              anonBaselineNamesRef.current = { fencerA: 'Tap to add name', fencerB: 'Tap to add name' };
              // console.log('✅ [useEffect setTimeout] Both names reset, toggle remains off');
            }, 50);
          } else {
            // If toggle is on, turn it off first, then reset names
            autoToggleOff('changeBoth resetNames anon effect');
            // Use a delay to ensure toggle is off before resetting
            setTimeout(() => {
              // console.log('🔄 [useEffect setTimeout] Setting both names to "Tap to add name" after toggle off');
              setFencerNames({
                fencerA: 'Tap to add name',
                fencerB: 'Tap to add name',
              });
              anonBaselineNamesRef.current = { fencerA: 'Tap to add name', fencerB: 'Tap to add name' };
              // console.log('✅ [useEffect setTimeout] Toggle turned off and both names reset');
            }, 100);
          }
          return; // Don't process other params
        }
    
    if (params.fencer1Name && params.fencer2Name) {
        // If this is an anonymous match (from neutral match summary), let useLayoutEffect handle it
        // to avoid conflicts and ensure synchronous setup before paint
        if (params.isAnonymous === 'true') {
          // Don't set names here - useLayoutEffect will handle it synchronously
          // Just ensure toggle is off (useLayoutEffect will also do this, but this is a backup)
          if (showUserProfile) {
            autoToggleOff('anon params non-focus effect');
          }
        } else {
        // Not anonymous, just set names normally
        console.log('📝 Setting fencer names from params:', params.fencer1Name, params.fencer2Name);
        setFencerNames({
          fencerA: params.fencer1Name as string,
          fencerB: params.fencer2Name as string,
        });
      }
    }
  }, [params.fencer1Name, params.fencer2Name, params.isAnonymous, params.resetNames, params.keepToggleOff, params.changeOneFencer, showUserProfile, autoToggleOff]);

  // Set fencer names and toggle state synchronously for anonymous matches (before paint)
  // This ensures both are set before the first render, eliminating race conditions
  useLayoutEffect(() => {
    if (params.resetAll === 'true') {
      return;
    }
    // Reset guard when coming from a reset flow
      if (params.resetNames === 'true' && !keepToggleOffLockedRef.current) {
      initializedAnonNamesRef.current = null;
      return;
    }

    const hasAnonParams = params.isAnonymous === 'true' && !!params.fencer1Name && !!params.fencer2Name;

    if (hasAnonParams) {
      const anonKey = `${params.fencer1Name}||${params.fencer2Name}`;

      // Apply once per focus/param set so user can toggle freely afterward
      if ((!appliedAnonThisFocusRef.current || initializedAnonNamesRef.current !== anonKey) && !keepToggleOffLockedRef.current) {
        console.log('🔧 [useLayoutEffect] Setting anonymous match names synchronously:', {
          fencer1Name: params.fencer1Name,
          fencer2Name: params.fencer2Name
        });
        // Turn off toggle on first load for this param set so both fencer names show/edit normally
        if (showUserProfile && !userHasToggledProfileRef.current) {
          autoToggleOff('anon useLayoutEffect init');
        }
        setFencerNames({
          fencerA: params.fencer1Name as string,
          fencerB: params.fencer2Name as string,
        });
        anonBaselineNamesRef.current = {
          fencerA: params.fencer1Name as string,
          fencerB: params.fencer2Name as string,
        };
        pendingFencerNamesRef.current = null;
        initializedAnonNamesRef.current = anonKey;
        appliedAnonThisFocusRef.current = true;
        console.log('✅ [useLayoutEffect] Anonymous match setup complete - names set and toggle enforced OFF');
      }
    }
    // Legacy: Handle pending names if they exist (backup for edge cases)
    else if (!showUserProfile && pendingFencerNamesRef.current && params.resetNames !== 'true') {
      console.log('📝 [useLayoutEffect] Setting fencer names after toggle is off:', pendingFencerNamesRef.current);
      const namesToSet = pendingFencerNamesRef.current;
      // Clear the pending names first to prevent re-triggering
      pendingFencerNamesRef.current = null;
      // Set both names explicitly
      setFencerNames({
        fencerA: namesToSet.fencer1Name,
        fencerB: namesToSet.fencer2Name,
      });
      console.log('✅ [useLayoutEffect] Fencer names set from pending ref');
    }
  }, [params.isAnonymous, params.fencer1Name, params.fencer2Name, params.resetNames, autoToggleOff]);

  // Backup: ensure anonymous params are applied if names are still placeholders/mismatched
  useEffect(() => {
    if (params.resetAll === 'true') {
      return;
    }
    const hasAnonParams = params.isAnonymous === 'true' && !!params.fencer1Name && !!params.fencer2Name;
    // Only run this backup during initial anonymous apply for this focus
    if (!hasAnonParams || appliedAnonThisFocusRef.current || keepToggleOffLockedRef.current) return;

    const needsNames =
      fencerNames.fencerA !== params.fencer1Name ||
      fencerNames.fencerB !== params.fencer2Name;

    if (needsNames) {
      console.log('🔄 [useEffect] Applying anonymous params as backup:', {
        fencer1Name: params.fencer1Name,
        fencer2Name: params.fencer2Name,
        current: fencerNames
      });
      setFencerNames({
        fencerA: params.fencer1Name as string,
        fencerB: params.fencer2Name as string,
      });
      anonBaselineNamesRef.current = {
        fencerA: params.fencer1Name as string,
        fencerB: params.fencer2Name as string,
      };
    }

    if (showUserProfile && !userHasToggledProfileRef.current) {
      autoToggleOff('anon backup effect');
    }

    appliedAnonThisFocusRef.current = true;
  }, [params.isAnonymous, params.fencer1Name, params.fencer2Name, fencerNames.fencerA, fencerNames.fencerB, showUserProfile]);

  // Also check with useEffect as a backup
  useEffect(() => {
    // Only set names if we have pending names AND we're not in a reset names flow
    if (!showUserProfile && pendingFencerNamesRef.current && params.resetNames !== 'true') {
      // console.log('📝 [useEffect] Setting fencer names after toggle is off (backup):', pendingFencerNamesRef.current);
      const namesToSet = pendingFencerNamesRef.current;
      pendingFencerNamesRef.current = null;
      setFencerNames({
        fencerA: namesToSet.fencer1Name,
        fencerB: namesToSet.fencer2Name,
      });
      anonBaselineNamesRef.current = {
        fencerA: namesToSet.fencer1Name,
        fencerB: namesToSet.fencer2Name,
      };
      // console.log('✅ [useEffect] Fencer names set (backup):', { 
      //   fencerA: namesToSet.fencer1Name, 
      //   fencerB: namesToSet.fencer2Name,
      //   showUserProfile: showUserProfile
      // });
    }
  }, [showUserProfile, params.resetNames]);

  // Monitor network status and pending data
  useEffect(() => {
    // Check initial network status
    networkService.isOnline().then(online => {
      const initiallyOffline = !online;
      setIsOffline(initiallyOffline);
      wasOfflineRef.current = initiallyOffline;
      if (initiallyOffline) {
        // Show offline banner briefly when initially offline
        setShowOfflineBanner(true);
        setTimeout(() => setShowOfflineBanner(false), 1500); // Show for 1.5 seconds
      }
    });
    
    // Subscribe to network changes
    const unsubscribe = networkService.subscribe((isConnected) => {
      const wasOffline = wasOfflineRef.current;
      const nowOffline = !isConnected;
      wasOfflineRef.current = nowOffline;
      setIsOffline(nowOffline);
      // console.log(`🌐 Network status: ${isConnected ? 'ONLINE' : 'OFFLINE'}`);
      
      if (nowOffline && !wasOffline) {
        // Just went offline - track offline mode detection
        analytics.offlineModeDetected();
        
        // Just went offline - show offline banner for 1.5 seconds
        // Also hide pending banner if it was showing
        setShowPendingBanner(false);
        if (pendingBannerTimeoutRef.current) {
          clearTimeout(pendingBannerTimeoutRef.current);
          pendingBannerTimeoutRef.current = null;
        }
        setShowOfflineBanner(true);
        setTimeout(() => setShowOfflineBanner(false), 1500); // Auto-dismiss after 1.5 seconds
      } else if (isConnected && wasOffline) {
        // Just came online from offline - check for pending items and show banner if any
        setShowOfflineBanner(false);
        // Reset the "has shown" flag when coming online so we can show banner for pending items
        hasShownPendingBannerRef.current = false;
        // Refresh pending counts (sync manager will handle actual sync)
        checkPendingData().then(() => {
          // After checking, if there are pending items, show banner once
          setTimeout(() => {
            const getPendingCount = async () => {
              const matches = await offlineCache.getPendingMatches();
              const events = await offlineCache.getPendingRemoteEvents();
              const totalPending = matches.length + events.length;
              if (totalPending > 0 && !hasShownPendingBannerRef.current) {
                setShowPendingBanner(true);
                hasShownPendingBannerRef.current = true;
                if (pendingBannerTimeoutRef.current) {
                  clearTimeout(pendingBannerTimeoutRef.current);
                }
                pendingBannerTimeoutRef.current = setTimeout(() => {
                  setShowPendingBanner(false);
                  pendingBannerTimeoutRef.current = null;
                }, 1500);
              }
            };
            getPendingCount();
          }, 500); // Small delay to ensure counts are updated
        });
      } else if (isConnected) {
        // Already online - just refresh counts silently
        checkPendingData();
      }
    });

    // Periodically check pending data count
    async function checkPendingData() {
      try {
        const matches = await offlineCache.getPendingMatches();
        const events = await offlineCache.getPendingRemoteEvents();
        const newMatchesCount = matches.length;
        const newEventsCount = events.length;
        const totalPending = newMatchesCount + newEventsCount;
        
        setPendingMatchesCount(newMatchesCount);
        setPendingEventsCount(newEventsCount);
        
        // Update tracking first
        const previousCount = lastPendingCountRef.current;
        lastPendingCountRef.current = totalPending;
        
        // IMPORTANT: Only show pending banner when coming online, NOT during active offline use
        // During offline use, we don't want to show banner every time user scores
        if (isOffline) {
          // User is offline - update counts but don't show pending banner
          // They'll see it when they come back online
          return;
        }
        
        // When online, only clear banner if no pending items
        // Don't show banner based on count changes - that's handled in network state handler
        if (totalPending === 0) {
          // No pending items - reset tracking and clear banner
          hasShownPendingBannerRef.current = false;
          bannerShownForPendingRef.current = false;
          setShowPendingBanner(false);
          if (pendingBannerTimeoutRef.current) {
            clearTimeout(pendingBannerTimeoutRef.current);
            pendingBannerTimeoutRef.current = null;
          }
        }
        // Banner visibility is controlled by the network state change handler when coming online
        // We don't show banner just because count changed during normal online use
      } catch (error) {
        console.error('Error checking pending data:', error);
      }
    }

    // Initial check - initialize the tracking
    checkPendingData().then(() => {
      // After initial check, set up the initial count tracking
      const getInitialCount = async () => {
        const matches = await offlineCache.getPendingMatches();
        const events = await offlineCache.getPendingRemoteEvents();
        lastPendingCountRef.current = matches.length + events.length;
      };
      getInitialCount();
    });
    
    // Check every 5 seconds - but banner won't show unless count increases
    const interval = setInterval(checkPendingData, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      // Clean up pending banner timeout
      if (pendingBannerTimeoutRef.current) {
        clearTimeout(pendingBannerTimeoutRef.current);
      }
    };
  }, []);

  // Setup auto-sync when user is available
  useEffect(() => {
    if (user?.id) {
      // console.log('✅ Setting up auto-sync for user:', user.id);
      const cleanup = setupAutoSync(user.id);
      
      return () => {
        // console.log('🧹 Cleaning up auto-sync');
        cleanup();
      };
    }
  }, [user?.id]);

  // Track momentum for Sabre Match Insights
  useEffect(() => {
    if (selectedWeapon !== 'sabre' || !hasMatchStarted) {
      // Reset momentum when not sabre or match hasn't started
      setMomentumStreak({ lastScorer: null, count: 0 });
      previousScoresRef.current = { fencerA: 0, fencerB: 0 };
      return;
    }

    const prev = previousScoresRef.current;
    const current = scores;

    // Check which fencer scored (score increased)
    if (current.fencerA > prev.fencerA) {
      // Fencer A scored
      setMomentumStreak(prevStreak => {
        if (prevStreak.lastScorer === 'fencerA') {
          return { ...prevStreak, count: prevStreak.count + 1 };
        } else {
          return { lastScorer: 'fencerA', count: 1 };
        }
      });
    } else if (current.fencerB > prev.fencerB) {
      // Fencer B scored
      setMomentumStreak(prevStreak => {
        if (prevStreak.lastScorer === 'fencerB') {
          return { ...prevStreak, count: prevStreak.count + 1 };
        } else {
          return { lastScorer: 'fencerB', count: 1 };
        }
      });
    } else if (current.fencerA < prev.fencerA || current.fencerB < prev.fencerB) {
      // Score decreased - reset momentum
      setMomentumStreak({ lastScorer: null, count: 0 });
    }

    // Update previous scores
    previousScoresRef.current = { ...current };
  }, [scores, selectedWeapon, hasMatchStarted]);
  
  // Monitor sync status - simplified, banner handles its own visibility
  // This effect just tracks sync state for display purposes
  useEffect(() => {
    if (!isOffline && (pendingMatchesCount > 0 || pendingEventsCount > 0)) {
      // Online with pending items - sync should be happening
      setIsSyncing(true);
    } else if (pendingMatchesCount === 0 && pendingEventsCount === 0) {
      // No pending items - sync complete
      setIsSyncing(false);
    }
  }, [isOffline, pendingMatchesCount, pendingEventsCount]);

  // Save match state when scores or other important state changes
  useEffect(() => {
    // Only save if there's an active match
    const hasActiveMatch = scores.fencerA > 0 || scores.fencerB > 0 || currentPeriod > 1 || 
                          period1Time > 0 || period2Time > 0 || period3Time > 0 || isPlaying;
    
    if (hasActiveMatch) {
      saveMatchState();
    }
  }, [scores, currentPeriod, isPlaying, period1Time, period2Time, period3Time]);

  // Track screen view once per focus
  useFocusEffect(
    useCallback(() => {
      analytics.screen('Remote');
    }, [])
  );

  // Handle true focus/blur transitions for resume persistence
  useFocusEffect(
    useCallback(() => {
      resumePromptShownRef.current = false; // reset only on real focus

      return () => {
        if (!isActivelyUsingAppRef.current) {
          setHasNavigatedAway(true);
        }
        void saveMatchStateRef.current();
        if (isPlayingRef.current) {
          pauseTimerRef.current();
        }
      };
    }, [])
  );

  // Handle focus-based param syncing and resume prompt
  useFocusEffect(
    useCallback(() => {
      if (params.resetAll !== 'true') {
        // Check for reset names request first (e.g., "Different Fencers" from neutral match summary)
        if (params.resetNames === 'true' && params.keepToggleOff === 'true') {
          // If user has already edited names, skip param-driven overwrites
          if (keepToggleOffLockedRef.current) {
            return;
          }
          
          // Clear any pending names first
          pendingFencerNamesRef.current = null;
          
          // Handle "Change One Fencer" option
          // Only apply once - if already applied, skip (allows user to edit names freely)
          if (params.changeOneFencer === 'true' && !changeOneFencerAppliedRef.current) {
            if (params.fencer1Name) {
              // Keep first fencer, reset second
              if (!showUserProfile) {
                setTimeout(() => {
                  // Check lock again inside setTimeout - user may have edited in the meantime
                  if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                    console.log('⏭️ [useFocusEffect] Skipping fencer1 update - user has edited or already applied');
                    return;
                  }
                  setFencerNames({
                    fencerA: params.fencer1Name as string,
                    fencerB: 'Tap to add name',
                  });
                  changeOneFencerAppliedRef.current = true; // Mark as applied
                }, 50);
              } else {
                autoToggleOff('changeOne resetNames focus');
                setTimeout(() => {
                  // Check lock again inside setTimeout - user may have edited in the meantime
                  if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                    console.log('⏭️ [useFocusEffect] Skipping fencer1 update (toggle on) - user has edited or already applied');
                    return;
                  }
                  setFencerNames({
                    fencerA: params.fencer1Name as string,
                    fencerB: 'Tap to add name',
                  });
                  changeOneFencerAppliedRef.current = true; // Mark as applied
                }, 100);
              }
            } else if (params.fencer2Name) {
              // Keep second fencer, reset first
              if (!showUserProfile) {
                setTimeout(() => {
                  // Check lock again inside setTimeout - user may have edited in the meantime
                  if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                    console.log('⏭️ [useFocusEffect] Skipping fencer2 update - user has edited or already applied');
                    return;
                  }
                  setFencerNames({
                    fencerA: 'Tap to add name',
                    fencerB: params.fencer2Name as string,
                  });
                  changeOneFencerAppliedRef.current = true; // Mark as applied
                }, 50);
              } else {
                autoToggleOff('changeOne resetNames focus');
                setTimeout(() => {
                  // Check lock again inside setTimeout - user may have edited in the meantime
                  if (keepToggleOffLockedRef.current || changeOneFencerAppliedRef.current) {
                    console.log('⏭️ [useFocusEffect] Skipping fencer2 update (toggle on) - user has edited or already applied');
                    return;
                  }
                  setFencerNames({
                    fencerA: 'Tap to add name',
                    fencerB: params.fencer2Name as string,
                  });
                  changeOneFencerAppliedRef.current = true; // Mark as applied
                }, 100);
              }
            }
          }
          // Handle "Change Both Fencers" option
          else {
            // console.log('🔄 [useFocusEffect] Resetting both fencer names while keeping toggle off');
            // If toggle is already off, keep it off and reset names
            if (!showUserProfile) {
              // Use setTimeout to ensure this runs after any other effects
              setTimeout(() => {
                // console.log('🔄 [useFocusEffect setTimeout] Setting both names to "Tap to add name"');
                setFencerNames({
                  fencerA: 'Tap to add name',
                  fencerB: 'Tap to add name',
                });
                // console.log('✅ [useFocusEffect setTimeout] Both names reset, toggle remains off');
              }, 50);
            } else {
              // If toggle is on, turn it off first, then reset names
              autoToggleOff('changeBoth resetNames focus');
              setTimeout(() => {
                // console.log('🔄 [useFocusEffect setTimeout] Setting both names to "Tap to add name" after toggle off');
                setFencerNames({
                  fencerA: 'Tap to add name',
                  fencerB: 'Tap to add name',
                });
                // console.log('✅ [useFocusEffect setTimeout] Toggle turned off and both names reset');
              }, 100);
            }
          }
        }
        // Check for fencer names from params (e.g., when coming from neutral match summary)
        // This takes precedence over persisted state
        else if (params.fencer1Name && params.fencer2Name) {
          // If this is an anonymous match (from neutral match summary), let useLayoutEffect handle it
          // to avoid conflicts and ensure synchronous setup before paint
          if (params.isAnonymous === 'true') {
            // Don't set names here - useLayoutEffect will handle it synchronously
            // Just ensure toggle is off (useLayoutEffect will also do this, but this is a backup)
            if (showUserProfile) {
              autoToggleOff('anon params focus');
            }
          } else {
            // Not anonymous, just set names normally
            console.log('📝 Setting fencer names from params on focus:', params.fencer1Name, params.fencer2Name);
            setFencerNames({
              fencerA: params.fencer1Name as string,
              fencerB: params.fencer2Name as string,
            });
          }
        }
      }

      let cancelled = false;

      const run = async () => {
        // wait until nav animations & interactions are done — Alert/Modal will show immediately
        await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));

        // console.log('🎯 Checking resume conditions:', {
        //   cancelled,
        //   hasNavigatedAwayRef: hasNavigatedAwayRef.current,
        //   resumePromptShown: resumePromptShownRef.current
        // });
        
        if (!cancelled && hasNavigatedAwayRef.current && !resumePromptShownRef.current && !isActivelyUsingAppRef.current) {
          // Check if there's actually a saved match state worth resuming
          const savedState = await AsyncStorage.getItem('ongoing_match_state');
          if (savedState) {
            const matchState = JSON.parse(savedState);
            // Handle backward compatibility
            const savedFencerAScore = matchState.scores?.fencerA ?? 0;
            const savedFencerBScore = matchState.scores?.fencerB ?? 0;
            const hasActiveMatch = savedFencerAScore > 0 || savedFencerBScore > 0 || matchState.currentPeriod > 1;
            
            if (hasActiveMatch) {
              // console.log('🎯 Showing resume prompt - active match found');
              resumePromptShownRef.current = true;
              // force the prompt
              await loadPersistedMatchState({ forcePrompt: true });
            } else {
              // console.log('🎯 No active match to resume - clearing flag');
              setHasNavigatedAway(false);
            }
          } else {
            // console.log('🎯 No saved state - clearing flag');
            setHasNavigatedAway(false);
          }
        } else {
          // console.log('🎯 Skipping resume prompt - conditions not met');
          // Reset navigation flag when screen gains focus normally
          if (hasNavigatedAwayRef.current) {
            setHasNavigatedAway(false);
          }
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    }, [params.fencer1Name, params.fencer2Name, params.isAnonymous, autoToggleOff]) // Include params for anonymous match handling
  );

  const loadStoredImages = async () => {
    try {
      const aliceImage = await AsyncStorage.getItem('opponent_image_alice');
      const bobImage = await AsyncStorage.getItem('opponent_image_bob');
      const userImage =
        (await AsyncStorage.getItem(userProfileImageStorageKey(user?.id))) ||
        (await AsyncStorage.getItem(userProfileImageUrlStorageKey(user?.id)));
      
      // console.log('Loaded images - Alice:', aliceImage, 'Bob:', bobImage, 'User:', userImage);
      
      setOpponentImages({
        fencerA: aliceImage,
        fencerB: bobImage,
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
        const userImage =
          (await AsyncStorage.getItem(userProfileImageStorageKey(user?.id))) ||
          (await AsyncStorage.getItem(userProfileImageUrlStorageKey(user?.id)));
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
  const renderProfileImage = (imageUri: string | null | undefined, name: string | undefined, isUser: boolean = false) => {
    const initials = getInitials(name);

    if (imageUri && isValidImage(imageUri) && !imageLoadErrors.has(imageUri)) {
      return (
        <Image 
          source={{ uri: imageUri }} 
          style={styles.profileImage}
          resizeMode="cover"
          onError={(error) => {
            // console.log('❌ Image failed to load, will show initials instead:', error);
            setImageLoadErrors(prev => new Set(prev).add(imageUri));
          }}
          onLoad={() => {
            // console.log('✅ Image loaded successfully');
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
      const hasMatchStarted = scores.fencerA > 0 || scores.fencerB > 0 || currentPeriod > 1 || 
                             period1Time > 0 || period2Time > 0 || period3Time > 0;
      
      if (!hasMatchStarted && !isPlaying) {
        // No active match to save
        await AsyncStorage.removeItem('ongoing_match_state');
        // console.log('💾 No active match - cleared any saved state');
        return;
      }

      const matchState = {
        currentPeriod,
        scores, // New entity-based structure
        cards, // New entity-based structure
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
        resetSegment,
        savedAt: new Date().toISOString()
      };
      
      // Log what's being saved in match state
      // console.log('💾 SAVING MATCH STATE:', {
      //   fencerAScore: scores.fencerA,
      //   fencerBScore: scores.fencerB,
      //   currentPeriod,
      //   fencerNames,
      //   matchStartTime: matchStartTime?.toISOString(),
      //   lastEventTime: lastEventTime?.toISOString(),
      //   totalPausedTime,
      //   matchId: currentMatchPeriod?.match_id
      // });
      
      // Note: Individual scoring events with timing are stored in match_event table, not in match state
      // console.log('💾 NOTE: Individual scoring events are stored in database (match_event table), not in match state');

      await AsyncStorage.setItem('ongoing_match_state', JSON.stringify(matchState));
      // console.log('💾 Match state saved:', matchState);
    } catch (error) {
      console.error('Error saving match state:', error);
    }
  };

  useEffect(() => {
    saveMatchStateRef.current = saveMatchState;
  }, [saveMatchState]);

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
      // Handle backward compatibility: old format has aliceScore/bobScore, new format has scores
      const fencerAScore = matchState.scores?.fencerA ?? 0;
      const fencerBScore = matchState.scores?.fencerB ?? 0;
      const hasMatchData = fencerAScore > 0 || fencerBScore > 0 || 
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
        
        // Handle backward compatibility for old format
        const savedFencerAScore = matchState.scores?.fencerA ?? 0;
        const savedFencerBScore = matchState.scores?.fencerB ?? 0;
        const savedFencerAName = matchState.fencerNames?.fencerA ?? matchState.fencerNames?.alice ?? 'Fencer A';
        const savedFencerBName = matchState.fencerNames?.fencerB ?? matchState.fencerNames?.bob ?? 'Fencer B';
        
        Alert.alert(
          '🏁 Completed Match Found',
          `You have a completed match from ${timeText}:\n\n` +
          `${savedFencerAName}: ${savedFencerAScore}\n` +
          `${savedFencerBName}: ${savedFencerBScore}\n` +
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
                // console.log('🔄 User chose to resume completed match');
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
        
        // Handle backward compatibility for old format
        const savedFencerAScore2 = matchState.scores?.fencerA ?? 0;
        const savedFencerBScore2 = matchState.scores?.fencerB ?? 0;
        const savedFencerAName2 = matchState.fencerNames?.fencerA ?? matchState.fencerNames?.alice ?? 'Fencer A';
        const savedFencerBName2 = matchState.fencerNames?.fencerB ?? matchState.fencerNames?.bob ?? 'Fencer B';
        
        Alert.alert(
          '🔄 Resume Your Match?',
          `You have a paused match from ${timeText}:\n\n` +
          `${savedFencerAName2}: ${savedFencerAScore2}\n` +
          `${savedFencerBName2}: ${savedFencerBScore2}\n` +
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
                // console.log('🔄 User chose to resume match');
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
      
      // Use entity-based scores (no longer supporting backward compatibility with aliceScore/bobScore)
      const savedScores = matchState.scores || {
        fencerA: 0,
        fencerB: 0
      };
      
      // Handle backward compatibility for cards
      const savedCards = matchState.cards || {
        fencerA: matchState.aliceCards || { yellow: 0, red: 0 },
        fencerB: matchState.bobCards || { yellow: 0, red: 0 }
      };
      
      // Handle backward compatibility for fencerNames
      const savedFencerNames = matchState.fencerNames?.fencerA ? matchState.fencerNames : {
        fencerA: matchState.fencerNames?.alice || 'Tap to add name',
        fencerB: matchState.fencerNames?.bob || 'Tap to add name'
      };
      
      // Handle backward compatibility for fencerPositions
      const savedFencerPositions = matchState.fencerPositions?.fencerA ? matchState.fencerPositions : {
        fencerA: matchState.fencerPositions?.alice === 'left' ? 'left' : 'right',
        fencerB: matchState.fencerPositions?.bob === 'left' ? 'left' : 'right'
      };
      
      setCurrentPeriod(matchState.currentPeriod || 1);
      setScores(savedScores);
      setCards(savedCards);
      setIsPlaying(false); // Always start paused when resuming
      setIsCompletingMatch(false); // Always reset completion flag when restoring
      setMatchTime(matchState.matchTime || 180);
      setPeriod1Time(matchState.period1Time || 0);
      setPeriod2Time(matchState.period2Time || 0);
      setPeriod3Time(matchState.period3Time || 0);
      setFencerNames(savedFencerNames);
      setFencerPositions(savedFencerPositions);
      
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
      if (typeof matchState.resetSegment === 'number') {
        resetSegmentRef.current = matchState.resetSegment;
        setResetSegment(matchState.resetSegment);
      } else {
        resetSegmentRef.current = 0;
        setResetSegment(0);
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
    setScores({ fencerA: 0, fencerB: 0 });
    resetSegmentRef.current = 0;
    setResetSegment(0);
    matchEventSequenceRef.current = 0;
    recentScoringEventUuidsRef.current = { fencerA: null, fencerB: null };
    setIsPlaying(false);
    setIsCompletingMatch(false);
    isActivelyUsingAppRef.current = false; // Reset active usage flag
    setMatchTime(180);
    setPeriod1Time(0);
    setPeriod2Time(0);
    setPeriod3Time(0);
    sabreElapsedRef.current = 0;
    
    // Reset fencer info to defaults
    if (showUserProfile && userDisplayName) {
      if (toggleCardPosition === 'left') {
        setFencerNames({ 
          fencerA: userDisplayName, 
          fencerB: 'Tap to add name' 
        });
      } else {
        setFencerNames({ 
          fencerA: 'Tap to add name', 
          fencerB: userDisplayName 
        });
      }
    } else {
      setFencerNames({ 
        fencerA: 'Tap to add name', 
        fencerB: 'Tap to add name' 
      });
    }
    setFencerPositions({ fencerA: 'left', fencerB: 'right' });
    setShowUserProfile(true);
    
    // Reset priority states
    setIsPriorityRound(false);
    setHasShownPriorityScorePopup(false);
    setPriorityFencer(null);
    setPriorityLightPosition(null);
    setShowPriorityPopup(false);
    setIsAssigningPriority(false);
    
    // Reset time tracking
    setMatchStartTime(null);
    setLastEventTime(null);
    setTotalPausedTime(0);
    
    console.log('✅ Reset All completed with persistence clearing');
  };

  const handleImageSelection = (entity: 'fencerA' | 'fencerB') => {
    setSelectedFencer(entity);
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
          mediaTypes: ['images'],
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
          mediaTypes: ['images'],
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
  const [matchId, setMatchId] = useState<string | null>(null); // Store match ID safely
  
  // Event tracking state
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const [resetSegment, setResetSegment] = useState(0);
  const resetSegmentRef = useRef(0);
  const matchEventSequenceRef = useRef(0);
  // Track most recent scoring event IDs for each fencer (for cancellation tracking)
  const [recentScoringEventIds, setRecentScoringEventIds] = useState<{
    fencerA: string | null;
    fencerB: string | null;
  }>({ fencerA: null, fencerB: null });
  const recentScoringEventUuidsRef = useRef<{ fencerA: string | null; fencerB: string | null }>({
    fencerA: null,
    fencerB: null,
  });
  // Queue touches that happen before match_id/period exists (first sabre touch race)
  const pendingTouchQueueRef = useRef<any[]>([]);
  // Track latest match/period synchronously for immediate access in event creation
  const currentMatchPeriodRef = useRef<any>(null);
  const [matchStartTime, setMatchStartTime] = useState<Date | null>(null);
  const [totalPausedTime, setTotalPausedTime] = useState<number>(0); // in milliseconds
  const [pauseStartTime, setPauseStartTime] = useState<Date | null>(null);
  useEffect(() => {
    resetSegmentRef.current = resetSegment;
  }, [resetSegment]);

  const debugSequenceRef = useRef(0);

  const nextDebugId = () => {
    debugSequenceRef.current += 1;
    return `${Date.now()}_${debugSequenceRef.current}`;
  };

  const nextMatchEventSequence = () => {
    matchEventSequenceRef.current += 1;
    return matchEventSequenceRef.current;
  };

  const buildEventIdentity = () => ({
    event_uuid: Crypto.randomUUID(),
    event_sequence: nextMatchEventSequence(),
  });

  const appendLocalMatchEvent = async (event: any) => {
    if (!event?.match_id || !event?.event_uuid) return;
    await offlineCache.appendMatchEvent(event.match_id, event);
  };

  const formatDebugError = (error: any) => {
    if (!error) {
      return { error_code: 'unknown', error_message: 'unknown' };
    }
    let message: string;
    if (typeof error === 'string') {
      message = error;
    } else if (error?.message) {
      message = String(error.message);
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }
    return {
      error_code: error?.code ?? error?.status ?? error?.name ?? 'unknown',
      error_message: message.slice(0, 300),
    };
  };

  const captureMatchDebug = (step: string, details: Record<string, any> = {}) => {
    analytics.capture('match_event_debug', {
      step,
      screen: 'Remote',
      match_id: currentMatchPeriod?.match_id ?? currentMatchPeriodRef.current?.match_id ?? null,
      match_period_id: currentMatchPeriod?.match_period_id ?? currentMatchPeriodRef.current?.match_period_id ?? null,
      remote_id: remoteSession?.remote_id ?? null,
      has_match_started: hasMatchStarted,
      is_playing: isPlaying,
      time_remaining: timeRemaining,
      match_time: matchTime,
      current_period: currentPeriod,
      is_injury_timer: isInjuryTimer,
      is_break_time: isBreakTime,
      is_priority_round: isPriorityRound,
      is_resetting: isResetting,
      is_completing_match: isCompletingMatch,
      is_offline: isOffline,
      pending_matches: pendingMatchesCount,
      pending_events: pendingEventsCount,
      has_session: !!session,
      has_access_token: !!session?.access_token,
      access_token_len: session?.access_token?.length ?? 0,
      has_refresh_token: !!session?.refresh_token,
      reset_segment: resetSegmentRef.current,
      score_a: scoresRef.current.fencerA,
      score_b: scoresRef.current.fencerB,
      ...details,
    });
  };
  
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

  // Replay any queued touches once match/period IDs are available
  const flushQueuedTouches = useCallback(async () => {
    if (!currentMatchPeriod?.match_id || !remoteSession) return;
    if (pendingTouchQueueRef.current.length === 0) return;

    const queued = [...pendingTouchQueueRef.current];
    pendingTouchQueueRef.current = [];

    console.log('⏩ Replaying queued touches with match_id', {
      count: queued.length,
      match_id: currentMatchPeriod.match_id,
      match_period_id: currentMatchPeriod.match_period_id || null,
    });

    const isOnline = await networkService.isOnline();

    for (const item of queued) {
      const enrichedEvent = {
        ...item.baseEvent,
        match_id: currentMatchPeriod.match_id,
        match_period_id: currentMatchPeriod.match_period_id || null,
        fencing_remote_id: remoteSession.remote_id,
      };
      void appendLocalMatchEvent(enrichedEvent);

      // Always queue to offline cache with correct IDs
      let queuedEventId: string | null = null;
      try {
        queuedEventId = await offlineRemoteService.recordEvent({
          remote_id: remoteSession.remote_id,
          event_uuid: enrichedEvent.event_uuid,
          event_sequence: enrichedEvent.event_sequence,
          event_type: enrichedEvent.event_type || "touch",
          scoring_user_name: enrichedEvent.scoring_user_name,
          match_time_elapsed: enrichedEvent.match_time_elapsed,
          event_time: enrichedEvent.event_time,
          metadata: {
            match_id: enrichedEvent.match_id,
            match_period_id: enrichedEvent.match_period_id,
            scoring_user_id: enrichedEvent.scoring_user_id,
            fencer_1_name: enrichedEvent.fencer_1_name,
            fencer_2_name: enrichedEvent.fencer_2_name,
            card_given: enrichedEvent.card_given,
            reset_segment: enrichedEvent.reset_segment,
            score_diff: enrichedEvent.score_diff,
            seconds_since_last_event: enrichedEvent.seconds_since_last_event,
          }
        });
      } catch (error) {
        console.error('❌ Error queueing replayed touch:', error);
      }

      // If online and not an offline session, also insert immediately
      if (isOnline && !item.isOfflineSession) {
        try {
          const { event_sequence, ...eventForInsert } = enrichedEvent;
          const createdEvent = await matchEventService.createMatchEvent(eventForInsert);
          if (createdEvent && queuedEventId) {
            await offlineCache.removePendingRemoteEvent(queuedEventId);
          }
        } catch (err: any) {
          const isForeignKeyError = err?.code === '23503' || 
                                    err?.message?.includes('foreign key constraint') ||
                                    err?.message?.includes('violates foreign key');
          if (isForeignKeyError) {
            console.log('⚠️ FK error while replaying queued touch, leaving in offline queue only');
          } else {
            console.error('❌ Error replaying queued touch:', err);
          }
        }
      }
    }
  }, [currentMatchPeriod, remoteSession]);

  // Whenever a match/period becomes available, replay any touches that were queued before IDs existed
  useEffect(() => {
    flushQueuedTouches();
  }, [flushQueuedTouches]);
  // Keep currentMatchPeriod in a ref so event creation can use it before state updates land
  useEffect(() => {
    currentMatchPeriodRef.current = currentMatchPeriod;
  }, [currentMatchPeriod]);

  // Helper function to create match events with all required fields (now offline-capable)
  // Refactored to use entity-based parameters
  const createMatchEvent = async (
    scorer: 'user' | 'opponent', 
    cardGiven?: string, 
    scoringEntity?: 'fencerA' | 'fencerB', 
    newScore?: number,
    sessionOverride?: any,
    eventType: 'touch' | 'double' | 'card' = 'touch',
    debugId?: string
  ) => {
    const eventDebugId = debugId || nextDebugId();
    captureMatchDebug('match_event_start', {
      debug_id: eventDebugId,
      event_type: eventType,
      card_given: cardGiven || null,
      scoring_entity: scoringEntity || null,
      scorer,
    });
    // Early return if reset is in progress
    if (isResetting) {
      console.log('⚠️ Reset in progress, skipping event creation');
      captureMatchDebug('match_event_skip', {
        debug_id: eventDebugId,
        reason: 'reset_in_progress',
      });
      return;
    }
    
    // Use sessionOverride if provided, otherwise use remoteSession state
    const activeSession = sessionOverride || remoteSession;
    if (!activeSession) {
      console.log('❌ No remote session - cannot create match event');
      captureMatchDebug('match_event_skip', {
        debug_id: eventDebugId,
        reason: 'missing_remote_session',
        session_override: !!sessionOverride,
      });
      return;
    }
    // Synchronously grab latest period if state hasn't updated yet
    const effectivePeriod = currentMatchPeriod || currentMatchPeriodRef.current;
    
    // Check if we're offline or if this is an offline session
    const isOnline = await networkService.isOnline();
    const isOfflineSession = activeSession.remote_id.startsWith('offline_');
    captureMatchDebug('match_event_network', {
      debug_id: eventDebugId,
      is_online: isOnline,
      is_offline_session: isOfflineSession,
    });
    
    // Skip database check for offline sessions or when offline
    if (!isOfflineSession && isOnline) {
      // Only verify session exists in database if we're online and it's an online session
      const { data: sessionCheck, error: sessionError } = await postgrestSelectOne<{ remote_id: string }>(
        'fencing_remote',
        {
          select: 'remote_id',
          remote_id: `eq.${activeSession.remote_id}`,
          limit: 1,
        },
        accessToken ? { accessToken } : { allowAnon: true }
      );
      
      if (sessionError || !sessionCheck) {
        console.log('⚠️ Remote session not in database (may be offline), will queue event');
        captureMatchDebug('match_event_session_check_failed', {
          debug_id: eventDebugId,
          has_session_row: !!sessionCheck,
          ...(sessionError ? formatDebugError(sessionError) : {}),
        });
        // Fall through to queue the event anyway
      }
    } else {
      console.log('📱 Offline mode or offline session - will queue event');
      captureMatchDebug('match_event_offline_mode', {
        debug_id: eventDebugId,
        is_online: isOnline,
        is_offline_session: isOfflineSession,
      });
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

    // Calculate current scores - use new score if provided, otherwise use current state
    const currentFencerAScore = scoringEntity === 'fencerA' && newScore !== undefined 
      ? newScore 
      : scores.fencerA;
    const currentFencerBScore = scoringEntity === 'fencerB' && newScore !== undefined 
      ? newScore 
      : scores.fencerB;

    // Calculate score_diff based on user toggle and position
    let scoreDiff: number | null = null;
    if (showUserProfile && user) {
      // User toggle is on - calculate from user's perspective
      const userEntity = toggleCardPosition === 'left' 
        ? getEntityAtPosition('left') 
        : getEntityAtPosition('right');
      const opponentEntity = userEntity === 'fencerA' ? 'fencerB' : 'fencerA';
      
      const userScore = currentFencerAScore; // This will be updated based on which entity is user
      const opponentScore = currentFencerBScore; // This will be updated based on which entity is opponent
      
      // Actually calculate based on entity positions
      const userScoreValue = userEntity === 'fencerA' ? currentFencerAScore : currentFencerBScore;
      const opponentScoreValue = opponentEntity === 'fencerA' ? currentFencerAScore : currentFencerBScore;
      scoreDiff = userScoreValue - opponentScoreValue;
      
      console.log('🔍 Score diff calculation:', {
        showUserProfile,
        toggleCardPosition,
        userEntity,
        opponentEntity,
        fencerAScore: currentFencerAScore,
        fencerBScore: currentFencerBScore,
        userScore: userScoreValue,
        opponentScore: opponentScoreValue,
        scoreDiff,
        usingNewScore: scoringEntity !== undefined && newScore !== undefined
      });
    }
    // If user toggle is off, score_diff remains null

    // Calculate actual match time elapsed (excluding paused time)
    const totalElapsed = now.getTime() - (matchStartTime?.getTime() || now.getTime());
    const actualMatchTimeMs = totalElapsed - totalPausedTime;
    
    // Use the actual match timer time instead of wall clock time
    // matchTime is the total match duration per period (e.g., 180 seconds)
    // timeRemaining is how much time is left on the timer for the current period
    // Need to account for completed periods, but only count periods that were actually played
    // Query match_period table to determine which periods were actually played (have start_time)
    // This ensures we don't add time for skipped periods (e.g., if user started on period 2)
    // If timer hasn't started yet (hasMatchStarted is false), use 0
    // For Epee double hits, if timer is paused, use the last known elapsed time
    let matchTimeElapsed = 0;
    if (hasMatchStarted) {
      // Query match_period table to see which periods were actually played
      // This ensures we don't add time for skipped periods (e.g., if user started on period 2)
      let actualCompletedPeriods = 0;
      let actualCompletedPeriodsTime = 0;
      
      if (currentMatchPeriod?.match_id) {
        try {
          const { data: periodsData } = await postgrestSelect<{
            period_number: number | null;
            start_time: string | null;
          }>(
            'match_period',
            {
              select: 'period_number,start_time',
              match_id: `eq.${currentMatchPeriod.match_id}`,
              order: 'period_number.asc',
            },
            accessToken ? { accessToken } : { allowAnon: true }
          );
          
          const matchPeriods = periodsData || [];
          
          // Count periods that were actually played (have start_time)
          const actualPeriodsPlayed = matchPeriods.filter(p => p.start_time) || [];
          actualCompletedPeriods = Math.max(0, actualPeriodsPlayed.length - 1); // Exclude current period
          actualCompletedPeriodsTime = actualCompletedPeriods * matchTime;
          
          console.log('🕐 [MATCH TIME ELAPSED] Period calculation:', {
            matchId: currentMatchPeriod.match_id,
            currentPeriod,
            matchPeriods: matchPeriods.map(p => ({ period_number: p.period_number, hasStartTime: !!p.start_time })),
            actualPeriodsPlayed: actualPeriodsPlayed.map(p => p.period_number),
            actualCompletedPeriods,
            actualCompletedPeriodsTime
          });
        } catch (error) {
          console.warn('⚠️ Error querying match_period table, falling back to currentPeriod calculation:', error);
          // Fallback to original calculation if query fails
          actualCompletedPeriods = currentPeriod - 1;
          actualCompletedPeriodsTime = actualCompletedPeriods * matchTime;
        }
      } else {
        // Fallback if no match_id available
        actualCompletedPeriods = currentPeriod - 1;
        actualCompletedPeriodsTime = actualCompletedPeriods * matchTime;
      }
      
      // Calculate elapsed time for current period
      const currentPeriodElapsed = matchTime - timeRemaining;
      
      // Total = actual completed periods + current period
      matchTimeElapsed = Math.max(0, actualCompletedPeriodsTime + currentPeriodElapsed);
    } else if (matchStartTime) {
      // Timer hasn't started but match has (edge case), calculate from start time
      const totalElapsedFromStart = now.getTime() - matchStartTime.getTime();
      const actualMatchTimeMsFromStart = totalElapsedFromStart - totalPausedTime;
      matchTimeElapsed = Math.max(0, Math.floor(actualMatchTimeMsFromStart / 1000));
    }
    
    // For sabre (no timer), force a monotonic elapsed counter so each touch is unique
    if (selectedWeapon === 'sabre') {
      const nextSabreElapsed = Math.max(matchTimeElapsed, sabreElapsedRef.current + 1);
      matchTimeElapsed = nextSabreElapsed;
      sabreElapsedRef.current = nextSabreElapsed;
    }
    
    
    // Display the time elapsed that will be used for x-axis
    const minutes = Math.floor(matchTimeElapsed / 60);
    const seconds = matchTimeElapsed % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    console.log(`🕐 TIME ELAPSED FOR X-AXIS: ${timeString} (${matchTimeElapsed} seconds)`);
    
    // Determine the actual scorer name - use entity-based logic (not position-based)
    // Events store fencer_1_name and fencer_2_name based on entity identity, not position
    const leftEntity = getEntityAtPosition('left');
    const rightEntity = getEntityAtPosition('right');
    // Use isEntityUser to correctly identify which entity is the user (not which position)
    const leftIsUser = showUserProfile && isEntityUser(leftEntity);
    const rightIsUser = showUserProfile && isEntityUser(rightEntity);
    // Store names based on entity identity: fencer_1 = left entity, fencer_2 = right entity
    const fencer1Name = leftIsUser ? userDisplayName : getNameByEntity(leftEntity);
    const fencer2Name = rightIsUser ? userDisplayName : getNameByEntity(rightEntity);
    
    // Determine who actually scored - use entity-based logic
    let scoringUserName;
    if (showUserProfile) {
      // User vs opponent mode: use entity-based logic to determine scorer name
      const actualScoringEntity = scoringEntity || (scorer === 'user' ? userEntity : (userEntity === 'fencerA' ? 'fencerB' : 'fencerA'));
      scoringUserName = isEntityUser(actualScoringEntity) ? userDisplayName : getNameByEntity(actualScoringEntity);
    } else {
      // Anonymous mode: use scoringEntity to determine actual fencer
      if (scoringEntity) {
        scoringUserName = getNameByEntity(scoringEntity);
      } else {
        // Fallback - shouldn't happen
        scoringUserName = getNameByEntity('fencerA');
      }
    }
    
    
    // Display the complete scoring event information
    console.log(`🎯 SCORING EVENT: ${scoringUserName} scored at ${timeString} (${matchTimeElapsed}s elapsed)`);
    console.log(`🎯 SCORING DEBUG: scorer="${scorer}", showUserProfile=${showUserProfile}, toggleCardPosition="${toggleCardPosition}"`);
    console.log(`🎯 SCORING DEBUG: fencer1Name="${fencer1Name}", fencer2Name="${fencer2Name}"`);
    console.log(`🎯 SCORING DEBUG: scoringEntity="${scoringEntity}", newScore=${newScore}, fencerAScore=${currentFencerAScore}, fencerBScore=${currentFencerBScore}`);

    // Build a canonical event payload we can queue or send immediately
    // Cards should never be stored as touches; force event type to "card" when a card is given
    const finalEventType = cardGiven ? 'card' : eventType;

    const { event_uuid, event_sequence } = buildEventIdentity();
    const baseEvent = {
      event_uuid,
      event_sequence,
      match_id: effectivePeriod?.match_id || null,
      match_period_id: effectivePeriod?.match_period_id || null,
      fencing_remote_id: activeSession.remote_id,
      event_time: now.toISOString(),
      event_type: finalEventType,
      scoring_user_id: scorer === 'user' ? user?.id : null,
      scoring_user_name: scoringUserName,
      scoring_entity: scoringEntity || null,
      fencer_1_name: fencer1Name,
      fencer_2_name: fencer2Name,
      card_given: cardGiven || null,
      score_diff: scoreDiff,
      seconds_since_last_event: secondsSinceLastEvent,
      reset_segment: resetSegmentRef.current,
      match_time_elapsed: matchTimeElapsed
    };
    if (scoringEntity) {
      recentScoringEventUuidsRef.current = {
        ...recentScoringEventUuidsRef.current,
        [scoringEntity]: event_uuid,
      };
    }
    captureMatchDebug('match_event_payload_ready', {
      debug_id: eventDebugId,
      event_type: finalEventType,
      scoring_entity: scoringEntity || null,
      score_diff: scoreDiff,
      match_time_elapsed: matchTimeElapsed,
      has_match_id: !!baseEvent.match_id,
      event_uuid,
    });

    // If match_id isn't ready yet (common on very first sabre touch), queue and replay once created
    if (!effectivePeriod?.match_id) {
      pendingTouchQueueRef.current.push({
        baseEvent,
        scorer,
        scoringEntity,
        isOfflineSession,
        queuedAt: now.toISOString(),
      });
      console.log('⏸️ Queued touch until match_id exists', {
        queueLength: pendingTouchQueueRef.current.length,
        match_time_elapsed: matchTimeElapsed,
        scorer: scoringUserName,
      });
      captureMatchDebug('match_event_deferred_missing_match_id', {
        debug_id: eventDebugId,
        queue_length: pendingTouchQueueRef.current.length,
        match_time_elapsed: matchTimeElapsed,
      });
      setLastEventTime(now); // maintain elapsed calculations for subsequent touches
      return;
    }

    void appendLocalMatchEvent(baseEvent);

    // Use offline service to record event (works online and offline)
    let queuedEventId: string | null = null;
    try {
      queuedEventId = await offlineRemoteService.recordEvent({
        remote_id: activeSession.remote_id,
        event_uuid,
        event_sequence,
        event_type: finalEventType,
        scoring_user_name: scoringUserName,
        match_time_elapsed: matchTimeElapsed,
        event_time: baseEvent.event_time,
        metadata: {
          match_id: baseEvent.match_id,
          match_period_id: baseEvent.match_period_id,
          scoring_user_id: baseEvent.scoring_user_id,
          scoring_entity: baseEvent.scoring_entity,
          fencer_1_name: baseEvent.fencer_1_name,
          fencer_2_name: baseEvent.fencer_2_name,
          card_given: baseEvent.card_given,
          reset_segment: baseEvent.reset_segment,
          score_diff: baseEvent.score_diff,
          seconds_since_last_event: baseEvent.seconds_since_last_event,
        }
      });
      captureMatchDebug('match_event_queued', {
        debug_id: eventDebugId,
        queued_event_id: queuedEventId,
        event_type: finalEventType,
      });
    } catch (error) {
      console.error('❌ Error queueing match event:', error);
      captureMatchDebug('match_event_queue_error', {
        debug_id: eventDebugId,
        ...formatDebugError(error),
      });
    }
    
    // Also try to create via matchEventService if online and match exists (for immediate sync)
    if (isOnline && !isOfflineSession && effectivePeriod?.match_id) {
      try {
        captureMatchDebug('match_event_online_insert_attempt', {
          debug_id: eventDebugId,
          has_access_token: !!accessToken,
        });
        // Verify match and remote session still exist before creating event
        // This prevents foreign key violations if reset was called during async operations
        const { data: matchCheck, error: matchError } = await postgrestSelectOne<{ match_id: string }>(
          'match',
          {
            select: 'match_id',
            match_id: `eq.${effectivePeriod.match_id}`,
            limit: 1,
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );
        
        const { data: remoteCheck, error: remoteError } = await postgrestSelectOne<{ remote_id: string }>(
          'fencing_remote',
          {
            select: 'remote_id',
            remote_id: `eq.${activeSession.remote_id}`,
            limit: 1,
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );
        
        // Only create event if both match and remote session still exist
        if (!matchError && matchCheck && !remoteError && remoteCheck) {
          const { event_sequence, ...eventData } = {
            ...baseEvent,
            match_id: effectivePeriod.match_id,
            match_period_id: effectivePeriod.match_period_id || null,
          };
          const createdEvent = await matchEventService.createMatchEvent(eventData, accessToken);
          
          // If creation failed (e.g., FK), leave it to the queued offline event to sync later
          if (!createdEvent) {
            console.log('⚠️ Match event creation deferred (FK or missing match), will sync from queue');
            captureMatchDebug('match_event_online_insert_null', {
              debug_id: eventDebugId,
              reason: accessToken ? 'insert_returned_null' : 'missing_access_token',
            });
            return;
          }
          if (queuedEventId) {
            await offlineCache.removePendingRemoteEvent(queuedEventId);
          }
          
          console.log('✅ Event created immediately (online, with match_id)');
          captureMatchDebug('match_event_online_insert_success', {
            debug_id: eventDebugId,
            match_event_id: createdEvent.match_event_id || null,
          });
          
          // Track the event ID for cancellation purposes
          if (createdEvent.match_event_id && scoringEntity) {
            setRecentScoringEventIds(prev => ({
              ...prev,
              [scoringEntity]: createdEvent.match_event_id
            }));
            console.log(`📌 Tracked scoring event ID for ${scoringEntity}:`, createdEvent.match_event_id);
          }
        } else {
          console.log('⚠️ Match or remote session no longer exists (likely reset), event already queued for sync');
          captureMatchDebug('match_event_online_insert_skipped', {
            debug_id: eventDebugId,
            reason: 'match_or_remote_missing',
            has_match: !!matchCheck,
            has_remote: !!remoteCheck,
            ...(matchError ? { match_error: formatDebugError(matchError) } : {}),
            ...(remoteError ? { remote_error: formatDebugError(remoteError) } : {}),
          });
          // Event is already queued via offlineRemoteService.recordEvent above, so no action needed
        }
      } catch (error: any) {
        // Check if this is a foreign key violation - if so, it's expected and already handled
        const isForeignKeyError = error?.code === '23503' || 
                                  error?.message?.includes('foreign key constraint') ||
                                  error?.message?.includes('violates foreign key');
        
        if (isForeignKeyError) {
          console.log('⚠️ Match or remote session no longer exists (foreign key violation), event already queued for sync');
        } else {
          console.error('❌ Error creating match event immediately:', error);
        }
        captureMatchDebug('match_event_online_insert_error', {
          debug_id: eventDebugId,
          is_foreign_key_error: isForeignKeyError,
          ...formatDebugError(error),
        });
        // Event is already queued via offlineRemoteService.recordEvent above, so no action needed
      }
    }
    
    setLastEventTime(now);
  };

  // Create remote session if it doesn't exist (now uses offline service)
  const ensureRemoteSession = async (overrideNames?: { fencerA?: string; fencerB?: string }) => {
    if (remoteSession) return remoteSession;
    
    if (!user) {
      console.log('❌ No user - cannot create remote session');
      return null;
    }

    try {
      console.log('Creating remote session (offline-capable)...');
      const fencerAName = overrideNames?.fencerA ?? getLockedAdjustedName('fencerA');
      const fencerBName = overrideNames?.fencerB ?? getLockedAdjustedName('fencerB');
      const result = await offlineRemoteService.createRemoteSession({
        referee_id: user.id,
        fencer_1_id: showUserProfile ? user.id : undefined, // Only set fencer_1_id if user toggle is on
        fencer_1_name: showUserProfile ? userDisplayName : fencerAName, // Use fencerA when user toggle is off
        fencer_2_name: fencerBName, // Always fencerB for fencer 2
        scoring_mode: "15-point",
        device_serial: "REMOTE_001",
        weapon: selectedWeapon // Include selected weapon type
      });
      
      // Get the full session from cache (offlineRemoteService returns minimal object)
      const session = await offlineRemoteService.getActiveSession();
      if (session) {
        // Convert to format expected by rest of the code
        const sessionForState = {
          remote_id: session.remote_id,
          referee_id: session.referee_id,
          fencer_1_id: session.fencer_1_id,
          fencer_2_id: session.fencer_2_id,
          fencer_1_name: session.fencer_1_name,
          fencer_2_name: session.fencer_2_name,
          score_1: session.score_1,
          score_2: session.score_2,
          status: session.status,
          weapon_type: session.weapon_type || selectedWeapon, // Use weapon_type from session or fallback to selectedWeapon
        };
        
        // Update selectedWeapon if session has a weapon_type
        if (session.weapon_type && session.weapon_type !== selectedWeapon) {
          // Normalize 'saber' to 'sabre' for consistency
          const normalizedWeapon = session.weapon_type === 'saber' ? 'sabre' : session.weapon_type;
          setSelectedWeapon(normalizedWeapon as 'foil' | 'epee' | 'sabre');
        }
        
        console.log(`Remote session created: ${session.remote_id} (${result.is_offline ? 'OFFLINE' : 'ONLINE'})`);
        setRemoteSession(sessionForState);
        return sessionForState;
      }
      
      return null;
    } catch (error) {
      console.error('Error creating remote session:', error);
      return null;
    }
  };

  // Create a new match period (now offline-capable)
  const createMatchPeriod = async (session?: any, playClickTime?: string) => {
    const activeSession = session || remoteSession;
    if (!activeSession) {
      console.log('❌ No remote session - cannot create match period');
      return null;
    }

    try {
      // Get entities at current positions (these are stable identifiers: fencerA or fencerB)
      // These entities can swap positions, but their identities remain stable
      const leftEntity = getEntityAtPosition('left');
      const rightEntity = getEntityAtPosition('right');
      
      // Use entity-based helpers to get scores/cards at current positions
      // These helpers dynamically check current positions, so swapping is handled correctly
      // Database columns: fencer_1 = left position, fencer_2 = right position (position-based, not entity-based)
      const scoreForFencer1DB = getScoreByPosition('left'); // Gets score of entity currently at left → maps to fencer_1_score
      const scoreForFencer2DB = getScoreByPosition('right'); // Gets score of entity currently at right → maps to fencer_2_score
      const cardsForFencer1DB = getCardsByPosition('left'); // Gets cards of entity currently at left → maps to fencer_1_cards
      const cardsForFencer2DB = getCardsByPosition('right'); // Gets cards of entity currently at right → maps to fencer_2_cards
      
      console.log('🔄 Creating match period...', { 
        currentPeriod, 
        leftEntity, // Entity at left (fencerA or fencerB)
        rightEntity, // Entity at right (fencerA or fencerB)
        fencerAScore: scores.fencerA, // Entity-based score
        fencerBScore: scores.fencerB, // Entity-based score
        scoreForFencer1DB, // Score for DB column (position-based)
        scoreForFencer2DB // Score for DB column (position-based)
      });
      
      const isOnline = await networkService.isOnline();
      const isOfflineSession = activeSession.remote_id?.startsWith('offline_');
      
      // For offline sessions or when offline, we'll create match later on sync
      if (isOfflineSession || !isOnline) {
        console.log('📱 Offline mode - match will be created on sync. Continuing with local state...');
        
        // Create a mock period object for local state (won't be saved to DB until sync)
        // Database columns: fencer_1 = left position, fencer_2 = right position (position-based, not entity-based)
        const mockPeriod = {
          match_period_id: `offline_period_${Date.now()}`,
          match_id: `offline_match_${Date.now()}`,
          period_number: currentPeriod,
          start_time: playClickTime || new Date().toISOString(),
          fencer_1_score: scoreForFencer1DB, // Score of entity currently at left (dynamic, handles swaps)
          fencer_2_score: scoreForFencer2DB, // Score of entity currently at right (dynamic, handles swaps)
          fencer_1_cards: cardsForFencer1DB.yellow + cardsForFencer1DB.red, // Cards of entity currently at left (dynamic, handles swaps)
          fencer_2_cards: cardsForFencer2DB.yellow + cardsForFencer2DB.red, // Cards of entity currently at right (dynamic, handles swaps)
        };
        
        console.log('✅ Mock period created for offline match:', mockPeriod.match_period_id);
        setCurrentMatchPeriod(mockPeriod);
        setMatchId(mockPeriod.match_id);
        return mockPeriod;
      }
      
      // Online mode - create match in database
      // First, create a match record from the remote session
      // Only pass user.id if showUserProfile is true (user toggle is on)
      const userId = showUserProfile && user ? user.id : null;
      // Ensure activeSession has weapon_type for match creation
      const sessionWithWeapon = {
        ...activeSession,
        weapon_type: activeSession.weapon_type || selectedWeapon || 'foil'
      };
      const match = await matchService.createMatchFromRemote(sessionWithWeapon, userId);
      if (!match) {
        console.error('❌ Failed to create match record');
        return null;
      }
      
      // Validate that we got a valid match_id back
      if (!match.match_id) {
        console.error('❌ Match created but no match_id returned. Cannot create match period.');
        if (userId === null) {
          console.error('💡 This is an anonymous match. Make sure the create_anonymous_match RPC function exists in Supabase.');
        }
        return null;
      }
      
      console.log('✅ Match created:', match.match_id);
      
      // Use the exact time when Play was clicked as match start time
      const matchStartTime = playClickTime || new Date().toISOString();
      console.log('🕐 Setting match period start time to Play click time:', matchStartTime);
      
      // Now create the match period with the proper match_id
      // Database columns: fencer_1 = left position, fencer_2 = right position (position-based, not entity-based)
      const periodData = {
        match_id: match.match_id, // Use the actual match_id from the match table
        period_number: currentPeriod, // Use currentPeriod instead of periodNumber
        start_time: matchStartTime, // Use current time when Play is clicked
        fencer_1_score: scoreForFencer1DB, // Score of entity currently at left (dynamic, handles swaps)
        fencer_2_score: scoreForFencer2DB, // Score of entity currently at right (dynamic, handles swaps)
        fencer_1_cards: cardsForFencer1DB.yellow + cardsForFencer1DB.red, // Cards of entity currently at left (dynamic, handles swaps)
        fencer_2_cards: cardsForFencer2DB.yellow + cardsForFencer2DB.red, // Cards of entity currently at right (dynamic, handles swaps)
        priority_assigned: priorityFencer || undefined, // Entity-based: 'fencerA' | 'fencerB' (stable identifier)
        priority_to: priorityFencer ? getNameByEntity(priorityFencer) : undefined, // Entity-based name (stable identifier)
      };
      
      console.log('🔄 Creating match period with data:', periodData);
      const period = await matchPeriodService.createMatchPeriod(periodData);
      
      if (period) {
        console.log('✅ Match period created successfully:', period);
        setCurrentMatchPeriod(period);
        setMatchId(period.match_id); // Store match ID safely
        currentMatchPeriodRef.current = period; // Keep synchronous ref up to date
        // Immediately flush any queued touches that were waiting for match_id/period
        flushQueuedTouches();
        return period;
      } else {
        console.error('❌ Failed to create match period');
        return null;
      }
    } catch (error) {
      console.error('❌ Error creating match period:', error);
      // If online creation fails, fall back to offline mode
      console.log('⚠️ Falling back to offline mode...');
      // Recompute values using entity-based helpers (these dynamically check current positions, so swaps are handled)
      // Database columns: fencer_1 = left position, fencer_2 = right position (position-based, not entity-based)
      const scoreForFencer1DBFallback = getScoreByPosition('left'); // Gets score of entity currently at left
      const scoreForFencer2DBFallback = getScoreByPosition('right'); // Gets score of entity currently at right
      const cardsForFencer1DBFallback = getCardsByPosition('left'); // Gets cards of entity currently at left
      const cardsForFencer2DBFallback = getCardsByPosition('right'); // Gets cards of entity currently at right
      
      const mockPeriod = {
        match_period_id: `offline_period_${Date.now()}`,
        match_id: `offline_match_${Date.now()}`,
        period_number: currentPeriod,
        start_time: playClickTime || new Date().toISOString(),
        fencer_1_score: scoreForFencer1DBFallback, // Score of entity currently at left (dynamic, handles swaps)
        fencer_2_score: scoreForFencer2DBFallback, // Score of entity currently at right (dynamic, handles swaps)
        fencer_1_cards: cardsForFencer1DBFallback.yellow + cardsForFencer1DBFallback.red, // Cards of entity currently at left (dynamic, handles swaps)
        fencer_2_cards: cardsForFencer2DBFallback.yellow + cardsForFencer2DBFallback.red, // Cards of entity currently at right (dynamic, handles swaps)
      };
      setCurrentMatchPeriod(mockPeriod);
      setMatchId(mockPeriod.match_id);
      return mockPeriod;
    }
  };

  // Update current match period with latest scores and cards
  const updateCurrentPeriod = async () => {
    if (!currentMatchPeriod) return;

    try {
      // Use entity-based helpers to get current scores/cards (these dynamically check current positions, so swaps are handled)
      // Database columns: fencer_1 = left position, fencer_2 = right position (position-based, not entity-based)
      const scoreForFencer1DB = getScoreByPosition('left'); // Gets score of entity currently at left → maps to fencer_1_score
      const scoreForFencer2DB = getScoreByPosition('right'); // Gets score of entity currently at right → maps to fencer_2_score
      const cardsForFencer1DB = getCardsByPosition('left'); // Gets cards of entity currently at left → maps to fencer_1_cards
      const cardsForFencer2DB = getCardsByPosition('right'); // Gets cards of entity currently at right → maps to fencer_2_cards
      
      await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
        fencer_1_score: scoreForFencer1DB, // Score of entity currently at left (dynamic, handles swaps)
        fencer_2_score: scoreForFencer2DB, // Score of entity currently at right (dynamic, handles swaps)
        fencer_1_cards: cardsForFencer1DB.yellow + cardsForFencer1DB.red, // Cards of entity currently at left (dynamic, handles swaps)
        fencer_2_cards: cardsForFencer2DB.yellow + cardsForFencer2DB.red, // Cards of entity currently at right (dynamic, handles swaps)
        priority_assigned: priorityFencer || undefined, // Entity-based: 'fencerA' | 'fencerB' (stable identifier)
        priority_to: priorityFencer ? getNameByEntity(priorityFencer) : undefined, // Entity-based name (stable identifier)
        timestamp: new Date().toISOString(), // Update timestamp when period is updated
      }, accessToken);
    } catch (error) {
      console.error('Error updating match period:', error);
    }
  };

  // Helper function to track priority winner events
  const trackPriorityWinner = async (winnerName: string) => {
    if (!matchId) {
      console.error('Cannot track priority winner: no match ID');
      return;
    }

    try {
      // Verify match exists before creating event
      const { data: matchCheck, error: matchError } = await postgrestSelectOne<{ match_id: string }>(
        'match',
        {
          select: 'match_id',
          match_id: `eq.${matchId}`,
          limit: 1,
        },
        accessToken ? { accessToken } : { allowAnon: true }
      );
      
      if (matchError || !matchCheck) {
        console.log('⚠️ Match no longer exists, skipping priority winner event');
        return;
      }

      // Check if priority winner event already exists for this match
      const { data: existingEvent } = await postgrestSelectOne<{ event_id: string }>(
        'match_event',
        {
          select: 'event_id',
          match_id: `eq.${matchId}`,
          event_type: 'eq.priority_winner',
          limit: 1,
        },
        accessToken ? { accessToken } : { allowAnon: true }
      );

      if (existingEvent) {
        console.log('⚠️ Priority winner event already exists for this match, skipping creation');
        return;
      }

      // Build event data, optionally including fencing_remote_id if session exists and is verified
      const eventData: any = {
        match_id: matchId,
        event_type: 'priority_winner',
        event_time: new Date().toISOString(),
        scoring_user_name: winnerName,
        fencer_1_name: fencerNames.fencerA,
        fencer_2_name: fencerNames.fencerB,
        reset_segment: resetSegmentRef.current,
      };

      // Only include fencing_remote_id if remote session exists and is verified
      if (remoteSession?.remote_id) {
        const { data: remoteCheck, error: remoteError } = await postgrestSelectOne<{ remote_id: string }>(
          'fencing_remote',
          {
            select: 'remote_id',
            remote_id: `eq.${remoteSession.remote_id}`,
            limit: 1,
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );
        
        if (!remoteError && remoteCheck) {
          eventData.fencing_remote_id = remoteSession.remote_id;
        } else {
          console.log('⚠️ Remote session not found in database, creating event without fencing_remote_id');
        }
      }

      const createdEvent = await matchEventService.createMatchEvent(eventData, accessToken);
      
      if (!createdEvent) {
        console.log('⚠️ Priority winner event creation failed (match may have been deleted)');
        return;
      }
      
      console.log('✅ Priority winner event created:', winnerName);
    } catch (error: any) {
      const isForeignKeyError = error?.code === '23503' || 
                                error?.message?.includes('foreign key constraint') ||
                                error?.message?.includes('violates foreign key');
      
      if (isForeignKeyError) {
        console.log('⚠️ Match no longer exists (foreign key violation), skipping priority winner event');
      } else {
        console.error('❌ Error creating priority winner event:', error);
      }
    }
  };

  // Helper function to track priority round start
  const trackPriorityRoundStart = async () => {
    if (!matchId) {
      console.error('Cannot track priority round start: no match ID');
      return;
    }

    try {
      // Verify match exists before creating event
      const { data: matchCheck, error: matchError } = await postgrestSelectOne<{ match_id: string }>(
        'match',
        {
          select: 'match_id',
          match_id: `eq.${matchId}`,
          limit: 1,
        },
        accessToken ? { accessToken } : { allowAnon: true }
      );
      
      if (matchError || !matchCheck) {
        console.log('⚠️ Match no longer exists, skipping priority round start event');
        return;
      }

      // Build event data, optionally including fencing_remote_id if session exists and is verified
      const eventData: any = {
        match_id: matchId,
        event_type: 'priority_round_start',
        event_time: new Date().toISOString(),
        fencer_1_name: fencerNames.fencerA,
        fencer_2_name: fencerNames.fencerB,
        reset_segment: resetSegmentRef.current,
      };

      // Only include fencing_remote_id if remote session exists and is verified
      if (remoteSession?.remote_id) {
        const { data: remoteCheck, error: remoteError } = await postgrestSelectOne<{ remote_id: string }>(
          'fencing_remote',
          {
            select: 'remote_id',
            remote_id: `eq.${remoteSession.remote_id}`,
            limit: 1,
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );
        
        if (!remoteError && remoteCheck) {
          eventData.fencing_remote_id = remoteSession.remote_id;
        } else {
          console.log('⚠️ Remote session not found in database, creating event without fencing_remote_id');
        }
      }

      const createdEvent = await matchEventService.createMatchEvent(eventData, accessToken);
      
      if (!createdEvent) {
        console.log('⚠️ Priority round start event creation failed (match may have been deleted)');
        return;
      }
      
      console.log('✅ Priority round start event created');
    } catch (error: any) {
      const isForeignKeyError = error?.code === '23503' || 
                                error?.message?.includes('foreign key constraint') ||
                                error?.message?.includes('violates foreign key');
      
      if (isForeignKeyError) {
        console.log('⚠️ Match no longer exists (foreign key violation), skipping priority round start event');
      } else {
        console.error('❌ Error creating priority round start event:', error);
      }
    }
  };

  // Helper function to track priority round end
  const trackPriorityRoundEnd = async (winnerName: string) => {
    if (!matchId) {
      console.error('Cannot track priority round end: no match ID');
      return;
    }

    try {
      // Verify match exists before creating event
      const { data: matchCheck, error: matchError } = await postgrestSelectOne<{ match_id: string }>(
        'match',
        {
          select: 'match_id',
          match_id: `eq.${matchId}`,
          limit: 1,
        },
        accessToken ? { accessToken } : { allowAnon: true }
      );
      
      if (matchError || !matchCheck) {
        console.log('⚠️ Match no longer exists, skipping priority round end event');
        return;
      }

      // Check if priority round end event already exists for this match
      const { data: existingEvent } = await postgrestSelectOne<{ event_id: string }>(
        'match_event',
        {
          select: 'event_id',
          match_id: `eq.${matchId}`,
          event_type: 'eq.priority_round_end',
          limit: 1,
        },
        accessToken ? { accessToken } : { allowAnon: true }
      );

      if (existingEvent) {
        console.log('⚠️ Priority round end event already exists for this match, skipping creation');
        return;
      }

      // Build event data, optionally including fencing_remote_id if session exists and is verified
      const eventData: any = {
        match_id: matchId,
        event_type: 'priority_round_end',
        event_time: new Date().toISOString(),
        scoring_user_name: winnerName,
        fencer_1_name: fencerNames.fencerA,
        fencer_2_name: fencerNames.fencerB,
        reset_segment: resetSegmentRef.current,
      };

      // Only include fencing_remote_id if remote session exists and is verified
      if (remoteSession?.remote_id) {
        const { data: remoteCheck, error: remoteError } = await postgrestSelectOne<{ remote_id: string }>(
          'fencing_remote',
          {
            select: 'remote_id',
            remote_id: `eq.${remoteSession.remote_id}`,
            limit: 1,
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );
        
        if (!remoteError && remoteCheck) {
          eventData.fencing_remote_id = remoteSession.remote_id;
        } else {
          console.log('⚠️ Remote session not found in database, creating event without fencing_remote_id');
        }
      }

      const createdEvent = await matchEventService.createMatchEvent(eventData, accessToken);
      
      if (!createdEvent) {
        console.log('⚠️ Priority round end event creation failed (match may have been deleted)');
        return;
      }
      
      console.log('✅ Priority round end event created:', winnerName);
    } catch (error: any) {
      const isForeignKeyError = error?.code === '23503' || 
                                error?.message?.includes('foreign key constraint') ||
                                error?.message?.includes('violates foreign key');
      
      if (isForeignKeyError) {
        console.log('⚠️ Match no longer exists (foreign key violation), skipping priority round end event');
      } else {
        console.error('❌ Error creating priority round end event:', error);
      }
    }
  };

  // Complete the current match
  const completeMatch = async () => {
    // Ensure we have a remote session and match period before completing
    let session = remoteSession;
    if (!session) {
      session = await ensureRemoteSession();
    }
    if (!session) {
      console.error('Cannot complete match: missing session (ensureRemoteSession failed)');
      return;
    }

    let period = currentMatchPeriod;
    if (!period) {
      // Create a period on the fly if somehow missing (safety net)
      const playClickTime = new Date().toISOString();
      period = await createMatchPeriod(session, playClickTime);
      if (!period) {
        console.error('Cannot complete match: failed to create match period');
        return;
      }
      setCurrentMatchPeriod(period);
      setMatchId(period.match_id || null);
    }

    // If in priority round, allow manual completion by ending priority mode and finishing with latest scores
    if (isPriorityRound) {
      console.log('⚠️ completeMatch called during priority round - finishing with current scores');
      setIsPriorityRound(false);
      setHasShownPriorityScorePopup(true);
      setPriorityRoundPeriod(null);
      setIsAssigningPriority(false);
      const latestScores = scoresRef.current;
      await proceedWithMatchCompletion(latestScores.fencerA, latestScores.fencerB);
      return;
    }

    // Not in priority round, proceed normally
    proceedWithMatchCompletion();
  };

  const proceedWithMatchCompletion = async (finalFencerAScore?: number, finalFencerBScore?: number) => {
    if (!matchId || !remoteSession) {
      console.error('Cannot complete match: missing match ID or session');
      return;
    }

    try {
      console.log('Completing match...');
      setIsCompletingMatch(true); // Prevent further score changes
      
      // Check if this is an offline match
      // Only treat as offline if BOTH the matchId AND remote_id start with 'offline_' AND we're currently offline
      // If we have a real match_id (not starting with 'offline_'), we should complete it online
      const isOfflineMatchId = matchId.startsWith('offline_');
      const isOfflineRemoteId = remoteSession.remote_id.startsWith('offline_');
      const isCurrentlyOffline = await networkService.isOnline().then(online => !online);
      
      // Only complete offline if: both IDs are offline AND we're currently offline
      // OR if we're currently offline (network unavailable)
      if ((isOfflineMatchId && isOfflineRemoteId && isCurrentlyOffline) || (isCurrentlyOffline && isOfflineMatchId)) {
        console.log('📱 Offline match completion detected - saving locally');
        await handleOfflineMatchCompletion(finalFencerAScore, finalFencerBScore);
        return;
      }
      
      // If we have a real match_id but remote_id is offline, try to complete online
      // This handles the case where session was created offline but match was created online
      if (!isOfflineMatchId && isOfflineRemoteId) {
        console.log('⚠️ Match has real match_id but remote_id is offline - attempting online completion');
        // Continue with online completion below
      }
      
      // Calculate total match duration: timer-based elapsed time (same calculation as events)
      // Query match_period table to determine which periods were actually played
      // This ensures we don't add time for skipped periods (e.g., if user started on period 2)
      // Timer stops when paused, so this excludes pauses automatically
      let matchDuration = 0;
      let matchPeriods: any[] | null = null;
      let actualPeriodsPlayed: any[] = [];
      
      if (hasMatchStarted) {
        // Query match_period table to see which periods were actually played
        const { data: periodsData } = await postgrestSelect<{
          period_number: number | null;
          start_time: string | null;
        }>(
          'match_period',
          {
            select: 'period_number,start_time',
            match_id: `eq.${currentMatchPeriod.match_id}`,
            order: 'period_number.asc',
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );
        
        matchPeriods = periodsData || null;
        
        // Count periods that were actually played (have start_time)
        actualPeriodsPlayed = matchPeriods?.filter(p => p.start_time) || [];
        const actualCompletedPeriods = Math.max(0, actualPeriodsPlayed.length - 1); // Exclude current period
        const actualCompletedPeriodsTime = actualCompletedPeriods * matchTime;
        
        // Calculate elapsed time for current period
        const currentPeriodElapsed = matchTime - timeRemaining;
        
        // Total = actual completed periods + current period
        matchDuration = Math.max(0, actualCompletedPeriodsTime + currentPeriodElapsed);
      } else if (matchStartTime) {
        // Fallback: if timer hasn't started but match has, use wall-clock time excluding pauses
        const completionTime = new Date();
        const totalElapsed = completionTime.getTime() - matchStartTime.getTime();
        const actualMatchTime = totalElapsed - totalPausedTime;
        matchDuration = Math.max(0, Math.floor(actualMatchTime / 1000)); // Convert to seconds
        console.warn('⚠️ Timer not started, using wall-clock fallback calculation');
      } else {
        // Fallback: if no start time, use period-based calculation (shouldn't happen normally)
        const completedPeriods = currentPeriod - 1;
        const currentPeriodElapsed = matchTime - timeRemaining;
        matchDuration = (completedPeriods * matchTime) + currentPeriodElapsed;
        console.warn('⚠️ No matchStartTime found, using fallback period-based calculation');
      }
      
      // Log the calculation details
      const logData: any = {
        hasMatchStarted,
        matchTime,
        timeRemaining,
        currentPeriod,
        calculatedDuration: matchDuration,
        formattedDuration: `${Math.floor(matchDuration / 60)}:${(matchDuration % 60).toString().padStart(2, '0')}`
      };
      
      if (hasMatchStarted && matchPeriods) {
        logData.matchPeriodsCount = matchPeriods.length;
        logData.actualPeriodsPlayed = actualPeriodsPlayed.length;
        logData.actualPeriodsPlayedNumbers = actualPeriodsPlayed.map(p => p.period_number);
        logData.actualCompletedPeriods = Math.max(0, actualPeriodsPlayed.length - 1);
        logData.actualCompletedPeriodsTime = Math.max(0, actualPeriodsPlayed.length - 1) * matchTime;
        logData.currentPeriodElapsed = matchTime - timeRemaining;
      } else {
        logData.matchStartTime = matchStartTime?.toISOString();
        logData.completionTime = new Date().toISOString();
        logData.totalElapsed = matchStartTime ? (new Date().getTime() - matchStartTime.getTime()) / 1000 : 0;
        logData.totalPausedTime = totalPausedTime / 1000;
      }
      
      console.log('🕐 Match duration calculation (timer-based elapsed time):', logData);
      
      // Determine result based on user_id presence
      let result: string | null = null;
      let finalScore: number;
      let touchesAgainst: number;
      let scoreDiff: number | null;

      // Use passed scores if provided, otherwise use the latest ref (prevents stale state during rapid finish)
      const actualFencerAScore = finalFencerAScore !== undefined ? finalFencerAScore : scoresRef.current.fencerA;
      const actualFencerBScore = finalFencerBScore !== undefined ? finalFencerBScore : scoresRef.current.fencerB;

      // Pre-compute position-based scores (reflects swaps) from the latest ref to avoid stale state
      const leftEntity = getEntityAtPosition('left');
      const rightEntity = getEntityAtPosition('right');
      const leftScoreLatest = leftEntity === 'fencerA' ? actualFencerAScore : actualFencerBScore; // Score of entity currently on left
      const rightScoreLatest = rightEntity === 'fencerA' ? actualFencerAScore : actualFencerBScore; // Score of entity currently on right

      if (user?.id && showUserProfile) {
        // User is registered AND toggle is on - determine their entity and result
        // Use entity-based logic (not position-based) since userEntity doesn't change when swapping
        const userScore = userEntity === 'fencerA' ? actualFencerAScore : actualFencerBScore;
        const opponentScore = userEntity === 'fencerA' ? actualFencerBScore : actualFencerAScore;

        finalScore = userScore;
        touchesAgainst = opponentScore;
        scoreDiff = userScore - opponentScore;
        result = userScore > opponentScore ? 'win' : 'loss';
      } else {
        // User toggle is off OR no registered user - record position-based scores so names stay aligned after swaps
        finalScore = leftScoreLatest;
        touchesAgainst = rightScoreLatest;
        scoreDiff = null; // No score_diff when no user is present
        result = null; // No win/loss determination
      }

      // IMPORTANT: End the current period FIRST before calculating touches by period
      // This ensures period 3 (or current period) has proper end_time for event assignment
      // Use position-based scores (not entity-based) to match database columns (fencer_1 = left, fencer_2 = right)
      const matchCompletionTime = new Date().toISOString();
      const leftCards = getCardsByPosition('left'); // Cards of entity currently on left (position-based)
      const rightCards = getCardsByPosition('right'); // Cards of entity currently on right (position-based)
      
      await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
        end_time: matchCompletionTime,
        fencer_1_score: leftScoreLatest, // Position-based: score of entity currently on left
        fencer_2_score: rightScoreLatest, // Position-based: score of entity currently on right
        fencer_1_cards: leftCards.yellow + leftCards.red, // Position-based: cards of entity currently on left
        fencer_2_cards: rightCards.yellow + rightCards.red, // Position-based: cards of entity currently on right
        timestamp: matchCompletionTime,
      }, accessToken);
      console.log('✅ Current period ended with completion time:', matchCompletionTime);

      // Calculate period-based data
      let touchesByPeriod;
      let periodNumber;
      let scoreSpp;
      let scoreByPeriod;

      if (user?.id && showUserProfile) {
        // User match - use existing logic
        const effectiveUserName = userDisplayName;
        touchesByPeriod = await matchService.calculateTouchesByPeriod(
          currentMatchPeriod.match_id,
          effectiveUserName,
          undefined,
          finalScore,
          touchesAgainst,
          accessToken
        );
        
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
        const { data: matchPeriods } = await postgrestSelect<{
          fencer_1_score: number | null;
          fencer_2_score: number | null;
          period_number: number | null;
        }>(
          'match_period',
          {
            select: 'fencer_1_score,fencer_2_score,period_number',
            match_id: `eq.${currentMatchPeriod.match_id}`,
            order: 'period_number.asc',
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );

        if (matchPeriods && matchPeriods.length > 0) {
          const firstPeriod = matchPeriods[0];
          const fencer1Score = firstPeriod?.fencer_1_score ?? 0;
          const fencer2Score = firstPeriod?.fencer_2_score ?? 0;
          // Use the actual period_number from the database (could be 1, 2, or 3)
          // This correctly handles cases where user skipped to period 2 or 3
          const actualPeriodNumber = firstPeriod?.period_number ?? 1;
          periodNumber = actualPeriodNumber;
          
          console.log('📊 [ANONYMOUS MATCH] Using actual period number:', {
            actualPeriodNumber,
            periodData: firstPeriod,
            allPeriods: matchPeriods.map(p => ({ period_number: p.period_number, fencer_1_score: p.fencer_1_score, fencer_2_score: p.fencer_2_score }))
          });
          
          // Calculate score per period based on actual period number
          scoreSpp = Math.round((fencer1Score + fencer2Score) / periodNumber);
          
          // Structure score by period data - only populate the period that was actually played
          scoreByPeriod = {
            period1: actualPeriodNumber === 1 ? { user: fencer1Score, opponent: fencer2Score } : { user: 0, opponent: 0 },
            period2: actualPeriodNumber === 2 ? { user: fencer1Score, opponent: fencer2Score } : { user: 0, opponent: 0 },
            period3: actualPeriodNumber === 3 ? { user: fencer1Score, opponent: fencer2Score } : { user: 0, opponent: 0 }
          };
          
          touchesByPeriod = {
            period1: actualPeriodNumber === 1 ? { user: fencer1Score, opponent: fencer2Score } : { user: 0, opponent: 0 },
            period2: actualPeriodNumber === 2 ? { user: fencer1Score, opponent: fencer2Score } : { user: 0, opponent: 0 },
            period3: actualPeriodNumber === 3 ? { user: fencer1Score, opponent: fencer2Score } : { user: 0, opponent: 0 }
          };
        } else {
          // Fallback if no period data
          periodNumber = 1;
          scoreSpp = Math.round((actualFencerAScore + actualFencerBScore) / periodNumber);
          
          scoreByPeriod = {
            period1: { user: actualFencerAScore, opponent: actualFencerBScore },
            period2: { user: 0, opponent: 0 },
            period3: { user: 0, opponent: 0 }
          };
          
          touchesByPeriod = {
            period1: { user: actualFencerAScore, opponent: actualFencerBScore },
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

      // Get current fencer names based on positions (handles swaps correctly)
      // Use isEntityUser to correctly identify which entity is the user (not which position)
      const leftIsUser = showUserProfile && isEntityUser(leftEntity);
      const rightIsUser = showUserProfile && isEntityUser(rightEntity);
      const currentFencer1Name = leftIsUser ? userDisplayName : getNameByEntity(leftEntity);
      const currentFencer2Name = rightIsUser ? userDisplayName : getNameByEntity(rightEntity);

      // 1. Update match with final scores, completion status, and current fencer names (reflects any swaps)
      // For Sabre: Calculate period and score_spp based on breakTriggered
      let finalPeriodNumber = periodNumber;
      let finalScoreSpp = scoreSpp;
      let finalScoreByPeriod = scoreByPeriod;
      
      if (selectedWeapon === 'sabre') {
        // Sabre: Period is 1 or 2 based on breakTriggered
        finalPeriodNumber = breakTriggered ? 2 : 1;
        // Calculate score_spp: finalScore / periodNumber
        const maxScore = Math.max(actualFencerAScore, actualFencerBScore);
        finalScoreSpp = finalPeriodNumber > 0 ? Math.round(maxScore / finalPeriodNumber) : 0;
        // Calculate score_by_period for sabre (only 2 periods)
        if (user?.id && showUserProfile) {
          finalScoreByPeriod = {
            period1: { user: touchesByPeriod.period1.user, opponent: touchesByPeriod.period1.opponent },
            period2: { user: touchesByPeriod.period2.user, opponent: touchesByPeriod.period2.opponent },
            period3: { user: 0, opponent: 0 } // Period 3 is empty for sabre
          };
        } else {
          // Anonymous match - use match_period data
          const { data: sabrePeriods } = await postgrestSelect<{
            fencer_1_score: number | null;
            fencer_2_score: number | null;
            period_number: number | null;
          }>(
            'match_period',
            {
              select: 'fencer_1_score,fencer_2_score,period_number',
              match_id: `eq.${currentMatchPeriod.match_id}`,
              order: 'period_number.asc',
            },
            accessToken ? { accessToken } : { allowAnon: true }
          );
          
          if (sabrePeriods && sabrePeriods.length > 0) {
            const period1Data = sabrePeriods.find(p => p.period_number === 1) || { fencer_1_score: 0, fencer_2_score: 0 };
            const period2Data = sabrePeriods.find(p => p.period_number === 2) || { fencer_1_score: 0, fencer_2_score: 0 };
            const period1User = period1Data.fencer_1_score ?? 0;
            const period1Opponent = period1Data.fencer_2_score ?? 0;
            const period2User = period2Data.fencer_1_score ?? 0;
            const period2Opponent = period2Data.fencer_2_score ?? 0;
            finalScoreByPeriod = {
              period1: { user: period1User, opponent: period1Opponent },
              period2: { user: period2User, opponent: period2Opponent },
              period3: { user: 0, opponent: 0 }
            };
          }
        }
      }
      
      const updatedMatch = await matchService.updateMatch(currentMatchPeriod.match_id, {
        final_score: finalScore,
        // touches_against is a generated column - don't set it explicitly
        result: result, // Will be 'win'/'loss' if user exists, null if no user
        score_diff: scoreDiff,
        bout_length_s: selectedWeapon === 'sabre' ? undefined : (matchDuration > 0 ? matchDuration : undefined), // undefined for sabre (NULL in database)
        yellow_cards: cards.fencerA.yellow + cards.fencerB.yellow,
        red_cards: cards.fencerA.red + cards.fencerB.red,
        is_complete: true, // Mark as complete
        period_number: finalPeriodNumber,
        score_spp: finalScoreSpp,
        score_by_period: finalScoreByPeriod,
        fencer_1_name: currentFencer1Name, // Update to reflect current positions (after any swaps)
        fencer_2_name: currentFencer2Name, // Update to reflect current positions (after any swaps)
        fencer_1_entity: leftEntity, // Stable entity for fencer_1 at completion
        fencer_2_entity: rightEntity, // Stable entity for fencer_2 at completion
        final_period: selectedWeapon === 'sabre' ? finalPeriodNumber : undefined, // Set final_period for sabre
      }, session?.access_token);

      let failedGoalData: any = null; // Declare in outer scope
      let completedGoalData: any = null; // Declare in outer scope for completed goals
      
      if (updatedMatch) {
        console.log('Match completed successfully:', updatedMatch);
        
        // Track match completion
        const winner =
          finalScore === touchesAgainst
            ? 'draw'
            : user?.id && showUserProfile
              ? (finalScore > touchesAgainst ? 'you' : 'opponent')
              : (finalScore > touchesAgainst ? 'left' : 'right');

        analytics.matchCompleted({
          mode: 'remote',
          duration_seconds: matchDuration,
          your_score: finalScore,
          opponent_score: touchesAgainst,
          winner,
          weapon_type: selectedWeapon,
          opponent_name: getOpponentNameForAnalytics(),
          is_offline: false,
          remote_id: remoteSession?.remote_id,
          match_id: currentMatchPeriod.match_id,
        });
        sessionTracker.incrementMatches();
        void trackOnce('first_match_completed', { mode: 'remote' }, user?.id);
        
        // Update goals if user is registered and match has a result
        if (user?.id && result) {
          console.log('🎯 Updating goals after match completion...');
          try {
            const goalResult = await goalService.updateGoalsAfterMatch(
              user.id,
              result as 'win' | 'loss',
              finalScore,
              touchesAgainst,
              session?.access_token
            );
            console.log('✅ Goals updated successfully:', goalResult);
            
            // Store completed goal info to pass through navigation
            if (goalResult.completedGoals && goalResult.completedGoals.length > 0) {
              completedGoalData = goalResult.completedGoals[0];
            }
            
            // Store failed goal info to pass through navigation
            if (goalResult.failedGoals && goalResult.failedGoals.length > 0) {
              failedGoalData = goalResult.failedGoals[0];
            }
          } catch (goalError) {
            console.error('❌ Error updating goals:', goalError);
          }
        }
      } else {
        // Track match completion failure
        analytics.matchCompleteFailure({ error_type: 'database_update_failed' });
      }

      // Note: Period end_time was already set above before calculating touches by period
      // This ensures proper event assignment to periods

      // 3. Match completion is tracked by is_complete in match table

      console.log('Match completion process finished');
      
      // 4. Navigate to appropriate match summary based on user toggle
      if (user?.id && showUserProfile) {
        // User is registered AND toggle is on - go to regular match summary
        // Use position-based names and scores (reflects any swaps) - these match what's in the database
        const leftScore = leftScoreLatest; // Score of entity currently on left
        const rightScore = rightScoreLatest; // Score of entity currently on right
        const leftCards = getCardsByPosition('left'); // Cards of entity currently on left
        const rightCards = getCardsByPosition('right'); // Cards of entity currently on right
        
        const navParams: any = {
          matchId: matchId, // Use stored match ID
          remoteId: remoteSession.remote_id,
          // Pass current match state for display (position-based to match names)
          aliceScore: leftScore.toString(), // Score of fencer on left (fencer1)
          bobScore: rightScore.toString(), // Score of fencer on right (fencer2)
          aliceCards: JSON.stringify(leftCards),
          bobCards: JSON.stringify(rightCards),
          matchDuration: matchDuration.toString(),
          result: result || '',
          fencer1Name: currentFencer1Name, // Use position-based names (left = fencer1)
          fencer2Name: currentFencer2Name, // Use position-based names (right = fencer2)
        };
        
        // Pass completed goal info if any
        if (completedGoalData) {
          navParams.completedGoalData = JSON.stringify(completedGoalData);
        }
        
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
        // Use position-based names and scores (reflects any swaps) - these match what's in the database
        const leftScore = leftScoreLatest; // Score of entity currently on left
        const rightScore = rightScoreLatest; // Score of entity currently on right
        const leftCards = getCardsByPosition('left'); // Cards of entity currently on left
        const rightCards = getCardsByPosition('right'); // Cards of entity currently on right
        
        router.push({
          pathname: '/neutral-match-summary',
          params: {
            matchId: matchId, // Use stored match ID
            remoteId: remoteSession.remote_id,
            // Pass current match state for display (position-based to match names)
            aliceScore: leftScore.toString(), // Score of fencer on left (fencer1)
            bobScore: rightScore.toString(), // Score of fencer on right (fencer2)
            aliceCards: JSON.stringify(leftCards),
            bobCards: JSON.stringify(rightCards),
            matchDuration: matchDuration.toString(),
            result: result || '',
            fencer1Name: currentFencer1Name, // Use position-based names (left = fencer1)
            fencer2Name: currentFencer2Name, // Use position-based names (right = fencer2)
          }
        });
      }

      // 5. Reset the remote to clean state after completion
      // The match data is now saved in the database and accessible elsewhere
      setCurrentMatchPeriod(null);
      setMatchId(null); // Clear stored match ID
      setRemoteSession(null);
      setScores({ fencerA: 0, fencerB: 0 });
      setCards({ fencerA: { yellow: 0, red: 0 }, fencerB: { yellow: 0, red: 0 } });
      setCurrentPeriod(1);
      weaponSelectionLockedRef.current = false;
      setSelectedWeapon(preferredWeaponRef.current);
          setTimeRemaining(matchTime);
    setIsPlaying(false);
    setPriorityFencer(null);
    setPriorityLightPosition(null);
      setIsAssigningPriority(false);
      setIsPriorityRound(false); // Reset priority round
      setHasShownPriorityScorePopup(false); // Reset priority popup flag
      setIsInjuryTimer(false);
      setIsBreakTime(false);
      setScoreChangeCount(0);
      setShowScoreWarning(false);
      setPendingScoreAction(null);
      setPreviousMatchState(null);
      setIsManualReset(false);
      setLastEventTime(null); // Reset event timing
      sabreElapsedRef.current = 0; // Reset sabre elapsed counter after completion
      
      // Save completed match state instead of clearing it
      const completedMatchState = {
        scores: { fencerA: actualFencerAScore, fencerB: actualFencerBScore },
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

  // Handle offline match completion
  const handleOfflineMatchCompletion = async (finalFencerAScore?: number, finalFencerBScore?: number) => {
    if (!remoteSession) {
      console.error('Cannot complete offline match: no remote session');
      setIsCompletingMatch(false);
      return;
    }

    try {
      // Calculate total match duration
      const completedPeriods = currentPeriod - 1;
      const currentPeriodElapsed = matchTime - timeRemaining;
      const matchDuration = (completedPeriods * matchTime) + currentPeriodElapsed;

      // Use passed scores if provided, otherwise use the latest ref (prevents stale state during rapid finish)
      const actualFencerAScore = finalFencerAScore !== undefined ? finalFencerAScore : scoresRef.current.fencerA;
      const actualFencerBScore = finalFencerBScore !== undefined ? finalFencerBScore : scoresRef.current.fencerB;

      // Determine result based on user_id presence
      let result: string | null = null;
      let finalScore: number;
      let touchesAgainst: number;
      let scoreDiff: number | null;

      // Position-based scores (reflect swaps) for anonymous saves, pulled from latest ref to avoid stale state
      const leftEntity = getEntityAtPosition('left');
      const rightEntity = getEntityAtPosition('right');
      const leftScoreLatest = leftEntity === 'fencerA' ? actualFencerAScore : actualFencerBScore;
      const rightScoreLatest = rightEntity === 'fencerA' ? actualFencerAScore : actualFencerBScore;

      if (user?.id && showUserProfile) {
        // User is registered AND toggle is on - determine their entity and result
        // Use entity-based logic (not position-based) since userEntity doesn't change when swapping
        const userScore = userEntity === 'fencerA' ? actualFencerAScore : actualFencerBScore;
        const opponentScore = userEntity === 'fencerA' ? actualFencerBScore : actualFencerAScore;

        finalScore = userScore;
        touchesAgainst = opponentScore;
        scoreDiff = userScore - opponentScore;
        result = userScore > opponentScore ? 'win' : 'loss';
      } else {
        // User toggle is off OR no registered user - record as anonymous match
        finalScore = leftScoreLatest;
        touchesAgainst = rightScoreLatest;
        scoreDiff = null;
        result = null;
      }

      // Calculate period data from local state (simplified for offline)
      const periodNumber = Math.max(1, currentPeriod);
      const scoreSpp = periodNumber > 0 ? Math.round(finalScore / periodNumber) : 0;
      
      // Use current scores for period data
      const scoreByPeriod = {
        period1: { 
          user: toggleCardPosition === 'left' ? actualFencerAScore : actualFencerBScore, 
          opponent: toggleCardPosition === 'left' ? actualFencerBScore : actualFencerAScore 
        },
        period2: { user: 0, opponent: 0 },
        period3: { user: 0, opponent: 0 }
      };

      // Save offline using offlineRemoteService
      const userId = showUserProfile && user ? user.id : null;
      const completionResult = await offlineRemoteService.completeSession(
        remoteSession.remote_id,
        userId,
        showUserProfile && !!user?.id
      );

      if (!completionResult.success) {
        console.error('❌ Failed to save offline match');
        Alert.alert(
          'Save Failed',
          'Failed to save match offline. Your match data may be lost.',
          [{ text: 'OK' }]
        );
        setIsCompletingMatch(false);
        return;
      }

      console.log('✅ Offline match saved successfully');
      
      // Track offline match saved
      analytics.offlineMatchSaved();
      const winner =
        finalScore === touchesAgainst
          ? 'draw'
          : user?.id && showUserProfile
            ? (finalScore > touchesAgainst ? 'you' : 'opponent')
            : (finalScore > touchesAgainst ? 'left' : 'right');

      analytics.matchCompleted({
        mode: 'remote',
        duration_seconds: matchDuration,
        your_score: finalScore,
        opponent_score: touchesAgainst,
        winner,
        weapon_type: selectedWeapon,
        opponent_name: getOpponentNameForAnalytics(),
        is_offline: true,
        remote_id: remoteSession?.remote_id,
        match_id: matchId || undefined,
      });
      sessionTracker.incrementMatches();
      void trackOnce('first_match_completed', { mode: 'remote' }, user?.id);

      // Get current fencer names based on positions (handles swaps correctly)
      // (leftEntity/rightEntity already computed above)
      // Use isEntityUser to correctly identify which entity is the user (not which position)
      const leftIsUser = showUserProfile && isEntityUser(leftEntity);
      const rightIsUser = showUserProfile && isEntityUser(rightEntity);
      const currentFencer1Name = leftIsUser ? userDisplayName : getNameByEntity(leftEntity);
      const currentFencer2Name = rightIsUser ? userDisplayName : getNameByEntity(rightEntity);
      
      // Get position-based scores and cards (reflects any swaps)
      const leftCards = getCardsByPosition('left'); // Cards of entity currently on left
      const rightCards = getCardsByPosition('right'); // Cards of entity currently on right

      // Navigate to match summary with offline flag and all data
      const navParams: any = {
        matchId: completionResult.matchId || matchId, // Use returned matchId from offline cache
        remoteId: remoteSession.remote_id,
        isOffline: 'true', // Flag to indicate offline match
        // Pass all match state for display (position-based to match names)
        aliceScore: leftScoreLatest.toString(), // Score of fencer on left (fencer1)
        bobScore: rightScoreLatest.toString(), // Score of fencer on right (fencer2)
        aliceCards: JSON.stringify(leftCards),
        bobCards: JSON.stringify(rightCards),
        matchDuration: matchDuration.toString(),
        result: result || '',
        fencer1Name: currentFencer1Name, // Use position-based names (left = fencer1)
        fencer2Name: currentFencer2Name, // Use position-based names (right = fencer2)
        periodNumber: periodNumber.toString(),
        scoreSpp: scoreSpp.toString(),
        scoreByPeriod: JSON.stringify(scoreByPeriod),
        finalScore: finalScore.toString(),
        touchesAgainst: touchesAgainst.toString(),
        scoreDiff: scoreDiff?.toString() || '',
      };

      if (user?.id && showUserProfile) {
        // User match - go to regular match summary
        router.push({
          pathname: '/match-summary',
          params: navParams
        });
      } else {
        // Anonymous match - go to neutral match summary
        router.push({
          pathname: '/neutral-match-summary',
          params: navParams
        });
      }

      // Reset the remote to clean state after completion
      setCurrentMatchPeriod(null);
      setMatchId(null);
      setRemoteSession(null);
      setScores({ fencerA: 0, fencerB: 0 });
      setCards({ fencerA: { yellow: 0, red: 0 }, fencerB: { yellow: 0, red: 0 } });
      setCurrentPeriod(1);
      weaponSelectionLockedRef.current = false;
      setSelectedWeapon(preferredWeaponRef.current);
      setTimeRemaining(matchTime);
      setIsPlaying(false);
      setPriorityFencer(null);
      setPriorityLightPosition(null);
      setIsAssigningPriority(false);
      setIsPriorityRound(false);
      setHasShownPriorityScorePopup(false);
      setIsInjuryTimer(false);
      setIsBreakTime(false);
      setScoreChangeCount(0);
      setShowScoreWarning(false);
      sabreElapsedRef.current = 0;

    } catch (error) {
      console.error('❌ Error completing offline match:', error);
      Alert.alert(
        'Error',
        'An error occurred while saving your match. Please try again when online.',
        [{ text: 'OK', onPress: () => setIsCompletingMatch(false) }]
      );
    }
  };

  const [showEditNamesPopup, setShowEditNamesPopup] = useState(false);
  const [editFencerAName, setEditFencerAName] = useState('');
  const [editFencerBName, setEditFencerBName] = useState('');
  const [scoreChangeCount, setScoreChangeCount] = useState(0);
  const [showScoreWarning, setShowScoreWarning] = useState(false);
  const [pendingScoreAction, setPendingScoreAction] = useState<(() => void) | null>(null);
 
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds

  const [pulseOpacity, setPulseOpacity] = useState(1); // For pulsing animation
  const [isBreakTime, setIsBreakTime] = useState(false); // For break timer
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(60); // 1 minute break
  const [breakTimerRef, setBreakTimerRef] = useState<number | null>(null); // Break timer reference
  const [hasShownBreakPopup, setHasShownBreakPopup] = useState(false); // Flag to prevent multiple break popups
  const [isManualReset, setIsManualReset] = useState(false); // Flag to prevent auto-sync during manual reset
  const [isAssigningPriority, setIsAssigningPriority] = useState(false); // Track if priority is being assigned
  const [isChangingScore, setIsChangingScore] = useState(false); // Flag to prevent state restoration during score changes
  const [hasNavigatedAway, setHasNavigatedAway] = useState(false); // Flag to track if user has navigated away
  const [priorityLightPosition, setPriorityLightPosition] = useState<'left' | 'right' | null>(null); // Track where priority light is
  const [priorityFencer, setPriorityFencer] = useState<'fencerA' | 'fencerB' | null>(null); // Track which entity has priority

  // Mirror hasNavigatedAway into a ref to avoid stale closures
  const hasNavigatedAwayRef = useRef(hasNavigatedAway);
  useEffect(() => { hasNavigatedAwayRef.current = hasNavigatedAway; }, [hasNavigatedAway]);

  // Prevent double prompts
  const resumePromptShownRef = useRef(false);
  const saveMatchStateRef = useRef<() => Promise<void>>(async () => {});
  const pauseTimerRef = useRef<() => void>(() => {});
  const resetAllInFlightRef = useRef(false);
  const incompleteCleanupRanRef = useRef(false);
  // Track if user is actively using the app (to prevent resume prompts during normal interaction)
  const isActivelyUsingAppRef = useRef(false);
  const [showPriorityPopup, setShowPriorityPopup] = useState(false); // Track if priority popup should be shown
  const [isPriorityRound, setIsPriorityRound] = useState(false); // Track if currently in priority round
  const [hasShownPriorityScorePopup, setHasShownPriorityScorePopup] = useState(false); // Track if priority score popup has been shown
  const [priorityRoundPeriod, setPriorityRoundPeriod] = useState<number | null>(null); // Track which period priority round was assigned in
  // Entity-based card state (position-agnostic)
  const [yellowCards, setYellowCards] = useState<{ fencerA: number[], fencerB: number[] }>({ fencerA: [], fencerB: [] });
  const [redCards, setRedCards] = useState<{ fencerA: number[], fencerB: number[] }>({ fencerA: [], fencerB: [] });
  const [isInjuryTimer, setIsInjuryTimer] = useState(false); // Track if injury timer is active
  const [injuryTimeRemaining, setInjuryTimeRemaining] = useState(300); // 5 minutes in seconds
  const [injuryTimerRef, setInjuryTimerRef] = useState<number | null>(null); // Injury timer reference
  const [previousMatchState, setPreviousMatchState] = useState<{
    timeRemaining: number;
    wasPlaying: boolean;
  } | null>(null);

  // NEW CLEAN CARD SYSTEM - Entity-based structure
  const [cards, setCards] = useState<{ fencerA: { yellow: 0 | 1; red: number }, fencerB: { yellow: 0 | 1; red: number } }>({ 
    fencerA: { yellow: 0, red: 0 }, 
    fencerB: { yellow: 0, red: 0 } 
  });

  // Use useRef for timer to ensure proper cleanup
  const timerRef = useRef<number | null>(null);
  const currentPeriodRef = useRef<number>(1); // Ref to track current period value
  const isPlayingRef = useRef<boolean>(false); // Ref to track playing state for timer callback

  // Keep period ref in sync with state so timer callbacks always see the latest period
  useEffect(() => {
    currentPeriodRef.current = currentPeriod;
  }, [currentPeriod]);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Profile emojis for fencer cards (entity-based)
  const [profileEmojis, setProfileEmojis] = useState<{ fencerA: string, fencerB: string }>({ fencerA: '👩', fencerB: '👨' });

  const [toggleCardPosition, setToggleCardPosition] = useState<'left' | 'right'>('left'); // Track which card has the toggle

  // Helper functions for entity/position mapping
  // Get which entity is at a position
  const getEntityAtPosition = useCallback((position: 'left' | 'right'): 'fencerA' | 'fencerB' => {
    return fencerPositions.fencerA === position ? 'fencerA' : 'fencerB';
  }, [fencerPositions]);

  // Get position of an entity
  const getPositionOfEntity = useCallback((entity: 'fencerA' | 'fencerB'): 'left' | 'right' => {
    return fencerPositions[entity];
  }, [fencerPositions]);

  // Get score by position (for UI display)
  const getScoreByPosition = useCallback((position: 'left' | 'right'): number => {
    const entity = getEntityAtPosition(position);
    return scores[entity];
  }, [getEntityAtPosition, scores]);

  // Get score by entity
  const getScoreByEntity = useCallback((entity: 'fencerA' | 'fencerB'): number => {
    return scores[entity];
  }, [scores]);

  const getLockedAdjustedName = useCallback(
    (entity: 'fencerA' | 'fencerB'): string => {
      // Always use current state as source of truth for display
      // The locked ref is only used to prevent auto-writes, not for display
      return fencerNames[entity];
    },
    [fencerNames]
  );

  // Get name by position
  const getNameByPosition = useCallback((position: 'left' | 'right'): string => {
    const entity = getEntityAtPosition(position);
    const name = getLockedAdjustedName(entity);
    // Debug logging to trace the issue
    const isAnonymous = params?.isAnonymous === 'true';
    if (isAnonymous) {
      console.log(`🔍 [getNameByPosition] Position: ${position}, Entity: ${entity}, Name: ${name}`, {
        fencerNames: getLockedAdjustedName(entity),
        fencerPositions,
        showUserProfile
      });
    }
    return name;
  }, [getEntityAtPosition, getLockedAdjustedName, fencerPositions, params, showUserProfile]);

  // Get name by entity
  const getNameByEntity = useCallback((entity: 'fencerA' | 'fencerB'): string => {
    return getLockedAdjustedName(entity);
  }, [getLockedAdjustedName]);

  // Check if entity is user
  const isEntityUser = useCallback((entity: 'fencerA' | 'fencerB'): boolean => {
    if (!showUserProfile) return false;
    return entity === userEntity;
  }, [showUserProfile, userEntity]);

  const sanitizeAnalyticsName = (name: string) => {
    if (!name || name === 'Tap to add name') return undefined;
    return name;
  };

  const getOpponentNameForAnalytics = useCallback(() => {
    if (showUserProfile) {
      const opponentEntity = userEntity === 'fencerA' ? 'fencerB' : 'fencerA';
      return sanitizeAnalyticsName(getNameByEntity(opponentEntity));
    }
    return sanitizeAnalyticsName(getNameByEntity('fencerB'));
  }, [getNameByEntity, showUserProfile, userEntity]);

  const getScoreSideForAnalytics = useCallback(
    (entity: 'fencerA' | 'fencerB'): 'you' | 'opponent' | 'left' | 'right' => {
      if (showUserProfile) {
        return isEntityUser(entity) ? 'you' : 'opponent';
      }
      const position = getPositionOfEntity(entity);
      return position === 'left' ? 'left' : 'right';
    },
    [getPositionOfEntity, isEntityUser, showUserProfile]
  );

  const getAnalyticsScores = useCallback(() => {
    if (showUserProfile) {
      const yourScore = userEntity === 'fencerA' ? scoresRef.current.fencerA : scoresRef.current.fencerB;
      const opponentScore = userEntity === 'fencerA' ? scoresRef.current.fencerB : scoresRef.current.fencerA;
      return { yourScore, opponentScore };
    }
    return { yourScore: scoresRef.current.fencerA, opponentScore: scoresRef.current.fencerB };
  }, [showUserProfile, userEntity]);

  const getElapsedSecondsForAnalytics = useCallback(() => {
    if (!matchStartTime) return 0;
    const elapsedMs = Date.now() - matchStartTime.getTime() - totalPausedTime;
    return Math.max(0, Math.floor(elapsedMs / 1000));
  }, [matchStartTime, totalPausedTime]);

  // Get cards by position
  const getCardsByPosition = useCallback((position: 'left' | 'right'): { yellow: 0 | 1; red: number } => {
    const entity = getEntityAtPosition(position);
    return cards[entity];
  }, [getEntityAtPosition, cards]);

  // Get cards by entity
  const getCardsByEntity = useCallback((entity: 'fencerA' | 'fencerB'): { yellow: 0 | 1; red: number } => {
    return cards[entity];
  }, [cards]);

  // Initialize userEntity only when toggle is first turned on (not on every position change)
  const previousShowUserProfile = useRef(showUserProfile);
  useEffect(() => {
    // Only update userEntity when toggle changes from off to on
    if (showUserProfile && !previousShowUserProfile.current) {
      const currentUserEntity = getEntityAtPosition(toggleCardPosition);
      setUserEntity(currentUserEntity);
    }
    previousShowUserProfile.current = showUserProfile;
  }, [showUserProfile, toggleCardPosition, getEntityAtPosition]);

  // Initialize fencer names based on user profile toggle
  useEffect(() => {
    // For keep-toggle-off flows, never auto-adjust names based on toggle once locked
    if (keepToggleOffLockedRef.current) {
      return;
    }
    if (params?.keepToggleOff === 'true') {
      return;
    }

	    // Don't run during swaps - prevents overwriting names mid-swap
	    if (isSwappingRef.current) return;
	    
	    const hasAnonBaseline = !!anonBaselineNamesRef.current;
	    const isKeepToggleOffFlow = params?.keepToggleOff === 'true';
	    
	    if (showUserProfile && userDisplayName) {
	      // User toggle is ON - set user's name and preserve opponent's name
	      setFencerNames(prev =>
	        userEntity === 'fencerA'
	          ? { ...prev, fencerA: userDisplayName }
	          : { ...prev, fencerB: userDisplayName }
	      );
	    } else if (!showUserProfile) {
	      // Toggle is OFF
	      // For keep-toggle-off flows, do not overwrite user edits after initial apply
	      if (isKeepToggleOffFlow) {
	        return;
	      }

	      if (hasAnonBaseline && anonBaselineNamesRef.current) {
	        // Restore baseline anonymous names (keeps params values instead of user name)
	        setFencerNames(prev => {
	          const next = {
	            ...prev,
	            fencerA: anonBaselineNamesRef.current!.fencerA,
	            fencerB: anonBaselineNamesRef.current!.fencerB,
	          };
	          if (next.fencerA === prev.fencerA && next.fencerB === prev.fencerB) {
	            return prev;
	          }
	          return next;
	        });
	      } else {
	        // Reset the user entity's name to placeholder for normal flow
	        setFencerNames(prev =>
	          userEntity === 'fencerA'
	            ? { ...prev, fencerA: 'Tap to add name' }
	            : { ...prev, fencerB: 'Tap to add name' }
	        );
	      }
	    }
	  }, [showUserProfile, userDisplayName, userEntity, params?.isAnonymous, params?.fencer1Name, params?.fencer2Name, params?.keepToggleOff]);

  const resolveGuestNamesIfNeeded = useCallback((): { fencerA: string; fencerB: string } | null => {
    const isMissing = (name: string) => name === 'Tap to add name' || !name.trim();
    const fencerAName = getNameByEntity('fencerA');
    const fencerBName = getNameByEntity('fencerB');
    let nextFencerA = fencerAName;
    let nextFencerB = fencerBName;

    if (showUserProfile) {
      const opponentPosition = toggleCardPosition === 'left' ? 'right' : 'left';
      const opponentEntity = getEntityAtPosition(opponentPosition);
      const opponentName = getNameByEntity(opponentEntity);

      if (!isMissing(opponentName)) {
        return null;
      }

      if (opponentEntity === 'fencerA') {
        nextFencerA = 'Guest';
      } else {
        nextFencerB = 'Guest';
      }
    } else {
      const fencerAMissing = isMissing(fencerAName);
      const fencerBMissing = isMissing(fencerBName);

      if (!fencerAMissing && !fencerBMissing) {
        return null;
      }

      if (fencerAMissing && fencerBMissing) {
        nextFencerA = 'Guest 1';
        nextFencerB = 'Guest 2';
      } else if (fencerAMissing) {
        nextFencerA = 'Guest';
      } else if (fencerBMissing) {
        nextFencerB = 'Guest';
      }
    }

    if (nextFencerA === fencerAName && nextFencerB === fencerBName) {
      return null;
    }

    setFencerNames(prev => {
      if (prev.fencerA === nextFencerA && prev.fencerB === nextFencerB) {
        return prev;
      }
      return {
        ...prev,
        fencerA: nextFencerA,
        fencerB: nextFencerB,
      };
    });

    return { fencerA: nextFencerA, fencerB: nextFencerB };
  }, [showUserProfile, toggleCardPosition, getEntityAtPosition, getNameByEntity]);

  // Validate that fencer names are filled before starting a match
  const validateFencerNames = useCallback((): { isValid: boolean; message?: string } => {
    return { isValid: true };
  }, []);

  // Keep baseline names in sync for keep-toggle-off flows so user edits persist when starting match
  useEffect(() => {
    // If we are already locked, don't re-evaluate baseline (prevents oscillation)
    if (params.keepToggleOff === 'true' && keepToggleOffLockedRef.current) {
      return;
    }

    if (params.keepToggleOff === 'true' && !showUserProfile) {
      const baseline = anonBaselineNamesRef.current;
      if (!baseline) {
        // Capture initial baseline once
        anonBaselineNamesRef.current = { ...fencerNames };
        console.log('🧷 [keepToggleOff] Captured initial baseline', anonBaselineNamesRef.current);
      } else {
        // If user changed names relative to baseline, lock auto-writes and stop updating baseline
        if (
          fencerNames.fencerA !== baseline.fencerA ||
          fencerNames.fencerB !== baseline.fencerB
        ) {
          keepToggleOffLockedRef.current = true;
          keepToggleOffLockedNamesRef.current = { ...fencerNames };
          console.log('🔒 [keepToggleOff] Locked due to user edit', {
            baseline,
            current: fencerNames
          });
        }
      }
    }
  }, [params.keepToggleOff, showUserProfile, fencerNames.fencerA, fencerNames.fencerB]);

  // If keep-toggle-off is locked, rely on locked names for display, but avoid re-writing state to prevent loops

  // Debug: Log when fencerNames state changes
  useEffect(() => {
    if (params?.keepToggleOff === 'true') {
      console.log('🔄 [fencerNames state changed]', {
        fencerNames,
        locked: keepToggleOffLockedRef.current,
        lockedNames: keepToggleOffLockedNamesRef.current
      });
    }
  }, [fencerNames.fencerA, fencerNames.fencerB, params?.keepToggleOff]);

  // Match History Logging
  const [matchHistory, setMatchHistory] = useState<Array<{
    type: 'score' | 'card';
    fencer: 'fencerA' | 'fencerB';
    action: 'increase' | 'decrease' | 'yellow' | 'red';
    timestamp: number; // Time elapsed in match
    score: number; // Score after the change (for score events)
    cards: { fencerA: number; fencerB: number }; // Card state after change (for card events)
    period: number;
  }>>([]);

  // Logging function for match events
  const logMatchEvent = (
    type: 'score' | 'card',
    entity: 'fencerA' | 'fencerB', 
    action: 'increase' | 'decrease' | 'yellow' | 'red'
  ) => {
    const newEntry = {
      type,
      fencer: entity, // Use entity-based identifier
      action,
      timestamp: matchTime - timeRemaining,
      score: scores.fencerA + scores.fencerB, // Total match score
      cards: {
        fencerA: cards.fencerA.yellow + cards.fencerA.red,
        fencerB: cards.fencerB.yellow + cards.fencerB.red
      },
      period: currentPeriod
    };
    
    setMatchHistory(prev => [...prev, newEntry]);
    console.log(`Match Event Logged: ${entity} ${action} at ${formatTime(newEntry.timestamp)} (Period ${currentPeriod})`);
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

  // Keep scoresRef in sync with scores state
  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  // Helper function to transition to next period (used when skipping break)
  const transitionToNextPeriod = async (currentPeriodValue: number) => {
    const maxPeriods = isSabre ? 2 : 3;
    const nextPeriod = Math.min(currentPeriodValue + 1, maxPeriods);

    // Reset break popup flag
    setHasShownBreakPopup(false);

    if (nextPeriod === currentPeriodValue) {
      return;
    }
    
    // End current period and create new one
    if (currentMatchPeriod) {
      await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
        end_time: new Date().toISOString(),
        fencer_1_score: scores.fencerA,
        fencer_2_score: scores.fencerB,
        fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
        fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
      });
      
      const periodData = {
        match_id: currentMatchPeriod.match_id,
        period_number: nextPeriod,
        start_time: new Date().toISOString(),
        fencer_1_score: scores.fencerA,
        fencer_2_score: scores.fencerB,
        fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
        fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
        priority_assigned: priorityFencer || undefined,
        priority_to: priorityFencer === 'fencerA' ? fencerNames.fencerA : priorityFencer === 'fencerB' ? fencerNames.fencerB : undefined,
      };
      
      const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
      if (newPeriodRecord) {
        setCurrentMatchPeriod(newPeriodRecord);
        setMatchId(newPeriodRecord.match_id); // Store match ID safely
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
  };

  const incrementPeriod = async () => {
    if (isSabre) {
      return;
    }
    if (currentPeriod < 3) {
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      const newPeriod = currentPeriod + 1;
      
      // End the current period if it exists
      if (currentMatchPeriod) {
        console.log('🏁 Ending current period:', currentPeriod);
        await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
          end_time: new Date().toISOString(),
          fencer_1_score: scores.fencerA,
          fencer_2_score: scores.fencerB,
          fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
          fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
        }, accessToken);
        
        // Create new period record for the next period
        console.log('🆕 Creating new period:', newPeriod);
        const periodData = {
          match_id: currentMatchPeriod.match_id,
          period_number: newPeriod,
          start_time: new Date().toISOString(),
          fencer_1_score: scores.fencerA, // Carry over current scores
          fencer_2_score: scores.fencerB,
          fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
          fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
          priority_assigned: priorityFencer || undefined,
          priority_to: priorityFencer === 'fencerA' ? fencerNames.fencerA : priorityFencer === 'fencerB' ? fencerNames.fencerB : undefined,
        };
        
        const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData, accessToken);
        if (newPeriodRecord) {
          console.log('✅ New period created successfully:', newPeriodRecord);
          setCurrentMatchPeriod(newPeriodRecord);
          setMatchId(newPeriodRecord.match_id); // Store match ID safely
        }
      }
      
      setCurrentPeriod(newPeriod);
      currentPeriodRef.current = newPeriod; // Update ref
      
      // Track period transition
      const { yourScore, opponentScore } = getAnalyticsScores();
      analytics.periodTransition({
        period: newPeriod,
        your_score: yourScore,
        opponent_score: opponentScore,
        weapon_type: selectedWeapon,
        remote_id: remoteSession?.remote_id,
        match_id: currentMatchPeriod?.match_id ?? currentMatchPeriodRef.current?.match_id,
      });
    }
  };

  const decrementPeriod = async () => {
    if (isSabre) {
      return;
    }
    if (currentPeriod > 1) {
      // Pause timer if it's currently running
      if (isPlaying) {
        pauseTimer();
      }
      
      const newPeriod = currentPeriod - 1;
      
      // Note: Decrementing period is unusual in a real match, but we'll support it
      // We need to find the previous period record
      if (currentMatchPeriod) {
        const { data: previousPeriod } = await postgrestSelectOne<MatchPeriod>(
          'match_period',
          {
            select: '*',
            match_id: `eq.${currentMatchPeriod.match_id}`,
            period_number: `eq.${newPeriod}`,
            limit: 1,
          },
          accessToken ? { accessToken } : { allowAnon: true }
        );
        
        if (previousPeriod) {
          setCurrentMatchPeriod(previousPeriod);
        }
      }
      
      setCurrentPeriod(newPeriod);
      currentPeriodRef.current = newPeriod; // Update ref
    }
  };

  // Unified score increment function (entity-based)
  const incrementScore = async (entity: 'fencerA' | 'fencerB') => {
    try {
      setIsChangingScore(true);
      setHasNavigatedAway(false); // Reset navigation flag when changing scores
      isActivelyUsingAppRef.current = true; // Mark that user is actively using the app
      const tapDebugId = nextDebugId();
      
      // Prevent score changes if match is being completed
      if (isCompletingMatch) {
        console.log('🚫 Score change blocked - match is being completed');
        captureMatchDebug('score_tap_blocked', {
          debug_id: tapDebugId,
          action: 'increase',
          entity,
          reason: 'match_completing',
        });
        setIsChangingScore(false);
        return;
      }
      
      // Ensure remote session exists (create if first score)
      const resolvedGuestNames = resolveGuestNamesIfNeeded();
      const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
      if (!session) {
        captureMatchDebug('score_tap_blocked', {
          debug_id: tapDebugId,
          action: 'increase',
          entity,
          reason: 'missing_remote_session',
        });
        setIsChangingScore(false);
        return;
      }
    
    // Get current score and calculate new score
    const currentScore = getScoreByEntity(entity);
    const newScore = currentScore + 1;
    const otherEntity = entity === 'fencerA' ? 'fencerB' : 'fencerA';
    const otherScore = getScoreByEntity(otherEntity);
    captureMatchDebug('score_tap', {
      debug_id: tapDebugId,
      action: 'increase',
      entity,
      current_score: currentScore,
      new_score: newScore,
      other_score: otherScore,
      is_active_match: hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0)),
    });
    // Keep the ref in sync immediately so completion uses the latest values even before React updates state
    scoresRef.current = { ...scoresRef.current, [entity]: newScore };
    
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        captureMatchDebug('score_tap_warning', {
          debug_id: tapDebugId,
          action: 'increase',
          entity,
          new_score: newScore,
          score_change_count: newCount,
        });
        setPendingScoreAction(() => async () => {
          setScores(prev => ({ ...prev, [entity]: newScore }));
          analytics.scoreIncrement({
            side: getScoreSideForAnalytics(entity),
            new_score: newScore,
            period: currentPeriodRef.current,
            is_offline: isOffline,
            time_elapsed_seconds: getElapsedSecondsForAnalytics(),
            time_remaining_seconds: timeRemaining,
            weapon_type: selectedWeapon,
            opponent_name: getOpponentNameForAnalytics(),
            remote_id: session.remote_id,
            match_id: currentMatchPeriod?.match_id ?? currentMatchPeriodRef.current?.match_id,
          });
          setScoreChangeCount(0); // Reset counter
          
          // Pause timer IMMEDIATELY if it's currently running (before async operations for instant response)
          if (isPlaying) {
            pauseTimer();
          }
          
          // Check if entity reached 15 points (match should end)
          if (newScore >= 15) {
            console.log(`🏁 ${entity} reached 15 points - match should end`);
            setIsCompletingMatch(true);
          }
          
          // Create match event in background (already queued locally, this is just for immediate DB sync)
          const entityIsUser = isEntityUser(entity);
          createMatchEvent(entityIsUser ? 'user' : 'opponent', undefined, entity, newScore, session, 'touch', tapDebugId)
            .catch(error => console.error('Background event creation failed:', error));
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setScores(prev => ({ ...prev, [entity]: newScore }));
      analytics.scoreIncrement({
        side: getScoreSideForAnalytics(entity),
        new_score: newScore,
        period: currentPeriodRef.current,
        is_offline: isOffline,
        time_elapsed_seconds: getElapsedSecondsForAnalytics(),
        time_remaining_seconds: timeRemaining,
        weapon_type: selectedWeapon,
        opponent_name: getOpponentNameForAnalytics(),
        remote_id: session.remote_id,
        match_id: currentMatchPeriod?.match_id ?? currentMatchPeriodRef.current?.match_id,
      });
      
      // Pause timer IMMEDIATELY if it's currently running (before async operations for instant response)
      if (isPlaying) {
        pauseTimer();
      }
      
      // Fire async operations in background (events are already queued locally, so safe to fire-and-forget)
      if (remoteSession) {
        const leftEntity = getEntityAtPosition('left');
        const leftScore = leftEntity === entity ? newScore : (leftEntity === 'fencerA' ? scores.fencerA : scores.fencerB);
        const rightEntity = getEntityAtPosition('right');
        const rightScore = rightEntity === entity ? newScore : (rightEntity === 'fencerA' ? scores.fencerA : scores.fencerB);
        
        // Fire-and-forget: local cache is updated immediately, server sync happens in background
        offlineRemoteService.updateRemoteScores(remoteSession.remote_id, leftScore, rightScore)
          .catch(error => console.error('Background score update failed:', error));
      }
      
      logMatchEvent('score', entity, 'increase'); // Log the score increase
      
      // Check if entity reached 15 points (match should end)
      if (newScore >= 15) {
        console.log(`🏁 ${entity} reached 15 points - match should end`);
        setIsCompletingMatch(true);
      }
      
      // Create match event in background (already queued locally via recordEvent, this is just for immediate DB sync)
      const entityIsUser = isEntityUser(entity);
      createMatchEvent(entityIsUser ? 'user' : 'opponent', undefined, entity, newScore, session, 'touch', tapDebugId)
        .catch(error => console.error('Background event creation failed:', error));
      
      // Check if this is the first score during priority round
      if (isPriorityRound && !hasShownPriorityScorePopup) {
        setHasShownPriorityScorePopup(true); // Prevent future popups
        
        // Show popup asking if entity won on priority
        const entityName = getNameByEntity(entity);
        const entityDisplayName = isEntityUser(entity) ? userDisplayName.split(' ')[0] : entityName.split(' ')[0];
        Alert.alert(
          'Priority Touch Scored!',
          `${entityDisplayName} scored to make it ${newScore}-${otherScore}\n\nDid ${entityDisplayName} win on priority?`,
          [
            {
              text: 'No, Continue',
              onPress: () => {
                // Resume timer if it was paused
                if (!isPlaying && timeRemaining > 0) {
                  togglePlay();
                }
              }
            },
            {
              text: `Yes, ${entityDisplayName} Wins`,
              onPress: async () => {
                // Track priority winner
                await trackPriorityWinner(entityDisplayName);
                await trackPriorityRoundEnd(entityDisplayName);
                
                // Check which period priority was assigned in
                const period = priorityRoundPeriod;
                if (period === 1 || period === 2) {
                  // Period 1-2: Show break popup, then transition to next period
                  setIsPriorityRound(false); // Exit priority round mode
                  setPriorityRoundPeriod(null); // Reset
                  
                  // Show break popup
                  Alert.alert(
                    'Priority Winner!',
                    `${entityDisplayName} won on priority!\n\nWould you like to take a 1-minute break?`,
                    [
                      { 
                        text: 'Skip Break', 
                        style: 'cancel',
                        onPress: async () => {
                          await transitionToNextPeriod(period);
                        }
                      },
                      { 
                        text: 'Take Break', 
                        onPress: () => {
                          startBreakTimer();
                        }
                      }
                    ]
                  );
                } else {
                  // Period 3: Complete match
                  const finalFencerAScore = entity === 'fencerA' ? newScore : scores.fencerA;
                  const finalFencerBScore = entity === 'fencerB' ? newScore : scores.fencerB;
                  await proceedWithMatchCompletion(finalFencerAScore, finalFencerBScore);
                }
              }
            }
          ]
        );
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - validate names before allowing first score
      const nameValidation = validateFencerNames();
      if (!nameValidation.isValid) {
        captureMatchDebug('score_tap_blocked', {
          debug_id: tapDebugId,
          action: 'increase',
          entity,
          reason: 'name_required',
        });
        Alert.alert(
          'Names Required',
          nameValidation.message || 'Please add fencer names before starting the match.',
          [
            {
              text: 'OK',
              onPress: () => {
                openEditNamesPopup();
              }
            }
          ]
        );
        setIsChangingScore(false);
        return;
      }

      // Not an active match - no warning needed, just update score
      setScores(prev => ({ ...prev, [entity]: newScore }));
      analytics.scoreIncrement({
        side: getScoreSideForAnalytics(entity),
        new_score: newScore,
        period: currentPeriodRef.current,
        is_offline: isOffline,
        time_elapsed_seconds: getElapsedSecondsForAnalytics(),
        time_remaining_seconds: timeRemaining,
        weapon_type: selectedWeapon,
        opponent_name: getOpponentNameForAnalytics(),
        remote_id: session.remote_id,
        match_id: currentMatchPeriod?.match_id ?? currentMatchPeriodRef.current?.match_id,
      });
      
      // For Sabre: Set hasMatchStarted when first score is recorded and create Period 1
      // Note: session is already created in incrementScore at line 3325, so we use that
      if (selectedWeapon === 'sabre' && !hasMatchStarted && (scores.fencerA === 0 && scores.fencerB === 0)) {
        setHasMatchStarted(true);
        sabreElapsedRef.current = 0; // Reset sabre elapsed counter on first score
        console.log('🏁 Sabre match started with first score');
        // Create Period 1 for sabre match (use session from line 3325)
        if (session && !currentMatchPeriod) {
          const playClickTime = new Date().toISOString();
          const period = await createMatchPeriod(session, playClickTime);
          if (period) {
            setCurrentMatchPeriod(period);
            setMatchId(period.match_id || null);
          }
        }
      }
      
      // Update remote session scores (offline-capable) - map entities to left/right positions
      if (remoteSession) {
        const leftEntity = getEntityAtPosition('left');
        const leftScore = leftEntity === entity ? newScore : (leftEntity === 'fencerA' ? scores.fencerA : scores.fencerB);
        const rightEntity = getEntityAtPosition('right');
        const rightScore = rightEntity === entity ? newScore : (rightEntity === 'fencerA' ? scores.fencerA : scores.fencerB);
        await offlineRemoteService.updateRemoteScores(remoteSession.remote_id, leftScore, rightScore);
      }
      
      logMatchEvent('score', entity, 'increase'); // Log the score increase
      setScoreChangeCount(0); // Reset counter for new match
      
      // For Sabre: Check for break at 8 points
      if (selectedWeapon === 'sabre' && (newScore === 8 || (entity === 'fencerB' ? scores.fencerA : scores.fencerB) === 8)) {
        const scoreAt8 = newScore === 8 ? newScore : (entity === 'fencerB' ? scores.fencerA : scores.fencerB);
        if (!breakTriggered && scoreAt8 === 8) {
          console.log('🍃 Sabre break triggered at 8 points');
          setBreakTriggered(true);
          // Show break popup
          Alert.alert(
            'Break at 8 Points',
            'Would you like to take a 1-minute break?',
            [
              {
                text: 'Skip Break',
                style: 'cancel',
                onPress: async () => {
                  // Period 2 starts immediately
                  if (currentMatchPeriod && currentMatchPeriod.period_number === 1) {
                    await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
                      end_time: new Date().toISOString(),
                      fencer_1_score: entity === 'fencerA' ? newScore : scores.fencerA,
                      fencer_2_score: entity === 'fencerB' ? newScore : scores.fencerB,
                    });
                    
                    // Create Period 2
                    const periodData = {
                      match_id: currentMatchPeriod.match_id,
                      period_number: 2,
                      start_time: new Date().toISOString(),
                      fencer_1_score: entity === 'fencerA' ? newScore : scores.fencerA,
                      fencer_2_score: entity === 'fencerB' ? newScore : scores.fencerB,
                      fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
                      fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
                    };
                    const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
                    if (newPeriodRecord) {
                      setCurrentMatchPeriod(newPeriodRecord);
                      setCurrentPeriod(2);
                    }
                  }
                }
              },
              {
                text: 'Take Break',
                onPress: async () => {
                  // Period 1 ends immediately
                  if (currentMatchPeriod && currentMatchPeriod.period_number === 1) {
                    await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
                      end_time: new Date().toISOString(),
                      fencer_1_score: entity === 'fencerA' ? newScore : scores.fencerA,
                      fencer_2_score: entity === 'fencerB' ? newScore : scores.fencerB,
                    });
                  }
                  // Start break timer
                  startBreakTimer();
                }
              }
            ]
          );
        }
      }
      
      // Check if entity reached 15 points (match should end) - only for Foil/Epee
      if (selectedWeapon !== 'sabre' && newScore >= 15) {
        console.log(`🏁 ${entity} reached 15 points - match should end`);
        setIsCompletingMatch(true);
      }
      
      // Create match event for the score - determine if entity is user or opponent
      // For Sabre: match_time_elapsed should be NULL
      const entityIsUser = isEntityUser(entity);
      try {
        await createMatchEvent(entityIsUser ? 'user' : 'opponent', undefined, entity, newScore, session, 'touch', tapDebugId);
      } catch (error) {
        console.error('❌ Error creating match event in incrementScore:', error);
        // Continue anyway - event might be queued via offline service
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => setIsChangingScore(false), 100);
    } catch (error) {
      console.error('❌ Error in incrementScore:', error);
      setIsChangingScore(false);
      // Don't throw - we want to prevent unhandled promise rejections
    }
  };


  // Helper function to create a cancellation event
  const createCancellationEvent = async (
    entity: 'fencerA' | 'fencerB',
    cancelledEventId?: string | null,
    cancelledEventUuid?: string | null
  ) => {
    if (!remoteSession || !currentMatchPeriod?.match_id) {
      console.log('⚠️ Cannot create cancellation event - no remote session or match period');
      return;
    }

    const now = new Date();
    const { event_uuid, event_sequence } = buildEventIdentity();
    const actualMatchTime = getActualMatchTime();
    // Calculate elapsed time accounting for completed periods
    // Query match_period table to determine which periods were actually played (have start_time)
    // This ensures we don't add time for skipped periods (e.g., if user started on period 2)
    let matchTimeElapsed = 0;
    if (hasMatchStarted) {
      // Query match_period table to see which periods were actually played
      // This ensures we don't add time for skipped periods (e.g., if user started on period 2)
      let actualCompletedPeriods = 0;
      let actualCompletedPeriodsTime = 0;
      
      if (currentMatchPeriod?.match_id) {
        try {
          const { data: periodsData } = await postgrestSelect<{
            period_number: number | null;
            start_time: string | null;
          }>(
            'match_period',
            {
              select: 'period_number,start_time',
              match_id: `eq.${currentMatchPeriod.match_id}`,
              order: 'period_number.asc',
            },
            accessToken ? { accessToken } : { allowAnon: true }
          );
          
          const matchPeriods = periodsData || [];
          
          // Count periods that were actually played (have start_time)
          const actualPeriodsPlayed = matchPeriods.filter(p => p.start_time) || [];
          actualCompletedPeriods = Math.max(0, actualPeriodsPlayed.length - 1); // Exclude current period
          actualCompletedPeriodsTime = actualCompletedPeriods * matchTime;
          
          console.log('🕐 [CANCELLATION EVENT] Period calculation:', {
            matchId: currentMatchPeriod.match_id,
            currentPeriod,
            matchPeriods: matchPeriods.map(p => ({ period_number: p.period_number, hasStartTime: !!p.start_time })),
            actualPeriodsPlayed: actualPeriodsPlayed.map(p => p.period_number),
            actualCompletedPeriods,
            actualCompletedPeriodsTime
          });
        } catch (error) {
          console.warn('⚠️ Error querying match_period table for cancellation event, falling back to currentPeriod calculation:', error);
          // Fallback to original calculation if query fails
          actualCompletedPeriods = currentPeriod - 1;
          actualCompletedPeriodsTime = actualCompletedPeriods * matchTime;
        }
      } else {
        // Fallback if no match_id available
        actualCompletedPeriods = currentPeriod - 1;
        actualCompletedPeriodsTime = actualCompletedPeriods * matchTime;
      }
      
      // Calculate elapsed time for current period
      const currentPeriodElapsed = matchTime - timeRemaining;
      
      // Total = actual completed periods + current period
      matchTimeElapsed = Math.max(0, actualCompletedPeriodsTime + currentPeriodElapsed);
    }
    
    // Determine scorer and names (same logic as createMatchEvent)
    const entityIsUser = isEntityUser(entity);
    const scorer = entityIsUser ? 'user' : 'opponent';
    const leftEntity = getEntityAtPosition('left');
    const rightEntity = getEntityAtPosition('right');
    const fencer1Name = showUserProfile && toggleCardPosition === 'left' ? userDisplayName : getNameByEntity(leftEntity);
    const fencer2Name = showUserProfile && toggleCardPosition === 'right' ? userDisplayName : getNameByEntity(rightEntity);
    const scoringUserName = entityIsUser ? fencer1Name : fencer2Name;
    const resolvedCancelledEventId = cancelledEventId || null;
    const resolvedCancelledEventUuid = cancelledEventUuid || null;

    // Check if we're online
    let isOnline = false;
    try {
      isOnline = await networkService.isOnline();
    } catch (error) {
      console.error('❌ Error checking network status:', error);
      // Default to offline if we can't determine
      isOnline = false;
    }
    
    const isOfflineSession = remoteSession.remote_id.startsWith('offline_');

    // Record cancellation event via offline service (works online and offline)
    const baseEvent = {
      event_uuid,
      event_sequence,
      match_id: currentMatchPeriod.match_id,
      fencing_remote_id: remoteSession.remote_id,
      match_period_id: currentMatchPeriod.match_period_id || null,
      event_time: now.toISOString(),
      event_type: 'cancel',
      scoring_user_id: scorer === 'user' ? user?.id : null,
      scoring_user_name: scoringUserName,
      fencer_1_name: fencer1Name,
      fencer_2_name: fencer2Name,
      cancelled_event_id: resolvedCancelledEventId,
      reset_segment: resetSegmentRef.current,
      match_time_elapsed: matchTimeElapsed,
    };

    void appendLocalMatchEvent({
      ...baseEvent,
      cancelled_event_uuid: resolvedCancelledEventUuid,
    });

    let queuedEventId: string | null = null;
    try {
      queuedEventId = await offlineRemoteService.recordEvent({
        remote_id: remoteSession.remote_id,
        event_uuid,
        event_sequence,
        event_type: "cancel",
        scoring_user_name: scoringUserName,
        match_time_elapsed: matchTimeElapsed,
        event_time: now.toISOString(),
        metadata: {
          match_id: currentMatchPeriod.match_id,
          match_period_id: currentMatchPeriod.match_period_id || null,
          scoring_user_id: scorer === 'user' ? user?.id : null,
          fencer_1_name: fencer1Name,
          fencer_2_name: fencer2Name,
          cancelled_event_id: resolvedCancelledEventId,
          cancelled_event_uuid: resolvedCancelledEventUuid,
          reset_segment: resetSegmentRef.current,
        }
      });
    } catch (error) {
      console.error('❌ Error recording cancellation event via offline service:', error);
      // Continue anyway - the event might still be queued
    }

    // Also create via matchEventService if online
    if (isOnline && !isOfflineSession && currentMatchPeriod?.match_id) {
      try {
        // Verify match and remote session still exist before creating event
        // This prevents foreign key violations if reset was called during async operations
        const { data: matchCheck, error: matchError } = await postgrestSelectOne<{ match_id: string }>(
          'match',
          {
            select: 'match_id',
            match_id: `eq.${currentMatchPeriod.match_id}`,
            limit: 1,
          },
          { accessToken }
        );

        const { data: remoteCheck, error: remoteError } = await postgrestSelectOne<{ remote_id: string }>(
          'fencing_remote',
          {
            select: 'remote_id',
            remote_id: `eq.${remoteSession.remote_id}`,
            limit: 1,
          },
          { accessToken }
        );
        
        // Only create event if both match and remote session still exist
        if (!matchError && matchCheck && !remoteError && remoteCheck) {
          const { event_sequence, ...eventData } = baseEvent;
          const createdEvent = await matchEventService.createMatchEvent(eventData, accessToken);
          
          if (!createdEvent) {
            console.log('⚠️ Cancellation event creation failed (match may have been deleted), event already queued for sync');
            return; // Event is already queued via offlineRemoteService.recordEvent above
          }
          if (queuedEventId) {
            await offlineCache.removePendingRemoteEvent(queuedEventId);
          }
          
          console.log('✅ Cancellation event created:', cancelledEventId);
        } else {
          console.log('⚠️ Match or remote session no longer exists (likely reset), cancellation event already queued for sync');
          // Event is already queued via offlineRemoteService.recordEvent above, so no action needed
        }
      } catch (error: any) {
        const isForeignKeyError = error?.code === '23503' || 
                                  error?.message?.includes('foreign key constraint') ||
                                  error?.message?.includes('violates foreign key');
        
        if (isForeignKeyError) {
          console.log('⚠️ Match or remote session no longer exists (foreign key violation), cancellation event already queued for sync');
        } else {
          console.error('❌ Error creating cancellation event:', error);
        }
        // Event is already queued via offlineRemoteService.recordEvent above, so no action needed
      }
    }
  };

  // Unified score decrement function (entity-based)
  const decrementScore = async (entity: 'fencerA' | 'fencerB') => {
    try {
      setIsChangingScore(true);
      setHasNavigatedAway(false); // Reset navigation flag when changing scores
      isActivelyUsingAppRef.current = true; // Mark that user is actively using the app
      const tapDebugId = nextDebugId();
    
    // Get current score and calculate new score
    const currentScore = getScoreByEntity(entity);
    const newScore = Math.max(0, currentScore - 1);
    
    // Get the most recent scoring event ID for this entity to cancel
    const eventIdToCancel = recentScoringEventIds[entity];
    const eventUuidToCancel = recentScoringEventUuidsRef.current[entity];
    captureMatchDebug('score_tap', {
      debug_id: tapDebugId,
      action: 'decrease',
      entity,
      current_score: currentScore,
      new_score: newScore,
      has_cancel_event: !!eventIdToCancel,
      has_cancel_event_uuid: !!eventUuidToCancel,
      is_active_match: hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0)),
    });
    
    // Check if this is an active match (timer has been started and is either running or paused)
    if (hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0))) {
      // This is an active match - check for repeated score changes
      const newCount = scoreChangeCount + 1;
      setScoreChangeCount(newCount);
      
      if (newCount >= 2) { // Show warning on second change
        // Show warning for multiple score changes during active match
        captureMatchDebug('score_tap_warning', {
          debug_id: tapDebugId,
          action: 'decrease',
          entity,
          new_score: newScore,
          score_change_count: newCount,
        });
        setPendingScoreAction(() => async () => {
          setScores(prev => ({ ...prev, [entity]: newScore }));
          setScoreChangeCount(0); // Reset counter
          setIsChangingScore(false);
          
          // Pause timer IMMEDIATELY if it's currently running (before async operations for instant response)
          if (isPlaying) {
            pauseTimer();
          }
          
          // Create cancellation event in background (fire-and-forget)
          if (eventIdToCancel || eventUuidToCancel) {
            createCancellationEvent(entity, eventIdToCancel, eventUuidToCancel)
              .then(() => {
                // Clear the tracked event ID since it's been cancelled
                setRecentScoringEventIds(prev => ({
                  ...prev,
                  [entity]: null
                }));
                recentScoringEventUuidsRef.current = {
                  ...recentScoringEventUuidsRef.current,
                  [entity]: null,
                };
              })
              .catch(error => console.error('Background cancellation failed:', error));
          }
        });
        setShowScoreWarning(true);
        return;
      }
      
      // First score change during active match - proceed normally
      setScores(prev => ({ ...prev, [entity]: newScore }));
      
      // For Sabre: Reset breakTriggered if score goes below 8
      if (selectedWeapon === 'sabre' && breakTriggered) {
        const updatedScores = { ...scores, [entity]: newScore };
        if (updatedScores.fencerA < 8 && updatedScores.fencerB < 8) {
          setBreakTriggered(false);
          console.log('🔄 Sabre breakTriggered reset - score below 8');
        }
      }
      
      // Pause timer IMMEDIATELY if it's currently running (before async operations for instant response)
      if (isPlaying) {
        pauseTimer();
      }
      
      logMatchEvent('score', entity, 'decrease'); // Log the score decrease
      
      // Create cancellation event in background (fire-and-forget)
      if (eventIdToCancel || eventUuidToCancel) {
        createCancellationEvent(entity, eventIdToCancel, eventUuidToCancel)
          .then(() => {
            // Clear the tracked event ID since it's been cancelled
            setRecentScoringEventIds(prev => ({
              ...prev,
              [entity]: null
            }));
            recentScoringEventUuidsRef.current = {
              ...recentScoringEventUuidsRef.current,
              [entity]: null,
            };
          })
          .catch(error => console.error('Background cancellation failed:', error));
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Not an active match - no warning needed, just update score
      setScores(prev => ({ ...prev, [entity]: newScore }));
      
      // For Sabre: Reset breakTriggered if score goes below 8
      if (selectedWeapon === 'sabre' && breakTriggered) {
        const updatedScores = { ...scores, [entity]: newScore };
        if (updatedScores.fencerA < 8 && updatedScores.fencerB < 8) {
          setBreakTriggered(false);
          console.log('🔄 Sabre breakTriggered reset - score below 8');
        }
      }
      
      logMatchEvent('score', entity, 'decrease'); // Log the score decrease
      
      // Create cancellation event if we have an event ID to cancel
      if (eventIdToCancel || eventUuidToCancel) {
        try {
          await createCancellationEvent(entity, eventIdToCancel, eventUuidToCancel);
          // Clear the tracked event ID since it's been cancelled
          setRecentScoringEventIds(prev => ({
            ...prev,
            [entity]: null
          }));
          recentScoringEventUuidsRef.current = {
            ...recentScoringEventUuidsRef.current,
            [entity]: null,
          };
        } catch (error) {
          console.error('❌ Error creating cancellation event in decrementScore:', error);
          // Continue anyway - event might be queued via offline service
        }
      }
      
      setScoreChangeCount(0); // Reset counter for new match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Reset the flag after a short delay to allow state to settle
    setTimeout(() => setIsChangingScore(false), 100);
    } catch (error) {
      console.error('❌ Error in decrementScore:', error);
      setIsChangingScore(false);
      // Don't throw - we want to prevent unhandled promise rejections
    }
  };


  const openEditNamesPopup = useCallback(() => {
    // Helper function to get name value - return empty string if it's the placeholder
    const getNameValue = (name: string): string => {
      return name === 'Tap to add name' ? '' : name;
    };
    
    // Map inputs to the visible cards (left/right) so swapped positions stay correct
    const leftEntity = getEntityAtPosition('left');
    const rightEntity = getEntityAtPosition('right');
    const leftIsUser = showUserProfile && toggleCardPosition === 'left';
    const rightIsUser = showUserProfile && toggleCardPosition === 'right';

    setEditFencerAName(leftIsUser ? userDisplayName : getNameValue(getNameByEntity(leftEntity))); // Left card
    setEditFencerBName(rightIsUser ? userDisplayName : getNameValue(getNameByEntity(rightEntity))); // Right card
    setShowEditNamesPopup(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [getEntityAtPosition, getNameByEntity, showUserProfile, toggleCardPosition, userDisplayName]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pauseTimer();
    } else {
      const resolvedGuestNames = resolveGuestNamesIfNeeded();
      // Validate fencer names before starting match
      const nameValidation = validateFencerNames();
      if (!nameValidation.isValid) {
        Alert.alert(
          'Names Required',
          nameValidation.message || 'Please add fencer names before starting the match.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Optionally open the name edit popup
                openEditNamesPopup();
              }
            }
          ]
        );
        return;
      }

      // Lock current toggle choice for the remainder of this match session
      userHasToggledProfileRef.current = true;
      // Also lock keep-toggle-off flows against auto-writes once match starts after manual edits
      if (params.keepToggleOff === 'true') {
        keepToggleOffLockedRef.current = true;
        keepToggleOffLockedNamesRef.current = { ...fencerNames };
        console.log('🔒 [togglePlay] Locking keepToggleOff at match start', {
          fencerNames,
          showUserProfile
        });
      }

      // Record the exact time when Play is clicked
      const playClickTime = new Date().toISOString();
      console.log('🎮 Play button clicked at:', playClickTime);
      
      const isFirstStart = !matchStartTime;
      // Set match start time if this is the first time starting
      if (!matchStartTime) {
        setMatchStartTime(new Date());
        console.log('🕐 Match start time set to:', new Date().toISOString());
      }
      
      // Ensure match completion flag is reset when starting
      setIsCompletingMatch(false);
      
      // Mark that user is actively using the app
      isActivelyUsingAppRef.current = true;
      
      // START TIMER IMMEDIATELY (before async operations for instant response)
      startTimer();
      setScoreChangeCount(0); // Reset score change counter when starting timer
      
      // Fire async operations in background (don't block timer start)
      (async () => {
        try {
          // Create remote session when starting timer (in background)
          const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
          if (!session) {
            console.log('❌ Failed to create remote session - will retry');
            return;
          }
          
          // Track match start (in background)
          const isOffline = await networkService.isOnline().then(online => !online);
          if (isFirstStart) {
            analytics.matchStart({ 
              mode: 'remote', 
              is_offline: isOffline,
              weapon_type: selectedWeapon,
              opponent_name: getOpponentNameForAnalytics(),
              remote_id: session.remote_id
            });
            void trackFeatureFirstUse(
              'remote_match',
              {
                weapon_type: selectedWeapon,
                opponent_name: getOpponentNameForAnalytics(),
              },
              user?.id
            );
          }
          
          // Create match period only if one doesn't already exist (first time starting match)
          if (!currentMatchPeriod) {
            console.log('🆕 Creating new match period (first time starting match)');
            analytics.matchSetupStart();
            await createMatchPeriod(session, playClickTime);
          } else {
            console.log('⏯️ Match period already exists, resuming match');
          }
        } catch (error) {
          console.error('❌ Error in background match setup:', error);
          // Don't block timer - it's already running
        }
      })();
    }
  }, [isPlaying, timeRemaining, matchTime, ensureRemoteSession, createMatchPeriod, currentMatchPeriod, matchStartTime, resolveGuestNamesIfNeeded, validateFencerNames, openEditNamesPopup, selectedWeapon, getOpponentNameForAnalytics, user?.id]);

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
    setScores({ fencerA: 0, fencerB: 0 });
    setHasNavigatedAway(false); // Reset navigation flag
    // For Sabre: Reset breakTriggered when scores reset
    if (selectedWeapon === 'sabre') {
      setBreakTriggered(false);
      setMomentumStreak({ lastScorer: null, count: 0 });
      previousScoresRef.current = { fencerA: 0, fencerB: 0 };
      sabreElapsedRef.current = 0;
    }
    logMatchEvent('score', 'fencerA', 'decrease'); // Log score reset
    logMatchEvent('score', 'fencerB', 'decrease'); // Log score reset
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedWeapon]);

  const markResetSegment = useCallback(
    async (reason: 'period' | 'time') => {
      const nextSegment = resetSegmentRef.current + 1;
      resetSegmentRef.current = nextSegment;
      setResetSegment(nextSegment);
      pendingTouchQueueRef.current = [];
      setRecentScoringEventIds({ fencerA: null, fencerB: null });
      recentScoringEventUuidsRef.current = { fencerA: null, fencerB: null };

      const activeSession = remoteSession;
      const effectivePeriod = currentMatchPeriod || currentMatchPeriodRef.current;
      if (!activeSession || !effectivePeriod?.match_id) {
        console.log('⏭️ Reset segment updated locally (no remote session yet)', {
          reason,
          reset_segment: nextSegment,
        });
        return;
      }

      const now = new Date();
      const { event_uuid, event_sequence } = buildEventIdentity();
      const leftEntity = getEntityAtPosition('left');
      const rightEntity = getEntityAtPosition('right');
      const leftIsUser = showUserProfile && isEntityUser(leftEntity);
      const rightIsUser = showUserProfile && isEntityUser(rightEntity);
      const fencer1Name = leftIsUser ? userDisplayName : getNameByEntity(leftEntity);
      const fencer2Name = rightIsUser ? userDisplayName : getNameByEntity(rightEntity);

      const baseEvent = {
        event_uuid,
        event_sequence,
        match_id: effectivePeriod.match_id,
        match_period_id: effectivePeriod.match_period_id || null,
        fencing_remote_id: activeSession.remote_id,
        event_time: now.toISOString(),
        event_type: 'reset',
        scoring_user_id: null,
        fencer_1_name: fencer1Name,
        fencer_2_name: fencer2Name,
        reset_segment: nextSegment,
        match_time_elapsed: 0,
      };

      void appendLocalMatchEvent(baseEvent);

      let queuedEventId: string | null = null;
      try {
        queuedEventId = await offlineRemoteService.recordEvent({
          remote_id: activeSession.remote_id,
          event_uuid,
          event_sequence,
          event_type: 'reset',
          event_time: baseEvent.event_time,
          match_time_elapsed: baseEvent.match_time_elapsed,
          metadata: {
            match_id: baseEvent.match_id,
            match_period_id: baseEvent.match_period_id,
            fencer_1_name: baseEvent.fencer_1_name,
            fencer_2_name: baseEvent.fencer_2_name,
            reset_segment: baseEvent.reset_segment,
          },
        });
      } catch (error) {
        console.error('❌ Error queueing reset marker event:', error);
      }

      const isOnline = await networkService.isOnline();
      const isOfflineSession = activeSession.remote_id.startsWith('offline_');
      if (isOnline && !isOfflineSession) {
        try {
          const { data: matchCheck, error: matchError } = await postgrestSelectOne<{ match_id: string }>(
            'match',
            {
              select: 'match_id',
              match_id: `eq.${effectivePeriod.match_id}`,
              limit: 1,
            },
            { accessToken }
          );

          const { data: remoteCheck, error: remoteError } = await postgrestSelectOne<{ remote_id: string }>(
            'fencing_remote',
            {
              select: 'remote_id',
              remote_id: `eq.${activeSession.remote_id}`,
              limit: 1,
            },
            { accessToken }
          );

          if (!matchError && matchCheck && !remoteError && remoteCheck) {
            const { event_sequence, ...eventData } = baseEvent;
            const createdEvent = await matchEventService.createMatchEvent(eventData, accessToken);
            if (createdEvent && queuedEventId) {
              await offlineCache.removePendingRemoteEvent(queuedEventId);
            }
          }
        } catch (error) {
          console.error('❌ Error creating reset marker event immediately:', error);
        }
      }

      console.log('🧭 Reset segment marked', { reason, reset_segment: nextSegment });
    },
    [currentMatchPeriod, getEntityAtPosition, getNameByEntity, isEntityUser, remoteSession, showUserProfile, userDisplayName]
  );

  const resetPeriod = useCallback(() => {
    // Stop any running timers for a clean restart
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (breakTimerRef) {
      clearInterval(breakTimerRef);
      setBreakTimerRef(null);
    }
    if (injuryTimerRef) {
      clearInterval(injuryTimerRef);
      setInjuryTimerRef(null);
    }

    setIsPlaying(false);
    setHasMatchStarted(false);
    setIsBreakTime(false);
    setBreakTimeRemaining(60);
    setCurrentPeriod(1);
    setIsPriorityRound(false); // Reset priority round
    setHasShownPriorityScorePopup(false); // Reset priority popup flag
    setPriorityFencer(null); // Reset priority fencer
    setPriorityLightPosition(null); // Reset priority light
    setPeriod1Time(0);
    setPeriod2Time(0);
    setPeriod3Time(0);
    setTimeRemaining(matchTime); // Reset timer to configured match length
    setMatchStartTime(null);
    setTotalPausedTime(0);
    setPauseStartTime(null);
    setLastEventTime(null);
    sabreElapsedRef.current = 0;
    setIsManualReset(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markResetSegment('period');
  }, [breakTimerRef, injuryTimerRef, matchTime, markResetSegment]);

  const resetTime = useCallback(() => {
    // Stop timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (breakTimerRef) {
      clearInterval(breakTimerRef);
      setBreakTimerRef(null);
    }
    setIsPlaying(false);
    setHasMatchStarted(false); // Reset match started state
    // Reset only the timer, keep current period
    setTimeRemaining(matchTime); // Same as matchTime = no paused state
    setPriorityLightPosition(null); // Reset priority light
    setPriorityFencer(null); // Reset priority fencer
    setShowPriorityPopup(false); // Reset priority popup
    setIsPriorityRound(false); // Reset priority round
    setHasShownPriorityScorePopup(false); // Reset priority score popup flag
    
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
    setMatchStartTime(null);
    setTotalPausedTime(0);
    setPauseStartTime(null);
    setLastEventTime(null);
    sabreElapsedRef.current = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsManualReset(false);
    markResetSegment('time');
  }, [breakTimerRef, matchTime, markResetSegment]);

  // Helper function to perform the actual reset
  const performResetAll = useCallback(async (keepOpponentName: boolean = false) => {
    if (resetAllInFlightRef.current) {
      console.log('⏭️ Reset All skipped - already running');
      return;
    }

    resetAllInFlightRef.current = true;
    setIsResetting(true); // Block new operations during reset
    // Store the current toggle state to preserve it after reset
    const currentToggleState = showUserProfile;
    const matchPeriodSnapshot = currentMatchPeriod;
    const remoteSessionSnapshot = remoteSession;
    const sessionAccessToken = session?.access_token ?? accessToken;

    const hasActiveMatch =
      hasMatchStarted ||
      scoresRef.current.fencerA > 0 ||
      scoresRef.current.fencerB > 0 ||
      currentPeriodRef.current > 1 ||
      !!matchStartTime;

    if (hasActiveMatch && !isCompletingMatch) {
      const { yourScore, opponentScore } = getAnalyticsScores();
      analytics.matchAbandoned({
        mode: 'remote',
        weapon_type: selectedWeapon,
        opponent_name: getOpponentNameForAnalytics(),
        period: currentPeriodRef.current,
        your_score: yourScore,
        opponent_score: opponentScore,
        time_elapsed_seconds: getElapsedSecondsForAnalytics(),
        time_remaining_seconds: timeRemaining,
        reason: 'reset_all',
        is_offline: isOffline,
        remote_id: remoteSessionSnapshot?.remote_id,
        match_id: matchPeriodSnapshot?.match_id,
      });
    }

    console.log('🔄 Starting Reset All - cleaning up database records...');
    setIsCompletingMatch(false); // Reset the completion flag
    isActivelyUsingAppRef.current = false; // Reset active usage flag
    console.log('🔍 Current state:', { 
      currentMatchPeriod: matchPeriodSnapshot ? 'exists' : 'null',
      remoteSession: remoteSessionSnapshot ? 'exists' : 'null',
      matchId: matchPeriodSnapshot?.match_id,
      remoteId: remoteSessionSnapshot?.remote_id
    });

    void (async () => {
      try {
        if (matchPeriodSnapshot || remoteSessionSnapshot) {
          console.log('🗑️ Deleting match and related records...');
          if (matchPeriodSnapshot) {
            if (matchPeriodSnapshot.match_id.startsWith('offline_')) {
              console.log('📱 Offline match detected - skipping database deletion (match only exists locally)');
            } else {
              const matchDeleted = await matchService.deleteMatch(
                matchPeriodSnapshot.match_id,
                remoteSessionSnapshot?.remote_id,
                sessionAccessToken
              );
              if (matchDeleted) {
                console.log('✅ Match and related records deleted successfully');
              } else {
                console.error('❌ Failed to delete match records');
              }
            }
          }

          if (remoteSessionSnapshot) {
            if (remoteSessionSnapshot.remote_id.startsWith('offline_')) {
              console.log('📱 Offline session detected - skipping remote deletion (session only exists locally)');
            } else {
              const sessionDeleted = await fencingRemoteService.deleteRemoteSession(remoteSessionSnapshot.remote_id, accessToken);
              if (sessionDeleted) {
                console.log('✅ Remote session deleted successfully');
              } else {
                console.error('❌ Failed to delete remote session');
              }
            }
          }
        } else if (!incompleteCleanupRanRef.current) {
          incompleteCleanupRanRef.current = true;
          console.log('🧹 Attempting to clean up any incomplete records...');
          const { data: incompleteMatches, error: recentError } = await postgrestSelect<{ match_id: string; is_complete: boolean }>(
            'match',
            {
              select: 'match_id,is_complete',
              is_complete: 'eq.false',
            },
            { accessToken }
          );

          if (recentError) {
            console.error('❌ Error finding incomplete matches:', recentError);
          } else if (incompleteMatches && incompleteMatches.length > 0) {
            console.log('🗑️ Found incomplete matches:', incompleteMatches.length);
            for (const match of incompleteMatches) {
              await matchService.deleteMatch(match.match_id, undefined, sessionAccessToken);
            }
            console.log('✅ Cleaned up incomplete matches');
          } else {
            console.log('✅ No incomplete matches found');
          }
        }
      } catch (error) {
        console.error('❌ Error during Reset All cleanup:', error);
      }
    })();

    let resetErrored = false;
    try {
      // Always reset timers and UI state, even if cleanup fails
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

      setIsPlaying(false);
      isPlayingRef.current = false;
      setHasMatchStarted(false);
      setCurrentMatchPeriod(null);
      setMatchId(null);
      setRemoteSession(null);
      setCurrentPeriod(1);
      currentPeriodRef.current = 1;
      setMatchTime(180);
      setTimeRemaining(180);
      setScores({ fencerA: 0, fencerB: 0 });
      setIsBreakTime(false);
      setBreakTimeRemaining(60);
      setBreakTriggered(false);
      setMomentumStreak({ lastScorer: null, count: 0 });
      previousScoresRef.current = { fencerA: 0, fencerB: 0 };
      setScoreChangeCount(0);
      setShowScoreWarning(false);
      setHasNavigatedAway(false);
      setLastEventTime(null);
      setMatchStartTime(null);
      setTotalPausedTime(0);
      setPauseStartTime(null);
      pendingTouchQueueRef.current = [];
      resetSegmentRef.current = 0;
      setResetSegment(0);
      sabreElapsedRef.current = 0;
      setPendingScoreAction(null);
      setPreviousMatchState(null);
      setRecentScoringEventIds({ fencerA: null, fencerB: null });

      setPriorityLightPosition(null);
      setPriorityFencer(null);
      setShowPriorityPopup(false);
      setIsPriorityRound(false);
      setHasShownPriorityScorePopup(false);
      setIsAssigningPriority(false);

      setCards({ fencerA: { yellow: 0, red: 0 }, fencerB: { yellow: 0, red: 0 } });
      
      setIsInjuryTimer(false);
      setInjuryTimeRemaining(300);

      // Hard stop any lingering local caches so a new match cannot inherit stale state
      try {
        await Promise.allSettled([
          offlineCache.clearActiveRemoteSession(),
          offlineCache.clearPendingRemoteEvents(),
          AsyncStorage.removeItem('ongoing_match_state')
        ]);
        console.log('🧹 Cleared offline caches and ongoing match state');
      } catch (cacheErr) {
        console.error('❌ Error clearing offline caches during reset:', cacheErr);
      }

	      const opponentEntity = userEntity === 'fencerA' ? 'fencerB' : 'fencerA';
	      if (keepOpponentName && showUserProfile && userDisplayName) {
	        // Preserve opponent name tied to the non-user entity, regardless of card position
	        const preservedOpponentName = fencerNames[opponentEntity] || 'Tap to add name';
	        setFencerNames(
	          userEntity === 'fencerA'
	            ? { fencerA: userDisplayName, fencerB: preservedOpponentName }
	            : { fencerA: preservedOpponentName, fencerB: userDisplayName }
	        );
	      } else if (showUserProfile && userDisplayName) {
	        // Reset opponent to placeholder; keep user on their entity (position-agnostic)
	        setFencerNames(
	          userEntity === 'fencerA'
	            ? { fencerA: userDisplayName, fencerB: 'Tap to add name' }
	            : { fencerA: 'Tap to add name', fencerB: userDisplayName }
	        );
	      } else {
	        setFencerNames({ 
	          fencerA: 'Tap to add name', 
	          fencerB: 'Tap to add name' 
        });
      }
      
      setFencerPositions({ fencerA: 'left', fencerB: 'right' });
      // Align toggle card with the user entity after reset (prevents showing user on both cards)
      const userTogglePosition = userEntity === 'fencerA' ? 'left' : 'right';
      setToggleCardPosition(userTogglePosition);
      setShowUserProfile(currentToggleState);
      weaponSelectionLockedRef.current = false;
      setSelectedWeapon(preferredWeaponRef.current);

      if (!resetErrored) {
        console.log('✅ Reset All completed successfully');
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsManualReset(true); // Set flag to prevent auto-sync
      setIsResetting(false); // Always clear reset flag
      resetAllInFlightRef.current = false;
    } catch (error) {
      resetErrored = true;
      console.error('❌ Error during Reset All:', error);
      setIsResetting(false);
      resetAllInFlightRef.current = false;
    }
  }, [
    accessToken,
    breakTimerRef,
    currentMatchPeriod,
    fencerNames,
    remoteSession,
    session?.access_token,
    showUserProfile,
    userDisplayName,
    userEntity,
    hasMatchStarted,
    matchStartTime,
    isCompletingMatch,
    isOffline,
    selectedWeapon,
    timeRemaining,
    getOpponentNameForAnalytics,
    getElapsedSecondsForAnalytics,
    getAnalyticsScores,
  ]);
  
  // Main resetAll function that checks opponent name and shows prompt
  const resetAll = useCallback(async () => {
    if (resetAllInFlightRef.current || isResetting) {
      console.log('⏭️ Reset All ignored - reset already in progress');
      return;
    }
    // If user toggle is OFF, show different options
    if (!showUserProfile) {
      // Check if both names are filled in
      const bothNamesFilled = fencerNames.fencerA !== 'Tap to add name' && fencerNames.fencerB !== 'Tap to add name';
      
      // If names aren't filled, reset immediately without prompt
      if (!bothNamesFilled) {
        await performResetAll(false);
        return;
      }
      
      // Otherwise, show custom modal with all options for anonymous matches
      setShowResetAllModal(true);
      return;
    }
    
    // User toggle is ON - show original opponent prompt
    // Determine which fencer is the opponent
    let opponentName: string;
    if (toggleCardPosition === 'left') {
      // User is on left (fencerA), opponent is fencerB
      opponentName = fencerNames.fencerB;
    } else {
      // User is on right (fencerB), opponent is fencerA
      opponentName = fencerNames.fencerA;
    }
    
    // If opponent name is "Tap to add name", reset immediately without prompt
    if (opponentName === 'Tap to add name') {
      await performResetAll(false);
      return;
    }
    
    // Otherwise, show prompt to ask if same opponent
    Alert.alert(
      'Keep opponent\'s name?',
      `Do you want to keep "${opponentName}" for the next match?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            console.log('🔄 Reset All cancelled by user');
          }
        },
        {
          text: 'New opponent',
          style: 'destructive',
          onPress: async () => {
            console.log('🔄 User chose to reset opponent name');
            await performResetAll(false);
          }
        },
        {
          text: 'Same opponent',
          onPress: async () => {
            console.log('🔄 User chose to keep opponent name');
            await performResetAll(true);
          }
        }
      ]
    );
  }, [fencerNames, isResetting, showUserProfile, userDisplayName, toggleCardPosition, performResetAll]);

  const swapFencers = useCallback(() => {
    if (isSwapping) return; // Prevent multiple swaps during animation
    
    setIsSwapping(true);
    isSwappingRef.current = true; // Block name effect during swap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Store current state
    const tempFencerAScore = scores.fencerA;
    const tempFencerBScore = scores.fencerB;
    const tempFencerAName = fencerNames.fencerA;
    const tempFencerBName = fencerNames.fencerB;
    const tempFencerACards = cards.fencerA;
    const tempFencerBCards = cards.fencerB;
    const tempFencerAEmoji = profileEmojis.fencerA;
    const tempFencerBEmoji = profileEmojis.fencerB;
    
    // Animate the swap
    setTimeout(() => {
      // DON'T swap scores - scores stay with their entities (like names)
      // Scores are entity properties, not position properties
      
      // DON'T swap names - names stay with their entities
      // Names are managed by the effect based on userEntity
      
      // DON'T swap emojis - emojis stay with their entities
      
      // DON'T swap cards - cards stay with their entities
      
      // Swap positions - just flip the positions
      setFencerPositions(prev => ({
        fencerA: prev.fencerA === 'left' ? 'right' : 'left',
        fencerB: prev.fencerB === 'left' ? 'right' : 'left'
      }));
      
      // Swap toggle position (which side the user card is on)
      setToggleCardPosition(prev => prev === 'left' ? 'right' : 'left');
      
      // DON'T swap userEntity - userEntity represents which entity (fencerA or fencerB) is the user
      // This should stay constant - only positions change when swapping
      // The userEntity is tied to the actual fencer identity, not their position
      
      console.log('🔄 Fencers swapped successfully');
      
      // Reset swapping state after animation
      setTimeout(() => {
        setIsSwapping(false);
        isSwappingRef.current = false; // Re-enable name effect
      }, 300);
    }, 150);
  }, [isSwapping, scores, fencerNames, cards, profileEmojis, toggleCardPosition, showUserProfile]);

  const toggleUserProfile = useCallback(() => {
    if (hasMatchStarted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Toggle Locked', 'You can only change this before the match starts.');
      return;
    }
    userHasToggledProfileRef.current = true;
    setShowUserProfile(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [hasMatchStarted]);

  const handleFencerNameClick = useCallback((entity: 'fencerA' | 'fencerB') => {
    // Don't allow editing if user profile is shown and this is the user's position
    if (showUserProfile) {
      const userPosition = toggleCardPosition;
      const userEntity = getEntityAtPosition(userPosition);
      if (entity === userEntity) {
        // This is the user's name, don't allow editing
        return;
      }
    }
    
    // Open the edit names popup
    openEditNamesPopup();
  }, [showUserProfile, toggleCardPosition, openEditNamesPopup, getEntityAtPosition]);

  const saveFencerName = useCallback(() => {
    const trimmedLeft = editFencerAName.trim();
    const trimmedRight = editFencerBName.trim();

    if (trimmedLeft && trimmedRight) {
      const leftEntity = getEntityAtPosition('left');
      const rightEntity = getEntityAtPosition('right');

	      // Preserve user's name when toggle is on, based on current card position
	      if (showUserProfile) {
	        const userPosition = toggleCardPosition;
	        const opponentPosition = userPosition === 'left' ? 'right' : 'left';
	        const userEntityForEdit = userPosition === 'left' ? leftEntity : rightEntity;
	        const opponentName = opponentPosition === 'left' ? trimmedLeft : trimmedRight;

	        setFencerNames(prev =>
	          userEntityForEdit === 'fencerA'
	            ? { ...prev, fencerA: userDisplayName, fencerB: opponentName }
	            : { ...prev, fencerA: opponentName, fencerB: userDisplayName }
	        );
	      } else {
	        const newNames =
	          leftEntity === 'fencerA'
	            ? { fencerA: trimmedLeft, fencerB: trimmedRight }
	            : { fencerA: trimmedRight, fencerB: trimmedLeft };
	        console.log('💾 [saveFencerName] Setting fencer names state:', newNames, {
	          currentState: fencerNames,
	          keepToggleOff: params.keepToggleOff
	        });
        
        // Lock keep-toggle-off flows BEFORE state update to prevent overwrites
        if (params.keepToggleOff === 'true') {
          keepToggleOffLockedRef.current = true;
          keepToggleOffLockedNamesRef.current = { ...newNames };
          console.log('🔒 [saveFencerName] Locked keepToggleOff BEFORE state update', {
            lockedNames: keepToggleOffLockedNamesRef.current
          });
        }
        
        // Update state - this should trigger re-render
        setFencerNames(newNames);
        
        // Verify state was set (in next tick)
        setTimeout(() => {
          console.log('✅ [saveFencerName] State update completed, verifying...', {
            expected: newNames,
            // Note: Can't read state here, but this confirms the update was called
          });
        }, 0);
      }
      setShowEditNamesPopup(false);
      setEditFencerAName('');
      setEditFencerBName('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [editFencerAName, editFencerBName, fencerNames, showUserProfile, userDisplayName, toggleCardPosition, getEntityAtPosition, params.keepToggleOff]);

  const cancelEditName = useCallback(() => {
    setShowEditNamesPopup(false);
    setEditFencerAName('');
    setEditFencerBName('');
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
    isPlayingRef.current = false; // Update ref
    setTimeRemaining(matchTime);
    setHasShownBreakPopup(false); // Reset break popup flag
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [matchTime]);

  const pauseTimer = useCallback(() => {
    if (isPlaying && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsPlaying(false);
      isPlayingRef.current = false; // Update ref immediately
      
      // Track pause start time
      setPauseStartTime(new Date());
      
      // Don't reset score change counter when pausing - keep tracking for the current match
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isPlaying]);

  useEffect(() => {
    pauseTimerRef.current = pauseTimer;
  }, [pauseTimer]);

  // Handle double hit for Epee (scores both fencers simultaneously)
  const handleDoubleHit = useCallback(async () => {
    const tapDebugId = nextDebugId();
    if (isResetting) {
      console.log('⚠️ Reset in progress, skipping double hit');
      captureMatchDebug('score_tap_blocked', {
        debug_id: tapDebugId,
        action: 'double_hit',
        reason: 'reset_in_progress',
      });
      return;
    }

    if (isCompletingMatch) {
      console.log('🚫 Double hit blocked - match is being completed');
      captureMatchDebug('score_tap_blocked', {
        debug_id: tapDebugId,
        action: 'double_hit',
        reason: 'match_completing',
      });
      return;
    }

    // Pause immediately (match should stop the moment a double is recorded)
    if (isPlaying) {
      pauseTimer();
    }

    // Ensure remote session exists
    const session = await ensureRemoteSession();
    if (!session) {
      console.error('❌ Cannot record double hit - no remote session');
      captureMatchDebug('score_tap_blocked', {
        debug_id: tapDebugId,
        action: 'double_hit',
        reason: 'missing_remote_session',
      });
      return;
    }

    // Show pressed state
    setIsDoubleHitPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Reset pressed state after animation
    setTimeout(() => {
      setIsDoubleHitPressed(false);
    }, 200);
    
    // Get current scores before updating
    const currentFencerAScore = scores.fencerA;
    const currentFencerBScore = scores.fencerB;
    const newFencerAScore = currentFencerAScore + 1;
    const newFencerBScore = currentFencerBScore + 1;
    captureMatchDebug('score_tap', {
      debug_id: tapDebugId,
      action: 'double_hit',
      current_score_a: currentFencerAScore,
      current_score_b: currentFencerBScore,
      new_score_a: newFencerAScore,
      new_score_b: newFencerBScore,
      is_active_match: hasMatchStarted && (isPlaying || (timeRemaining < matchTime && timeRemaining > 0)),
    });
    
    // Increment both fencers' scores
    setScores(prev => ({
      fencerA: prev.fencerA + 1,
      fencerB: prev.fencerB + 1
    }));

    // Update remote session scores
    if (remoteSession) {
      const leftEntity = getEntityAtPosition('left');
      const leftScore = leftEntity === 'fencerA' ? newFencerAScore : newFencerBScore;
      const rightEntity = getEntityAtPosition('right');
      const rightScore = rightEntity === 'fencerA' ? newFencerAScore : newFencerBScore;
      await offlineRemoteService.updateRemoteScores(remoteSession.remote_id, leftScore, rightScore);
    }

    // Record a single double-hit event so progression can count both fencers at once
    await createMatchEvent(
      'user',               // scorer label not used for double scoring
      undefined,            // No card
      undefined,            // scoringEntity not needed for double
      undefined,            // newScore not used for double
      undefined,            // sessionOverride
      'double',             // mark as double event
      tapDebugId
    );

    // Track analytics - use capture for custom event
    analytics.capture('epee_double_hit', {
      fencer_a_score: newFencerAScore,
      fencer_b_score: newFencerBScore
    });

    console.log('⚔️ Double hit recorded - both fencers scored');
  }, [isResetting, isCompletingMatch, scores, createMatchEvent, ensureRemoteSession, remoteSession, isPlaying, pauseTimer, isEntityUser, getEntityAtPosition, hasMatchStarted, timeRemaining, matchTime, captureMatchDebug, nextDebugId]);

  const startTimer = useCallback(() => {
    setIsPlaying(true);
    isPlayingRef.current = true; // Update ref immediately
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
      // CRITICAL: Check if timer should still be running using ref (current value)
      // This prevents the timer from continuing when paused
      if (!isPlayingRef.current || !timerRef.current) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      
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
        isPlayingRef.current = false; // Update ref
        // Haptic feedback for timer completion
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Prevent multiple popups from showing
        if (hasShownBreakPopup) {
          return;
        }
        setHasShownBreakPopup(true);
        
        // Get the current period value to avoid stale closure
        const currentPeriodValue = currentPeriodRef.current;
        const currentScores = scoresRef.current;
        
        // CHECK FOR PRIORITY ROUND TIMER EXPIRY
        if (isPriorityRound) {
          // Priority timer expired
          const currentFencerAScore = currentScores.fencerA;
          const currentFencerBScore = currentScores.fencerB;
          if (currentFencerAScore === currentFencerBScore) {
            // Still tied - priority fencer wins
            const winnerName = priorityFencer === 'fencerA' 
              ? (showUserProfile && toggleCardPosition === 'left' ? userDisplayName : fencerNames.fencerA)
              : (showUserProfile && toggleCardPosition === 'right' ? userDisplayName : fencerNames.fencerB);
            // Check which period priority was assigned in
            const period = priorityRoundPeriod;
            if (period === 1 || period === 2) {
              // Period 1-2: Show break popup, then transition to next period
              setIsPriorityRound(false); // Exit priority round mode
              setPriorityRoundPeriod(null); // Reset
              
              Alert.alert(
                '⏱️ Time Expired',
                `Priority timer ended with score still tied at ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins on priority!\n\nWould you like to take a 1-minute break?`,
                [
                  { 
                    text: 'Skip Break', 
                    style: 'cancel',
                    onPress: async () => {
                      await transitionToNextPeriod(period);
                    }
                  },
                  { 
                    text: 'Take Break', 
                    onPress: () => {
                      startBreakTimer();
                    }
                  }
                ]
              );
            } else {
              // Period 3: Complete match
              Alert.alert(
                '⏱️ Time Expired',
                `Priority timer ended with score still tied at ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins on priority!`,
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await proceedWithMatchCompletion();
                    }
                  }
                ]
              );
            }
          } else {
            // Score changed - higher score wins
            const winnerName = currentFencerAScore > currentFencerBScore 
              ? (showUserProfile && toggleCardPosition === 'left' ? userDisplayName : fencerNames.fencerA)
              : (showUserProfile && toggleCardPosition === 'right' ? userDisplayName : fencerNames.fencerB);
            // Check which period priority was assigned in
            const period = priorityRoundPeriod;
            if (period === 1 || period === 2) {
              // Period 1-2: Show break popup, then transition to next period
              setIsPriorityRound(false); // Exit priority round mode
              setPriorityRoundPeriod(null); // Reset
              
              Alert.alert(
                '⏱️ Time Expired',
                `Priority timer ended with score ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins!\n\nWould you like to take a 1-minute break?`,
                [
                  { 
                    text: 'Skip Break', 
                    style: 'cancel',
                    onPress: async () => {
                      await transitionToNextPeriod(period);
                    }
                  },
                  { 
                    text: 'Take Break', 
                    onPress: () => {
                      startBreakTimer();
                    }
                  }
                ]
              );
            } else {
              // Period 3: Complete match
              Alert.alert(
                '⏱️ Time Expired',
                `Priority timer ended with score ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins!`,
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await proceedWithMatchCompletion();
                    }
                  }
                ]
              );
            }
          }
          return; // Don't continue to regular period logic
        }
        
        // Check if scores are tied for any period (use ref to get current value)
        const isTied = currentScores.fencerA === currentScores.fencerB;
        
        // SIMPLE PERIOD LOGIC - Period 1 and 2 show break popup, Period 3 shows completion
        if (currentPeriodValue === 1 || currentPeriodValue === 2) {
          // Period 1 or 2 - show break popup (with priority option if tied)
          if (isTied) {
            // Scores are tied - show 3-button popup with priority option
            Alert.alert(
              'Match Time Complete!',
              `Period ${currentPeriodValue} ended in a tie (${currentScores.fencerA}-${currentScores.fencerB}). Would you like to assign priority?`,
              [
                { 
                  text: 'Assign Priority', 
                  onPress: () => {
                    // Store which period priority is being assigned in
                    setPriorityRoundPeriod(currentPeriodValue);
                    // Assign priority and start priority round (same as period 3)
                    autoAssignPriority(true);
                    // Priority round will start after animation completes
                  }
                },
                { 
                  text: 'Skip Break', 
                  style: 'cancel',
                  onPress: async () => {
                    await transitionToNextPeriod(currentPeriodValue);
                  }
                },
                { 
                  text: 'Take Break', 
                  onPress: () => {
                    startBreakTimer();
                  }
                }
              ]
            );
          } else {
            // Scores are not tied - show normal break popup
            Alert.alert(
              'Match Time Complete!',
              'Would you like to take a 1-minute break?',
              [
                { 
                  text: 'Skip Break', 
                  style: 'cancel',
                  onPress: async () => {
                    await transitionToNextPeriod(currentPeriodValue);
                  }
                },
                { 
                  text: 'Take Break', 
                  onPress: () => {
                    startBreakTimer();
                  }
                }
              ]
            );
          }
        } else if (currentPeriodValue === 3) {
          // Period 3 - check if scores are tied
          if (isTied) {
            // Scores are tied - show 2-button popup with priority option
            Alert.alert(
              'Match Time Complete!',
              `Period 3 ended in a tie (${currentScores.fencerA}-${currentScores.fencerB}). Would you like to assign priority?`,
              [
                { 
                  text: 'Assign Priority', 
                  onPress: () => {
                    // Assign priority and start priority round (for period 3)
                    autoAssignPriority(true);
                    // Priority round will start after animation completes
                  }
                },
                { 
                  text: 'Complete Match', 
                  style: 'cancel',
                  onPress: async () => {
                    setTimeRemaining(0);
                    // Complete the match without priority
                    await proceedWithMatchCompletion(currentScores.fencerA, currentScores.fencerB);
                  }
                }
              ]
            );
          } else {
            // Scores are not tied - show match completion
            Alert.alert('Match Complete!', 'All periods have been completed. Great job!', [
              { 
                text: 'OK', 
                onPress: async () => {
                  setTimeRemaining(0);
                  // Complete the match properly - pass current scores
                  await proceedWithMatchCompletion(currentScores.fencerA, currentScores.fencerB);
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
          const currentScores = scoresRef.current;
          
          // CHECK FOR PRIORITY ROUND TIMER EXPIRY
          if (isPriorityRound) {
            // Priority timer expired
            const currentFencerAScore = currentScores.fencerA;
            const currentFencerBScore = currentScores.fencerB;
            if (currentFencerAScore === currentFencerBScore) {
              // Still tied - priority fencer wins
              const winnerName = priorityFencer === 'fencerA' 
                ? (showUserProfile && toggleCardPosition === 'left' ? userDisplayName : fencerNames.fencerA)
                : (showUserProfile && toggleCardPosition === 'right' ? userDisplayName : fencerNames.fencerB);
              // Check which period priority was assigned in
              const period = priorityRoundPeriod;
              if (period === 1 || period === 2) {
                // Period 1-2: Show break popup, then transition to next period
                setIsPriorityRound(false); // Exit priority round mode
                setPriorityRoundPeriod(null); // Reset
                
                Alert.alert(
                  '⏱️ Time Expired',
                  `Priority timer ended with score still tied at ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins on priority!\n\nWould you like to take a 1-minute break?`,
                  [
                    { 
                      text: 'Skip Break', 
                      style: 'cancel',
                      onPress: async () => {
                        await transitionToNextPeriod(period);
                      }
                    },
                    { 
                      text: 'Take Break', 
                      onPress: () => {
                        startBreakTimer();
                      }
                    }
                  ]
                );
              } else {
                // Period 3: Complete match
                Alert.alert(
                  '⏱️ Time Expired',
                  `Priority timer ended with score still tied at ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins on priority!`,
                  [
                    {
                      text: 'OK',
                      onPress: async () => {
                        await proceedWithMatchCompletion();
                      }
                    }
                  ]
                );
              }
            } else {
              // Score changed - higher score wins
              const winnerName = currentFencerAScore > currentFencerBScore 
                ? (showUserProfile && toggleCardPosition === 'left' ? userDisplayName : fencerNames.fencerA)
                : (showUserProfile && toggleCardPosition === 'right' ? userDisplayName : fencerNames.fencerB);
              
              // Check which period priority was assigned in
              const period = priorityRoundPeriod;
              if (period === 1 || period === 2) {
                // Period 1-2: Show break popup, then transition to next period
                setIsPriorityRound(false); // Exit priority round mode
                setPriorityRoundPeriod(null); // Reset
                
                Alert.alert(
                  '⏱️ Time Expired',
                  `Priority timer ended with score ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins!\n\nWould you like to take a 1-minute break?`,
                  [
                    { 
                      text: 'Skip Break', 
                      style: 'cancel',
                      onPress: async () => {
                        await transitionToNextPeriod(period);
                      }
                    },
                    { 
                      text: 'Take Break', 
                      onPress: () => {
                        startBreakTimer();
                      }
                    }
                  ]
                );
              } else {
                // Period 3: Complete match
                Alert.alert(
                  '⏱️ Time Expired',
                  `Priority timer ended with score ${currentFencerAScore}-${currentFencerBScore}.\n\n${winnerName} wins!`,
                  [
                    {
                      text: 'OK',
                      onPress: async () => {
                        await proceedWithMatchCompletion();
                      }
                    }
                  ]
                );
              }
            }
            return; // Don't continue to regular period logic
          }
          
          // Check if scores are tied for any period (use ref to get current value)
          const isTied = currentScores.fencerA === currentScores.fencerB;
          
          // SIMPLE PERIOD LOGIC - Period 1 and 2 show break popup, Period 3 shows completion
          if (currentPeriodValue === 1 || currentPeriodValue === 2) {
            // Period 1 or 2 - show break popup (with priority option if tied)
            if (isTied) {
              // Scores are tied - show 3-button popup with priority option
              Alert.alert(
                'Match Time Complete!',
                `Period ${currentPeriodValue} ended in a tie (${currentScores.fencerA}-${currentScores.fencerB}). Would you like to assign priority?`,
                [
                  { 
                    text: 'Assign Priority', 
                    onPress: () => {
                      // Assign priority without starting priority round (for period 1-2)
                      // Priority will be saved to next period
                      autoAssignPriority(false);
                      // After priority animation completes (3 seconds), show break popup
                      setTimeout(() => {
                        Alert.alert(
                          'Priority Assigned!',
                          'Would you like to take a 1-minute break?',
                          [
                            { 
                              text: 'Skip Break', 
                              style: 'cancel',
                              onPress: async () => {
                                await transitionToNextPeriod(currentPeriodValue);
                              }
                            },
                            { 
                              text: 'Take Break', 
                              onPress: () => {
                                startBreakTimer();
                              }
                            }
                          ]
                        );
                      }, 3500); // Wait for priority animation to complete (3 seconds) + small buffer
                    }
                  },
                  { 
                    text: 'Skip Break', 
                    style: 'cancel',
                    onPress: async () => {
                      await transitionToNextPeriod(currentPeriodValue);
                    }
                  },
                  { 
                    text: 'Take Break', 
                    onPress: () => {
                      startBreakTimer();
                    }
                  }
                ]
              );
            } else {
              // Scores are not tied - show normal break popup
              Alert.alert(
                'Match Time Complete!',
                'Would you like to take a 1-minute break?',
                [
                  { 
                    text: 'Skip Break', 
                    style: 'cancel',
                    onPress: async () => {
                      await transitionToNextPeriod(currentPeriodValue);
                    }
                  },
                  { 
                    text: 'Take Break', 
                    onPress: () => {
                      startBreakTimer();
                    }
                  }
                ]
              );
            }
          } else if (currentPeriodValue === 3) {
            // Period 3 - check if scores are tied
            if (isTied) {
              // Scores are tied - show 2-button popup with priority option
              Alert.alert(
                'Match Time Complete!',
                `Period 3 ended in a tie (${currentScores.fencerA}-${currentScores.fencerB}). Would you like to assign priority?`,
                [
                  { 
                    text: 'Assign Priority', 
                    onPress: () => {
                      // Assign priority and start priority round (for period 3)
                      autoAssignPriority(true);
                      // Priority round will start after animation completes
                    }
                  },
                  { 
                    text: 'Complete Match', 
                    style: 'cancel',
                    onPress: async () => {
                      setTimeRemaining(0);
                      // Complete the match without priority
                      await proceedWithMatchCompletion(currentScores.fencerA, currentScores.fencerB);
                    }
                  }
                ]
              );
            } else {
              // Scores are not tied - show match completion
              Alert.alert('Match Complete!', 'All periods have been completed. Great job!', [
                { 
                  text: 'OK', 
                  onPress: async () => {
                    setTimeRemaining(0);
                    // Complete the match properly - pass current scores
                    await proceedWithMatchCompletion(currentScores.fencerA, currentScores.fencerB);
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
    
    // Reset timeRemaining to prevent timer expiration check from retriggering
    if (!isSabre) {
      setTimeRemaining(matchTime);
    }
    
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
    setHasShownBreakPopup(false); // Reset flag so popup can show again after break
    
    // Start the break countdown
    const interval = setInterval(() => {
      setBreakTimeRemaining(prev => {
        if (prev <= 0) {
          // Break finished
          clearInterval(interval);
          setIsBreakTime(false);
          setBreakTimeRemaining(60);
          
          // For Sabre: Start Period 2 when break completes
          if (selectedWeapon === 'sabre') {
            // Period 1 should already be ended when break was taken
            // Create Period 2 now
            if (currentMatchPeriod && currentMatchPeriod.period_number === 1) {
              (async () => {
                const periodData = {
                  match_id: currentMatchPeriod.match_id,
                  period_number: 2,
                  start_time: new Date().toISOString(),
                  fencer_1_score: scores.fencerA,
                  fencer_2_score: scores.fencerB,
                  fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
                  fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
                };
                
                const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
                if (newPeriodRecord) {
                  setCurrentMatchPeriod(newPeriodRecord);
                  setMatchId(newPeriodRecord.match_id);
                  setCurrentPeriod(2);
                  currentPeriodRef.current = 2;
                }
              })();
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 60;
          }
          
          // For Foil/Epee: Increment period and create new period record
          const nextPeriod = Math.min(currentPeriod + 1, 3);
          
          // End current period and create new one
          if (currentMatchPeriod && nextPeriod > currentPeriod) {
            (async () => {
              await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
                end_time: new Date().toISOString(),
                fencer_1_score: scores.fencerA,
                fencer_2_score: scores.fencerB,
                fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
                fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
              });
              
              const periodData = {
                match_id: currentMatchPeriod.match_id,
                period_number: nextPeriod,
                start_time: new Date().toISOString(),
                fencer_1_score: scores.fencerA,
                fencer_2_score: scores.fencerB,
                fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
                fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
                priority_assigned: priorityFencer || undefined,
                priority_to: priorityFencer === 'fencerA' ? fencerNames.fencerA : priorityFencer === 'fencerB' ? fencerNames.fencerB : undefined,
              };
              
              const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
              if (newPeriodRecord) {
                setCurrentMatchPeriod(newPeriodRecord);
                setMatchId(newPeriodRecord.match_id); // Store match ID safely
              }
            })();
          }
          
          setCurrentPeriod(nextPeriod);
          currentPeriodRef.current = nextPeriod; // Update ref
          
          // Reset break popup flag for next period
          setHasShownBreakPopup(false);
          
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
    if (isSabre) {
      if (breakTimerRef) {
        clearInterval(breakTimerRef);
      }
      setIsBreakTime(false);
      setBreakTimeRemaining(60);
      setHasShownBreakPopup(false);
      return;
    }
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
          fencer_1_score: scores.fencerA,
          fencer_2_score: scores.fencerB,
          fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
          fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
        });
        
        const periodData = {
          match_id: currentMatchPeriod.match_id,
          period_number: nextPeriod,
          start_time: new Date().toISOString(),
          fencer_1_score: scores.fencerA,
          fencer_2_score: scores.fencerB,
          fencer_1_cards: cards.fencerA.yellow + cards.fencerA.red,
          fencer_2_cards: cards.fencerB.yellow + cards.fencerB.red,
          priority_assigned: priorityFencer || undefined,
          priority_to: priorityFencer === 'fencerA' ? fencerNames.fencerA : priorityFencer === 'fencerB' ? fencerNames.fencerB : undefined,
        };
        
        const newPeriodRecord = await matchPeriodService.createMatchPeriod(periodData);
        if (newPeriodRecord) {
          setCurrentMatchPeriod(newPeriodRecord);
          setMatchId(newPeriodRecord.match_id); // Store match ID safely
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

  const assignPriorityWithAnimation = (finalFencer: 'fencerA' | 'fencerB', shouldStartPriorityRound: boolean = true) => {
    setIsAssigningPriority(true);
    setPriorityFencer(null);
    
    // Determine final position based on entity
    const finalPosition = getPositionOfEntity(finalFencer);
    
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
        
        if (shouldStartPriorityRound) {
          // Enter priority round mode (for period 3)
          setIsPriorityRound(true);
          setHasShownPriorityScorePopup(false); // Reset popup flag for new priority round
          
          // Track priority round start
          trackPriorityRoundStart();
          
          // Reset timer to 1 minute for priority round
          setMatchTime(60); // 1 minute
          setTimeRemaining(60);
          setIsPlaying(false); // User must press play to start priority timer
          
          // Show priority result
          setTimeout(() => {
            const priorityFencerName = getNameByEntity(finalFencer);
              
            Alert.alert(
              'Priority Assigned!', 
              `${priorityFencerName} has priority!\n\nTimer reset to 1:00 for sudden death round.\n\nPress Play when ready.`,
              [{ text: 'OK' }]
            );
          }, 500);
        } else {
          // Just assign priority without starting priority round (for period 1-2)
          // Priority is stored in state and will be saved to next period
          const priorityFencerName = getNameByEntity(finalFencer);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Don't show alert here - break popup will be shown by the caller
        }
        
        // Success haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, lightSwitchInterval);
  };

  const assignPriority = () => {
    if (isSabre || isAssigningPriority) return; // Prevent multiple assignments
    
    // Determine random priority (entity-based)
    const randomValue = Math.random();
    const finalFencer = randomValue < 0.5 ? 'fencerA' : 'fencerB';
    
    // Use shared animation function - always start priority round when called from button
    assignPriorityWithAnimation(finalFencer, true);
  };

  const autoAssignPriority = (shouldStartPriorityRound: boolean = true) => {
    if (isSabre || isAssigningPriority) return; // Prevent multiple assignments
    
    // Determine random priority (entity-based)
    const randomValue = Math.random();
    const finalFencer = randomValue < 0.5 ? 'fencerA' : 'fencerB';
    
    // Close popup immediately
    setShowPriorityPopup(false);
    
    // Use shared animation function
    assignPriorityWithAnimation(finalFencer, shouldStartPriorityRound);
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
  const isAndroid = Platform.OS === 'android';
  const decorativeCardWidth = width * (isAndroid ? 0.065 : 0.08);
  const decorativeCardHeight = width * (isAndroid ? 0.1 : 0.12);
  const decorativeCardRadius = width * (isAndroid ? 0.012 : 0.015);
  const decorativeCardCountSize = width * (isAndroid ? 0.026 : 0.03);
  const tabBarHeight = height * 0.08 + insets.bottom;
  const timerReadyDockGap = height * 0.01;
  const fencersContainerBottom = height * (isAndroid ? 0.03 : 0.015);
  const fencersContainerTightBottom = height * (isAndroid ? 0.02 : 0.005);
  const fencersContainerCardsBottom = height * (isAndroid ? 0.012 : 0.01);
  const fencerCardPadding = width * (isAndroid ? 0.035 : 0.04);
  const fencerCardCompactPadding = width * (isAndroid ? 0.028 : 0.03);
  const fencerCardCompactPaddingTimerReady = width * (isAndroid ? 0.022 : 0.03);
  const fencerCardMinHeight = height * (isAndroid ? 0.22 : 0.25);
  const fencerCardMinHeightCompact = height * (isAndroid ? 0.19 : 0.22);
  const fencerCardMinHeightTimerReadyWithCards = height * (isAndroid ? 0.155 : 0.22);
  const fencerCardMinHeightExtended = height * (isAndroid ? 0.28 : 0.32);
  const fencerCardMinHeightTimerReady = height * (isAndroid ? 0.17 : 0.22);
  const sabreFencerCardHeight = height * (isAndroid ? 0.325 : 0.35);
  const sabreFencerCardHeightReady = height * (isAndroid ? 0.355 : 0.375);
  const sabreFencerCardHeightWithCards = height * (isAndroid ? 0.315 : 0.335);
  const sabreFencersContainerBottom = height * (isAndroid ? 0.012 : 0.01);
  const fencerCardTimerReadyPadding = width * (isAndroid ? 0.024 : 0.03);
  const fencerNameMarginBottomTimerReady = height * (isAndroid ? 0.002 : 0.006);
  const fencerScoreMarginBottomTimerReady = height * (isAndroid ? 0.006 : 0.015);
  const timerReadyDockBottom = isAndroid ? tabBarHeight + timerReadyDockGap : height * 0.08;
  const timerReadyBottomControlsGap = height * (isAndroid ? 0.003 : 0.018);
  const timerReadyBottomControlsGapNoCards = timerReadyBottomControlsGap + height * (isAndroid ? 0.006 : 0.008);
  const timerReadyPlayBlockGap = height * (isAndroid ? 0.001 : 0.012);
  const timerReadyPlayBlockMarginTop = height * (isAndroid ? 0 : 0.006);
  const timerReadyPlayBlockMarginVertical = height * (isAndroid ? 0 : 0.012);
  const timerReadyPlayButtonPadding = height * (isAndroid ? 0.038 : 0.038);
  const timerReadyPlayButtonMinHeight = height * (isAndroid ? 0.13 : 0.12);
  const timerReadyResetButtonPadding = height * (isAndroid ? 0.006 : 0.012);
  const timerReadyResetButtonMinHeight = height * (isAndroid ? 0.04 : 0.055);
  const timerReadyResetButtonWidth = width * (isAndroid ? 0.12 : 0.15);
  const timerReadyInjuryPaddingVertical = height * (isAndroid ? 0.01 : 0.012);

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
      overflow: 'hidden', // Force iOS to respect borderRadius
      // Shadow effects
      shadowColor: Colors.timerBackground.shadowColor,
      shadowOffset: Colors.timerBackground.shadowOffset,
      shadowOpacity: Colors.timerBackground.shadowOpacity,
      shadowRadius: Colors.timerBackground.shadowRadius,
      elevation: Colors.timerBackground.elevation,
    },
    timerLabel: {
      position: 'absolute',
      width: width * 0.20, // Reduced from 0.24 to make smaller
      height: height * 0.025, // Reduced from 0.03 to make smaller
      left: '50%', // Center horizontally
      marginLeft: -(width * 0.20) / 2, // Half of new width to center properly
      top: -height * 0.028, // Moved pill higher up, more outside card
      backgroundColor: Colors.yellow.accent,
      borderRadius: width * 0.035, // Reduced from 0.04 to match smaller size
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    timerLabelText: {
      fontSize: width * 0.022, // Reduced from 0.025 to match smaller pill
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
    matchInsightsContainer: {
      width: '100%',
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.005,
      gap: height * 0.006,
    },
    insightItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: height * 0.005,
    },
    insightIcon: {
      fontSize: width * 0.05,
      marginRight: width * 0.03,
      marginTop: height * 0.002,
    },
    insightContent: {
      flex: 1,
    },
    insightLabel: {
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.6)',
      fontWeight: '400',
      marginBottom: height * 0.003,
    },
    insightValue: {
      fontSize: width * 0.035,
      color: 'white',
      fontWeight: '600',
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
      fontSize: width * 0.085, // Slightly reduced from 0.09 when warning text shows
      color: 'white',
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: height * 0.001 },
      textShadowRadius: width * 0.002,
      marginTop: -(height * 0.03), // Moved up from -0.008
    },
    countdownTextLarge: {
      fontSize: width * 0.12, // Larger font size when match hasn't started
      color: 'white',
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: height * 0.001 },
      textShadowRadius: width * 0.002,
      marginTop: -(height * 0.03), // Moved up from -0.008
    },
    countdownTextWarning: {
      fontSize: width * 0.085, // Slightly reduced from 0.09 when warning text shows
      color: Colors.yellow.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: height * 0.002 },
      textShadowRadius: width * 0.005,
      marginTop: -(height * 0.03), // Moved up from -0.015
    },
    countdownTextDanger: {
      fontSize: width * 0.105, // Slightly reduced from 0.11 when warning text shows
      color: Colors.red.accent,
      fontWeight: '700',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      marginTop: -(height * 0.03), // Moved up from -0.015
    },
    countdownTextDangerPulse: {
      fontSize: width * 0.105, // Slightly reduced from 0.11 when warning text shows
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
    offlineBanner: {
      marginBottom: layout.adjustMargin(height * 0.015, 'bottom'),
      borderRadius: width * 0.02,
      overflow: 'hidden',
      marginHorizontal: width * 0.01,
    },
    offlineBannerOffline: {
      backgroundColor: '#FF6B6B',
    },
    offlineBannerPending: {
      backgroundColor: '#4ECDC4',
    },
    offlineBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: layout.adjustPadding(height * 0.015, 'bottom'),
      paddingHorizontal: width * 0.04,
      gap: width * 0.025,
    },
    offlineBannerText: {
      color: 'white',
      fontSize: width * 0.035,
      fontWeight: '600',
    },
    periodControl: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#E6DDFF',
      borderRadius: width * 0.03,
      padding: width * 0.025,
      marginTop: -(height * 0.01), // Increased negative margin to move period card up more
      borderWidth: width * 0.0025,
      borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    periodControlMatchStarted: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#E6DDFF',
      borderRadius: width * 0.03,
      padding: width * 0.025,
      marginTop: height * 0.025, // Increased margin when match has started
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
    periodButtonDisabled: {
      backgroundColor: '#4C4C4C',
      borderColor: 'rgba(255,255,255,0.12)',
      shadowOpacity: 0,
      elevation: 0,
      opacity: 0.6,
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
      marginBottom: fencersContainerBottom, // Extra breathing room on Android
      gap: width * 0.03, // Smaller gap on Nexus S
    },
    fencerCard: {
      width: width * 0.42, // Slightly wider on Nexus S for better fit
      padding: fencerCardPadding,
      minHeight: fencerCardMinHeight,
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
      fontSize: width * 0.13,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.015,
    },
    scoreControls: {
      flexDirection: 'row',
      gap: width * 0.035,
    },
    scoreButton: {
      width: width * 0.145,
      height: width * 0.145,
      borderRadius: width * 0.0725,
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
    doubleHitButton: {
      width: width * 0.13,
      height: width * 0.13,
      borderRadius: width * 0.065,
      alignItems: 'center',
      justifyContent: 'center',
      bottom: height * 0.08,
      // Base styles match weaponButton
      // backgroundColor and borderColor will be set inline based on pressed state
    },
    doubleHitButtonText: {
      color: '#FFFFFF',
      fontSize: width * 0.022,
      fontWeight: '600',
      marginTop: width * 0.005,
    },
    weaponSelectionContainer: {
      position: 'absolute',
      top: height * 0.004,
      right: width * 0.02,
      alignItems: 'flex-end',
      zIndex: 10,
    },
    weaponSelectionLabel: {
      color: '#FFFFFF',
      fontSize: width * 0.028,
      fontWeight: '600',
      marginBottom: height * 0.008,
    },
    weaponButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: width * 0.015,
    },
    weaponButton: {
      width: width * 0.09,
      height: width * 0.09,
      borderRadius: width * 0.045,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: height * 0.003,
    },
    weaponButtonSelected: {
      backgroundColor: 'rgba(108, 92, 231, 0.3)',
      borderColor: '#6C5CE7',
      borderWidth: 2,
    },
    weaponButtonLabel: {
      color: '#9D9D9D',
      fontSize: width * 0.018,
      fontWeight: '500',
      marginTop: width * 0.003,
    },
    weaponButtonLabelSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
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
      width: decorativeCardWidth,
      height: decorativeCardHeight,
      borderRadius: decorativeCardRadius,
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
      width: width * 0.9, // Use consistent width for both iOS and Android
      maxWidth: width * 0.95,
      alignItems: 'center',
      alignSelf: 'center',
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
      width: '90%', // Make buttons wider for better usability on iOS
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
      width: '90%', // Make buttons wider for better usability on iOS
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
	      marginTop: height * 0.02, // Increased from 0.005 to move buttons down
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
      marginTop: height * 0.008, // Reduced from 0.015 to bring closer to countdown
      marginBottom: height * 0.002, // Reduced from 0.005 to bring closer to next warning
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
    switchTrackLocked: {
      opacity: 0.55,
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
      fontSize: decorativeCardCountSize,
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
    const entity = getEntityAtPosition('left');
    setCards(prev => ({
      ...prev,
      [entity]: { yellow: 0, red: 0 }
    }));
    
    // Log the card resets
    logMatchEvent('card', entity, 'yellow'); // Log yellow card reset
    logMatchEvent('card', entity, 'red'); // Log red card reset
    
    console.log('  All cards cleared for Alice');
  };

  const resetBobCards = () => {
    console.log('🔄 RESETTING BOB CARDS');
    const entity = getEntityAtPosition('right');
    setCards(prev => ({
      ...prev,
      [entity]: { yellow: 0, red: 0 }
    }));
    
    // Log the card resets
    logMatchEvent('card', entity, 'yellow'); // Log yellow card reset
    logMatchEvent('card', entity, 'red'); // Log red card reset
    
    console.log('  All cards cleared for Bob');
  };

  const resetAllCards = () => {
    console.log('🔄 RESETTING ALL CARDS FOR BOTH FENCERS');
    // Reset all cards
    setCards({ fencerA: { yellow: 0, red: 0 }, fencerB: { yellow: 0, red: 0 } });
    
    // Log the card resets
    logMatchEvent('card', 'fencerA', 'yellow'); // Log yellow card reset
    logMatchEvent('card', 'fencerA', 'red'); // Log red card reset
    logMatchEvent('card', 'fencerB', 'yellow'); // Log yellow card reset
    logMatchEvent('card', 'fencerB', 'red'); // Log red card reset
    
    console.log('  All cards cleared for both fencers');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const addYellowCardToAlice = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    // Pause timer when card is issued
    if (isPlaying) {
      pauseTimer();
    }
    
    const entity = getEntityAtPosition('left');
    const opponentEntity = entity === 'fencerA' ? 'fencerB' : 'fencerA';
    let convertedToRed = false;
    
    // NEW CLEAN LOGIC: Use pure function with case statement
    setCards(prev => {
      const prevCards = prev[entity];
      const newState = applyYellow(prevCards);
      console.log('🟡 LEFT FENCER - Adding Yellow Card:');
      console.log('  Previous state:', prevCards);
      console.log('  New state:', newState);
      
      // If this yellow card resulted in a red card, give opponent a point
      if (newState.red > prevCards.red) {
        convertedToRed = true;
        setScores(prevScores => ({
          ...prevScores,
          [opponentEntity]: prevScores[opponentEntity] + 1
        }));
        console.log('🔴 Yellow converted to red → Opponent gets +1 point');
        logMatchEvent('card', entity, 'red'); // Log the red card conversion
      }
      
      return {
        ...prev,
        [entity]: newState
      };
    });
    
    // For Sabre: start the match on first card and create remote session + Period 1
    if (selectedWeapon === 'sabre' && !hasMatchStarted) {
      setHasMatchStarted(true);
      console.log('🏁 Sabre match started with first yellow card');
      const resolvedGuestNames = resolveGuestNamesIfNeeded();
      // Ensure remote session exists
      const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
      // Create Period 1 for sabre match
      if (session && !currentMatchPeriod) {
        const playClickTime = new Date().toISOString();
        const period = await createMatchPeriod(session, playClickTime);
        if (period) {
          setCurrentMatchPeriod(period);
          setMatchId(period.match_id || null);
        }
      }
    }
    
    // Create match event for the yellow card
    await createMatchEvent('user', 'yellow', entity);
    if (convertedToRed) {
      await createMatchEvent('user', 'red', entity);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addYellowCardToBob = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    // Pause timer when card is issued
    if (isPlaying) {
      pauseTimer();
    }
    
    const entity = getEntityAtPosition('right');
    const opponentEntity = entity === 'fencerA' ? 'fencerB' : 'fencerA';
    let convertedToRed = false;
    
    // NEW CLEAN LOGIC: Use pure function with case statement
    setCards(prev => {
      const prevCards = prev[entity];
      const newState = applyYellow(prevCards);
      console.log('🟡 RIGHT FENCER - Adding Yellow Card:');
      console.log('  Previous state:', prevCards);
      console.log('  New state:', newState);
      
      // If this yellow card resulted in a red card, give opponent a point
      if (newState.red > prevCards.red) {
        convertedToRed = true;
        setScores(prevScores => ({
          ...prevScores,
          [opponentEntity]: prevScores[opponentEntity] + 1
        }));
        console.log('🔴 Yellow converted to red → Opponent gets +1 point');
        logMatchEvent('card', entity, 'red'); // Log the red card conversion
      }
      
      return {
        ...prev,
        [entity]: newState
      };
    });
    
    // For Sabre: start the match on first card and create remote session + Period 1
    if (selectedWeapon === 'sabre' && !hasMatchStarted) {
      setHasMatchStarted(true);
      console.log('🏁 Sabre match started with first yellow card');
      const resolvedGuestNames = resolveGuestNamesIfNeeded();
      // Ensure remote session exists
      const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
      // Create Period 1 for sabre match
      if (session && !currentMatchPeriod) {
        const playClickTime = new Date().toISOString();
        const period = await createMatchPeriod(session, playClickTime);
        if (period) {
          setCurrentMatchPeriod(period);
          setMatchId(period.match_id || null);
        }
      }
    }
    
    // Create match event for the yellow card
    await createMatchEvent('opponent', 'yellow', entity);
    if (convertedToRed) {
      await createMatchEvent('opponent', 'red', entity);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Red card management functions
  const addRedCardToAlice = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    const entity = getEntityAtPosition('left');
    const opponentEntity = entity === 'fencerA' ? 'fencerB' : 'fencerA';
    const currentRedCount = cards[entity].red;
    
    if (currentRedCount > 0) {
      // Show popup asking if user wants to remove or add
      Alert.alert(
        'Red Cards',
        `${getNameByEntity(entity)} already has red cards. What would you like to do?`,
        [
          {
            text: 'Remove One',
            style: 'destructive',
            onPress: () => {
              const newRedCount = Math.max(0, currentRedCount - 1);
              setCards(prev => ({
                ...prev,
                [entity]: { ...prev[entity], red: newRedCount }
              }));
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
              // For Sabre: start the match on first card and create remote session + Period 1
              if (selectedWeapon === 'sabre' && !hasMatchStarted) {
                setHasMatchStarted(true);
                console.log('🏁 Sabre match started with first red card');
                const resolvedGuestNames = resolveGuestNamesIfNeeded();
                // Ensure remote session exists
                const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
                // Create Period 1 for sabre match
                if (session && !currentMatchPeriod) {
                  const playClickTime = new Date().toISOString();
                  const period = await createMatchPeriod(session, playClickTime);
                  if (period) {
                    setCurrentMatchPeriod(period);
                    setMatchId(period.match_id || null);
                  }
                }
              }
              const newRedCount = currentRedCount + 1;
              setCards(prev => ({
                ...prev,
                [entity]: { ...prev[entity], red: newRedCount }
              }));
              // Give opponent 1 point for red card
              setScores(prev => ({
                ...prev,
                [opponentEntity]: prev[opponentEntity] + 1
              }));
              console.log('🔴 Red card issued → Opponent gets +1 point');
              // Create match event for the red card
              await createMatchEvent('user', 'red', entity);
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
      // For Sabre: start the match on first card and create remote session + Period 1
      if (selectedWeapon === 'sabre' && !hasMatchStarted) {
        setHasMatchStarted(true);
        console.log('🏁 Sabre match started with first red card');
        const resolvedGuestNames = resolveGuestNamesIfNeeded();
        // Ensure remote session exists
        const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
        // Create Period 1 for sabre match
        if (session && !currentMatchPeriod) {
          const playClickTime = new Date().toISOString();
          const period = await createMatchPeriod(session, playClickTime);
          if (period) {
            setCurrentMatchPeriod(period);
            setMatchId(period.match_id || null);
          }
        }
      }
      // First red card - add directly
      setCards(prev => ({
        ...prev,
        [entity]: { ...prev[entity], red: 1 }
      }));
      // Give opponent 1 point for red card
      setScores(prev => ({
        ...prev,
        [opponentEntity]: prev[opponentEntity] + 1
      }));
      console.log('🔴 Red card issued → Opponent gets +1 point');
      // Create match event for the red card
      await createMatchEvent('user', 'red', entity);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const addRedCardToBob = async () => {
    setHasNavigatedAway(false); // Reset navigation flag when changing cards
    const entity = getEntityAtPosition('right');
    const opponentEntity = entity === 'fencerA' ? 'fencerB' : 'fencerA';
    const currentRedCount = cards[entity].red;
    
    if (currentRedCount > 0) {
      // Show popup asking if user wants to remove or add
      Alert.alert(
        'Red Cards',
        `${getNameByEntity(entity)} already has red cards. What would you like to do?`,
        [
          {
            text: 'Remove One',
            style: 'destructive',
            onPress: () => {
              const newRedCount = Math.max(0, currentRedCount - 1);
              setCards(prev => ({
                ...prev,
                [entity]: { ...prev[entity], red: newRedCount }
              }));
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
              // For Sabre: start the match on first card and create remote session + Period 1
              if (selectedWeapon === 'sabre' && !hasMatchStarted) {
                setHasMatchStarted(true);
                console.log('🏁 Sabre match started with first red card');
                const resolvedGuestNames = resolveGuestNamesIfNeeded();
                // Ensure remote session exists
                const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
                // Create Period 1 for sabre match
                if (session && !currentMatchPeriod) {
                  const playClickTime = new Date().toISOString();
                  const period = await createMatchPeriod(session, playClickTime);
                  if (period) {
                    setCurrentMatchPeriod(period);
                    setMatchId(period.match_id || null);
                  }
                }
              }
              const newRedCount = currentRedCount + 1;
              setCards(prev => ({
                ...prev,
                [entity]: { ...prev[entity], red: newRedCount }
              }));
              // Give opponent 1 point for red card
              setScores(prev => ({
                ...prev,
                [opponentEntity]: prev[opponentEntity] + 1
              }));
              console.log('🔴 Red card issued → Opponent gets +1 point');
              // Create match event for the red card
              await createMatchEvent('opponent', 'red', entity);
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
      // For Sabre: start the match on first card and create remote session + Period 1
      if (selectedWeapon === 'sabre' && !hasMatchStarted) {
        setHasMatchStarted(true);
        console.log('🏁 Sabre match started with first red card');
        const resolvedGuestNames = resolveGuestNamesIfNeeded();
        // Ensure remote session exists
        const session = await ensureRemoteSession(resolvedGuestNames ?? undefined);
        // Create Period 1 for sabre match
        if (session && !currentMatchPeriod) {
          const playClickTime = new Date().toISOString();
          const period = await createMatchPeriod(session, playClickTime);
          if (period) {
            setCurrentMatchPeriod(period);
            setMatchId(period.match_id || null);
          }
        }
      }
      // First red card - add directly
      setCards(prev => ({
        ...prev,
        [entity]: { ...prev[entity], red: 1 }
      }));
      // Give opponent 1 point for red card
      setScores(prev => ({
        ...prev,
        [opponentEntity]: prev[opponentEntity] + 1
      }));
      console.log('🔴 Red card issued → Opponent gets +1 point');
      // Create match event for the red card
      await createMatchEvent('opponent', 'red', entity);
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

  // Compute entity-based card values for JSX rendering
  const leftEntity = getEntityAtPosition('left');
  const rightEntity = getEntityAtPosition('right');
  const leftYellowCards = cards[leftEntity].yellow === 1 ? [1] : [];
  const leftRedCards = cards[leftEntity].red > 0 ? [cards[leftEntity].red] : [];
  const rightYellowCards = cards[rightEntity].yellow === 1 ? [1] : [];
  const rightRedCards = cards[rightEntity].red > 0 ? [cards[rightEntity].red] : [];
  const hasIssuedCards =
    leftYellowCards.length > 0 ||
    leftRedCards.length > 0 ||
    rightYellowCards.length > 0 ||
    rightRedCards.length > 0;
  const inProgressWithCards = hasMatchStarted && hasIssuedCards && selectedWeapon !== 'sabre';
  const sabreHasIssuedCards = isSabre && hasIssuedCards;
  const sabreMatchReady = isSabre && !hasMatchStarted && !isPlaying;
  const canAssignPriority = !isSabre && timeRemaining === 0 && scores.fencerA === scores.fencerB;
  const sabreCardHeight = sabreHasIssuedCards
    ? sabreFencerCardHeightWithCards
    : sabreMatchReady
      ? sabreFencerCardHeightReady
      : sabreFencerCardHeight;
  const sabreProfileSize = width * (sabreHasIssuedCards ? 0.135 : 0.16);
  const sabreProfileRadius = sabreProfileSize / 2;
  const sabreScoreButtonSize = width * (sabreHasIssuedCards ? 0.145 : 0.165);
  const sabreScoreButtonRadius = sabreScoreButtonSize / 2;
  const sabreScoreIconSize = sabreHasIssuedCards ? 32 : 38;
  const sabreScoreFontSize = width * (sabreHasIssuedCards ? 0.115 : 0.13);
  const sabreScoreMarginBottom = sabreHasIssuedCards ? height * 0.006 : undefined;
  const sabreNameMarginBottom = sabreHasIssuedCards ? height * 0.004 : undefined;
  const sabreScoreControlsGap = sabreHasIssuedCards ? width * 0.028 : undefined;
  const sabreSwitchTranslateX = showUserProfile ? (sabreHasIssuedCards ? width * 0.058 : width * 0.065) : 0;

  const isNonSabreTimerReady =
    selectedWeapon !== 'sabre' &&
    !hasMatchStarted &&
    !isPlaying &&
    timeRemaining === matchTime;

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
          
          {/* Offline Status Banner - Shows for 1.5 seconds then auto-dismisses */}
          {/* Only show offline banner when offline, or pending banner when online with pending items */}
          {((isOffline && showOfflineBanner) || (!isOffline && showPendingBanner && (pendingMatchesCount > 0 || pendingEventsCount > 0))) && (
            <View style={[
              styles.offlineBanner,
              isOffline ? styles.offlineBannerOffline : styles.offlineBannerPending
            ]}>
              <View style={styles.offlineBannerContent}>
                <Ionicons 
                  name={isOffline ? "cloud-offline-outline" : isSyncing ? "sync" : "cloud-upload-outline"} 
                  size={18} 
                  color="white"
                />
                <Text style={styles.offlineBannerText}>
                  {isSyncing 
                    ? "Syncing..." 
                    : isOffline 
                      ? "Offline - Data will sync when online"
                      : `${pendingMatchesCount + pendingEventsCount} item${pendingMatchesCount + pendingEventsCount === 1 ? '' : 's'} pending sync`}
                </Text>
              </View>
            </View>
          )}
          
          {/* Match Timer Section */}
      <View style={{ overflow: 'visible', position: 'relative' }}>
        {/* Period Label - Positioned outside card */}
        <View style={styles.timerLabel}>
          <Text style={styles.timerLabelText}>{selectedWeapon === 'sabre' ? 'Match Insights' : 'Match Timer'}</Text>
        </View>
        
        <LinearGradient
          colors={Colors.timerBackground.colors}
          style={styles.matchTimerCard}
          start={Colors.timerBackground.start}
          end={Colors.timerBackground.end}
        >
          {/* Weapon Selection UI - Only visible before match starts */}
          {!hasMatchStarted && !isPlaying && (
            <View style={styles.weaponSelectionContainer}>
              <View style={styles.weaponButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.weaponButton,
                    selectedWeapon === 'foil' && styles.weaponButtonSelected
                  ]}
                  onPress={() => {
                    weaponSelectionLockedRef.current = true;
                    setSelectedWeapon('foil');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {weaponSvgs.foil ? (
                    <SvgXml
                      xml={weaponSvgs.foil}
                      width={weaponIconSize}
                      height={weaponIconSize}
                      color={selectedWeapon === 'foil' ? '#FFFFFF' : '#9D9D9D'}
                    />
                  ) : (
                    <Ionicons 
                      name="flash" 
                      size={weaponIconSize} 
                      color={selectedWeapon === 'foil' ? '#FFFFFF' : '#9D9D9D'} 
                    />
                  )}
                  <Text style={[
                    styles.weaponButtonLabel,
                    selectedWeapon === 'foil' && styles.weaponButtonLabelSelected
                  ]}>
                    Foil
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.weaponButton,
                    selectedWeapon === 'epee' && styles.weaponButtonSelected
                  ]}
                  onPress={() => {
                    weaponSelectionLockedRef.current = true;
                    setSelectedWeapon('epee');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {weaponSvgs.epee ? (
                    <SvgXml
                      xml={weaponSvgs.epee}
                      width={weaponIconSize}
                      height={weaponIconSize}
                      color={selectedWeapon === 'epee' ? '#FFFFFF' : '#9D9D9D'}
                    />
                  ) : (
                    <Ionicons 
                      name="shield" 
                      size={weaponIconSize} 
                      color={selectedWeapon === 'epee' ? '#FFFFFF' : '#9D9D9D'} 
                    />
                  )}
                  <Text style={[
                    styles.weaponButtonLabel,
                    selectedWeapon === 'epee' && styles.weaponButtonLabelSelected
                  ]}>
                    Epee
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.weaponButton,
                    selectedWeapon === 'sabre' && styles.weaponButtonSelected
                  ]}
                  onPress={() => {
                    weaponSelectionLockedRef.current = true;
                    setSelectedWeapon('sabre');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {weaponSvgs.sabre ? (
                    <SvgXml
                      xml={weaponSvgs.sabre}
                      width={weaponIconSize}
                      height={weaponIconSize}
                      color={selectedWeapon === 'sabre' ? '#FFFFFF' : '#9D9D9D'}
                    />
                  ) : (
                    <Ionicons 
                      name="flame" 
                      size={weaponIconSize} 
                      color={selectedWeapon === 'sabre' ? '#FFFFFF' : '#9D9D9D'} 
                    />
                  )}
                  <Text style={[
                    styles.weaponButtonLabel,
                    selectedWeapon === 'sabre' && styles.weaponButtonLabelSelected
                  ]}>
                    Sabre
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <View style={styles.timerHeader}>
          {!isPlaying && !hasMatchStarted && selectedWeapon !== 'sabre' && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditTime}>
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
          )}
          {hasMatchStarted && scores.fencerA + scores.fencerB > 0 && !isInjuryTimer && (
            <TouchableOpacity 
              style={styles.completeMatchCircle} 
              onPress={() => setShowFinishMatchConfirm(true)}
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
                {isSabre
                  ? (currentPeriod < 2 ? '🍃 Break Time - Next: Period 2' : '🍃 Break Time')
                  : `🍃 Break Time - Next: Period ${Math.min(currentPeriod + 1, 3)}`}
              </Text>
            </View>
          )}
          
          {/* Injury Timer Display - shows when injury timer is active (higher priority than match timer) */}
          {/* Hide injury timer when priority should be shown (tied scores at period end) */}
          {!isBreakTime && isInjuryTimer && !(timeRemaining === 0 && scores.fencerA === scores.fencerB) && (
            <View style={[styles.countdownDisplay, { 
              backgroundColor: hasMatchStarted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
              borderWidth: width * 0.003,
              borderColor: hasMatchStarted ? '#EF4444' : '#6B7280',
              borderRadius: width * 0.02,
              paddingVertical: height * 0.015,
              paddingHorizontal: width * 0.04,
              width: '96%',
              minHeight: height * 0.10,
              marginBottom: height * 0.01,
              opacity: hasMatchStarted ? 1 : 0.6,
              alignSelf: 'center'
            }]}>
              <Text style={[styles.countdownText, { 
                color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                fontSize: width * 0.055,
                marginTop: height * 0.01
              }]}>
                {formatTime(injuryTimeRemaining)}
              </Text>
              {previousMatchState && (
                <Text style={[styles.countdownWarningText, { 
                  color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                  fontSize: width * 0.025 
                }]}>
                  Match paused at {formatTime(previousMatchState.timeRemaining)}
                </Text>
              )}
              <Text style={[styles.countdownWarningText, { 
                color: hasMatchStarted ? '#EF4444' : '#6B7280', 
                fontSize: width * 0.022,
                marginTop: height * 0.015
              }]}>
                🏥 INJURY TIME
              </Text>
            </View>
          )}
          
          {/* Match Insights Display - Only for Sabre */}
          {!isBreakTime && !isInjuryTimer && selectedWeapon === 'sabre' && (
            <View style={styles.matchInsightsContainer}>
              {/* Current Lead - Always show */}
              <View style={styles.insightItem}>
                <Text style={styles.insightIcon}>🎯</Text>
                <View style={styles.insightContent}>
                  <Text style={styles.insightLabel}>Current Lead</Text>
                  <Text style={styles.insightValue}>
                    {!hasMatchStarted
                      ? 'Match not started'
                      : scores.fencerA === scores.fencerB
                      ? 'Tied'
                      : scores.fencerA > scores.fencerB
                      ? `${fencerNames.fencerA} leading by ${scores.fencerA - scores.fencerB}`
                      : `${fencerNames.fencerB} leading by ${scores.fencerB - scores.fencerA}`}
                  </Text>
                </View>
              </View>

              {/* Momentum Indicator - Always show */}
              <View style={styles.insightItem}>
                <Text style={styles.insightIcon}>🔥</Text>
                <View style={styles.insightContent}>
                  <Text style={styles.insightLabel}>Momentum</Text>
                  <Text style={styles.insightValue}>
                    {!hasMatchStarted || momentumStreak.count < 2 || !momentumStreak.lastScorer
                      ? 'No active momentum'
                      : `${fencerNames[momentumStreak.lastScorer]} on a streak (${momentumStreak.count} in a row)`}
                  </Text>
                </View>
              </View>

              {/* Break Warning - Always show */}
              <View style={styles.insightItem}>
                <Text style={styles.insightIcon}>⚠️</Text>
                <View style={styles.insightContent}>
                  <Text style={styles.insightLabel}>Break Warning</Text>
                  <Text style={styles.insightValue}>
                    {!hasMatchStarted
                      ? 'Break at 8 points'
                      : (() => {
                          const pointsAwayFromBreakA = Math.max(0, 8 - scores.fencerA);
                          const pointsAwayFromBreakB = Math.max(0, 8 - scores.fencerB);
                          const closestPointsAway = Math.min(pointsAwayFromBreakA, pointsAwayFromBreakB);
                          
                          if (closestPointsAway === 0) {
                            return 'Break at 8 points';
                          }
                          
                          const closestFencer = pointsAwayFromBreakA <= pointsAwayFromBreakB ? 'fencerA' : 'fencerB';
                          return `${fencerNames[closestFencer]} is ${closestPointsAway} point${closestPointsAway === 1 ? '' : 's'} away from break`;
                        })()}
                  </Text>
                </View>
              </View>

            </View>
          )}

          {/* Other Timer Displays - only show when NOT break time AND NOT injury time - Hidden for Sabre */}
          {!isBreakTime && !isInjuryTimer && selectedWeapon !== 'sabre' && (
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
                    <Text style={[styles.countdownWarningText, { marginTop: height * 0.005, marginBottom: height * 0.002 }]}>
                      ⚠️ Time is running out!
                    </Text>
                  )}
                  
                  {/* Final countdown warning */}
                  {timeRemaining <= 10 && timeRemaining > 0 && (
                    <Text style={[styles.countdownWarningText, { color: Colors.red.accent, fontSize: width * 0.035, marginTop: height * 0.002, marginBottom: height * 0.002 }]}>
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
                    {scores.fencerA === scores.fencerB ? '🏁 Match Ended in Tie!' : '🏁 Match Complete!'}
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
                  <Text style={!hasMatchStarted ? styles.countdownTextLarge : styles.countdownText}>
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
          
		          {/* Add Time Controls - Hidden for Sabre */}
		          {!isPlaying && timeRemaining === matchTime && !hasMatchStarted && selectedWeapon !== 'sabre' && (
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
        <View style={hasMatchStarted ? styles.periodControlMatchStarted : styles.periodControl}>
          <TouchableOpacity
            style={[styles.periodButton, isSabre && styles.periodButtonDisabled]}
            onPress={decrementPeriod}
            disabled={isSabre}
          >
            <Ionicons name="remove" size={16} color={isSabre ? 'rgba(255, 255, 255, 0.6)' : 'white'} />
          </TouchableOpacity>
          <View style={styles.periodDisplay}>
            <Text style={styles.periodText}>Period</Text>
            <Text style={styles.periodNumber}>
              {isPriorityRound ? 'P' : selectedWeapon === 'sabre' ? `${breakTriggered ? 2 : 1}/2` : `${currentPeriod}/3`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.periodButton, isSabre && styles.periodButtonDisabled]}
            onPress={incrementPeriod}
            disabled={isSabre}
          >
            <Ionicons name="add" size={16} color={isSabre ? 'rgba(255, 255, 255, 0.6)' : 'white'} />
          </TouchableOpacity>
        </View>
        
      </LinearGradient>
      </View>

		      {/* Match Status Display - Show for Foil/Epee always, hidden for Sabre (shown inline with Fencers instead) */}
		      {selectedWeapon !== 'sabre' && (
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
		      )}

      {/* Fencers Section */}
      <View style={[styles.fencersHeader, { 
            marginTop: selectedWeapon === 'sabre' 
              ? height * 0.012  // Proper spacing below Match Insights card for sabre
              : (hasMatchStarted && leftYellowCards.length === 0 && leftRedCards.length === 0 && rightYellowCards.length === 0 && rightRedCards.length === 0)
                ? -(height * 0.02)  // Move up when match in progress and no cards
                : -(height * 0.035),  // Original positioning for other states
            marginBottom: selectedWeapon === 'sabre' ? height * 0.002 : undefined
          }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: width * 0.04 }}>
          <Text style={[styles.fencersHeading, selectedWeapon === 'sabre' && !isBreakTime && { marginTop: 0, marginBottom: 0 }]}>Fencers</Text>
          {/* Match status for Sabre - on same line as Fencers, matches matchStatusText style exactly */}
          {selectedWeapon === 'sabre' && !isBreakTime && (
            <Text style={[styles.matchStatusText, { 
              textAlign: 'left', 
              marginTop: 0, 
              marginBottom: 0
            }]}>
              {!hasMatchStarted ? '⚪ Match Ready' : '🟢 Match in Progress'}
            </Text>
          )}
        </View>
        {selectedWeapon === 'sabre' ? (
          <TouchableOpacity 
            style={[styles.editNamesButton, { 
              backgroundColor: '#FB5D5C',
              width: width * 0.09,
              height: width * 0.09,
            }]}
            onPress={() => setShowResetPopup(true)}
          >
            <Ionicons name="refresh" size={22} color="white" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.editNamesButton}
            onPress={openEditNamesPopup}
          >
            <Ionicons name="pencil" size={16} color="white" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={[
        styles.fencersContainer,
        // Tighten spacing when match is in progress and cards are issued
        inProgressWithCards ? {
          marginBottom: fencersContainerCardsBottom,
        } : {},
        // Reduce margin when match is in progress and no cards issued
        (hasMatchStarted && leftYellowCards.length === 0 && leftRedCards.length === 0 && rightYellowCards.length === 0 && rightRedCards.length === 0) ? {
          marginBottom: fencersContainerTightBottom,
        } : {},
        // Move fencer cards up and closer for sabre
        selectedWeapon === 'sabre' ? {
          marginTop: height * 0.006, // Reduced margin to bring cards closer to "Fencers" text
          marginBottom: sabreFencersContainerBottom, // Keep controls visible when cards are issued
        } : {}
      ]}>
        {/* Alice's Card */}
        <View style={[
          styles.fencerCard, 
          { backgroundColor: 'rgb(252,187,187)' },
          // Slightly shorter cards in timer-ready state on Android to avoid overlap
          (isNonSabreTimerReady && isAndroid) ? {
            padding: fencerCardTimerReadyPadding,
            minHeight: fencerCardMinHeightTimerReady,
          } : {},
          // Make fencer card smaller when timer is ready AND cards are present
          (!hasMatchStarted && (leftYellowCards.length > 0 || leftRedCards.length > 0 || rightYellowCards.length > 0 || rightRedCards.length > 0)) ? {
            width: width * 0.42, // Keep width at 0.42 (same as non-conditional)
            padding: isNonSabreTimerReady ? fencerCardCompactPaddingTimerReady : fencerCardCompactPadding,
            minHeight: isNonSabreTimerReady ? fencerCardMinHeightTimerReadyWithCards : fencerCardMinHeightCompact,
          } : 
          // Make fencer cards longer when match is in progress and no cards issued
          (hasMatchStarted && leftYellowCards.length === 0 && leftRedCards.length === 0 && rightYellowCards.length === 0 && rightRedCards.length === 0) ? {
            width: width * 0.42, // Keep width at 0.42
            padding: fencerCardPadding,
            minHeight: fencerCardMinHeightExtended,
          } : {},
          // Make fencer cards taller for sabre
          selectedWeapon === 'sabre' ? {
            minHeight: sabreCardHeight,
            maxHeight: sabreCardHeight,
            padding: sabreHasIssuedCards ? fencerCardCompactPadding : fencerCardPadding,
          } : {}
        ]}>
        {/* Sliding Switch - Top Left - Only show when toggle is on left card */}
          {toggleCardPosition === 'left' && (
            <View style={[styles.slidingSwitch, { 
              position: 'absolute', 
              top: sabreHasIssuedCards ? width * 0.015 : width * 0.02, 
              left: width * 0.02, 
              zIndex: 5 
            },
            sabreHasIssuedCards && {
              width: width * 0.105,
              height: width * 0.052,
              borderRadius: width * 0.026,
            }
            ]}>
              <TouchableOpacity 
                style={[
                  styles.switchTrack, 
                  { backgroundColor: showUserProfile ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' },
                  hasMatchStarted && styles.switchTrackLocked
                ]}
                onPress={toggleUserProfile}
              >
                <View style={[
                  styles.switchThumb, 
                  sabreHasIssuedCards && {
                    width: width * 0.045,
                    height: width * 0.045,
                    borderRadius: width * 0.0225,
                    top: width * 0.0035,
                  },
                  { 
                    transform: [{ translateX: sabreSwitchTranslateX }]
                  }
                ]}>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={[
            styles.profileContainer,
            sabreHasIssuedCards && toggleCardPosition === 'left' && { marginTop: height * 0.002 }
          ]}>
            <TouchableOpacity 
              style={[
                styles.profilePicture,
                sabreHasIssuedCards && {
                  width: sabreProfileSize,
                  height: sabreProfileSize,
                  borderRadius: sabreProfileRadius,
                },
              ]}
              onPress={() => {
                if (toggleCardPosition === 'left' && showUserProfile) {
                  // User profile - no image selection, just show profile image
                  return;
                } else {
                  // Opponent profile - allow image selection
                  handleImageSelection(getEntityAtPosition('left'));
                }
              }}
            >
              {toggleCardPosition === 'left' && showUserProfile ? (
                // User profile - show user image or initials
                renderProfileImage(userProfileImage, userDisplayName, true)
              ) : (
                // Opponent profile - show opponent image or initials
                renderProfileImage(opponentImages[getEntityAtPosition('left')] || null, getNameByPosition('left'), false)
              )}
              {!(toggleCardPosition === 'left' && showUserProfile) && (
              <View style={[
                styles.cameraIcon,
                sabreHasIssuedCards && {
                  width: width * 0.055,
                  height: width * 0.055,
                  borderRadius: width * 0.0275,
                  bottom: -width * 0.005,
                  right: -width * 0.005,
                }
              ]}>
                <Text style={[styles.cameraIconText, sabreHasIssuedCards && { fontSize: width * 0.028 }]}>📷</Text>
              </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Yellow Cards Display */}
          {leftYellowCards.length > 0 && leftRedCards.length === 0 && (
            <View style={styles.yellowCardsContainer}>
              {leftYellowCards.map((cardNumber, index) => (
                <View key={index} style={styles.yellowCard}>
                  <Text style={styles.yellowCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Red Cards Display */}
          {leftRedCards.length > 0 && (
            <View style={styles.redCardsContainer}>
              {leftRedCards.map((cardNumber, index) => (
                <View key={index} style={styles.redCard}>
                  <Text style={styles.redCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Priority Light Indicator */}
          {(isAssigningPriority || priorityFencer === getEntityAtPosition('left')) && (
            <View style={[
              styles.priorityLight,
              {
                backgroundColor: priorityLightPosition === 'left' ? Colors.yellow.accent : 'transparent',
                borderColor: priorityLightPosition === 'left' ? Colors.yellow.accent : 'transparent'
              }
            ]} />
          )}
          
          <TouchableOpacity 
            onPress={() => handleFencerNameClick(getEntityAtPosition('left'))}
            activeOpacity={0.7}
            style={styles.fencerNameContainer}
          >
            <Text 
              style={[
                styles.fencerName, 
                {color: 'black'},
                (isNonSabreTimerReady && isAndroid) && { marginBottom: fencerNameMarginBottomTimerReady },
                sabreHasIssuedCards && { marginBottom: sabreNameMarginBottom },
                (toggleCardPosition === 'left' && showUserProfile 
                  ? userDisplayName === 'Tap to add name'
                  : getNameByPosition('left') === 'Tap to add name') && {
                  fontSize: width * 0.04, // Smaller font for placeholder
                  fontWeight: '700' as const,
                  color: '#6C5CE7', // Purple color to match app theme
                  opacity: 1
                }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {toggleCardPosition === 'left' && showUserProfile 
                ? getDisplayName(userDisplayName) 
                : getDisplayName(getNameByPosition('left'))}
            </Text>
          </TouchableOpacity>
          <Text style={[
              styles.fencerScore,
              { color: 'black' },
              (isNonSabreTimerReady && isAndroid) && { marginBottom: fencerScoreMarginBottomTimerReady },
              sabreHasIssuedCards && { fontSize: sabreScoreFontSize, marginBottom: sabreScoreMarginBottom },
            ]}>
              {getScoreByPosition('left').toString().padStart(2, '0')}
            </Text>
          
          <View style={[styles.scoreControls, sabreHasIssuedCards && { gap: sabreScoreControlsGap }]}>
            <TouchableOpacity style={[styles.scoreButton, {
              backgroundColor: 'rgb(255,255,255)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.1)'
            }, sabreHasIssuedCards && {
              width: sabreScoreButtonSize,
              height: sabreScoreButtonSize,
              borderRadius: sabreScoreButtonRadius,
            }]} onPress={() => decrementScore(getEntityAtPosition('left'))}>
              <Ionicons name="remove" size={sabreScoreIconSize} color="black" />
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
            }, sabreHasIssuedCards && {
              width: sabreScoreButtonSize,
              height: sabreScoreButtonSize,
              borderRadius: sabreScoreButtonRadius,
            }]} onPress={() => incrementScore(getEntityAtPosition('left'))}>
              <Ionicons name="add" size={sabreScoreIconSize} color="black" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Fencers Button */}
        <LinearGradient
          colors={['#D6A4F0', '#969DFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.swapButton, 
            { 
              position: 'absolute', 
              zIndex: 10, 
              alignSelf: 'center',
              // Move up when Epee is selected to make room for double hit button
              bottom: selectedWeapon === 'epee'
                ? height * 0.18
                : selectedWeapon === 'sabre'
                  ? height * 0.14
                  : height * 0.08
            }
          ]}
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

        {/* Double Hit Button (Epee Only) */}
        {selectedWeapon === 'epee' && (
          <View
            style={[
              styles.doubleHitButton,
              {
                position: 'absolute',
                zIndex: 10,
                alignSelf: 'center',
                backgroundColor: isDoubleHitPressed 
                  ? 'rgba(108, 92, 231, 0.3)' 
                  : 'rgba(140, 140, 140, 0.65)',
                borderColor: isDoubleHitPressed 
                  ? '#6C5CE7' 
                  : 'rgba(180, 180, 180, 0.75)',
                borderWidth: isDoubleHitPressed ? 3 : 1.5,
              }
            ]}
          >
            <TouchableOpacity 
              style={{ 
                width: '100%', 
                height: '100%', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }} 
              onPress={handleDoubleHit}
            >
              <Ionicons name="add-circle" size={28} color="white" />
              <Text style={styles.doubleHitButtonText}>Double</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bob's Card */}
        <View style={[
          styles.fencerCard, 
          {backgroundColor: 'rgb(176,232,236)'},
          // Slightly shorter cards in timer-ready state on Android to avoid overlap
          (isNonSabreTimerReady && isAndroid) ? {
            padding: fencerCardTimerReadyPadding,
            minHeight: fencerCardMinHeightTimerReady,
          } : {},
          // Make fencer card smaller when timer is ready AND cards are present
          (!hasMatchStarted && (leftYellowCards.length > 0 || leftRedCards.length > 0 || rightYellowCards.length > 0 || rightRedCards.length > 0)) ? {
            width: width * 0.42, // Keep width at 0.42 (same as non-conditional)
            padding: isNonSabreTimerReady ? fencerCardCompactPaddingTimerReady : fencerCardCompactPadding,
            minHeight: isNonSabreTimerReady ? fencerCardMinHeightTimerReadyWithCards : fencerCardMinHeightCompact,
          } : 
          // Make fencer cards longer when match is in progress and no cards issued
          (hasMatchStarted && leftYellowCards.length === 0 && leftRedCards.length === 0 && rightYellowCards.length === 0 && rightRedCards.length === 0) ? {
            width: width * 0.42, // Keep width at 0.42
            padding: fencerCardPadding,
            minHeight: fencerCardMinHeightExtended,
          } : {},
          // Make fencer cards taller for sabre
          selectedWeapon === 'sabre' ? {
            minHeight: sabreCardHeight,
            maxHeight: sabreCardHeight,
            padding: sabreHasIssuedCards ? fencerCardCompactPadding : fencerCardPadding,
          } : {}
        ]}>
        {/* Sliding Switch - Top Right - Only show when toggle is on right card */}
          {toggleCardPosition === 'right' && (
            <View style={[styles.slidingSwitch, { 
              position: 'absolute', 
              top: sabreHasIssuedCards ? width * 0.015 : width * 0.02, 
              right: width * 0.02, // Position on right side instead of left
              zIndex: 5 
            },
            sabreHasIssuedCards && {
              width: width * 0.105,
              height: width * 0.052,
              borderRadius: width * 0.026,
            }
            ]}>
              <TouchableOpacity 
                style={[
                  styles.switchTrack, 
                  { backgroundColor: showUserProfile ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)' },
                  hasMatchStarted && styles.switchTrackLocked
                ]}
                onPress={toggleUserProfile}
              >
                <View style={[
                  styles.switchThumb, 
                  sabreHasIssuedCards && {
                    width: width * 0.045,
                    height: width * 0.045,
                    borderRadius: width * 0.0225,
                    top: width * 0.0035,
                  },
                  { 
                    transform: [{ translateX: sabreSwitchTranslateX }]
                  }
                ]}>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={[
            styles.profileContainer,
            sabreHasIssuedCards && toggleCardPosition === 'right' && { marginTop: height * 0.002 }
          ]}>
            <TouchableOpacity 
              style={[
                styles.profilePicture,
                sabreHasIssuedCards && {
                  width: sabreProfileSize,
                  height: sabreProfileSize,
                  borderRadius: sabreProfileRadius,
                },
              ]}
              onPress={() => {
                if (toggleCardPosition === 'right' && showUserProfile) {
                  // User profile - no image selection, just show profile image
                  return;
                } else {
                  // Opponent profile - allow image selection
                  handleImageSelection(getEntityAtPosition('right'));
                }
              }}
            >
              {toggleCardPosition === 'right' && showUserProfile ? (
                // User profile - show user image or initials
                renderProfileImage(userProfileImage, userDisplayName, true)
              ) : (
                // Opponent profile - show opponent image or initials
                renderProfileImage(opponentImages[getEntityAtPosition('right')] || null, getNameByPosition('right'), false)
              )}
              {!(toggleCardPosition === 'right' && showUserProfile) && (
              <View style={[
                styles.cameraIcon,
                sabreHasIssuedCards && {
                  width: width * 0.055,
                  height: width * 0.055,
                  borderRadius: width * 0.0275,
                  bottom: -width * 0.005,
                  right: -width * 0.005,
                }
              ]}>
                <Text style={[styles.cameraIconText, sabreHasIssuedCards && { fontSize: width * 0.028 }]}>📷</Text>
              </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Yellow Cards Display */}
          {rightYellowCards.length > 0 && rightRedCards.length === 0 && (
            <View style={styles.yellowCardsContainer}>
              {rightYellowCards.map((cardNumber, index) => (
                <View key={index} style={styles.yellowCard}>
                  <Text style={styles.yellowCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Red Cards Display */}
          {rightRedCards.length > 0 && (
            <View style={styles.redCardsContainer}>
              {rightRedCards.map((cardNumber, index) => (
                <View key={index} style={styles.redCard}>
                  <Text style={styles.redCardText}>{cardNumber}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Priority Light Indicator */}
          {(isAssigningPriority || priorityFencer === getEntityAtPosition('right')) && (
            <View style={[
              priorityLightPosition === 'right' ? styles.priorityLightRight : styles.priorityLight,
              {
                backgroundColor: priorityLightPosition === 'right' ? Colors.yellow.accent : 'transparent',
                borderColor: priorityLightPosition === 'right' ? Colors.yellow.accent : 'transparent'
              }
            ]} />
          )}
          
          <TouchableOpacity 
            onPress={() => handleFencerNameClick(getEntityAtPosition('right'))}
            activeOpacity={0.7}
            style={styles.fencerNameContainer}
          >
            <Text 
              style={[
                styles.fencerName, 
                {color: 'black'},
                (isNonSabreTimerReady && isAndroid) && { marginBottom: fencerNameMarginBottomTimerReady },
                sabreHasIssuedCards && { marginBottom: sabreNameMarginBottom },
                (toggleCardPosition === 'right' && showUserProfile 
                  ? userDisplayName === 'Tap to add name'
                  : getNameByPosition('right') === 'Tap to add name') && {
                  fontSize: width * 0.04, // Smaller font for placeholder
                  fontWeight: '700' as const,
                  color: '#6C5CE7', // Purple color to match app theme
                  opacity: 1
                }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {toggleCardPosition === 'right' && showUserProfile 
                ? getDisplayName(userDisplayName) 
                : getDisplayName(getNameByPosition('right'))}
            </Text>
          </TouchableOpacity>
          <Text style={[
              styles.fencerScore,
              { color: 'black' },
              (isNonSabreTimerReady && isAndroid) && { marginBottom: fencerScoreMarginBottomTimerReady },
              sabreHasIssuedCards && { fontSize: sabreScoreFontSize, marginBottom: sabreScoreMarginBottom },
            ]}>
              {getScoreByPosition('right').toString().padStart(2, '0')}
            </Text>
          
          <View style={[styles.scoreControls, sabreHasIssuedCards && { gap: sabreScoreControlsGap }]}>
            <TouchableOpacity style={[styles.scoreButton, {
              backgroundColor: 'rgb(255,255,255)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.1)'
            }, sabreHasIssuedCards && {
              width: sabreScoreButtonSize,
              height: sabreScoreButtonSize,
              borderRadius: sabreScoreButtonRadius,
            }]} onPress={() => decrementScore(getEntityAtPosition('right'))}>
              <Ionicons name="remove" size={sabreScoreIconSize} color="black" />
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
            }, sabreHasIssuedCards && {
              width: sabreScoreButtonSize,
              height: sabreScoreButtonSize,
              borderRadius: sabreScoreButtonRadius,
            }]} onPress={() => incrementScore(getEntityAtPosition('right'))}>
              <Ionicons name="add" size={sabreScoreIconSize} color="black" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

		      {/* Bottom Controls + Play Controls */}
		      <View
		        style={[
		          // In timer-ready state, dock the entire bottom area above the tab bar
		          isNonSabreTimerReady && {
		            position: 'absolute',
		            left: 0,
		            right: 0,
		            bottom: timerReadyDockBottom,
		            zIndex: 20,
		          },
		        ]}
		      >
		        {/* Bottom Controls */}
        <View style={[
          styles.bottomControls,
          // Foil/Epee: compact + higher when timer-ready so play button has room
          isNonSabreTimerReady ? {
            marginBottom: hasIssuedCards ? timerReadyBottomControlsGap : timerReadyBottomControlsGapNoCards, // Slight extra space when no cards
            gap: width * 0.03, // Slightly tighter
          } : {},
          isSabre ? {
            marginTop: -(height * 0.006),
          } : {}
        ]}>
		          <View style={[
		            styles.decorativeCards,
		            isNonSabreTimerReady ? {
		              gap: width * 0.02, // Reduce gap between cards
		            } : {}
		          ]}>
		            <TouchableOpacity style={[
			              styles.decorativeCard, 
			              styles.cardYellow,
			              isNonSabreTimerReady ? {
			                width: decorativeCardWidth,
			                height: decorativeCardHeight,
			              } : {}
			            ]} onPress={addYellowCardToAlice}>
		              {leftYellowCards.length > 0 && (
		                <Text style={[styles.decorativeCardCount, { color: Colors.yellow.accent }]}>
		                  {leftYellowCards.length}
		                </Text>
		              )}
		            </TouchableOpacity>
		            <TouchableOpacity style={[
			              styles.decorativeCard, 
			              styles.cardRed,
			              isNonSabreTimerReady ? {
			                width: decorativeCardWidth,
			                height: decorativeCardHeight,
			              } : {}
			            ]} onPress={addRedCardToAlice}>
		              {leftRedCards.length > 0 && (
		                <Text style={[styles.decorativeCardCount, { color: Colors.red.accent }]}>
		                  {leftRedCards[0]}
		                </Text>
		              )}
		            </TouchableOpacity>
		          </View>
          <TouchableOpacity
            style={[
              styles.assignPriorityButton, 
              {
                backgroundColor: canAssignPriority
                  ? Colors.yellow.accent
                  : hasMatchStarted ? (isInjuryTimer ? '#EF4444' : Colors.purple.primary) : '#6B7280'
              },
		              // Slightly smaller in timer-ready state to free space
		              isNonSabreTimerReady ? {
		                paddingHorizontal: width * 0.024,
		                paddingVertical: timerReadyInjuryPaddingVertical,
		              } : {},
		              // Grey out when match hasn't started
		              !hasMatchStarted && {
		                opacity: 0.6
		              }
            ]}
            onPress={
              hasMatchStarted ? (
                canAssignPriority
                  ? () => setShowPriorityPopup(true)
                  : (isInjuryTimer ? skipInjuryTimer : startInjuryTimer)
              ) : undefined
            }
            disabled={!hasMatchStarted}
          >
            <Text style={styles.assignPriorityIcon}>
              {canAssignPriority ? '🎲' : '🏥'}
            </Text>
            <Text style={styles.assignPriorityText}>
              {canAssignPriority
                ? 'Assign Priority'
                : (isInjuryTimer ? 'Skip Injury' : 'Injury Timer')}
            </Text>
          </TouchableOpacity>
		          <View style={[
		            styles.decorativeCards,
		            isNonSabreTimerReady ? {
		              gap: width * 0.02, // Reduce gap between cards
		            } : {}
		          ]}>
		            <TouchableOpacity style={[
			              styles.decorativeCard, 
			              styles.cardYellow,
			              isNonSabreTimerReady ? {
			                width: decorativeCardWidth,
			                height: decorativeCardHeight,
			              } : {}
			            ]} onPress={addYellowCardToBob}>
		              {rightYellowCards.length > 0 && (
		                <Text style={[styles.decorativeCardCount, { color: Colors.yellow.accent }]}>
		                  {rightYellowCards.length}
		                </Text>
		              )}
		            </TouchableOpacity>
		            <TouchableOpacity style={[
			              styles.decorativeCard, 
			              styles.cardRed,
			              isNonSabreTimerReady ? {
			                width: decorativeCardWidth,
			                height: decorativeCardHeight,
			              } : {}
			            ]} onPress={addRedCardToBob}>
		              {rightRedCards.length > 0 && (
		                <Text style={[styles.decorativeCardCount, { color: Colors.red.accent }]}>
		                  {rightRedCards[0]}
		                </Text>
		              )}
		            </TouchableOpacity>
		          </View>
		        </View>

        {/* Play, Reset, and Complete Match Controls - REBUILT */}
        {selectedWeapon !== 'sabre' && (
        <View style={[
          {
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            marginVertical: height * 0.012,
            marginTop: height * 0.006,
            paddingHorizontal: width * 0.04,
            backgroundColor: 'transparent',
            borderRadius: width * 0.02,
            gap: height * 0.012, // Reduced gap between elements
            marginBottom: layout.adjustMargin(height * 0.04, 'bottom') + layout.getPlatformAdjustments().bottomNavOffset,
          },
          // When docked, avoid extra bottom spacing so it doesn't creep upward into the fencer cards
          isNonSabreTimerReady && {
            marginBottom: 0,
            marginTop: timerReadyPlayBlockMarginTop,
            marginVertical: timerReadyPlayBlockMarginVertical,
            gap: timerReadyPlayBlockGap,
          },
        ]}>
        
        {/* Play and Reset Row */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}>
          {/* Play Button / Skip Button - Hidden for Sabre */}
          {selectedWeapon !== 'sabre' && (
		          <TouchableOpacity 
		            style={{
		              flex: 1,
		              ...(hasMatchStarted ? { flex: 1.25 } : {}),
		              backgroundColor: '#2A2A2A',
		              paddingVertical: layout.adjustPadding(isNonSabreTimerReady ? timerReadyPlayButtonPadding : height * 0.045, 'bottom'),
		              paddingHorizontal: width * 0.05,
		              borderRadius: width * 0.02,
		              alignItems: 'center',
		              justifyContent: 'center',
		              flexDirection: 'row',
		              marginRight: hasMatchStarted ? width * 0.01 : width * 0.025,
		              borderWidth: width * 0.005,
		              borderColor: 'white',
		              minHeight: layout.adjustPadding(isNonSabreTimerReady ? timerReadyPlayButtonMinHeight : height * 0.14, 'bottom'),
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
          )}
          
	          {/* Reset Button - Hidden for Sabre */}
	          {selectedWeapon !== 'sabre' && (
		            <TouchableOpacity 
		              style={{
		                width: hasMatchStarted ? width * 0.11 : (isNonSabreTimerReady ? timerReadyResetButtonWidth : width * 0.15),
		                backgroundColor: '#FB5D5C',
		                paddingVertical: layout.adjustPadding(isNonSabreTimerReady ? timerReadyResetButtonPadding : height * 0.012, 'bottom'),
		                borderRadius: width * 0.05,
		                alignItems: 'center',
		                justifyContent: 'center',
                borderWidth: width * 0.005,
                borderColor: 'transparent',
                minHeight: layout.adjustPadding(isNonSabreTimerReady ? timerReadyResetButtonMinHeight : height * 0.055, 'bottom'),
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
          )}
        </View>
        </View>
        )}

	      </View>

      {/* Finish Match Confirmation */}
      {showFinishMatchConfirm && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>Finish Match?</Text>
            <Text style={styles.popupMessage}>
              Are you sure you want to finish this match?
            </Text>
            <View style={styles.popupButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowFinishMatchConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={async () => {
                  setShowFinishMatchConfirm(false);
                  await completeMatch();
                }}
              >
                <Text style={styles.saveButtonText}>Yes, finish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

	      {/* Edit Time Popup */}
      {showEditPopup && (
        <View style={styles.popupOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'position'} 
            style={{ flex: 1, justifyContent: 'center', width: '100%', alignItems: 'center' }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100}
          >
            <TouchableOpacity 
              style={{ flex: 1, width: '100%' }} 
              activeOpacity={1} 
              onPress={() => Keyboard.dismiss()}
            >
              <View style={{ flex: 1, justifyContent: 'center', width: '100%', alignItems: 'center' }}>
                <TouchableOpacity activeOpacity={1} style={{ width: '100%', alignItems: 'center' }}>
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
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Reset Options Popup */}
      {showResetPopup && (
        <View style={styles.popupOverlay}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
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
              {selectedWeapon !== 'sabre' && (
                <TouchableOpacity style={styles.saveButton} onPress={() => {
                  resetTime();
                  setShowResetPopup(false);
                }}>
                  <Text style={styles.saveButtonText}>Reset Time</Text>
                </TouchableOpacity>
              )}
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
        </View>
      )}

      {/* Reset All Modal (for anonymous matches when toggle is off) */}
      <Modal
        visible={showResetAllModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetAllModal(false)}
      >
        <TouchableOpacity
          style={styles.popupOverlay}
          activeOpacity={1}
          onPress={() => setShowResetAllModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.popupContainer}>
              <Text style={styles.popupTitle}>Reset Match</Text>
              <Text style={styles.inputHint}>
                Would you like to keep the same fencers or change one or both fencers?
              </Text>
              <View style={styles.popupButtons}>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: Colors.red.accent, width: '90%' }]}
                  onPress={async () => {
                    console.log('🔄 User chose to change both fencers');
                    setShowResetAllModal(false);
                    await performResetAll(false);
                    // Ensure toggle stays off
                    setShowUserProfile(false);
                  }}
                >
                  <Text style={styles.saveButtonText}>Change Both Fencers</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, { width: '90%' }]}
                  onPress={async () => {
                    console.log('🔄 User chose to keep both fencers');
                    setShowResetAllModal(false);
                    // Store both fencer names before reset
                    const fencerAName = fencerNames.fencerA;
                    const fencerBName = fencerNames.fencerB;
                    await performResetAll(true);
                    // Ensure toggle stays off
                    setShowUserProfile(false);
                    // Restore both fencer names after reset
                    setTimeout(() => {
                      setFencerNames({
                        fencerA: fencerAName,
                        fencerB: fencerBName,
                      });
                      console.log('✅ Both fencer names kept:', { fencerA: fencerAName, fencerB: fencerBName });
                    }, 100);
                  }}
                >
                  <Text style={styles.saveButtonText}>Keep Both Fencers</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, { width: '90%' }]}
                  onPress={async () => {
                    console.log('🔄 User chose to change one fencer');
                    setShowResetAllModal(false);
                    // Store both fencer names before showing selection
                    const fencerAName = fencerNames.fencerA;
                    const fencerBName = fencerNames.fencerB;
                    
                    // Show Alert to ask which fencer to keep
                    Alert.alert(
                      'Change One Fencer',
                      'Which fencer would you like to keep?',
                      [
                        {
                          text: 'Cancel',
                          style: 'cancel',
                          onPress: () => {
                            console.log('🔄 Change one fencer cancelled');
                          }
                        },
                        {
                          text: fencerAName,
                          onPress: async () => {
                            console.log(`🔄 User chose to keep first fencer (${fencerAName})`);
                            // Store first fencer's name before reset
                            await performResetAll(false);
                            // Ensure toggle stays off
                            setShowUserProfile(false);
                            // After reset, restore first fencer's name
                            setTimeout(() => {
                              setFencerNames({
                                fencerA: fencerAName, // Keep first fencer
                                fencerB: 'Tap to add name' // Reset second fencer
                              });
                              console.log('✅ First fencer name kept:', fencerAName);
                            }, 100);
                          }
                        },
                        {
                          text: fencerBName,
                          onPress: async () => {
                            console.log(`🔄 User chose to keep second fencer (${fencerBName})`);
                            // Store second fencer's name before reset
                            await performResetAll(false);
                            // Ensure toggle stays off
                            setShowUserProfile(false);
                            // After reset, restore second fencer's name
                            setTimeout(() => {
                              setFencerNames({
                                fencerA: 'Tap to add name', // Reset first fencer
                                fencerB: fencerBName // Keep second fencer
                              });
                              console.log('✅ Second fencer name kept:', fencerBName);
                            }, 100);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.saveButtonText}>Change One Fencer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelButton, { width: '90%' }]}
                  onPress={() => setShowResetAllModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Names Popup */}
      {showEditNamesPopup && (
        <View style={styles.popupOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'position'} 
            style={{ flex: 1, justifyContent: 'center', paddingTop: -height * 0.1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100}
          >
            <TouchableOpacity 
              style={{ flex: 1 }} 
              activeOpacity={1} 
              onPress={() => Keyboard.dismiss()}
            >
              <View style={{ flex: 1, justifyContent: 'center', marginTop: -height * 0.1 }}>
                <TouchableOpacity activeOpacity={1}>
                  <View style={styles.popupContainer}>
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
                  value={editFencerAName}
                  onChangeText={showUserProfile && toggleCardPosition === 'left' ? undefined : setEditFencerAName}
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
                  value={editFencerBName}
                  onChangeText={showUserProfile && toggleCardPosition === 'right' ? undefined : setEditFencerBName}
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
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      )}



      {/* Score Warning Popup */}
      {showScoreWarning && (
        <View style={styles.popupOverlay}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
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
        </View>
      )}

      {/* Priority Assignment Popup */}
      {showPriorityPopup && !isSabre && (
        <View style={styles.popupOverlay}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>🏁 Match Ended in Tie!</Text>
            <Text style={styles.inputHint}>
              Period {currentPeriod} ended with a score of {scores.fencerA}-{scores.fencerB}. Would you like to assign priority to determine the winner?
            </Text>
            
            <View style={styles.popupButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPriorityPopup(false)}>
                <Text style={styles.cancelButtonText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => autoAssignPriority(true)}>
                <Text style={styles.saveButtonText}>Yes, Assign Priority</Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </View>
      )}

      {/* Image Picker Modal */}
      {showImagePicker && (
        <View style={styles.popupOverlay}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>Select Image</Text>
            <Text style={styles.popupMessage}>
              Choose how you want to add a photo for {selectedFencer === 'fencerA' ? fencerNames.fencerA : fencerNames.fencerB}
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
        </View>
      )}
          </View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

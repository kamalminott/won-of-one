import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { trackFeatureFirstUse, trackOnce } from '@/lib/analyticsTracking';
import { competitionService, matchService, userService } from '@/lib/database';
import type { Competition } from '@/types/database';
import { sessionTracker } from '@/lib/sessionTracker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, UIManager, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddMatchScreen() {
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  const { user, userName, session } = useAuth();
  const accessToken = session?.access_token ?? undefined;
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
  
  // Parse date/time from params with fallbacks
  const parseInitialDateTime = () => {
    const dateStr = params.date as string | undefined;
    const timeStr = params.time as string | undefined;
    const eventDateStr = params.eventDate as string | undefined;

    const now = new Date();
    if (!isEditMode) {
      return now;
    }

    // If an ISO event date was provided, use it first
    if (eventDateStr) {
      const isoDate = new Date(eventDateStr);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
    }

    if (!dateStr) {
      return now;
    }

    // Try DD/MM/YYYY first
    let parsed: Date | null = null;
    if (dateStr.includes('/') && dateStr.split('/').length === 3) {
      const [dayStr, monthStr, yearStr] = dateStr.split('/');
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const year = parseInt(yearStr, 10);
      const candidate = new Date(year, month, day);
      if (!isNaN(candidate.getTime())) {
        parsed = candidate;
      }
    }

    // Fallback: try native Date parsing (ISO or other)
    if (!parsed) {
      const candidate = new Date(dateStr);
      if (!isNaN(candidate.getTime())) {
        parsed = candidate;
      }
    }

    if (!parsed) {
      return now;
    }

    // Apply time if provided
    if (timeStr) {
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        parsed.setHours(hours, minutes, 0, 0);
      }
    }

    return parsed;
  };

  // Initialize state with params if in edit mode
  const [matchDate, setMatchDate] = useState(() => parseInitialDateTime());
  
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [opponentName, setOpponentName] = useState(params.opponentName as string || '');
  const [event, setEvent] = useState(params.matchType as string || 'Training');
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [weaponType, setWeaponType] = useState('Foil');
  const [showWeaponDropdown, setShowWeaponDropdown] = useState(false);
  const [competitionName, setCompetitionName] = useState('');
  const [competitionSuggestions, setCompetitionSuggestions] = useState<Competition[]>([]);
  const [competitionLoading, setCompetitionLoading] = useState(false);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [selectedCompetitionName, setSelectedCompetitionName] = useState('');
  const [showCompetitionSuggestions, setShowCompetitionSuggestions] = useState(false);
  const [activeCompetition, setActiveCompetition] = useState<Competition | null>(null);
  const [competitionPhase, setCompetitionPhase] = useState<'POULE' | 'DE'>('POULE');
  const [competitionRound, setCompetitionRound] = useState<'L256' | 'L128' | 'L64' | 'L32' | 'L16' | 'QF' | 'SF' | 'F'>('L16');
  const competitionSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notes, setNotes] = useState(params.notes as string || '');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [tempNotes, setTempNotes] = useState(params.notes as string || '');
  const [showListFormatMenu, setShowListFormatMenu] = useState(false);
  const [activeListFormat, setActiveListFormat] = useState<'bullet' | 'dash' | 'number' | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [editingScore, setEditingScore] = useState<'your' | 'opponent' | null>(null);
  const [tempScore, setTempScore] = useState('');
  const [yourScore, setYourScore] = useState(params.yourScore as string || '0');
  const [opponentScore, setOpponentScore] = useState(params.opponentScore as string || '0');
  const [isSaving, setIsSaving] = useState(false);
  const [hasStartedForm, setHasStartedForm] = useState(false);
  
  // Refs and positions for dropdowns (to render outside ScrollView)
  const eventDropdownRef = useRef<View | null>(null);
  const weaponDropdownRef = useRef<View | null>(null);
  const [eventDropdownPosition, setEventDropdownPosition] = useState({ x: 0, y: 0, width: 0 });
  const [weaponDropdownPosition, setWeaponDropdownPosition] = useState({ x: 0, y: 0, width: 0 });
  
  // Helper to measure dropdown position
  const measureDropdownPosition = (ref: React.RefObject<View | null>, setPosition: (pos: { x: number; y: number; width: number }) => void) => {
    if (ref.current) {
      (ref.current as any).measureInWindow?.((x: number, y: number, width: number, height: number) => {
        setPosition({ x, y: y + height, width });
      });
    }
  };

  const pointDifferential = parseInt(yourScore) - parseInt(opponentScore);
  const isWinner = pointDifferential > 0;
  const deRounds: Array<'L256' | 'L128' | 'L64' | 'L32' | 'L16' | 'QF' | 'SF' | 'F'> = [
    'L256',
    'L128',
    'L64',
    'L32',
    'L16',
    'QF',
    'SF',
    'F',
  ];
  const getLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleNotesChange = (value: string) => {
    if (value.length > tempNotes.length) {
      const lastChar = value.slice(-1);
      if (lastChar === '\n') {
        const lines = value.split('\n');
        const prevLine = lines[lines.length - 2] ?? '';
        const bulletMatch = prevLine.match(/^(\s*)([-•])\s+/);
        if (bulletMatch) {
          const indent = bulletMatch[1] ?? '';
          const bullet = bulletMatch[2] ?? '-';
          const prefix = `${indent}${bullet} `;
          setTempNotes(value + prefix);
          return;
        }
        const numberMatch = prevLine.match(/^(\s*)(\d+)\.\s+/);
        if (numberMatch) {
          const indent = numberMatch[1] ?? '';
          const number = parseInt(numberMatch[2], 10);
          if (Number.isFinite(number)) {
            const nextNumber = number + 1;
            setTempNotes(value + `${indent}${nextNumber}. `);
            return;
          }
        }
      }
    }
    setTempNotes(value);
  };

  const insertListPrefix = (type: 'bullet' | 'dash' | 'number') => {
    const prefix = type === 'number' ? '1. ' : type === 'dash' ? '- ' : '• ';
    setTempNotes(prev => {
      if (!prev) return prefix;
      if (prev.endsWith('\n') || prev.endsWith(' ')) {
        return prev + prefix;
      }
      return `${prev}\n${prefix}`;
    });
    setActiveListFormat(type);
    setShowListFormatMenu(false);
  };

  const listFormatSuffix =
    activeListFormat === 'number'
      ? '1.'
      : activeListFormat === 'dash'
        ? '-'
        : activeListFormat === 'bullet'
          ? '•'
          : '';

  const handleCreateCompetition = async () => {
    if (!user?.id) return;
    const weaponKey = weaponType.toLowerCase();
    if (weaponKey !== 'foil' && weaponKey !== 'epee' && weaponKey !== 'sabre') return;
    const pendingName = competitionName.trim();
    if (!pendingName) return;
    const created = await competitionService.createCompetition(
      {
        userId: user.id,
        name: pendingName,
        eventDate: getLocalDateKey(matchDate),
        weaponType: weaponKey as 'foil' | 'epee' | 'sabre',
        accessToken: accessToken ?? null,
      }
    );
    if (created) {
      setSelectedCompetitionName(created.name);
      setSelectedCompetitionId(created.competition_id);
      setCompetitionName('');
      setShowCompetitionSuggestions(false);
      await AsyncStorage.setItem('active_competition', JSON.stringify(created));
      setActiveCompetition(created);
    } else {
      const fallback = await competitionService.searchCompetitions(
        user.id,
        {
          query: pendingName,
          eventDate: getLocalDateKey(matchDate),
          weaponType: weaponKey as 'foil' | 'epee' | 'sabre',
          limit: 1,
        },
        accessToken ?? null
      );
      if (fallback[0]) {
        setSelectedCompetitionName(fallback[0].name);
        setSelectedCompetitionId(fallback[0].competition_id);
        setCompetitionName('');
        setShowCompetitionSuggestions(false);
        await AsyncStorage.setItem('active_competition', JSON.stringify(fallback[0]));
        setActiveCompetition(fallback[0]);
      }
    }
  };

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
      if (!isEditMode) {
        analytics.matchStart({
          mode: 'manual',
          is_offline: false,
          weapon_type: weaponType.toLowerCase(),
          opponent_name: opponentName.trim() || undefined,
        });
        void trackFeatureFirstUse(
          'manual_match',
          {
            weapon_type: weaponType.toLowerCase(),
            opponent_name: opponentName.trim() || undefined,
          },
          user?.id
        );
      }
    }
  }, [opponentName, event, weaponType, notes, hasStartedForm, isEditMode, user?.id]);

  // Track form abandonment on unmount if not saved
  useEffect(() => {
    return () => {
      if (hasStartedForm && !isSaving && !isEditMode) {
        const hasData = opponentName || event !== 'Training' || weaponType !== 'Foil' || notes;
        if (hasData) {
          analytics.formAbandon({ form_type: 'match' });
          const parsedYourScore = parseInt(yourScore, 10);
          const parsedOpponentScore = parseInt(opponentScore, 10);
          analytics.matchAbandoned({
            mode: 'manual',
            weapon_type: weaponType.toLowerCase(),
            opponent_name: opponentName.trim() || undefined,
            your_score: Number.isFinite(parsedYourScore) ? parsedYourScore : undefined,
            opponent_score: Number.isFinite(parsedOpponentScore) ? parsedOpponentScore : undefined,
            reason: 'form_abandon',
            is_offline: false,
          });
        }
      }
    };
  }, [hasStartedForm, isSaving, opponentName, event, weaponType, notes, yourScore, opponentScore, isEditMode]);

  // Clear competition state when switching back to Training
  useEffect(() => {
    if (event !== 'Competition') {
      setCompetitionName('');
      setSelectedCompetitionId(null);
      setSelectedCompetitionName('');
      setCompetitionSuggestions([]);
      setShowCompetitionSuggestions(false);
      setActiveCompetition(null);
    } else {
      setShowCompetitionSuggestions(true);
    }
  }, [event]);

  // Load active competition suggestion (AsyncStorage) when in Competition mode
  useEffect(() => {
    if (event !== 'Competition' || !user?.id) {
      return;
    }
    let cancelled = false;
    const loadActiveCompetition = async () => {
      try {
        const raw = await AsyncStorage.getItem('active_competition');
        if (!raw) {
          if (!cancelled) setActiveCompetition(null);
          return;
        }
        const parsed = JSON.parse(raw) as Competition;
        const currentWeapon = weaponType.toLowerCase();
        if (
          parsed?.competition_id &&
          parsed.weapon_type === currentWeapon
        ) {
          if (!cancelled) setActiveCompetition(parsed);
        } else if (!cancelled) {
          setActiveCompetition(null);
        }
      } catch (error) {
        console.warn('Failed to load active competition', error);
      }
    };
    loadActiveCompetition();
    return () => {
      cancelled = true;
    };
  }, [event, user?.id, weaponType]);

  // Search competitions for selector (by name + date + weapon)
  useEffect(() => {
    if (event !== 'Competition' || !user?.id) {
      return;
    }

    const query = competitionName.trim();
    const weaponKey = weaponType.toLowerCase();
    if (weaponKey !== 'foil' && weaponKey !== 'epee' && weaponKey !== 'sabre') {
      return;
    }

    if (competitionSearchTimeoutRef.current) {
      clearTimeout(competitionSearchTimeoutRef.current);
    }

    competitionSearchTimeoutRef.current = setTimeout(async () => {
      setCompetitionLoading(true);
      const results = await competitionService.searchCompetitions(
        user.id,
        {
          query: query || undefined,
          eventDate: query ? undefined : getLocalDateKey(matchDate),
          weaponType: weaponKey as 'foil' | 'epee' | 'sabre',
          limit: 6,
        },
        accessToken ?? null
      );
      setCompetitionSuggestions(results);
      setCompetitionLoading(false);
    }, 250);

    return () => {
      if (competitionSearchTimeoutRef.current) {
        clearTimeout(competitionSearchTimeoutRef.current);
      }
    };
  }, [accessToken, competitionName, event, matchDate, user?.id, weaponType]);

  // Fetch match data when in edit mode to populate weaponType and competition fields
  useEffect(() => {
    const fetchMatchData = async () => {
      if (isEditMode && params.matchId) {
        const matchId = params.matchId as string;
        const match = await matchService.getMatchById(matchId, accessToken ?? null);
        if (match) {
          if (match.weapon_type) {
            // Capitalize first letter to match form format (Foil, Epee, Sabre)
            const weaponTypeFormatted = match.weapon_type.charAt(0).toUpperCase() + match.weapon_type.slice(1).toLowerCase();
            setWeaponType(weaponTypeFormatted);
          }

          // Use event_date from DB to preserve original date/time
          if (match.event_date) {
            const dbDate = new Date(match.event_date);
            if (!isNaN(dbDate.getTime())) {
              setMatchDate(dbDate);
              setCurrentMonth(dbDate);
            }
          }

          // Ensure scores/opponent names are hydrated if params were missing
          if (!opponentName && match.fencer_2_name) {
            setOpponentName(match.fencer_2_name);
          }
          if (!notes && match.notes) {
            setNotes(match.notes);
            setTempNotes(match.notes);
          }
          if ((!params.yourScore || !params.opponentScore) && match.final_score !== undefined && match.score_diff != null) {
            const yourScoreNum = match.final_score;
            const opponentScoreNum = match.final_score - match.score_diff;
            setYourScore(yourScoreNum.toString());
            setOpponentScore(opponentScoreNum.toString());
          }

          if (match.match_type === 'competition' && match.competition_id) {
            setEvent('Competition');
            setSelectedCompetitionId(match.competition_id);
            if (match.phase) {
              setCompetitionPhase(match.phase);
            }
            if (match.de_round) {
              setCompetitionRound(match.de_round);
            }
            setShowCompetitionSuggestions(false);
          }
        }
      }
    };
    fetchMatchData();
  }, [accessToken, isEditMode, params.matchId]);

  // Hydrate competition name when we have an ID but no chip label yet (e.g., edit mode)
  useEffect(() => {
    if (!selectedCompetitionId || selectedCompetitionName.trim().length > 0) {
      return;
    }
    let cancelled = false;
    const hydrateCompetition = async () => {
      try {
        const comp = await competitionService.getCompetitionById(
          selectedCompetitionId,
          accessToken ?? null
        );
        if (!comp || cancelled) {
          return;
        }
        setSelectedCompetitionName(comp.name);
        setCompetitionName('');
      } catch (error) {
        console.warn('Failed to hydrate competition name', error);
      }
    };
    hydrateCompetition();
    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedCompetitionId, selectedCompetitionName]);

  // Default weapon type to user's preferred weapon when creating a new manual match
  useEffect(() => {
    let cancelled = false;

    const normalizePreferredWeapon = (value: string | null | undefined) => {
      const normalized = (value || '').toLowerCase();
      if (normalized === 'foil' || normalized === 'epee' || normalized === 'sabre' || normalized === 'saber') {
        return normalized === 'saber' ? 'sabre' : normalized;
      }
      return null;
    };

    const toDisplayWeapon = (value: 'foil' | 'epee' | 'sabre') => {
      return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const loadPreferredWeapon = async () => {
      if (isEditMode) return;
      if (!user?.id) return;
      // Don't override if user already changed the selection away from the default
      if (weaponType !== 'Foil') return;

      try {
        const cached = await AsyncStorage.getItem('preferred_weapon');
        const cachedWeapon = normalizePreferredWeapon(cached);
        if (!cancelled && cachedWeapon) {
          setWeaponType(toDisplayWeapon(cachedWeapon));
        }

        const userData = await userService.getUserById(user.id, accessToken);
        const preferredWeapon = normalizePreferredWeapon(userData?.preferred_weapon);
        if (!cancelled && preferredWeapon) {
          setWeaponType(toDisplayWeapon(preferredWeapon));
        }
      } catch (error) {
        console.error('Error loading preferred weapon:', error);
      }
    };

    loadPreferredWeapon();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isEditMode, weaponType, accessToken]);

  const formatDate = (date: Date) => {
    const safe = isNaN(date.getTime()) ? new Date() : date;
    return safe.toLocaleDateString('en-US', {
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

  const openNotesModal = () => {
    setTempNotes(notes);
    setActiveListFormat(null);
    setShowListFormatMenu(false);
    setShowNotesModal(true);
  };

  const handleSaveNotesModal = () => {
    setNotes(tempNotes.trim());
    setActiveListFormat(null);
    setShowListFormatMenu(false);
    setShowNotesModal(false);
  };

  const handleCancelNotesModal = () => {
    setActiveListFormat(null);
    setShowListFormatMenu(false);
    setShowNotesModal(false);
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

    // Validate that at least one score is above 0
    const yourScoreNum = parseInt(yourScore) || 0;
    const opponentScoreNum = parseInt(opponentScore) || 0;
    
    if (yourScoreNum === 0 && opponentScoreNum === 0) {
      Alert.alert(
        'Invalid Scores',
        'At least one score must be above 0 to save the match.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (event === 'Competition') {
      if (!selectedCompetitionId) {
        Alert.alert('Competition Required', 'Please select or create a competition.');
        return;
      }

      if (!competitionPhase) {
        Alert.alert('Phase Required', 'Please select Poule or Direct Elimination.');
        return;
      }

      if (competitionPhase === 'DE' && !competitionRound) {
        Alert.alert('Round Required', 'Please select a direct elimination round.');
        return;
      }

      if (competitionPhase === 'POULE' && (yourScoreNum > 5 || opponentScoreNum > 5)) {
        Alert.alert('Invalid Poule Score', 'Poule matches are to 5. Please enter scores between 0 and 5.');
        return;
      }
    }

    const competitionPayload =
      event === 'Competition' && selectedCompetitionId
        ? {
            competition_id: selectedCompetitionId,
            phase: competitionPhase,
            de_round: competitionPhase === 'DE' ? competitionRound : null,
          }
        : {
            competition_id: null,
            phase: null,
            de_round: null,
          };

    setIsSaving(true);
    try {
      const matchId = params.matchId as string;
      const isEditing = isEditMode && matchId;
      const safeDate = isNaN(matchDate.getTime()) ? new Date() : matchDate;
      
      console.log(isEditing ? '💾 Updating manual match...' : '💾 Saving manual match...', {
        matchId: isEditing ? matchId : 'new',
        matchDate,
        opponentName,
        event,
        weaponType,
        notes,
        yourScore,
        opponentScore
      });

      let savedMatch: any = null;

      if (isEditing) {
    // Update existing match
    const dateStr = safeDate.toLocaleDateString('en-GB');
    const timeStr = safeDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    // Parse date and time to create ISO string
    const [day, month, year] = dateStr.split('/');
    const [hour, minute] = timeStr.replace(/[AP]M/i, '').split(':');
    const isPM = timeStr.toUpperCase().includes('PM');
    let hour24 = parseInt(hour, 10);
    if (isPM && hour24 !== 12) hour24 += 12;
    if (!isPM && hour24 === 12) hour24 = 0;
    
    const eventDateTime = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hour24, parseInt(minute, 10));
        
        const userDisplayName = userName || 'You';
        
        savedMatch = await matchService.updateMatch(matchId, {
          final_score: yourScoreNum,
          result: yourScoreNum > opponentScoreNum ? 'win' : 'loss',
          score_diff: yourScoreNum - opponentScoreNum,
          match_type: event === 'Training' ? 'training' : 'competition',
          fencer_1_name: userDisplayName,
          fencer_2_name: opponentName.trim(),
          event_date: eventDateTime.toISOString(),
          weapon_type: weaponType.toLowerCase(),
          notes: notes.trim() || undefined,
          ...competitionPayload,
        }, accessToken);
      } else {
        // Create new match
        savedMatch = await matchService.createManualMatch({
          userId: user.id,
          opponentName: opponentName.trim(),
          yourScore: yourScoreNum,
          opponentScore: opponentScoreNum,
          matchType: event === 'Training' ? 'training' : 'competition',
          date: safeDate.toLocaleDateString('en-GB'),
          time: safeDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          notes: notes.trim() || undefined,
          weaponType: weaponType,
          competitionId: competitionPayload.competition_id,
          phase: competitionPayload.phase,
          deRound: competitionPayload.de_round,
          accessToken,
        });
      }

      if (savedMatch) {
        console.log(isEditing ? '✅ Match updated successfully:' : '✅ Match saved successfully:', savedMatch);
        
        // Track match save/update success
        analytics.matchSave({ 
          match_type: event === 'Training' ? 'training' : 'competition',
          weapon_type: weaponType
        });

        if (!isEditing) {
          const winner =
            yourScoreNum === opponentScoreNum
              ? 'draw'
              : yourScoreNum > opponentScoreNum
                ? 'you'
                : 'opponent';

          analytics.matchCompleted({
            mode: 'manual',
            duration_seconds: undefined,
            your_score: yourScoreNum,
            opponent_score: opponentScoreNum,
            winner,
            weapon_type: weaponType.toLowerCase(),
            opponent_name: opponentName.trim() || undefined,
            is_offline: false,
            match_id: savedMatch.match_id,
          });
          sessionTracker.incrementMatches();
          void trackOnce('first_match_completed', { mode: 'manual' }, user?.id);
        }
        
        // Navigate to manual match summary page
        router.push({
          pathname: '/manual-match-summary',
          params: {
            matchId: savedMatch.match_id || matchId,
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
            fromAddMatch: 'true', // Flag to show Done button
            notes,
          }
        });
      } else {
        analytics.matchSaveFailure({ error_type: 'database_save_failed' });
        Alert.alert('Error', isEditing ? 'Failed to update match. Please try again.' : 'Failed to save match. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error saving match:', error);
      
      // Check for network-related errors
      const isNetworkError = 
        error?.message?.includes('Network request failed') ||
        error?.message?.includes('timed out') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('network') ||
        error?.code === 'NETWORK_ERROR' ||
        error?.name === 'NetworkError';
      
      if (isNetworkError) {
        analytics.matchSaveFailure({ error_type: 'network_error' });
        Alert.alert(
          'Network Error',
          'Unable to save match. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      } else {
        analytics.matchSaveFailure({ error_type: 'unexpected_error' });
        Alert.alert(
          'Error',
          isEditMode && params.matchId ? 'Failed to update match. Please try again.' : 'Failed to save match. Please try again.',
          [{ text: 'OK' }]
        );
      }
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
    const currentScore = scoreType === 'your' ? yourScore : opponentScore;
    // If score is 0, show empty input with placeholder so user can type immediately
    setTempScore(currentScore === '0' ? '' : currentScore);
    setShowScoreModal(true);
  };

  const closeScoreModal = () => {
    setShowScoreModal(false);
    setEditingScore(null);
    setTempScore('');
  };

  const saveScore = () => {
    const normalized = tempScore.trim();
    const valueToSave = normalized === '' ? '0' : normalized;
    if (editingScore === 'your') {
      setYourScore(valueToSave);
    } else if (editingScore === 'opponent') {
      setOpponentScore(valueToSave);
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
    competitionSection: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: getDimension(0.03, width),
      marginBottom: getDimension(0.012, height),
      overflow: 'hidden',
    },
    competitionSectionBody: {
      padding: getDimension(0.025, width),
      paddingTop: getDimension(0.02, height),
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
      backgroundColor: '#0F1112', // Darker, more opaque background to ensure nothing shows through
      opacity: 1, // Explicitly set to 1 to ensure no transparency
      borderRadius: getDimension(0.02, width),
      borderWidth: 0, // Remove border to eliminate purple outline
      maxHeight: getDimension(0.15, height),
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.7,
      shadowRadius: 12,
      elevation: 25, // Android elevation
    },
    dropdownOptionsModal: {
      position: 'absolute',
      backgroundColor: '#0F1112', // Fully opaque dark background
      borderRadius: getDimension(0.02, width),
      borderWidth: 0,
      maxHeight: getDimension(0.15, height),
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.7,
      shadowRadius: 12,
      elevation: 50, // Very high Android elevation
    },
    competitionBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopLeftRadius: getDimension(0.03, width),
      borderTopRightRadius: getDimension(0.03, width),
      paddingHorizontal: getDimension(0.04, width),
      paddingVertical: getDimension(0.018, height),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    competitionBannerText: {
      fontSize: getDimension(0.045, width),
      fontWeight: '700',
      color: '#C8A6FF',
    },
    competitionSuggestions: {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: getDimension(0.02, width),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      overflow: 'hidden',
      marginTop: getDimension(0.008, height),
    },
    phaseToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.25)',
      borderRadius: getDimension(0.03, width),
      padding: getDimension(0.006, width),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      marginBottom: getDimension(0.01, height),
      marginTop: getDimension(0.004, height),
    },
    phaseOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: getDimension(0.012, height),
      borderRadius: getDimension(0.03, width),
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      marginHorizontal: getDimension(0.004, width),
    },
    phaseOptionActive: {
      backgroundColor: 'rgba(139, 92, 246, 0.25)',
      borderColor: '#C8A6FF',
      shadowColor: '#8B5CF6',
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 3,
    },
    phaseOptionText: {
      fontSize: getDimension(0.038, width),
      color: 'rgba(255, 255, 255, 0.65)',
      fontWeight: '600',
    },
    phaseOptionTextActive: {
      color: '#E9D7FF',
    },
    roundChipsRow: {
      flexDirection: 'row',
      marginTop: getDimension(0.004, height),
      marginBottom: getDimension(0.012, height),
    },
    roundChipsRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: getDimension(0.01, width),
    },
    roundChipsRowDisabled: {
      opacity: 0.55,
    },
    roundChip: {
      paddingVertical: getDimension(0.006, height),
      paddingHorizontal: getDimension(0.018, width),
      borderRadius: getDimension(0.02, width),
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      marginRight: getDimension(0.01, width),
      minWidth: getDimension(0.085, width),
      alignItems: 'center',
    },
    roundChipActive: {
      borderColor: '#C8A6FF',
      backgroundColor: 'rgba(139, 92, 246, 0.28)',
      shadowColor: '#8B5CF6',
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 2,
    },
    roundChipText: {
      fontSize: getDimension(0.033, width),
      color: 'rgba(255, 255, 255, 0.6)',
      fontWeight: '600',
    },
    roundChipTextActive: {
      color: '#E9D7FF',
    },
    competitionSuggestionItem: {
      paddingHorizontal: getDimension(0.03, width),
      paddingVertical: getDimension(0.012, height),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    competitionSuggestionItemLast: {
      borderBottomWidth: 0,
    },
    competitionSuggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    competitionSuggestionTitle: {
      fontSize: getDimension(0.04, width),
      color: 'white',
      fontWeight: '600',
    },
    competitionSuggestionSubtitle: {
      fontSize: getDimension(0.032, width),
      color: 'rgba(255, 255, 255, 0.65)',
      marginTop: getDimension(0.002, height),
    },
    competitionInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: getDimension(0.02, width),
      paddingHorizontal: getDimension(0.02, width),
      paddingVertical: getDimension(0.006, height),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    competitionInputText: {
      flex: 1,
      minWidth: getDimension(0.2, width),
      fontSize: getDimension(0.04, width),
      color: 'white',
      paddingVertical: getDimension(0.006, height),
    },
    competitionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: getDimension(0.006, height),
      paddingHorizontal: getDimension(0.02, width),
      borderRadius: getDimension(0.02, width),
      backgroundColor: 'rgba(139, 92, 246, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(200, 166, 255, 0.7)',
      marginRight: getDimension(0.01, width),
    },
    competitionChipText: {
      marginRight: getDimension(0.01, width),
      fontSize: getDimension(0.035, width),
      color: '#E9D7FF',
      fontWeight: '600',
    },
    competitionCreateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getDimension(0.01, width),
      paddingVertical: getDimension(0.006, height),
      paddingHorizontal: getDimension(0.02, width),
      borderRadius: getDimension(0.02, width),
      backgroundColor: 'rgba(123, 92, 255, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(123, 92, 255, 0.5)',
      maxWidth: '100%',
    },
    competitionCreateRow: {
      width: '100%',
      marginTop: getDimension(0.006, height),
      alignItems: 'flex-start',
    },
    competitionCreateChipText: {
      fontSize: getDimension(0.034, width),
      color: '#E9D7FF',
      fontWeight: '600',
      flexShrink: 1,
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
    modalContent: {
      borderRadius: getDimension(0.03, width),
      padding: getDimension(0.04, width),
      width: getDimension(0.9, width),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: getDimension(0.02, height),
    },
    modalHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getDimension(0.02, width),
    },
    listFormatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getDimension(0.01, width),
      paddingHorizontal: getDimension(0.02, width),
      paddingVertical: getDimension(0.01, height),
      borderRadius: getDimension(0.02, width),
      borderWidth: 1,
      borderColor: 'rgba(200, 166, 255, 0.6)',
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    listFormatButtonActive: {
      backgroundColor: 'rgba(139, 92, 246, 0.35)',
      borderColor: 'rgba(200, 166, 255, 0.9)',
    },
    listFormatButtonText: {
      color: 'white',
      fontSize: getDimension(0.035, width),
      fontWeight: '600',
    },
    inputContainer: {
      width: '100%',
    },
    listFormatMenu: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getDimension(0.02, width),
      backgroundColor: 'rgba(30, 30, 30, 0.95)',
      borderRadius: getDimension(0.02, width),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      marginBottom: getDimension(0.02, height),
      paddingVertical: getDimension(0.012, height),
      paddingHorizontal: getDimension(0.02, width),
      flexWrap: 'nowrap',
    },
    listFormatOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: getDimension(0.01, width),
      paddingHorizontal: getDimension(0.025, width),
      paddingVertical: getDimension(0.01, height),
      borderRadius: getDimension(0.02, width),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    listFormatOptionActive: {
      backgroundColor: 'rgba(139, 92, 246, 0.3)',
      borderColor: 'rgba(200, 166, 255, 0.8)',
    },
    listFormatOptionIcon: {
      color: 'white',
      fontSize: getDimension(0.038, width),
      fontWeight: '700',
    },
    listFormatOptionText: {
      color: 'white',
      fontSize: getDimension(0.034, width),
      fontWeight: '600',
    },
    listFormatOptionTextActive: {
      color: '#E9D7FF',
    },
    closeButton: {
      padding: getDimension(0.01, width),
    },
    textInput: {
      color: 'white',
      fontSize: getDimension(0.04, width),
      textAlignVertical: 'top',
      padding: getDimension(0.03, width),
      borderRadius: getDimension(0.02, width),
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    characterCount: {
      marginTop: getDimension(0.01, height),
      alignSelf: 'flex-end',
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: getDimension(0.035, width),
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: getDimension(0.02, height),
    },
    cancelButton: {
      paddingVertical: getDimension(0.015, height),
      paddingHorizontal: getDimension(0.04, width),
      borderRadius: getDimension(0.02, width),
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      backgroundColor: 'transparent',
    },
    cancelButtonText: {
      color: 'white',
      fontWeight: '600',
      fontSize: getDimension(0.04, width),
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
      zIndex: 1, // Lower z-index since dropdowns render outside
    },
    dropdownBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 3000,
    },
    fullScreenBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2999, // Just below the dropdown options but above everything else
      backgroundColor: 'transparent', // Transparent so it doesn't block the view
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
            <View 
              ref={eventDropdownRef}
              style={styles.dropdownWrapper}
            >
              <TouchableOpacity 
                style={styles.dropdownContainer}
                onLayout={(e) => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  // Get screen position by measuring in window
                  const node = findNodeHandle(eventDropdownRef.current);
                  if (node && Platform.OS !== 'web') {
                    UIManager.measureInWindow(node, (screenX, screenY, screenWidth, screenHeight) => {
                      setEventDropdownPosition({ x: screenX, y: screenY + screenHeight, width: screenWidth });
                    });
                  } else {
                    // Fallback: use layout values (less accurate but works)
                    setEventDropdownPosition({ x, y: y + height, width });
                  }
                }}
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
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weapon Type</Text>
            <View 
              ref={weaponDropdownRef}
              style={styles.dropdownWrapper}
            >
              <TouchableOpacity 
                style={styles.dropdownContainer}
                onLayout={(e) => {
                  const { x, y, width, height } = e.nativeEvent.layout;
                  // Get screen position by measuring in window
                  const node = findNodeHandle(weaponDropdownRef.current);
                  if (node && Platform.OS !== 'web') {
                    UIManager.measureInWindow(node, (screenX, screenY, screenWidth, screenHeight) => {
                      setWeaponDropdownPosition({ x: screenX, y: screenY + screenHeight, width: screenWidth });
                    });
                  } else {
                    // Fallback: use layout values (less accurate but works)
                    setWeaponDropdownPosition({ x, y: y + height, width });
                  }
                }}
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
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openNotesModal}
              style={[styles.inputField, { justifyContent: 'center' }]}
            >
              <Text
                style={{
                  color: notes ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                  fontSize: getDimension(0.04, width),
                  lineHeight: getDimension(0.055, width),
                  fontWeight: '500',
                }}
                numberOfLines={3}
              >
                {notes || 'Add match notes...'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {event === 'Competition' && (
          <View style={styles.competitionSection}>
            <LinearGradient
              colors={['#3B2A48', '#2A2430']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.competitionBanner}
            >
              <Text style={styles.competitionBannerText}>Competition Details</Text>
              <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.85)" />
            </LinearGradient>
            <View style={styles.competitionSectionBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Competition</Text>
                <View style={styles.competitionInputContainer}>
                  {selectedCompetitionId && selectedCompetitionName.trim().length > 0 && (
                    <View style={styles.competitionChip}>
                      <Text style={styles.competitionChipText}>{selectedCompetitionName.trim()}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCompetitionId(null);
                          setSelectedCompetitionName('');
                          setCompetitionName('');
                          setShowCompetitionSuggestions(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={14} color="#E9D7FF" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <TextInput
                    style={styles.competitionInputText}
                    value={competitionName}
                    onChangeText={(value) => {
                      if (selectedCompetitionId) {
                        setSelectedCompetitionId(null);
                        setSelectedCompetitionName('');
                      }
                      setCompetitionName(value);
                      setActiveCompetition(null);
                      setShowCompetitionSuggestions(true);
                    }}
                    placeholder={
                      selectedCompetitionId && !selectedCompetitionName.trim()
                        ? 'Loading competition...'
                        : selectedCompetitionId
                          ? ''
                          : 'Search or create competition'
                    }
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    onFocus={() => setShowCompetitionSuggestions(true)}
                    editable={!selectedCompetitionId || !selectedCompetitionName.trim()}
                  />
                  {!selectedCompetitionId && competitionName.trim().length > 0 && (
                    <View style={styles.competitionCreateRow}>
                      <TouchableOpacity
                        style={styles.competitionCreateChip}
                        onPress={handleCreateCompetition}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={14} color="#E9D7FF" />
                        <Text style={styles.competitionCreateChipText} numberOfLines={1}>
                          Create “{competitionName.trim()}”
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.phaseToggle}>
                <TouchableOpacity
                  style={[
                    styles.phaseOption,
                    competitionPhase === 'POULE' && styles.phaseOptionActive,
                  ]}
                  onPress={() => setCompetitionPhase('POULE')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.phaseOptionText,
                      competitionPhase === 'POULE' && styles.phaseOptionTextActive,
                    ]}
                  >
                    Poule
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.phaseOption,
                    competitionPhase === 'DE' && styles.phaseOptionActive,
                  ]}
                  onPress={() => setCompetitionPhase('DE')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.phaseOptionText,
                      competitionPhase === 'DE' && styles.phaseOptionTextActive,
                    ]}
                  >
                    Direct Elimination
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[
                  styles.roundChipsRow,
                  competitionPhase !== 'DE' && styles.roundChipsRowDisabled,
                ]}
                contentContainerStyle={styles.roundChipsRowContent}
              >
                {deRounds.map((round) => {
                  const isActive = competitionRound === round;
                  return (
                    <TouchableOpacity
                      key={round}
                      style={[
                        styles.roundChip,
                        isActive && styles.roundChipActive,
                      ]}
                      onPress={() => setCompetitionRound(round)}
                      activeOpacity={0.8}
                      disabled={competitionPhase !== 'DE'}
                    >
                      <Text
                        style={[
                          styles.roundChipText,
                          isActive && styles.roundChipTextActive,
                        ]}
                      >
                        {round}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {showCompetitionSuggestions && (
                <View style={styles.competitionSuggestions}>
                  {activeCompetition && (
                    <TouchableOpacity
                      style={styles.competitionSuggestionItem}
                      onPress={async () => {
                        setSelectedCompetitionId(activeCompetition.competition_id);
                        setSelectedCompetitionName(activeCompetition.name);
                        setCompetitionName('');
                        setShowCompetitionSuggestions(false);
                    }}
                  >
                      <View style={styles.competitionSuggestionRow}>
                        <View>
                          <Text style={styles.competitionSuggestionTitle}>{activeCompetition.name}</Text>
                          <Text style={styles.competitionSuggestionSubtitle}>Recent competition</Text>
                        </View>
                        <Ionicons name="time" size={16} color="rgba(255,255,255,0.6)" />
                      </View>
                    </TouchableOpacity>
                  )}

                  {competitionSuggestions
                    .filter(comp => comp.competition_id !== activeCompetition?.competition_id)
                    .map((comp, index, arr) => (
                      <TouchableOpacity
                        key={comp.competition_id}
                        style={[
                          styles.competitionSuggestionItem,
                          index === arr.length - 1 && styles.competitionSuggestionItemLast,
                        ]}
                        onPress={async () => {
                          setSelectedCompetitionId(comp.competition_id);
                          setSelectedCompetitionName(comp.name);
                          setCompetitionName('');
                          setShowCompetitionSuggestions(false);
                        }}
                      >
                        <View style={styles.competitionSuggestionRow}>
                          <View>
                            <Text style={styles.competitionSuggestionTitle}>{comp.name}</Text>
                            <Text style={styles.competitionSuggestionSubtitle}>
                              {comp.event_date} · {comp.weapon_type.toUpperCase()}
                            </Text>
                          </View>
                          {selectedCompetitionId === comp.competition_id && (
                            <Ionicons name="checkmark" size={16} color={Colors.purple.primary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}

                  {competitionLoading && (
                    <View style={styles.competitionSuggestionItem}>
                      <Text style={styles.competitionSuggestionSubtitle}>Searching…</Text>
                    </View>
                  )}

                </View>
              )}
            </View>
          </View>
        )}

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
        
        {/* Full-screen backdrop to close dropdowns when clicking outside */}
        {(showEventDropdown || showWeaponDropdown) && (
          <TouchableOpacity
            style={styles.fullScreenBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowEventDropdown(false);
              setShowWeaponDropdown(false);
            }}
          />
        )}
        
        {/* Event Dropdown Modal - Rendered as Modal for production reliability */}
        <Modal
          visible={showEventDropdown}
          transparent={true}
          animationType="none"
          onRequestClose={() => setShowEventDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowEventDropdown(false)}
          >
            <View style={[
              styles.dropdownOptionsModal,
              {
                top: eventDropdownPosition.y || getDimension(0.3, height),
                left: eventDropdownPosition.x || getDimension(0.04, width),
                width: eventDropdownPosition.width || getDimension(0.92, width),
              }
            ]}>
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
          </TouchableOpacity>
        </Modal>
        
        {/* Weapon Dropdown Modal - Rendered as Modal for production reliability */}
        <Modal
          visible={showWeaponDropdown}
          transparent={true}
          animationType="none"
          onRequestClose={() => setShowWeaponDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowWeaponDropdown(false)}
          >
            <View style={[
              styles.dropdownOptionsModal,
              {
                top: weaponDropdownPosition.y || getDimension(0.4, height),
                left: weaponDropdownPosition.x || getDimension(0.04, width),
                width: weaponDropdownPosition.width || getDimension(0.92, width),
              }
            ]}>
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
          </TouchableOpacity>
        </Modal>
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
                  selectTextOnFocus={true}
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

      {/* Notes Modal */}
      <Modal
        visible={showNotesModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancelNotesModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            handleCancelNotesModal();
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 50}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalContainer}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.05)']}
                  style={[styles.modalContent, { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' }]}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Match Notes</Text>
                    <View style={styles.modalHeaderActions}>
                      <TouchableOpacity
                        onPress={() => setShowListFormatMenu(prev => !prev)}
                        style={[
                          styles.listFormatButton,
                          activeListFormat && styles.listFormatButtonActive,
                        ]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="list" size={18} color="white" />
                        <Text style={styles.listFormatButtonText}>
                          {listFormatSuffix ? `List ${listFormatSuffix}` : 'List'}
                        </Text>
                        <Ionicons
                          name={showListFormatMenu ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color="white"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleCancelNotesModal} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    {showListFormatMenu && (
                      <View style={styles.listFormatMenu}>
                        <TouchableOpacity
                          style={[
                            styles.listFormatOption,
                            activeListFormat === 'bullet' && styles.listFormatOptionActive,
                          ]}
                          onPress={() => insertListPrefix('bullet')}
                        >
                          <Text style={styles.listFormatOptionIcon}>•</Text>
                          <Text
                            style={[
                              styles.listFormatOptionText,
                              activeListFormat === 'bullet' && styles.listFormatOptionTextActive,
                            ]}
                          >
                            Bullet
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.listFormatOption,
                            activeListFormat === 'dash' && styles.listFormatOptionActive,
                          ]}
                          onPress={() => insertListPrefix('dash')}
                        >
                          <Text style={styles.listFormatOptionIcon}>-</Text>
                          <Text
                            style={[
                              styles.listFormatOptionText,
                              activeListFormat === 'dash' && styles.listFormatOptionTextActive,
                            ]}
                          >
                            Dash
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.listFormatOption,
                            activeListFormat === 'number' && styles.listFormatOptionActive,
                          ]}
                          onPress={() => insertListPrefix('number')}
                        >
                          <Text style={styles.listFormatOptionIcon}>1.</Text>
                          <Text
                            style={[
                              styles.listFormatOptionText,
                              activeListFormat === 'number' && styles.listFormatOptionTextActive,
                            ]}
                          >
                            Numbered
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <TextInput
                      style={[styles.textInput, { minHeight: 140 }]}
                      value={tempNotes}
                      onChangeText={handleNotesChange}
                      placeholder="Add match notes..."
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      multiline
                      maxLength={500}
                      autoFocus
                    />
                    <Text style={styles.characterCount}>{tempNotes.length}/500</Text>
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity onPress={handleSaveNotesModal} style={styles.cancelButton}>
                      <Text style={styles.cancelButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

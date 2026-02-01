import { BackButton } from '@/components/BackButton';
import { LossPill } from '@/components/LossPill';
import { WinPill } from '@/components/WinPill';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { competitionService, matchService } from '@/lib/database';
import { Competition, SimpleMatch } from '@/types/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type CompetitionMatch = SimpleMatch;

const getInitials = (name: string | undefined): string => {
  if (!name || name.trim() === '') return '?';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase();
};

const roundOrder: Record<string, number> = {
  L256: 1,
  L128: 2,
  L64: 3,
  L32: 4,
  L16: 5,
  QF: 6,
  SF: 7,
  F: 8,
};

export default function CompetitionDetailScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, session, userName } = useAuth();
  const params = useLocalSearchParams();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';
  const refreshKey = typeof params.refreshAt === 'string' ? params.refreshAt : '';

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompetitionMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftType, setDraftType] = useState<Competition['type']>('Other');
  const [draftTypeLabel, setDraftTypeLabel] = useState('');
  const [draftWeapon, setDraftWeapon] = useState<Competition['weapon_type']>('foil');
  const [draftPlacement, setDraftPlacement] = useState('');
  const [draftFieldSize, setDraftFieldSize] = useState('');
  const [draftPostNotes, setDraftPostNotes] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [tempNotes, setTempNotes] = useState('');
  const [showListFormatMenu, setShowListFormatMenu] = useState(false);
  const [activeListFormat, setActiveListFormat] = useState<'bullet' | 'dash' | 'number' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
  const hasTrackedDetailViewRef = useRef(false);
  const postNotesEditedRef = useRef(false);

  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatWeapon = (weapon?: string | null): string => {
    if (!weapon) return '—';
    return `${weapon.charAt(0).toUpperCase()}${weapon.slice(1)}`;
  };

  const formatCompetitionType = (type?: Competition['type'], label?: string | null): string => {
    if (!type) return 'Competition';
    if (type === 'Other') return label?.trim() || 'Other';
    switch (type) {
      case 'WorldCup':
        return 'World Cup';
      case 'GrandPrix':
        return 'Grand Prix';
      case 'National':
        return 'National';
      case 'Open':
        return 'Open';
      default:
        return type;
    }
  };

  const formatOrdinal = (value: number): string => {
    const mod100 = value % 100;
    const mod10 = value % 10;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
    if (mod10 === 1) return `${value}st`;
    if (mod10 === 2) return `${value}nd`;
    if (mod10 === 3) return `${value}rd`;
    return `${value}th`;
  };

  const formatPlacement = (placement?: number | null, fieldSize?: number | null): string => {
    if (!placement || !fieldSize) return '—';
    const percentile = Math.round((placement / fieldSize) * 100);
    return `${formatOrdinal(placement)} / ${fieldSize} (${percentile}%)`;
  };

  const formatDateInputValue = (date: Date): string => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDraftDateToLocal = (value: string): Date | null => {
    const normalized = normalizeDateInput(value);
    if (!normalized) return null;
    const [yearStr, monthStr, dayStr] = normalized.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const formatDraftDateDisplay = (value: string): string => {
    const normalized = normalizeDateInput(value);
    if (!normalized) return value || 'Select date';
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}/${year}`;
  };

  const normalizeDateInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, dayRaw, monthRaw, yearRaw] = slashMatch;
      const day = dayRaw.padStart(2, '0');
      const month = monthRaw.padStart(2, '0');
      return `${yearRaw}-${month}-${day}`;
    }
    return null;
  };

  const applyCompetitionToDraft = (data: Competition | null) => {
    if (!data) return;
    setDraftName(data.name ?? '');
    setDraftDate(data.event_date ? data.event_date.split('T')[0] : '');
    setDraftType(data.type ?? 'Other');
    setDraftTypeLabel(data.type_label ?? '');
    setDraftWeapon(data.weapon_type ?? 'foil');
    setDraftPlacement(data.placement ? String(data.placement) : '');
    setDraftFieldSize(data.field_size ? String(data.field_size) : '');
    setDraftPostNotes(data.post_competition_notes ?? data.pre_competition_notes ?? '');
  };

  const getMatchTimestamp = (match: CompetitionMatch): number => {
    const date = new Date(match.date);
    if (match.time && match.time.includes(':')) {
      const [hourStr, minuteStr] = match.time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
        date.setHours(hour, minute, 0, 0);
      }
    }
    return date.getTime();
  };

  useEffect(() => {
    let isMounted = true;
    const loadCompetition = async () => {
      if (!competitionId || !user?.id) return;
      setLoading(true);
      try {
        const [competitionData, matchData] = await Promise.all([
          competitionService.getCompetitionById(competitionId, session?.access_token),
          matchService.getCompetitionMatches(
            competitionId,
            user.id,
            userName ?? undefined,
            session?.access_token
          ),
        ]);

        if (!isMounted) return;
        setCompetition(competitionData);
        applyCompetitionToDraft(competitionData);
        setMatches(matchData || []);
      } catch (error) {
        console.error('Error loading competition detail:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCompetition();
    return () => {
      isMounted = false;
    };
  }, [competitionId, refreshKey, user?.id, session?.access_token, userName]);

  useEffect(() => {
    if (!competition || hasTrackedDetailViewRef.current) return;
    analytics.capture('competition_detail_viewed', {
      competition_id: competition.competition_id,
      weapon_type: competition.weapon_type,
      competition_type: competition.type,
      source: 'competition_detail',
    });
    hasTrackedDetailViewRef.current = true;
  }, [competition]);

  useEffect(() => {
    if (competition && !isEditing) {
      applyCompetitionToDraft(competition);
    }
  }, [competition, isEditing]);

  const { wins, losses } = useMemo(() => {
    const winCount = matches.filter(match => match.isWin).length;
    return { wins: winCount, losses: matches.length - winCount };
  }, [matches]);

  const pouleMatches = useMemo(() => {
    return matches
      .filter(match => match.competitionPhase === 'POULE' || (!match.competitionPhase && !match.competitionRound))
      .sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a));
  }, [matches]);

  const deMatchesByRound = useMemo(() => {
    const deMatches = matches.filter(match => match.competitionPhase === 'DE' || match.competitionRound);
    const map = new Map<string, CompetitionMatch[]>();
    deMatches.forEach(match => {
      const round = match.competitionRound || 'DE';
      if (!map.has(round)) {
        map.set(round, []);
      }
      map.get(round)?.push(match);
    });

    const sorted = Array.from(map.entries()).sort((a, b) => {
      const orderA = roundOrder[a[0]] ?? 999;
      const orderB = roundOrder[b[0]] ?? 999;
      return orderA - orderB;
    });

    return sorted.map(([round, roundMatches]) => ({
      round,
      matches: roundMatches.sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a)),
    }));
  }, [matches]);

  const latestMatch = useMemo(() => {
    if (matches.length === 0) return null;
    return matches.reduce((latest, match) => {
      if (!latest) return match;
      return getMatchTimestamp(match) > getMatchTimestamp(latest) ? match : latest;
    }, null as CompetitionMatch | null);
  }, [matches]);

  const renderMatchRow = (match: CompetitionMatch, pillLabel: string) => {
    const scoreText = `${match.youScore} - ${match.opponentScore}`;
    const matchTypeLabel =
      match.matchType?.toLowerCase() === 'training' ? 'Training' : 'Competition';
    return (
      <TouchableOpacity
        key={match.id}
        style={styles.matchRow}
        onPress={() => {
          if (match.source === 'manual') {
            router.push({
              pathname: '/manual-match-summary',
              params: {
                matchId: match.id,
                yourScore: match.youScore.toString(),
                opponentScore: match.opponentScore.toString(),
                opponentName: match.opponentName,
                matchType: matchTypeLabel,
                date: match.date,
                time: match.time || '12:00PM',
                isWin: match.isWin.toString(),
                notes: match.notes || '',
              },
            });
          } else {
            router.push({
              pathname: '/match-history-details',
              params: {
                matchId: match.id,
                opponentName: match.opponentName,
                opponentImage: '',
                youScore: match.youScore.toString(),
                opponentScore: match.opponentScore.toString(),
                matchType: matchTypeLabel,
                date: match.date,
                duration: '02:30',
                location: 'Metro Field House',
                isWin: match.isWin.toString(),
              },
            });
          }
        }}
        activeOpacity={0.85}
      >
        <View style={styles.matchLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(match.opponentName)}</Text>
          </View>
          <View style={styles.matchInfo}>
            <View style={styles.matchNameRow}>
              <View style={styles.roundPill}>
                <Text style={styles.roundPillText}>{pillLabel}</Text>
              </View>
              <Text style={styles.opponentName}>{match.opponentName}</Text>
            </View>
            <Text style={styles.matchMeta}>
              {formatDate(match.date)}{match.time ? ` · ${match.time}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.matchRight}>
          <Text style={styles.scoreText}>{scoreText}</Text>
          {match.isWin ? (
            <WinPill customStyle={styles.resultPill} textStyle={styles.resultPillText} />
          ) : (
            <LossPill customStyle={styles.resultPill} textStyle={styles.resultPillText} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const modalStyles = useMemo(
    () =>
      StyleSheet.create({
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: width * 0.025,
        },
        modalContainer: {
          width: width * 0.95,
          maxWidth: width * 0.95,
        },
        modalContent: {
          borderRadius: width * 0.04,
          padding: width * 0.05,
          borderWidth: 1,
          borderColor: 'rgba(153, 128, 255, 0.15)',
          overflow: 'hidden',
        },
        modalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: height * 0.02,
        },
        modalHeaderActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: width * 0.02,
        },
        modalTitle: {
          fontSize: Math.round(width * 0.06),
          fontWeight: '700',
          color: 'white',
        },
        closeButton: {
          width: width * 0.08,
          height: width * 0.08,
          borderRadius: width * 0.04,
          backgroundColor: '#404040',
          alignItems: 'center',
          justifyContent: 'center',
        },
        listFormatButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: width * 0.01,
          paddingHorizontal: width * 0.02,
          paddingVertical: height * 0.008,
          borderRadius: width * 0.02,
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
          fontSize: width * 0.035,
          fontWeight: '600',
        },
        inputContainer: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: width * 0.02,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          minHeight: height * 0.25,
          marginBottom: height * 0.02,
        },
        listFormatMenu: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: width * 0.02,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          borderRadius: width * 0.02,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          marginBottom: height * 0.02,
          paddingVertical: height * 0.01,
          paddingHorizontal: width * 0.02,
          flexWrap: 'nowrap',
        },
        listFormatOption: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: width * 0.01,
          paddingHorizontal: width * 0.025,
          paddingVertical: height * 0.008,
          borderRadius: width * 0.02,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          backgroundColor: 'rgba(20, 20, 24, 0.45)',
        },
        listFormatOptionActive: {
          backgroundColor: 'rgba(139, 92, 246, 0.28)',
          borderColor: 'rgba(200, 166, 255, 0.85)',
        },
        listFormatOptionIcon: {
          color: 'white',
          fontSize: width * 0.04,
          fontWeight: '700',
        },
        listFormatOptionText: {
          color: 'white',
          fontSize: width * 0.034,
          fontWeight: '600',
        },
        listFormatOptionTextActive: {
          color: '#E9D7FF',
        },
        textInput: {
          color: 'white',
          fontSize: Math.round(width * 0.04),
          padding: width * 0.03,
          textAlignVertical: 'top',
          minHeight: height * 0.25,
        },
        modalFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        characterCount: {
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: Math.round(width * 0.035),
        },
        buttonContainer: {
          flexDirection: 'row',
          gap: width * 0.02,
        },
        cancelButton: {
          paddingHorizontal: width * 0.05,
          paddingVertical: height * 0.012,
          borderRadius: width * 0.02,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
        cancelButtonText: {
          color: 'white',
          fontWeight: '600',
        },
        saveButton: {
          paddingHorizontal: width * 0.05,
          paddingVertical: height * 0.012,
          borderRadius: width * 0.02,
          backgroundColor: Colors.purple.primary,
        },
        saveButtonText: {
          color: 'white',
          fontWeight: '600',
        },
      }),
    [height, width]
  );

  const handleCancelEdit = () => {
    setIsEditing(false);
    setErrorMessage(null);
    applyCompetitionToDraft(competition);
    postNotesEditedRef.current = false;
  };

  const openNotesModal = () => {
    setTempNotes(draftPostNotes);
    setShowListFormatMenu(false);
    setActiveListFormat(null);
    setShowNotesModal(true);
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
    const baseline = (competition?.post_competition_notes ?? competition?.pre_competition_notes ?? '').trim();
    if (!postNotesEditedRef.current && value.trim() !== baseline) {
      postNotesEditedRef.current = true;
      analytics.capture('competition_notes_edited', {
        competition_id: competitionId,
        note_type: 'competition',
        source: 'competition_detail',
      });
    }
  };

  const handleNotesModalSave = () => {
    setDraftPostNotes(tempNotes);
    setShowListFormatMenu(false);
    setActiveListFormat(null);
    setShowNotesModal(false);
  };

  const handleNotesModalCancel = () => {
    setTempNotes(draftPostNotes);
    setShowListFormatMenu(false);
    setActiveListFormat(null);
    setShowNotesModal(false);
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

  const openDatePicker = () => {
    const parsed = parseDraftDateToLocal(draftDate);
    const fallback = competition?.event_date ? new Date(competition.event_date) : null;
    setDatePickerValue(parsed ?? fallback ?? new Date());
    setShowDatePicker(true);
  };

  const handleDateChange = (event: { type?: string }, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event?.type === 'dismissed') {
      return;
    }
    const nextDate = selectedDate ?? datePickerValue;
    setDatePickerValue(nextDate);
    if (Platform.OS === 'android') {
      setDraftDate(formatDateInputValue(nextDate));
    }
  };

  const handleDateModalSave = () => {
    setDraftDate(formatDateInputValue(datePickerValue));
    setShowDatePicker(false);
  };

  const handleDateModalCancel = () => {
    setShowDatePicker(false);
  };

  const handleAddMatch = () => {
    if (!competition) return;
    const phase = latestMatch?.competitionPhase === 'DE' ? 'DE' : 'POULE';
    const deRound = latestMatch?.competitionRound || undefined;
    router.push({
      pathname: '/add-match',
      params: {
        eventType: 'Competition',
        competitionId: competition.competition_id,
        competitionName: competition.name ?? '',
        competitionWeaponType: competition.weapon_type ?? '',
        eventDate: competition.event_date ?? '',
        lockCompetition: 'true',
        phase,
        deRound: deRound ?? '',
        returnToCompetitionId: competition.competition_id,
      },
    });
  };

  const handleSave = async () => {
    if (!competitionId) return;
    setErrorMessage(null);

    const normalizedDate = normalizeDateInput(draftDate);
    if (!draftName.trim()) {
      setErrorMessage('Please enter a competition name.');
      return;
    }
    if (!normalizedDate) {
      setErrorMessage('Enter a valid date (YYYY-MM-DD or DD/MM/YYYY).');
      return;
    }

    const placementValue = draftPlacement.trim() ? parseInt(draftPlacement, 10) : null;
    const fieldSizeValue = draftFieldSize.trim() ? parseInt(draftFieldSize, 10) : null;

    if (placementValue !== null && (!Number.isFinite(placementValue) || placementValue < 1)) {
      setErrorMessage('Placement must be a positive number.');
      return;
    }
    if (fieldSizeValue !== null && (!Number.isFinite(fieldSizeValue) || fieldSizeValue < 1)) {
      setErrorMessage('Field size must be a positive number.');
      return;
    }
    if (placementValue !== null && fieldSizeValue !== null && placementValue > fieldSizeValue) {
      setErrorMessage('Placement cannot be greater than field size.');
      return;
    }

    const baselineNotes = (competition?.post_competition_notes ?? competition?.pre_competition_notes ?? '').trim();
    const notesChanged = draftPostNotes.trim() !== baselineNotes;

    setIsSaving(true);
    try {
      const updated = await competitionService.updateCompetition(
        competitionId,
        {
          name: draftName.trim(),
          event_date: normalizedDate,
          weapon_type: draftWeapon,
          type: draftType,
          type_label: draftType === 'Other' ? (draftTypeLabel.trim() || null) : null,
          placement: placementValue,
          field_size: fieldSizeValue,
          post_competition_notes: draftPostNotes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        session?.access_token
      );

      if (!updated) {
        setErrorMessage('Failed to save changes. Please try again.');
        return;
      }

      if (notesChanged) {
        analytics.capture('competition_notes_saved', {
          competition_id: competitionId,
          post_changed: notesChanged,
          source: 'competition_detail',
        });
      }

      setCompetition(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving competition:', error);
      setErrorMessage('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!competitionId) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Competition Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Competition not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Competition Details</Text>
        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.headerActionButton}>
                <Text style={styles.headerActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.headerActionButton, styles.headerActionPrimary]}
                disabled={isSaving}
              >
                <Text style={styles.headerActionText}>{isSaving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => {
                postNotesEditedRef.current = false;
                setIsEditing(true);
              }}
              style={styles.headerActionButton}
            >
              <Text style={styles.headerActionText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading competition...</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                {isEditing ? (
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    style={[styles.summaryTitle, styles.input]}
                    placeholder="Competition name"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  />
                ) : (
                  <Text style={styles.summaryTitle} numberOfLines={1}>
                    {competition?.name || 'Competition'}
                  </Text>
                )}
                <View style={styles.competitionPill}>
                  <Text style={styles.competitionPillText}>Competition</Text>
                </View>
              </View>
              {isEditing ? (
                <View style={styles.editRow}>
                  <View style={styles.editColumn}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <TouchableOpacity
                      style={[styles.input, styles.dateInput]}
                      activeOpacity={0.8}
                      onPress={openDatePicker}
                    >
                      <Text
                        style={[
                          styles.dateInputText,
                          !draftDate.trim() && styles.dateInputPlaceholder,
                        ]}
                      >
                        {formatDraftDateDisplay(draftDate)}
                      </Text>
                      <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.editColumn}>
                    <Text style={styles.inputLabel}>Type</Text>
                    <View style={styles.pillRow}>
                      {(['WorldCup', 'GrandPrix', 'National', 'Open', 'Other'] as const).map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setDraftType(type)}
                          style={[
                            styles.selectPill,
                            draftType === type && styles.selectPillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectPillText,
                              draftType === type && styles.selectPillTextActive,
                            ]}
                          >
                            {formatCompetitionType(type)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {draftType === 'Other' && (
                      <TextInput
                        value={draftTypeLabel}
                        onChangeText={setDraftTypeLabel}
                        style={[styles.input, styles.inputCompact]}
                        placeholder="Custom label"
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      />
                    )}
                  </View>
                  <View style={styles.editColumn}>
                    <Text style={styles.inputLabel}>Weapon</Text>
                    <View style={styles.pillRow}>
                      {(['foil', 'epee', 'sabre'] as const).map(weapon => (
                        <TouchableOpacity
                          key={weapon}
                          onPress={() => setDraftWeapon(weapon)}
                          style={[
                            styles.selectPill,
                            draftWeapon === weapon && styles.selectPillActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectPillText,
                              draftWeapon === weapon && styles.selectPillTextActive,
                            ]}
                          >
                            {formatWeapon(weapon)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.summaryMeta}>
                  {formatCompetitionType(competition?.type, competition?.type_label)} · {formatDate(competition?.event_date)} · {formatWeapon(competition?.weapon_type)}
                </Text>
              )}
              <View style={styles.summaryStats}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{wins}W - {losses}L</Text>
                  <Text style={styles.summaryStatLabel}>Record</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                  {isEditing ? (
                    <View style={styles.placementRow}>
                      <TextInput
                        value={draftPlacement}
                        onChangeText={setDraftPlacement}
                        style={[styles.input, styles.inputSmall]}
                        placeholder="Place"
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                        keyboardType="number-pad"
                      />
                      <Text style={styles.placementDivider}>/</Text>
                      <TextInput
                        value={draftFieldSize}
                        onChangeText={setDraftFieldSize}
                        style={[styles.input, styles.inputSmall]}
                        placeholder="Field"
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                        keyboardType="number-pad"
                      />
                    </View>
                  ) : (
                    <Text style={styles.summaryStatValue}>
                      {formatPlacement(competition?.placement, competition?.field_size)}
                    </Text>
                  )}
                  <Text style={styles.summaryStatLabel}>Placement</Text>
                </View>
              </View>
              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Competition Breakdown</Text>
                <TouchableOpacity
                  style={styles.addMatchButton}
                  onPress={handleAddMatch}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color="#E9D7FF" />
                  <Text style={styles.addMatchButtonText}>Add Match</Text>
                </TouchableOpacity>
              </View>

              {pouleMatches.length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Poule</Text>
                  {pouleMatches.map(match => renderMatchRow(match, 'Poule'))}
                </View>
              )}

              {deMatchesByRound.length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Direct Elimination</Text>
                  {deMatchesByRound.map(({ round, matches: roundMatches }) => (
                    <View key={round} style={styles.roundGroup}>
                      {roundMatches.map(match => renderMatchRow(match, round))}
                    </View>
                  ))}
                </View>
              )}

              {pouleMatches.length === 0 && deMatchesByRound.length === 0 && (
                <Text style={styles.emptyText}>No matches logged for this competition yet.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Competition Notes</Text>
              <View style={styles.notesBlock}>
                {isEditing ? (
                  <TouchableOpacity
                    style={[styles.input, styles.notesInput, styles.notesInputTrigger]}
                    activeOpacity={0.8}
                    onPress={openNotesModal}
                  >
                    <Text
                      style={[
                        styles.notesInputText,
                        !draftPostNotes.trim() && styles.notesInputPlaceholder,
                      ]}
                      numberOfLines={4}
                    >
                      {draftPostNotes.trim() ? draftPostNotes : 'Add notes...'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.notesText}>
                    {competition?.post_competition_notes?.trim() ||
                      competition?.pre_competition_notes?.trim() ||
                      'No notes yet.'}
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display="calendar"
          onChange={handleDateChange}
        />
      )}

      <Modal
        visible={showNotesModal}
        transparent
        animationType="slide"
        onRequestClose={handleNotesModalCancel}
      >
        <View style={modalStyles.modalOverlay}>
          <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
            <View style={modalStyles.modalContainer}>
                <LinearGradient
                  colors={['#2A2A2A', '#2A2A2A']}
                  style={modalStyles.modalContent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                <View style={modalStyles.modalHeader}>
                  <Text style={modalStyles.modalTitle}>Competition Notes</Text>
                  <View style={modalStyles.modalHeaderActions}>
                    <TouchableOpacity
                      onPress={() => setShowListFormatMenu(prev => !prev)}
                      style={[
                        modalStyles.listFormatButton,
                        activeListFormat && modalStyles.listFormatButtonActive,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="list" size={18} color="white" />
                      <Text style={modalStyles.listFormatButtonText}>
                        {listFormatSuffix ? `List ${listFormatSuffix}` : 'List'}
                      </Text>
                      <Ionicons
                        name={showListFormatMenu ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="white"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNotesModalCancel} style={modalStyles.closeButton}>
                      <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>

                {showListFormatMenu && (
                  <View style={modalStyles.listFormatMenu}>
                    <TouchableOpacity
                      style={[
                        modalStyles.listFormatOption,
                        activeListFormat === 'bullet' && modalStyles.listFormatOptionActive,
                      ]}
                      onPress={() => insertListPrefix('bullet')}
                    >
                      <Text style={modalStyles.listFormatOptionIcon}>•</Text>
                      <Text
                        style={[
                          modalStyles.listFormatOptionText,
                          activeListFormat === 'bullet' && modalStyles.listFormatOptionTextActive,
                        ]}
                      >
                        Bullet
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        modalStyles.listFormatOption,
                        activeListFormat === 'dash' && modalStyles.listFormatOptionActive,
                      ]}
                      onPress={() => insertListPrefix('dash')}
                    >
                      <Text style={modalStyles.listFormatOptionIcon}>-</Text>
                      <Text
                        style={[
                          modalStyles.listFormatOptionText,
                          activeListFormat === 'dash' && modalStyles.listFormatOptionTextActive,
                        ]}
                      >
                        Dash
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        modalStyles.listFormatOption,
                        activeListFormat === 'number' && modalStyles.listFormatOptionActive,
                      ]}
                      onPress={() => insertListPrefix('number')}
                    >
                      <Text style={modalStyles.listFormatOptionIcon}>1.</Text>
                      <Text
                        style={[
                          modalStyles.listFormatOptionText,
                          activeListFormat === 'number' && modalStyles.listFormatOptionTextActive,
                        ]}
                      >
                        Numbered
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={modalStyles.inputContainer}>
                  <TextInput
                    style={modalStyles.textInput}
                    value={tempNotes}
                    onChangeText={handleNotesChange}
                    placeholder="Add notes..."
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    multiline
                    maxLength={500}
                    autoFocus
                  />
                </View>

                <View style={modalStyles.modalFooter}>
                  <Text style={modalStyles.characterCount}>{tempNotes.length}/500</Text>
                  <View style={modalStyles.buttonContainer}>
                    <TouchableOpacity onPress={handleNotesModalCancel} style={modalStyles.cancelButton}>
                      <Text style={modalStyles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNotesModalSave} style={modalStyles.saveButton}>
                      <Text style={modalStyles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={handleDateModalCancel}
        >
          <View style={modalStyles.modalOverlay}>
            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
              <View style={modalStyles.modalContainer}>
                <LinearGradient
                  colors={['#2A2A2A', '#2A2A2A']}
                  style={modalStyles.modalContent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={modalStyles.modalHeader}>
                    <Text style={modalStyles.modalTitle}>Select Date</Text>
                    <TouchableOpacity onPress={handleDateModalCancel} style={modalStyles.closeButton}>
                      <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={datePickerValue}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      themeVariant="dark"
                      style={styles.datePicker}
                    />
                  </View>

                  <View style={modalStyles.modalFooter}>
                    <View />
                    <View style={modalStyles.buttonContainer}>
                      <TouchableOpacity onPress={handleDateModalCancel} style={modalStyles.cancelButton}>
                        <Text style={modalStyles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleDateModalSave} style={modalStyles.saveButton}>
                        <Text style={modalStyles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(23, 23, 24)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerActionPrimary: {
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(200, 166, 255, 0.6)',
  },
  headerActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(153, 128, 255, 0.15)',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: 'white',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputCompact: {
    marginTop: 8,
  },
  inputSmall: {
    width: 70,
    textAlign: 'center',
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  editRow: {
    marginTop: 12,
    gap: 12,
  },
  editColumn: {
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectPillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
    borderColor: 'rgba(200, 166, 255, 0.8)',
  },
  selectPillText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  selectPillTextActive: {
    color: '#E9D7FF',
  },
  placementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placementDivider: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  competitionPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(200, 166, 255, 0.6)',
  },
  competitionPillText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryMeta: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 8,
  },
  summaryStats: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryStatLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    marginTop: 10,
    color: '#FF7675',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  roundGroup: {
    marginTop: 8,
  },
  roundGroupLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  matchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  matchInfo: {
    flex: 1,
  },
  matchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  roundPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(200, 166, 255, 0.7)',
  },
  roundPillText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '600',
  },
  opponentName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  matchMeta: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    marginTop: 4,
  },
  matchRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scoreText: {
    color: 'rgb(179, 241, 229)',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  resultPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultPillText: {
    fontSize: 12,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  notesBlock: {
    marginBottom: 12,
  },
  notesLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  notesText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 80,
  },
  notesInputTrigger: {
    justifyContent: 'center',
  },
  notesInputText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  notesInputPlaceholder: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 166, 255, 0.6)',
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
  },
  addMatchButtonText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '600',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dateInputPlaceholder: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  datePickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  datePicker: {
    width: '100%',
  },
});

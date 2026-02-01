import { RecentMatchCard } from '@/components';
import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { trackOnce } from '@/lib/analyticsTracking';
import { matchService } from '@/lib/database';
import { SimpleMatch } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Match {
  id: string;
  opponentName: string;
  opponentImage: string;
  date: string;
  time?: string; // Time when match was completed
  matchType: 'Competition' | 'Training';
  outcome: 'Victory' | 'Defeat';
  playerScore: number;
  opponentScore: number;
  source?: string; // Source of the match (manual, remote, etc.)
  notes?: string; // Match notes
  competitionId?: string | null;
  competitionName?: string | null;
  competitionDate?: string | null;
  competitionWeaponType?: string | null;
  competitionPhase?: 'POULE' | 'DE' | null;
  competitionRound?: 'L256' | 'L128' | 'L64' | 'L32' | 'L16' | 'QF' | 'SF' | 'F' | null;
}

const getInitials = (name: string | undefined): string => {
  if (!name || name.trim() === '') {
    return '?';
  }
  const trimmedName = name.trim();
  const words = trimmedName.split(' ').filter(word => word.length > 0);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase();
};

export default function RecentMatchesScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [matches, setMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]); // Store all matches for filtering
  const [loading, setLoading] = useState(true);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [selectedType, setSelectedType] = useState<'All' | 'Competition' | 'Training'>('All');
  const [showWinLossDropdown, setShowWinLossDropdown] = useState(false);
  const [selectedWinLoss, setSelectedWinLoss] = useState<'All' | 'Win' | 'Loss'>('All');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<'All Time' | 'Today' | 'This Week' | 'This Month' | 'Last 3 Months'>('All Time');
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [expandedCompetitions, setExpandedCompetitions] = useState<Record<string, boolean>>({});
  const [expandedCompetitionSections, setExpandedCompetitionSections] = useState<
    Record<string, { poule: boolean; de: boolean }>
  >({});
  const hasTrackedFilterRef = useRef(false);

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper function to check if a date is within the selected range
  const isDateInRange = (dateString: string, range: string): boolean => {
    if (range === 'All Time') return true;
    
    // Validate the date string first
    if (!dateString || dateString.trim() === '') {
      console.log(`⚠️ Invalid date string: "${dateString}"`);
      return false;
    }
    
    // Parse DD/MM/YYYY format dates
    let matchDate: Date;
    
    // Check if date is in DD/MM/YYYY format
    if (dateString.includes('/') && dateString.split('/').length === 3) {
      const parts = dateString.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
      const year = parseInt(parts[2], 10);
      
      matchDate = new Date(year, month, day);
    } else {
      // Try parsing as ISO string or other format
      matchDate = new Date(dateString);
    }
    
    // Check if the date is valid
    if (isNaN(matchDate.getTime())) {
      console.log(`⚠️ Invalid date created from: "${dateString}"`);
      return false;
    }
    
    const now = new Date();
    
    // Reset time to start of day for accurate date comparisons
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
    
    let result = false;
    
    switch (range) {
      case 'Today':
        result = matchDay.getTime() === today.getTime();
        break;
      case 'This Week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
        result = matchDay >= startOfWeek && matchDay <= today;
        break;
      case 'This Month':
        result = matchDate.getMonth() === now.getMonth() && matchDate.getFullYear() === now.getFullYear();
        break;
      case 'Last 3 Months':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        result = matchDate >= threeMonthsAgo && matchDate <= now;
        break;
      default:
        result = true;
    }
    
    return result;
  };

  // Convert SimpleMatch to Match format for the card
  const toDisplayMatchType = (rawType?: string): 'Competition' | 'Training' => {
    if (!rawType) return 'Competition';
    const normalized = rawType.toLowerCase();
    if (normalized === 'training' || normalized === 'practice' || normalized === 'sparring') {
      return 'Training';
    }
    return 'Competition';
  };

  const convertToMatch = (simpleMatch: SimpleMatch): Match => ({
    id: simpleMatch.id,
    opponentName: simpleMatch.opponentName,
    opponentImage: '', // No default image - will use initials fallback
    date: formatDate(simpleMatch.date),
    time: simpleMatch.time, // Pass through the completion time
    matchType: toDisplayMatchType(simpleMatch.matchType),
    outcome: simpleMatch.isWin ? 'Victory' : 'Defeat',
    playerScore: simpleMatch.youScore,
    opponentScore: simpleMatch.opponentScore,
    source: simpleMatch.source ?? 'unknown',
    notes: simpleMatch.notes ?? '',
    competitionId: simpleMatch.competitionId ?? null,
    competitionName: simpleMatch.competitionName ?? null,
    competitionDate: simpleMatch.competitionDate
      ? formatDate(simpleMatch.competitionDate)
      : null,
    competitionWeaponType: simpleMatch.competitionWeaponType ?? null,
    competitionPhase: simpleMatch.competitionPhase ?? null,
    competitionRound: simpleMatch.competitionRound ?? null,
  });

  type CompetitionGroup = {
    id: string;
    name: string;
    date: string;
    weapon: string;
    wins: number;
    losses: number;
    pouleWins: number;
    pouleLosses: number;
    pouleMatches: Match[];
    deMatches: Match[];
  };

  type DateGroup = {
    key: string;
    label: string;
    competitionGroups: CompetitionGroup[];
    ungroupedMatches: Match[];
  };

  // --- Grouping helpers ---
  const parseMatchDate = (dateString: string): Date | null => {
    if (!dateString || dateString.trim() === '') return null;

    // DD/MM/YYYY support
    if (dateString.includes('/') && dateString.split('/').length === 3) {
      const [dayStr, monthStr, yearStr] = dateString.split('/');
      const day = parseInt(dayStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const year = parseInt(yearStr, 10);
      const parsed = new Date(year, month, day);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const getDateKey = (date: Date | null): string => {
    if (!date) return 'unknown';
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const formatHeaderLabel = (dateKey: string): string => {
    if (dateKey === 'unknown') return 'Unknown Date';
    const date = new Date(`${dateKey}T00:00:00`);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(date, today)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';

    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    };
    if (date.getFullYear() !== today.getFullYear()) {
      opts.year = 'numeric';
    }
    return date.toLocaleDateString(undefined, opts);
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

  const getMatchTimestamp = (match: Match): number => {
    const dateString = match.competitionDate || match.date;
    const date = parseMatchDate(dateString);
    if (!date) return 0;

    if (match.time && match.time.includes(':')) {
      const [hourStr, minuteStr] = match.time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);
      if (!isNaN(hour) && !isNaN(minute)) {
        date.setHours(hour, minute, 0, 0);
      }
    }

    return date.getTime();
  };

  const normalizeQuery = (value: string) => value.trim().toLowerCase();

  const buildHighlightChunks = (text: string, query: string) => {
    if (!query) return [{ text, highlight: false }];
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const chunks: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > lastIndex) {
        chunks.push({ text: text.slice(lastIndex, start), highlight: false });
      }
      chunks.push({ text: text.slice(start, end), highlight: true });
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      chunks.push({ text: text.slice(lastIndex), highlight: false });
    }
    return chunks;
  };

  const getNotesSnippet = (match: Match, query: string) => {
    const noteText = (match.notes || '').trim();
    if (!noteText || !query) return null;
    const lowerNote = noteText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerNote.indexOf(lowerQuery);
    if (idx === -1) return null;
    const windowRadius = 80;
    const start = Math.max(0, idx - windowRadius);
    const end = Math.min(noteText.length, idx + lowerQuery.length + windowRadius);
    let snippet = noteText.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = `…${snippet}`;
    if (end < noteText.length) snippet = `${snippet}…`;
    return buildHighlightChunks(snippet, query);
  };

  // Filter matches based on search query, selected type, win/loss, and date range
  const filterMatches = () => {
    let filtered = allMatches;

    // Filter by search query (opponent name + notes)
    const query = normalizeQuery(searchQuery);
    if (query !== '') {
      filtered = filtered.filter(match => {
        const opponentMatch = match.opponentName.toLowerCase().includes(query);
        const notesMatch = (match.notes || '').toLowerCase().includes(query);
        return opponentMatch || notesMatch;
      });
    }

    // Filter by type
    if (selectedType !== 'All') {
      filtered = filtered.filter(match => match.matchType === selectedType);
    }

    // Filter by win/loss
    if (selectedWinLoss !== 'All') {
      const outcomeMap = { 'Win': 'Victory', 'Loss': 'Defeat' };
      filtered = filtered.filter(match => match.outcome === outcomeMap[selectedWinLoss]);
    }

    // Filter by date range
    if (selectedDateRange !== 'All Time') {
      filtered = filtered.filter(match => isDateInRange(match.date, selectedDateRange));
    }

    setMatches(filtered);
  };

  const groupedMatches: DateGroup[] = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    const sorted = [...matches].sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a));

    const dateGroups: { key: string; label: string; items: Match[] }[] = [];
    sorted.forEach((match) => {
      const groupDate = match.competitionDate || match.date;
      const dateKey = getDateKey(parseMatchDate(groupDate));
      const label = formatHeaderLabel(dateKey);
      const existing = dateGroups.find((g) => g.key === dateKey);
      if (existing) {
        existing.items.push(match);
      } else {
        dateGroups.push({ key: dateKey, label, items: [match] });
      }
    });

    return dateGroups.map((group) => {
      const competitionMap = new Map<string, CompetitionGroup>();
      const ungroupedMatches: Match[] = [];

      group.items.forEach((match) => {
        if (match.matchType === 'Competition' && match.competitionId) {
          const existing = competitionMap.get(match.competitionId);
          if (existing) {
            const isDE = match.competitionPhase === 'DE' || !!match.competitionRound;
            if (isDE) {
              existing.deMatches.push(match);
            } else {
              existing.pouleMatches.push(match);
            }
            return;
          }

          const name = match.competitionName || 'Competition';
          const date = match.competitionDate || match.date;
          const weapon = match.competitionWeaponType ? match.competitionWeaponType.toUpperCase() : '';

          const isDE = match.competitionPhase === 'DE' || !!match.competitionRound;
          competitionMap.set(match.competitionId, {
            id: match.competitionId,
            name,
            date,
            weapon,
            wins: 0,
            losses: 0,
            pouleMatches: isDE ? [] : [match],
            deMatches: isDE ? [match] : [],
          });
        } else {
          ungroupedMatches.push(match);
        }
      });

      const competitionGroups = Array.from(competitionMap.values()).map((group) => {
        const allMatches = [...group.pouleMatches, ...group.deMatches];

        const wins = allMatches.filter((m) => m.outcome === 'Victory').length;
        const losses = allMatches.filter((m) => m.outcome === 'Defeat').length;

        const pouleMatches = allMatches
          .filter((m) => m.competitionPhase === 'POULE' || (!m.competitionPhase && !m.competitionRound))
          .sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a));

        const deMatches = allMatches
          .filter((m) => m.competitionPhase === 'DE' || m.competitionRound)
          .sort((a, b) => {
            const rankA = roundOrder[a.competitionRound || ''] ?? 999;
            const rankB = roundOrder[b.competitionRound || ''] ?? 999;
            if (rankA !== rankB) return rankA - rankB;
            return getMatchTimestamp(b) - getMatchTimestamp(a);
          });

        const pouleWins = pouleMatches.filter((m) => m.outcome === 'Victory').length;
        const pouleLosses = pouleMatches.filter((m) => m.outcome === 'Defeat').length;

        return {
          ...group,
          wins,
          losses,
          pouleWins,
          pouleLosses,
          pouleMatches,
          deMatches,
        };
      });

      return {
        key: group.key,
        label: group.label,
        competitionGroups,
        ungroupedMatches,
      };
    });
  }, [matches]);

  useEffect(() => {
    if (Object.keys(expandedCompetitions).length > 0) {
      return;
    }
    const firstGroup = groupedMatches.find(group => group.competitionGroups.length > 0);
    const firstCompetition = firstGroup?.competitionGroups[0];
    if (firstCompetition) {
      setExpandedCompetitions({ [firstCompetition.id]: true });
    }
  }, [groupedMatches, expandedCompetitions]);

  // Fetch matches data
  const fetchMatches = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('🔄 Fetching matches for match history...');
      const simpleMatches = await matchService.getRecentMatches(
        user.id,
        50,
        undefined,
        session?.access_token
      ); // Get more matches for history page
      const convertedMatches = simpleMatches.map(convertToMatch);
      console.log(`📊 Fetched ${convertedMatches.length} matches for history`);
      setAllMatches(convertedMatches);
      setMatches(convertedMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch matches when component mounts
  useEffect(() => {
    fetchMatches();
  }, [user]);

  // Refresh matches when screen comes into focus (e.g., when returning from add-match)
  useFocusEffect(
    useCallback(() => {
      analytics.screen('MatchHistory');
      void trackOnce('first_match_history_viewed', undefined, user?.id);
      if (user) {
        console.log('🎯 Match history screen focused - refreshing matches...');
        fetchMatches();
      }
    }, [user])
  );

  // Handle match deletion
  const handleDeleteMatch = async (matchId: string) => {
    if (!user) return;
    
    try {
      setDeletingMatchId(matchId);
      const success = await matchService.deleteMatch(matchId, undefined, session?.access_token);
      
      if (success) {
        // Track match deletion
        analytics.matchDeleted({ match_id: matchId });
        
        // Remove the match from local state
        setAllMatches(prev => prev.filter(match => match.id !== matchId));
        setMatches(prev => prev.filter(match => match.id !== matchId));
        
        // Show success message
        Alert.alert('Success', 'Match deleted successfully');
      } else {
        Alert.alert('Error', 'Failed to delete match. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting match:', error);
      Alert.alert('Error', 'Failed to delete match. Please try again.');
    } finally {
      setDeletingMatchId(null);
    }
  };

  // Filter matches when selections or search query change
  useEffect(() => {
    filterMatches();
    if (!hasTrackedFilterRef.current) {
      hasTrackedFilterRef.current = true;
      return;
    }

    const opponentQuery = searchQuery.trim();
    const hasActiveFilters =
      selectedType !== 'All' ||
      selectedWinLoss !== 'All' ||
      selectedDateRange !== 'All Time' ||
      opponentQuery.length > 0;

    if (hasActiveFilters) {
      analytics.capture('match_history_filtered', {
        match_type: selectedType !== 'All' ? selectedType : undefined,
        win_loss: selectedWinLoss !== 'All' ? selectedWinLoss : undefined,
        date_range: selectedDateRange !== 'All Time' ? selectedDateRange : undefined,
        opponent_query: opponentQuery.length > 0 ? opponentQuery : undefined,
      });
    }
  }, [selectedType, selectedWinLoss, selectedDateRange, searchQuery, allMatches]);

  const filters = ['All', 'Type', 'Win/Loss', 'Date'];

  const toggleCompetitionExpanded = (competitionId: string) => {
    setExpandedCompetitions(prev => {
      const nextExpanded = !prev[competitionId];
      if (nextExpanded) {
        analytics.capture('competition_group_expanded', {
          competition_id: competitionId,
          source: 'match_history',
        });
      }
      return {
        ...prev,
        [competitionId]: nextExpanded,
      };
    });
  };

  const handleCompetitionPress = (competitionId: string) => {
    router.push({
      pathname: '/competition-detail',
      params: { competitionId },
    });
  };

  const toggleCompetitionSection = (
    competitionId: string,
    section: 'poule' | 'de',
    defaults: { poule: boolean; de: boolean }
  ) => {
    setExpandedCompetitionSections(prev => {
      const current = prev[competitionId] ?? defaults;
      const nextExpanded = !current[section];
      if (nextExpanded) {
        analytics.capture('competition_group_section_expanded', {
          competition_id: competitionId,
          section,
          source: 'match_history',
        });
      }
      return {
        ...prev,
        [competitionId]: {
          ...current,
          [section]: !current[section],
        },
      };
    });
  };

  const handleMatchPress = (match: Match) => {
    analytics.matchSelected({ match_id: match.id });
    const isManualMatch = match.source === 'manual';
    if (isManualMatch) {
      router.push({
        pathname: '/manual-match-summary',
        params: {
          matchId: match.id,
          yourScore: match.playerScore.toString(),
          opponentScore: match.opponentScore.toString(),
          opponentName: match.opponentName,
          matchType: match.matchType,
          date: match.date,
          time: match.time || '12:00PM',
          isWin: (match.outcome === 'Victory').toString(),
          notes: match.notes || '',
        },
      });
    } else {
      router.push({
        pathname: '/match-history-details',
        params: {
          matchId: match.id,
          opponentName: match.opponentName,
          opponentImage: match.opponentImage,
          youScore: match.playerScore.toString(),
          opponentScore: match.opponentScore.toString(),
          matchType: match.matchType,
          date: match.date,
          duration: '02:30',
          location: 'Metro Field House',
          isWin: (match.outcome === 'Victory').toString(),
        },
      });
    }
  };

  const renderCompetitionMatchRow = (match: Match, showRound: boolean) => {
    const initials = getInitials(match.opponentName);
    const scoreText = `${match.playerScore} - ${match.opponentScore}`;
    const query = normalizeQuery(searchQuery);
    const notesSnippet = getNotesSnippet(match, query);
    return (
      <TouchableOpacity
        key={match.id}
        style={styles.competitionMatchRow}
        onPress={() => !editMode && handleMatchPress(match)}
        activeOpacity={0.8}
      >
        <View style={styles.competitionMatchLeft}>
          <View style={styles.competitionAvatar}>
            <Text style={styles.competitionAvatarText}>{initials}</Text>
          </View>
          <View style={styles.competitionMatchInfo}>
            <View style={styles.competitionNameRow}>
              {showRound && match.competitionRound && (
                <View style={styles.roundPill}>
                  <Text style={styles.roundPillText}>{match.competitionRound}</Text>
                </View>
              )}
              <Text style={styles.competitionOpponentName}>{match.opponentName}</Text>
            </View>
            <Text style={styles.competitionMatchMeta}>
              {match.date}{match.time ? ` · ${match.time}` : ''}
            </Text>
            {notesSnippet && (
              <Text style={styles.matchNotesSnippet} numberOfLines={2}>
                {notesSnippet.map((chunk, index) => (
                  <Text
                    key={`${match.id}-note-${index}`}
                    style={chunk.highlight ? styles.matchNotesHighlight : styles.matchNotesText}
                  >
                    {chunk.text}
                  </Text>
                ))}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.competitionMatchRight}>
          {editMode ? (
            <TouchableOpacity
              onPress={() => handleDeleteMatch(match.id)}
              style={styles.competitionDelete}
            >
              <Ionicons name="trash-outline" size={18} color="#FF7675" />
            </TouchableOpacity>
          ) : match.outcome === 'Defeat' ? (
            <View style={styles.lossPill}>
              <Ionicons name="close" size={12} color="#FFD6D6" />
              <Text style={styles.lossPillText}>Loss</Text>
            </View>
          ) : (
            <View style={styles.scoreRow}>
              <View style={styles.scoreDot} />
              <Text style={styles.scoreText}>{scoreText}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'rgb(23, 23, 24)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.02,
      paddingBottom: height * 0.03,
    },
    backButton: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: 'rgb(52,52,52)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: width * 0.06,
      fontWeight: '700',
      color: 'white',
      flex: 1,
      textAlign: 'center',
    },
    menuButton: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: '#2A2A2A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchContainer: {
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.02,
    },
    searchInput: {
      backgroundColor: 'rgb(42,42,42)',
      borderRadius: width * 0.025,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      flexDirection: 'row',
      alignItems: 'center',
    },
    searchIcon: {
      marginRight: width * 0.02,
    },
    searchText: {
      flex: 1,
      color: 'white',
      fontSize: width * 0.035,
    },
    searchPlaceholder: {
      color: Colors.gray.light,
      fontSize: width * 0.035,
    },
    clearButton: {
      marginLeft: width * 0.02,
      padding: width * 0.01,
    },
    filtersContainer: {
      flexDirection: 'row',
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.03,
      gap: width * 0.02,
    },
    filterOption: {
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.01,
      borderRadius: width * 0.02,
      backgroundColor: Colors.gray.light,
    },
    filterOptionActive: {
      backgroundColor: 'transparent',
    },
    filterOptionText: {
      color: Colors.gray.light,
      fontSize: width * 0.03,
      fontWeight: '500',
    },
    filterOptionTextActive: {
      color: 'white',
      fontSize: width * 0.03,
      fontWeight: '600',
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
      marginTop: height * 0.002,
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
      paddingVertical: height * 0.015,
      paddingHorizontal: width * 0.04,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    dropdownOptionText: {
      fontSize: width * 0.03,
      color: 'white',
      fontWeight: '500',
    },
    dropdownContainer: {
      backgroundColor: Colors.gray.dark,
      borderRadius: width * 0.02,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      marginHorizontal: width * 0.04,
      marginBottom: height * 0.02,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    dropdownOptionTextActive: {
      fontSize: width * 0.03,
      color: Colors.purple.primary,
      fontWeight: '600',
    },
    matchesList: {
      paddingHorizontal: width * 0.04,
    },
    groupContainer: {
      marginBottom: height * 0.03,
    },
    groupHeader: {
      fontSize: width * 0.04,
      fontWeight: '700',
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: height * 0.012,
      letterSpacing: 0.5,
    },
    competitionCard: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      marginBottom: height * 0.02,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    competitionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.02,
      backgroundColor: 'rgba(45, 45, 48, 0.9)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    competitionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: width * 0.02,
    },
    competitionIcon: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.03,
    },
    competitionIconText: {
      fontSize: width * 0.055,
    },
    competitionTitle: {
      fontSize: width * 0.04,
      fontWeight: '700',
      color: 'white',
    },
    competitionSubtitle: {
      fontSize: width * 0.032,
      color: 'rgba(255, 255, 255, 0.6)',
      marginTop: height * 0.002,
    },
    competitionHeaderRight: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    competitionRecord: {
      fontSize: width * 0.035,
      color: 'rgba(255, 255, 255, 0.8)',
      fontWeight: '600',
      marginBottom: height * 0.004,
    },
    competitionChevron: {
      marginTop: height * 0.002,
    },
    competitionBody: {
      paddingHorizontal: width * 0.04,
      paddingBottom: height * 0.015,
    },
    competitionSection: {
      marginTop: height * 0.012,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.008,
    },
    sectionHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.02,
    },
    sectionRecordChip: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: width * 0.04,
      paddingHorizontal: width * 0.03,
      paddingVertical: height * 0.004,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    sectionRecordText: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: width * 0.03,
      fontWeight: '600',
    },
    competitionSectionLabel: {
      fontSize: width * 0.034,
      color: 'rgba(255, 255, 255, 0.7)',
      fontWeight: '600',
      marginBottom: height * 0.008,
    },
    competitionMatchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: height * 0.012,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    },
    competitionMatchLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: width * 0.02,
    },
    competitionAvatar: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: '#3A3A3A',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.03,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    competitionAvatarText: {
      color: 'white',
      fontSize: width * 0.038,
      fontWeight: '600',
    },
    competitionMatchInfo: {
      flex: 1,
    },
    competitionNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    roundPill: {
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.004,
      borderWidth: 1,
      borderColor: 'rgba(200, 166, 255, 0.7)',
      marginRight: width * 0.015,
    },
    roundPillText: {
      fontSize: width * 0.03,
      color: '#E9D7FF',
      fontWeight: '600',
    },
    competitionOpponentName: {
      fontSize: width * 0.038,
      color: 'white',
      fontWeight: '600',
    },
    competitionMatchMeta: {
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.55)',
      marginTop: height * 0.002,
    },
    matchNotesSnippet: {
      marginTop: height * 0.006,
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.65)',
      lineHeight: height * 0.022,
    },
    matchNotesText: {
      color: 'rgba(255, 255, 255, 0.65)',
    },
    matchNotesHighlight: {
      color: '#C9A3FF',
      fontWeight: '700',
    },
    competitionMatchRight: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    lossPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 107, 107, 0.2)',
      borderRadius: width * 0.04,
      paddingHorizontal: width * 0.025,
      paddingVertical: height * 0.006,
      borderWidth: 1,
      borderColor: 'rgba(255, 107, 107, 0.6)',
    },
    lossPillText: {
      marginLeft: width * 0.01,
      color: '#FFD6D6',
      fontSize: width * 0.032,
      fontWeight: '600',
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scoreText: {
      color: 'rgb(179, 241, 229)',
      fontSize: width * 0.04,
      fontWeight: '700',
    },
    scoreDot: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
      backgroundColor: 'rgb(179, 241, 229)',
      marginRight: width * 0.01,
    },
    competitionDelete: {
      padding: width * 0.01,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: height * 0.1,
    },
    loadingText: {
      color: 'white',
      fontSize: width * 0.04,
      textAlign: 'center',
    },
    filterButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.03,
      gap: width * 0.02,
    },
    filterButton: {
      width: width * 0.2, // Adjust width for buttons
      height: width * 0.08, // Adjust height for buttons
      borderRadius: width * 0.04, // Adjust border radius for buttons
      backgroundColor: 'rgb(52,52,52)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterButtonActive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'transparent',
      shadowColor: '#6C5CE70A',
      shadowOffset: {
        width: 0,
        height: 0,
      },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 30,
    },
    filterButtonText: {
      color: 'white',
      fontSize: width * 0.03,
      fontWeight: '500',
    },
    filterButtonTextActive: {
      color: 'white',
      fontSize: width * 0.03,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={[styles.container, { 
      paddingTop: insets.top, 
      paddingBottom: insets.bottom 
    }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Match History</Text>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setEditMode(!editMode)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name={editMode ? "close" : "trash-outline"} 
            size={22} 
            color={editMode ? Colors.purple.primary : "#FF7675"} 
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={width * 0.05} color="white" style={styles.searchIcon} />
          <TextInput
            style={styles.searchText}
            placeholder="Search by opponent name..."
            placeholderTextColor={Colors.gray.light}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={width * 0.05} color={Colors.gray.light} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterButtonsContainer}>
        <TouchableOpacity 
          style={[
            styles.filterButton,
            activeFilter === 'All' && styles.filterButtonActive
          ]}
          onPress={() => setActiveFilter('All')}
        >
          {activeFilter === 'All' ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>All</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.filterButtonText}>All</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.filterButton,
            (activeFilter === 'Type' || selectedType !== 'All') && styles.filterButtonActive
          ]}
          onPress={() => {
            setActiveFilter('Type');
            setShowTypeDropdown(!showTypeDropdown);
            setShowWinLossDropdown(false); // Close win/loss dropdown if open
            setShowDateDropdown(false); // Close date dropdown if open
          }}
        >
          {(activeFilter === 'Type' || selectedType !== 'All') ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>{selectedType}</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.filterButtonText}>Type</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.filterButton,
            (activeFilter === 'Win/Loss' || selectedWinLoss !== 'All') && styles.filterButtonActive
          ]}
          onPress={() => {
            setActiveFilter('Win/Loss');
            setShowWinLossDropdown(!showWinLossDropdown);
            setShowTypeDropdown(false); // Close type dropdown if open
            setShowDateDropdown(false); // Close date dropdown if open
          }}
        >
          {(activeFilter === 'Win/Loss' || selectedWinLoss !== 'All') ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>{selectedWinLoss}</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.filterButtonText}>Win/Loss</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.filterButton,
            (activeFilter === 'Date' || selectedDateRange !== 'All Time') && styles.filterButtonActive
          ]}
          onPress={() => {
            setActiveFilter('Date');
            setShowDateDropdown(!showDateDropdown);
            setShowTypeDropdown(false);
            setShowWinLossDropdown(false);
          }}
        >
          {(activeFilter === 'Date' || selectedDateRange !== 'All Time') ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>
                {selectedDateRange === 'All Time' ? 'Date' : 
                 selectedDateRange === 'Last 3 Months' ? '3 Months' : selectedDateRange}
              </Text>
            </LinearGradient>
          ) : (
            <Text style={styles.filterButtonText}>Date</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Type Dropdown */}
      {showTypeDropdown && (
        <View style={styles.dropdownContainer}>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedType('All');
              setShowTypeDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedType === 'All' && styles.dropdownOptionTextActive
            ]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedType('Competition');
              setShowTypeDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedType === 'Competition' && styles.dropdownOptionTextActive
            ]}>Competition</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedType('Training');
              setShowTypeDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedType === 'Training' && styles.dropdownOptionTextActive
            ]}>Training</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Win/Loss Dropdown */}
      {showWinLossDropdown && (
        <View style={styles.dropdownContainer}>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedWinLoss('All');
              setShowWinLossDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedWinLoss === 'All' && styles.dropdownOptionTextActive
            ]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedWinLoss('Win');
              setShowWinLossDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedWinLoss === 'Win' && styles.dropdownOptionTextActive
            ]}>Win</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedWinLoss('Loss');
              setShowWinLossDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedWinLoss === 'Loss' && styles.dropdownOptionTextActive
            ]}>Loss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Date Dropdown */}
      {showDateDropdown && (
        <View style={styles.dropdownContainer}>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedDateRange('All Time');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === 'All Time' && styles.dropdownOptionTextActive
            ]}>All Time</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedDateRange('Today');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === 'Today' && styles.dropdownOptionTextActive
            ]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedDateRange('This Week');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === 'This Week' && styles.dropdownOptionTextActive
            ]}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedDateRange('This Month');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === 'This Month' && styles.dropdownOptionTextActive
            ]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedDateRange('Last 3 Months');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === 'Last 3 Months' && styles.dropdownOptionTextActive
            ]}>Last 3 Months</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Matches List */}
      <ScrollView style={styles.matchesList} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading matches...</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No matches found</Text>
          </View>
        ) : (
          groupedMatches.map((group) => (
            <View key={group.key} style={styles.groupContainer}>
              <Text style={styles.groupHeader}>{group.label.toUpperCase()}</Text>
              {group.competitionGroups.map((competition) => {
                const expanded = !!expandedCompetitions[competition.id];
                const subtitle = `${competition.date}${competition.weapon ? ` · ${competition.weapon}` : ''}`;
                const sectionDefaults = {
                  poule: competition.pouleMatches.length > 0,
                  de: competition.deMatches.length > 0,
                };
                const pouleExpanded =
                  expandedCompetitionSections[competition.id]?.poule ?? sectionDefaults.poule;
                const deExpanded =
                  expandedCompetitionSections[competition.id]?.de ?? sectionDefaults.de;
                return (
                  <View key={competition.id} style={styles.competitionCard}>
                    <View style={styles.competitionHeaderRow}>
                      <TouchableOpacity
                        style={styles.competitionHeaderLeft}
                        onPress={() => handleCompetitionPress(competition.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.competitionIcon}>
                          <Text style={styles.competitionIconText}>🏆</Text>
                        </View>
                        <View>
                          <Text style={styles.competitionTitle}>{competition.name}</Text>
                          <Text style={styles.competitionSubtitle}>{subtitle}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.competitionHeaderRight}
                        onPress={() => toggleCompetitionExpanded(competition.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.competitionRecord}>
                          {competition.wins}W - {competition.losses}L
                        </Text>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="rgba(255,255,255,0.7)"
                          style={styles.competitionChevron}
                        />
                      </TouchableOpacity>
                    </View>
                    {expanded && (
                      <View style={styles.competitionBody}>
                        {competition.pouleMatches.length > 0 && (
                          <View style={styles.competitionSection}>
                            <TouchableOpacity
                              style={styles.sectionHeaderRow}
                              onPress={() =>
                                toggleCompetitionSection(competition.id, 'poule', sectionDefaults)
                              }
                              activeOpacity={0.8}
                            >
                              <Text style={styles.competitionSectionLabel}>Poule</Text>
                              <View style={styles.sectionHeaderRight}>
                                <View style={styles.sectionRecordChip}>
                                  <Text style={styles.sectionRecordText}>
                                    {competition.pouleWins}W - {competition.pouleLosses}L
                                  </Text>
                                </View>
                                <Ionicons
                                  name={pouleExpanded ? 'chevron-up' : 'chevron-down'}
                                  size={16}
                                  color="rgba(255,255,255,0.6)"
                                />
                              </View>
                            </TouchableOpacity>
                            {pouleExpanded &&
                              competition.pouleMatches.map((match) =>
                                renderCompetitionMatchRow(match, false)
                              )}
                          </View>
                        )}
                        {competition.deMatches.length > 0 && (
                          <View style={styles.competitionSection}>
                            <TouchableOpacity
                              style={styles.sectionHeaderRow}
                              onPress={() =>
                                toggleCompetitionSection(competition.id, 'de', sectionDefaults)
                              }
                              activeOpacity={0.8}
                            >
                              <Text style={styles.competitionSectionLabel}>Direct Elimination</Text>
                              <Ionicons
                                name={deExpanded ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color="rgba(255,255,255,0.6)"
                              />
                            </TouchableOpacity>
                            {deExpanded &&
                              competition.deMatches.map((match) =>
                                renderCompetitionMatchRow(match, true)
                              )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
              {group.ungroupedMatches.map((match) => (
                <RecentMatchCard
                  key={match.id}
                  match={match}
                  notesSnippet={getNotesSnippet(match, normalizeQuery(searchQuery))}
                  onDelete={handleDeleteMatch}
                  editMode={editMode}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

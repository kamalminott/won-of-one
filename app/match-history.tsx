import { RecentMatchCard, SwipeToDeleteCard } from '@/components';
import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { matchService } from '@/lib/database';
import { SimpleMatch } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
}

export default function RecentMatchesScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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
  const [selectedDateRange, setSelectedDateRange] = useState<'All' | 'Today' | 'This Week' | 'This Month' | '3 Months' | 'This Year'>('All');
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);

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
    if (range === 'All') return true;
    
    const matchDate = new Date(dateString);
    const now = new Date();
    
    // Reset time to start of day for accurate date comparisons
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matchDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
    
    switch (range) {
      case 'Today':
        return matchDay.getTime() === today.getTime();
      case 'This Week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
        return matchDay >= startOfWeek && matchDay <= today;
      case 'This Month':
        return matchDate.getMonth() === now.getMonth() && matchDate.getFullYear() === now.getFullYear();
      case '3 Months':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return matchDate >= threeMonthsAgo && matchDate <= now;
      case 'This Year':
        return matchDate.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  };

  // Convert SimpleMatch to Match format for the card
  const convertToMatch = (simpleMatch: SimpleMatch): Match => ({
    id: simpleMatch.id,
    opponentName: simpleMatch.opponentName,
    opponentImage: '', // No default image - will use initials fallback
    date: formatDate(simpleMatch.date),
    time: simpleMatch.time, // Pass through the completion time
    matchType: 'Competition', // Default to Competition, could be made dynamic
    outcome: simpleMatch.isWin ? 'Victory' : 'Defeat',
    playerScore: simpleMatch.youScore,
    opponentScore: simpleMatch.opponentScore,
  });

  // Filter matches based on search query, selected type, win/loss, and date range
  const filterMatches = () => {
    let filtered = allMatches;

    // Filter by search query (opponent name)
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(match => 
        match.opponentName.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
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
    if (selectedDateRange !== 'All') {
      filtered = filtered.filter(match => isDateInRange(match.date, selectedDateRange));
    }

    setMatches(filtered);
  };

  // Fetch matches data
  useEffect(() => {
    const fetchMatches = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const simpleMatches = await matchService.getRecentMatches(user.id, 50); // Get more matches for history page
        const convertedMatches = simpleMatches.map(convertToMatch);
        setAllMatches(convertedMatches);
        setMatches(convertedMatches);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user]);

  // Handle match deletion
  const handleDeleteMatch = async (matchId: string) => {
    if (!user) return;
    
    try {
      setDeletingMatchId(matchId);
      const success = await matchService.deleteMatch(matchId);
      
      if (success) {
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
  }, [selectedType, selectedWinLoss, selectedDateRange, searchQuery, allMatches]);

  const filters = ['All', 'Type', 'Win/Loss', 'Date'];

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
    headerFilterButton: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: 'rgb(52,52,52)',
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
        <TouchableOpacity style={styles.headerFilterButton}>
          <Ionicons name="filter" size={width * 0.06} color="white" />
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
            (activeFilter === 'Date' || selectedDateRange !== 'All') && styles.filterButtonActive
          ]}
          onPress={() => {
            setActiveFilter('Date');
            setShowDateDropdown(!showDateDropdown);
            setShowTypeDropdown(false);
            setShowWinLossDropdown(false);
          }}
        >
          {(activeFilter === 'Date' || selectedDateRange !== 'All') ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>
                {selectedDateRange === 'All' ? 'Date' : selectedDateRange}
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
              setSelectedDateRange('All');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === 'All' && styles.dropdownOptionTextActive
            ]}>All</Text>
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
              setSelectedDateRange('3 Months');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === '3 Months' && styles.dropdownOptionTextActive
            ]}>3 Months</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dropdownOption}
            onPress={() => {
              setSelectedDateRange('This Year');
              setShowDateDropdown(false);
              setActiveFilter('All');
            }}
          >
            <Text style={[
              styles.dropdownOptionText,
              selectedDateRange === 'This Year' && styles.dropdownOptionTextActive
            ]}>This Year</Text>
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
          matches.map((match) => (
            <SwipeToDeleteCard
              key={match.id}
              matchId={match.id}
              onDelete={() => handleDeleteMatch(match.id)}
              disabled={deletingMatchId === match.id}
            >
              <RecentMatchCard match={match} />
            </SwipeToDeleteCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

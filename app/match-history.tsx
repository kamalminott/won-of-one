import { RecentMatchCard } from '@/components';
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

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Convert SimpleMatch to Match format for the card
  const convertToMatch = (simpleMatch: SimpleMatch): Match => ({
    id: simpleMatch.id,
    opponentName: simpleMatch.opponentName,
    opponentImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', // Default image
    date: formatDate(simpleMatch.date),
    matchType: 'Competition', // Default to Competition, could be made dynamic
    outcome: simpleMatch.isWin ? 'Victory' : 'Defeat',
    playerScore: simpleMatch.youScore,
    opponentScore: simpleMatch.opponentScore,
  });

  // Filter matches based on search query, selected type and win/loss
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

  // Filter matches when selections or search query change
  useEffect(() => {
    filterMatches();
  }, [selectedType, selectedWinLoss, searchQuery, allMatches]);

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
            activeFilter === 'Date' && styles.filterButtonActive
          ]}
          onPress={() => setActiveFilter('Date')}
        >
          {activeFilter === 'Date' ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>Date</Text>
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
            <RecentMatchCard key={match.id} match={match} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

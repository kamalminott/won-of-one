import { RecentMatchCard } from '@/components';
import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Sample data - in a real app this would come from a database
  const matches: Match[] = [
    {
      id: '1',
      opponentName: 'Jane Smith',
      opponentImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      date: '22/08/2025',
      matchType: 'Competition',
      outcome: 'Victory',
      playerScore: 5,
      opponentScore: 2,
    },
    {
      id: '2',
      opponentName: 'Taylor Swift',
      opponentImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      date: '20/08/2025',
      matchType: 'Training',
      outcome: 'Defeat',
      playerScore: 12,
      opponentScore: 15,
    },
    {
      id: '3',
      opponentName: 'Emily Jones',
      opponentImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      date: '18/08/2025',
      matchType: 'Competition',
      outcome: 'Victory',
      playerScore: 5,
      opponentScore: 2,
    },
    {
      id: '4',
      opponentName: 'Adam',
      opponentImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      date: '15/08/2025',
      matchType: 'Training',
      outcome: 'Victory',
      playerScore: 8,
      opponentScore: 3,
    },
  ];

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
    matchesList: {
      paddingHorizontal: width * 0.04,
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
        <Text style={styles.title}>Recent Matches</Text>
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
            placeholder="Search by opponent..."
            placeholderTextColor={Colors.gray.light}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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
            activeFilter === 'Type' && styles.filterButtonActive
          ]}
          onPress={() => setActiveFilter('Type')}
        >
          {activeFilter === 'Type' ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>Type</Text>
            </LinearGradient>
          ) : (
            <Text style={styles.filterButtonText}>Type</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.filterButton,
            activeFilter === 'Win/Loss' && styles.filterButtonActive
          ]}
          onPress={() => setActiveFilter('Win/Loss')}
        >
          {activeFilter === 'Win/Loss' ? (
            <LinearGradient
              colors={Colors.glassyGradient.colors}
              style={[styles.filterButton, { borderWidth: 1, borderColor: Colors.glassyGradient.borderColor }]}
              start={Colors.glassyGradient.start}
              end={Colors.glassyGradient.end}
            >
              <Text style={styles.filterButtonTextActive}>Win/Loss</Text>
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

      {/* Matches List */}
      <ScrollView style={styles.matchesList} showsVerticalScrollIndicator={false}>
        {matches.map((match) => (
          <RecentMatchCard key={match.id} match={match} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

import { MatchSummaryCard } from '@/components/MatchSummaryCard';
import { MatchSummaryStats } from '@/components/MatchSummaryStats';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MatchSummaryScreen() {
  const { width, height } = useWindowDimensions();

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit match');
  };

  const handleSeeFullSummary = () => {
    // TODO: Navigate to full summary
    console.log('See full summary');
  };

  const handleCancelMatch = () => {
    // TODO: Implement cancel match
    console.log('Cancel match');
  };

  const handleSaveMatch = () => {
    // TODO: Implement save match
    console.log('Save match');
  };

  // Sample data for MatchSummaryStats
  const sampleMatch = {
    id: '1',
    opponent: 'Sarah Chen',
    opponentImage: 'https://example.com/sarah.jpg',
    outcome: 'victory' as const,
    score: '15-12',
    matchType: 'competition' as const,
    date: '2024-01-15',
    userScore: 15,
    opponentScore: 12,
    bestRun: 4,
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: height * 0.02,
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.02,
    },
    backButton: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: '#2e2e2e',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    title: {
      fontSize: Math.round(width * 0.06),
      fontWeight: '700',
      color: 'white',
    },
    editButton: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: '#2e2e2e',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: height * 0.05,
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Match Summary</Text>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Ionicons name="pencil" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Recent Match Card - Full Width */}
        <MatchSummaryStats match={sampleMatch} />

        {/* Match Summary Card */}
        <MatchSummaryCard
          onEdit={handleEdit}
          onSeeFullSummary={handleSeeFullSummary}
          onCancelMatch={handleCancelMatch}
          onSaveMatch={handleSaveMatch}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

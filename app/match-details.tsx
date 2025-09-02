import { router, Stack } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TouchTimelineChart } from '@/components/TouchTimelineChart';

import { Colors } from '@/constants/Colors';

interface MatchDetailsProps {
  matchId: string;
  youScore: number;
  opponentScore: number;
  opponentName: string;
  date: string;
  duration: string;
  matchType: string;
  location: string;
}

export default function MatchDetailsScreen() {
  const { width, height } = useWindowDimensions();
  
  // Mock data - in real app this would come from route params
  const matchData: MatchDetailsProps = {
    matchId: '1',
    youScore: 5,
    opponentScore: 3,
    opponentName: 'Alex',
    date: 'Today',
    duration: '02:30',
    matchType: 'Pool Match',
    location: 'Metro Field House'
  };

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    console.log('Edit match details');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: height * 0.15, // Extend past the notch area
      backgroundColor: '#212121',
      zIndex: 1,
    },
    header: {
      backgroundColor: 'transparent', // Make header transparent since background is behind it
      paddingHorizontal: width * 0.04,
      zIndex: 2, // Ensure header content is above background
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    title: {
      fontSize: width * 0.05,
      fontWeight: '600',
      color: 'white',
      flex: 1,
      textAlign: 'center',
      marginLeft: width * 0.06, // Offset for back button
    },
    editButton: {
      width: width * 0.055,
      height: width * 0.055,
      borderRadius: width * 0.0275,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editButtonText: {
      color: 'white',
      fontSize: width * 0.035,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.02,
      paddingBottom: height * 0.04, // Add bottom padding for better scrolling
    },
    matchSummaryCard: {
      backgroundColor: 'rgba(210, 164, 241, 0.3)',
      borderRadius: width * 0.05,
      padding: width * 0.04,
      marginBottom: height * 0.03,
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
    },
    matchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.02,
    },
    profilePicture: {
      width: width * 0.12,
      height: width * 0.12,
      borderRadius: width * 0.06,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.04,
    },
    profileText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    matchInfo: {
      flex: 1,
    },
    playerName: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.005,
    },
    matchDetails: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    matchType: {
      fontSize: width * 0.035,
      color: 'white',
      fontWeight: '500',
    },
    separator: {
      width: width * 0.01,
      height: width * 0.01,
      borderRadius: width * 0.005,
      backgroundColor: 'white',
      marginHorizontal: width * 0.02,
    },
    location: {
      fontSize: width * 0.035,
      color: 'white',
      fontWeight: '500',
    },
    matchFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: height * 0.02,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    score: {
      fontSize: width * 0.075,
      fontWeight: '600',
      color: 'white',
    },
    duration: {
      fontSize: width * 0.04,
      color: 'white',
      fontWeight: '500',
    },
    section: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      padding: width * 0.04,
      marginBottom: height * 0.03,
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
    },
    sectionTitle: {
      fontSize: width * 0.045,
      fontWeight: '500',
      color: 'white',
      marginBottom: height * 0.02,
    },
    insightRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: height * 0.015,
      borderBottomWidth: 1,
      borderBottomColor: '#464646',
    },
    insightRowLast: {
      borderBottomWidth: 0,
    },
    insightLabel: {
      fontSize: width * 0.04,
      color: '#9D9D9D',
      fontWeight: '400',
      textTransform: 'capitalize',
    },
    insightValue: {
      fontSize: width * 0.045,
      color: 'white',
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    notesText: {
      fontSize: width * 0.035,
      color: '#9D9D9D',
      lineHeight: height * 0.027,
      letterSpacing: 0.02,
    },
  });

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <ExpoStatusBar style="light" hidden />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header Background - Extends to top of screen */}
        <View style={styles.headerBackground} />
        
        {/* Header Content - Positioned within safe area */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Recent Match Details</Text>
            <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Match Summary Card */}
          <View style={styles.matchSummaryCard}>
            <View style={styles.matchHeader}>
              <View style={styles.profilePicture}>
                <Text style={styles.profileText}>S</Text>
              </View>
              <View style={styles.matchInfo}>
                <Text style={styles.playerName}>Sophia</Text>
                <View style={styles.matchDetails}>
                  <Text style={styles.matchType}>{matchData.matchType}</Text>
                  <View style={styles.separator} />
                  <Text style={styles.location}>{matchData.location}</Text>
                </View>
              </View>
            </View>
            <View style={styles.matchFooter}>
              <Text style={styles.score}>{matchData.youScore} - {matchData.opponentScore}</Text>
              <Text style={styles.duration}>Duration: {matchData.duration}</Text>
            </View>
          </View>

          {/* Touch Timeline */}
          <TouchTimelineChart />

          {/* Match Insights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Insights</Text>
            <View style={styles.insightRow}>
              <Text style={styles.insightLabel}>Avg. Time Between Touches</Text>
              <Text style={styles.insightValue}>22s</Text>
            </View>
            <View style={styles.insightRow}>
              <Text style={styles.insightLabel}>Longest Scoring Drought</Text>
              <Text style={styles.insightValue}>45s</Text>
            </View>
            <View style={[styles.insightRow, styles.insightRowLast]}>
              <Text style={styles.insightLabel}>Touch Streaks</Text>
              <Text style={styles.insightValue}>3 in a row</Text>
            </View>
          </View>

          {/* Match Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Notes</Text>
            <Text style={styles.notesText}>
              One disadvantage of Lorem Ipsum is that in Latin certain letters appear more frequently than others - which creates a distinct visual impression.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import MatchSummaryCardWithBorder from '@/components/MatchSummaryCardWithBorder';
import { TouchTimelineChart } from '@/components/TouchTimelineChart';
import { useAuth } from '@/contexts/AuthContext';

import { Colors } from '@/constants/Colors';
import { analytics } from '@/lib/analytics';

interface MatchDetailsProps {
  matchId: string;
  youScore: number;
  opponentScore: number;
  opponentName: string;
  opponentImage?: string;
  date: string;
  duration: string;
  matchType: string;
  location: string;
}

export default function MatchDetailsScreen() {
  const { width, height } = useWindowDimensions();
  const { userName, profileImage } = useAuth();
  const params = useLocalSearchParams();
  
  // Get match data from route params
  const matchData: MatchDetailsProps = {
    matchId: params.matchId as string || '1',
    youScore: parseInt(params.youScore as string) || 5,
    opponentScore: parseInt(params.opponentScore as string) || 3,
    opponentName: params.opponentName as string || 'Alex',
    opponentImage: params.opponentImage as string,
    date: params.date as string || 'Today',
    duration: params.duration as string || '02:30',
    matchType: params.matchType as string || 'Training',
    location: params.location as string || 'Metro Field House'
  };

  useFocusEffect(
    useCallback(() => {
      analytics.screen('MatchDetails');
    }, [])
  );

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
      height: height * 0.10, // Further reduced height
      backgroundColor: '#212121',
      zIndex: 1,
    },
    header: {
      backgroundColor: 'transparent', // Make header transparent since background is behind it
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.06, // Add top padding for safe area
      paddingBottom: height * 0.01, // Reduced bottom padding
      zIndex: 2, // Ensure header content is above background
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      paddingTop: height * 0.01, // Add some top padding for better spacing
      paddingBottom: height * 0.04, // Add bottom padding for better scrolling
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
      <SafeAreaView style={styles.container} edges={[]}>
        {/* Header Background - Extends to top of screen */}
        <View style={styles.headerBackground} />
        
        {/* Header Content - Positioned within safe area */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <BackButton onPress={handleBack} />
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
          {/* Match Summary Card with Gradient Border */}
          <MatchSummaryCardWithBorder
            leftPlayerName={userName || "You"}
            leftPlayerImage={profileImage}
            rightPlayerName={matchData.opponentName}
            rightPlayerImage={matchData.opponentImage}
            youScore={matchData.youScore}
            opponentScore={matchData.opponentScore}
            duration={matchData.duration}
            matchType={matchData.matchType}
            isWin={matchData.youScore > matchData.opponentScore}
          />

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

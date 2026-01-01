import { MatchSummaryStats } from '@/components/MatchSummaryStats';
import { useAuth } from '@/contexts/AuthContext';
import { matchService } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { analytics } from '@/lib/analytics';

export default function ManualMatchSummaryScreen() {
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  const { userName, session, user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Extract parameters from navigation
  const {
    yourScore,
    opponentScore,
    opponentName,
    matchType = 'Training',
    date,
    time,
    isWin = 'true',
    notes = '',
    fromAddMatch,
  } = params;
  
  // Check if coming from add-match page (show Done button)
  const showDoneButton = fromAddMatch === 'true';

  const yourScoreNum = parseInt(yourScore as string) || 0;
  const opponentScoreNum = parseInt(opponentScore as string) || 0;
  const isWinBool = isWin === 'true';

  // Format date and time
  const formatDateTime = () => {
    if (date && time) {
      return `${date} at ${time}`;
    }
    return new Date().toLocaleDateString('en-GB') + ' at ' + new Date().toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Create match object for MatchSummaryStats component
  // Replace "You" with user's actual name from auth context
  const userDisplayName = userName || 'You';
  const matchData = {
    id: 'manual-match',
    opponent: opponentName as string || 'Alex',
    opponentImage: '',
    userImage: '',
    userName: userDisplayName, // Use actual user name instead of "You"
    outcome: isWinBool ? ('victory' as const) : ('defeat' as const),
    score: `${yourScoreNum} - ${opponentScoreNum}`,
    matchType: matchType === 'Training' ? ('training' as const) : ('competition' as const),
    date: formatDateTime(),
    userScore: yourScoreNum,
    opponentScore: opponentScoreNum,
    bestRun: 0, // Default value
    fencer1Name: userDisplayName, // Use actual user name instead of "You"
    fencer2Name: opponentName as string || 'Alex',
  };

  useFocusEffect(
    useCallback(() => {
      analytics.screen('ManualMatchSummary');
    }, [])
  );

  const handleDelete = () => {
    const matchId = params.matchId as string;
    
    if (!matchId) {
      console.log('No match ID provided for deletion');
      router.push('/(tabs)');
      return;
    }

    Alert.alert(
      'Delete Match',
      'Are you sure you want to delete this match? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting match:', matchId);
              const success = await matchService.deleteMatch(matchId, undefined, session?.access_token);
              
              if (success) {
                console.log('✅ Match deleted successfully');
                Alert.alert('Success', 'Match deleted successfully');
                router.push('/(tabs)');
              } else {
                console.error('❌ Failed to delete match');
                Alert.alert('Error', 'Failed to delete match. Please try again.');
              }
            } catch (error) {
              console.error('❌ Error deleting match:', error);
              Alert.alert('Error', 'Failed to delete match. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    const matchId = params.matchId as string;
    
    if (!matchId) {
      console.log('No match ID provided for editing');
      Alert.alert('Error', 'Cannot edit match: match ID not found');
      return;
    }

    // Navigate to add match with current data and matchId for editing
    router.push({
      pathname: '/add-match',
      params: {
        editMode: 'true',
        matchId: matchId,
        yourScore: yourScoreNum.toString(),
        opponentScore: opponentScoreNum.toString(),
        opponentName: opponentName as string,
        matchType: matchType as string,
        date: date as string,
        time: time as string,
        notes: notes as string,
      }
    });
  };

  const handleBack = () => {
    router.back();
  };

  const handleDone = async () => {
    const matchId = params.matchId as string | undefined;
    const hasMatchId = !!matchId && matchId !== 'undefined' && matchId !== 'null';

    if (showDoneButton && !hasMatchId) {
      if (!user?.id) {
        Alert.alert('Error', 'You must be logged in to save this match.');
        return;
      }

      const normalizedMatchType = matchType === 'Training' ? 'training' : 'competition';
      const fallbackDate = new Date().toLocaleDateString('en-GB');
      const fallbackTime = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      try {
        const created = await matchService.createManualMatch({
          userId: user.id,
          opponentName: (opponentName as string) || 'Opponent',
          yourScore: yourScoreNum,
          opponentScore: opponentScoreNum,
          matchType: normalizedMatchType,
          date: (date as string) || fallbackDate,
          time: (time as string) || fallbackTime,
          notes: (notes as string) || undefined,
          accessToken: session?.access_token,
        });

        if (!created) {
          Alert.alert('Error', 'Failed to save match. Please try again.');
          return;
        }
      } catch (error) {
        console.error('❌ Error saving match on done:', error);
        Alert.alert('Error', 'Failed to save match. Please try again.');
        return;
      }
    }

    router.push('/(tabs)');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#171717',
    },
    headerBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#212121',
      zIndex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.06,
      paddingBottom: height * 0.01,
      backgroundColor: '#212121',
      zIndex: 2,
    },
    backButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'Articulat CF',
      fontSize: width * 0.05,
      fontWeight: '700',
      color: 'white',
      flex: 1,
      textAlign: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.03,
    },
    headerActionButton: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: '#2A2A2A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: width * 0.041,
      paddingTop: height * 0.02,
      paddingBottom: height * 0.04,
    },
    notesCard: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.051, // 20px
      padding: width * 0.041, // 16px
      marginTop: height * 0.034, // 29px
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 8,
    },
    notesTitle: {
      fontSize: width * 0.046, // 18px
      fontWeight: '500',
      color: '#FFFFFF',
      fontFamily: 'Articulat CF',
      marginBottom: height * 0.014, // 12px
    },
    notesText: {
      fontSize: width * 0.036, // 14px
      fontWeight: '400',
      color: '#9D9D9D',
      fontFamily: 'Articulat CF',
      lineHeight: width * 0.056, // 22px
      letterSpacing: 0.32,
    },
    sourceText: {
      fontSize: width * 0.036, // 14px
      fontWeight: '500',
      color: '#9D9D9D',
      fontFamily: 'Articulat CF',
      marginTop: height * 0.015, // 13px
      textAlign: 'left',
      paddingBottom: height * 0.04, // Add bottom padding for scroll spacing
    },
    doneButton: {
      backgroundColor: '#6C5CE7',
      paddingVertical: height * 0.015,
      paddingHorizontal: width * 0.04,
      borderRadius: width * 0.02,
      alignItems: 'center',
      width: '100%',
    },
    doneButtonText: {
      color: 'white',
      fontSize: Math.round(width * 0.04),
      fontWeight: '600',
    },
    deleteButton: {
      height: height * 0.059, // 50px
      borderRadius: width * 0.041, // 16px
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#171717',
      borderWidth: 1,
      borderColor: '#FF7675',
    },
  });

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }} 
      />
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar style="light" />
        {/* Header background overlay */}
        <View style={[styles.headerBackground, { height: height * 0.10 }]} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Match Summary</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleEdit} style={styles.headerActionButton}>
              <Ionicons name="create-outline" size={22} color="#4ECDC4" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.headerActionButton}>
              <Ionicons name="trash-outline" size={22} color="#FF7675" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Match Summary Stats Component */}
          <MatchSummaryStats match={matchData} />

          {/* Notes Card */}
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Match Notes</Text>
            <Text style={styles.notesText}>
              {notes || 'No match notes'}
            </Text>
          </View>

          {/* Source */}
          <Text style={styles.sourceText}>Source: Manual Entry</Text>
        </ScrollView>

        {/* Done Button - Only show when coming from add-match page */}
        {showDoneButton && (
          <View style={{ 
            paddingHorizontal: width * 0.04, 
            paddingBottom: Math.max(insets.bottom, height * 0.02) + height * 0.01
          }}>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

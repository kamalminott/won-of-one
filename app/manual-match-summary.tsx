import { MatchSummaryStats } from '@/components/MatchSummaryStats';
import { matchService } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

export default function ManualMatchSummaryScreen() {
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams();
  
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
  } = params;

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
  const matchData = {
    id: 'manual-match',
    opponent: opponentName as string || 'Alex',
    opponentImage: '',
    userImage: '',
    userName: 'You',
    outcome: isWinBool ? ('victory' as const) : ('defeat' as const),
    score: `${yourScoreNum} - ${opponentScoreNum}`,
    matchType: matchType === 'Training' ? ('training' as const) : ('competition' as const),
    date: formatDateTime(),
    userScore: yourScoreNum,
    opponentScore: opponentScoreNum,
    bestRun: 0, // Default value
    fencer1Name: 'You',
    fencer2Name: opponentName as string || 'Alex',
  };

  const handleDone = () => {
    // Navigate back to home or match history
    router.push('/(tabs)');
  };

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
              const success = await matchService.deleteMatch(matchId);
              
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
    // Navigate back to add match with current data
    router.push({
      pathname: '/add-match',
      params: {
        editMode: 'true',
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#171717',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: '#212121',
    },
    backButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: 'Articulat CF',
      fontSize: width * 0.05,
      fontWeight: '700',
      color: 'white',
    },
    editButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      paddingHorizontal: width * 0.041, // 16px
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
    },
    buttonsContainer: {
      paddingTop: height * 0.031, // 26px
      gap: height * 0.016, // 13px
    },
    doneButton: {
      height: height * 0.059, // 50px
      borderRadius: width * 0.041, // 16px
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: 'rgba(108, 92, 231, 0.25)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 8,
    },
    doneButtonText: {
      fontSize: width * 0.041, // 16px
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: 'Articulat CF',
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
    deleteButtonText: {
      fontSize: width * 0.041, // 16px
      fontWeight: '700',
      color: '#FF7675',
      fontFamily: 'Articulat CF',
    },
  });

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }} 
      />
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Match Summary</Text>
          
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Match Summary Stats Component */}
          <MatchSummaryStats match={matchData} />

          {/* Notes Card */}
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Match Notes</Text>
            <Text style={styles.notesText}>
              {notes || 'One disadvantage of Lorum Ipsum is that in Latin certain letters appear more frequently than others - which creates a distinct visual impression.'}
            </Text>
          </View>

          {/* Source */}
          <Text style={styles.sourceText}>Source: Manual Entry</Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
              <LinearGradient
                colors={['#6C5CE7', '#5741FF']}
                style={[styles.doneButton, { width: '100%' }]}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
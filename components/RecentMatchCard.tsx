import { analytics } from '@/lib/analytics';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { LossPill } from './LossPill';
import { MatchTypePill } from './MatchTypePill';
import { WinPill } from './WinPill';

// Helper function to get initials from a name
const getInitials = (name: string | undefined): string => {
  if (!name || name.trim() === '') {
    return '?';
  }
  const trimmedName = name.trim();
  const words = trimmedName.split(' ').filter(word => word.length > 0);
  if (words.length === 0) {
    return '?';
  } else if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  } else {
    return words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase();
  }
};

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
}

interface RecentMatchCardProps {
  match: Match;
  customStyle?: object;
  onDelete?: (matchId: string) => void;
  editMode?: boolean;
}

export const RecentMatchCard: React.FC<RecentMatchCardProps> = ({ 
  match, 
  customStyle = {},
  onDelete,
  editMode = false
}) => {
  const { width, height } = useWindowDimensions();
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

  // Helper function to validate if an image URI is valid
  const isValidImage = (imageUri: string | undefined): boolean => {
    return !!(
      imageUri &&
      imageUri !== 'https://via.placeholder.com/60x60' &&
      !imageUri.includes('example.com') &&
      !imageUri.includes('placeholder') &&
      (imageUri.startsWith('http') || imageUri.startsWith('file://'))
    );
  };

  // Helper function to render profile image or initials
  const renderProfileImage = (imageUri: string | undefined, name: string | undefined) => {
    const initials = getInitials(name || '');

    if (imageUri && isValidImage(imageUri) && !imageLoadErrors.has(imageUri)) {
      return (
        <Image
          source={{ uri: imageUri }}
          style={styles.profileImage}
          contentFit="cover"
          onError={(error) => {
            console.log('❌ Image failed to load, will show initials instead:', error);
            if (imageUri) {
              setImageLoadErrors(prev => new Set(prev).add(imageUri));
            }
          }}
          onLoad={() => {
            console.log('✅ Image loaded successfully');
          }}
        />
      );
    }

    return (
      <View style={[styles.profileImage, { backgroundColor: '#393939', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFFFFF' }]}>
        <Text style={styles.profileInitials}>{initials}</Text>
      </View>
    );
  };

  const handleCardPress = () => {
    // Track match selection
    analytics.matchSelected({ match_id: match.id });
    
    const isManualMatch = match.source === 'manual';
    
    if (isManualMatch) {
      // Navigate to manual match summary for manual matches
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
          notes: match.notes || '', // Pass actual notes from the match
        }
      });
    } else {
      // Navigate to regular match details for remote matches
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
          duration: '02:30', // This would come from match data in real app
          location: 'Metro Field House', // This would come from match data in real app
          isWin: (match.outcome === 'Victory').toString() // Pass win status based on outcome
        }
      });
    }
  };

  const handleDeletePress = (e: any) => {
    e.stopPropagation(); // Prevent card press when delete is tapped
    Alert.alert(
      'Delete Match',
      `Are you sure you want to delete this match against ${match.opponentName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete(match.id);
            }
          }
        }
      ]
    );
  };

  const styles = StyleSheet.create({
    matchCard: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.025,
      padding: width * 0.04,
      marginBottom: height * 0.015,
      ...customStyle,
    },
    matchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.015,
    },
    profileImage: {
      width: width * 0.12,
      height: width * 0.12,
      borderRadius: width * 0.06,
      marginRight: width * 0.03,
    },
    profileInitials: {
      color: '#FFFFFF',
      fontSize: width * 0.045,
      fontWeight: '500',
      textAlign: 'center',
    },
    opponentInfo: {
      flex: 1,
    },
    opponentName: {
      fontSize: width * 0.04,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.01,
      lineHeight: width * 0.045,
    },
    matchDate: {
      fontSize: width * 0.03,
      color: 'rgba(255, 255, 255, 0.6)',
    },
    matchTime: {
      fontSize: width * 0.028,
      color: 'rgba(255, 255, 255, 0.5)',
      marginTop: height * 0.002,
    },
    outcomeBadgeContainer: {
      alignItems: 'flex-end',
      position: 'relative',
      minHeight: 30, // Ensure consistent height
    },
    separator: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      marginVertical: height * 0.015,
    },
    matchDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    scoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.01,
    },
    scoreDot: {
      width: width * 0.025,
      height: width * 0.025,
      borderRadius: width * 0.0125,
    },
    scoreText: {
      color: 'white',
      fontSize: width * 0.06,
      fontWeight: '700',
    },
    scoreTextVictory: {
      color: 'rgb(179, 241, 229)',
      fontSize: width * 0.06,
      fontWeight: '700',
    },
    scoreTextDefeat: {
      color: 'rgb(251, 198, 198)',
      fontSize: width * 0.06,
      fontWeight: '700',
    },
    deleteButton: {
      position: 'absolute',
      top: 38, // Position below the pill
      right: 10, // Move slightly to the left
      backgroundColor: '#2A2A2A',
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  const getScoreDotColor = (isPlayerScore: boolean) => {
    if (isPlayerScore) {
      return '#0D9488'; // Teal color for player score
    } else {
      return '#DC2626'; // Red color for opponent score
    }
  };

  return (
    <TouchableOpacity 
      style={styles.matchCard}
      onPress={handleCardPress}
      activeOpacity={0.7}
      disabled={editMode}
    >
      {/* Opponent Info */}
      <View style={styles.matchHeader}>
        {renderProfileImage(match.opponentImage, match.opponentName)}
        <View style={styles.opponentInfo}>
          <Text style={styles.opponentName} numberOfLines={2} ellipsizeMode="tail">
            {match.opponentName}
          </Text>
          <Text style={styles.matchDate}>{match.date}</Text>
          {match.time && (
            <Text style={styles.matchTime}>{match.time}</Text>
          )}
        </View>
        <View style={styles.outcomeBadgeContainer}>
          {match.outcome === 'Victory' ? (
            <WinPill />
          ) : (
            <LossPill />
          )}
          {/* Delete Button (shown in edit mode) */}
          {editMode && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeletePress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={22} color="#FF7675" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Separator Line */}
      <View style={styles.separator} />

      {/* Match Details */}
      <View style={styles.matchDetails}>
        <MatchTypePill text={match.matchType} />

        <View style={styles.scoreContainer}>
          <View
            style={[
              styles.scoreDot,
              { backgroundColor: getScoreDotColor(true) },
            ]}
          />
          <Text style={match.outcome === 'Victory' ? styles.scoreTextVictory : styles.scoreTextDefeat}>{match.playerScore}</Text>
          <Text style={match.outcome === 'Victory' ? styles.scoreTextVictory : styles.scoreTextDefeat}> - </Text>
          <Text style={match.outcome === 'Victory' ? styles.scoreTextVictory : styles.scoreTextDefeat}>{match.opponentScore}</Text>
          <View
            style={[
              styles.scoreDot,
              { backgroundColor: getScoreDotColor(false) },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

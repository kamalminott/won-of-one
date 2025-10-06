import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface Match {
  id: string;
  opponent: string;
  opponentImage: string;
  userImage?: string;
  userName?: string;
  outcome?: 'victory' | 'defeat' | null;
  score: string;
  matchType: 'competition' | 'training';
  date: string;
  userScore: number;
  opponentScore: number;
  bestRun: number;
  fencer1Name?: string;
  fencer2Name?: string;
}

interface MatchSummaryStatsProps {
  match: Match;
  customStyle?: object;
}

export const MatchSummaryStats: React.FC<MatchSummaryStatsProps> = ({ match, customStyle = {} }) => {
  const { width, height } = useWindowDimensions();
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

  // Debug the match data
  console.log('🔍 MatchSummaryStats - Full match data:', {
    userName: match.userName,
    fencer1Name: match.fencer1Name,
    opponent: match.opponent,
    fencer2Name: match.fencer2Name,
    userImage: match.userImage,
    opponentImage: match.opponentImage
  });

  // Helper function to get initials from a name
  const getInitials = (name: string | undefined): string => {
    console.log('🔍 getInitials called with:', name);
    
    if (!name || name.trim() === '') {
      console.log('🔍 No name provided, returning ?');
      return '?';
    }
    
    const trimmedName = name.trim();
    const words = trimmedName.split(' ').filter(word => word.length > 0);
    
    console.log('🔍 Words found:', words);
    
    if (words.length === 0) {
      return '?';
    } else if (words.length === 1) {
      const initial = words[0].charAt(0).toUpperCase();
      console.log('🔍 Single word, returning:', initial);
      return initial;
    } else {
      const initials = words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase();
      console.log('🔍 Multiple words, returning:', initials);
      return initials;
    }
  };

  // Helper function to render profile image or initials
  const renderProfileImage = (imageUri: string | undefined, name: string | undefined, isUser: boolean = false) => {
    const displayName = isUser 
      ? (match.userName || match.fencer1Name || 'Player')
      : (match.opponent || match.fencer2Name || 'Opponent');
    
    const initials = getInitials(displayName);
    
    // Only show image if it's a real image, not placeholder or example URLs
    const isValidImage = imageUri && 
      imageUri !== 'https://via.placeholder.com/60x60' && 
      !imageUri.includes('example.com') &&
      !imageUri.includes('placeholder') &&
      (imageUri.startsWith('http') || imageUri.startsWith('file://'));
    
    console.log('🔍 Profile Image Debug:', {
      isUser,
      displayName,
      initials,
      imageUri,
      isValidImage,
      willShowInitials: !isValidImage
    });
    
    if (isValidImage && !imageLoadErrors.has(imageUri)) {
      console.log('🖼️ Attempting to load image:', imageUri);
      return (
        <Image
          source={{ uri: imageUri }}
          style={styles.playerImage}
          onError={(error) => {
            console.log('❌ Image failed to load, will show initials instead:', error.nativeEvent.error);
            setImageLoadErrors(prev => new Set(prev).add(imageUri));
          }}
          onLoad={() => {
            console.log('✅ Image loaded successfully');
          }}
        />
      );
    }

    return (
      <View style={[styles.playerImage, { backgroundColor: '#393939', borderWidth: 1, borderColor: '#FFFFFF' }]}>
        <Text style={styles.initialsText}>{initials}</Text>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      width: width * 0.9, // 358px equivalent
      height: height * 0.28, // 227px equivalent
      alignSelf: 'center',
      marginTop: height * 0.02,
      marginBottom: height * 0.025,
      position: 'relative',
      overflow: 'visible',
    },
    gradientContainer: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#D1A3F0',
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 8,
      overflow: 'visible',
    },
    winPill: {
      position: 'absolute',
      top: -17, // Half of pill height (34px / 2 = 17px) to make it exactly half inside/outside
      left: '50%',
      marginLeft: -37.5, // Half of pill width (75px / 2)
      width: 75,
      height: 34,
      backgroundColor: '#4D4159',
      borderWidth: 2,
      borderColor: '#D1A3F0',
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 7,
      zIndex: 10,
    },
    winPillText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'System',
    },
    winPillIcon: {
      width: 14,
      height: 14,
    },
    playerContainer: {
      position: 'absolute',
      top: 42, // 198px - 156px
      width: 60,
      height: 89,
    },
    leftPlayer: {
      left: 36,
    },
    rightPlayer: {
      right: 36,
    },
    playerImage: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#393939',
      borderWidth: 1,
      borderColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    initialsText: {
      color: '#FFFFFF',
      fontSize: 32,
      fontWeight: '500',
      textAlign: 'center',
    },
    playerName: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: 'System',
    },
    scoreContainer: {
      position: 'absolute',
      top: 66, // 222px - 156px
      left: '50%',
      marginLeft: -42, // Half of score width (84px / 2)
      width: 84,
      height: 41,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scoreText: {
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '600',
      textAlign: 'center',
      fontFamily: 'System',
    },
    horizontalDivider: {
      position: 'absolute',
      top: 147, // 303px - 156px
      left: 16,
      right: 16,
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    statsContainer: {
      position: 'absolute',
      top: 163, // 319px - 156px
      left: 0,
      right: 0,
      height: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 32,
    },
    statColumn: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    statNumber: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 4,
      fontFamily: 'System',
    },
    statLabel: {
      color: '#9D9D9D',
      fontSize: 12,
      fontWeight: '400',
      textAlign: 'center',
      fontFamily: 'System',
    },
    verticalDivider: {
      position: 'absolute',
      top:178, // Center between the numbers and labels
      width: 1,
      height: 36,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    leftDivider: {
      left: 122, // 129px - 32px
    },
    rightDivider: {
      right: 102, // 279px - 200px (right side)
    },
  });

  return (
    <View style={styles.container}>
      {/* Win Pill */}
      {match.outcome === 'victory' && (
        <View style={styles.winPill}>
          <Ionicons name="checkmark" size={14} color="#FFFFFF" style={styles.winPillIcon} />
          <Text style={styles.winPillText}>Win</Text>
        </View>
      )}

      {/* Loss Pill */}
      {match.outcome === 'defeat' && (
        <View style={styles.winPill}>
          <Ionicons name="close" size={14} color="#FFFFFF" style={styles.winPillIcon} />
          <Text style={styles.winPillText}>Loss</Text>
        </View>
      )}

      <LinearGradient
        colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientContainer}
      >

        {/* Left Player */}
        <View style={[styles.playerContainer, styles.leftPlayer]}>
          {renderProfileImage(match.userImage, match.userName || match.fencer1Name, true)}
          <Text style={styles.playerName}>
            {match.userName ? match.userName.split(' ')[0] : match.fencer1Name ? match.fencer1Name.split(' ')[0] : 'Player 1'}
          </Text>
        </View>

        {/* Right Player */}
        <View style={[styles.playerContainer, styles.rightPlayer]}>
          {renderProfileImage(match.opponentImage, match.opponent || match.fencer2Name, false)}
          <Text style={styles.playerName}>
            {match.opponent ? match.opponent.split(' ')[0] : match.fencer2Name ? match.fencer2Name.split(' ')[0] : 'Player 2'}
          </Text>
        </View>

        {/* Score */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {match.userScore} - {match.opponentScore}
          </Text>
        </View>

        {/* Horizontal Divider */}
        <View style={styles.horizontalDivider} />

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{match.userScore}</Text>
            <Text style={styles.statLabel}>Touches For</Text>
          </View>
          
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>{match.opponentScore}</Text>
            <Text style={styles.statLabel}>Touches Against</Text>
          </View>
          
          <View style={styles.statColumn}>
            <Text style={styles.statNumber}>
              {match.userScore > match.opponentScore 
                ? `+${match.userScore - match.opponentScore}` 
                : match.userScore < match.opponentScore 
                  ? `-${match.opponentScore - match.userScore}` 
                  : '0'
              }
            </Text>
            <Text style={styles.statLabel}>Score Diff</Text>
          </View>
        </View>

        {/* Vertical Dividers */}
        <View style={[styles.verticalDivider, styles.leftDivider]} />
        <View style={[styles.verticalDivider, styles.rightDivider]} />
      </LinearGradient>
    </View>
  );
};

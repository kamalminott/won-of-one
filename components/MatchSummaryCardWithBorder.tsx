import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

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

interface MatchSummaryCardProps {
  leftPlayerName: string;
  leftPlayerImage: string;
  rightPlayerName: string;
  rightPlayerImage: string;
  youScore: number;
  opponentScore: number;
  duration: string;
  matchType: string;
  isWin?: boolean;
  style?: any;
}

export default function MatchSummaryCardWithBorder({
  leftPlayerName,
  leftPlayerImage,
  rightPlayerName,
  rightPlayerImage,
  youScore,
  opponentScore,
  duration,
  matchType,
  isWin = true,
  style,
}: MatchSummaryCardProps) {
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
  const renderProfileImage = (imageUri: string | undefined, name: string | undefined, isLeftPlayer: boolean = true) => {
    const initials = getInitials(name);
    const imageStyle = isLeftPlayer ? styles.leftPlayerImage : styles.rightPlayerImage;
    const initialsStyle = isLeftPlayer ? styles.leftPlayerInitials : styles.rightPlayerInitials;

    if (isValidImage(imageUri) && !imageLoadErrors.has(imageUri)) {
      return (
        <Image
          source={{ uri: imageUri }}
          style={imageStyle}
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
      <View style={[imageStyle, { backgroundColor: '#393939', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={initialsStyle}>{initials}</Text>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: 0, // Remove horizontal margins to match touch timeline
      marginTop: height * 0.02, // Positive margin to add space below header
      marginBottom: height * 0.02, // Reduced bottom margin
    },
    matchSummaryCardBorder: {
      width: width * 0.92, // Match touch timeline card width (full width minus padding)
      height: height * 0.21, // Dynamic height based on screen size
      borderRadius: width * 0.06, // Dynamic border radius
      padding: width * 0.012, // Dynamic border width (5px equivalent)
      alignSelf: 'center', // Center the card
    },
    matchSummaryCardGradientBorder: {
      flex: 1,
      borderRadius: width * 0.05, // Dynamic inner radius
      overflow: 'hidden', // This creates the border effect
    },
    matchSummaryCard: {
      flex: 1,
      margin: width * 0.012, // Dynamic margin for border effect
      borderRadius: width * 0.05, // Dynamic border radius
      backgroundColor: 'rgba(77, 65, 89, 1)',
      shadowColor: '#6C5CE7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
    },
    winBadge: {
      position: 'absolute',
      width: width * 0.19, // Dynamic width
      height: height * 0.042, // Dynamic height
      left: '50%', // Center horizontally
      marginLeft: -(width * 0.19) / 2, // Half of width to center properly
      top: -(height * 0.014), // Moved down very slightly from -0.021 to -0.018
      backgroundColor: '#4D4159',
      borderWidth: 2,
      borderColor: '#D1A3F0',
      borderRadius: width * 0.04, // Dynamic border radius
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: width * 0.03, // Dynamic padding
      paddingVertical: height * 0.006, // Dynamic padding
      zIndex: 10, // Ensure it appears on top of the card
    },
    winIcon: {
      color: 'white',
      fontSize: width * 0.035, // Dynamic font size
      fontWeight: '600',
      marginRight: width * 0.018, // Dynamic margin
    },
    winText: {
      color: 'white',
      fontSize: width * 0.04, // Dynamic font size
      fontWeight: '600',
    },
    lossBadge: {
      position: 'absolute',
      width: width * 0.19, // Same width as win badge
      height: height * 0.042, // Same height as win badge
      left: '50%', // Center horizontally
      marginLeft: -(width * 0.19) / 2, // Half of width to center properly
      top: -(height * 0.014), // Same position as win badge
      backgroundColor: '#4D4159', // Same background as win badge
      borderWidth: 2,
      borderColor: '#D1A3F0', // Same border as win badge
      borderRadius: width * 0.04, // Same border radius as win badge
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: width * 0.03, // Same padding as win badge
      paddingVertical: height * 0.006, // Same padding as win badge
      zIndex: 10, // Same z-index as win badge
    },
    lossIcon: {
      color: 'white',
      fontSize: width * 0.035, // Same size as win icon
      fontWeight: '600',
      marginRight: width * 0.018, // Same margin as win icon
    },
    lossText: {
      color: 'white',
      fontSize: width * 0.04, // Same size as win text
      fontWeight: '600',
    },
    leftPlayerContainer: {
      position: 'absolute',
      width: width * 0.15, // Dynamic width
      height: height * 0.11, // Dynamic height
      left: width * 0.05, // Dynamic left position
      top: height * 0.05, // Dynamic top position
      alignItems: 'center',
    },
    leftPlayerImage: {
      width: width * 0.15, // Dynamic width
      height: width * 0.15, // Square aspect ratio
      borderRadius: width * 0.075, // Half of width for perfect circle
      borderWidth: 2,
      borderColor: 'white',
    },
    leftPlayerInitials: {
      color: '#FFFFFF',
      fontSize: width * 0.06,
      fontWeight: '500',
      textAlign: 'center',
    },
    leftPlayerName: {
      position: 'absolute',
      width: width * 0.15, // Dynamic width
      height: height * 0.027, // Dynamic height
      left: 0,
      top: height * 0.08, // Dynamic top position
      fontSize: width * 0.035, // Dynamic font size
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
    },
    rightPlayerContainer: {
      position: 'absolute',
      width: width * 0.15, // Dynamic width
      height: height * 0.11, // Dynamic height
      right: width * 0.05, // Dynamic right position
      top: height * 0.05, // Dynamic top position
      alignItems: 'center',
    },
    rightPlayerImage: {
      width: width * 0.15, // Dynamic width
      height: width * 0.15, // Square aspect ratio
      borderRadius: width * 0.075, // Half of width for perfect circle
      borderWidth: 2,
      borderColor: 'white',
    },
    rightPlayerInitials: {
      color: '#FFFFFF',
      fontSize: width * 0.06,
      fontWeight: '500',
      textAlign: 'center',
    },
    rightPlayerName: {
      position: 'absolute',
      width: width * 0.15, // Dynamic width
      height: height * 0.027, // Dynamic height
      left: 0,
      top: height * 0.08, // Dynamic top position
      fontSize: width * 0.035, // Dynamic font size
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
    },
    scoreContainer: {
      position: 'absolute',
      width: width * 0.35, // Increased width for larger scores
      height: height * 0.12, // Dynamic height
      left: '50%', // Center horizontally
      marginLeft: -(width * 0.35) / 2, // Half of width to center properly
      top: height * 0.043, // Dynamic top position
      alignItems: 'center',
    },
    score: {
      position: 'absolute',
      width: width * 0.3, // Increased width for larger scores
      height: height * 0.051, // Dynamic height
      left: width * 0.025, // Adjusted left position
      top: 0,
      fontSize: width * 0.07, // Dynamic font size
      fontWeight: '600',
      color: 'white',
      textAlign: 'center',
    },
    duration: {
      position: 'absolute',
      width: width * 0.35, // Match the score container width
      height: height * 0.024, // Dynamic height
      left: 0,
      top: height * 0.05, // Dynamic top position
      fontSize: width * 0.03, // Dynamic font size
      fontWeight: '500',
      color: '#9D9D9D',
      textAlign: 'center',
    },
    matchTypeBadge: {
      position: 'absolute',
      width: width * 0.25, // Match the score container width
      height: height * 0.03, // Dynamic height
      left: width * 0.05, // Center within the score container (35% - 25%) / 2 = 5%
      top: height * 0.08, // Dynamic top position
      backgroundColor: '#625971',
      borderRadius: width * 0.15, // Dynamic border radius
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: width * 0.02, // Dynamic padding
      paddingVertical: height * 0.005, // Dynamic padding
    },
    matchTypeText: {
      fontSize: width * 0.028, // Dynamic font size
      fontWeight: '500',
      color: 'white',
      textAlign: 'center',
    },
  });

  return (
    <View style={[styles.container, style]}>
      {/* Win/Loss Badge - Positioned outside card */}
      {isWin ? (
        <View style={styles.winBadge}>
          <Text style={styles.winIcon}>✓</Text>
          <Text style={styles.winText}>Win</Text>
        </View>
      ) : (
        <View style={styles.lossBadge}>
          <Text style={styles.lossIcon}>✗</Text>
          <Text style={styles.lossText}>Loss</Text>
        </View>
      )}

      {/* Match Summary Card with Gradient Border */}
      <View style={styles.matchSummaryCardBorder}>
        <LinearGradient
          colors={['#D2A3F0', '#989DFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.matchSummaryCardGradientBorder}
        >
          <View style={styles.matchSummaryCard}>
            {/* Left Player */}
            <View style={styles.leftPlayerContainer}>
              {renderProfileImage(leftPlayerImage, leftPlayerName, true)}
              <Text style={styles.leftPlayerName}>{leftPlayerName}</Text>
            </View>

            {/* Right Player */}
            <View style={styles.rightPlayerContainer}>
              {renderProfileImage(rightPlayerImage, rightPlayerName, false)}
              <Text style={styles.rightPlayerName}>{rightPlayerName}</Text>
            </View>

            {/* Score Container */}
            <View style={styles.scoreContainer}>
              <Text style={styles.score}>{youScore} - {opponentScore}</Text>
              <Text style={styles.duration}>Duration: {duration}</Text>
              <View style={styles.matchTypeBadge}>
                <Text style={styles.matchTypeText}>{matchType}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}
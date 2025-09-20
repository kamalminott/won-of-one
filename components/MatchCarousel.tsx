import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

interface CarouselItem {
  id: string;
  date: string;
  isWin: boolean;
  youScore: number;
  opponentScore: number;
  opponentName: string;
}

interface MatchCarouselProps {
  /** Array of items to display in the carousel */
  items: CarouselItem[];
  /** Callback when "View All" button is pressed */
  onViewAll: () => void;
  /** Custom callback when an item is pressed (overrides default navigation) */
  onItemPress?: (item: CarouselItem) => void;
  /** Maximum number of items to display (default: 3) */
  maxItems?: number;
  /** Whether to show dot indicators (default: true) */
  showDots?: boolean;
  /** Whether to show the "Add New Match" button (default: true) */
  showAddButton?: boolean;
  /** Title for empty state (default: "No Recent Matches") */
  emptyStateTitle?: string;
  /** Description for empty state */
  emptyStateDescription?: string;
  /** Icon for empty state (default: "trophy-outline") */
  emptyStateIcon?: keyof typeof Ionicons.glyphMap;
  /** Custom renderer for individual items */
  customItemRenderer?: (item: CarouselItem, index: number) => React.ReactNode;
  /** User's display name */
  userName?: string;
  /** User's profile image */
  userProfileImage?: string | null;
}

export const MatchCarousel: React.FC<MatchCarouselProps> = ({
  items,
  onViewAll,
  onItemPress,
  maxItems = 3,
  showDots = true,
  showAddButton = true,
  emptyStateTitle = "No Recent Matches",
  emptyStateDescription = "Start your fencing journey by adding your first match!",
  emptyStateIcon = "trophy-outline",
  customItemRenderer,
  userName,
  userProfileImage,
}) => {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  // Limit to maxItems maximum
  const displayItems = items.slice(0, maxItems);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 100;
    },
    onPanResponderMove: (evt, gestureState) => {
      // Only allow movement if there are multiple items
      if (displayItems.length > 1) {
        // Limit the movement to prevent going too far off screen
        const maxMove = screenWidth * 0.3;
        const clampedDx = Math.max(-maxMove, Math.min(maxMove, gestureState.dx));
        translateX.setValue(clampedDx);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (displayItems.length <= 1) {
        // No swiping if only one item
        translateX.setValue(0);
        return;
      }
      
      const threshold = screenWidth * 0.2;
      
      if (gestureState.dx > threshold && currentIndex > 0) {
        // Swipe right - go to previous item
        Animated.timing(translateX, {
          toValue: screenWidth,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          goToPrevious();
        });
      } else if (gestureState.dx < -threshold && currentIndex < displayItems.length - 1) {
        // Swipe left - go to next item
        Animated.timing(translateX, {
          toValue: -screenWidth,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          goToNext();
        });
      } else {
        // Snap back to current position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    },
  });

  const goToNext = () => {
    if (currentIndex < displayItems.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      // Reset position since we're showing a new card
      translateX.setValue(0);
    } else {
      // Loop back to first item
      setCurrentIndex(0);
      translateX.setValue(0);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      // Reset position since we're showing a new card
      translateX.setValue(0);
    } else {
      // Loop to last item
      const lastIndex = displayItems.length - 1;
      setCurrentIndex(lastIndex);
      translateX.setValue(0);
    }
  };

  const handleItemPress = (item: CarouselItem) => {
    if (onItemPress) {
      onItemPress(item);
    } else {
      // Default behavior for matches - pass all match data
      router.push({
        pathname: '/match-history-details',
        params: { 
          matchId: item.id,
          opponentName: item.opponentName,
          opponentImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', // Default opponent image
          youScore: item.youScore.toString(),
          opponentScore: item.opponentScore.toString(),
          matchType: 'Competition', // Default match type for carousel items
          date: item.date,
          duration: '02:30', // Default duration
          location: 'Metro Field House', // Default location
          isWin: item.isWin.toString() // Pass the win status from carousel data
        }
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: height * 0.01,
      width: '100%',
      overflow: 'hidden',
      paddingHorizontal: '0%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.02,
    },
    headerTitle: {
      fontSize: width * 0.05,
      fontWeight: '600',
      color: 'white',
    },
    carouselContainer: {
      flexDirection: 'row',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchCard: {
      width: '100%',
      height: height * 0.12,
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      padding: 0,
      position: 'relative',
      alignSelf: 'center',
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 8,
    },
    matchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.01,
    },
    matchResult: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rightPill: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    matchScores: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.01,
    },
    playerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.06,
      justifyContent: 'center',
    },
    playerInfoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.06,
      justifyContent: 'center',
      marginRight: width * 0.05,
    },
    playerInfoRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.06,
      justifyContent: 'center',
      marginLeft: width * 0.05,
    },
    profileSection: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: height * 0.005,
      marginTop: height * 0.0,
    },
    profileContainerLeft: {
      position: 'absolute',
      left: '8%',
      top: height * 0.02,
      alignItems: 'center',
    },
    profileContainerRight: {
      position: 'absolute',
      right: '8%',
      top: height * 0.02,
      alignItems: 'center',
    },
    profileCircle: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#FFFFFF',
    },
    profileInitial: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '700',
    },
    scoreInfo: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: height * 0.025,
      position: 'relative',
    },
    scoreInfoLeft: {
      position: 'absolute',
      left: '40%',
      top: height * 0.025,
      width: width * 0.09,
      height: height * 0.035,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreInfoRight: {
      position: 'absolute',
      right: '40%',
      top: height * 0.025,
      width: width * 0.09,
      height: height * 0.035,
      alignItems: 'center',
      justifyContent: 'center',
    },
    score: {
      color: '#FFFFFF',
      fontSize: width * 0.05,
      fontWeight: '600',
      lineHeight: height * 0.035,
      textAlign: 'center',
      zIndex: 3,
    },
    scoreDot: {
      position: 'absolute',
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      zIndex: 1,
      top: '50%',
      left: '50%',
      transform: [{ translateX: -width * 0.04 }, { translateY: -width * 0.04 }],
    },
    scoreDotLeft: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
      backgroundColor: '#00B894',
    },
    scoreDotRight: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
      backgroundColor: '#FF7675',
    },
    playerName: {
      color: '#FFFFFF',
      fontSize: width * 0.035,
      fontWeight: '500',
      textAlign: 'center',
      marginTop: height * 0.01,
      maxWidth: width * 0.15,
      lineHeight: width * 0.04,
    },
    matchDate: {
      color: '#9D9D9D',
      fontSize: width * 0.03,
      fontWeight: '500',
      lineHeight: height * 0.02,
      textAlign: 'center',
      position: 'absolute',
      left: '50%',
      top: height * 0.06,
      width: width * 0.25,
      transform: [{ translateX: -width * 0.125 }],
    },
    scoreGroup: {
      position: 'absolute',
      left: '50%',
      top: height * 0.025,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: width * 0.02,
      transform: [{ translateX: -width * 0.1 }],
    },
    scoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: width * 0.01,
    },
    dash: {
      color: '#FFFFFF',
      fontSize: width * 0.05,
      fontWeight: '600',
      lineHeight: height * 0.035,
      textAlign: 'center',
    },
    vsText: {
      color: '#FFFFFF',
      fontSize: width * 0.05,
      fontWeight: '600',
      lineHeight: height * 0.035,
      textAlign: 'center',
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: height * 0.015,
      gap: width * 0.02,
    },
    dot: {
      width: width * 0.02,
      height: width * 0.02,
      borderRadius: width * 0.01,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    activeDot: {
      backgroundColor: 'white',
    },
    buttonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: height * 0.02,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewAllText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: width * 0.035,
      marginRight: width * 0.02,
    },
    addMatchButton: {
      backgroundColor: Colors.purple.primary,
      paddingHorizontal: width * 0.06,
      paddingVertical: height * 0.01,
      borderRadius: width * 0.02,
      marginTop: height * 0.01,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: width * 0.02,
    },
    addMatchText: {
      color: 'white',
      fontSize: width * 0.035,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: height * 0.04,
      paddingHorizontal: width * 0.08,
    },
    emptyIcon: {
      marginBottom: height * 0.015,
    },
    emptyTitle: {
      color: 'white',
      fontSize: width * 0.045,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: height * 0.008,
    },
    emptyDescription: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: width * 0.035,
      textAlign: 'center',
      marginBottom: height * 0.03,
    },
    emptyAddButton: {
      backgroundColor: Colors.purple.primary,
      paddingHorizontal: width * 0.08,
      paddingVertical: height * 0.015,
      borderRadius: width * 0.03,
    },
    emptyAddText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
  });

  // Empty state
  if (displayItems.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recent Matches</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={width * 0.04} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name={emptyStateIcon} size={width * 0.1} color="rgba(255, 255, 255, 0.3)" />
          </View>
          <Text style={styles.emptyTitle}>{emptyStateTitle}</Text>
          <Text style={styles.emptyDescription}>
            {emptyStateDescription}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent Matches</Text>
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={width * 0.04} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
      </View>

      {/* Carousel */}
      <View {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.carouselContainer,
            { transform: [{ translateX }] }
          ]}
        >
          {customItemRenderer ? (
            customItemRenderer(displayItems[currentIndex], currentIndex)
          ) : (
            <TouchableOpacity
              key={displayItems[currentIndex]?.id}
              style={styles.matchCard}
              onPress={() => handleItemPress(displayItems[currentIndex])}
            >
              {/* Left Profile Container */}
              <View style={styles.profileContainerLeft}>
                <View style={styles.profileCircle}>
                  {userProfileImage ? (
                    <Image
                      source={{ uri: userProfileImage }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: width * 0.05,
                      }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.profileInitial}>
                      {userName?.charAt(0)?.toUpperCase() || 'Y'}
                    </Text>
                  )}
                </View>
                <Text style={styles.playerName} numberOfLines={2} ellipsizeMode="tail">
                  {userName || 'You'}
                </Text>
              </View>
              
              {/* Right Profile Container */}
              <View style={styles.profileContainerRight}>
                <View style={styles.profileCircle}>
                  <Text style={styles.profileInitial}>
                    {displayItems[currentIndex]?.opponentName?.charAt(0)?.toUpperCase() || 'O'}
                  </Text>
                </View>
                <Text style={styles.playerName} numberOfLines={2} ellipsizeMode="tail">
                  {displayItems[currentIndex]?.opponentName}
                </Text>
              </View>
              
              {/* Score Group with Equal Spacing */}
              <View style={styles.scoreGroup}>
                <View style={styles.scoreContainer}>
                  <View style={styles.scoreDotLeft} />
                  <Text style={styles.score}>{displayItems[currentIndex]?.youScore}</Text>
                </View>
                
                <Text style={styles.dash}>-</Text>
                
                <View style={styles.scoreContainer}>
                  <Text style={styles.score}>{displayItems[currentIndex]?.opponentScore}</Text>
                  <View style={styles.scoreDotRight} />
                </View>
              </View>
              
              {/* Date */}
              <Text style={styles.matchDate}>{formatDate(displayItems[currentIndex]?.date)}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* Dot Indicators */}
      {showDots && displayItems.length > 1 && (
        <View style={styles.dotsContainer}>
          {displayItems.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot
              ]}
            />
          ))}
        </View>
      )}

    </View>
  );
};

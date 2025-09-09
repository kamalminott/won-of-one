import { Colors } from '@/constants/Colors';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { LossPill } from './LossPill';
import { WinPill } from './WinPill';

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
  /** Callback when "Add New Match" button is pressed */
  onAddNewMatch: () => void;
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
}

export const MatchCarousel: React.FC<MatchCarouselProps> = ({
  items,
  onViewAll,
  onAddNewMatch,
  onItemPress,
  maxItems = 3,
  showDots = true,
  showAddButton = true,
  emptyStateTitle = "No Recent Matches",
  emptyStateDescription = "Start your fencing journey by adding your first match!",
  emptyStateIcon = "trophy-outline",
  customItemRenderer,
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
      // Default behavior for matches
      router.push({
        pathname: '/match-summary',
        params: { matchId: item.id }
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: 'numeric',
      month: 'short', 
      year: 'numeric'
    });
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
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      padding: width * 0.025,
    },
    matchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.01,
    },
    matchDate: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: width * 0.04,
      fontWeight: '600',
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
    scoreContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    playerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.06,
      justifyContent: 'center',
    },
    profileCircle: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
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
    },
    score: {
      color: 'white',
      fontSize: width * 0.05,
      fontWeight: '700',
    },
    playerName: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: width * 0.03,
      marginTop: height * 0.005,
    },
    centerSection: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 0.6,
    },
    vsText: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: width * 0.035,
      fontWeight: '600',
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
      paddingVertical: height * 0.08,
      paddingHorizontal: width * 0.08,
    },
    emptyIcon: {
      marginBottom: height * 0.02,
    },
    emptyTitle: {
      color: 'white',
      fontSize: width * 0.05,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: height * 0.01,
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
            <Ionicons name={emptyStateIcon} size={width * 0.15} color="rgba(255, 255, 255, 0.3)" />
          </View>
          <Text style={styles.emptyTitle}>{emptyStateTitle}</Text>
          <Text style={styles.emptyDescription}>
            {emptyStateDescription}
          </Text>
          {showAddButton && (
            <TouchableOpacity style={styles.emptyAddButton} onPress={onAddNewMatch}>
              <Text style={styles.emptyAddText}>Add Your First Match</Text>
            </TouchableOpacity>
          )}
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
              <View style={styles.matchHeader}>
                <Text style={styles.matchDate}>{formatDate(displayItems[currentIndex]?.date)}</Text>
                <View style={styles.rightPill}>
                  {displayItems[currentIndex]?.isWin ? (
                    <WinPill />
                  ) : (
                    <LossPill />
                  )}
                </View>
              </View>
              
              <View style={styles.matchScores}>
                <View style={styles.scoreContainer}>
                  <View style={styles.playerInfo}>
                    <View style={styles.profileCircle}>
                      <Text style={styles.profileInitial}>Y</Text>
                    </View>
                    <View style={styles.scoreInfo}>
                      <Text style={styles.score}>{displayItems[currentIndex]?.youScore}</Text>
                      <Text style={styles.playerName}>You</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.centerSection}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                
                <View style={styles.scoreContainer}>
                  <View style={styles.playerInfo}>
                    <View style={styles.scoreInfo}>
                      <Text style={styles.score}>{displayItems[currentIndex]?.opponentScore}</Text>
                      <Text style={styles.playerName}>{displayItems[currentIndex]?.opponentName}</Text>
                    </View>
                    <View style={styles.profileCircle}>
                      <Text style={styles.profileInitial}>
                        {displayItems[currentIndex]?.opponentName?.charAt(0)?.toUpperCase() || 'O'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
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

      {/* Add New Match Button */}
      {showAddButton && (
        <TouchableOpacity style={styles.addMatchButton} onPress={onAddNewMatch}>
          <Feather name="plus-square" color="#FFFFFF" size={width * 0.05} />
          <Text style={styles.addMatchText}>Add New Match</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

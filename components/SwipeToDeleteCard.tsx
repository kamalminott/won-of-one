import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent, PanGestureHandlerStateChangeEvent, State } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

interface SwipeToDeleteCardProps {
  children: React.ReactNode;
  onDelete: () => Promise<void>;
  matchId: string;
  disabled?: boolean;
}

const SwipeToDeleteCard: React.FC<SwipeToDeleteCardProps> = ({
  children,
  onDelete,
  matchId,
  disabled = false,
}) => {
  const [translateX] = useState(new Animated.Value(0));
  const [isDeleting, setIsDeleting] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const panRef = useRef<PanGestureHandler>(null);

  const SWIPE_THRESHOLD_1 = width * 0.15; // 15% - Show red X
  const SWIPE_THRESHOLD_2 = width * 0.4; // 40% - Show delete confirmation
  const MAX_SWIPE = width * 0.9; // 90% - Maximum swipe distance

  const handleSwipe = (event: PanGestureHandlerStateChangeEvent) => {
    if (disabled || isDeleting) return;

    const { translationX, state } = event.nativeEvent;
    const totalTranslation = currentPosition + translationX;
    const progress = Math.abs(totalTranslation) / width;
    setSwipeProgress(progress);

    if (state === State.ACTIVE) {
      // Limit swipe to left only and maximum distance
      const clampedTranslation = Math.max(-MAX_SWIPE, Math.min(0, totalTranslation));
      translateX.setValue(clampedTranslation);
    } else if (state === State.END) {
      const absTranslation = Math.abs(totalTranslation);
      
      if (absTranslation >= SWIPE_THRESHOLD_2) {
        // Full swipe - trigger deletion
        handleDelete();
      } else if (absTranslation >= SWIPE_THRESHOLD_1) {
        // Partial swipe - snap to threshold 1 and stay there
        const newPosition = -SWIPE_THRESHOLD_1;
        setCurrentPosition(newPosition);
        Animated.spring(translateX, {
          toValue: newPosition,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
        setSwipeProgress(SWIPE_THRESHOLD_1 / width);
      } else {
        // Small swipe - snap back to original position
        setCurrentPosition(0);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        setSwipeProgress(0);
      }
    }
  };

  const handleGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    if (disabled || isDeleting) return;
    
    const { translationX } = event.nativeEvent;
    // Add current position to the translation for continued swiping
    const totalTranslation = currentPosition + translationX;
    const progress = Math.abs(totalTranslation) / width;
    setSwipeProgress(progress);
    
    // Limit swipe to left only and maximum distance
    const clampedTranslation = Math.max(-MAX_SWIPE, Math.min(0, totalTranslation));
    translateX.setValue(clampedTranslation);
  };

  const handleDelete = async () => {
    if (disabled || isDeleting) return;

    Alert.alert(
      'Delete Match',
      'Are you sure you want to delete this match? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Snap back to original position
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            setSwipeProgress(0);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDelete();
              // Animate card out to the left
              Animated.timing(translateX, {
                toValue: -width,
                duration: 300,
                useNativeDriver: true,
              }).start();
            } catch (error) {
              console.error('Error deleting match:', error);
              // Snap back to original position on error
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
              setSwipeProgress(0);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const getDeletePanelContent = () => {
    if (swipeProgress >= 0.75) {
      return {
        text: '🗑️ DELETE MATCH',
        subtext: 'Release to confirm deletion',
        backgroundColor: '#FF4444',
      };
    } else if (swipeProgress >= 0.25) {
      return {
        text: '❌ DELETE',
        subtext: 'Swipe further\n to confirm',
        backgroundColor: '#FF6666',
      };
    }
    return null;
  };

  const deletePanelContent = getDeletePanelContent();

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Delete panel that slides in from the right */}
      {deletePanelContent && swipeProgress > 0 && (
        <View style={[styles.deletePanel, { backgroundColor: deletePanelContent.backgroundColor }]}>
          <Text style={styles.deleteText}>{deletePanelContent.text}</Text>
          <Text style={styles.deleteSubtext}>{deletePanelContent.subtext}</Text>
        </View>
      )}

      {/* Main card content */}
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleSwipe}
        enabled={!disabled && !isDeleting}
        activeOffsetX={[-20, 20]}
        failOffsetY={[-30, 30]}
        minPointers={1}
        maxPointers={1}
        shouldCancelWhenOutside={false}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {children}
          {isDeleting && (
            <View style={styles.deletingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.deletingText}>Deleting...</Text>
            </View>
          )}
        </Animated.View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: width * 0.025, // Match the card's exact border radius
  },
  card: {
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  deletePanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end', // Align content to the right
    zIndex: 1,
    paddingHorizontal: width * 0.12, // More padding on the right
    paddingRight: width * 0.02, // Extra padding to move text further right
    borderRadius: width * 0.025, // Match the card's exact border radius
    marginBottom: height * 0.015, // Match the card's margin
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: width * 0.03,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: height * 0.002,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  deleteSubtext: {
    color: '#FFFFFF',
    fontSize: width * 0.024,
    textAlign: 'center',
    opacity: 0.95,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deletingText: {
    color: '#FFFFFF',
    fontSize: width * 0.04,
    marginTop: height * 0.01,
    fontWeight: '500',
  },
});

export default SwipeToDeleteCard;

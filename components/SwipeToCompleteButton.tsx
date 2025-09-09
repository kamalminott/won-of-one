import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import SwipeButton from 'rn-swipe-button';

interface SwipeToCompleteButtonProps {
  title?: string;
  onSwipeSuccess?: () => void;
  customStyle?: any;
}

export const SwipeToCompleteButton: React.FC<SwipeToCompleteButtonProps> = ({
  title = 'Swipe To Complete The Match',
  onSwipeSuccess,
  customStyle
}) => {
  const { width, height } = useWindowDimensions();
  
  // Responsive breakpoints for small screens
  const isSmallScreen = width < 400;
  const isTinyScreen = width < 360;
  const isNexusS = width <= 360; // Nexus S specific optimization

  // Animation for highlight effect
  const highlightAnimation = useRef(new Animated.Value(0)).current;
  const containerWidth = isNexusS ? width * 0.98 : width * 0.94;

  useEffect(() => {
    const startAnimation = () => {
      Animated.sequence([
        Animated.timing(highlightAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(highlightAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Restart animation after a delay
        setTimeout(startAnimation, 2000);
      });
    };

    startAnimation();
  }, [highlightAnimation]);

  const styles = StyleSheet.create({
    container: {
      width: isNexusS ? '98%' : '94%', // Wider on Nexus S for better fit
      height: isNexusS ? 35 : 45, // Smaller height on Nexus S
      borderRadius: isNexusS ? 8 : 12, // Smaller border radius on Nexus S
      ...customStyle, // Apply custom styles from parent
    },
    swipeButton: {
      height: isNexusS ? 35 : 45, // Smaller height on Nexus S
      width: '100%',
      borderRadius: isNexusS ? 8 : 12, // Smaller border radius on Nexus S
    },
    titleStyle: {
      color: 'white',
      fontSize: isNexusS ? 14 : 16, // Smaller font on Nexus S
      fontWeight: '600',
      textAlign: 'center',
    },
    highlightOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: isNexusS ? 8 : 12,
      zIndex: 1,
    },
    highlightBar: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 60,
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      borderRadius: isNexusS ? 8 : 12,
    },
  });

  const handleSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onSwipeSuccess) {
      onSwipeSuccess();
    }
  };

  return (
    <View style={styles.container}>
      <SwipeButton
        title={title}
        titleStyles={styles.titleStyle}
        containerStyles={styles.swipeButton}
        height={isNexusS ? 28 : 32} // Smaller height on Nexus S
        railBackgroundColor="#6C5CE7"
        railFillBorderColor="transparent"
        railFillBackgroundColor="transparent"
        thumbIconBorderColor='transparent'
        thumbIconBackgroundColor="white"
        thumbIconWidth={isNexusS ? 24 : 30} // Smaller thumb on Nexus S
        thumbIconComponent={() => <MaterialCommunityIcons name="chevron-double-right" size={isNexusS ? 16 : 20} color="#6C5CE7" />}
        thumbIconStyles={{ borderRadius: isNexusS ? 8 : 10, transform: [{ translateX: isNexusS ? 3 : 5 }] }}
        onSwipeSuccess={handleSuccess}
        swipeSuccessThreshold={isNexusS ? 40 : 50} // Smaller threshold on Nexus S
        disabled={false}
      />
      
      {/* Animated highlight overlay */}
      <Animated.View
        style={[
          styles.highlightOverlay,
          {
            opacity: highlightAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, 0.8, 0],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.highlightBar,
            {
              transform: [
                {
                  translateX: highlightAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-60, containerWidth + 60],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
};

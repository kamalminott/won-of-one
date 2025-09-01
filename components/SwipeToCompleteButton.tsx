import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import SwipeButton from 'rn-swipe-button';

interface SwipeToCompleteButtonProps {
  title?: string;
  onSwipeSuccess?: () => void;
  customStyle?: any;
}

export const SwipeToCompleteButton: React.FC<SwipeToCompleteButtonProps> = ({
  title = 'Complete The Match',
  onSwipeSuccess,
  customStyle
}) => {
  const { width, height } = useWindowDimensions();
  
  // Responsive breakpoints for small screens
  const isSmallScreen = width < 400;
  const isTinyScreen = width < 360;
  const isNexusS = width <= 360; // Nexus S specific optimization

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
        thumbIconComponent={() => <Ionicons name="chevron-forward" size={isNexusS ? 16 : 20} color="#6C5CE7" />}
        thumbIconStyles={{ borderRadius: isNexusS ? 8 : 10, transform: [{ translateX: isNexusS ? 3 : 5 }] }}
        onSwipeSuccess={handleSuccess}
        swipeSuccessThreshold={isNexusS ? 40 : 50} // Smaller threshold on Nexus S
        disabled={false}
      />
    </View>
  );
};

import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  title = 'Swipe To Complete The Match',
  onSwipeSuccess,
  customStyle
}) => {
  const { width, height } = useWindowDimensions();
  
  // Responsive breakpoints for small screens
  const isSmallScreen = width < 400;
  const isTinyScreen = width < 360;
  const isNexusS = width <= 360; // Nexus S specific optimization

  // Animation removed - no highlight effect

  const styles = StyleSheet.create({
    container: {
      width: '100%', // Use full width to match other components
      height: isNexusS ? 35 : 45, // Smaller height on Nexus S
      borderRadius: isNexusS ? 8 : 12, // Smaller border radius on Nexus S
      alignSelf: 'stretch', // Ensure it stretches to fill parent width
      ...customStyle, // Apply custom styles from parent
    },
    swipeButton: {
      height: isNexusS ? 35 : 45, // Smaller height on Nexus S
      width: '100%',
      borderRadius: isNexusS ? 8 : 12, // Smaller border radius on Nexus S
      alignSelf: 'stretch', // Ensure it stretches to fill parent width
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
        thumbIconComponent={() => <MaterialCommunityIcons name="chevron-double-right" size={isNexusS ? 16 : 20} color="#6C5CE7" />}
        thumbIconStyles={{ borderRadius: isNexusS ? 8 : 10, transform: [{ translateX: isNexusS ? 3 : 5 }] }}
        onSwipeSuccess={handleSuccess}
        swipeSuccessThreshold={isNexusS ? 30 : 35} // Reduced threshold to prevent overflow
        disabled={false}
      />
    </View>
  );
};

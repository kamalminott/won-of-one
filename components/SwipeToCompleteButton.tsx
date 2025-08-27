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

  const styles = StyleSheet.create({
    container: {
      width: '94%',
      height: 45,
      borderRadius: 12,
      ...customStyle, // Apply custom styles from parent
    },
    swipeButton: {
      height: 45,
      width: '100%',
      borderRadius: 12,
    },
    titleStyle: {
      color: 'white',
      fontSize: 16,
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
        height={32}
        railBackgroundColor="#6C5CE7"
        railFillBorderColor="transparent"
        railFillBackgroundColor="transparent"
        thumbIconBorderColor='transparent'
        thumbIconBackgroundColor="white"
        thumbIconWidth={30}
        thumbIconComponent={() => <Ionicons name="chevron-forward" size={20} color="#6C5CE7" />}
        thumbIconStyles={{ borderRadius: 10, transform: [{ translateX: 5 }] }}
        onSwipeSuccess={handleSuccess}
        swipeSuccessThreshold={50}
        disabled={false}
      />
    </View>
  );
};

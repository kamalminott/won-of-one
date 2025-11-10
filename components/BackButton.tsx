import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { TouchableOpacity, useWindowDimensions } from 'react-native';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  style?: any;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color = '#FFFFFF',
  style
}) => {
  const { width } = useWindowDimensions();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <TouchableOpacity
      style={[{
        width: width * 0.08,
        height: width * 0.08,
        borderRadius: width * 0.04,
        backgroundColor: '#343434',
        alignItems: 'center',
        justifyContent: 'center',
      }, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Ionicons 
        name="arrow-back" 
        size={width * 0.05} 
        color={color} 
      />
    </TouchableOpacity>
  );
};

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface WinPillProps {
  text?: string;
  customStyle?: object;
  textStyle?: object;
}

export const WinPill: React.FC<WinPillProps> = ({ 
  text = 'Win', 
  customStyle = {}, 
  textStyle = {} 
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    pill: {
      backgroundColor: 'rgb(50, 79, 66)',
      paddingHorizontal: width * 0.025,
      paddingVertical: height * 0.008,
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: width * 0.015,
      ...customStyle,
    },
    text: {
      color: 'rgb(221, 255, 248)',
      fontSize: width * 0.035,
      fontWeight: '600',
      ...textStyle,
    },
    icon: {
      marginRight: width * 0.01,
    },
  });

  return (
    <View style={styles.pill}>
      <Ionicons 
        name="checkmark" 
        size={width * 0.035} 
        color="rgb(221, 255, 248)" 
        style={styles.icon}
      />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface DefeatPillProps {
  text?: string;
  customStyle?: object;
  textStyle?: object;
}

export const DefeatPill: React.FC<DefeatPillProps> = ({ 
  text = 'Defeat', 
  customStyle = {}, 
  textStyle = {} 
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    pill: {
      backgroundColor: 'rgb(91, 52, 53)',
      paddingHorizontal: width * 0.035,
      paddingVertical: height * 0.012,
      borderRadius: width * 0.06,
      alignItems: 'center',
      justifyContent: 'center',
      ...customStyle,
    },
    text: {
      color: 'rgb(250, 178, 178)',
      fontSize: width * 0.04,
      fontWeight: '600',
      ...textStyle,
    },
  });

  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

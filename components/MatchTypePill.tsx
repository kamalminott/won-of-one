import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface MatchTypePillProps {
  text: string;
  customStyle?: object;
  textStyle?: object;
}

export const MatchTypePill: React.FC<MatchTypePillProps> = ({ 
  text, 
  customStyle = {}, 
  textStyle = {} 
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    pill: {
      backgroundColor: 'rgb(57, 57, 57)',
      paddingHorizontal: width * 0.025,
      paddingVertical: height * 0.008,
      borderRadius: width * 0.06,
      alignItems: 'center',
      justifyContent: 'center',
      ...customStyle,
    },
    text: {
      color: 'white',
      fontSize: width * 0.03,
      fontWeight: '500',
      ...textStyle,
    },
  });

  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

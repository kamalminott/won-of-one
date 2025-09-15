import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface AddNewMatchButtonProps {
  onPress: () => void;
}

export function AddNewMatchButton({ onPress }: AddNewMatchButtonProps) {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      width: width * 0.35, // 130px equivalent
      height: height * 0.03, // 24px equivalent
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.02,
    },
    text: {
      fontFamily: 'Articulat CF',
      fontStyle: 'normal',
      fontWeight: '500',
      fontSize: width * 0.035, // 14px equivalent
      lineHeight: height * 0.024, // 19px equivalent
      textAlign: 'right',
      color: '#9D9D9D',
      width: width * 0.26, // 100px equivalent
    },
    iconButton: {
      width: width * 0.06, // 24px equivalent
      height: height * 0.03, // 24px equivalent
      backgroundColor: '#6C5CE7',
      borderRadius: width * 0.015, // 6px equivalent
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Text style={styles.text}>Add new match</Text>
      <View style={styles.iconButton}>
        <Ionicons name="add" size={width * 0.045} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

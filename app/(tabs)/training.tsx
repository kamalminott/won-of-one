import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function TrainingScreen() {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5%',
    },
    title: {
      fontSize: width * 0.08,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.02,
    },
    subtitle: {
      fontSize: width * 0.045,
      color: Colors.purple.primary,
      fontWeight: '600',
      marginBottom: height * 0.01,
    },
    description: {
      fontSize: width * 0.04,
      color: Colors.gray.light,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training</Text>
      <Text style={styles.subtitle}>Track your training sessions</Text>
      <Text style={styles.description}>Coming soon...</Text>
    </View>
  );
}

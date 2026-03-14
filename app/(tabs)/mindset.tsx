import { Colors } from '@/constants/Colors';
import { analytics } from '@/lib/analytics';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function MindsetScreen() {
  const { width, height } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      analytics.screen('Mindset');
      analytics.capture('mindset_viewed');
    }, [])
  );

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
      <Text style={styles.title}>Mindset</Text>
      <Text style={styles.subtitle}>Mental preparation tools</Text>
      <Text style={styles.description}>Coming soon...</Text>
    </View>
  );
}

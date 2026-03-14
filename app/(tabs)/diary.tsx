import { analytics } from '@/lib/analytics';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export default function DiaryScreen() {
  const { width, height } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      analytics.screen('Diary');
      analytics.capture('diary_viewed');
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Diary</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});

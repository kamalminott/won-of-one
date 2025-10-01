import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Set navigation bar color for both platforms
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor('rgba(19, 19, 19, 1)', true);
    }
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="create-account" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="add-match" options={{ headerShown: false }} />
            <Stack.Screen name="match-history" options={{ headerShown: false }} />
            <Stack.Screen name="match-history-details" options={{ headerShown: false }} />
            <Stack.Screen name="match-summary" options={{ headerShown: false }} />
            <Stack.Screen name="neutral-match-summary" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar 
            style="auto" 
            backgroundColor={Platform.OS === 'android' ? 'rgba(19, 19, 19, 1)' : undefined}
          />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

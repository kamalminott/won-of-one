import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { analytics, POSTHOG_CONFIG } from '@/lib/analytics';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import React from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

// Component to connect PostHog instance to analytics helper
function PostHogConnector() {
  const posthog = usePostHog();
  
  useEffect(() => {
    if (posthog) {
      console.log('🔍 PostHog instance received:', {
        hasCapture: typeof posthog.capture === 'function',
        hasScreen: typeof posthog.screen === 'function',
        hasFlush: typeof posthog.flush === 'function',
        hasIdentify: typeof posthog.identify === 'function',
      });
      
      // Check session replay configuration
      console.log('🎥 PostHog Session Replay Config:', {
        enableSessionReplay: (POSTHOG_CONFIG as any).enableSessionReplay,
        sessionReplayConfig: (POSTHOG_CONFIG as any).sessionReplayConfig,
        host: POSTHOG_CONFIG.host,
        enabled: POSTHOG_CONFIG.enable,
      });
      
      // Register default properties
      try {
        posthog.register({
          app_version: Application.nativeApplicationVersion ?? 'unknown',
          build_number: Application.nativeBuildVersion ?? 'unknown',
          os: Device.osName ?? 'unknown',
          os_version: Device.osVersion ?? 'unknown',
          device_model: Device.modelName ?? 'unknown',
        });
        console.log('✅ PostHog properties registered');
      } catch (error) {
        console.warn('⚠️ Could not register PostHog properties:', error);
      }
      
      analytics.setInstance(posthog);
      
      // Test event to verify connection
      setTimeout(async () => {
        try {
          console.log('📤 PostHog Configuration:');
          console.log('   Host:', POSTHOG_CONFIG.host);
          console.log('   API Key:', POSTHOG_CONFIG.apiKey.substring(0, 15) + '...');
          console.log('   Project URL: https://eu.posthog.com/project/98132');
          
          // Send multiple test events to verify
          posthog.capture('app_launched', { 
            timestamp: new Date().toISOString(),
            test_event: true,
            source: 'react_native_app',
          });
          
          posthog.screen('App Launch Screen');
          
          // Check if session replay methods exist
          const hasSessionReplay = (posthog as any).startSessionReplay || (posthog as any).stopSessionReplay;
          console.log('🎥 Session Replay available:', !!hasSessionReplay);
          console.log('🎥 Session Replay enabled in config:', (POSTHOG_CONFIG as any).enableSessionReplay);
          console.log('🎥 Session Replay Config:', (POSTHOG_CONFIG as any).sessionReplayConfig);
          
          // Force flush
          if (posthog.flush) {
            await posthog.flush();
            console.log('✅ Events flushed to PostHog EU');
            
            setTimeout(() => {
              console.log('📊 Check PostHog dashboard at: https://eu.posthog.com/project/98132/activity/live');
              console.log('📊 Look for events: "app_launched" and "$screen"');
              console.log('🎥 Session recordings: https://eu.posthog.com/project/98132/replay');
              console.log('📊 If still no events, verify API key in PostHog: Project Settings → API Keys');
              console.log('⚠️ NOTE: Session recordings may require app rebuild if using dev client');
            }, 5000);
          }
          
          console.log('✅ Test events sent');
        } catch (error: any) {
          console.error('❌ PostHog error:', error?.message || error);
        }
      }, 1500);
    } else {
      console.warn('⚠️ PostHog instance is null');
    }
  }, [posthog]);
  
  return null;
}

export default function RootLayout() {
  console.log('🚀 RootLayout rendered - App starting!');
  
  // Check if this is a development build
  const isDevBuild = __DEV__ || Constants.executionEnvironment === 'standalone';
  console.log('🔍 Build Type Check:', {
    __DEV__,
    executionEnvironment: Constants.executionEnvironment,
    isDevBuild,
    appOwnership: Constants.appOwnership,
    isDevice: Constants.isDevice,
  });
  
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

  // Only initialize PostHog on native platforms (iOS/Android), not web
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  
  const appContent = (
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

  // Wrap with PostHogProvider only on native platforms
  if (isNative) {
    return (
      <PostHogProvider apiKey={POSTHOG_CONFIG.apiKey} options={POSTHOG_CONFIG}>
        <PostHogConnector />
        {appContent}
      </PostHogProvider>
    );
  }

  // Web platform: render without PostHog
  return appContent;
}

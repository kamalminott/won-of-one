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
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

// Safely import expo-updates for automatic update checking
let Updates: typeof import('expo-updates') | null = null;
try {
  Updates = require('expo-updates');
} catch (error) {
  // Updates not available in dev mode
}

import { AuthProvider } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { subscriptionService } from '@/lib/subscriptionService';

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

  // Initialize RevenueCat on app launch
  React.useEffect(() => {
    async function initializeRevenueCat() {
      try {
        await subscriptionService.initialize();
      } catch (error) {
        console.error('❌ Failed to initialize RevenueCat:', error);
      }
    }

    // Initialize RevenueCat after a short delay
    const timeoutId = setTimeout(initializeRevenueCat, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Set up global error handler for PostHog error tracking
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      // Web platform doesn't use ErrorUtils
      return;
    }

    const globalErrorUtils = (global as any).ErrorUtils;
    const hasErrorUtils =
      globalErrorUtils &&
      typeof globalErrorUtils.getGlobalHandler === 'function' &&
      typeof globalErrorUtils.setGlobalHandler === 'function';

    if (!hasErrorUtils) {
      console.warn('⚠️ Global ErrorUtils not available; skipping PostHog error handler setup.');
      return;
    }

    const originalHandler = globalErrorUtils.getGlobalHandler();
    
    globalErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      // Capture exception in PostHog
      if (analytics && typeof analytics.captureException === 'function') {
        analytics.captureException(error, {
          isFatal: isFatal ?? false,
          source: 'global_error_handler',
        });
      }
      
      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
    
    // Cleanup
    return () => {
      if (originalHandler) {
        globalErrorUtils.setGlobalHandler(originalHandler);
      }
    };
  }, []);

  // Check for OTA updates on app launch
  React.useEffect(() => {
    async function checkForUpdates() {
      if (!Updates) {
        console.log('📦 OTA updates not available (expo-updates module not found)');
        return;
      }

      // Check if updates are enabled (will be false in dev builds)
      if (!Updates.isEnabled) {
        console.log('📦 OTA updates not available (dev mode or updates disabled)');
        return;
      }

      try {
        console.log('🔍 Checking for OTA updates...');
        const update = await Updates.checkForUpdateAsync();
        
        if (update.isAvailable) {
          console.log('✅ Update available, downloading...');
          await Updates.fetchUpdateAsync();
          console.log('✅ Update downloaded, will apply on next app restart');
          // Note: We don't auto-reload here to avoid disrupting the user
          // The update will be applied on the next app launch
        } else {
          console.log('✅ App is up to date');
        }
      } catch (error: any) {
        // Handle the case where updates are not supported (e.g., in dev builds)
        if (error?.message?.includes('not supported in development builds') || 
            error?.message?.includes('not supported')) {
          console.log('📦 OTA updates not supported in this build type');
        } else {
          console.error('❌ Error checking for updates:', error);
        }
      }
    }

    // Check for updates after a short delay to not block app startup
    const timeoutId = setTimeout(checkForUpdates, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Route password recovery and email confirmation deep links directly (before any tab render)
  React.useEffect(() => {
    const handleAuthLink = async (url?: string | null) => {
      if (!url) return false;
      const parsedUrl = url.includes('#') ? url.replace('#', '?') : url;
      const parsed = Linking.parse(parsedUrl);
      const qp = parsed.queryParams || {};
      const accessToken = qp.access_token as string | undefined;
      const refreshToken = qp.refresh_token as string | undefined;
      const type = qp.type as string | undefined;
      const code = qp.code as string | undefined;
      const token = qp.token as string | undefined;
      const path = parsed.path || '';

      const isResetPath = typeof path === 'string' && path.includes('reset-password');
      const isRecovery = type === 'recovery' || isResetPath;
      const hasTokens = accessToken && refreshToken;
      const hasCode = !!code;
      const hasToken = !!token;
      const isEmailConfirm =
        type === 'signup' ||
        type === 'email_confirm' ||
        type === 'invite' ||
        (!type && !isResetPath && qp.redirect_to?.toString().includes('confirm'));

      // Handle email confirmation: verify email and then redirect to login (never log in)
      if (isEmailConfirm) {
        try {
          console.log('📧 Handling email confirmation...', { hasTokens, hasCode, hasToken, type });

          // Clear any existing session first to avoid auto-login
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.warn('⚠️ Error signing out before verification:', signOutErr);
          }

          // Prefer OTP verification to avoid creating a session
          const verifyToken = (token || code || '') as string;
          if (verifyToken) {
            // Try signup first, then email_confirm as fallback
            const verifySignup = await supabase.auth.verifyOtp({
              token_hash: verifyToken,
              type: 'signup',
            });
            if (verifySignup.error) {
              console.warn('⚠️ Signup verify failed, trying email_confirm:', verifySignup.error);
              const verifyEmail = await supabase.auth.verifyOtp({
                token_hash: verifyToken,
                type: 'email',
              });
              if (verifyEmail.error) {
                console.error('❌ Error verifying email with token:', verifyEmail.error);
                router.replace({
                  pathname: '/login',
                  params: { verification: 'error', error: 'invalid_code' },
                });
                return true;
              } else {
                console.log('✅ Email confirmed via token (email_confirm)');
              }
            } else {
              console.log('✅ Email confirmed via token (signup)');
            }
          } else if (hasTokens && accessToken && refreshToken) {
            // Fallback: if only access/refresh tokens were provided, do NOT keep session
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) {
              console.error('❌ Error setting session for email confirmation:', sessionError);
              router.replace({
                pathname: '/login',
                params: { verification: 'error', error: 'invalid_link' },
              });
              return true;
            }
            console.log('✅ Email confirmed via session (fallback)');
          } else {
            console.warn('⚠️ Email confirmation link missing tokens or code');
            router.replace({
              pathname: '/login',
              params: { verification: 'error', error: 'missing_tokens' },
            });
            return true;
          }

          // Always sign out to prevent auto-login after confirmation
          await supabase.auth.signOut();

          router.replace({
            pathname: '/login',
            params: { verification: 'success' },
          });
        } catch (error: any) {
          console.error('❌ Error handling email confirmation:', error);
          router.replace({
            pathname: '/login',
            params: { verification: 'error', error: error?.message || 'unknown_error' },
          });
        }
        return true;
      }

      if (isRecovery && (hasTokens || hasCode)) {
        router.replace({
          pathname: '/reset-password',
          params: {
            access_token: accessToken,
            refresh_token: refreshToken,
            code,
            type: 'recovery',
          },
        });
        return true;
      }
      return false;
    };

    // Handle cold start
    Linking.getInitialURL().then((url) => handleAuthLink(url));

    // Handle in-app deep link events
    const subscription = Linking.addEventListener('url', (event) => {
      handleAuthLink(event.url);
    });

    return () => subscription.remove();
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
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen name="paywall" options={{ headerShown: false }} />
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

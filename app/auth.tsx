import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const CALLBACK_REDIRECT_TIMEOUT_MS = 5000;
const DEFAULT_REDIRECT_TIMEOUT_MS = 1500;

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const { user, loading, isPasswordRecovery } = useAuth();
  const hasRedirectedRef = useRef(false);

  const hasAuthParams = useMemo(
    () =>
      Boolean(
        params.code ||
          params.access_token ||
          params.refresh_token ||
          params.error ||
          params.type
      ),
    [params.access_token, params.code, params.error, params.refresh_token, params.type]
  );

  useEffect(() => {
    analytics.screen('Auth');
    analytics.capture('auth_viewed', { has_auth_params: hasAuthParams });
  }, [hasAuthParams]);

  useEffect(() => {
    if (hasRedirectedRef.current || loading) return;

    if (isPasswordRecovery) {
      hasRedirectedRef.current = true;
      analytics.capture('auth_redirect', { target: 'reset_password' });
      router.replace('/reset-password');
      return;
    }

    if (user) {
      hasRedirectedRef.current = true;
      analytics.capture('auth_redirect', { target: 'tabs' });
      router.replace('/(tabs)');
      return;
    }

    const timeoutMs = hasAuthParams ? CALLBACK_REDIRECT_TIMEOUT_MS : DEFAULT_REDIRECT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      analytics.capture('auth_redirect', { target: 'login' });
      router.replace('/login');
    }, timeoutMs);

    return () => clearTimeout(timeoutId);
  }, [hasAuthParams, isPasswordRecovery, loading, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#E9D7FF" />
      <Text style={styles.title}>Completing sign in...</Text>
      <Text style={styles.subtitle}>
        Please wait while we securely finish authentication.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 18,
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    textAlign: 'center',
  },
});

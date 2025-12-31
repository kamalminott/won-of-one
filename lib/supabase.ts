import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Supabase configuration
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://dxgvjghcpnseglukvqao.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3ZqZ2hjcG5zZWdsdWt2cWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzA4NzMsImV4cCI6MjA3MDUwNjg3M30.ngvJhCVvmSc7x9ggxj4A07yoRE4TaD338LK-sjFo0wI';

// Only import AsyncStorage on native platforms (not during web static rendering)
let AsyncStorage: any = null;
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  // Dynamic import to avoid loading during static rendering
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    // Fallback if AsyncStorage is not available
    console.warn('AsyncStorage not available:', e);
  }
}

// Create Supabase client with conditional storage
// Enhanced configuration for secure token management
const supabaseConfig: any = {
  global: {},
  auth: {
    autoRefreshToken: true,        // Automatically refresh expired access tokens
    persistSession: true,          // Save session to AsyncStorage for persistence
    detectSessionInUrl: false,    // Don't detect sessions from URLs (mobile app)
    // Optional: Enable token rotation for enhanced security
    // This requires Supabase to support it in the dashboard
    flowType: 'pkce',              // Use PKCE flow for better security (recommended)
  },
};

const DEFAULT_FETCH_TIMEOUT_MS = Number(
  process.env.EXPO_PUBLIC_SUPABASE_FETCH_TIMEOUT_MS || 15000
);

const fetchWithTimeout: typeof fetch = async (input, init = {}) => {
  if (!Number.isFinite(DEFAULT_FETCH_TIMEOUT_MS) || DEFAULT_FETCH_TIMEOUT_MS <= 0) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

  const incomingSignal = init.signal;
  if (incomingSignal) {
    if (incomingSignal.aborted) {
      controller.abort();
    } else {
      incomingSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

supabaseConfig.global.fetch = fetchWithTimeout;

// Only use AsyncStorage on native platforms
if (AsyncStorage && (Platform.OS === 'ios' || Platform.OS === 'android')) {
  supabaseConfig.auth.storage = AsyncStorage;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);

// Export types for TypeScript
export type Database = any; // We'll define this properly later when we know your table structure

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

// Supabase configuration
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'https://dxgvjghcpnseglukvqao.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3ZqZ2hjcG5zZWdsdWt2cWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzA4NzMsImV4cCI6MjA3MDUwNjg3M30.ngvJhCVvmSc7x9ggxj4A07yoRE4TaD338LK-sjFo0wI';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Export types for TypeScript
export type Database = any; // We'll define this properly later when we know your table structure

/**
 * Integration Test Setup
 * Uses REAL Supabase database for accurate testing
 */

// Suppress Expo warnings in integration tests
(global as any).__ExpoImportMetaRegistry = {
  register: jest.fn(),
  get: jest.fn(() => ({
    sourceUrl: '',
    filename: '',
  })),
};

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Get test database credentials
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const TEST_SUPABASE_KEY = process.env.TEST_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Use your TEST database (will have all tables after you run schema SQL)
const SUPABASE_URL = TEST_SUPABASE_URL || 'https://svmmpzoxzegruuaxlipq.supabase.co';
const SUPABASE_KEY = TEST_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2bW1wem94emVncnV1YXhsaXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5Mzc4NzAsImV4cCI6MjA3NjUxMzg3MH0.ueRYlcPtnk-m8Fyz5MzCUVyUSxOJLmfNVJ3VhuyufAg';

console.log('🔧 Integration test setup:');
console.log('📊 Database URL:', SUPABASE_URL);
console.log('🔑 Using test credentials:', !!TEST_SUPABASE_URL);

// Create real Supabase client for testing
export const testSupabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test user data
interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Create a test user in the real database
 * User will be cleaned up after tests
 */
export const createTestUser = async (): Promise<TestUser> => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const email = `testuser${timestamp}${randomStr}@gmail.com`;
  const password = 'TestPassword123!';
  
  console.log('👤 Creating test user:', email);
  
  const { data, error } = await testSupabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: 'Test User',
      },
      emailRedirectTo: undefined, // Don't send emails
    }
  });
  
  if (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
  
  if (!data.user) {
    throw new Error('User creation returned no user data');
  }
  
  console.log('✅ Test user created:', data.user.id);
  
  return {
    id: data.user.id,
    email,
    password,
  };
};

/**
 * Clean up all test data for a user
 * Deletes goals, matches, and user data
 */
export const cleanupTestData = async (userId: string): Promise<void> => {
  console.log('🧹 Cleaning up test data for user:', userId);
  
  try {
    // Delete in order (handle foreign keys)
    await testSupabase.from('match_event').delete().eq('user_id', userId);
    await testSupabase.from('match_period').delete().eq('user_id', userId);
    await testSupabase.from('match').delete().eq('user_id', userId);
    await testSupabase.from('goal').delete().eq('user_id', userId);
    await testSupabase.from('diary_entry').delete().eq('user_id', userId);
    await testSupabase.from('app_user').delete().eq('user_id', userId);
    
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    // Don't throw - cleanup is best effort
  }
};

/**
 * Sign in as test user
 */
export const signInTestUser = async (email: string, password: string) => {
  const { data, error } = await testSupabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data.user;
};

/**
 * Wait for async operations to complete
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


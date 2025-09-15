import { userService } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Define the shape of our authentication context
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userName: string;
  setUserName: (name: string) => Promise<void>;
  loadUserName: () => Promise<void>;
  profileImage: string | null;
  setProfileImage: (imageUri: string | null) => Promise<void>;
  loadProfileImage: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userName: '',
  setUserName: async () => {},
  loadUserName: async () => {},
  profileImage: null,
  setProfileImage: async () => {},
  loadProfileImage: async () => {},
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Authentication Provider Component
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserNameState] = useState<string>('');
  const [profileImage, setProfileImageState] = useState<string | null>(null);

  // Load user name from AsyncStorage
  const loadUserName = async () => {
    try {
      const savedName = await AsyncStorage.getItem('user_name');
      if (savedName) {
        setUserNameState(savedName);
      } else if (user?.email) {
        // Default to email username if no saved name
        setUserNameState(user.email.split('@')[0]);
      } else {
        setUserNameState('Guest User');
      }
    } catch (error) {
      console.error('Error loading user name:', error);
      setUserNameState(user?.email?.split('@')[0] || 'Guest User');
    }
  };

  // Save user name to AsyncStorage
  const setUserName = async (name: string) => {
    try {
      setUserNameState(name);
      await AsyncStorage.setItem('user_name', name);
      console.log('✅ User name saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving user name:', error);
    }
  };

  // Load profile image from AsyncStorage
  const loadProfileImage = async () => {
    try {
      const savedImage = await AsyncStorage.getItem('user_profile_image');
      if (savedImage) {
        setProfileImageState(savedImage);
      } else {
        setProfileImageState(null);
      }
    } catch (error) {
      console.error('Error loading profile image:', error);
      setProfileImageState(null);
    }
  };

  // Save profile image to AsyncStorage
  const setProfileImage = async (imageUri: string | null) => {
    try {
      setProfileImageState(imageUri);
      if (imageUri) {
        await AsyncStorage.setItem('user_profile_image', imageUri);
        console.log('✅ Profile image saved to AsyncStorage');
      } else {
        await AsyncStorage.removeItem('user_profile_image');
        console.log('✅ Profile image removed from AsyncStorage');
      }
    } catch (error) {
      console.error('Error saving profile image:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      console.log('🔍 Checking for existing session...');
      
      // Check AsyncStorage directly
      try {
        const storedSession = await AsyncStorage.getItem('sb-dxgvjghcpnseglukvqao-auth-token');
        console.log('🔍 AsyncStorage session:', storedSession ? 'Found' : 'Not found');
      } catch (error) {
        console.log('🔍 AsyncStorage error:', error);
      }
      
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('🔍 Session check result:', { session: !!session, error, userId: session?.user?.id });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Load user name and profile image when user changes
  useEffect(() => {
    if (user) {
      loadUserName();
      loadProfileImage();
    } else {
      setUserNameState('Guest User');
      setProfileImageState(null);
    }
  }, [user]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // If signin successful, ensure user exists in app_user table
    if (data.user && !error) {
      console.log('Checking if user exists in app_user table for:', data.user.id);
      const existingUser = await userService.getUserById(data.user.id);
      if (!existingUser) {
        console.log('User not found in app_user table, creating...');
        await userService.createUser(data.user.id, email);
      }
    }
    
    return { error };
  };

  // Sign up function
  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    // If signup successful, create user in app_user table
    if (data.user && !error) {
      console.log('Creating user in app_user table for:', data.user.id);
      await userService.createUser(data.user.id, email);
    }
    
    return { error };
  };

  // Sign out function
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    userName,
    setUserName,
    loadUserName,
    profileImage,
    setProfileImage,
    loadProfileImage,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

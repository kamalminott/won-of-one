import { userService } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { setCachedAuthSession } from '@/lib/authSessionCache';

WebBrowser.maybeCompleteAuthSession();

// Define the shape of our authentication context
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  isPasswordRecovery: boolean;
  userName: string;
  setUserName: (name: string) => Promise<void>;
  loadUserName: () => Promise<void>;
  profileImage: string | null;
  setProfileImage: (imageUri: string | null) => Promise<void>;
  loadProfileImage: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  signUpWithGoogle: () => Promise<{ error: any }>;
  signUpWithApple: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  setIsPasswordRecovery: (value: boolean) => void;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  authReady: false,
  isPasswordRecovery: false,
  userName: '',
  setUserName: async () => {},
  loadUserName: async () => {},
  profileImage: null,
  setProfileImage: async () => {},
  loadProfileImage: async () => {},
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signInWithApple: async () => ({ error: null }),
  signUpWithGoogle: async () => ({ error: null }),
  signUpWithApple: async () => ({ error: null }),
  signOut: async () => {},
  setIsPasswordRecovery: () => {},
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
  const authReady = !loading && (!user || !!session?.access_token);
  const [isPasswordRecovery, setIsPasswordRecoveryState] = useState(false);
  const isPasswordRecoveryRef = useRef(false);
  const setIsPasswordRecovery = (value: boolean) => {
    setIsPasswordRecoveryState(value);
    isPasswordRecoveryRef.current = value;
  };
  const [userName, setUserNameState] = useState<string>('');
  const [profileImage, setProfileImageState] = useState<string | null>(null);
  const oauthInFlightRef = useRef(false);
  const sessionPersistInFlightRef = useRef(false);
  const lastAuthEventRef = useRef<string | null>(null);

  const userNameStorageKey = (userId?: string | null) => {
    return userId ? `user_name:${userId}` : 'user_name';
  };

  const getSupabaseStorageKey = () => {
    const authAny = supabase?.auth as any;
    const storageKey = authAny?.storageKey || (supabase as any)?.storageKey;
    return storageKey || 'sb-dxgvjghcpnseglukvqao-auth-token';
  };

  const getOAuthCodeVerifierKey = () => `${getSupabaseStorageKey()}-code-verifier`;

  const logOAuthCodeVerifier = async (label: string) => {
    try {
      const key = getOAuthCodeVerifierKey();
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        console.log(`🔐 [OAUTH] ${label} code-verifier present (len ${stored.length})`);
      } else {
        console.log(`🔐 [OAUTH] ${label} code-verifier missing`, { key });
      }
    } catch (error) {
      console.warn(`⚠️ [OAUTH] ${label} code-verifier check failed`, error);
    }
  };

  const buildAuthTelemetry = (session?: Session | null) => ({
    has_session: !!session,
    has_access_token: !!session?.access_token,
    access_token_len: session?.access_token?.length ?? 0,
    has_refresh_token: !!session?.refresh_token,
    refresh_token_len: session?.refresh_token?.length ?? 0,
    expires_at: session?.expires_at ?? null,
    provider: session?.user?.app_metadata?.provider ?? null,
    user_id_present: !!session?.user?.id,
  });

  const logAuthHydrationStep = async (
    step: string,
    session?: Session | null,
    extra: Record<string, any> = {}
  ) => {
    try {
      const { analytics } = await import('@/lib/analytics');
      analytics.capture('auth_hydration_step', {
        step,
        ...buildAuthTelemetry(session),
        ...extra,
      });
    } catch (error) {
      console.warn(`⚠️ [AUTH] hydration log failed: ${step}`, error);
    }
  };

  const getMetadataName = (authUser?: User | null) => {
    if (!authUser) return '';
    const metadata = authUser.user_metadata || {};
    return (
      metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      [metadata.given_name, metadata.family_name].filter(Boolean).join(' ')
    );
  };

  const updateAppleMetadata = async (
    credential: AppleAuthentication.AppleAuthenticationCredential,
    authUser?: User | null
  ) => {
    if (!authUser) return;

    const fullName = credential.fullName;
    if (!fullName) return;

    const givenName = fullName.givenName?.trim() || '';
    const familyName = fullName.familyName?.trim() || '';
    const fullNameValue = [givenName, familyName].filter(Boolean).join(' ').trim();

    if (!givenName && !familyName && !fullNameValue) return;

    const metadata = authUser.user_metadata || {};
    const updateData: Record<string, string> = {};

    if (givenName && !metadata.given_name) {
      updateData.given_name = givenName;
    }
    if (familyName && !metadata.family_name) {
      updateData.family_name = familyName;
    }
    if (fullNameValue) {
      if (!metadata.full_name) {
        updateData.full_name = fullNameValue;
      }
      if (!metadata.display_name) {
        updateData.display_name = fullNameValue;
      }
      if (!metadata.name) {
        updateData.name = fullNameValue;
      }
    }

    if (Object.keys(updateData).length === 0) return;

    const { error } = await supabase.auth.updateUser({ data: updateData });
    if (error) {
      console.warn('⚠️ Failed to update Apple auth metadata:', error);
      return;
    }

    console.log('✅ Apple auth metadata stored:', updateData);
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const persistAuthSession = async (session: Session, label: string) => {
    if (!session?.access_token || !session?.refresh_token) {
      console.warn(`⚠️ [AUTH] ${label} session missing tokens`, {
        hasAccessToken: !!session?.access_token,
        hasRefreshToken: !!session?.refresh_token,
      });
      await logAuthHydrationStep('persist_skipped_missing_tokens', session, { label });
      return session;
    }

    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) {
        console.warn(`⚠️ [AUTH] ${label} failed to persist session`, error);
        await logAuthHydrationStep('persist_error', session, {
          label,
          error: error.message || 'unknown_error',
        });
        return session;
      }
      await logAuthHydrationStep('persist_success', data.session ?? session, { label });
      return data.session ?? session;
    } catch (error) {
      console.warn(`⚠️ [AUTH] ${label} session persist exception`, error);
      await logAuthHydrationStep('persist_exception', session, { label });
      return session;
    }
  };

  const hydrateAuthSession = async (label: string) => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn(`⚠️ [AUTH] ${label} getSession error`, error);
        await logAuthHydrationStep('hydrate_get_session_error', null, {
          label,
          error: error.message || 'unknown_error',
        });
      }
      if (data.session) {
        setSession(data.session);
        setUser(isPasswordRecoveryRef.current ? null : data.session.user ?? null);
        setCachedAuthSession(data.session, 'HYDRATE');
        await logAuthHydrationStep('hydrate_get_session_found', data.session, { label });
        return data.session;
      }

      let storedSessionRaw: string | null = null;
      try {
        storedSessionRaw = await AsyncStorage.getItem(getSupabaseStorageKey());
      } catch (storageError) {
        console.warn(`⚠️ [AUTH] ${label} storage read error`, storageError);
        await logAuthHydrationStep('hydrate_storage_error', null, {
          label,
          error: (storageError as any)?.message || 'unknown_error',
        });
      }

      if (!storedSessionRaw) {
        await logAuthHydrationStep('hydrate_refresh_skipped_no_storage', null, { label });
        return null;
      }

      let storedRefreshToken: string | null = null;
      try {
        const parsed = JSON.parse(storedSessionRaw);
        storedRefreshToken = parsed?.refresh_token ?? null;
      } catch (parseError) {
        console.warn(`⚠️ [AUTH] ${label} storage parse error`, parseError);
        await logAuthHydrationStep('hydrate_storage_parse_error', null, {
          label,
          error: (parseError as any)?.message || 'unknown_error',
        });
      }

      if (!storedRefreshToken) {
        await logAuthHydrationStep('hydrate_refresh_skipped_no_refresh', null, { label });
        return null;
      }

      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error) {
        console.warn(`⚠️ [AUTH] ${label} refreshSession error`, refreshed.error);
        await logAuthHydrationStep('hydrate_refresh_error', null, {
          label,
          error: refreshed.error.message || 'unknown_error',
        });
        return null;
      }

      if (refreshed.data.session) {
        setSession(refreshed.data.session);
        setUser(isPasswordRecoveryRef.current ? null : refreshed.data.session.user ?? null);
        setCachedAuthSession(refreshed.data.session, 'HYDRATE');
        await logAuthHydrationStep('hydrate_refresh_found', refreshed.data.session, { label });
        return refreshed.data.session;
      }
    } catch (error) {
      console.warn(`⚠️ [AUTH] ${label} hydration exception`, error);
      await logAuthHydrationStep('hydrate_exception', null, { label });
    }
    return null;
  };

  const syncSessionFromSupabase = async (label: string) => {
    await logAuthHydrationStep('sync_start', null, { label });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn(`⚠️ [AUTH] ${label} getSession error`, error);
          await logAuthHydrationStep('sync_get_session_error', null, {
            label,
            attempt,
            error: error.message || 'unknown_error',
          });
        }
        if (data.session?.access_token) {
          setSession(data.session);
          setUser(isPasswordRecoveryRef.current ? null : data.session.user ?? null);
          setCachedAuthSession(data.session, 'SYNC');
          await logAuthHydrationStep('sync_success', data.session, { label, attempt });
          return data.session;
        }
      } catch (error) {
        console.warn(`⚠️ [AUTH] ${label} getSession exception`, error);
        await logAuthHydrationStep('sync_get_session_exception', null, {
          label,
          attempt,
        });
      }

      if (attempt < 2) {
        await wait(250);
      }
    }

    console.warn(`⚠️ [AUTH] ${label} unable to sync session tokens`);
    await logAuthHydrationStep('sync_failed', null, { label });
    return null;
  };

  const startOAuthFlow = async (provider: 'google') => {
    if (oauthInFlightRef.current) {
      return { error: { message: 'OAuth already in progress' } };
    }

    oauthInFlightRef.current = true;
    await logAuthHydrationStep('oauth_start', null, { provider });

    const redirectUrl = AuthSession.makeRedirectUri({
      scheme: 'wonofone',
      path: 'auth',
    });

    try {
      await logOAuthCodeVerifier('before signInWithOAuth');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        await logAuthHydrationStep('oauth_url_error', null, {
          provider,
          error: error.message || 'unknown_error',
        });
        return { error };
      }

      if (!data?.url) {
        await logAuthHydrationStep('oauth_url_missing', null, { provider });
        return { error: { message: 'No OAuth URL returned' } };
      }

      try {
        const authUrl = new URL(data.url);
        const redirectTo = authUrl.searchParams.get('redirect_to');
        const challengeMethod = authUrl.searchParams.get('code_challenge_method');
        console.log('🔐 [OAUTH] auth URL ready', {
          redirectTo,
          challengeMethod,
          host: authUrl.host,
        });
      } catch (parseError) {
        console.warn('⚠️ [OAUTH] Failed to parse auth URL', parseError);
      }

      await logOAuthCodeVerifier('after signInWithOAuth');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type !== 'success' || !result.url) {
        await logAuthHydrationStep('oauth_cancelled', null, { provider, result_type: result.type });
        return { error: { message: 'OAuth flow was cancelled' } };
      }

      try {
        const resultUrl = new URL(result.url);
        if (resultUrl.searchParams.has('code')) {
          resultUrl.searchParams.set('code', 'REDACTED');
        }
        if (resultUrl.searchParams.has('state')) {
          resultUrl.searchParams.set('state', 'REDACTED');
        }
        console.log('🔐 [OAUTH] result URL', resultUrl.toString());
      } catch (parseError) {
        console.warn('⚠️ [OAUTH] Failed to parse result URL', parseError);
      }

      const [baseUrl, fragment] = result.url.split('#');
      const parsedUrl = fragment
        ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${fragment}`
        : baseUrl;
      const parsed = Linking.parse(parsedUrl);
      const params = parsed.queryParams ?? {};
      const rawCode = params.code as string | undefined;
      const code = rawCode ? rawCode.replace(/[#?]+$/, '') : undefined;
      const authError = params.error as string | undefined;
      const state = params.state as string | undefined;

      if (code) {
        console.log('🔐 [OAUTH] code received', {
          length: code.length,
          prefix: code.slice(0, 8),
          suffix: code.slice(-3),
          hasState: !!state,
          paramKeys: Object.keys(params),
        });
      }

      if (authError) {
        await logAuthHydrationStep('oauth_error', null, { provider, error: authError });
        return { error: { message: params.error_description || authError } };
      }

      if (!code) {
        await logAuthHydrationStep('oauth_code_missing', null, { provider });
        return { error: { message: 'No OAuth code returned' } };
      }

      await logAuthHydrationStep('oauth_code_received', null, {
        provider,
        code_length: code.length,
        has_state: !!state,
      });

      await logOAuthCodeVerifier('before exchangeCodeForSession');
      const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        await logAuthHydrationStep('oauth_exchange_error', null, {
          provider,
          error: exchangeError.message || 'unknown_error',
        });
        return { error: exchangeError };
      }

      if (exchangeData?.session) {
        await logAuthHydrationStep('oauth_exchange_success', exchangeData.session, { provider });
        const persistedSession = await persistAuthSession(exchangeData.session, 'oauth');
        setSession(persistedSession);
        setUser(persistedSession.user ?? null);
        await syncSessionFromSupabase('oauth_post_exchange');
        setLoading(false);
      }

      return { error: null };
    } finally {
      oauthInFlightRef.current = false;
    }
  };

  // Load user name from database first, then AsyncStorage, then fallback
  const loadUserName = async () => {
    try {
      if (!user?.id) {
        setUserNameState('');
        return;
      }

      const cachedName =
        (await AsyncStorage.getItem(userNameStorageKey(user.id))) ||
        (await AsyncStorage.getItem('user_name'));
      const hasCachedName = !!cachedName && cachedName !== 'Guest User';
      if (hasCachedName) {
        setUserNameState(cachedName);
      }

      // First, try to load from database (retry briefly to allow profile creation to finish)
      let dbUser = await userService.getUserById(user.id);
      if (!dbUser) {
        await wait(300);
        dbUser = await userService.getUserById(user.id);
      }
      if (dbUser?.name) {
        console.log('✅ Loaded name from database:', dbUser.name);
        setUserNameState(dbUser.name);
        // Also save to AsyncStorage for offline access
        await AsyncStorage.setItem(userNameStorageKey(user.id), dbUser.name);
        await AsyncStorage.setItem('user_name', dbUser.name);
        return;
      }

      const metadataName = getMetadataName(user);
      const provider = user?.app_metadata?.provider;
      const providers = Array.isArray(user?.app_metadata?.providers)
        ? user?.app_metadata?.providers
        : [];
      const allowEmailFallback = provider === 'email' || providers.includes('email');
      const emailPrefix = user?.email ? user.email.split('@')[0] : '';
      const fallbackName = metadataName || (allowEmailFallback ? emailPrefix : '');

      if (dbUser && !dbUser.name && fallbackName) {
        try {
          const updatedUser = await userService.updateUser(user.id, { name: fallbackName });
          if (updatedUser?.name) {
            console.log('✅ Backfilled missing name in database:', updatedUser.name);
            setUserNameState(updatedUser.name);
            await AsyncStorage.setItem(userNameStorageKey(user.id), updatedUser.name);
            await AsyncStorage.setItem('user_name', updatedUser.name);
            return;
          }
        } catch (error) {
          console.warn('⚠️ Failed to backfill missing name:', error);
        }
      }

      if (!dbUser && fallbackName) {
        try {
          const nameParts = fallbackName.trim().split(' ').filter(Boolean);
          const first = nameParts[0] || fallbackName;
          const last = nameParts.slice(1).join(' ');
          const createdUser = await userService.createUser(user.id, user.email, first, last);
          if (createdUser?.name) {
            console.log('✅ Created missing user profile:', createdUser.name);
            setUserNameState(createdUser.name);
            await AsyncStorage.setItem(userNameStorageKey(user.id), createdUser.name);
            await AsyncStorage.setItem('user_name', createdUser.name);
            return;
          }
        } catch (error) {
          console.warn('⚠️ Failed to create missing user profile:', error);
        }
      }

      if (metadataName) {
        console.log('✅ Loaded name from auth metadata:', metadataName);
        setUserNameState(metadataName);
        await AsyncStorage.setItem(userNameStorageKey(user.id), metadataName);
        await AsyncStorage.setItem('user_name', metadataName);
        return;
      }

      if (hasCachedName) {
        return;
      }

      if (allowEmailFallback && user?.email) {
        console.log('⚠️ Using email prefix as name:', emailPrefix);
        setUserNameState(emailPrefix);
      } else {
        setUserNameState('User');
      }
    } catch (error) {
      console.error('Error loading user name:', error);
      const cachedName =
        (await AsyncStorage.getItem(userNameStorageKey(user?.id))) ||
        (await AsyncStorage.getItem('user_name'));
      const hasCachedName = !!cachedName && cachedName !== 'Guest User';
      if (hasCachedName) {
        setUserNameState(cachedName);
        return;
      }
      // Fallback to AsyncStorage or email prefix
      try {
        const savedName =
          (await AsyncStorage.getItem(userNameStorageKey(user?.id))) ||
          (await AsyncStorage.getItem('user_name'));
        if (savedName && savedName !== 'Guest User') {
          setUserNameState(savedName);
        } else if (user?.email && (user?.app_metadata?.provider === 'email' || !user?.app_metadata?.provider)) {
          setUserNameState(user.email.split('@')[0]);
        } else {
          setUserNameState('User');
        }
      } catch (e) {
        if (user?.app_metadata?.provider && user?.app_metadata?.provider !== 'email') {
          setUserNameState('User');
        } else {
          setUserNameState(user?.email?.split('@')[0] || 'User');
        }
      }
    }
  };

  // Save user name to AsyncStorage
  const setUserName = async (name: string) => {
    try {
      setUserNameState(name);
      await AsyncStorage.setItem(userNameStorageKey(user?.id), name);
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
    const AUTH_BOOT_TIMEOUT_MS = 8000;
    let bootTimedOut = false;
    const bootTimeoutId = setTimeout(() => {
      if (bootTimedOut) return;
      bootTimedOut = true;
      console.warn('⚠️ [AUTH] Initial session check timed out; continuing without session');
      setLoading(false);
    }, AUTH_BOOT_TIMEOUT_MS);

    const markBootComplete = () => {
      if (bootTimedOut) return;
      bootTimedOut = true;
      clearTimeout(bootTimeoutId);
      setLoading(false);
    };

    // Get initial session with enhanced error handling
    const getInitialSession = async () => {
      console.log('🔍 [AUTH] Checking for existing session on app start...');
      setIsPasswordRecovery(false);
      
      try {
        // Check AsyncStorage directly for debugging
        try {
          const storedSession = await AsyncStorage.getItem(getSupabaseStorageKey());
          if (storedSession) {
            console.log('✅ [AUTH] AsyncStorage session found:', storedSession.substring(0, 50) + '...');
            await logAuthHydrationStep('boot_storage_checked', null, {
              storage_has_session: true,
              storage_len: storedSession.length,
            });
          } else {
            console.log('⚠️ [AUTH] AsyncStorage session NOT found - user will need to login');
            await logAuthHydrationStep('boot_storage_checked', null, {
              storage_has_session: false,
              storage_len: 0,
            });
          }
        } catch (error) {
          console.log('❌ [AUTH] AsyncStorage error:', error);
          await logAuthHydrationStep('boot_storage_error', null, { error: (error as any)?.message || 'unknown_error' });
        }
        
        // Get session from Supabase (this will auto-refresh if needed)
        // This is the authoritative source - it reads from AsyncStorage if persistSession is true
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [AUTH] Error getting session from Supabase:', error);
          console.error('❌ [AUTH] Error details:', JSON.stringify(error, null, 2));
          await logAuthHydrationStep('boot_get_session_error', null, {
            error: error.message || 'unknown_error',
          });
          // If session retrieval fails, clear any stale data
          setSession(null);
          setUser(null);
          setCachedAuthSession(null, 'BOOT_ERROR');
          markBootComplete();
          return;
        }
        
        if (!session) {
          console.log('⚠️ [AUTH] No session found - user needs to login');
          await logAuthHydrationStep('boot_no_session');
          setSession(null);
          setUser(null);
          setCachedAuthSession(null, 'BOOT_NO_SESSION');
          markBootComplete();
          return;
        }
        
        console.log('✅ [AUTH] Session found!', { 
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
          refreshToken: session?.refresh_token ? 'Present' : 'Missing'
        });
        await logAuthHydrationStep('boot_session_found', session);
        
        // Check if session is expired
        if (session && session.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000);
          const now = new Date();
          if (now >= expiresAt) {
            console.log('⚠️ [AUTH] Access token expired, will attempt refresh on next API call');
          } else {
            const timeUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60);
            console.log(`✅ [AUTH] Access token valid for ${timeUntilExpiry} more minutes`);
          }
        }
        
        // Check refresh token
        if (!session.refresh_token) {
          console.warn('⚠️ [AUTH] No refresh token in session - session may not persist');
        } else {
          console.log('✅ [AUTH] Refresh token present - session will persist');
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setCachedAuthSession(session, 'BOOTSTRAP');
        markBootComplete();
      } catch (error) {
        console.error('❌ [AUTH] Unexpected error getting session:', error);
        setSession(null);
        setUser(null);
        markBootComplete();
      }
    };

    getInitialSession();

    // Listen for auth changes with enhanced error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.id || 'no user');
        lastAuthEventRef.current = event;
        setCachedAuthSession(session ?? null, event);
        await logAuthHydrationStep('auth_state_change', session, { event });
        
        if (event === 'PASSWORD_RECOVERY') {
          console.log('🔐 Password recovery event detected - limiting access until reset completes');
          setIsPasswordRecovery(true);
          setSession(session);
          setUser(null);
          markBootComplete();
          try {
            router.replace('/reset-password');
          } catch (error) {
            console.warn('⚠️ Unable to navigate to reset-password:', error);
          }
          return;
        }
        
        // Handle token refresh events (only care during normal auth)
        if (event === 'TOKEN_REFRESHED' && !isPasswordRecoveryRef.current) {
          console.log('✅ Token refreshed successfully');
          try {
            const { analytics } = await import('@/lib/analytics');
            analytics.capture('token_refresh_success');
          } catch (error) {
            // Analytics not critical, continue
          }
        }
        
        // Handle token refresh errors (when user is signed out unexpectedly)
        if (event === 'SIGNED_OUT' && !session) {
          console.log('⚠️ User signed out - possible token refresh failure or manual logout');
          try {
            const { analytics } = await import('@/lib/analytics');
            analytics.capture('user_signed_out', { reason: 'token_expired_or_manual' });
          } catch (error) {
            // Analytics not critical, continue
          }
        }
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setCachedAuthSession(null, event);
          markBootComplete();
          setIsPasswordRecovery(false);
          
          try {
            const { subscriptionService } = await import('@/lib/subscriptionService');
            await subscriptionService.logOut();
          } catch (error) {
            console.error('❌ Error logging out RevenueCat user:', error);
          }
          return;
        }

        // During recovery, keep the user null so the app never treats this as a full login
        setSession(session);
        setUser(isPasswordRecoveryRef.current ? null : session?.user ?? null);
        setCachedAuthSession(session ?? null, event);
        markBootComplete();

        if (
          !isPasswordRecoveryRef.current &&
          session &&
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
          !sessionPersistInFlightRef.current
        ) {
          sessionPersistInFlightRef.current = true;
          try {
            const persistedSession = await persistAuthSession(
              session,
              `auth_state_${event.toLowerCase()}`
            );
            setSession(persistedSession);
            setUser(isPasswordRecoveryRef.current ? null : persistedSession.user ?? null);
            setCachedAuthSession(persistedSession, event);
          } finally {
            sessionPersistInFlightRef.current = false;
          }
        }

        if (isPasswordRecoveryRef.current) {
          return;
        }

        // Link RevenueCat user when user logs in
        if (session?.user?.id) {
          try {
            const { subscriptionService } = await import('@/lib/subscriptionService');
            await subscriptionService.linkUser(session.user.id);
          } catch (error) {
            console.error('❌ Error linking RevenueCat user:', error);
          }

          // Create user in app_user table if needed (for OAuth sign-ups)
          // Only create on SIGNED_IN event (not on TOKEN_REFRESHED or other events)
          if (event === 'SIGNED_IN') {
            // Check if this is an OAuth provider (Google, Apple, etc.)
            const provider = session.user.app_metadata?.provider;
            const isOAuthProvider = provider && provider !== 'email';
            const isAppleProvider = provider === 'apple';
            const isGoogleProvider = provider === 'google';
            
            if (isOAuthProvider) {
              try {
                const existingUser = await userService.getUserById(session.user.id);
                
                if (!existingUser) {
                  console.log('🔍 New OAuth user detected, creating user in database...');
                  const email = session.user.email || '';
                  
                  // Try to extract name from user metadata (Google provides full_name, Apple provides givenName/familyName)
                  const fullName = session.user.user_metadata?.full_name || 
                                 session.user.user_metadata?.name ||
                                 session.user.user_metadata?.display_name ||
                                 '';
                  
                  let firstName = '';
                  let lastName = '';
                  
                  if (fullName) {
                    const nameParts = fullName.trim().split(' ');
                    firstName = nameParts[0] || '';
                    lastName = nameParts.slice(1).join(' ') || '';
                  }
                  
                  // If we have both first and last name, create user
                  if (firstName && lastName) {
                    const createdUser = await userService.createUser(
                      session.user.id,
                      email,
                      firstName,
                      lastName
                    );
                    if (createdUser?.name) {
                      await setUserName(createdUser.name);
                      console.log('✅ New OAuth user created in database:', createdUser.name);
                    }
                  } else if (email && !isAppleProvider && !isGoogleProvider) {
                    // Fallback: use email prefix as name (non-Apple providers only)
                    const emailPrefix = email.split('@')[0] || 'User';
                    const createdUser = await userService.createUser(
                      session.user.id,
                      email,
                      emailPrefix,
                      ''
                    );
                    if (createdUser?.name) {
                      await setUserName(createdUser.name);
                      console.log('✅ New OAuth user created with email prefix:', createdUser.name);
                    }
                  } else if (isAppleProvider || isGoogleProvider) {
                    const createdUser = await userService.createUser(
                      session.user.id,
                      email,
                      undefined,
                      undefined,
                      { fallbackEmailForName: null }
                    );
                    if (createdUser?.name) {
                      await setUserName(createdUser.name);
                    }
                    console.log('✅ New Apple OAuth user created without name');
                  } else {
                    console.warn('⚠️ OAuth user has no email or name, cannot create user record');
                  }
                } else {
                  // User exists, sync name from database
                  if (existingUser.name) {
                    await setUserName(existingUser.name);
                    console.log('✅ OAuth user name synced from database:', existingUser.name);
                  }
                }
              } catch (error) {
                console.error('❌ Error creating OAuth user in database:', error);
                // Don't block the sign-in process if user creation fails
              }
            }
          } else if (session.user.id) {
            // For existing users on other events (like TOKEN_REFRESHED), just sync name
            try {
              const existingUser = await userService.getUserById(session.user.id);
              if (existingUser?.name) {
                await setUserName(existingUser.name);
              }
            } catch (error) {
              // Silent fail for name sync on non-sign-in events
            }
          }
        } else {
          // Log out RevenueCat when user logs out
          try {
            const { subscriptionService } = await import('@/lib/subscriptionService');
            await subscriptionService.logOut();
          } catch (error) {
            console.error('❌ Error logging out RevenueCat user:', error);
          }
        }
      }
    );

    return () => {
      clearTimeout(bootTimeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Load user name and profile image when user changes
  useEffect(() => {
    if (user) {
      loadUserName();
      loadProfileImage();
    } else {
      setUserNameState('');
      setProfileImageState(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id || session?.access_token || isPasswordRecoveryRef.current) {
      return;
    }

    if (lastAuthEventRef.current === 'SIGNED_OUT') {
      return;
    }

    let cancelled = false;
    const attemptHydration = async () => {
      const hydrated = await hydrateAuthSession('post_sign_in');
      if (!hydrated && !cancelled) {
        console.warn('⚠️ [AUTH] Session still missing after hydration attempt');
      }
    };

    attemptHydration();

    return () => {
      cancelled = true;
    };
  }, [user?.id, session?.access_token]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // If signin successful, ensure user exists in app_user table
    if (data.user && !error) {
      console.log('✅ Auth signin successful, user ID:', data.user.id);
      console.log('🔍 Checking if user exists in app_user table...');
      const existingUser = await userService.getUserById(data.user.id);
      
      if (!existingUser) {
        console.log('⚠️ User not found in app_user table');
        // Try to get display_name from auth metadata as fallback
        const metadata = data.user.user_metadata || {};
        const metadataName =
          metadata.display_name ||
          metadata.full_name ||
          metadata.name ||
          [metadata.given_name, metadata.family_name]
            .filter(Boolean)
            .join(' ');
        let first = '';
        let last = '';

        if (metadataName) {
          const nameParts = metadataName.trim().split(' ').filter(Boolean);
          first = nameParts[0] || '';
          last = nameParts.slice(1).join(' ') || '';
        }

        if (!first && email) {
          first = email.split('@')[0] || 'User';
        }

        if (!first) {
          first = 'User';
        }

        console.log('✅ Creating user from fallback data:', { first, last });
        const createdUser = await userService.createUser(data.user.id, email, first, last);
        if (createdUser?.name) {
          await setUserName(createdUser.name);
          console.log('✅ New user created from fallback and synced to AsyncStorage:', createdUser.name);
        } else {
          console.warn('⚠️ User created without a name');
        }
      } else {
        // User exists, sync name from database to AsyncStorage
        console.log('✅ User found in database:', {
          userId: existingUser.user_id,
          name: existingUser.name,
          hasSpace: existingUser.name?.includes(' '),
          isCapitalized: existingUser.name !== existingUser.name?.toLowerCase()
        });
        
        if (existingUser.name) {
          await setUserName(existingUser.name);
          console.log('✅ User name synced from database to AsyncStorage:', existingUser.name);
        } else {
          console.warn('⚠️ User exists in database but name is missing');
        }
      }
    } else {
      console.error('❌ Auth signin failed:', error);
    }
    
    return { error };
  };

  // Sign up function
  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    console.log('🔍 signUp called with:', { email, firstName, lastName });
    
    // Require both firstName and lastName for signup
    if (!firstName || !lastName || !firstName.trim() || !lastName.trim()) {
      console.error('❌ signUp requires both firstName and lastName');
      return { error: { message: 'First name and last name are required' } };
    }
    
    // Helper function to capitalize first letter of each word (same as in createUser)
    const capitalizeName = (name: string): string => {
      if (!name || name.trim() === '') return '';
      return name
        .trim()
        .toLowerCase()
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };
    
    // Process names - both are guaranteed to exist at this point
    const first = firstName.trim();
    const last = lastName.trim();
    const fullName = `${capitalizeName(first)} ${capitalizeName(last)}`.trim();
    
    console.log('🔍 Calculated display name:', fullName);
    
    // Sign up with user_metadata to set display_name in Supabase Auth
    const emailRedirectTo = Linking.createURL('/login', {
      queryParams: { verification: 'success' },
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          display_name: fullName,
        },
      },
    });
    
    // If signup successful, create user in app_user table
    if (data.user && !error) {
      console.log('✅ Auth signup successful, user ID:', data.user.id);
      console.log('🔍 Processed names:', { 
        originalFirst: firstName, 
        originalLast: lastName,
        processedFirst: first, 
        processedLast: last,
        fullName
      });
      
      const createdUser = await userService.createUser(data.user.id, email, first, last);
      
      // If user was created successfully, save name to AsyncStorage and load it
      if (createdUser?.name) {
        console.log('✅ User created in database with name:', createdUser.name);
        await setUserName(createdUser.name);
        console.log('✅ User name synced to AsyncStorage after signup:', createdUser.name);
        console.log('📊 Final verification:', {
          databaseName: createdUser.name,
          asyncStorageWillHave: createdUser.name,
          authDisplayName: data.user.user_metadata?.display_name,
          hasSpace: createdUser.name.includes(' '),
          isCapitalized: createdUser.name !== createdUser.name.toLowerCase()
        });
      } else {
        console.error('❌ User created but name is missing:', createdUser);
      }
    } else {
      console.error('❌ Auth signup failed:', error);
    }
    
    return { error };
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      console.log('🔵 Starting Google sign in...');
      const { error } = await startOAuthFlow('google');

      if (error) {
        console.error('❌ Google sign in error:', error);
        return { error };
      }

      console.log('✅ Google OAuth initiated, redirecting...');
      // The OAuth flow will redirect back to the app
      // The auth state change listener will handle the session
      return { error: null };
    } catch (error: any) {
      console.error('❌ Google sign in exception:', error);
      return { error };
    }
  };

  // Sign in with Apple
  const signInWithApple = async () => {
    try {
      if (Platform.OS !== 'ios') {
        return { error: { message: 'Apple Sign In is only available on iOS' } };
      }

      console.log('🍎 Starting Apple sign in...');
      await logAuthHydrationStep('apple_sign_in_start', null, { provider: 'apple' });
      
      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { error: { message: 'Apple Sign In is not available on this device' } };
      }

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('✅ Apple credential received:', {
        user: credential.user,
        hasEmail: !!credential.email,
        hasFullName: !!(credential.fullName?.givenName || credential.fullName?.familyName),
      });
      await logAuthHydrationStep('apple_credential_received', null, {
        provider: 'apple',
        has_email: !!credential.email,
        has_full_name: !!(credential.fullName?.givenName || credential.fullName?.familyName),
      });

      // Sign in with Supabase using the Apple credential
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (error) {
        console.error('❌ Apple sign in error:', error);
        await logAuthHydrationStep('apple_sign_in_error', null, {
          provider: 'apple',
          error: error.message || 'unknown_error',
        });
        return { error };
      }

      console.log('✅ Apple sign in successful, user ID:', data.user?.id);
      if (data.session) {
        await logAuthHydrationStep('apple_session_received', data.session, { provider: 'apple' });
        const persistedSession = await persistAuthSession(data.session, 'apple');
        setSession(persistedSession);
        setUser(persistedSession.user ?? null);
        setCachedAuthSession(persistedSession, 'SIGNED_IN');
        await syncSessionFromSupabase('apple_post_sign_in');
      }
      if (data.user) {
        await updateAppleMetadata(credential, data.user);
      }

      // Create user in app_user table if needed
      if (data.user && !error) {
        const existingUser = await userService.getUserById(data.user.id);
        
        if (!existingUser) {
          // Extract name from Apple credential or user metadata
          const firstName = credential.fullName?.givenName || 
                           data.user.user_metadata?.full_name?.split(' ')[0] || 
                           '';
          const lastName = credential.fullName?.familyName || 
                          data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 
                          '';
          const email = credential.email || data.user.email || '';
          
          console.log('🔍 Extracted user info:', { firstName, lastName, email });
          
          if (firstName && lastName) {
            const createdUser = await userService.createUser(data.user.id, email, firstName, lastName);
            if (createdUser?.name) {
              await setUserName(createdUser.name);
              console.log('✅ New user created from Apple sign in:', createdUser.name);
            }
          } else {
            const createdUser = await userService.createUser(
              data.user.id,
              email,
              undefined,
              undefined,
              { fallbackEmailForName: null }
            );
            if (createdUser?.name) {
              await setUserName(createdUser.name);
            }
            console.log('✅ New Apple user created without name');
          }
        } else {
          // User exists, sync name from database
          if (existingUser.name) {
            await setUserName(existingUser.name);
            console.log('✅ User name synced from database:', existingUser.name);
          }
        }
      }

      return { error: null };
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('⚠️ Apple sign in was canceled by user');
        return { error: { message: 'Sign in was canceled' } };
      }
      console.error('❌ Apple sign in exception:', error);
      return { error };
    }
  };

  // Sign up with Google
  const signUpWithGoogle = async () => {
    try {
      console.log('🔵 Starting Google sign up...');
      const { error } = await startOAuthFlow('google');

      if (error) {
        console.error('❌ Google sign up error:', error);
        return { error };
      }

      console.log('✅ Google OAuth initiated for sign up, redirecting...');
      // The OAuth flow will redirect back to the app
      // The auth state change listener will handle the session and user creation
      return { error: null };
    } catch (error: any) {
      console.error('❌ Google sign up exception:', error);
      return { error };
    }
  };

  // Sign up with Apple
  const signUpWithApple = async () => {
    try {
      if (Platform.OS !== 'ios') {
        return { error: { message: 'Apple Sign In is only available on iOS' } };
      }

      console.log('🍎 Starting Apple sign up...');
      await logAuthHydrationStep('apple_sign_up_start', null, { provider: 'apple' });
      
      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { error: { message: 'Apple Sign In is not available on this device' } };
      }

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('✅ Apple credential received for sign up:', {
        user: credential.user,
        hasEmail: !!credential.email,
        hasFullName: !!(credential.fullName?.givenName || credential.fullName?.familyName),
      });
      await logAuthHydrationStep('apple_sign_up_credential_received', null, {
        provider: 'apple',
        has_email: !!credential.email,
        has_full_name: !!(credential.fullName?.givenName || credential.fullName?.familyName),
      });

      // Sign in with Supabase using the Apple credential
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (error) {
        console.error('❌ Apple sign up error:', error);
        await logAuthHydrationStep('apple_sign_up_error', null, {
          provider: 'apple',
          error: error.message || 'unknown_error',
        });
        return { error };
      }

      console.log('✅ Apple sign up successful, user ID:', data.user?.id);
      if (data.session) {
        await logAuthHydrationStep('apple_sign_up_session_received', data.session, { provider: 'apple' });
        const persistedSession = await persistAuthSession(data.session, 'apple_sign_up');
        setSession(persistedSession);
        setUser(persistedSession.user ?? null);
        setCachedAuthSession(persistedSession, 'SIGNED_IN');
        await syncSessionFromSupabase('apple_post_sign_up');
      }
      if (data.user) {
        await updateAppleMetadata(credential, data.user);
      }

      // Create user in app_user table if needed
      if (data.user && !error) {
        const existingUser = await userService.getUserById(data.user.id);
        
        if (!existingUser) {
          // Extract name from Apple credential or user metadata
          const firstName = credential.fullName?.givenName || 
                           data.user.user_metadata?.full_name?.split(' ')[0] || 
                           '';
          const lastName = credential.fullName?.familyName || 
                          data.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 
                          '';
          const email = credential.email || data.user.email || '';
          
          console.log('🔍 Extracted user info for sign up:', { firstName, lastName, email });
          
          if (firstName && lastName) {
            const createdUser = await userService.createUser(data.user.id, email, firstName, lastName);
            if (createdUser?.name) {
              await setUserName(createdUser.name);
              console.log('✅ New user created from Apple sign up:', createdUser.name);
            }
          } else {
            const createdUser = await userService.createUser(
              data.user.id,
              email,
              undefined,
              undefined,
              { fallbackEmailForName: null }
            );
            if (createdUser?.name) {
              await setUserName(createdUser.name);
            }
            console.log('✅ New Apple user created without name (sign up)');
          }
        } else {
          // User exists, sync name from database
          if (existingUser.name) {
            await setUserName(existingUser.name);
            console.log('✅ User name synced from database:', existingUser.name);
          }
        }
      }

      return { error: null };
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('⚠️ Apple sign up was canceled by user');
        return { error: { message: 'Sign up was canceled' } };
      }
      console.error('❌ Apple sign up exception:', error);
      return { error };
    }
  };

  // Sign out function
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    authReady,
    isPasswordRecovery,
    userName,
    setUserName,
    loadUserName,
    profileImage,
    setProfileImage,
    loadProfileImage,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signUpWithGoogle,
    signUpWithApple,
    signOut,
    setIsPasswordRecovery,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

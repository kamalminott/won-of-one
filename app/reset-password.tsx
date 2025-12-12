import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { setIsPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSessionSet, setIsSessionSet] = useState(false);
  const processedTokenRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      analytics.screen('ResetPassword');
    }, [])
  );

  const extractTokensFromUrl = useCallback((url?: string | null) => {
    if (!url) {
      return { accessToken: undefined, refreshToken: undefined, type: undefined };
    }

    const parsedUrl = url.includes('#') ? url.replace('#', '?') : url;
    const parsed = Linking.parse(parsedUrl);
    const queryParams = parsed.queryParams || {};

    return {
      accessToken: queryParams.access_token as string | undefined,
      refreshToken: queryParams.refresh_token as string | undefined,
      code: queryParams.code as string | undefined,
      type: queryParams.type as string | undefined,
    };
  }, []);

  const handleRecoveryTokens = useCallback(
    async (accessToken?: string, refreshToken?: string, type?: string, code?: string) => {
      const hasTokenPair = !!accessToken && !!refreshToken;
      const hasCode = !!code;

      if (!hasTokenPair && !hasCode) {
        return false;
      }

      // Only handle password recovery links so we don't treat other auth flows as a login
      if (type && type !== 'recovery') {
        return false;
      }

      const tokenKey = hasTokenPair ? `${accessToken}:${refreshToken}` : `code:${code}`;
      if (processedTokenRef.current === tokenKey) {
        return true;
      }

      processedTokenRef.current = tokenKey;

      try {
        setIsPasswordRecovery(true);
      } catch (error) {
        console.warn('⚠️ Unable to set password recovery flag:', error);
      }

      try {
        if (hasTokenPair) {
          console.log('🔑 Setting session from password reset link (access/refresh)...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken as string,
          });

          if (error) {
            throw error;
          }
        } else if (hasCode) {
          console.log('🔑 Exchanging PKCE code for session (password recovery)...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code as string);
          if (error) {
            throw error;
          }
          if (!data.session) {
            throw new Error('No session returned from code exchange');
          }
        }
      } catch (error: any) {
        console.error('❌ Error setting recovery session:', error);
        setErrorMessage('Invalid or expired reset link. Please request a new one.');
        analytics.capture('password_reset_token_error', { message: error?.message || 'unknown_error' });
        return false;
      }

      console.log('✅ Recovery session set successfully');
      setIsSessionSet(true);
      setErrorMessage(null);
      return true;
    },
    [setIsPasswordRecovery]
  );

  // Handle deep link with tokens from Supabase (including cold starts)
  useEffect(() => {
    const handleDeepLink = async () => {
      try {
        const accessToken = params.access_token as string | undefined;
        const refreshToken = params.refresh_token as string | undefined;
        const type = params.type as string | undefined;
        const code = params.code as string | undefined;

        let processed = await handleRecoveryTokens(accessToken, refreshToken, type, code);

        // Cold starts sometimes don't populate params, so also check the initial URL
        if (!processed) {
          const initialUrl = await Linking.getInitialURL();
          const tokens = extractTokensFromUrl(initialUrl);
          processed = await handleRecoveryTokens(tokens.accessToken, tokens.refreshToken, tokens.type, tokens.code);
        }

        if (!processed) {
          // Check if we already have a session (user might have navigated here directly)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setIsSessionSet(true);
          } else {
            setErrorMessage('No valid reset token found. Please request a new password reset link.');
          }
        }
      } catch (err: any) {
        console.error('❌ Error handling deep link:', err);
        setErrorMessage('An error occurred. Please try again.');
      }
    };

    handleDeepLink();
  }, [params, extractTokensFromUrl, handleRecoveryTokens]);

  // Listen for deep links when app is already open
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async (event) => {
      const tokens = extractTokensFromUrl(event.url);
      await handleRecoveryTokens(tokens.accessToken, tokens.refreshToken, tokens.type, tokens.code);
    });

    return () => {
      subscription.remove();
    };
  }, [extractTokensFromUrl, handleRecoveryTokens]);

  const handleBack = () => {
    router.push('/login');
  };

  const validatePassword = (value: string) => {
    if (!value || value.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return null;
  };

  const handleResetPassword = async () => {
    // Clear previous errors
    setErrorMessage(null);

    // Validate passwords
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    // Check if session is set
    if (!isSessionSet) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMessage('Session expired. Please request a new password reset link.');
        return;
      }
      setIsSessionSet(true);
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        console.error('❌ Error updating password:', error);
        setErrorMessage(error.message || 'Failed to update password. Please try again.');
        analytics.capture('password_reset_error', { message: error.message });
      } else {
        console.log('✅ Password updated successfully');
        analytics.capture('password_reset_success');
        Alert.alert(
          'Success',
          'Your password has been reset successfully. Please sign in with your new password.',
          [
            {
              text: 'OK',
              onPress: async () => {
                // Sign out to clear the temporary session
                await supabase.auth.signOut();
                setIsPasswordRecovery(false);
                router.replace('/login');
              },
            },
          ]
        );
      }
    } catch (err: any) {
      console.error('❌ Unexpected error resetting password:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      analytics.capture('password_reset_error', { message: err?.message || 'unexpected_error' });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !password.trim() || !confirmPassword.trim() || loading || !isSessionSet;

  return (
    <SafeAreaView style={[styles.container, { 
      paddingTop: insets.top, 
      paddingBottom: insets.bottom 
    }]}>
      <StatusBar barStyle="light-content" backgroundColor="#212121" />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            flexGrow: 1,
            paddingBottom: insets.bottom + height * 0.02
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Background */}
          <View style={[styles.headerBackground, {
            height: height * 0.07,
            paddingHorizontal: width * 0.04
          }]}>
            {/* Back Button */}
            <BackButton onPress={handleBack} />
            
            {/* Title */}
            <Text style={[styles.headerTitle, { fontSize: width * 0.05 }]}>Reset Password</Text>
          </View>

          {/* Main Content Card */}
          <View style={[styles.contentCard, {
            marginHorizontal: width * 0.04,
            marginTop: height * 0.06,
            padding: width * 0.04,
            borderRadius: width * 0.05
          }]}>
            {/* Lock Illustration Circle */}
            <View style={[styles.lockIllustration, {
              width: width * 0.32,
              height: width * 0.32,
              borderRadius: width * 0.16,
              marginBottom: height * 0.04
            }]}>
              <LinearGradient
                colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.illustrationGradient, {
                  borderRadius: width * 0.16
                }]}
              >
                <Ionicons name="lock-closed-outline" size={width * 0.125} color="#FFFFFF" />
              </LinearGradient>
            </View>

            {/* Main Heading */}
            <Text style={[styles.mainHeading, { 
              fontSize: width * 0.05,
              marginBottom: height * 0.02
            }]}>Set New Password</Text>
            
            {/* Description */}
            <Text style={[styles.description, { 
              fontSize: width * 0.035,
              lineHeight: width * 0.06,
              marginBottom: height * 0.06,
              maxWidth: width * 0.785
            }]}>
              Enter your new password below. Make sure it's at least 6 characters long.
            </Text>

            {/* New Password Input */}
            <View style={[styles.inputContainer, { marginBottom: height * 0.04 }]}>
              <Text style={[styles.inputLabel, { 
                fontSize: width * 0.035,
                marginBottom: height * 0.01,
                marginLeft: width * 0.02
              }]}>New Password*</Text>
              <View style={[styles.inputField, {
                borderRadius: width * 0.04,
                paddingHorizontal: width * 0.04,
                height: height * 0.06
              }]}>
                <TextInput
                  style={[styles.textInput, { fontSize: width * 0.04 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#7E7E7E"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.eyeIcon, { marginLeft: width * 0.02 }]}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye" : "eye-off"} 
                    size={width * 0.05} 
                    color="#9D9D9D" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={[styles.inputContainer, { marginBottom: height * 0.06 }]}>
              <Text style={[styles.inputLabel, { 
                fontSize: width * 0.035,
                marginBottom: height * 0.01,
                marginLeft: width * 0.02
              }]}>Confirm Password*</Text>
              <View style={[styles.inputField, {
                borderRadius: width * 0.04,
                paddingHorizontal: width * 0.04,
                height: height * 0.06
              }]}>
                <TextInput
                  style={[styles.textInput, { fontSize: width * 0.04 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#7E7E7E"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.eyeIcon, { marginLeft: width * 0.02 }]}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye" : "eye-off"} 
                    size={width * 0.05} 
                    color="#9D9D9D" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {errorMessage && (
              <Text style={[styles.errorText, { fontSize: width * 0.035, marginBottom: height * 0.02 }]}>
                {errorMessage}
              </Text>
            )}

            {!isSessionSet && (
              <Text style={[styles.warningText, { fontSize: width * 0.035, marginBottom: height * 0.02 }]}>
                Waiting for reset link verification...
              </Text>
            )}

            {/* Reset Password Button */}
            <TouchableOpacity 
              style={[styles.resetButtonContainer, { marginBottom: height * 0.02 }]}
              onPress={handleResetPassword}
              disabled={isSubmitDisabled}
            >
              <LinearGradient
                colors={['#6C5CE7', '#5741FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.resetButton, {
                  height: height * 0.06,
                  borderRadius: width * 0.04,
                  opacity: isSubmitDisabled ? 0.6 : 1
                }]}
              >
                <Text style={[styles.resetButtonText, { fontSize: width * 0.04 }]}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Back to Login Link */}
            <TouchableOpacity style={styles.backToLoginContainer} onPress={handleBack}>
              <Text style={[styles.backToLoginText, { fontSize: width * 0.04 }]}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212121',
  },
  headerBackground: {
    backgroundColor: '#212121',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginRight: 64,
  },
  contentCard: {
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  lockIllustration: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  illustrationGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainHeading: {
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  description: {
    color: '#9D9D9D',
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
  },
  inputLabel: {
    color: '#FFFFFF',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#464646',
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  eyeIcon: {
  },
  resetButtonContainer: {
    width: '100%',
  },
  resetButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  resetButtonText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backToLoginContainer: {
    alignItems: 'center',
  },
  backToLoginText: {
    fontWeight: '700',
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
  },
  warningText: {
    color: '#FFA726',
    textAlign: 'center',
  },
});

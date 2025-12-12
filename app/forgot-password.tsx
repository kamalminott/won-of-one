import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { analytics } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      analytics.screen('ForgotPassword');
    }, [])
  );

  const handleBack = () => {
    router.back();
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    // Basic email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const handleSendReset = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!validateEmail(trimmedEmail)) {
      setErrorMessage('Enter a valid email address');
      setStatusMessage(null);
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const rawRedirect =
        (Constants.expoConfig as any)?.extra?.supabaseRedirectTo ||
        process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_TO;
      const fallbackRedirect = Linking.createURL('/reset-password');
      const redirectTo = (rawRedirect ? rawRedirect.trim() : '') || fallbackRedirect;
      let options: { redirectTo: string } | undefined;
      if (redirectTo) {
        try {
          // Validate URL format to avoid Supabase errors on bad redirect values
          new URL(redirectTo);
          options = { redirectTo };
        } catch (e) {
          console.warn('⚠️ Invalid redirectTo for reset password, ignoring:', redirectTo);
        }
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        options
      );

      if (error) {
        console.error('❌ Error sending reset link:', error);
        setErrorMessage(error.message || 'Unable to send reset link. Please try again.');
        analytics.capture('forgot_password_error', { message: error.message });
      } else {
        setStatusMessage('Reset link sent! Check your email for instructions.');
        analytics.capture('forgot_password_reset_requested');
      }
    } catch (err: any) {
      console.error('❌ Unexpected error sending reset link:', err);
      setErrorMessage('Something went wrong. Please try again.');
      analytics.capture('forgot_password_error', { message: err?.message || 'unexpected_error' });
    } finally {
      setLoading(false);
    }
  };

  const isSendDisabled = !validateEmail(email) || loading;

  return (
    <SafeAreaView style={[styles.container, { 
      paddingTop: insets.top, 
      paddingBottom: insets.bottom 
    }]}>
      <StatusBar barStyle="light-content" backgroundColor="#212121" />
      
      {/* Header Background */}
      <View style={[styles.headerBackground, {
        height: height * 0.07,
        paddingHorizontal: width * 0.04
      }]}>
        {/* Back Button */}
        <BackButton onPress={handleBack} />
        
        {/* Title */}
        <Text style={[styles.headerTitle, { fontSize: width * 0.05 }]}>Forgot Password</Text>
      </View>

      {/* Main Content Card */}
      <View style={[styles.contentCard, {
        marginHorizontal: width * 0.04,
        marginTop: height * 0.06,
        padding: width * 0.04,
        borderRadius: width * 0.05
      }]}>
        {/* Email Illustration Circle */}
        <View style={[styles.emailIllustration, {
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
            <Ionicons name="mail-outline" size={width * 0.125} color="#FFFFFF" />
          </LinearGradient>
        </View>

        {/* Main Heading */}
        <Text style={[styles.mainHeading, { 
          fontSize: width * 0.05,
          marginBottom: height * 0.02
        }]}>Enter Your Email</Text>
        
        {/* Description */}
        <Text style={[styles.description, { 
          fontSize: width * 0.035,
          lineHeight: width * 0.06,
          marginBottom: height * 0.06,
          maxWidth: width * 0.785
        }]}>
          We will send an OTP on the registered email to reset your password.
        </Text>

        {/* Email Input */}
        <View style={[styles.inputContainer, { marginBottom: height * 0.06 }]}>
          <Text style={[styles.inputLabel, { 
            fontSize: width * 0.035,
            marginBottom: height * 0.01,
            marginLeft: width * 0.02
          }]}>Email Address*</Text>
          <View style={[styles.inputField, {
            borderRadius: width * 0.04,
            paddingHorizontal: width * 0.04,
            height: height * 0.06
          }]}>
            <TextInput
              style={[styles.textInput, { fontSize: width * 0.04 }]}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              placeholderTextColor="#7E7E7E"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={[styles.checkIcon, { marginLeft: width * 0.02 }]}>
              <Ionicons name="checkmark-circle" size={width * 0.05} color="#00B894" />
            </View>
          </View>
        </View>

        {/* Send Reset Link Button */}
        <TouchableOpacity 
          style={[styles.sendButtonContainer, { marginBottom: height * 0.02 }]}
          onPress={handleSendReset}
          disabled={isSendDisabled}
        >
          <LinearGradient
            colors={['#6C5CE7', '#5741FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sendButton, {
              height: height * 0.06,
              borderRadius: width * 0.04,
              opacity: isSendDisabled ? 0.6 : 1
            }]}
          >
            <Text style={[styles.sendButtonText, { fontSize: width * 0.04 }]}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {statusMessage && (
          <Text style={[styles.statusText, { fontSize: width * 0.035, marginBottom: height * 0.02 }]}>
            {statusMessage}
          </Text>
        )}
        {errorMessage && (
          <Text style={[styles.errorText, { fontSize: width * 0.035, marginBottom: height * 0.02 }]}>
            {errorMessage}
          </Text>
        )}

        {/* Back to Login Link */}
        <TouchableOpacity style={styles.backToLoginContainer} onPress={handleBackToLogin}>
          <Text style={[styles.backToLoginText, { fontSize: width * 0.04 }]}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212121', // Match header background to cover status bar area
  },
  headerBackground: {
    backgroundColor: '#212121',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    backgroundColor: '#343434',
    alignItems: 'center',
    justifyContent: 'center',
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
  emailIllustration: {
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
  checkIcon: {
  },
  sendButtonContainer: {
    width: '100%',
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  sendButtonText: {
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
  statusText: {
    color: '#00B894',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
  },
});

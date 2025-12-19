import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateAccountScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { signUp, signUpWithGoogle, signUpWithApple } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasStartedForm, setHasStartedForm] = useState(false);

  // Track screen view
  useFocusEffect(
    useCallback(() => {
      analytics.screen('CreateAccount');
    }, [])
  );

  // Track form start when user begins filling
  useEffect(() => {
    if ((firstName || lastName || email || password || confirmPassword) && !hasStartedForm) {
      setHasStartedForm(true);
      analytics.signupStart();
    }
  }, [firstName, lastName, email, password, confirmPassword, hasStartedForm]);

  // Track form abandonment on unmount if not saved
  useEffect(() => {
    return () => {
      if (hasStartedForm && !loading) {
        // Check if user navigated away without completing
        const hasData = firstName || lastName || email || password;
        if (hasData) {
          analytics.signupAbandon();
        }
      }
    };
  }, [hasStartedForm, loading, firstName, lastName, email, password]);

  const handleSignIn = () => {
    router.push('/login');
  };

  const handleCreateAccount = async () => {
    // Validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      analytics.capture('signup_validation_error', { field: 'required_fields', error_type: 'missing_fields' });
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      analytics.capture('signup_validation_error', { field: 'password_confirm', error_type: 'password_mismatch' });
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      analytics.capture('signup_validation_error', { field: 'password', error_type: 'password_too_short' });
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (!agreeToTerms) {
      analytics.capture('signup_validation_error', { field: 'terms', error_type: 'terms_not_agreed' });
      Alert.alert('Error', 'Please agree to the Terms and Conditions');
      return;
    }

    setLoading(true);
    analytics.capture('signup_submit');

    try {
      const { error } = await signUp(email, password, firstName.trim(), lastName.trim());
      
      if (error) {
        const errorType = error.message.includes('email') ? 'invalid_email' :
                         error.message.includes('exists') || error.message.includes('already') ? 'email_exists' :
                         error.message.includes('network') || error.message.includes('connection') ? 'network_error' :
                         'unknown_error';
        analytics.signupFailure({ error_type: errorType });
        Alert.alert('Error', error.message);
      } else {
        analytics.signupSuccess();
        Alert.alert(
          'Success', 
          'Account created successfully! You can now log in.',
          [
            {
              text: 'OK',
              onPress: () => router.push('/login')
            }
          ]
        );
      }
    } catch (error) {
      analytics.signupFailure({ error_type: 'unexpected_error' });
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" />
      
      {/* Overlay to color the OS status bar area without affecting layout */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: '#212121', zIndex: 1 }} />
      
      {/* Header Background */}
      <View style={[styles.headerBackground, { 
        paddingHorizontal: width * 0.04,
        paddingTop: insets.top * 0.3,
        paddingBottom: height * 0.015,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 2
      }]}>
        {/* Back Button */}
        <View style={{ width: width * 0.08, alignItems: 'flex-start' }}>
          <BackButton 
            style={{
              zIndex: 10
            }}
          />
        </View>
        
        {/* Title - Absolutely centered */}
        <View style={{ flex: 1, position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { 
            fontSize: width * 0.045,
            fontWeight: '600',
            color: '#FFFFFF',
          }]}>Create an Account</Text>
        </View>
        
        {/* Spacer to balance the layout */}
        <View style={{ width: width * 0.08 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ 
            paddingBottom: height * 0.15 + insets.bottom
          }}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          {/* Main Form Card */}
          <View style={[styles.formCard, { 
            marginTop: height * 0.02, 
            padding: width * 0.04, 
            marginHorizontal: width * 0.04,
            borderRadius: width * 0.05
          }]}>
        {/* First Name and Last Name Row */}
        <View style={[styles.nameRow, { marginBottom: height * 0.03 }]}>
          <View style={styles.nameInputContainer}>
            <Text style={styles.inputLabel}>First Name*</Text>
            <View style={[styles.nameInputField, { 
              height: height * 0.06,
              borderRadius: width * 0.04,
              paddingHorizontal: width * 0.04
            }]}>
              <TextInput
                style={[styles.textInput, { fontSize: width * 0.04 }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#7E7E7E"
                autoCapitalize="words"
              />
            </View>
          </View>
          
          <View style={styles.nameInputContainer}>
            <Text style={styles.inputLabel}>Last Name*</Text>
            <View style={[styles.nameInputField, { 
              height: height * 0.06,
              borderRadius: width * 0.04,
              paddingHorizontal: width * 0.04
            }]}>
              <TextInput
                style={[styles.textInput, { fontSize: width * 0.04 }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor="#7E7E7E"
                autoCapitalize="words"
              />
            </View>
          </View>
        </View>

        {/* Email Input */}
        <View style={[styles.inputContainer, { marginBottom: height * 0.03 }]}>
          <Text style={styles.inputLabel}>Email Address*</Text>
          <View style={[styles.inputField, { 
            height: height * 0.06,
            borderRadius: width * 0.04,
            paddingHorizontal: width * 0.04
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
              <Ionicons name="checkmark-circle" size={20} color="#00B894" />
            </View>
          </View>
        </View>

        {/* Password Input */}
        <View style={[styles.inputContainer, { marginBottom: height * 0.03 }]}>
          <Text style={styles.inputLabel}>Password*</Text>
          <View style={[styles.inputField, { 
            height: height * 0.06,
            borderRadius: width * 0.04,
            paddingHorizontal: width * 0.04
          }]}>
            <TextInput
              style={[styles.textInput, { fontSize: width * 0.04 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#7E7E7E"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={[styles.eyeIcon, { marginLeft: width * 0.02 }]}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye" : "eye-off"} 
                size={20} 
                color="#9D9D9D" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Password Input */}
        <View style={[styles.inputContainer, { marginBottom: height * 0.03 }]}>
          <Text style={styles.inputLabel}>Confirm Password*</Text>
          <View style={[styles.inputField, { 
            height: height * 0.06,
            borderRadius: width * 0.04,
            paddingHorizontal: width * 0.04
          }]}>
            <TextInput
              style={[styles.textInput, { fontSize: width * 0.04 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Enter password"
              placeholderTextColor="#7E7E7E"
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={[styles.eyeIcon, { marginLeft: width * 0.02 }]}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye" : "eye-off"} 
                size={20} 
                color="#9D9D9D" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Terms and Conditions */}
        <View style={[styles.termsContainer, { marginTop: height * 0.02, marginBottom: height * 0.02 }]}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
          >
                    <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked, { 
          width: width * 0.06, 
          height: width * 0.06, 
          borderRadius: width * 0.015,
          marginRight: width * 0.02
        }]}>
          {agreeToTerms && <Ionicons name="checkmark" size={width * 0.04} color="white" />}
        </View>
            <Text style={[styles.termsText, { fontSize: width * 0.035 }]}>
              I agree to the{' '}
              <Text 
                style={styles.termsLink}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL('https://kamalminott.github.io/won-of-one/terms-of-service.html').catch(err => 
                    console.error('Failed to open terms of service:', err)
                  );
                }}
              >
                Terms and Conditions
              </Text>
              {' '}and{' '}
              <Text 
                style={styles.termsLink}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL('https://kamalminott.github.io/won-of-one/privacy-policy.html').catch(err => 
                    console.error('Failed to open privacy policy:', err)
                  );
                }}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Account Button */}
      <TouchableOpacity 
        style={[styles.createAccountButtonContainer, { marginTop: height * 0.015 }]}
        onPress={handleCreateAccount}
        disabled={loading}
      >
        <LinearGradient
          colors={['#6C5CE7', '#5741FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.createAccountButton, { 
            height: height * 0.06,
            borderRadius: width * 0.04,
            width: width * 0.92,
            alignSelf: 'center',
            opacity: loading ? 0.7 : 1
          }]}
        >
          <Text style={[styles.createAccountButtonText, { fontSize: width * 0.04 }]}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Social Login Section */}
      <View style={[styles.socialSection, { marginTop: height * 0.015 }]}>
        <View style={[styles.separator, { marginBottom: height * 0.02 }]}>
          <View style={styles.separatorLine} />
          <Text style={[styles.separatorText, { 
            fontSize: 16,
            fontWeight: '400',
            textAlign: 'center',
            lineHeight: 16,
            paddingHorizontal: width * 0.03,
            paddingVertical: height * 0.005
          }]}>or sign up with</Text>
          <View style={styles.separatorLine} />
        </View>
        
        <View style={[styles.socialButtons, { gap: width * 0.05 }]}>
          <TouchableOpacity 
            style={[styles.socialButton, { 
              width: width * 0.12, 
              height: width * 0.12, 
              borderRadius: width * 0.06 
            }]}
            onPress={async () => {
              analytics.capture('google_signup_attempt');
              const { error } = await signUpWithGoogle();
              if (error) {
                analytics.capture('google_signup_failure', { error: error.message });
                Alert.alert('Error', error.message || 'Failed to sign up with Google');
              } else {
                analytics.capture('google_signup_success');
                // Navigation will happen automatically via auth state change
              }
            }}
          >
            <View style={[styles.googleIcon, { 
              width: width * 0.045, 
              height: width * 0.045, 
              borderRadius: width * 0.01 
            }]}>
              <Text style={[styles.googleG, { fontSize: width * 0.03 }]}>G</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.socialButton, { 
              width: width * 0.12, 
              height: width * 0.12, 
              borderRadius: width * 0.06 
            }]}
            onPress={async () => {
              analytics.capture('apple_signup_attempt');
              const { error } = await signUpWithApple();
              if (error) {
                if (error.message !== 'Sign up was canceled') {
                  analytics.capture('apple_signup_failure', { error: error.message });
                  Alert.alert('Error', error.message || 'Failed to sign up with Apple');
                }
              } else {
                analytics.capture('apple_signup_success');
                router.push('/(tabs)');
              }
            }}
          >
            <Ionicons name="logo-apple" size={width * 0.06} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign In Link - Inside ScrollView below social buttons */}
      <TouchableOpacity style={[styles.signInContainer, { 
        marginTop: height * 0.02, 
        marginBottom: height * 0.02,
        paddingVertical: height * 0.0015,
        alignSelf: 'center',
        borderWidth: 0,
        backgroundColor: 'transparent'
      }]} onPress={handleSignIn}>
        <Text style={[styles.signInText, { fontSize: width * 0.04 }]}>
          Already have an account? <Text style={styles.signInLink}>Sign In</Text>
        </Text>
      </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },
  headerBackground: {
    backgroundColor: '#212121',
  },
  backButton: {
    backgroundColor: '#343434',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    // Styles moved to inline for responsive design
  },
  formCard: {
    backgroundColor: '#2A2A2A',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameInputContainer: {
    width: '48%',
  },
  inputContainer: {
  },
  inputLabel: {
    color: '#FFFFFF',
  },
  nameInputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#464646',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#464646',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  checkIcon: {
  },
  eyeIcon: {
  },
  termsContainer: {
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#464646',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  termsText: {
    color: '#9D9D9D',
    fontWeight: '500',
    flex: 1,
  },
  termsLink: {
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
  createAccountButtonContainer: {
  },
  createAccountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  createAccountButtonText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  socialSection: {
    alignItems: 'center',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separatorLine: {
    backgroundColor: '#464646',
    height: 1,
    flex: 0.3,
  },
  separatorText: {
    color: '#9D9D9D',
  },
  socialButtons: {
    flexDirection: 'row',
  },
  socialButton: {
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  googleIcon: {
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    color: 'white',
    fontWeight: 'bold',
  },
  signInContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  signInText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  signInLink: {
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
});

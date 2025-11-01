import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert, KeyboardAvoidingView,
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  // Track screen view
  useFocusEffect(
    useCallback(() => {
      analytics.screen('Login');
    }, [])
  );

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    analytics.loginAttempt();
    const loginStartTime = Date.now();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        const errorType = error.message.includes('password') ? 'wrong_password' : 
                         error.message.includes('email') ? 'invalid_email' :
                         error.message.includes('network') || error.message.includes('connection') ? 'network_error' :
                         'unknown_error';
        analytics.loginFailure({ error_type: errorType });
        Alert.alert('Error', error.message);
      } else {
        const timeToLogin = Date.now() - loginStartTime;
        analytics.loginSuccess({ time_to_login_ms: timeToLogin });
        // Success - user will be automatically redirected by auth context
        router.push('/(tabs)');
      }
    } catch (error) {
      analytics.loginFailure({ error_type: 'unexpected_error' });
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Decorative Circles */}
          <View style={[styles.decorativeCircle1, { right: width * 0.13 }]} />
          <View style={[styles.decorativeCircle2, { right: width * 0.15, top: height * 0.07 }]} />

          {/* Header */}
          <View style={[styles.header, { 
            marginTop: Math.max(height * 0.04, insets.top + height * 0.015),
            marginBottom: height * 0.03
          }]}>
            <Text style={[styles.title, { fontSize: width * 0.075 }]}>Sign In</Text>
            <Text style={[styles.subtitle, { 
              fontSize: width * 0.04,
              marginTop: height * 0.03
            }]}>Welcome back you've been missed</Text>
          </View>

          {/* Login Form Card */}
          <View style={[styles.formCard, { 
            marginHorizontal: width * 0.04,
            marginTop: height * 0.01,
            padding: width * 0.04,
            borderRadius: width * 0.05
          }]}>
            {/* Email Input */}
            <View style={[styles.inputContainer, { marginBottom: height * 0.04 }]}>
              <Text style={[styles.inputLabel, { 
                fontSize: width * 0.035, 
                marginBottom: height * 0.01, 
                marginLeft: width * 0.02 
              }]}>Email Address*</Text>
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
                  <Ionicons name="checkmark-circle" size={width * 0.05} color="#00B894" />
                </View>
              </View>
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { marginBottom: height * 0.04 }]}>
              <Text style={[styles.inputLabel, { 
                fontSize: width * 0.035, 
                marginBottom: height * 0.01, 
                marginLeft: width * 0.02 
              }]}>Password*</Text>
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
                    size={width * 0.05} 
                    color="#9D9D9D" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me & Forgot Password */}
            <View style={[styles.optionsRow, { marginTop: height * 0.02 }]}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, { 
                  width: width * 0.06, 
                  height: width * 0.06, 
                  borderRadius: width * 0.015,
                  marginRight: width * 0.02
                }]}>
                  {rememberMe && <Ionicons name="checkmark" size={width * 0.04} color="white" />}
                </View>
                <Text style={[styles.rememberMeText, { fontSize: width * 0.035 }]}>Remember Me</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => {
                analytics.capture('forgot_password_click');
                router.push('/forgot-password');
              }}>
                <Text style={[styles.forgotPasswordText, { fontSize: width * 0.035 }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity 
            style={[styles.loginButtonContainer, { 
              marginTop: height * 0.04,
              marginHorizontal: width * 0.04
            }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6C5CE7', '#5741FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.loginButton, { 
                height: height * 0.06,
                borderRadius: width * 0.04,
                opacity: loading ? 0.7 : 1
              }]}
            >
              <Text style={[styles.loginButtonText, { fontSize: width * 0.04 }]}>
                {loading ? 'Signing In...' : 'Log In'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Social Login Section */}
          <View style={[styles.socialSection, { marginTop: height * 0.04 }]}>
            <View style={[styles.separator, { marginBottom: height * 0.03 }]}>
              <View style={[styles.separatorLine, { height: 1, flex: 0.3 }]} />
              <Text style={[styles.separatorText, { fontSize: width * 0.04 }]}>or sign up with</Text>
              <View style={[styles.separatorLine, { height: 1, flex: 0.3 }]} />
            </View>
            
            <View style={[styles.socialButtons, { gap: width * 0.05 }]}>
              <TouchableOpacity style={[styles.socialButton, { 
                width: width * 0.12, 
                height: width * 0.12, 
                borderRadius: width * 0.06 
              }]}>
                <View style={[styles.googleIcon, { 
                  width: width * 0.045, 
                  height: width * 0.045, 
                  borderRadius: width * 0.01 
                }]}>
                  <Text style={[styles.googleG, { fontSize: width * 0.03 }]}>G</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.socialButton, { 
                width: width * 0.12, 
                height: width * 0.12, 
                borderRadius: width * 0.06 
              }]}>
                <Ionicons name="logo-apple" size={width * 0.06} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Link */}
          <TouchableOpacity 
            style={[styles.signUpContainer, {
              marginTop: height * 0.02,
              marginBottom: height * 0.02,
              paddingVertical: height * 0.02
            }]}
            onPress={() => {
              analytics.capture('create_account_click');
              router.push('/create-account');
            }}
          >
            <Text style={[styles.signUpText, { fontSize: width * 0.04 }]}>
              Don't have an account? <Text style={styles.signUpLink}>Sign Up</Text>
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
  header: {
    alignItems: 'center',
  },
  title: {
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  subtitle: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#2A2A2A',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  inputContainer: {
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
  eyeIcon: {
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  rememberMeText: {
    color: '#9D9D9D',
    fontWeight: '500',
  },
  forgotPasswordText: {
    color: '#FF7675',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  loginButtonContainer: {
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  loginButtonText: {
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
    height: 1,
    backgroundColor: '#464646',
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
  signUpContainer: {
    alignItems: 'center',
  },
  signUpText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  signUpLink: {
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
  decorativeCircle1: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    opacity: 0.1,
  },
  decorativeCircle2: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    opacity: 0.1,
  },
});

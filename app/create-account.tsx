import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
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
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // handleBack function removed - BackButton component handles navigation automatically

  const handleSignIn = () => {
    router.push('/login');
  };

  const handleCreateAccount = async () => {
    // Validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (!agreeToTerms) {
      Alert.alert('Error', 'Please agree to the Terms and Conditions');
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUp(email, password);
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
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
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header Background */}
      <View style={[styles.headerBackground, { 
        height: Platform.OS === 'ios' ? height * 0.0 + insets.top : height * 0.08 + insets.top,
        paddingHorizontal: width * 0.04,
        paddingTop: Platform.OS === 'ios' ? insets.top * 0.0 : insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }]}>
        {/* Back Button */}
        <BackButton 
          style={{
            zIndex: 10
          }}
        />
        
        {/* Title */}
        <Text style={[styles.headerTitle, { 
          fontSize: width * 0.045,
          fontWeight: '600',
          color: '#FFFFFF',
          flex: 1,
          textAlign: 'center',
          marginRight: width * 0.08 // Compensate for back button width
        }]}>Create an Account</Text>
        
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
              I agree to the <Text style={styles.termsLink}>Terms and Conditions</Text>
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

        </ScrollView>
        
        {/* Sign In Link - Outside ScrollView to ensure visibility */}
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

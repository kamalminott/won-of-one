import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
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

export default function ForgotPasswordScreen() {
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('jondoe@gmail.com');

  const handleBack = () => {
    router.back();
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header Background */}
      <View style={styles.headerBackground}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        {/* Title */}
        <Text style={styles.headerTitle}>Forgot Password</Text>
      </View>

      {/* Main Content Card */}
      <View style={styles.contentCard}>
        {/* Email Illustration Circle */}
        <View style={styles.emailIllustration}>
          <LinearGradient
            colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.illustrationGradient}
          >
            <Ionicons name="mail-outline" size={50} color="#FFFFFF" />
          </LinearGradient>
        </View>

        {/* Main Heading */}
        <Text style={styles.mainHeading}>Enter Your Email</Text>
        
        {/* Description */}
        <Text style={styles.description}>
          We will send an OTP on the registered email to reset your password.
        </Text>

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email Address*</Text>
          <View style={styles.inputField}>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              placeholderTextColor="#7E7E7E"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.checkIcon}>
              <Ionicons name="checkmark-circle" size={20} color="#00B894" />
            </View>
          </View>
        </View>

        {/* Send Reset Link Button */}
        <TouchableOpacity style={styles.sendButtonContainer}>
          <LinearGradient
            colors={['#6C5CE7', '#5741FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendButton}
          >
            <Text style={styles.sendButtonText}>Send Reset Link</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Back to Login Link */}
        <TouchableOpacity style={styles.backToLoginContainer} onPress={handleBackToLogin}>
          <Text style={styles.backToLoginText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#343434',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginRight: 64,
  },
  contentCard: {
    backgroundColor: '#2A2A2A',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  emailIllustration: {
    width: 128,
    height: 128,
    borderRadius: 64,
    marginBottom: 32,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  illustrationGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainHeading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#9D9D9D',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    maxWidth: 314,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 48,
  },
  inputLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
    marginLeft: 8,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#464646',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 8,
  },
  sendButtonContainer: {
    width: '100%',
    marginBottom: 32,
  },
  sendButton: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backToLoginContainer: {
    alignItems: 'center',
  },
  backToLoginText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
});

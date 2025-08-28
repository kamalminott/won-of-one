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

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('jondoe@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      


      {/* Decorative Circles */}
      <View style={[styles.decorativeCircle1, { right: width * 0.13 }]} />
      <View style={[styles.decorativeCircle2, { right: width * 0.15, top: height * 0.07 }]} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Welcome back you've been missed</Text>
      </View>

      {/* Login Form Card */}
      <View style={styles.formCard}>
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

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password*</Text>
          <View style={styles.inputField}>
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#7E7E7E"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
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

        {/* Remember Me & Forgot Password */}
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <Text style={styles.rememberMeText}>Remember Me</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Login Button */}
      <TouchableOpacity style={styles.loginButtonContainer}>
        <LinearGradient
          colors={['#6C5CE7', '#5741FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.loginButton}
        >
          <Text style={styles.loginButtonText}>Log In</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Social Login Section */}
      <View style={styles.socialSection}>
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>or sign up with</Text>
          <View style={styles.separatorLine} />
        </View>
        
        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.socialButton}>
            <View style={styles.googleIcon}>
              <Text style={styles.googleG}>G</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.socialButton}>
            <Ionicons name="logo-apple" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Up Link */}
      <TouchableOpacity 
        style={styles.signUpContainer}
        onPress={() => router.push('/create-account')}
      >
        <Text style={styles.signUpText}>
          Don't have an account? <Text style={styles.signUpLink}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },

  decorativeCircle1: {
    position: 'absolute',
    width: 84,
    height: 84,
    backgroundColor: '#FFFFFF',
    opacity: 0.1,
    borderRadius: 42,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#FFFFFF',
    opacity: 0.1,
    borderRadius: 10,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  formCard: {
    backgroundColor: '#2A2A2A',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  inputContainer: {
    marginBottom: 32,
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
  eyeIcon: {
    marginLeft: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#464646',
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#9D9D9D',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#FF7675',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  loginButtonContainer: {
    marginHorizontal: 16,
    marginTop: 32,
  },
  loginButton: {
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
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  socialSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  separatorLine: {
    width: 67,
    height: 1,
    backgroundColor: '#464646',
  },
  separatorText: {
    fontSize: 16,
    color: '#9D9D9D',
    marginHorizontal: 12,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  socialButton: {
    width: 44,
    height: 44,
    backgroundColor: '#2A2A2A',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  googleIcon: {
    width: 18,
    height: 18,
    backgroundColor: '#4285F4',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  signUpContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  signUpLink: {
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
});

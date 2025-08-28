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

export default function CreateAccountScreen() {
  const { width, height } = useWindowDimensions();
  const [firstName, setFirstName] = useState('John');
  const [lastName, setLastName] = useState('Doe');
  const [email, setEmail] = useState('jondoe@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleSignIn = () => {
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
        <Text style={styles.headerTitle}>Create an Account</Text>
      </View>

      {/* Main Form Card */}
      <View style={styles.formCard}>
        {/* First Name and Last Name Row */}
        <View style={styles.nameRow}>
          <View style={styles.nameInputContainer}>
            <Text style={styles.inputLabel}>First Name*</Text>
            <View style={styles.nameInputField}>
              <TextInput
                style={styles.textInput}
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
            <View style={styles.nameInputField}>
              <TextInput
                style={styles.textInput}
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

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm Password*</Text>
          <View style={styles.inputField}>
            <TextInput
              style={styles.textInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Enter password"
              placeholderTextColor="#7E7E7E"
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
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
        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms and Conditions</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Account Button */}
      <TouchableOpacity style={styles.createAccountButtonContainer}>
        <LinearGradient
          colors={['#6C5CE7', '#5741FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.createAccountButton}
        >
          <Text style={styles.createAccountButtonText}>Create Account</Text>
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

      {/* Sign In Link */}
      <TouchableOpacity style={styles.signInContainer} onPress={handleSignIn}>
        <Text style={styles.signInText}>
          Already have an account? <Text style={styles.signInLink}>Sign In</Text>
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
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginRight: 64,
  },
  formCard: {
    backgroundColor: '#2A2A2A',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 12,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  nameInputContainer: {
    width: '48%',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
    marginLeft: 8,
  },
  nameInputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#464646',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
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
  termsContainer: {
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
  termsText: {
    fontSize: 14,
    color: '#9D9D9D',
    fontWeight: '500',
    flex: 1,
  },
  termsLink: {
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
  createAccountButtonContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  createAccountButton: {
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
  createAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  socialSection: {
    marginTop: 20,
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
  signInContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  signInLink: {
    color: '#FF7675',
    textDecorationLine: 'underline',
  },
});

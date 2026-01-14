import { analytics } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BugReportModalProps {
  visible: boolean;
  onClose: () => void;
  onReopen?: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ visible, onClose, onReopen }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'crash' | 'ui' | 'feature' | 'performance' | 'sync' | 'other'>('other');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const categories: Array<{ value: typeof category; label: string; icon: string }> = [
    { value: 'crash', label: 'App Crash', icon: 'warning' },
    { value: 'ui', label: 'UI Issue', icon: 'phone-portrait' },
    { value: 'feature', label: 'Feature Request', icon: 'bulb' },
    { value: 'performance', label: 'Performance', icon: 'speedometer' },
    { value: 'sync', label: 'Sync Issue', icon: 'sync' },
    { value: 'other', label: 'Other', icon: 'ellipse' },
  ];

  const handleTakeScreenshot = () => {
    Alert.alert(
      'Attach Screenshot',
      'Choose how you want to attach a screenshot',
      [
        {
          text: 'Camera',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Photo Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Photo library permission is required to select images.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        setScreenshotUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshotUri(null);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required Field', 'Please describe the bug or issue.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Collect device info
      const deviceInfo = {
        os: Device.osName ?? 'unknown',
        os_version: Device.osVersion ?? 'unknown',
        device_model: Device.modelName ?? 'unknown',
        app_version: Application.nativeApplicationVersion ?? 'unknown',
        build_number: Application.nativeBuildVersion ?? 'unknown',
      };

      // Submit to PostHog
      analytics.bugReport({
        description: description.trim(),
        category,
        screenshot_uri: screenshotUri || undefined,
        user_email: userEmail.trim() || undefined,
        steps_to_reproduce: stepsToReproduce.trim() || undefined,
        device_info: deviceInfo,
      });

      // Show success message
      Alert.alert(
        'Thank You!',
        'Your bug report has been submitted. We appreciate your feedback and will look into this issue.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setDescription('');
              setCategory('other');
              setStepsToReproduce('');
              setUserEmail('');
              setScreenshotUri(null);
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting bug report:', error);
      Alert.alert('Error', 'Failed to submit bug report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    
    // Warn if there's unsaved content
    if (description.trim() || stepsToReproduce.trim() || screenshotUri) {
      Alert.alert(
        'Discard Report?',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setDescription('');
              setCategory('other');
              setStepsToReproduce('');
              setUserEmail('');
              setScreenshotUri(null);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: '#212121',
      borderTopLeftRadius: width * 0.06,
      borderTopRightRadius: width * 0.06,
      maxHeight: height * 0.9,
      paddingTop: insets.top + height * 0.02,
      paddingBottom: insets.bottom + height * 0.02,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
      paddingBottom: height * 0.02,
      borderBottomWidth: 1,
      borderBottomColor: '#464646',
    },
    headerTitle: {
      fontSize: width * 0.05,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    closeButton: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.02,
    },
    section: {
      marginBottom: height * 0.025,
    },
    sectionTitle: {
      fontSize: width * 0.04,
      fontWeight: '500',
      color: '#FFFFFF',
      marginBottom: height * 0.015,
    },
    input: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      fontSize: width * 0.04,
      color: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#464646',
      minHeight: height * 0.1,
      textAlignVertical: 'top',
    },
    textInput: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      fontSize: width * 0.04,
      color: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#464646',
    },
    categoryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      borderWidth: 1,
      borderColor: '#464646',
    },
    categoryButtonText: {
      fontSize: width * 0.04,
      color: '#FFFFFF',
      flex: 1,
      marginLeft: width * 0.02,
    },
    categoryPicker: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      marginTop: height * 0.01,
      borderWidth: 1,
      borderColor: '#464646',
      overflow: 'hidden',
    },
    categoryOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      borderBottomWidth: 1,
      borderBottomColor: '#464646',
    },
    categoryOptionLast: {
      borderBottomWidth: 0,
    },
    categoryOptionText: {
      fontSize: width * 0.04,
      color: '#FFFFFF',
      flex: 1,
      marginLeft: width * 0.02,
    },
    screenshotButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      borderWidth: 1,
      borderColor: '#464646',
      marginTop: height * 0.01,
    },
    screenshotButtonText: {
      fontSize: width * 0.04,
      color: '#FFFFFF',
      marginLeft: width * 0.02,
    },
    screenshotPreview: {
      width: '100%',
      height: height * 0.2,
      borderRadius: width * 0.03,
      marginTop: height * 0.015,
      backgroundColor: '#2A2A2A',
      position: 'relative',
    },
    screenshotImage: {
      width: '100%',
      height: '100%',
      borderRadius: width * 0.03,
    },
    removeScreenshotButton: {
      position: 'absolute',
      top: width * 0.02,
      right: width * 0.02,
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButton: {
      backgroundColor: '#6C5CE7',
      borderRadius: width * 0.03,
      paddingVertical: height * 0.02,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: height * 0.02,
      shadowColor: '#6C5CE7',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    submitButtonDisabled: {
      backgroundColor: '#464646',
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: width * 0.045,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    optionalLabel: {
      fontSize: width * 0.03,
      color: '#9D9D9D',
      marginTop: height * 0.005,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'overFullScreen'}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Report a Bug</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Ionicons name="close" size={width * 0.06} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Description */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What happened? *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Describe the bug or issue..."
                  placeholderTextColor="#9D9D9D"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  editable={!isSubmitting}
                />
              </View>

              {/* Category */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Category</Text>
                <TouchableOpacity
                  style={styles.categoryButton}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name={categories.find(c => c.value === category)?.icon as any}
                    size={width * 0.05}
                    color="#6C5CE7"
                  />
                  <Text style={styles.categoryButtonText}>
                    {categories.find(c => c.value === category)?.label}
                  </Text>
                  <Ionicons
                    name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                    size={width * 0.05}
                    color="#9D9D9D"
                  />
                </TouchableOpacity>

                {showCategoryPicker && (
                  <View style={styles.categoryPicker}>
                    {categories.map((cat, index) => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[
                          styles.categoryOption,
                          index === categories.length - 1 && styles.categoryOptionLast,
                        ]}
                        onPress={() => {
                          setCategory(cat.value);
                          setShowCategoryPicker(false);
                        }}
                        disabled={isSubmitting}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={width * 0.05}
                          color={category === cat.value ? '#6C5CE7' : '#9D9D9D'}
                        />
                        <Text
                          style={[
                            styles.categoryOptionText,
                            category === cat.value && { color: '#6C5CE7', fontWeight: '600' },
                          ]}
                        >
                          {cat.label}
                        </Text>
                        {category === cat.value && (
                          <Ionicons name="checkmark" size={width * 0.05} color="#6C5CE7" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Steps to Reproduce */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Steps to Reproduce</Text>
                <Text style={styles.optionalLabel}>(Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                  placeholderTextColor="#9D9D9D"
                  value={stepsToReproduce}
                  onChangeText={setStepsToReproduce}
                  multiline
                  numberOfLines={4}
                  editable={!isSubmitting}
                />
              </View>

              {/* Screenshot */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Screenshot</Text>
                <Text style={styles.optionalLabel}>(Optional)</Text>
                {!screenshotUri ? (
                  <TouchableOpacity
                    style={styles.screenshotButton}
                    onPress={handleTakeScreenshot}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="camera" size={width * 0.05} color="#6C5CE7" />
                    <Text style={styles.screenshotButtonText}>Attach Screenshot</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <View style={styles.screenshotPreview}>
                      <Image
                        source={{ uri: screenshotUri }}
                        style={styles.screenshotImage}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeScreenshotButton}
                        onPress={handleRemoveScreenshot}
                        disabled={isSubmitting}
                      >
                        <Ionicons name="close" size={width * 0.04} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Email (Optional) */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Email</Text>
                <Text style={styles.optionalLabel}>(Optional - for follow-up)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="your.email@example.com"
                  placeholderTextColor="#9D9D9D"
                  value={userEmail}
                  onChangeText={setUserEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting || !description.trim()}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

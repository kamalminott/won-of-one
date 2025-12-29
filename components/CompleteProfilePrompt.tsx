import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CompleteProfilePromptProps {
  visible: boolean;
  onDismiss: () => void;
  onCompleted?: () => void;
}

const FALLBACK_NAMES = new Set(['', 'User', 'Guest User']);

const capitalizeName = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const CompleteProfilePrompt: React.FC<CompleteProfilePromptProps> = ({
  visible,
  onDismiss,
  onCompleted,
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, userName, setUserName } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const hasOptimisticCloseRef = React.useRef(false);
  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

  useEffect(() => {
    if (!visible) return;
    const candidate = userName && !FALLBACK_NAMES.has(userName) ? userName : '';
    const parts = candidate.trim().split(' ').filter(Boolean);
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setErrorMessage('');
    setIsSaving(false);
    hasOptimisticCloseRef.current = false;
  }, [visible, userName]);

  const handleSave = async () => {
    if (isSaving) return;
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setErrorMessage('Please enter your first and last name.');
      return;
    }

    if (!user?.id) {
      setErrorMessage('Unable to load your account. Please try again.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const formattedFirst = capitalizeName(trimmedFirst);
    const formattedLast = capitalizeName(trimmedLast);
    const fullName = [formattedFirst, formattedLast].filter(Boolean).join(' ').trim();

    try {
      if (!hasOptimisticCloseRef.current) {
        hasOptimisticCloseRef.current = true;
        void setUserName(fullName);
        if (onCompleted) {
          onCompleted();
        } else {
          onDismiss();
        }
      }

      const existingUser = await withTimeout(
        userService.getUserById(user.id),
        10000,
        'Loading profile'
      );
      let updatedUser = null;

      if (existingUser) {
        updatedUser = await withTimeout(
          userService.updateUser(user.id, { name: fullName }),
          10000,
          'Saving profile'
        );
      } else {
        updatedUser = await withTimeout(
          userService.createUser(user.id, user.email, formattedFirst, formattedLast),
          10000,
          'Creating profile'
        );
      }

      if (!updatedUser?.name) {
        throw new Error('Profile save failed');
      }

      const metadata: Record<string, string> = {
        display_name: fullName,
        full_name: fullName,
        name: fullName,
      };

      if (formattedFirst) {
        metadata.given_name = formattedFirst;
      }

      if (formattedLast) {
        metadata.family_name = formattedLast;
      }

      void supabase.auth
        .updateUser({ data: metadata })
        .then(({ error }) => {
          if (error) {
            console.warn('⚠️ Failed to update auth display name:', error);
          }
        })
        .catch(error => {
          console.warn('⚠️ Failed to update auth display name:', error);
        });
    } catch (error) {
      console.error('Error updating profile name:', error);
      setErrorMessage('Unable to save your name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: Math.max(16, insets.top),
      paddingBottom: Math.max(16, insets.bottom),
    },
    modalContainer: {
      backgroundColor: '#2A2A2A',
      borderRadius: 16,
      width: width * 0.9,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      alignSelf: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: 'white',
      marginBottom: 8,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: '#9D9D9D',
      marginBottom: 16,
      textAlign: 'center',
    },
    nameInputContainer: {
      marginBottom: 16,
    },
    nameInputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: '#9D9D9D',
      marginBottom: 8,
    },
    nameInput: {
      backgroundColor: '#393939',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: 'white',
      borderWidth: 1,
      borderColor: '#464646',
    },
    modalButtonContainer: {
      marginTop: 16,
      paddingBottom: 4,
      alignItems: 'stretch',
    },
    modalButton: {
      flex: 1,
      minHeight: 48,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonSave: {
      backgroundColor: '#6C5CE7',
      opacity: isSaving || !canSubmit ? 0.7 : 1,
    },
    requiredIndicator: {
      color: '#FF6B6B',
      fontWeight: '700',
    },
    modalButtonSaveText: {
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '600',
      textAlign: 'center',
      width: '100%',
      includeFontPadding: false,
    },
    errorText: {
      color: '#FF6B6B',
      fontSize: 14,
      marginBottom: 12,
      textAlign: 'center',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
            onPress={Keyboard.dismiss}
          >
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Complete Your Profile</Text>
              <Text style={styles.modalSubtitle}>
                Add your name so matches and stats look right.
              </Text>

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <View style={styles.nameInputContainer}>
                <Text style={styles.nameInputLabel}>
                  First Name<Text style={styles.requiredIndicator}> *</Text>
                </Text>
                <TextInput
                  style={styles.nameInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Enter first name"
                  placeholderTextColor="#9D9D9D"
                  autoFocus
                  maxLength={30}
                />
              </View>

              <View style={styles.nameInputContainer}>
                <Text style={styles.nameInputLabel}>
                  Last Name<Text style={styles.requiredIndicator}> *</Text>
                </Text>
                <TextInput
                  style={styles.nameInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Enter last name"
                  placeholderTextColor="#9D9D9D"
                  maxLength={30}
                />
              </View>

              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSave}
                  disabled={isSaving || !canSubmit}
                >
                  <Text style={styles.modalButtonSaveText}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

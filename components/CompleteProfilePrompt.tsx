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

export const CompleteProfilePrompt: React.FC<CompleteProfilePromptProps> = ({
  visible,
  onDismiss,
  onCompleted,
}) => {
  const { width } = useWindowDimensions();
  const { user, userName, setUserName } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const candidate = userName && !FALLBACK_NAMES.has(userName) ? userName : '';
    const parts = candidate.trim().split(' ').filter(Boolean);
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setErrorMessage('');
  }, [visible, userName]);

  const handleSave = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      setErrorMessage('Please enter at least a first name.');
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
      const existingUser = await userService.getUserById(user.id);
      let updatedUser = null;

      if (existingUser) {
        updatedUser = await userService.updateUser(user.id, { name: fullName });
      } else {
        updatedUser = await userService.createUser(user.id, user.email, formattedFirst, formattedLast);
      }

      if (updatedUser?.name) {
        await setUserName(updatedUser.name);
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

      const { error } = await supabase.auth.updateUser({ data: metadata });
      if (error) {
        console.warn('⚠️ Failed to update auth display name:', error);
      }

      if (onCompleted) {
        onCompleted();
      } else {
        onDismiss();
      }
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
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonCancel: {
      backgroundColor: '#393939',
    },
    modalButtonSave: {
      backgroundColor: '#6C5CE7',
      opacity: isSaving ? 0.7 : 1,
    },
    modalButtonCancelText: {
      fontSize: 16,
      color: '#9D9D9D',
      fontWeight: '600',
    },
    modalButtonSaveText: {
      fontSize: 16,
      color: 'white',
      fontWeight: '600',
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
      onRequestClose={onDismiss}
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
                <Text style={styles.nameInputLabel}>First Name</Text>
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
                <Text style={styles.nameInputLabel}>Last Name</Text>
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
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={onDismiss}
                  disabled={isSaving}
                >
                  <Text style={styles.modalButtonCancelText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSave}
                  disabled={isSaving}
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

import { Colors } from '@/constants/Colors';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface BlockingStatusOverlayProps {
  visible: boolean;
  title: string;
  message: string;
  loading?: boolean;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function BlockingStatusOverlay({
  visible,
  title,
  message,
  loading = true,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: BlockingStatusOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.purple.primary} style={styles.spinner} />
          ) : null}

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {primaryActionLabel && onPrimaryAction ? (
            <TouchableOpacity style={styles.primaryButton} onPress={onPrimaryAction}>
              <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
            </TouchableOpacity>
          ) : null}

          {secondaryActionLabel && onSecondaryAction ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={onSecondaryAction}>
              <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: '#212121',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 18,
  },
  title: {
    fontFamily: 'Articulat CF',
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontFamily: 'Articulat CF',
    fontSize: 15,
    lineHeight: 22,
    color: '#D0D0D0',
    textAlign: 'center',
  },
  primaryButton: {
    minWidth: 160,
    marginTop: 24,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: Colors.purple.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Articulat CF',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minWidth: 160,
    marginTop: 10,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Articulat CF',
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

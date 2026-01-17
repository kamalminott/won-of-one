import { subscriptionService } from '@/lib/subscriptionService';
import { analytics } from '@/lib/analytics';
import { router } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import RevenueCatUI from 'react-native-purchases-ui';

export default function PaywallScreen() {
  const { user } = useAuth();
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('Paywall');
    let isActive = true;

    const init = async () => {
      try {
        await subscriptionService.initialize(user?.id);
        if (!subscriptionService.isConfigured()) {
          throw new Error('Subscriptions are unavailable. Please try again later.');
        }
      } catch (error: any) {
        if (isActive) {
          setInitError(error?.message || 'Subscriptions are unavailable. Please try again later.');
        }
      } finally {
        if (isActive) {
          setInitializing(false);
        }
      }
    };

    void init();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  const handleClose = () => {
    console.log('🚪 Closing paywall, navigating to home with bypass flag');
    router.push({
      pathname: '/(tabs)',
      params: {
        bypassPaywall: 'true',
      },
    });
  };

  if (initializing) {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="light" />
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color={Colors.purple.primary} />
          <Text style={styles.loadingText}>Loading paywall...</Text>
        </View>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="light" />
        <View style={styles.statusContainer}>
          <Text style={styles.errorText}>{initError}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close Paywall</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="light" />
      <RevenueCatUI.Paywall
        options={{ displayCloseButton: true }}
        onDismiss={handleClose}
        onPurchaseCompleted={() => handleClose()}
        onRestoreCompleted={() => handleClose()}
        onPurchaseError={({ error }) => {
          console.error('Paywall purchase error:', error);
        }}
        onRestoreError={({ error }) => {
          console.error('Paywall restore error:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 16,
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.purple.primary,
  },
  closeButtonText: {
    color: Colors.purple.primary,
    fontWeight: '600',
  },
});

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
  const [canDismiss, setCanDismiss] = useState(false);

  const handleClose = (reason: 'user' | 'purchase' | 'restore' | 'already_subscribed' | 'error' = 'user') => {
    if (!canDismiss && reason === 'user') {
      return;
    }
    console.log('🚪 Closing paywall, navigating to home with bypass flag');
    // Track paywall dismissed (user closed without purchasing)
    analytics.capture('paywall_dismissed', { reason });
    router.push({
      pathname: '/(tabs)',
      params: {
        bypassPaywall: 'true',
      },
    });
  };

  useEffect(() => {
    analytics.screen('Paywall');
    // Track paywall viewed
    analytics.capture('paywall_viewed');
    let isActive = true;

    const init = async () => {
      try {
        await subscriptionService.initialize(user?.id);
        if (!subscriptionService.isConfigured()) {
          throw new Error('Subscriptions are unavailable. Please try again later.');
        }
        const info = await subscriptionService.getSubscriptionInfo();
        if (info.isActive) {
          setCanDismiss(true);
          handleClose('already_subscribed');
          return;
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
          <TouchableOpacity onPress={() => handleClose('error')} style={styles.closeButton}>
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
        options={{ displayCloseButton: false }}
        onDismiss={() => handleClose('user')}
        onPurchaseCompleted={async (customerInfo) => {
          try {
            // Parse subscription info from customerInfo
            const subscriptionInfo = subscriptionService.parseCustomerInfo(customerInfo);
            
            // Track successful purchase
            analytics.capture('paywall_subscribe_success', {
              product_id: subscriptionInfo.productId,
              entitlement_id: subscriptionInfo.entitlementId,
              is_trial: subscriptionInfo.isTrial,
              status: subscriptionInfo.status,
              subscription_type: subscriptionInfo.productId?.includes('yearly') ? 'yearly' : 'monthly',
              expires_at: subscriptionInfo.expiresAt?.toISOString(),
              period_type: subscriptionInfo.periodType,
            });
            
            // Track trial start if applicable
            if (subscriptionInfo.isTrial) {
              analytics.capture('subscription_trial_started', {
                product_id: subscriptionInfo.productId,
                expires_at: subscriptionInfo.expiresAt?.toISOString(),
                subscription_type: subscriptionInfo.productId?.includes('yearly') ? 'yearly' : 'monthly',
                period_type: subscriptionInfo.periodType,
              });
            } else {
              // Track direct conversion (no trial)
              analytics.capture('subscription_converted', {
                product_id: subscriptionInfo.productId,
                subscription_type: subscriptionInfo.productId?.includes('yearly') ? 'yearly' : 'monthly',
              });
            }
            setCanDismiss(true);
          } catch (error) {
            console.error('Error tracking purchase completion:', error);
          }
          
          handleClose('purchase');
        }}
        onRestoreCompleted={async (customerInfo) => {
          try {
            // Parse subscription info from customerInfo
            const subscriptionInfo = subscriptionService.parseCustomerInfo(customerInfo);
            
            // Track restore success
            analytics.capture('subscription_restored', {
              is_active: subscriptionInfo.isActive,
              status: subscriptionInfo.status,
              product_id: subscriptionInfo.productId,
              is_trial: subscriptionInfo.isTrial,
            });
            if (subscriptionInfo.isActive) {
              setCanDismiss(true);
            }
          } catch (error) {
            console.error('Error tracking restore completion:', error);
          }
          
          handleClose('restore');
        }}
        onPurchaseError={({ error }) => {
          console.error('Paywall purchase error:', error);
          
          // Track purchase error
          analytics.capture('paywall_subscribe_error', {
            error_message: error?.message || 'unknown_error',
            error_code: error?.code || 'unknown',
            user_cancelled: error?.userCancelled || false,
          });
          
          // Track cancellation separately if user cancelled
          if (error?.userCancelled) {
            analytics.capture('paywall_subscribe_cancelled');
          }
        }}
        onRestoreError={({ error }) => {
          console.error('Paywall restore error:', error);
          
          // Track restore error
          analytics.capture('subscription_restore_error', {
            error_message: error?.message || 'unknown_error',
            error_code: error?.code || 'unknown',
          });
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

import { subscriptionService, type PurchasesOffering } from '@/lib/subscriptionService';
import { analytics } from '@/lib/analytics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import RevenueCatUI from 'react-native-purchases-ui';

export default function PaywallScreen() {
  const { user, loading } = useAuth();
  const params = useLocalSearchParams();
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [canDismiss, setCanDismiss] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [paywallOffering, setPaywallOffering] = useState<PurchasesOffering | null>(null);
  const paywallStartTimeRef = React.useRef<number>(Date.now());
  const paywallSource = params.source === 'settings' ? 'settings' : 'auto';
  const allowUserDismiss = paywallSource === 'settings' || canDismiss;
  const paywallOfferingId = 'Main';

  const handleClose = (
    reason: 'user' | 'purchase' | 'restore' | 'already_subscribed' | 'error' | 'preview' = 'user',
    options?: { profilePrompt?: boolean }
  ) => {
    if (!allowUserDismiss && reason === 'user') {
      return;
    }
    console.log('🚪 Closing paywall, navigating to home with bypass flag');
    // Track paywall dismissed (user closed without purchasing)
    analytics.capture('paywall_dismissed', { reason });
    const params: Record<string, string> = {
      bypassPaywall: 'true',
    };
    if (options?.profilePrompt) {
      params.profilePrompt = 'true';
    }
    router.push({
      pathname: '/(tabs)',
      params,
    });
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    analytics.screen('Paywall');
    // Track paywall viewed
    analytics.capture('paywall_viewed');
    paywallStartTimeRef.current = Date.now();
    let isActive = true;

    const init = async () => {
      try {
        const previewSnapshot = subscriptionService.getPaywallPreviewStatusFromMetadata(
          user?.user_metadata ?? null
        );
        setCanDismiss(!previewSnapshot.hasStarted);

        if (paywallSource !== 'settings' && previewSnapshot.isActive) {
          handleClose('preview');
          return;
        }

        await subscriptionService.initialize(user?.id);
        if (!subscriptionService.isConfigured()) {
          throw new Error('Subscriptions are unavailable. Please try again later.');
        }
        const info = await subscriptionService.getSubscriptionInfo();
        if (info.isActive) {
          setCanDismiss(true);
          if (paywallSource !== 'settings') {
            handleClose('already_subscribed');
            return;
          }
        }

        const offering = await subscriptionService.getOffering(paywallOfferingId);
        if (!offering) {
          throw new Error('Paywall offering is unavailable. Please try again later.');
        }
        setPaywallOffering(offering);
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
  }, [user?.id, loading, paywallSource]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const timeOnPaywallMs = Date.now() - paywallStartTimeRef.current;
        analytics.capture('paywall_abandoned', {
          source: paywallSource,
          time_on_paywall_ms: Math.max(0, timeOnPaywallMs),
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [paywallSource]);

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
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPreviewModal(false);
          handleClose('preview');
        }}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>We don't want to lose you</Text>
            <Text style={styles.previewBody}>
              Enjoy 3 days of full access on behalf of the Won Of One team - no card details needed.
            </Text>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => {
                setShowPreviewModal(false);
                handleClose('preview');
              }}
            >
              <Text style={styles.previewButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <RevenueCatUI.Paywall
        options={{
          displayCloseButton: allowUserDismiss,
          offering: paywallOffering,
        }}
        onDismiss={() => {
          if (!allowUserDismiss) {
            return;
          }
          if (paywallSource === 'settings') {
            handleClose('user');
            return;
          }
          void (async () => {
            try {
              const { status, granted } = await subscriptionService.grantPaywallPreview(user);
              if (granted) {
                analytics.capture('paywall_preview_started', {
                  ends_at: status.endsAt?.toISOString(),
                });
                setShowPreviewModal(true);
                return;
              }
              if (status.isActive) {
                setShowPreviewModal(true);
                return;
              }
              Alert.alert(
                'Preview already used',
                'Your free preview has ended. Please subscribe to continue.'
              );
            } catch (error) {
              console.error('❌ Failed to grant paywall preview:', error);
              Alert.alert(
                'Unable to start preview',
                'Please check your connection and try again.'
              );
            }
          })();
        }}
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
          
          handleClose('purchase', { profilePrompt: true });
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
          
          handleClose('restore', { profilePrompt: true });
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
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  previewContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1F1F1F',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  previewBody: {
    color: '#DADADA',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  previewButton: {
    backgroundColor: Colors.purple.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

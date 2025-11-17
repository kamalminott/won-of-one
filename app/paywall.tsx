import { subscriptionService } from '@/lib/subscriptionService';
import { analytics } from '@/lib/analytics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';

export default function PaywallScreen() {
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    analytics.screen('Paywall');
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await subscriptionService.getOfferings();
      if (offerings) {
        setOffering(offerings);
        // Default to monthly package if available
        const monthly = offerings.availablePackages.find(pkg => 
          pkg.identifier === '$rc_monthly' || pkg.packageType === 'MONTHLY'
        );
        const firstPackage = offerings.availablePackages[0];
        setSelectedPackage(monthly || firstPackage || null);
      }
    } catch (error) {
      console.error('Error loading offerings:', error);
      Alert.alert('Error', 'Failed to load subscription options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPackage) {
      Alert.alert('Error', 'Please select a subscription plan');
      return;
    }

    setPurchasing(selectedPackage.identifier);
    analytics.paywallSubscribeAttempt(selectedPackage.identifier);

    try {
      await subscriptionService.purchasePackage(selectedPackage);
      analytics.paywallSubscribeSuccess(selectedPackage.identifier);
      
      // Navigate to home after successful purchase
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error.message === 'Purchase cancelled by user') {
        analytics.paywallSubscribeCancelled();
        // Don't show alert for user cancellation
      } else {
        Alert.alert('Purchase Failed', error.message || 'Please try again.');
        analytics.paywallSubscribeError(error.message);
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await subscriptionService.restorePurchases();
      // Check if user now has active subscription
      const subscriptionInfo = await subscriptionService.getSubscriptionInfo();
      if (subscriptionInfo.isActive) {
        Alert.alert('Success', 'Your purchases have been restored!');
        router.replace('/(tabs)');
      } else {
        Alert.alert('No Purchases Found', 'We couldn\'t find any purchases to restore.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to restore purchases.');
    }
  };

  const formatPrice = (packageToFormat: PurchasesPackage) => {
    const product = packageToFormat.product;
    const price = product.priceString;
    const period = packageToFormat.packageType === 'MONTHLY' ? 'month' : 'year';
    return { price, period };
  };

  const features = [
    'Live Match Logging',
    'Advanced Analytics',
    'Unlimited Goals',
    'Match History',
    'Offline Sync',
  ];

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.purple.primary} />
        <Text style={styles.loadingText}>Loading subscription options...</Text>
      </View>
    );
  }

  return (
    <>
      <ExpoStatusBar style="light" />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: width * 0.08 }]}>
              Unlock Won Of One
            </Text>
            <View style={styles.trialBadge}>
              <Text style={[styles.trialText, { fontSize: width * 0.035 }]}>
                🎁 3-Day Free Trial
              </Text>
            </View>
            <Text style={[styles.subtitle, { fontSize: width * 0.04 }]}>
              Start your free trial, then continue with a subscription
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={width * 0.06} color={Colors.purple.primary} />
                <Text style={[styles.featureText, { fontSize: width * 0.04 }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* Subscription Options */}
          {offering && offering.availablePackages.length > 0 && (
            <View style={styles.packagesContainer}>
              {offering.availablePackages.map((pkg) => {
                const { price, period } = formatPrice(pkg);
                const isSelected = selectedPackage?.identifier === pkg.identifier;
                const isMonthly = pkg.packageType === 'MONTHLY';
                const isYearly = pkg.packageType === 'ANNUAL';

                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    onPress={() => setSelectedPackage(pkg)}
                    style={[
                      styles.packageCard,
                      isSelected && styles.packageCardSelected,
                      { width: width * 0.9 },
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark" size={width * 0.04} color="#FFF" />
                      </View>
                    )}
                    <View style={styles.packageContent}>
                      <View style={styles.packageHeader}>
                        <Text style={[styles.packageTitle, { fontSize: width * 0.045 }]}>
                          {isMonthly ? 'Monthly' : isYearly ? 'Yearly' : 'Premium'}
                        </Text>
                        {isYearly && (
                          <View style={styles.savingsBadge}>
                            <Text style={[styles.savingsText, { fontSize: width * 0.03 }]}>
                              Best Value
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.packagePrice, { fontSize: width * 0.07 }]}>
                        {price}
                      </Text>
                      <Text style={[styles.packagePeriod, { fontSize: width * 0.035 }]}>
                        per {period}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Subscribe Button */}
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={!selectedPackage || !!purchasing}
            style={[
              styles.subscribeButton,
              { width: width * 0.9 },
              (!selectedPackage || purchasing) && styles.subscribeButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={Colors.gradientButton.colors}
              start={Colors.gradientButton.start}
              end={Colors.gradientButton.end}
              style={styles.subscribeButtonGradient}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={[styles.subscribeButtonText, { fontSize: width * 0.045 }]}>
                  Start Free Trial
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Restore Purchases */}
          <TouchableOpacity
            onPress={handleRestorePurchases}
            style={styles.restoreButton}
          >
            <Text style={[styles.restoreText, { fontSize: width * 0.035 }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={[styles.termsText, { fontSize: width * 0.03 }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            Your subscription will auto-renew unless cancelled at least 24 hours before the end of the trial period.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },
  scrollContent: {
    paddingHorizontal: '5%',
    paddingTop: '8%',
    paddingBottom: '10%',
  },
  header: {
    alignItems: 'center',
    marginBottom: '8%',
  },
  title: {
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: '3%',
  },
  trialBadge: {
    backgroundColor: Colors.purple.primary,
    paddingHorizontal: '6%',
    paddingVertical: '2%',
    borderRadius: 20,
    marginBottom: '3%',
  },
  trialText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subtitle: {
    color: '#9D9D9D',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    marginBottom: '8%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '4%',
  },
  featureText: {
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: '3%',
  },
  packagesContainer: {
    marginBottom: '6%',
  },
  packageCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: '5%',
    marginBottom: '4%',
    borderWidth: 2,
    borderColor: '#464646',
    position: 'relative',
  },
  packageCardSelected: {
    borderColor: Colors.purple.primary,
    backgroundColor: '#2F2A3A',
  },
  selectedBadge: {
    position: 'absolute',
    top: '5%',
    right: '5%',
    backgroundColor: Colors.purple.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageContent: {
    marginRight: '8%',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '2%',
  },
  packageTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: '3%',
  },
  savingsBadge: {
    backgroundColor: Colors.green.accent,
    paddingHorizontal: '3%',
    paddingVertical: '1%',
    borderRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  packagePrice: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: '1%',
  },
  packagePeriod: {
    color: '#9D9D9D',
  },
  subscribeButton: {
    marginBottom: '4%',
    borderRadius: 16,
    overflow: 'hidden',
    ...Colors.gradientButton,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonGradient: {
    paddingVertical: '4%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    marginBottom: '4%',
  },
  restoreText: {
    color: Colors.purple.primary,
    fontWeight: '500',
  },
  termsText: {
    color: '#9D9D9D',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: '4%',
    fontSize: 16,
  },
});


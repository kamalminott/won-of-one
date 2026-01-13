/**
 * Subscription Service
 * Handles RevenueCat subscriptions and syncs with Supabase
 */

import { Platform } from 'react-native';
import { postgrestInsert, postgrestSelectOne } from './postgrest';
import { supabase } from './supabase';

// Lazy import RevenueCat (only available in production builds, not dev mode)
let Purchases: any = null;
let CustomerInfo: any = null;
let PurchasesOffering: any = null;
let PurchasesPackage: any = null;

try {
  const purchasesModule = require('react-native-purchases');
  Purchases = purchasesModule.default;
  CustomerInfo = purchasesModule.CustomerInfo;
  PurchasesOffering = purchasesModule.PurchasesOffering;
  PurchasesPackage = purchasesModule.PurchasesPackage;
} catch (error) {
  // RevenueCat not available in dev mode - that's okay
  console.log('📦 RevenueCat native module not available (dev mode)');
}

// RevenueCat API Key (production via env; test key fallback for dev builds only)
const DEV_FALLBACK_REVENUECAT_API_KEY = 'test_EzQiXQCiDOqTcPKqVVrBbjbdjvU';
const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  default: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
}) || '';

const getRevenueCatApiKey = () => {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (REVENUECAT_API_KEY) return REVENUECAT_API_KEY;
  return isDev ? DEV_FALLBACK_REVENUECAT_API_KEY : '';
};

// Subscription status types
export type SubscriptionStatus = 'active' | 'expired' | 'trial' | 'none';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  isActive: boolean;
  isTrial: boolean;
  expiresAt: Date | null;
  productId: string | null;
  entitlementId: string | null;
}

// Export types for use in other files
// In dev mode, these will be null, but TypeScript will still allow the types
export type CustomerInfo = any;
export type PurchasesOffering = any;
export type PurchasesPackage = any;

// Initialize RevenueCat
let isInitialized = false;
let isActuallyConfigured = false; // Track if RevenueCat SDK is actually configured (not just skipped)

export const subscriptionService = {
  /**
   * Initialize RevenueCat SDK
   * Call this when the app starts (e.g., in _layout.tsx)
   */
  async initialize(userId?: string): Promise<void> {
    if (isInitialized) {
      console.log('📦 RevenueCat already initialized');
      return;
    }

    try {
      // Skip test keys in production builds (RevenueCat can crash in release with test keys)
      const apiKey = getRevenueCatApiKey();
      const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
      const isTestKey = !!apiKey && apiKey.startsWith('test_');

      if (!apiKey) {
        console.warn('⚠️ RevenueCat API key missing - skipping initialization');
        isInitialized = true;
        isActuallyConfigured = false;
        return;
      }

      if (isTestKey && !isDev) {
        console.warn('⚠️ RevenueCat test API key detected - skipping initialization to prevent app crash');
        console.warn('⚠️ Configure a production API key in RevenueCat dashboard to enable subscriptions');
        // Mark as initialized to prevent retry loops, but don't actually configure
        isInitialized = true;
        isActuallyConfigured = false;
        return;
      }

      if (isTestKey && isDev) {
        console.warn('⚠️ RevenueCat test API key detected - allowed in dev build');
      }

      if (!Purchases) {
        console.warn('⚠️ RevenueCat SDK not available - skipping configuration');
        isInitialized = true;
        isActuallyConfigured = false;
        return;
      }

      await Purchases.configure({ apiKey });
      isInitialized = true;
      isActuallyConfigured = true;
      console.log('✅ RevenueCat initialized');

      // Set user ID if provided (link RevenueCat user to your app user)
      if (userId && Purchases) {
        await Purchases.logIn(userId);
        console.log('✅ RevenueCat user linked:', userId);
      }

      // Set up listener for subscription updates
      if (Purchases) {
        Purchases.addCustomerInfoUpdateListener(async (customerInfo: CustomerInfo) => {
          console.log('📦 Subscription status updated');
          if (userId) {
            await subscriptionService.syncSubscriptionToSupabase(userId, customerInfo);
          }
        });
      }
    } catch (error: any) {
      // Don't crash the app if RevenueCat fails to initialize
      console.error('❌ Error initializing RevenueCat (non-fatal):', error?.message || error);
      // Mark as initialized anyway to prevent retry loops
      isInitialized = true;
      // Don't throw - allow app to continue without RevenueCat
    }
  },

  /**
   * Check if RevenueCat is configured and ready to use
   */
  isConfigured(): boolean {
    return !!isActuallyConfigured && !!Purchases;
  },

  /**
   * Get current subscription offerings (products available for purchase)
   */
  async getOfferings(): Promise<PurchasesOffering | null> {
    // If RevenueCat isn't initialized, return null
    if (!isActuallyConfigured || !Purchases) {
      console.warn('⚠️ RevenueCat not initialized - cannot fetch offerings');
      return null;
    }

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error: any) {
      console.error('❌ Error fetching offerings (non-fatal):', error?.message || error);
      return null;
    }
  },

  /**
   * Purchase a subscription package
   */
  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<CustomerInfo> {
    if (!isActuallyConfigured || !Purchases) {
      throw new Error('RevenueCat is not configured. Please set up a production API key.');
    }
    
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      console.log('✅ Purchase successful');
      
      // Sync to Supabase if user is logged in
      const userId = await this.getCurrentUserId();
      if (userId) {
        await this.syncSubscriptionToSupabase(userId, customerInfo);
      }

      return customerInfo;
    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      
      // Handle user cancellation gracefully
      if (error.userCancelled) {
        throw new Error('Purchase cancelled by user');
      }
      
      throw error;
    }
  },

  /**
   * Restore purchases (for users who reinstalled the app)
   */
  async restorePurchases(): Promise<CustomerInfo> {
    if (!isActuallyConfigured || !Purchases) {
      throw new Error('RevenueCat is not configured. Please set up a production API key.');
    }
    
    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log('✅ Purchases restored');

      // Sync to Supabase if user is logged in
      const userId = await this.getCurrentUserId();
      if (userId) {
        await this.syncSubscriptionToSupabase(userId, customerInfo);
      }

      return customerInfo;
    } catch (error) {
      console.error('❌ Error restoring purchases:', error);
      throw error;
    }
  },

  /**
   * Get current subscription info
   */
  async getSubscriptionInfo(): Promise<SubscriptionInfo> {
    // If RevenueCat isn't actually configured, return no subscription
    if (!isActuallyConfigured) {
      return {
        status: 'none',
        isActive: false,
        isTrial: false,
        expiresAt: null,
        productId: null,
        entitlementId: null,
      };
    }

    try {
      if (!Purchases) {
        return {
          status: 'none',
          isActive: false,
          isTrial: false,
          expiresAt: null,
          productId: null,
          entitlementId: null,
        };
      }
      const customerInfo = await Purchases.getCustomerInfo();
      return this.parseCustomerInfo(customerInfo);
    } catch (error: any) {
      console.error('❌ Error getting subscription info (non-fatal):', error?.message || error);
      // Return no subscription on error instead of crashing
      return {
        status: 'none',
        isActive: false,
        isTrial: false,
        expiresAt: null,
        productId: null,
        entitlementId: null,
      };
    }
  },

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const info = await this.getSubscriptionInfo();
      return info.isActive;
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      return false;
    }
  },

  /**
   * Parse RevenueCat CustomerInfo to our SubscriptionInfo format
   */
  parseCustomerInfo(customerInfo: CustomerInfo): SubscriptionInfo {
    // Check for active entitlements (you can define these in RevenueCat dashboard)
    const activeEntitlements = Object.values((customerInfo as any).entitlements?.active || {});
    
    if (activeEntitlements.length > 0) {
      const entitlement = activeEntitlements[0] as any;
      const isTrial = entitlement.periodType === 'TRIAL';
      const expiresAt = entitlement.expirationDate 
        ? new Date(entitlement.expirationDate) 
        : null;

      return {
        status: isTrial ? 'trial' : 'active',
        isActive: true,
        isTrial,
        expiresAt,
        productId: entitlement.productIdentifier,
        entitlementId: entitlement.identifier,
      };
    }

    // Check if there are any expired entitlements
    const allEntitlements = Object.values((customerInfo as any).entitlements?.all || {});
    const hasExpired = allEntitlements.some((e: any) => !e.isActive);

    return {
      status: hasExpired ? 'expired' : 'none',
      isActive: false,
      isTrial: false,
      expiresAt: null,
      productId: null,
      entitlementId: null,
    };
  },

  /**
   * Sync subscription status to Supabase
   * This keeps your database in sync with RevenueCat
   */
  async syncSubscriptionToSupabase(userId: string, customerInfo: CustomerInfo): Promise<void> {
    try {
      const subscriptionInfo = this.parseCustomerInfo(customerInfo);

      // Upsert subscription status to Supabase
      const { error } = await postgrestInsert(
        'user_subscriptions',
        {
          user_id: userId,
          subscription_status: subscriptionInfo.status,
          is_active: subscriptionInfo.isActive,
          is_trial: subscriptionInfo.isTrial,
          expires_at: subscriptionInfo.expiresAt?.toISOString() || null,
          product_id: subscriptionInfo.productId,
          entitlement_id: subscriptionInfo.entitlementId,
          revenuecat_user_id: customerInfo.originalAppUserId,
          updated_at: new Date().toISOString(),
        },
        {
          on_conflict: 'user_id',
        },
        {
          prefer: 'resolution=merge-duplicates, return=minimal',
        }
      );

      if (error) {
        console.error('❌ Error syncing subscription to Supabase:', error);
      } else {
        console.log('✅ Subscription synced to Supabase');
      }
    } catch (error) {
      console.error('❌ Error in syncSubscriptionToSupabase:', error);
    }
  },

  /**
   * Get subscription status from Supabase (faster than RevenueCat API)
   */
  async getSubscriptionFromSupabase(
    userId: string,
    accessToken?: string | null
  ): Promise<SubscriptionInfo | null> {
    try {
      const { data, error } = await postgrestSelectOne<{
        subscription_status: SubscriptionStatus;
        is_active: boolean;
        is_trial: boolean;
        expires_at: string | null;
        product_id: string | null;
        entitlement_id: string | null;
      }>(
        'user_subscriptions',
        {
          select: '*',
          user_id: `eq.${userId}`,
          limit: 1,
        },
        accessToken ? { accessToken } : undefined
      );

      if (error || !data) {
        return null;
      }

      return {
        status: data.subscription_status as SubscriptionStatus,
        isActive: data.is_active,
        isTrial: data.is_trial,
        expiresAt: data.expires_at ? new Date(data.expires_at) : null,
        productId: data.product_id,
        entitlementId: data.entitlement_id,
      };
    } catch (error) {
      console.error('❌ Error getting subscription from Supabase:', error);
      return null;
    }
  },

  /**
   * Get current user ID from Supabase auth
   */
  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      console.error('❌ Error getting current user ID:', error);
      return null;
    }
  },

  /**
   * Link RevenueCat user to your app user
   */
  async linkUser(userId: string): Promise<void> {
    if (!Purchases || !isActuallyConfigured) {
      console.warn('⚠️ RevenueCat not configured - skipping linkUser');
      return;
    }
    try {
      await Purchases.logIn(userId);
      console.log('✅ RevenueCat user linked:', userId);
      
      // Sync current subscription status
      const customerInfo = await Purchases.getCustomerInfo();
      await this.syncSubscriptionToSupabase(userId, customerInfo);
    } catch (error) {
      console.error('❌ Error linking user:', error);
      throw error;
    }
  },

  /**
   * Log out RevenueCat user (when user logs out of your app)
   */
  async logOut(): Promise<void> {
    if (!Purchases || !isActuallyConfigured) {
      console.warn('⚠️ RevenueCat not configured - skipping logOut');
      return;
    }
    try {
      await Purchases.logOut();
      console.log('✅ RevenueCat user logged out');
    } catch (error) {
      console.error('❌ Error logging out RevenueCat user:', error);
    }
  },
};

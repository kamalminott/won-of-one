# Subscription Setup Guide

This guide will help you set up subscriptions using RevenueCat and Supabase.

## ✅ What's Already Done

1. ✅ RevenueCat packages installed (`react-native-purchases`, `react-native-purchases-ui`)
2. ✅ Subscription service created (`lib/subscriptionService.ts`)
3. ✅ RevenueCat initialized in app (`app/_layout.tsx`)
4. ✅ User linking on login (`contexts/AuthContext.tsx`)

## 📋 Next Steps

### 1. Create Database Table in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- See: supabase/migrations/create_user_subscriptions.sql
```

Or run the migration file directly in Supabase Dashboard → SQL Editor.

### 2. Configure RevenueCat Dashboard

1. **Go to RevenueCat Dashboard**: https://app.revenuecat.com
2. **Add Your Apps**:
   - Add iOS app (App Store Connect)
   - Add Android app (Google Play Console)
3. **Create Products**:
   - Go to Products → Create Product
   - Define subscription tiers (e.g., "Premium Monthly", "Premium Yearly")
4. **Create Entitlements**:
   - Go to Entitlements → Create Entitlement
   - Name it (e.g., "premium")
   - Link products to this entitlement
5. **Create Offerings**:
   - Go to Offerings → Create Offering
   - Add your packages (Monthly, Yearly, etc.)

### 3. Set Up App Store Products

#### iOS (App Store Connect):
1. Go to App Store Connect → Your App → Subscriptions
2. Create subscription group
3. Add subscription products (Monthly, Yearly)
4. Set prices and availability
5. Link to RevenueCat in RevenueCat dashboard

#### Android (Google Play Console):
1. Go to Google Play Console → Your App → Monetization → Subscriptions
2. Create subscription products
3. Set prices and billing periods
4. Link to RevenueCat in RevenueCat dashboard

### 4. Update API Keys (When Ready for Production)

When you're ready to go live, update the API keys in `lib/subscriptionService.ts`:

```typescript
const REVENUECAT_API_KEY = Platform.select({
  ios: 'your_production_ios_key',
  android: 'your_production_android_key',
  default: 'your_production_key',
});
```

## 🔧 Usage Examples

### Check Subscription Status

```typescript
import { subscriptionService } from '@/lib/subscriptionService';

// Check if user has active subscription
const hasActive = await subscriptionService.hasActiveSubscription();

// Get full subscription info
const info = await subscriptionService.getSubscriptionInfo();
console.log('Status:', info.status); // 'active' | 'expired' | 'trial' | 'none'
console.log('Is Active:', info.isActive);
console.log('Expires At:', info.expiresAt);
```

### Show Paywall

```typescript
import { subscriptionService } from '@/lib/subscriptionService';
import { presentPaywall } from 'react-native-purchases-ui';

// Get available offerings
const offering = await subscriptionService.getOfferings();

if (offering) {
  // Show paywall
  await presentPaywall({
    offering: offering,
    listener: {
      onPurchaseCompleted: async (customerInfo) => {
        console.log('Purchase completed!');
        // Subscription is automatically synced to Supabase
      },
      onPurchaseError: (error) => {
        console.error('Purchase error:', error);
      },
    },
  });
}
```

### Purchase Package Directly

```typescript
import { subscriptionService } from '@/lib/subscriptionService';

const offering = await subscriptionService.getOfferings();
if (offering?.availablePackages.length > 0) {
  const packageToPurchase = offering.availablePackages[0]; // e.g., monthly
  try {
    const customerInfo = await subscriptionService.purchasePackage(packageToPurchase);
    console.log('Purchase successful!');
  } catch (error) {
    if (error.message === 'Purchase cancelled by user') {
      console.log('User cancelled');
    } else {
      console.error('Purchase failed:', error);
    }
  }
}
```

### Restore Purchases

```typescript
import { subscriptionService } from '@/lib/subscriptionService';

try {
  await subscriptionService.restorePurchases();
  console.log('Purchases restored!');
} catch (error) {
  console.error('Restore failed:', error);
}
```

### Check Subscription from Supabase (Faster)

```typescript
import { subscriptionService } from '@/lib/subscriptionService';

const userId = 'user-id-here';
const subscription = await subscriptionService.getSubscriptionFromSupabase(userId);

if (subscription?.isActive) {
  console.log('User has active subscription');
}
```

## 🔐 Security Notes

- The API key in `subscriptionService.ts` is a **test key** - safe to commit
- Production keys should be stored in environment variables
- RevenueCat handles all payment processing securely
- Subscription status is synced to Supabase for fast lookups

## 📊 Database Schema

The `user_subscriptions` table stores:
- `user_id`: Links to your auth.users table
- `subscription_status`: 'active' | 'expired' | 'trial' | 'none'
- `is_active`: Boolean flag for quick checks
- `is_trial`: Whether user is in trial period
- `expires_at`: When subscription expires
- `product_id`: RevenueCat product identifier
- `entitlement_id`: RevenueCat entitlement identifier
- `revenuecat_user_id`: RevenueCat's user ID

## 🧪 Testing

1. Use RevenueCat's sandbox environment (automatic with test API key)
2. Test purchases with sandbox accounts:
   - iOS: Create sandbox tester in App Store Connect
   - Android: Use test account in Google Play Console
3. Check subscription status in Supabase after purchase

## 🚀 Going Live

1. Switch to production API keys in RevenueCat dashboard
2. Update API keys in `subscriptionService.ts`
3. Test with real purchases (small amount first)
4. Monitor RevenueCat dashboard for subscription events
5. Set up webhooks (optional) for server-side notifications

## 📚 Resources

- [RevenueCat Docs](https://docs.revenuecat.com/)
- [React Native Purchases](https://github.com/RevenueCat/react-native-purchases)
- [RevenueCat Dashboard](https://app.revenuecat.com)


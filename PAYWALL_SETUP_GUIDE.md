# Paywall Setup Guide - Full App Access with 3-Day Free Trial

## 🎯 **What We're Building**

A paywall that:
- **Gates the entire app** - Users must subscribe to access anything
- **3-day free trial** - Users get 3 days free, then must pay
- **Shows after login/registration** - First thing users see after signing up

---

## 📋 **Implementation Plan**

### **Step 1: Create Paywall Screen**
- Beautiful paywall UI with subscription options
- Shows trial information
- Subscribe buttons

### **Step 2: Add Subscription Check**
- Check if user has active subscription
- Check if user is in trial period
- Check if trial has expired

### **Step 3: Update Navigation Flow**
```
User logs in/registers
  ↓
Check subscription status
  ↓
If no subscription/trial → Show paywall
  ↓
If trial active → Allow access
  ↓
If subscription active → Allow access
```

### **Step 4: Configure RevenueCat**
- Set up 3-day free trial
- Create subscription products
- Link to App Store/Play Store

---

## 🛠️ **What We'll Build**

1. **Paywall Screen Component** (`app/paywall.tsx`)
2. **Subscription Check Hook** (check subscription status)
3. **Navigation Guard** (redirect to paywall if needed)
4. **Trial Tracking** (track when trial started)

---

## 📱 **User Flow**

### **New User:**
1. Signs up → Sees paywall
2. Starts 3-day free trial
3. Can use app for 3 days
4. After 3 days → Must subscribe to continue

### **Returning User (Trial Active):**
1. Logs in → Checks subscription
2. Trial still active → Access granted
3. Uses app normally

### **Returning User (Trial Expired):**
1. Logs in → Checks subscription
2. Trial expired → Shows paywall
3. Must subscribe to continue

### **Subscribed User:**
1. Logs in → Checks subscription
2. Subscription active → Access granted
3. Uses app normally

---

## ⚙️ **RevenueCat Configuration**

### **1. Create Products with Free Trial**

**In RevenueCat Dashboard:**
- Product: "Premium Monthly"
  - Price: $X.XX/month
  - Free Trial: 3 days
- Product: "Premium Yearly"
  - Price: $XX.XX/year
  - Free Trial: 3 days

### **2. Create Entitlement**
- Name: "premium"
- Links to both products
- Grants full app access

### **3. Create Offering**
- Name: "Default Offering"
- Includes Monthly and Yearly packages
- Both with 3-day free trial

---

## 🔧 **Code Changes Needed**

1. **Create Paywall Screen** - New file
2. **Update Home Screen** - Add subscription check
3. **Update Auth Context** - Track subscription status
4. **Update Navigation** - Redirect to paywall when needed

---

## 📊 **Subscription Status Logic**

```typescript
// Check subscription status
const subscriptionStatus = await subscriptionService.getSubscriptionInfo();

if (subscriptionStatus.isActive) {
  // User has active subscription → Allow access
} else if (subscriptionStatus.isTrial && !subscriptionStatus.trialExpired) {
  // User is in trial period → Allow access
} else {
  // No subscription, trial expired, or never started → Show paywall
}
```

---

## 🎨 **Paywall UI Features**

- **Hero Section**: App name, tagline
- **Trial Badge**: "3-Day Free Trial"
- **Features List**: Top 5 premium features
- **Pricing Options**: Monthly vs Yearly
- **Subscribe Buttons**: Clear CTAs
- **Terms & Privacy**: Links to terms
- **Restore Purchases**: Button for existing users

---

## ⏱️ **Trial Management**

### **Trial Start:**
- Starts when user first subscribes (even if free trial)
- Tracked by RevenueCat automatically
- Stored in Supabase for quick checks

### **Trial Expiration:**
- After 3 days, trial ends
- User must pay to continue
- Access blocked until subscription active

### **Trial Status Check:**
- Check RevenueCat for trial status
- Check Supabase for cached status
- Handle offline scenarios

---

## 🚀 **Next Steps**

1. ✅ Create paywall screen component
2. ✅ Add subscription check logic
3. ✅ Update navigation flow
4. ✅ Configure RevenueCat with 3-day trial
5. ✅ Test trial flow
6. ✅ Test subscription flow

---

Let's start building!


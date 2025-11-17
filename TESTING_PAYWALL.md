# Testing the Paywall on Your Device

## 🎯 **Quick Answer**

To see the paywall on your device, you have **two options**:

### **Option 1: Test the UI (Recommended for Now)**
Since RevenueCat isn't configured yet, you can temporarily force the paywall to show.

### **Option 2: Wait for RevenueCat Setup**
Once RevenueCat is configured, the paywall will automatically show for users without subscriptions.

---

## 📱 **Option 1: Force Paywall to Show (Test UI)**

### **Step 1: Install the Preview Build**
If you haven't already:
- **Android**: Scan the QR code or open the link from your build
- **iOS**: Scan the QR code or open the link from your build

### **Step 2: Temporarily Modify Code**

Open `app/(tabs)/index.tsx` and find the subscription check (around line 64-98).

**Replace this:**
```typescript
// Check subscription status and redirect to paywall if needed
useEffect(() => {
  const checkSubscription = async () => {
    if (!user || loading) return;

    try {
      const subscriptionInfo = await subscriptionService.getSubscriptionInfo();
      
      // If user has no active subscription and no active trial, show paywall
      if (!subscriptionInfo.isActive && !subscriptionInfo.isTrial) {
        console.log('🔒 No active subscription or trial, redirecting to paywall');
        router.replace('/paywall');
      } else if (subscriptionInfo.isTrial && subscriptionInfo.expiresAt) {
        // Check if trial has expired
        const now = new Date();
        const expiresAt = subscriptionInfo.expiresAt;
        if (now >= expiresAt) {
          console.log('⏰ Trial expired, redirecting to paywall');
          router.replace('/paywall');
        } else {
          console.log('✅ Trial active, allowing access');
        }
      } else if (subscriptionInfo.isActive) {
        console.log('✅ Active subscription, allowing access');
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      // On error, allow access (fail open) - you can change this to fail closed if preferred
    }
  };

  if (user && !loading) {
    checkSubscription();
  }
}, [user, loading]);
```

**With this (temporary for testing):**
```typescript
// TEMPORARY: Force paywall to show for testing
useEffect(() => {
  if (!user || loading) return;
  
  // Force redirect to paywall for testing
  console.log('🧪 TESTING: Forcing paywall to show');
  router.replace('/paywall');
}, [user, loading]);
```

### **Step 3: Push OTA Update**
```bash
eas update --branch preview --message "Test paywall UI"
```

### **Step 4: Test on Device**
1. Open the app
2. Log in
3. You should see the paywall immediately

### **Step 5: Revert After Testing**
Change the code back to the original subscription check logic.

---

## 📱 **Option 2: Test with RevenueCat (After Setup)**

Once RevenueCat is configured:

### **Step 1: Install Preview Build**
- Make sure you have the latest build installed

### **Step 2: Log In**
- Use a test account (or create a new one)

### **Step 3: Paywall Should Show**
- If the account has no subscription, paywall will show automatically
- If the account has a subscription, you'll see the home screen

### **Step 4: Test Subscription Flow**
- Click "Start Free Trial" on paywall
- Complete purchase (will use sandbox/test mode)
- Should redirect to home screen

---

## 🧪 **Testing Scenarios**

### **Scenario 1: New User (No Subscription)**
1. Create new account
2. Log in
3. **Expected**: Paywall shows immediately

### **Scenario 2: User with Trial**
1. User who started trial
2. Log in
3. **Expected**: Home screen (trial active)

### **Scenario 3: User with Expired Trial**
1. User whose trial expired
2. Log in
3. **Expected**: Paywall shows

### **Scenario 4: Subscribed User**
1. User with active subscription
2. Log in
3. **Expected**: Home screen

---

## 🔧 **Quick Test Without RevenueCat**

If you want to test the paywall UI **right now** without RevenueCat setup:

1. **Modify the subscription check** (as shown in Option 1)
2. **Push OTA update**: `eas update --branch preview --message "Test paywall"`
3. **Open app and log in** → Paywall will show
4. **Test the UI**:
   - See if design looks good
   - Check if buttons work
   - Verify text is readable
   - Test on different screen sizes

**Note**: The subscribe button won't work until RevenueCat is configured, but you can see the UI.

---

## 📊 **What You'll See**

When the paywall shows, you'll see:
- ✅ "Unlock Won Of One" title
- ✅ "🎁 3-Day Free Trial" badge
- ✅ Top 5 features list
- ✅ Monthly and Yearly subscription options
- ✅ "Start Free Trial" button
- ✅ "Restore Purchases" link
- ✅ Terms and privacy text

---

## ⚠️ **Important Notes**

1. **Subscribe Button Won't Work Yet**: Until RevenueCat is configured, clicking subscribe will show an error. This is expected.

2. **Restore Purchases**: Also won't work until RevenueCat is set up.

3. **After RevenueCat Setup**: Everything will work automatically - no code changes needed.

---

## 🚀 **Recommended Approach**

1. **Now**: Test the UI using Option 1 (force paywall to show)
2. **Then**: Configure RevenueCat
3. **Finally**: Test the full flow with real subscriptions

This way you can:
- ✅ See the paywall design
- ✅ Verify it looks good on your device
- ✅ Make any UI adjustments
- ✅ Then test the actual subscription flow

---

**Want me to help you set up the temporary test code, or would you prefer to configure RevenueCat first?**


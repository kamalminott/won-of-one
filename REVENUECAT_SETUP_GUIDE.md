# RevenueCat Setup Guide - Step by Step

## 📱 Step 1: Add Your Apps to RevenueCat

### **Where to Find "Add App" in RevenueCat Dashboard:**

1. **Log in to RevenueCat**: https://app.revenuecat.com
2. **Look for the "Projects" section** in the left sidebar
3. **If you don't have a project yet:**
   - Click **"+ New Project"** or **"Create Project"**
   - Name it: "Won Of One" or "Won-Of-One"
   - Click **"Create"**

4. **Once you have a project, you'll see:**
   - **"Apps"** in the left sidebar
   - Click on **"Apps"**
   - You should see a **"+ Add App"** or **"Add New App"** button (usually top right)

### **If you can't find "Add App":**

- Make sure you're in a **Project** (not just the dashboard)
- Check if you need to create a project first
- Look for a **"+"** icon or **"New"** button in the top navigation
- The button might say **"Add App"**, **"New App"**, or **"Create App"**

---

## 📱 Step 2: Add iOS App

### **When you click "Add App":**

1. **Select Platform**: Choose **"iOS"**
2. **App Information**:
   - **App Name**: `Won Of One`
   - **Bundle ID**: `com.kamalminott.wonofone` (from your app.json)
   - **App Store Connect API Key**: (You'll need to set this up - see below)

3. **Click "Add App"** or **"Create"**

### **App Store Connect API Key Setup:**

You'll need to connect RevenueCat to App Store Connect:

1. **Go to App Store Connect**: https://appstoreconnect.apple.com
2. **Navigate to**: Users and Access → Keys → App Store Connect API
3. **Create a new key** (if you don't have one):
   - Click **"Generate API Key"**
   - Name it: "RevenueCat Integration"
   - Select **"Admin"** or **"App Manager"** role
   - Download the key file (`.p8` file)
   - Copy the **Key ID** and **Issuer ID**

4. **Back in RevenueCat**:
   - Enter the **Key ID**
   - Enter the **Issuer ID**
   - Upload the **`.p8` file**

**Note**: If you haven't created your app in App Store Connect yet, you can skip this for now and add it later. RevenueCat will work with test mode.

---

## 🤖 Step 3: Add Android App

1. **Click "Add App"** again (or "+" button)
2. **Select Platform**: Choose **"Android"**
3. **App Information**:
   - **App Name**: `Won Of One`
   - **Package Name**: `com.kamalminott.wonofone` (from your app.json)
   - **Google Play Service Account**: (You'll need to set this up - see below)

4. **Click "Add App"** or **"Create"**

### **Google Play Service Account Setup:**

1. **Go to Google Play Console**: https://play.google.com/console
2. **Navigate to**: Setup → API access
3. **Create Service Account**:
   - Click **"Create Service Account"**
   - Follow Google's instructions
   - Grant access to your app
   - Download the JSON key file

4. **Back in RevenueCat**:
   - Upload the **JSON key file**

**Note**: If you haven't created your app in Google Play Console yet, you can skip this for now. RevenueCat will work with test mode.

---

## 🔑 Step 4: Get Your API Keys

After adding your apps, you'll get API keys:

1. **Go to your app** in RevenueCat dashboard
2. **Click on "API Keys"** or look in the app settings
3. **You'll see**:
   - **Public API Key** (starts with `rc_` or `test_`)
   - **Secret Key** (keep this private)

4. **Copy the Public API Key** - this is what you'll use in your app

### **Update Your Code:**

Your API key is already in the code (`test_EzQiXQCiDOqTcPKqVVrBbjbdjvU`), but when you get your actual keys from RevenueCat:

1. **For iOS**: Get the iOS-specific API key
2. **For Android**: Get the Android-specific API key
3. **Update** `lib/subscriptionService.ts`:

```typescript
const REVENUECAT_API_KEY = Platform.select({
  ios: 'your_ios_api_key_here', // From RevenueCat iOS app
  android: 'your_android_api_key_here', // From RevenueCat Android app
  default: 'your_default_key_here',
});
```

---

## 📦 Step 5: Create Products

1. **In RevenueCat Dashboard**, go to **"Products"** (left sidebar)
2. **Click "+ Create Product"** or **"Add Product"**
3. **Create your subscription products**:
   - **Product 1**: "Premium Monthly"
     - Type: Subscription
     - Identifier: `premium_monthly`
     - Price: Set your monthly price
   
   - **Product 2**: "Premium Yearly"
     - Type: Subscription
     - Identifier: `premium_yearly`
     - Price: Set your yearly price

---

## 🎯 Step 6: Create Entitlement

1. **Go to "Entitlements"** (left sidebar)
2. **Click "+ Create Entitlement"** or **"Add Entitlement"**
3. **Create Entitlement**:
   - **Identifier**: `premium` (this is what you'll check in code)
   - **Display Name**: "Premium"
   - **Description**: "Premium subscription access"

4. **Link Products**:
   - Add your "Premium Monthly" product
   - Add your "Premium Yearly" product

---

## 📋 Step 7: Create Offering

1. **Go to "Offerings"** (left sidebar)
2. **Click "+ Create Offering"** or **"Add Offering"**
3. **Create Offering**:
   - **Identifier**: `default` (or `premium`)
   - **Display Name**: "Premium Subscription"

4. **Add Packages**:
   - **Package 1**: Monthly
     - Select "Premium Monthly" product
     - Package Type: Monthly
   
   - **Package 2**: Yearly
     - Select "Premium Yearly" product
     - Package Type: Annual

5. **Set as Default Offering** (if available)

---

## 🧪 Step 8: Test Mode

RevenueCat has a **sandbox/test mode** that works automatically:

- **Test API Keys** (like `test_EzQiXQCiDOqTcPKqVVrBbjbdjvU`) work in sandbox
- You can test purchases without real App Store/Play Store setup
- Use sandbox test accounts for testing

---

## 🚨 Troubleshooting: Can't Find "Add App"

### **Option 1: Check Your Dashboard View**
- Make sure you're logged in
- Check if you're in the correct project
- Look for a **"Projects"** dropdown in the top navigation

### **Option 2: RevenueCat Interface Might Have Changed**
- Look for **"Apps"** in the left sidebar
- Click on it - you should see a list or an "Add" button
- Check the top right corner for **"+"**, **"New"**, or **"Add"** buttons

### **Option 3: You Might Need to Complete Onboarding**
- RevenueCat might have a setup wizard
- Complete any initial setup steps
- Look for "Get Started" or "Setup" buttons

### **Option 4: Check URL**
- Make sure you're at: https://app.revenuecat.com
- Not the marketing site (revenuecat.com)

### **Option 5: Contact Support**
- RevenueCat has good support
- Use the chat widget in the dashboard
- Or email: support@revenuecat.com

---

## 📸 Visual Guide Locations

**Where to look in RevenueCat Dashboard:**

```
RevenueCat Dashboard
├── Projects (top navigation or sidebar)
│   └── Your Project Name
│       ├── Apps ← CLICK HERE
│       │   └── [+ Add App] ← THIS BUTTON
│       ├── Products
│       ├── Entitlements
│       └── Offerings
```

---

## ✅ Quick Checklist

- [ ] Logged into RevenueCat dashboard
- [ ] Created/selected a Project
- [ ] Found "Apps" section
- [ ] Added iOS app (Bundle ID: `com.kamalminott.wonofone`)
- [ ] Added Android app (Package: `com.kamalminott.wonofone`)
- [ ] Got API keys from RevenueCat
- [ ] Created Products (Monthly, Yearly)
- [ ] Created Entitlement (`premium`)
- [ ] Created Offering (`default`)
- [ ] Updated API keys in code (if different from test key)

---

## 🎯 Next Steps After Adding Apps

1. **Test the integration** in your app
2. **Set up App Store Connect** (for iOS production)
3. **Set up Google Play Console** (for Android production)
4. **Create subscription products** in App Store/Play Store
5. **Link them** in RevenueCat dashboard

---

**Need help?** If you still can't find where to add apps, describe what you see in your RevenueCat dashboard and I can guide you more specifically!


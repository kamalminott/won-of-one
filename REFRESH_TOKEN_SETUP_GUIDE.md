# Refresh Token Implementation Guide

## Step-by-Step Supabase Dashboard Configuration

### Step 1: Access Supabase Authentication Settings

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **Won Of One**
3. Navigate to: **Authentication** → **Settings** (in the left sidebar)

### Step 2: Configure JWT Expiration Settings

In the Authentication Settings page, look for:

#### **JWT Expiry Settings:**
- **Access Token Expiry**: Default is 3600 seconds (1 hour) - **Keep this as is**
- **Refresh Token Expiry**: Default is usually 30-60 days - **You can extend this**

**Recommended Settings:**
- **Access Token**: 3600 seconds (1 hour) ✅ Keep default
- **Refresh Token**: 2592000 seconds (30 days) or 5184000 seconds (60 days)

**To change refresh token expiry:**
1. Look for "JWT expiry" or "Token expiry" section
2. Find "Refresh token expiry" or "Refresh token lifetime"
3. Set to your preferred duration (in seconds):
   - 30 days = 2,592,000 seconds
   - 60 days = 5,184,000 seconds
   - 90 days = 7,776,000 seconds

### Step 3: Enable Token Rotation (If Available)

Look for these settings:
- **"Enable token rotation"** or **"Rotate refresh tokens"**
- If available, **enable it** ✅
- This automatically issues new refresh tokens on each refresh (more secure)

### Step 4: Configure Session Management

Look for:
- **"Session timeout"** - Leave as default or set to match refresh token expiry
- **"Multi-factor authentication"** - Optional, for enhanced security later

### Step 5: Review Security Settings

Check:
- **"Enable email confirmations"** - Currently disabled for beta (you can enable later)
- **"Password requirements"** - Ensure strong passwords are enforced
- **"Rate limiting"** - Should be enabled by default

---

## What to Check in Supabase Dashboard

### Current Settings to Verify:

1. ✅ **Auto-refresh enabled** (handled in code)
2. ✅ **Session persistence enabled** (handled in code)
3. ⚠️ **Refresh token expiry** - Check and adjust if needed
4. ⚠️ **Token rotation** - Enable if available
5. ✅ **Storage** - Using AsyncStorage (handled in code)

---

## Code Improvements We're Making

1. **Better error handling** for token refresh failures
2. **Automatic retry logic** for network failures during refresh
3. **Graceful logout** when refresh token expires
4. **Session monitoring** and logging
5. **Token refresh event tracking** for analytics

---

## Testing After Implementation

1. **Login once** → Close app completely → Reopen → Should still be logged in
2. **Wait 1 hour** → App should auto-refresh token in background
3. **Test offline** → Login → Go offline → Token should still work (until it expires)
4. **Test expiration** → Wait for refresh token to expire → Should redirect to login

---

## Monitoring & Analytics

We'll add:
- Token refresh success/failure tracking
- Session duration tracking
- Refresh token expiration warnings
- User logout reasons (expired vs manual)


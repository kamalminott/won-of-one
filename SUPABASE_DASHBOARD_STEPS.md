# Step-by-Step: Supabase Dashboard Configuration

## 🎯 Goal
Configure refresh token expiration and enable token rotation (if available).

---

## 📍 Navigation Path

```
Supabase Dashboard
  └─ Select Project: "Won Of One"
      └─ Authentication (left sidebar)
          └─ Settings (under Authentication)
```

---

## 🔍 What You'll See

### Section 1: JWT Settings / Token Settings

**Look for one of these sections:**
- "JWT Settings"
- "Token Settings"  
- "JWT expiry"
- "Token expiry"

**What to change:**
```
Access Token Expiry: 3600 seconds (1 hour) ✅ Keep this
Refresh Token Expiry: 2592000 seconds (30 days) ← Change this
```

**Or if you prefer 60 days:**
```
Refresh Token Expiry: 5184000 seconds (60 days)
```

---

### Section 2: Token Rotation (Optional)

**Look for:**
- ☑️ "Enable token rotation"
- ☑️ "Rotate refresh tokens"
- Toggle: "Token rotation"

**If you see it:** Enable it ✅

**If you don't see it:** That's okay - it's not available in all projects yet.

---

### Section 3: Security Settings (Verify)

**Check these are enabled:**
- ✅ Rate limiting: **ON**
- ✅ Password requirements: **Strong passwords**
- ✅ Email confirmations: **Optional** (can enable later)

---

## 📸 Visual Guide (What to Look For)

### Option A: If you see "JWT Settings"
```
┌─────────────────────────────────────┐
│ JWT Settings                        │
├─────────────────────────────────────┤
│ Access Token Expiry: [3600] seconds │ ← Keep this
│ Refresh Token Expiry: [2592000]     │ ← Change to 2592000 or 5184000
│                                     │
│ ☑️ Enable token rotation           │ ← Enable if available
└─────────────────────────────────────┘
```

### Option B: If you see "Auth Settings"
```
┌─────────────────────────────────────┐
│ Auth Settings                       │
├─────────────────────────────────────┤
│ JWT expiry:                         │
│   Access: [3600] seconds            │ ← Keep this
│   Refresh: [2592000] seconds        │ ← Change this
│                                     │
│ Security:                           │
│   ☑️ Rate limiting                  │
│   ☑️ Token rotation                 │ ← Enable if available
└─────────────────────────────────────┘
```

---

## ⚙️ Step-by-Step Instructions

### Step 1: Navigate to Settings
1. Open https://supabase.com/dashboard
2. Click on your project: **"Won Of One"**
3. In the left sidebar, click **"Authentication"**
4. Click **"Settings"** (should be under Authentication)

### Step 2: Find Token Expiry Settings
1. Scroll down to find "JWT Settings" or "Token Settings"
2. Look for "Refresh Token Expiry" or "Refresh token lifetime"
3. If you see a number in seconds, note the current value

### Step 3: Update Refresh Token Expiry
1. Change the refresh token expiry to one of these:
   - **30 days**: `2592000`
   - **60 days**: `5184000`
   - **90 days**: `7776000` (not recommended for security)
2. **Recommended**: Start with `2592000` (30 days)

### Step 4: Enable Token Rotation (If Available)
1. Look for "Enable token rotation" or similar
2. If you see it, check the box ✅
3. If you don't see it, skip this step

### Step 5: Save Changes
1. Click **"Save"** or **"Update"** button
2. Wait for confirmation message
3. Changes take effect immediately

---

## ✅ Verification

### After Making Changes:

1. **In Supabase Dashboard:**
   - Refresh the page
   - Go back to Authentication → Settings
   - Verify your changes are saved

2. **In Your App:**
   - Login to your app
   - Check console logs:
     ```
     ✅ Session valid for X more minutes
     ```
   - The number should reflect your new expiry time

---

## 🆘 Can't Find the Settings?

### Alternative Locations to Check:

1. **Project Settings** → **API** → Look for JWT settings
2. **Authentication** → **Policies** → Check if there's a settings tab
3. **Settings** (top level) → **Auth** → JWT settings

### If Still Can't Find:

**Option 1: Use Supabase CLI**
```bash
# Check current settings
supabase projects list

# Or check via API (advanced)
```

**Option 2: Contact Support**
- Supabase has great support
- They can guide you to the exact location

**Option 3: Check Documentation**
- https://supabase.com/docs/guides/auth
- Search for "JWT expiry" or "refresh token"

---

## 📝 Quick Reference

### Recommended Values:
- **Access Token**: `3600` seconds (1 hour) ✅
- **Refresh Token**: `2592000` seconds (30 days) or `5184000` (60 days)
- **Token Rotation**: Enable if available ✅

### Calculation Reference:
- 1 day = 86,400 seconds
- 30 days = 2,592,000 seconds
- 60 days = 5,184,000 seconds
- 90 days = 7,776,000 seconds

---

## 🎉 You're Done!

Once you've:
1. ✅ Set refresh token expiry to 30-60 days
2. ✅ Enabled token rotation (if available)
3. ✅ Verified settings are saved

**Your refresh token implementation is complete!**

The code changes are already in place - you just needed to configure the dashboard settings.


# Fix Google Sign-In for Preview Builds

## Problem
Preview builds are getting `DEVELOPER_ERROR` because the EAS build keystore SHA-1 is not registered in Google Cloud Console.

## Solution: Add Preview Build SHA-1 to Google Cloud Console

### Step 1: Get the SHA-1 Fingerprint from Your Preview Build

**Option A: Using EAS Credentials (Recommended)**
```bash
eas credentials
```
1. Select **Android** when prompted
2. Select **preview** profile (or the profile you're using)
3. Look for **SHA-1 certificate fingerprint** in the output
4. Copy the SHA-1 value (it looks like: `AA:BB:CC:DD:EE:FF:...`)

**Option B: Extract from APK File**
If you have the preview build APK downloaded:
```bash
keytool -printcert -jarfile path/to/your-preview-build.apk | grep SHA1
```

**Option C: From EAS Dashboard**
1. Go to https://expo.dev
2. Navigate to your project → Builds
3. Find your preview build
4. Check build details for SHA-1 information

### Step 2: Add SHA-1 to Google Cloud Console

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Make sure you're in the correct project

2. **Find Your Android OAuth Client:**
   - Look for: `664197315165-qhb59dia7bq2bf6i9vfi3hm37v9mcevu.apps.googleusercontent.com`
   - Or search for "Android" OAuth 2.0 Client IDs

3. **Edit the OAuth Client:**
   - Click on the OAuth client to open it
   - Click **Edit** (pencil icon)

4. **Add the SHA-1:**
   - Scroll to **SHA-1 certificate fingerprints** section
   - Click **+ ADD URI** or the add button
   - Paste the SHA-1 you got from Step 1
   - Format: `AA:BB:CC:DD:EE:FF:...` (with colons)

5. **Save:**
   - Click **Save** at the bottom
   - Wait 2-5 minutes for changes to propagate

### Step 3: Test

1. Wait a few minutes after saving
2. Try Google Sign-In on your preview build
3. It should now work!

## Important Notes

- **Different Build Profiles = Different SHA-1s:**
  - Preview builds use EAS keystore → needs its SHA-1
  - Production/Play Store builds use Google's app signing → needs that SHA-1
  - Development builds might use different keystore → needs that SHA-1 too

- **You can add multiple SHA-1s:**
  - Add all SHA-1s from different build profiles to the same OAuth client
  - This way all builds will work

- **Package Name Must Match:**
  - Make sure the OAuth client package name is: `com.kamalminott.wonofone`
  - This should already be correct, but verify it

## Quick Command Reference

```bash
# Get SHA-1 from EAS credentials
eas credentials

# Extract SHA-1 from APK
keytool -printcert -jarfile your-app.apk | grep SHA1

# List recent builds
eas build:list --platform android --profile preview
```

## Troubleshooting

If it still doesn't work after adding SHA-1:

1. **Verify SHA-1 is correct:**
   - Double-check you copied the entire SHA-1
   - Make sure it includes colons

2. **Check Package Name:**
   - OAuth client package: `com.kamalminott.wonofone`
   - App package in `app.json`: `com.kamalminott.wonofone`
   - They must match exactly

3. **Wait Longer:**
   - Google Cloud changes can take up to 10 minutes to propagate
   - Try again after waiting

4. **Clear App Data:**
   - Uninstall and reinstall the preview build
   - Clear Google Play Services cache (if on Android)

5. **Check OAuth Consent Screen:**
   - Make sure it's published or tester is added as test user
   - Go to: APIs & Services → OAuth consent screen

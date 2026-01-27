#!/bin/bash

# Script to get SHA-1 fingerprint from EAS Android build

echo "🔍 Getting SHA-1 fingerprint from EAS credentials..."
echo ""

# Method 1: Try to get from EAS credentials
echo "Method 1: Using EAS credentials command"
echo "Run this command and select Android, then look for SHA-1:"
echo "  eas credentials"
echo ""

# Method 2: If you have the APK file
echo "Method 2: Extract from APK file"
echo "If you have downloaded the preview build APK, run:"
echo "  keytool -printcert -jarfile path/to/your-preview-build.apk | grep SHA1"
echo ""

# Method 3: From Google Play Console (if uploaded)
echo "Method 3: From Google Play Console"
echo "1. Go to Google Play Console"
echo "2. Select your app"
echo "3. Go to Release → Setup → App signing"
echo "4. Copy the SHA-1 from 'App signing key certificate'"
echo ""

echo "Once you have the SHA-1, add it to Google Cloud Console:"
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Find your Android OAuth 2.0 Client ID"
echo "3. Click Edit"
echo "4. Add the SHA-1 under 'SHA-1 certificate fingerprints'"
echo "5. Save"
echo ""

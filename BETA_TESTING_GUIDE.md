# Beta Testing Guide

This guide explains how to distribute your app to beta testers.

## Option 1: TestFlight (Recommended for External Testers)

**Best for:** Testing with up to 10,000 external users
**Requirements:** Apple Developer Account ($99/year), App Store Connect setup

### Steps:

1. **Create an App in App Store Connect:**
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Click "My Apps" → "+" → "New App"
   - Fill in app details (name, bundle ID: `com.kamalminott.wonofone`)
   - Select "App Store" as the platform

2. **Build for TestFlight:**
   ```bash
   eas build --profile production --platform ios
   ```

3. **Submit to TestFlight:**
   ```bash
   eas submit --platform ios --profile production
   ```
   - This uploads your build to App Store Connect

4. **Set Up TestFlight:**
   - Go to App Store Connect → Your App → TestFlight tab
   - Wait for Apple to process your build (usually 10-30 minutes)
   - Once processed, you can add testers

5. **Add Testers:**
   - **Internal Testers (up to 100):**
     - Go to TestFlight → Internal Testing
     - Create a group → Add testers (must be App Store Connect users)
     - They get instant access (no review needed)
   
   - **External Testers (up to 10,000):**
     - Go to TestFlight → External Testing
     - Create a group → Add your build
     - Submit for Beta App Review (takes 24-48 hours)
     - After approval, invite testers via email

6. **Tester Experience:**
   - Testers receive email invitation
   - Install TestFlight app from App Store
   - Accept invitation → Download your app

## Option 2: Internal Distribution (Quick Start)

**Best for:** Testing with a small group (friends, team members)
**Requirements:** Device UDIDs (up to 100 devices)

### Steps:

1. **Collect Device UDIDs:**
   - Have testers go to: Settings → General → About → find UDID
   - Or use this website: https://udid.tech/ (they scan QR code)
   - Collect all UDIDs in a list

2. **Register Devices in Apple Developer Portal:**
   - Go to https://developer.apple.com/account/resources/devices/list
   - Add each device UDID
   - This automatically updates your provisioning profile

3. **Build Preview Version:**
   ```bash
   eas build --profile preview --platform ios
   ```

4. **Distribute the .ipa:**
   - Download the `.ipa` from EAS Build page
   - Share with testers (via email, cloud storage, etc.)

5. **Testers Install:**
   - Download the `.ipa` on their iPhone
   - Settings → General → VPN & Device Management → Trust certificate
   - Install the app

## Option 3: Production Build (Standalone App)

**Best for:** Final testing before TestFlight submission

```bash
eas build --profile production --platform ios
```

- Builds a standalone app (no dev client needed)
- Can be submitted to TestFlight or distributed internally

## Quick Comparison

| Method | Max Testers | Review Required | Best For |
|--------|-------------|-----------------|----------|
| TestFlight External | 10,000 | Yes (Beta Review) | Public beta |
| TestFlight Internal | 100 | No | Team/quick tests |
| Internal Distribution | 100 devices | No | Private testing |

## PostHog Analytics Setup

✅ All analytics tracking is already configured and working!
- Events are being sent to: https://eu.posthog.com/project/98132
- Monitor beta tester activity in real-time
- Create dashboards for beta feedback

## Recommended First Steps

1. **Start with Internal Distribution (Option 2):**
   - Fastest way to get testers
   - No App Store review needed
   - Good for initial feedback

2. **Move to TestFlight (Option 1) when ready:**
   - More professional
   - Better for larger groups
   - Includes crash reporting

## Tips

- **Version Numbers:** EAS auto-increments build numbers
- **Update Process:** Build new version → Distribute → Testers update
- **Feedback:** Use PostHog events to track tester behavior
- **Crash Reports:** TestFlight includes automatic crash reporting

## Next Commands to Run

For **Internal Distribution** (quick start):
```bash
eas build --profile preview --platform ios
```

For **TestFlight**:
```bash
eas build --profile production --platform ios
eas submit --platform ios --profile production
```


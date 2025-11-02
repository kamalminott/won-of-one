# Android Beta Testing Guide

This guide explains how to distribute your Won Of One app to Android beta testers via Google Play Console.

## Overview

Google Play offers three testing tracks for Android apps:

1. **Internal Testing** - Up to 100 testers, instant, no review (like iOS Internal)
2. **Closed Testing** - Up to 75,000 testers, review required, organized groups (like iOS External)
3. **Open Testing** - Unlimited testers, public beta, review required

**Your Setup:**
- ✅ EAS Build configured for Android
- ✅ Bundle ID: `com.kamalminott.wonofone`
- ✅ PostHog analytics enabled

---

## Prerequisites

- Google Play Console account ($25 one-time fee)
- Google Developer account created
- App listing created in Play Console
- EAS Build configured

---

## Getting Started

### Step 1: Create Google Play Console Account

1. Go to https://play.google.com/console
2. Sign in with Google account
3. Accept terms and pay $25 registration fee
4. Set up developer profile

### Step 2: Create Your App Listing

1. In Play Console, click "Create app"
2. Fill in details:
   - **App name:** Won Of One
   - **Default language:** English
   - **App or game:** App
   - **Free or paid:** Free
   - **Developer Program Policies:** Accept
3. Click "Create app"

### Step 3: Complete Store Listing

**Required before any testing:**

1. Go to **Store presence → Main store listing**
2. Fill out:
   - App name
   - Short description (80 characters max)
   - Full description (4,000 characters max)
   - App icon (512x512)
   - Feature graphic (1024x500)
   - Screenshots (phone at least 2, tablet optional)
   - Category

3. Go to **Store presence → Store settings**
   - Target audience
   - Privacy policy URL (if collecting data)
   - Content rating questionnaire

4. Go to **Policy → App content**
   - Complete questionnaires
   - Privacy policy
   - Data safety form

5. Go to **Release → Production** (click "Create new release")
   - Upload APK/AAB (we'll build this)
   - Release name: "1.0.0"
   - Release notes

**Note:** You must create a Production release first (even if you never publish it) before you can create testing tracks.

---

## Building for Android

### Using EAS Build

**Recommended: Build AAB (Android App Bundle)**

```bash
# Build Android production bundle
eas build --profile production --platform android

# This creates an .aab file optimized for Play Store
```

**Alternatively: Build APK**

```bash
# If you need APK instead of AAB
eas build --profile production --platform android --type apk
```

**Difference:**
- **AAB** (recommended): Smaller downloads, optimized per device
- **APK**: Universal, works everywhere but larger

### EAS Configuration

Your `eas.json` already supports Android:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./path/to/api-key.json",
        "track": "internal"  // or "alpha", "beta", "production"
      }
    }
  }
}
```

---

## Testing Tracks

### Track 1: Internal Testing

**Best For:** Team members, instant testing

**Limitations:**
- Maximum 100 testers
- Must add via email or Google Groups
- No review required
- Instant rollout

**Setup:**

1. **Go to:** Play Console → Your App → **Testing → Internal testing**

2. **Create Release:**
   - Click "Create new release"
   - Upload your AAB/APK file
   - Version code will auto-increment
   - Release name: "Internal 1.0.0"
   - Release notes (optional)
   - Click "Save" then "Review release"
   - Click "Start rollout to Internal testing"

3. **Add Testers:**
   - Option A: **Individual emails**
     - Click "Testers" tab
     - Click "+ Create email list"
     - Name it (e.g., "Alpha Testers")
     - Add email addresses (comma-separated)
     - Click "Save changes"
     - Copy the opt-in URL

   - Option B: **Google Group** (recommended)
     - Create a Google Group at https://groups.google.com
     - Add testers to the group
     - In Play Console, add the group email

4. **Share Test Link:**
   - Testers visit: `https://play.google.com/apps/internaltest/APP_ID`
   - Or use the opt-in URL from the Tester tab
   - They join the testing program
   - App appears in Play Store for them

**Advantages:**
- Instant, no waiting
- No review
- Good for rapid iteration
- Close control

---

### Track 2: Closed Testing

**Best For:** Public beta with control

**Limitations:**
- Up to 75,000 testers per track
- Can create multiple groups/tracks
- Requires review
- More flexibility than Open Testing

**Setup:**

1. **Go to:** Testing → Closed testing

2. **Create Track:** Click "+ Create track"
   - Name: "Alpha", "Beta", or custom name
   - Description: Testing purpose
   - Click "Create"

3. **Create Release:**
   - Click "Create new release" within the track
   - Upload AAB/APK
   - Add release notes
   - Save → Review release → **Start rollout**

4. **Review Process:**
   - First release requires Google review
   - Usually 1-3 days for new apps
   - Faster for established apps
   - Check status in the track

5. **Add Testers:**
   - Create email lists or Google Groups
   - Add to track's "Testers" section
   - Share opt-in URL
   - Testers join via link

**Advantages:**
- Larger audience than Internal
- Organized by groups/tracks
- Can have different versions per track
- More professional

---

### Track 3: Open Testing

**Best For:** Public beta launches

**Limitations:**
- Unlimited testers
- Requires review
- Public-facing
- Less control

**Setup:**

1. **Go to:** Testing → Open testing

2. **Create Release:** Same as Closed testing

3. **Review Required:** Google must approve

4. **Public Sign-up:**
   - Anyone can join via Play Store
   - No invitation needed
   - Publicly visible

**Use Case:**
- Public beta programs
- Major feature testing
- Final stage before production

---

## Comparison Table

| Feature | Internal | Closed | Open |
|--------|----------|--------|------|
| **Max Testers** | 100 | 75,000 | Unlimited |
| **Review** | No | Yes | Yes |
| **Groups** | Email list | Tracks/Groups | Public |
| **Invitation** | Required | Required | Optional |
| **Speed** | Instant | 1-3 days | 1-3 days |
| **Control** | High | Medium | Low |
| **Best For** | Team | Beta | Public beta |

**Recommended Progression:**
Internal → Closed → Open → Production

---

## Updating Your App

### Update Process

**For Internal/Closed/Open Tracks:**

1. **Build New Version:**
   ```bash
   eas build --profile production --platform android
   ```

2. **Create New Release:**
   - Go to respective track (Internal/Closed/Open)
   - Click "Create new release"
   - Upload new AAB/APK
   - Update version code (auto-incremented)
   - Add release notes
   - Save → Review → Start rollout

3. **For Testers:**
   - Automatic notification
   - Update via Play Store
   - No data loss
   - Can rollback if needed

### Automated Submission

**Using EAS Submit:**

```bash
# Submit to Play Store
eas submit --platform android --profile production

# Or specify track
eas submit --platform android --profile production --track internal
```

**Configuration:**

Create a service account key:

1. Go to Play Console → Setup → API access
2. Link Google Cloud project
3. Create service account
4. Download JSON key file
5. Add to `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

## Monitoring & Feedback

### Google Play Console Analytics

**Metrics Available:**
- Installs by device
- Crash reports
- ANR (App Not Responding) reports
- User feedback
- Ratings and reviews
- Retention metrics

**Access:**
- Play Console → Your App → Statistics
- Play Console → Your App → Quality → Crashes
- Play Console → Your App → User feedback

### Integration with PostHog

**Your app already has PostHog analytics!**

Monitor Android users:
- https://eu.posthog.com/project/98132
- Same events as iOS
- Cross-platform insights
- User journeys

**Key Android Metrics:**
- App opens
- Feature adoption
- Device types
- OS versions
- Crash-free users

---

## Troubleshooting

### Build Errors

**Problem:** EAS build fails for Android

**Solutions:**
- Check `app.json` Android config
- Verify signing credentials
- Review build logs in EAS
- Test locally first: `npx expo run:android`

### Submission Errors

**Problem:** Can't submit to Play Store

**Solutions:**
- Upload manually via Play Console
- Check service account permissions
- Verify bundle ID matches
- Complete all store listing requirements

### Testers Can't Install

**Problem:** "App not available"

**Solutions:**
- Wait for review completion
- Verify tester is in correct group
- Check opt-in URL is correct
- Ensure app is released to testing track
- Testers must visit the opt-in URL first

### Update Not Showing

**Problem:** Testers don't see update

**Solutions:**
- Verify release rolled out successfully
- Check version code increased
- Testers may need to force-quit Play Store
- Rollout may be phased (gradual)

---

## Best Practices

### For Android Testing

1. **Device Testing:**
   - Test on multiple device sizes
   - Different Android OS versions
   - Various manufacturers (Samsung, Pixel, etc.)
   - Use Firebase Test Lab for CI testing

2. **Version Management:**
   - Use semantic versioning
   - Always increment version code
   - Document breaking changes
   - Clear release notes

3. **Rollout Strategy:**
   - Start Internal (team)
   - Expand to Closed (100-200 users)
   - Gradual rollout to Open
   - Monitor crash rates

4. **Analytics:**
   - Track PostHog events
   - Monitor Play Console crashes
   - User feedback analysis
   - A/B test features

### Device Setup

**Recommended Test Devices:**
- Pixel 5+ (Stock Android)
- Samsung Galaxy S series (One UI)
- Budget phones (Redmi, etc.)
- Various screen sizes

---

## Complete Workflow Example

### Android Beta Testing Workflow

**Week 1: Setup**
```bash
# 1. Create Play Console account
# 2. Create app listing
# 3. Complete store listing
# 4. Build first version
eas build --profile production --platform android

# 5. Upload to Internal testing
# 6. Add team members as testers
# 7. Start testing
```

**Week 2: Closed Beta**
```bash
# 1. Fix issues from internal feedback
# 2. Build updated version
eas build --profile production --platform android

# 3. Create Closed testing track
# 4. Upload to Closed track
# 5. Submit for review (1-3 days)
# 6. Add beta testers
# 7. Share opt-in URL
```

**Week 3+: Iterate**
```bash
# Weekly updates
eas build --profile production --platform android
eas submit --platform android --profile production

# Monitor PostHog analytics
# Review crash reports
# Gather feedback
# Iterate
```

---

## Android vs iOS Testing

| Feature | Android | iOS |
|---------|---------|-----|
| **Platform** | Google Play Console | TestFlight |
| **Cost** | $25 one-time | $99/year |
| **Max Internal** | 100 | 100 |
| **Max External** | 75,000 | 10,000 |
| **Review Time** | 1-3 days | 24-48 hours |
| **Review Required** | For Closed/Open | For External |
| **Build Format** | AAB/APK | IPA |
| **Tool** | EAS Build | EAS Build |
| **Distribution** | URLs | URLs |

**Both Platforms:**
- EAS Build works for both ✅
- PostHog analytics on both ✅
- Same codebase ✅
- Unified beta program ✅

---

## Quick Reference

### Commands

```bash
# Build for Android
eas build --profile production --platform android

# Submit to Play Store
eas submit --platform android --profile production

# Build + Submit (Android)
eas build --profile production --platform android
eas submit --platform android --profile production

# Build AAB (recommended)
eas build --profile production --platform android --type app-bundle

# Build APK
eas build --profile production --platform android --type apk
```

### Testing Tracks

| Track | Use Case | Testers | Review |
|-------|----------|---------|--------|
| Internal | Team testing | 100 | No |
| Closed | Beta testing | 75,000 | Yes |
| Open | Public beta | Unlimited | Yes |

### Checklist

**Before Beta:**
- ✅ Play Console account created
- ✅ App listing created
- ✅ Store listing complete
- ✅ Privacy policy added
- ✅ Screenshots uploaded
- ✅ First production release created

**Beta Setup:**
- ✅ Build created via EAS
- ✅ Testing track created
- ✅ Testers added
- ✅ Opt-in URL shared
- ✅ Analytics monitoring active

---

## Summary

**Android Beta Testing:**
1. ✅ Create Play Console account ($25)
2. ✅ Complete store listing requirements
3. ✅ Build with EAS Build
4. ✅ Upload to Internal/Closed/Open testing
5. ✅ Add testers and share opt-in URL
6. ✅ Monitor analytics and feedback
7. ✅ Iterate with weekly updates

**Your Won Of One App:**
- ✅ Already configured for Android
- ✅ PostHog analytics ready
- ✅ Same codebase as iOS
- ✅ Ready for Android beta

**Next Steps:**
1. Create Google Play Console account
2. Complete store listing
3. Build first Android version
4. Start internal testing
5. Expand to closed beta

For help: https://support.google.com/googleplay/android-developer


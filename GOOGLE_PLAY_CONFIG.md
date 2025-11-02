# Google Play Store Configuration

This document outlines what you need to configure for Android beta testing in Google Play Console.

## Required Setup

### 1. Create Google Play Console Account

**Steps:**
1. Go to https://play.google.com/console
2. Sign in with Google account
3. Accept developer agreement
4. Pay $25 registration fee (one-time)
5. Complete profile setup

### 2. Create App Listing

**In Play Console:**
1. Click "Create app"
2. Fill in:
   - App name: **Won Of One**
   - Default language: English
   - App or game: App
   - Free or paid: Free
   - Policies: Accept
3. Click "Create app"

### 3. Package Name (Bundle ID)

**Your current config:**
- iOS Bundle ID: `com.kamalminott.wonofone`
- Android Package Name: Needs to match or be different

**Option A: Use Same ID**
```json
{
  "android": {
    "package": "com.kamalminott.wonofone"
  }
}
```

**Option B: Use Different ID**
```json
{
  "android": {
    "package": "com.kamalminott.wonofone.android"
  }
}
```

**Recommendation:** Use the same ID for consistency.

### 4. Store Listing Requirements

**Before any testing, you must complete:**

#### Main Store Listing
- **App name:** Won Of One
- **Short description:** (80 characters max)
  - Suggested: "Track your fencing matches, goals, and progress"
- **Full description:** (4,000 characters max)
  - Describe features, benefits, use cases
- **App icon:** 512x512 PNG (already have this)
- **Feature graphic:** 1024x500 PNG
- **Phone screenshots:** At least 2 required
- **Tablet screenshots:** Optional
- **Category:** Sports / Productivity / Lifestyle

#### Store Settings
- **Contact details:** Email, phone (optional)
- **Privacy policy:** URL required if collecting data
- **Target audience:** Appropriate age rating

#### Content Rating
- Complete IARC questionnaire
- Automatic rating provided
- Categories: Fantasy violence, simulated gambling, etc.

#### Data Safety
- Describe data collection practices
- Privacy policy details
- Data sharing practices
- Your app uses PostHog analytics, so declare this

#### App Access
- Full access: Public
- Restricted: Need account/permission
- Your app: Requires account (Supabase auth)

### 5. Firebase Test Lab (Optional but Recommended)

**For automated testing:**
1. Create Firebase project
2. Link to Play Console
3. Enable Test Lab
4. Run automated device tests

---

## EAS Configuration

### Current Config

Your `eas.json` supports Android:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Recommended Config

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"  // AAB is preferred for Play Store
      }
    }
  },
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

## Getting Service Account Key

**For automated submissions:**

1. **In Play Console:**
   - Go to Setup → API access
   - Click "Link Google Cloud Project" or create new
   - Enable Google Play Android Developer API

2. **In Google Cloud Console:**
   - Go to IAM & Admin → Service Accounts
   - Create service account
   - Grant role: "Service Account User"
   - Create key (JSON) and download

3. **In Play Console:**
   - Go back to API access
   - Find your service account
   - Grant access:
     - View app information
     - Manage production releases
     - Manage testing track releases
     - View financial data

4. **Save Key:**
   - Download JSON key file
   - Add to project root: `google-service-account.json`
   - Add to `.gitignore` (never commit keys!)

---

## app.json Android Settings

### Current Configuration

```json
{
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/adaptive-icon.png",
      "backgroundColor": "#ffffff"
    },
    "edgeToEdgeEnabled": true
  }
}
```

### Recommended Additions

```json
{
  "android": {
    "package": "com.kamalminott.wonofone",
    "versionCode": 1,
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/adaptive-icon.png",
      "backgroundColor": "#ffffff"
    },
    "permissions": [
      "INTERNET",
      "ACCESS_NETWORK_STATE"
    ],
    "edgeToEdgeEnabled": true
  }
}
```

**Note:** `versionCode` is auto-incremented by EAS Build.

---

## Play Console Checklist

### Before First Build

- [ ] Google Play Console account created
- [ ] $25 registration fee paid
- [ ] App listing created
- [ ] App name set: "Won Of One"
- [ ] Package name configured: `com.kamalminott.wonofone`
- [ ] Description written
- [ ] App icon uploaded (512x512)
- [ ] Feature graphic created (1024x500)
- [ ] Screenshots prepared (at least 2 phone)
- [ ] Category selected

### Before Testing

- [ ] Privacy policy URL added (if required)
- [ ] Content rating completed
- [ ] Data safety form filled out
- [ ] Target audience set
- [ ] Contact details added
- [ ] Service account created (for automated submit)
- [ ] First production release slot created (blank release)

### After First Build

- [ ] Build completes successfully in EAS
- [ ] AAB/APK downloaded or linked
- [ ] Testing track created (Internal/Closed/Open)
- [ ] Build uploaded to testing track
- [ ] Release notes added
- [ ] Release rolled out to testing track
- [ ] Testers added to track
- [ ] Opt-in URL shared with testers

---

## Screenshot Requirements

### Minimum Requirements

**Phone Screenshots:**
- At least 2 screenshots required
- Recommended: 5-8 screenshots
- Format: PNG or JPEG
- Sizes:
  - Phone: 320dp - 3840dp width
  - Recommended: 1080x1920 or higher

**Feature Graphic:**
- 1024x500 PNG
- Shown in Play Store search results
- Make it eye-catching

**Screenshots to Capture:**
1. Home screen with stats
2. Match logging interface
3. Profile page
4. Goals/Settings
5. Match summary

---

## Privacy Policy Requirements

**Your app collects:**
- Analytics data (PostHog)
- User account data (Supabase)
- Match history data
- Device information

**Privacy Policy Must Include:**
1. What data you collect
2. Why you collect it
3. How you use it
4. Where it's stored
5. How users can delete it
6. Third-party services (PostHog, Supabase)

**Suggested Policy Content:**

```
Won Of One Privacy Policy

Data Collection:
- Account information (name, email)
- Match data and statistics
- Device information for analytics
- Usage patterns

Data Usage:
- Improve app functionality
- Provide personalized stats
- Debug and fix issues
- Analytics and insights

Data Storage:
- Data stored securely via Supabase
- Analytics via PostHog
- Both services are GDPR compliant

User Rights:
- Access your data
- Delete your account
- Opt out of analytics

Contact: [Your email]
```

**Create a simple privacy policy page or use a generator:**
- https://www.privacypolicygenerator.info/
- https://termsfeed.com/privacy-policy-generator/

---

## Quick Start Commands

```bash
# First time setup
# 1. Create Play Console account
# 2. Create app listing
# 3. Complete store listing

# Build for Android
eas build --profile production --platform android

# Submit to Play Store
eas submit --platform android --profile production

# Build AAB (recommended)
eas build --profile production --platform android --type app-bundle

# Build + Submit
eas build --profile production --platform android && \
eas submit --platform android --profile production
```

---

## Testing Strategy

### Phase 1: Internal Testing
- **Duration:** 1-2 weeks
- **Testers:** Team, close friends (up to 100)
- **Purpose:** Fix critical bugs
- **No review:** Instant

### Phase 2: Closed Beta
- **Duration:** 2-4 weeks
- **Testers:** Invited users (100-1,000)
- **Purpose:** Feature validation
- **Review:** 1-3 days

### Phase 3: Open Beta
- **Duration:** Ongoing
- **Testers:** Public (unlimited)
- **Purpose:** Public beta launch
- **Review:** 1-3 days

### Phase 4: Production
- **Launch:** Full release
- **Tiers:** Gradual rollout recommended
- **Monitor:** Analytics, crash reports, reviews

---

## Resources

- Play Console: https://play.google.com/console
- Android Developer Guide: https://developer.android.com/distribute
- EAS Build Docs: https://docs.expo.dev/build/introduction/
- Firebase Test Lab: https://firebase.google.com/docs/test-lab
- Privacy Policy Generators: https://www.privacypolicygenerator.info/

---

## Next Steps

1. ✅ Read ANDROID_BETA_TESTING.md for detailed workflow
2. ⏭️ Create Google Play Console account
3. ⏭️ Complete store listing requirements
4. ⏭️ Build first Android version
5. ⏭️ Start internal testing

Your Won Of One app is ready for Android beta testing! 🚀


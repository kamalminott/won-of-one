# App Updates Guide: OTA vs New Builds

This guide explains when you need to rebuild vs when you can use Over-The-Air (OTA) updates.

---

## Quick Answer

**Two Types of Updates:**

1. **JavaScript/TypeScript Changes** → OTA Updates (No rebuild needed! ✅)
   - UI changes, bug fixes, new features
   - Business logic changes
   - Most code changes

2. **Native Changes** → New Build Required (Rebuild needed ⚠️)
   - New native modules/dependencies
   - App configuration changes (app.json)
   - Icon/splash screen changes
   - Native code changes

---

## Over-The-Air (OTA) Updates

### What Can Be Updated via OTA?

✅ **Can be updated OTA:**
- All JavaScript/TypeScript code
- React components
- UI styling
- Business logic
- API calls
- Bug fixes
- New screens/features (in JS)
- Analytics tracking
- Most of your app code!

### What Cannot Be Updated via OTA?

❌ **Requires new build:**
- Adding new native dependencies
- Changing `app.json` config (icons, splash, bundle ID, etc.)
- Changing native code
- Updating Expo SDK version
- Changing permissions
- App icon changes
- Splash screen changes

---

## Setting Up OTA Updates with EAS Update

### Step 1: Install EAS Update

```bash
npm install --save-dev eas-cli
```

(You probably already have this)

### Step 2: Configure EAS Update

**Add to `eas.json`:**

```json
{
  "build": {
    "production": {
      "channel": "production"
    },
    "preview": {
      "channel": "preview"
    }
  },
  "update": {
    "production": {
      "channel": "production"
    },
    "preview": {
      "channel": "preview"
    }
  }
}
```

### Step 3: Publish Updates

**For production:**
```bash
eas update --branch production --message "Bug fixes and improvements"
```

**For preview/beta:**
```bash
eas update --branch preview --message "New features for testing"
```

**Users get updates automatically!** No app store approval needed for OTA updates.

---

## Update Workflow

### Scenario 1: JavaScript Bug Fix

**What changed:** Fixed a bug in match tracking logic

**Process:**
1. Make code changes
2. Commit changes
3. Publish OTA update:
   ```bash
   eas update --branch production --message "Fixed match tracking bug"
   ```
4. ✅ Done! Users get update automatically

**No rebuild needed!** No App Store/Play Store upload!

---

### Scenario 2: Added New Feature (JS Only)

**What changed:** Added new UI component, new screen

**Process:**
1. Make code changes
2. Commit changes
3. Publish OTA update:
   ```bash
   eas update --branch production --message "Added new goal tracking feature"
   ```
4. ✅ Users get update automatically

**No rebuild needed!**

---

### Scenario 3: Changed App Icon

**What changed:** Updated app icon

**Process:**
1. Update icon files
2. Update `app.json`
3. Build new app:
   ```bash
   eas build --profile production --platform ios
   eas build --profile production --platform android
   ```
4. Submit to stores:
   ```bash
   eas submit --platform ios --profile production
   eas submit --platform android --profile production
   ```
5. Wait for store approval

**Rebuild required!** This is a native change.

---

### Scenario 4: Added New Native Dependency

**What changed:** Added `react-native-camera` or similar native module

**Process:**
1. Install new package
2. Update native code/config
3. Build new app:
   ```bash
   eas build --profile production --platform ios
   eas build --profile production --platform android
   ```
4. Submit to stores

**Rebuild required!** New native code needs compilation.

---

## Comparison Table

| Change Type | OTA Update? | Rebuild? | Store Approval? |
|------------|-------------|----------|----------------|
| **JS/TS code fix** | ✅ Yes | ❌ No | ❌ No |
| **UI changes** | ✅ Yes | ❌ No | ❌ No |
| **New JS feature** | ✅ Yes | ❌ No | ❌ No |
| **Bug fixes** | ✅ Yes | ❌ No | ❌ No |
| **App icon** | ❌ No | ✅ Yes | ✅ Yes |
| **Splash screen** | ❌ No | ✅ Yes | ✅ Yes |
| **New native module** | ❌ No | ✅ Yes | ✅ Yes |
| **app.json changes** | ❌ No | ✅ Yes | ✅ Yes |
| **Bundle ID** | ❌ No | ✅ Yes | ✅ Yes |
| **Permissions** | ❌ No | ✅ Yes | ✅ Yes |

---

## EAS Update Channels

**Channels** let you target different user groups:

- **Production channel:** All users
- **Preview channel:** Beta testers only
- **Custom channels:** Specific user groups

**Example:**
```bash
# Update for beta testers only
eas update --branch preview --message "Beta: New features"

# Update for all users
eas update --branch production --message "Bug fixes"
```

---

## Update Frequency

### Recommended Strategy:

**OTA Updates:**
- Weekly or as needed for bug fixes
- No limit on frequency
- Instant delivery (no store approval)

**New Builds:**
- Monthly or when native changes needed
- Only when icon/config/native code changes
- Requires store approval (24-48 hours)

---

## Setting Up EAS Update (Quick Setup)

### 1. Add Update Configuration

**Update `eas.json`:**

```json
{
  "build": {
    "production": {
      "channel": "production",
      "autoIncrement": true
    },
    "preview": {
      "channel": "preview"
    }
  },
  "update": {
    "production": {
      "channel": "production",
      "runtimeVersion": "1.0.0"
    },
    "preview": {
      "channel": "preview",
      "runtimeVersion": "1.0.0"
    }
  }
}
```

### 2. Add Runtime Version to app.json

```json
{
  "expo": {
    "runtimeVersion": "1.0.0",
    // ... rest of config
  }
}
```

**Important:** When you need a new build (native changes), increment `runtimeVersion`:
- `"runtimeVersion": "1.0.1"` for next build
- This ensures OTA updates only go to compatible builds

### 3. Publish Your First Update

```bash
eas update --branch production --message "Initial OTA update setup"
```

---

## Update Workflow Examples

### Example 1: Quick Bug Fix

**You find a bug in match tracking:**

```bash
# 1. Fix the bug in code
git add .
git commit -m "Fix match tracking bug"

# 2. Publish OTA update
eas update --branch production --message "Fixed match tracking bug"

# 3. Done! Users get update within minutes
```

**Time:** 5 minutes  
**Store approval:** None needed ✅

---

### Example 2: New Feature Release

**You add a new goal type:**

```bash
# 1. Add feature code
git add .
git commit -m "Add new goal type"

# 2. Publish OTA update
eas update --branch production --message "Added new goal type feature"

# 3. Users get update automatically
```

**Time:** 5 minutes  
**Store approval:** None needed ✅

---

### Example 3: App Icon Change

**You update the app icon:**

```bash
# 1. Update icon files
# 2. Update app.json
git add .
git commit -m "Update app icon"

# 3. Build new versions
eas build --profile production --platform ios
eas build --profile production --platform android

# 4. Submit to stores
eas submit --platform ios --profile production
eas submit --platform android --profile production

# 5. Wait for approval (24-48 hours)
```

**Time:** 2-3 days (including approval)  
**Store approval:** Required ⚠️

---

## Best Practices

### For Beta Testing:

1. **Use OTA updates for rapid iteration:**
   ```bash
   eas update --branch preview --message "Beta: Fixed signup issue"
   ```
   - Testers get updates instantly
   - No rebuild needed for most changes
   - Faster feedback loop

2. **Only rebuild when needed:**
   - New native dependencies
   - Icon/config changes
   - Major SDK updates

### For Production:

1. **Use OTA for most updates:**
   - Bug fixes → OTA
   - Feature additions → OTA
   - UI improvements → OTA

2. **Rebuild only when necessary:**
   - Native changes
   - App configuration
   - Icon/branding

---

## How Users Get Updates

### OTA Updates:
- **Automatic:** App checks for updates on launch
- **Background:** Downloads in background
- **Next Launch:** Users see new version
- **No Action Needed:** Completely seamless

### New Builds:
- **Manual:** Users need to update via App Store/Play Store
- **Notification:** Store sends update notification
- **User Action:** User clicks "Update" button
- **Approval:** Store may require approval

---

## Update Channels Strategy

**Recommended Setup:**

```
Production Channel:
  - All public users
  - Stable updates
  - Tested thoroughly

Preview Channel:
  - Beta testers
  - Pre-release testing
  - Can be less stable

Development Channel:
  - Internal team
  - Experimental features
  - Fast iteration
```

---

## Setting Up Now

### Quick Setup Steps:

1. **Add to `eas.json`:**
   ```json
   {
     "update": {
       "production": {
         "channel": "production",
         "runtimeVersion": "1.0.0"
       },
       "preview": {
         "channel": "preview",
         "runtimeVersion": "1.0.0"
       }
     }
   }
   ```

2. **Add to `app.json`:**
   ```json
   {
     "expo": {
       "runtimeVersion": "1.0.0",
       // ... rest of config
     }
   }
   ```

3. **Publish first update:**
   ```bash
   eas update --branch production --message "Initial OTA setup"
   ```

---

## Summary

**For Most Updates (90% of changes):**
- ✅ Use OTA updates
- ✅ No rebuild needed
- ✅ No store approval
- ✅ Instant delivery

**Only Rebuild When:**
- ❌ Native code changes
- ❌ App configuration changes
- ❌ Icon/splash changes
- ❌ New native dependencies

**Your Current Setup:**
- ✅ EAS Build configured
- ⏭️ EAS Update needs setup (I can help with this!)

**Recommendation:**
Set up EAS Update now so you can push OTA updates for most changes! 🚀


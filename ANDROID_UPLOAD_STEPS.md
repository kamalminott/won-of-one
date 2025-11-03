# Step-by-Step: Upload Won Of One to Google Play & Share with Testers

This is a complete walkthrough for uploading your app and sharing it with beta testers.

---

## Prerequisites Checklist

Before you start, make sure you have:
- [x] Google Play Console account created ($25 paid)
- [x] App created in Play Console ("Won Of One")
- [x] Package name added to `app.json`: `com.kamalminott.wonofone`
- [ ] APK file built (we'll do this together)

---

## Step 1: Configure Package Name in app.json

✅ **DONE** - Your `app.json` now has:
```json
{
  "android": {
    "package": "com.kamalminott.wonofone"
  }
}
```

---

## Step 2: Build Your Android APK

**Open your terminal and run:**

```bash
cd /Users/kamalminott/Documents/Apps/won-of-one
eas build --profile production --platform android
```

**Note:** The `buildType: "apk"` is configured in `eas.json`, so no `--type` flag needed.

**What happens:**
1. EAS Build starts
2. It compiles your React Native app
3. Creates an Android APK file
4. Uploads to EAS servers
5. Build takes ~10-15 minutes

**While waiting:**
- You'll see build logs
- Build ID will be shown
- Link to build page provided

**When finished:**
- You'll see: "Build finished"
- Download link provided: `https://expo.dev/artifacts/eas/...`

---

## Step 3: Download Your APK

**After build completes:**

1. **Copy the download link** from terminal
   - Looks like: `https://expo.dev/artifacts/eas/XXXXXXXXX.apk`

2. **Open the link in your browser**
   - APK file will download automatically
   - Save it somewhere easy to find (Desktop or Downloads)

3. **Verify the file**
   - Should be named something like `app-1.0.0-xxx.apk`
   - Size: Usually 20-50 MB

---

## Step 4: Open Google Play Console

1. **Go to:** https://play.google.com/console
2. **Sign in** with your Google account
3. **Click** "All apps" or find "Won Of One" if you already created it
4. **Click on** "Won Of One" app

---

## Step 5: Navigate to Internal App Sharing

**In Play Console:**

1. **Look at the left sidebar menu**
2. **Find section:** "Testing"
3. **Click:** "Internal app sharing"
   - If you don't see it, it might be collapsed under "Testing"
   - Or look for "App bundle explorer" nearby

**First time setup:**
- If it says "Internal app sharing is disabled"
- Click "Enable internal app sharing"
- Accept any prompts

---

## Step 6: Upload Your APK

**On the Internal App Sharing page:**

1. **Click button:** "Upload new release" or "Upload"
   - Usually a blue button at the top

2. **Upload your APK:**
   - **Option A:** Drag and drop your APK file into the upload area
   - **Option B:** Click "Choose file" and select your APK from Downloads/Desktop

3. **Wait for upload:**
   - Progress bar will show
   - Usually takes 10-30 seconds
   - Don't close the page!

4. **Upload complete:**
   - You'll see your APK listed
   - Shows version, size, upload date
   - Status: "Ready to share"

---

## Step 7: Get Your Share Link

**After upload:**

1. **Find the shareable link:**
   - Look for a "Share" button or link icon
   - Or click on the APK entry to expand it
   - Link format: `https://play.google.com/apps/internaltest/XXXXXX`

2. **Copy the link:**
   - Click "Copy link" button
   - Or manually select and copy the URL

**The link looks like:**
```
https://play.google.com/apps/internaltest/XXXXXXXXX-XXXXX-XXXXX-XXXXX
```

---

## Step 8: Share with Testers

**Send the link to your testers via:**

1. **Email** - Paste link in email
2. **Text message** - Send via SMS/WhatsApp
3. **Slack/Discord** - Share in team channels
4. **QR Code** - Generate QR code from link for easy scanning

**What to tell testers:**
```
Hi! I'd like you to test my app "Won Of One". 

Click this link on your Android phone:
[PASTE LINK HERE]

It will open in the Play Store and let you install it directly.
Let me know what you think!
```

---

## Step 9: Tester Installation Process

**What testers do:**

1. **Click the link** on their Android phone
   - Must use Android device (not iPhone/iPad)
   - Can send via SMS or email to themselves

2. **Link opens Play Store**
   - Browser opens Google Play Store
   - Shows "Internal app sharing" page
   - Displays your app info

3. **Tap "Install" button**
   - Green "Install" button appears
   - Tap it to install

4. **Installation completes**
   - App installs like normal Play Store app
   - Appears in app drawer
   - Ready to use!

**Note:** First time, Play Store may ask tester to verify they want to install from internal testing. They click "Continue" or "Accept".

---

## Step 10: Verify Installation (Optional)

**Ask testers to confirm:**

- [ ] Received the link
- [ ] Successfully installed app
- [ ] App opens correctly
- [ ] Can log in/create account
- [ ] App functions as expected

**If issues:**
- Check Android version (needs Android 8+ usually)
- Verify they clicked link on Android device (not computer)
- Make sure they have enough storage space

---

## Updating Your App

**When you make changes and want to share a new version:**

1. **Make your code changes**
2. **Build new APK:**
   ```bash
   eas build --profile production --platform android --type apk
   ```
3. **Download new APK**
4. **Upload to Internal App Sharing** (same steps 4-6)
5. **New link is generated** automatically
6. **Share new link** with testers
7. **Testers:** Click new link → Updates automatically replace old version

**Note:** Each upload gets a new link. Old links still work (for 60 days).

---

## Troubleshooting

### Build Issues

**Problem:** Build fails
**Solution:** 
- Check error logs in EAS
- Verify `app.json` is correct
- Make sure all dependencies are installed

### Upload Issues

**Problem:** Can't upload APK
**Solution:**
- Make sure you're using APK, not AAB
- Check file size (should be under 100MB)
- Verify you're in the right app in Play Console

### Link Not Working

**Problem:** Tester says link doesn't work
**Solution:**
- Make sure they're on Android device
- Link might have expired (60 days)
- They might need to be signed into Google account

### App Won't Install

**Problem:** Tester can't install
**Solution:**
- Check Android version compatibility
- Enable "Install from unknown sources" (not usually needed)
- Clear Play Store cache
- Try different device

---

## What's Next?

**After successful testing:**

1. **Gather feedback** from testers
2. **Fix bugs** and make improvements
3. **Build updated version** and upload new link
4. **When ready for more organized testing:**
   - Move to "Internal Testing" track
   - Set up proper version management
   - Use Play Console analytics

---

## Quick Command Reference

```bash
# Build APK for testing
eas build --profile production --platform android --type apk

# Check build status
# Visit: https://expo.dev/accounts/kamalminott/projects/won-of-one/builds

# Download APK
# Click download link from build page or terminal output
```

---

## Summary Checklist

**You've completed:**
- [x] Package name configured in app.json
- [ ] APK built via EAS Build
- [ ] APK downloaded to your computer
- [ ] Play Console opened
- [ ] Internal App Sharing accessed
- [ ] APK uploaded
- [ ] Share link copied
- [ ] Link shared with testers
- [ ] Testers successfully installed

**Current Status:**
- Package name: ✅ `com.kamalminott.wonofone`
- Ready to build: ✅ Yes
- Next step: Run `eas build --profile production --platform android --type apk`

---

**Let's start with Step 2 - building your APK!** 🚀


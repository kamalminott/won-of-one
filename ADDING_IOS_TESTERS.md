# Adding iOS Testers (Non-Developers) to TestFlight

This guide shows you how to invite regular users (non-developers) to test your iOS app.

---

## Important: Use External Testing (Not Internal)

**Two Options:**
- ❌ **Internal Testing** - Requires App Store Connect account (developers only)
- ✅ **External Testing** - Anyone with email can join (perfect for regular users)

**For non-developer testers, use External Testing!**

---

## Step-by-Step: Add External Testers

### Step 1: Access TestFlight in App Store Connect

1. Go to https://appstoreconnect.apple.com/
2. Sign in with your Apple Developer account
3. Click "My Apps"
4. Select "Won Of One" app
5. Click **"TestFlight"** tab (left sidebar)

### Step 2: Verify Your Build is Ready

**Check that your build appears:**
- Look for "Build 2" (or your latest build number)
- Status should be "Ready to Submit" or "Processing Complete"
- If it's still processing, wait 10-30 minutes

**If build isn't there:**
- Make sure you uploaded via Transporter or `eas submit`
- Wait for processing to complete
- Check your email for status updates

### Step 3: Create External Testing Group

1. **Click** "External Testing" in TestFlight tab
2. **Click** "+" button or "Create a Group"
3. **Enter group details:**
   - **Name:** "Beta Testers" (or any name)
   - **Description:** "Testing Won Of One app" (optional)
4. **Click** "Create"

### Step 4: Add Your Build to the Group

1. **Select the build** you want to test (Build 2)
2. **Click** "Add Build to Test"
3. **Fill out "What to Test" section:**
   - What's new in this version
   - What you want testers to focus on
   - Any instructions
   
   Example:
   ```
   This is the first beta version of Won Of One.
   
   Please test:
   - Account creation and login
   - Adding fencing matches
   - Viewing stats and progress
   - Setting goals
   
   Report any bugs or issues!
   ```

4. **Click** "Save"

### Step 5: Submit for Beta App Review (First Time Only)

**First time only - you need Apple's approval:**

1. **Review** all the information
2. **Check** compliance questions:
   - Export compliance (usually "No" for most apps)
   - Content rights
   - Other legal questions
3. **Click** "Submit for Review"
4. **Wait** 24-48 hours for approval

**After approval:**
- Your group becomes active
- You can start adding testers immediately
- Future updates may skip review if no major changes

### Step 6: Add Testers (Two Options)

**Option A: Add Individual Email Addresses**

1. **Click** "Add Testers" in your External Testing group
2. **Enter email addresses:**
   - One per line, or comma-separated
   - Example:
     ```
     tester1@example.com
     tester2@example.com
     friend@gmail.com
     ```
3. **Click** "Add" or "Send Invitations"
4. **Confirm** - testers will receive email invitations

**Option B: Create Public Link (Easier)**

1. **Click** "Enable Public Link" in your group
2. **Copy** the generated link
   - Looks like: `https://testflight.apple.com/join/XXXXXXXX`
3. **Share** the link:
   - Send via email, text, social media
   - Anyone can join with the link
   - No need to collect individual emails

**Recommendation:** Start with individual emails for controlled testing, then use public link for broader beta.

---

## What Testers Need to Do

**For your testers (they do NOT need App Store Connect accounts):**

### 1. Install TestFlight App
- Open App Store on iPhone/iPad
- Search "TestFlight"
- Install (it's free, made by Apple)

### 2. Accept Invitation

**If you sent email invitations:**
- Tester receives email: "You're invited to test Won Of One"
- Click "Start Testing" button in email
- Opens TestFlight app automatically
- Tap "Accept" to join

**If you shared public link:**
- Tester clicks link on iPhone/iPad
- Opens TestFlight app
- Shows "Won Of One" invitation
- Tap "Accept" to join

### 3. Install the App
- In TestFlight app, see "Won Of One"
- Tap "Install" button
- App downloads and installs
- Appears on home screen like normal app

### 4. Use the App
- Launch like any other app
- Test all features
- Provide feedback (optional)

**That's it! No developer account needed for testers!**

---

## Important Notes

### For External Testers:
- ✅ **No App Store Connect account needed**
- ✅ **Just need TestFlight app** (free from App Store)
- ✅ **Works on any iPhone/iPad**
- ⏰ **First time:** 24-48 hour review delay
- ✅ **After approval:** Instant access to updates

### Beta App Review Requirements:
- Must provide "What to Test" information
- Must follow App Store guidelines
- May need to answer compliance questions
- Review takes 24-48 hours first time
- Subsequent updates may be instant

### What Testers See:
- Email invitation with app name
- TestFlight app shows your app
- Can install/update anytime
- Feedback option in TestFlight
- Automatic updates when you publish new builds

---

## Comparison: Internal vs External

| Feature | Internal Testers | External Testers |
|---------|------------------|------------------|
| **App Store Connect Account** | ✅ Required | ❌ Not needed |
| **Who Can Join** | Developers/Team | Anyone with email |
| **Max Testers** | 100 | 10,000 |
| **Review Required** | No | Yes (24-48hr first time) |
| **Access Speed** | Instant | After review |
| **Best For** | Team members | Regular users |
| **Public Link** | No | Yes |

**For your use case (non-developers):**
→ **Use External Testing** ✅

---

## Quick Checklist

**You (Developer):**
- [ ] Build uploaded to TestFlight
- [ ] Build processed (shows in TestFlight tab)
- [ ] External Testing group created
- [ ] Build added to group
- [ ] "What to Test" filled out
- [ ] Submitted for Beta App Review (first time)
- [ ] Approved by Apple (wait 24-48 hours)
- [ ] Added testers OR created public link
- [ ] Sent invitations/shared link

**Your Testers:**
- [ ] Receive email invitation OR get public link
- [ ] Install TestFlight app (free)
- [ ] Accept invitation in TestFlight
- [ ] Install your app
- [ ] Start testing!

---

## Troubleshooting

### Tester Doesn't Receive Email

**Solutions:**
- Check spam/junk folder
- Verify correct email address
- Resend invitation from TestFlight
- Use public link instead

### "App Not Available" Error

**Solutions:**
- Beta review might not be approved yet (wait 24-48 hours)
- Build might still be processing
- Check TestFlight tab for status

### Tester Can't Install

**Solutions:**
- Make sure they installed TestFlight app first
- iOS version must be compatible (iOS 13+ usually)
- Check device has enough storage
- Restart TestFlight app

### Public Link Not Working

**Solutions:**
- Verify link is enabled in group settings
- Link may be disabled - re-enable it
- Share link directly, don't embed in some apps

---

## Next Steps After Adding Testers

1. **Monitor feedback** in App Store Connect
2. **Track analytics** in PostHog: https://eu.posthog.com/project/98132
3. **Collect crash reports** from TestFlight
4. **Update app** based on feedback
5. **Push new build** when ready:
   ```bash
   eas build --profile production --platform ios
   eas submit --platform ios --profile production
   ```
6. **Testers get automatic update** notification in TestFlight

---

## Summary

**For Non-Developer Testers:**
1. ✅ Use **External Testing** (not Internal)
2. ✅ Create group → Add build → Submit for review (first time)
3. ✅ Wait 24-48 hours for approval
4. ✅ Add testers via email OR create public link
5. ✅ Testers install TestFlight app → Accept invitation → Install app
6. ✅ No App Store Connect account needed for testers!

**Your current status:**
- ✅ Build uploaded to TestFlight
- ⏭️ Create External Testing group
- ⏭️ Submit for Beta App Review
- ⏭️ Add testers after approval

Ready to add your first external testers! 🚀


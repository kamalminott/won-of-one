# TestFlight Complete Guide

This guide explains how to use TestFlight for beta testing your Won Of One app.

## Table of Contents
1. [What is TestFlight?](#what-is-testflight)
2. [Getting Started](#getting-started)
3. [Adding Testers](#adding-testers)
4. [Updating Your App](#updating-your-app)
5. [Monitoring Usage](#monitoring-usage)
6. [Limitations](#limitations)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## What is TestFlight?

TestFlight is Apple's official platform for distributing pre-release versions of iOS apps to beta testers. It allows you to:
- Share your app with up to 10,000 external testers
- Get feedback before public release
- Test on real devices
- Collect crash logs and analytics
- Distribute updates easily

**Key Features:**
- Built into App Store Connect (free)
- Automatic updates for testers
- Crash reporting included
- Feedback collection
- Review process for external testers

---

## Getting Started

### Prerequisites
- ✅ Apple Developer Account ($99/year)
- ✅ App uploaded to App Store Connect
- ✅ Build successfully processed in TestFlight

### Steps to Set Up

1. **Upload Your Build**
   ```bash
   # Build for production
   eas build --profile production --platform ios
   
   # Submit to TestFlight
   eas submit --platform ios --profile production
   
   # OR upload manually via Transporter app
   ```

2. **Wait for Processing**
   - Apple processes your build (10-30 minutes typically)
   - You'll receive an email when ready
   - Check TestFlight tab in App Store Connect

3. **Access TestFlight**
   - Go to https://appstoreconnect.apple.com/
   - Select "Won Of One" app
   - Click "TestFlight" tab

---

## Adding Testers

There are two types of testers with different rules:

### Internal Testers (Fast & Easy)

**Best For:** Team members, close friends, quick iterations

**Limitations:**
- Maximum 100 testers
- Must have App Store Connect accounts
- Instant access (no Apple review)
- Must be added individually

**How to Add:**
1. Go to TestFlight → Internal Testing
2. Click "+" to create a group (e.g., "Team Alpha", "Close Friends")
3. Enter group name and description
4. Click "Add Testers"
5. Enter email addresses of App Store Connect users
6. Click "Add" → "Start Testing"
7. Testers receive email invitation instantly

**Advantages:**
- No wait time
- No Beta App Review
- Perfect for rapid iteration
- Good for team testing

---

### External Testers (Public Beta)

**Best For:** Public beta testing, larger user base

**Limitations:**
- Maximum 10,000 testers
- Can be anyone with an email
- Requires Beta App Review (24-48 hours first time)
- Subsequent updates may skip review if no major changes
- 60-day review period per app

**How to Add:**
1. Go to TestFlight → External Testing
2. Click "+" to create a group (e.g., "Beta Testers")
3. Enter group name and description
4. Select which build to test (your latest)
5. Fill out What to Test details:
   - What's new in this version
   - Testing focus areas
   - Instructions for testers
6. Click "Add Testers" or "Enable Public Link"
7. Choose testers:
   - **Email**: Enter individual email addresses
   - **Public Link**: Generate shareable invite link
8. Submit for Beta App Review (first time only)
9. Wait 24-48 hours for approval
10. Testers receive email invitation

**Public Link Benefits:**
- No need to collect individual emails
- Share on social media, website, email lists
- Anyone with link can join (until you disable it)
- Great for public beta launches

**Disadvantages:**
- Initial review delay (24-48 hours)
- Subsequent versions may still need review
- Less control over who joins

---

## Updating Your App

### How Updates Work

**For You (Developer):**
1. Make changes to your app
2. Build new version:
   ```bash
   eas build --profile production --platform ios
   eas submit --platform ios --profile production
   ```
3. Wait for processing (10-30 min)
4. New build appears in TestFlight

**For Testers:**
- Get automatic notification when update is available
- Open TestFlight app → Tap "Update" button
- App downloads and installs automatically
- Previous version is replaced
- No data loss (unless you change database schema)

### Build Versioning

- **Version Number** (e.g., 1.0.0): Major.minor.patch
  - Increments for App Store releases
  - Set in `app.json`
  
- **Build Number** (e.g., 2, 3, 4): Sequential
  - Auto-increments with each build
  - EAS handles this automatically
  - Testers see: "Version 1.0.0 (2)" for build 2

### Update Cadence

**Recommended:**
- Deploy updates when you have meaningful changes
- Don't spam testers with every small fix
- Create test groups for different versions if needed

**Best Practice:**
- Weekly updates during active development
- Monthly updates during stable testing
- Document what changed in "What to Test"

---

## Monitoring Usage

### TestFlight Analytics

TestFlight provides built-in analytics:

1. **Overview**
   - Total testers invited
   - Active testers
   - Installs vs. opens
   - Crash count
   - Sessions per day

2. **Crash Reports**
   - Automatic crash collection
   - Symbolicated crash logs
   - Device information
   - Steps to reproduce
   - Export for debugging

3. **Feedback**
   - In-app feedback from testers
   - Screenshots with annotations
   - Ratings and comments
   - Accessible in App Store Connect

### Third-Party Analytics

**Your app already includes PostHog analytics!**

Monitor:
- User events: https://eu.posthog.com/project/98132
- Feature usage
- Conversion funnels
- User journeys
- Session recordings (if enabled)

**Key Metrics to Track:**
- App opens per tester
- Feature adoption rates
- Crash-free sessions
- User retention (D1, D7)
- Goal completion rates

---

## Limitations

### Technical Limitations

1. **Build Expiration**
   - TestFlight builds expire after **90 days**
   - You must upload a new build before expiration
   - Testers won't be notified, app just stops working
   - Solution: Upload new builds regularly

2. **Size Limits**
   - Maximum app size: 4GB (cellular download)
   - 200MB recommended for best user experience
   - iOS 13+: Can download larger apps on Wi-Fi

3. **Device Compatibility**
   - Only iOS devices (iPhone, iPad, iPod Touch)
   - macOS apps need separate TestFlight
   - watchOS apps included with iOS app
   - tvOS apps have their own TestFlight

4. **Concurrent Builds**
   - Maximum **40 builds** per app (total)
   - Old builds must be expired/removed to add new ones
   - External testing: Up to 3 builds at once
   - Internal testing: All builds available

5. **Beta App Review Time**
   - First external build: 24-48 hours
   - Subsequent builds: Usually faster (hours)
   - Rejected builds need fixes and resubmission
   - Review criteria similar to App Store

### User Limitations

1. **Tester Requirements**
   - Must have iOS device with iOS 8+ (or current minimum)
   - Must install TestFlight app from App Store
   - Must accept invitation email
   - Must be 13+ years old

2. **App Store Install**
   - TestFlight app installation required
   - Cannot install directly via URL
   - Must use invitation link or email

3. **Multiple Versions**
   - Testers can only have ONE version installed
   - Cannot test multiple builds simultaneously
   - Installing new version removes old one

---

## Best Practices

### For Development

1. **Version Planning**
   - Create meaningful version increments
   - Document breaking changes
   - Test internally before external
   - Use semantic versioning

2. **Update Communication**
   - Write clear "What to Test" messages
   - Explain what changed
   - Ask for specific feedback
   - Set testing focus areas

3. **Build Frequency**
   - Don't overwhelm testers
   - Weekly updates for active development
   - Monthly for stable versions
   - Communicate major updates separately

4. **Group Management**
   - Organize testers by role/purpose
   - Create separate groups for:
     - Internal team
     - Power users
     - General beta testers
     - Specific feature testing

### For Testers

**Guide Your Testers:**
1. Install TestFlight app first
2. Accept email invitation
3. Leave constructive feedback
4. Report crashes with steps
5. Update regularly when notified

**Provide Tester Resources:**
- Quick start guide
- Known issues list
- Feedback template
- Feature walkthrough video
- Contact information

---

## Troubleshooting

### Build Not Appearing

**Problem:** Upload successful but no build in TestFlight

**Solutions:**
- Wait 10-30 minutes for processing
- Check email for status updates
- Refresh TestFlight page
- Verify bundle ID matches App Store Connect app
- Check build logs for errors

### Testers Not Receiving Invites

**Problem:** Invitations sent but not received

**Solutions:**
- Check spam/junk folder
- Verify correct email addresses
- Resend invitation from TestFlight
- Check if tester already in another group
- Ensure tester installed TestFlight app

### Build Expired

**Problem:** "This beta isn't available" error

**Solutions:**
- Build expired after 90 days
- Upload new build immediately
- New version replaces expired one
- Testers update automatically

### App Won't Install

**Problem:** Testers can't install app

**Solutions:**
- Ensure iOS version is compatible
- Free up storage space
- Restart device
- Re-download invitation
- Uninstall TestFlight and reinstall

### Beta App Review Rejected

**Problem:** External testing build rejected

**Solutions:**
- Review rejection feedback
- Fix identified issues
- Update app compliance
- Add missing information (privacy, testing instructions)
- Resubmit for review

### Update Not Showing

**Problem:** Testers not seeing new version

**Solutions:**
- Confirm build finished processing
- Check build is assigned to tester group
- Verify "Start Testing" was clicked
- Testers may need to refresh TestFlight app
- Force-quit and reopen TestFlight

---

## Workflow Example

### Complete Beta Testing Workflow

**Week 1: Initial Launch**
```bash
# 1. Build and upload
eas build --profile production --platform ios
eas submit --platform ios --profile production

# 2. Wait for processing

# 3. Add internal testers (your team)
TestFlight → Internal Testing → Create Group → Add Emails

# 4. Collect initial feedback
Monitor PostHog analytics
Review crash reports
Read feedback

# 5. Fix critical bugs
Update code
Commit changes
```

**Week 2: Public Beta**
```bash
# 1. Build with fixes
eas build --profile production --platform ios
eas submit --platform ios --profile production

# 2. Create external group
TestFlight → External Testing → Create Group
Select latest build
Write "What to Test"

# 3. Submit for Beta App Review
Fill out details → Submit

# 4. Wait 24-48 hours

# 5. Invite testers
Add emails or generate public link
```

**Week 3+: Iterations**
```bash
# Weekly update cadence
eas build --profile production --platform ios
eas submit --platform ios --profile production

# If major changes: Submit for review
# If minor fixes: Usually auto-approved

# Check tester feedback regularly
# Update test notes
# Monitor analytics
```

---

## Summary

**TestFlight Workflow:**
1. ✅ Build → Submit → Upload → Process → Test
2. ✅ Create groups → Add testers → Send invites
3. ✅ Collect feedback → Fix issues → Update
4. ✅ Monitor analytics → Iterate → Refine

**Your Current Setup:**
- ✅ App uploaded: Version 1.0.0 (Build 2)
- ✅ PostHog analytics enabled
- ✅ Ready for internal testing
- ✅ Ready for external testing (after review)

**Next Steps:**
1. Create your first internal testing group
2. Add yourself as a tester to verify
3. Add team members for feedback
4. Build and push updates weekly
5. Launch external beta when ready

**Remember:**
- Builds expire after 90 days
- Keep testers updated with meaningful changes
- Monitor PostHog for usage data
- External testing requires review first time
- Public link is easiest for large groups

---

## Quick Reference

| Feature | Internal | External |
|---------|----------|----------|
| Max Testers | 100 | 10,000 |
| Review Required | No | Yes (24-48hr) |
| Who Can Join | App Store Connect users | Anyone |
| Instant Access | Yes | After review |
| Public Link | No | Yes |
| Build Limit | 40 total | 3 at once |

**Recommended Groups:**
1. **Internal Team** - 5-10 people, instant access
2. **Power Users** - 20-30 people, early access
3. **General Beta** - Public link, broader testing

**Your App: Won Of One**
- Bundle ID: `com.kamalminott.wonofone`
- Current: Version 1.0.0 (Build 2)
- Analytics: PostHog (eu.posthog.com/project/98132)
- Ready for: Both internal and external testing

For more help: https://help.apple.com/app-store-connect/testflight/


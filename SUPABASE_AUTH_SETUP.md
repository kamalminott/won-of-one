# Supabase Authentication Setup for Beta Testers

This guide helps you configure Supabase authentication so your beta testers can sign up and sign in.

---

## Common Issues

### Issue 1: Email Confirmation Required

**Problem:** Testers sign up but can't sign in because Supabase requires email confirmation.

**Solution:** Disable email confirmation for beta testing, or ensure testers confirm their email.

---

## Step-by-Step: Enable Sign-Ups for Testers

### Step 1: Access Supabase Dashboard

1. Go to https://supabase.com
2. Sign in with your account
3. Select your project (the one for Won Of One)

### Step 2: Check Authentication Settings

1. **Go to:** Authentication → Settings (in left sidebar)

2. **Check "Enable email signups":**
   - Make sure this toggle is **ON** (green/enabled)
   - If it's off, testers cannot create accounts

3. **Check "Confirm email":**
   - **Option A (Recommended for Beta):** Turn this **OFF**
     - Testers can sign in immediately after signup
     - No email confirmation needed
     - Faster for beta testing
  
   - **Option B:** Keep it **ON** but ensure testers:
     - Check their email for confirmation link
     - Click the confirmation link
     - Then sign in

### Step 3: Configure Email Templates (If Confirmation Enabled)

**If you keep email confirmation ON:**

1. Go to: Authentication → Email Templates
2. Check "Confirm signup" template
3. Make sure it's configured correctly
4. Test that emails are being sent

**Common Issues:**
- Emails going to spam
- Email provider blocking Supabase emails
- SMTP not configured (uses Supabase default)

### Step 4: Test Authentication Flow

**Test yourself first:**
1. Try creating a test account
2. Check if you receive confirmation email (if enabled)
3. Try signing in
4. Verify it works

---

## Recommended Settings for Beta Testing

### Quick Setup (No Email Confirmation)

**Best for:** Fast beta testing, internal testers

```
✅ Enable email signups: ON
❌ Confirm email: OFF
✅ Secure email change: ON (optional)
✅ Secure password change: ON (optional)
```

**Benefits:**
- Testers sign up and can immediately sign in
- No email delays
- Faster onboarding

**Drawbacks:**
- Less secure (anyone can use any email)
- Not production-ready

### Production Setup (With Email Confirmation)

**Best for:** Public beta, external testers

```
✅ Enable email signups: ON
✅ Confirm email: ON
✅ Secure email change: ON
✅ Secure password change: ON
```

**Instructions for Testers:**
1. Sign up with email
2. Check email (including spam folder)
3. Click confirmation link
4. Return to app and sign in

---

## Additional Settings to Check

### Authentication Providers

**In Supabase Dashboard → Authentication → Providers:**

1. **Email:**
   - Should be enabled (default)
   - This is what your app uses

2. **Social Providers (Google, Apple):**
   - Currently disabled in your app code
   - Can enable later if needed

### Rate Limiting

**Check:** Authentication → Settings → Rate Limits

- **Email signups:** Should allow reasonable limits
- **Password resets:** Should allow reasonable limits
- Default limits are usually fine

### Security Settings

**Authentication → Settings → Security:**

- **JWT expiry:** Default is fine
- **Refresh token rotation:** Can enable for better security
- **Password requirements:** Check minimum length (your app requires 6+)

---

## Troubleshooting

### Testers Can't Sign Up

**Error:** "Signups are disabled" or similar

**Fix:**
1. Go to Supabase Dashboard
2. Authentication → Settings
3. Enable "Enable email signups"
4. Save changes

---

### Testers Sign Up But Can't Sign In

**Error:** "Email not confirmed" or "Invalid login credentials"

**Possible Causes:**
1. **Email confirmation required:**
   - Check if "Confirm email" is ON
   - Testers need to click email link first
   - Or disable email confirmation for beta

2. **Wrong password:**
   - Testers might have misremembered password
   - Check if they're using correct email

3. **Email not sent:**
   - Check Supabase logs
   - Verify email template is configured
   - Check spam folder

---

### Testers Don't Receive Confirmation Email

**If email confirmation is enabled:**

1. **Check Supabase logs:**
   - Go to Logs → Auth
   - Look for email sending errors

2. **Check email provider:**
   - Supabase uses default SMTP (may have rate limits)
   - Upgrade to custom SMTP for better delivery

3. **Check spam folder:**
   - Emails often go to spam
   - Tell testers to check spam/junk

4. **Verify email address:**
   - Make sure testers entered correct email
   - Typos prevent delivery

---

### Network Errors

**Error:** "Network error" or "Connection failed"

**Possible Causes:**
1. **Supabase URL/Key incorrect:**
   - Check environment variables
   - Verify in `.env` or `app.json`

2. **Supabase project paused:**
   - Free tier projects pause after inactivity
   - Wake up project in Supabase dashboard

3. **Internet connection:**
   - Testers need internet for signup/login
   - App works offline AFTER login

---

## Quick Fix Checklist

**For immediate beta testing, do this:**

1. ✅ **Enable email signups:**
   - Supabase Dashboard → Authentication → Settings
   - Toggle "Enable email signups" ON

2. ✅ **Disable email confirmation (temporary):**
   - Supabase Dashboard → Authentication → Settings
   - Toggle "Confirm email" OFF
   - Testers can sign in immediately

3. ✅ **Test yourself:**
   - Create a test account
   - Verify you can sign in
   - Then share with testers

4. ✅ **Re-enable confirmation before production:**
   - Turn "Confirm email" back ON
   - For security and production readiness

---

## Environment Variables Check

**Verify your app has correct Supabase credentials:**

Your app should have:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**To check:**
1. Look in `.env` file (if exists)
2. Or check `app.json` extra config
3. Or check Supabase project settings

**Your Supabase URL should be:**
- Format: `https://xxxxx.supabase.co`
- Found in: Supabase Dashboard → Settings → API

**Your Anon Key should be:**
- Format: Long JWT token
- Found in: Supabase Dashboard → Settings → API → anon/public key

---

## Testing Checklist

**Before sharing with testers:**

- [ ] Email signups enabled in Supabase
- [ ] Email confirmation disabled (for beta) OR instructions provided
- [ ] Tested signup yourself - works
- [ ] Tested login yourself - works
- [ ] Verified Supabase project is active (not paused)
- [ ] Environment variables are set correctly
- [ ] App can connect to Supabase (no network errors)

---

## Instructions for Testers

**If email confirmation is enabled, tell testers:**

```
1. Sign up with your email address
2. Check your email (including spam folder)
3. Click the confirmation link in the email
4. Return to the app
5. Sign in with your email and password

If you don't receive the email:
- Check spam/junk folder
- Wait a few minutes
- Try signing up again
- Contact support if still having issues
```

**If email confirmation is disabled:**

```
1. Sign up with your email and password
2. You can sign in immediately - no email confirmation needed!
3. Start using the app

Note: Make sure you remember your password as there's no recovery email yet.
```

---

## Production Recommendations

**Before public launch:**

1. ✅ **Enable email confirmation**
   - Better security
   - Prevents fake accounts
   - Industry standard

2. ✅ **Set up custom SMTP**
   - Better email delivery
   - Professional sender address
   - Higher rate limits

3. ✅ **Add password reset**
   - Already implemented in your app (`forgot-password.tsx`)
   - Make sure it's working

4. ✅ **Enable social login** (optional)
   - Google/Apple sign-in
   - Better user experience
   - Reduces friction

---

## Current Status

**Your app uses:**
- Email/password authentication ✅
- Supabase Auth ✅
- Password reset flow ✅
- User profile creation ✅

**What to check:**
1. Supabase Dashboard → Authentication → Settings
2. "Enable email signups" should be ON
3. "Confirm email" - your choice (OFF for beta, ON for production)

---

## Quick Access Links

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Your Project:** Select your project from the list
- **Auth Settings:** Project → Authentication → Settings
- **Email Templates:** Project → Authentication → Email Templates
- **User Management:** Project → Authentication → Users

---

## Summary

**To fix sign-up issues:**

1. **Go to Supabase Dashboard**
2. **Authentication → Settings**
3. **Enable "Enable email signups"**
4. **For beta: Disable "Confirm email"**
5. **Test yourself**
6. **Share with testers**

**For production:**
- Re-enable email confirmation
- Set up custom SMTP
- Test email delivery

Your authentication code is already set up correctly - it's just a Supabase configuration issue! 🔧


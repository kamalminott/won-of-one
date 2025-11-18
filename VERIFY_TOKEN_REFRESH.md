# How to Verify Token Refresh is Working

## 🎯 The Goal

Verify that when the 1-hour access token expires, the refresh token automatically refreshes it, keeping users logged in for 30-60 days.

---

## 🔍 How Token Refresh Works

1. **User logs in** → Gets access token (1 hour) + refresh token (30 days)
2. **After 1 hour** → Access token expires
3. **On next API call** → Supabase automatically uses refresh token to get new access token
4. **User stays logged in** → No interruption, seamless experience
5. **After 30 days** → Refresh token expires → User needs to login again

---

## ✅ Quick Verification Methods

### Method 1: Check Console Logs (Easiest)

**What to look for:**

1. **On App Start:**
   ```
   ✅ [AUTH] Session found!
   ✅ [AUTH] Refresh token present - session will persist
   ✅ [AUTH] Access token valid for X more minutes
   ```

2. **When Token Refreshes (after 1 hour or on API call):**
   ```
   ✅ Token refreshed successfully
   🔄 Auth state change: TOKEN_REFRESHED
   ```

3. **If Refresh Fails:**
   ```
   ⚠️ User signed out - possible token refresh failure
   🔄 Auth state change: SIGNED_OUT
   ```

---

### Method 2: Test with Manual API Call (Fast Test)

Instead of waiting 1 hour, you can trigger a refresh by making an API call after the token expires:

1. **Wait for access token to expire** (or manually expire it - see Method 3)
2. **Make any API call** (navigate to a page, refresh data, etc.)
3. **Check logs** for `TOKEN_REFRESHED` event

---

### Method 3: Temporarily Reduce Token Expiry (For Testing)

**⚠️ Only for testing - revert after!**

You can temporarily set access token expiry to 1 minute in Supabase to test faster:

1. Go to Supabase Dashboard → Settings → JWT Keys
2. Change "Access token expiry time" from `3600` to `60` (1 minute)
3. Login to your app
4. Wait 1 minute
5. Make an API call (navigate, refresh)
6. Check logs for token refresh
7. **Revert back to 3600** after testing!

---

### Method 4: Check Token Status in Settings Page

We can add a token status display to your settings page to see:
- Access token expiry time
- Refresh token status
- Time until next refresh needed

---

## 🧪 Step-by-Step Test Plan

### Test 1: Verify Session Persists (Quick)

1. **Login to app**
2. **Check logs:**
   ```
   ✅ [AUTH] Session found!
   ✅ [AUTH] Refresh token present
   ```
3. **Close app completely**
4. **Reopen app**
5. **Should still be logged in** ✅

### Test 2: Verify Token Refresh (1 Hour Wait)

1. **Login to app**
2. **Note the time** when you see: `✅ [AUTH] Access token valid for 59 more minutes`
3. **Wait 1 hour** (or use Method 3 to speed this up)
4. **Make an API call** (navigate to home, refresh data)
5. **Check logs for:**
   ```
   ✅ Token refreshed successfully
   🔄 Auth state change: TOKEN_REFRESHED
   ```
6. **User should still be logged in** ✅

### Test 3: Verify Long-Term Persistence (30 Days)

1. **Login to app**
2. **Close app**
3. **Wait 30 days** (or test with preview build over time)
4. **Reopen app**
5. **Should still be logged in** ✅ (if within 30 days)

### Test 4: Verify Expiration (After 30 Days)

1. **Wait for refresh token to expire** (30+ days)
2. **Reopen app**
3. **Should redirect to login** ✅
4. **Check logs for:**
   ```
   ⚠️ [AUTH] No session found - user needs to login
   ```

---

## 📊 What Success Looks Like

### ✅ Working Correctly:

**Day 1:**
- User logs in
- Session persists after app restart
- Access token refreshes automatically

**Day 2-29:**
- User opens app → Still logged in
- No login prompts
- Seamless experience

**Day 30:**
- User opens app → Still logged in (refresh token still valid)

**Day 31+:**
- User opens app → Redirected to login (refresh token expired)

### ❌ Not Working:

- User gets logged out after 1 hour ❌
- User gets logged out after app restart ❌
- No `TOKEN_REFRESHED` events in logs ❌
- `⚠️ [AUTH] No refresh token in session` in logs ❌

---

## 🔧 Debugging Tools

### Check Current Token Status

Add this to your settings page or use in console:

```typescript
const checkTokenStatus = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60);
    
    console.log('Token Status:', {
      hasAccessToken: !!session.access_token,
      hasRefreshToken: !!session.refresh_token,
      expiresAt: expiresAt.toISOString(),
      minutesUntilExpiry,
      willAutoRefresh: minutesUntilExpiry < 60
    });
  }
};
```

### Monitor Token Refresh Events

Watch for these events in your logs:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('✅ Token refreshed at:', new Date().toISOString());
  }
});
```

---

## 📱 Testing in Different Environments

### Dev Environment:
- ✅ Quick testing
- ✅ Immediate feedback
- ⚠️ May not persist perfectly (dev server restarts)

### Preview Environment:
- ✅ Full lifecycle testing
- ✅ Real persistence
- ✅ Best for long-term testing

### Production:
- ✅ Real user experience
- ✅ Monitor via analytics
- ✅ Track `token_refresh_success` events

---

## 🎯 Quick Verification Checklist

- [ ] Session persists after app restart
- [ ] `TOKEN_REFRESHED` events appear in logs
- [ ] User stays logged in for days/weeks
- [ ] No unexpected logouts
- [ ] Refresh token present in session
- [ ] Access token auto-refreshes

---

## 💡 Pro Tips

1. **Use Preview Build for Real Testing:**
   - Dev environment may clear storage
   - Preview build tests full lifecycle

2. **Monitor Analytics:**
   - Track `token_refresh_success` events
   - Should happen ~24 times/day per user

3. **Check Logs Regularly:**
   - Look for `TOKEN_REFRESHED` events
   - Watch for error messages

4. **Test Edge Cases:**
   - App killed while offline
   - Network interruption during refresh
   - Multiple devices logged in

---

## ✅ Summary

**To verify refresh tokens are working:**

1. ✅ **Session persists** after app restart
2. ✅ **`TOKEN_REFRESHED` events** appear in logs
3. ✅ **User stays logged in** for 30+ days
4. ✅ **No login prompts** during normal use

**The refresh happens automatically in the background - you'll see it in the logs!**


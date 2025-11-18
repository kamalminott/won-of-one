# Testing Refresh Token Implementation

## 🎯 Quick Answer

**You can test in BOTH environments:**
- **Dev Environment**: Quick testing, immediate feedback
- **Preview Environment**: More realistic, tests full app lifecycle

---

## 🧪 Testing in Dev Environment

### What Works:
✅ Token refresh logic  
✅ Session persistence  
✅ Auto-refresh on API calls  
✅ Error handling  

### What Doesn't Work Well:
❌ Testing app restart persistence (dev server restarts clear state)  
❌ Long-term expiry testing (hard to wait 30 days)

### Steps to Test:

1. **Start Dev Server:**
   ```bash
   npm start
   ```

2. **Open App on Device:**
   - Connect via Expo Go or dev client
   - Login to your app

3. **Check Console Logs:**
   Look for these messages:
   ```
   🔍 Checking for existing session...
   ✅ Session valid for X more minutes
   🔄 Auth state change: SIGNED_IN
   ```

4. **Test Token Refresh:**
   - Wait 1 hour (or manually trigger API call)
   - Check logs for:
     ```
     ✅ Token refreshed successfully
     🔄 Auth state change: TOKEN_REFRESHED
     ```

5. **Test Session Persistence:**
   - Close app completely
   - Reopen app
   - Should still be logged in
   - Check logs for session restoration

---

## 📱 Testing in Preview Environment (Recommended)

### Why Preview is Better:
✅ Tests full app lifecycle  
✅ Tests session persistence after app restart  
✅ More realistic user experience  
✅ Can test with real device  

### Steps to Test:

1. **Build Preview Build (if you don't have one):**
   ```bash
   eas build --profile preview --platform ios
   # or
   eas build --profile preview --platform android
   ```

2. **Install on Device:**
   - Download from EAS or TestFlight/Play Console
   - Install on your device

3. **Login Once:**
   - Open app
   - Login with your credentials
   - Verify you're logged in

4. **Test Session Persistence:**
   - **Close app completely** (swipe away from app switcher)
   - Wait 30 seconds
   - **Reopen app**
   - ✅ Should still be logged in (no login screen)

5. **Check Console Logs (if connected):**
   ```bash
   # Connect device via USB and check logs
   npx react-native log-ios
   # or
   npx react-native log-android
   ```
   
   Look for:
   ```
   🔍 Checking for existing session...
   ✅ Session valid for X more minutes
   ```

6. **Test Token Refresh:**
   - Keep app open for 1+ hour
   - Make an API call (navigate, refresh data)
   - Check logs for token refresh

7. **Test Expiration (Optional):**
   - Wait 30 days (or modify code temporarily to test)
   - Should redirect to login screen

---

## 🔍 What to Look For

### ✅ Success Indicators:

**On App Launch:**
```
🔍 Checking for existing session...
🔍 Session check result: { session: true, userId: '...', expiresAt: '...' }
✅ Session valid for 43200 more minutes  // ~30 days
```

**During Token Refresh:**
```
✅ Token refreshed successfully
🔄 Auth state change: TOKEN_REFRESHED
```

**On App Restart:**
- App opens directly to home screen (not login)
- No login prompt
- User data loads automatically

### ❌ Failure Indicators:

**Session Not Persisting:**
```
🔍 Session check result: { session: false }
// User redirected to login
```

**Token Refresh Failing:**
```
⚠️ User signed out - possible token refresh failure
🔄 Auth state change: SIGNED_OUT
```

---

## 🧪 Quick Test Checklist

### Dev Environment:
- [ ] Login works
- [ ] Console shows session valid message
- [ ] Can navigate app while logged in
- [ ] Token refresh events appear in logs (after 1 hour or API call)

### Preview Environment:
- [ ] Login works
- [ ] Close app completely
- [ ] Reopen app → Still logged in ✅
- [ ] Session persists across app restarts
- [ ] No unexpected logouts

---

## 🐛 Troubleshooting

### Issue: User gets logged out immediately
**Check:**
1. `persistSession: true` in `lib/supabase.ts` ✅
2. AsyncStorage permissions
3. App storage not being cleared

### Issue: Token refresh not happening
**Check:**
1. `autoRefreshToken: true` in `lib/supabase.ts` ✅
2. Network connectivity
3. Supabase project status

### Issue: Session not persisting after app restart
**Check:**
1. App is fully closed (not just backgrounded)
2. AsyncStorage is working
3. No code clearing storage on app start

---

## 📊 Monitoring in Production

### Analytics Events to Watch:
- `token_refresh_success` - Should happen ~24 times/day per user
- `user_signed_out` - Track logout reasons
- `login_success` - Monitor login frequency

### Console Logs to Monitor:
- `✅ Token refreshed successfully` - Normal operation
- `⚠️ Session expired` - Should trigger refresh
- `❌ Error getting session` - Needs investigation

---

## 🎯 Recommended Testing Flow

1. **Quick Test (Dev):**
   - Login → Check logs → Verify session
   - ✅ Confirms code is working

2. **Full Test (Preview):**
   - Install preview build
   - Login → Close app → Reopen
   - ✅ Confirms full lifecycle works

3. **Long-term Test (Preview):**
   - Leave app for 24+ hours
   - Reopen → Should still be logged in
   - ✅ Confirms token refresh works

---

## 💡 Pro Tips

1. **Use Preview Build for Real Testing:**
   - Dev environment is great for development
   - Preview build tests the real user experience

2. **Check Logs Regularly:**
   - Console logs show exactly what's happening
   - Helps debug issues quickly

3. **Test Edge Cases:**
   - App killed while offline
   - Network interruption during refresh
   - Multiple devices logged in

---

## ✅ You're Ready to Test!

The implementation is complete. Start with dev environment for quick verification, then use preview build for full testing.


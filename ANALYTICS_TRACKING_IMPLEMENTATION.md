# PostHog Analytics Tracking Implementation Status

## ✅ Completed

### 1. Analytics Helper (`lib/analytics.ts`)
- ✅ Expanded with all helper functions:
  - Authentication: `loginAttempt`, `loginSuccess`, `loginFailure`, `signupStart`, `signupSuccess`, `signupFailure`, `signupAbandon`
  - Match: `matchCompleted`, `matchCompleteFailure`, `matchAbandoned`, `matchSetupStart`, `matchSetupAbandon`, `periodTransition`, `matchSummaryViewed`
  - Goals: `goalCreationFlowStarted`, `goalSaved`, `goalCompleted`, `goalDeleted`, `goalModalOpen`, `goalModalClose`
  - Progress: `progressTargetSet`, `sessionLogged`, `progressTargetReached`
  - Match History: `matchSelected`, `matchDeleted`, `matchDetailsViewed`
  - Manual Match: `matchFormStarted`, `matchSave`, `matchSaveFailure`, `formAbandon`
  - Offline/Sync: `offlineModeDetected`, `offlineMatchSaved`, `syncAttempted`, `syncFailure`
  - Dashboard: `dashboardImpression`, `quickActionClick`, `recentMatchTap`
  - Settings: `accountDeleted`, `logout`

### 2. Authentication Pages
- ✅ **Login (`app/login.tsx`)**
  - Screen view tracking
  - Login attempt tracking
  - Login success/failure with error types
  - Forgot password click
  - Create account click

- ✅ **Create Account (`app/create-account.tsx`)**
  - Screen view tracking
  - Signup start (when user begins filling form)
  - Signup validation errors (field-level)
  - Signup success/failure with error types
  - Form abandonment tracking

### 3. Home Page (`app/(tabs)/index.tsx`)
- ✅ Screen view and dashboard impression
- ✅ User identification
- ✅ Quick action clicks (log match)
- ✅ Goal save/update/delete tracking
- ✅ Recent matches view all

## 🔄 In Progress / Needs Completion

### 4. Remote Match Page (`app/(tabs)/remote.tsx`)
**Needs to be added:**
- [ ] Screen view tracking on focus
- [ ] Match setup start (when user begins entering opponent info)
- [ ] Match start tracking (when timer starts) - check if `analytics.matchStart` is already called
- [ ] Period transition tracking
- [ ] Match completion tracking (both online and offline)
- [ ] Match abandonment tracking
- [ ] Offline mode detection tracking

**Already partially implemented:**
- Score increment tracking (via `analytics.scoreIncrement`)

### 5. Profile Page (`app/(tabs)/profile.tsx`)
**Needs to be added:**
- [ ] Screen view tracking
- [ ] Profile update tracking (handedness, weapon) - check if already implemented
- [ ] Profile image change tracking
- [ ] Name edit tracking

### 6. Settings Page (`app/settings.tsx`)
**Needs to be added:**
- [ ] Screen view tracking
- [ ] Edit profile navigation click
- [ ] Account deletion tracking (CRITICAL)
- [ ] Logout tracking
- [ ] Analytics opt-out tracking

### 7. Add Match Page (`app/add-match.tsx`)
**Needs to be added:**
- [ ] Screen view tracking
- [ ] Form start tracking
- [ ] Match type/weapon selection tracking
- [ ] Match save success/failure tracking
- [ ] Form abandonment tracking

### 8. Match History Pages
**`app/match-history.tsx`:**
- [ ] Screen view tracking
- [ ] Match selection tracking
- [ ] Match deletion tracking
- [ ] Search/filter usage tracking

**`app/match-history-details.tsx`:**
- [ ] Screen view tracking
- [ ] Match details viewed tracking
- [ ] Match edit tracking (if applicable)

### 9. Match Summary Pages
**`app/match-summary.tsx` & `app/neutral-match-summary.tsx`:**
- [ ] Screen view tracking
- [ ] Match summary viewed tracking
- [ ] Next match click tracking

### 10. Goal Setting Page (`app/set-goal.tsx`)
**Needs to be added:**
- [ ] Screen view tracking
- [ ] Goal creation flow started
- [ ] Goal modal open/close tracking

### 11. Offline/Sync Tracking
**In `lib/offlineRemoteService.ts` or `lib/syncManager.ts`:**
- [ ] Offline mode detected
- [ ] Offline match saved
- [ ] Sync attempted
- [ ] Sync success/failure tracking
- [ ] Sync conflict tracking

### 12. Progress Card Component (`components/ProgressCard.tsx`)
**Needs to be added:**
- [ ] Progress target set tracking
- [ ] Session logged tracking (+1 button)
- [ ] Progress target reached tracking

### 13. Goal Card Component (`components/GoalCard.tsx`)
**Needs to be added:**
- [ ] Goal modal open/close tracking
- [ ] Goal type selection tracking
- [ ] Goal parameters configuration tracking

## 📋 Implementation Checklist

### Phase 1: Critical Pages (Do First)
1. [ ] Remote page - match start, completion, abandonment
2. [ ] Profile page - screen view, updates
3. [ ] Settings page - account deletion, logout
4. [ ] Add match page - form tracking

### Phase 2: Match Flow (Do Second)
5. [ ] Match history pages - selection, deletion
6. [ ] Match summary pages - view tracking
7. [ ] Match setup tracking on remote page

### Phase 3: Goal & Progress Tracking (Do Third)
8. [ ] Goal setting page tracking
9. [ ] Progress card component tracking
10. [ ] Goal card component modal tracking

### Phase 4: Offline & Sync (Do Fourth)
11. [ ] Offline mode detection
12. [ ] Sync operations tracking
13. [ ] Offline match completion tracking

## 🎯 Event Naming Convention

All events follow the pattern:
- Screen views: `screen_view` with `screen_name` property (via `analytics.screen()`)
- User actions: `{feature}_{action}` (e.g., `match_start`, `goal_save`)
- Errors: `{feature}_{action}_failure` with `error_type` property
- User properties: Set via `identify()` calls, not events

## 📊 Key Metrics to Monitor

1. **Retention Metrics:**
   - Login success rate
   - Signup completion rate
   - Match completion rate
   - Goal creation rate
   - Dashboard engagement rate

2. **Funnel Metrics:**
   - Login → Match Start → Match Complete
   - Goal Creation → Goal Completion
   - Signup → First Match

3. **Error Rates:**
   - Login failures by type
   - Signup failures by type
   - Match completion failures
   - Sync failures

4. **Engagement Metrics:**
   - Average matches per user
   - Average goals per user
   - Feature adoption rates
   - Session duration

## 🚨 Critical Alerts to Set Up

1. Account deletion rate > 2%
2. Match completion rate < 50%
3. Sync failure rate > 15%
4. Login failure rate > 20%
5. Signup abandonment rate > 50%


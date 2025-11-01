## PostHog Analytics Integration

### What we added

- `lib/analytics.ts`: A thin, typed wrapper around `posthog-react-native` with helpers tailored to this app (matchStart, scoreIncrement, syncResult, profileUpdate), plus `screen`, `identify`, and `setOptOut`.
- App bootstrap: Initialized analytics once in `app/_layout.tsx`.
- Home screen: Automatic screen capture and `identify(user.id)` when available.
- Profile: Tracking for `handedness` and `preferred_weapon` updates and updating user traits.

### Installation (if you set up a new environment)

1) Install packages:

```
npm i posthog-react-native expo-application expo-device
```

2) Configure environment variables (Expo):

- Add to `app.config.*` or environment (e.g. `.env` with `EXPO_PUBLIC_` prefix):

```
EXPO_PUBLIC_POSTHOG_KEY=YOUR_PROJECT_API_KEY
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

3) iOS native (only if bare):

```
cd ios && pod install
```

### Where it’s initialized

- `app/_layout.tsx` calls `analytics.init()` in a `useEffect` so analytics is ready app‑wide.

### What events and traits we capture now

- Screen: `Home` screen is recorded on mount via `analytics.screen('Home')`.
- Identity: When a user is present on Home, we `identify(user.id)`.
- Profile updates:
  - `profile_update { field: 'handedness' }` and `identify(user.id, { handedness })`
  - `profile_update { field: 'preferred_weapon' }` and `identify(user.id, { preferred_weapon })`

### ⚠️ Session Replay Limitations for Native Mobile Apps

**Important:** Session replay in PostHog has **limited support** for native React Native iOS/Android apps:

- **Works well for:** React Native Web builds (web platform)
- **Limited/experimental for:** Native iOS and Android apps
- **What still works perfectly:** Event tracking (`analytics.capture()`, `analytics.screen()`) - this is the primary way to track user behavior in mobile apps
- **Why:** Session replay is designed for web browsers where it can capture DOM interactions. Native mobile apps use different rendering systems that make visual replay more challenging.

**Recommendation:** Focus on comprehensive event tracking (which is working) rather than visual session replay for native mobile apps. Event tracking provides better insights for mobile apps anyway, as it captures specific user actions and journeys without relying on visual screen capture.

If you need visual session replay for native apps, consider:
1. Using React Native Web for a web version of your app
2. Alternative tools specifically designed for mobile app session replay
3. Check PostHog's latest documentation for any updates to mobile session replay support

### How to track more

Use the shared wrapper:

```
import { analytics } from '@/lib/analytics';

analytics.capture('event_name', { any: 'props' });
analytics.screen('ScreenName', { extra: 'props' });
analytics.identify(user.id, { trait: 'value' });
```

Domain helpers already provided:

```
analytics.matchStart({ mode: 'remote', is_offline: true, remote_id });
analytics.scoreIncrement({ side: 'you', new_score: 8, period: 2, is_offline: false });
analytics.syncResult({ success: true, queued_ops: 3, duration_ms: 420 });
analytics.profileUpdate({ field: 'name' });
```

### Recommended events for this app

- Onboarding/auth: `app_open`, `login_success`, `signup_success`, `onboarding_complete`
- Match flow: `match_start`, `score_increment`, `period_change`, `match_complete`, `match_summary_viewed`
- Offline/sync: `offline_mode_on`, `offline_mode_off`, `op_queued`, `sync_result`
- Profile: `profile_open`, `profile_update { field }`

Attach core props to events when available:

```
user_id, session_id, app_version, is_offline, queue_depth
```

### Privacy and controls

- Wrapper exposes `analytics.setOptOut(boolean)` for a Settings toggle.
- Avoid sending PII fields; use `user_id`. If needed, hash emails client‑side before sending.

### Dashboards (in PostHog)

- Funnels: `app_open → match_start → match_complete → match_summary_viewed`
- Retention: weekly retention by cohort
- Reliability: `sync_result.fail` by error code, crash data (use Sentry for crashes)

### Extending to more screens

- Add `analytics.screen('Profile')` in `app/(tabs)/profile.tsx` (optional) and similar for other screens.
- Add calls in `app/(tabs)/remote.tsx` at key actions (match start, scoring, complete, sync result).

### Notes

- The wrapper registers app/device context automatically (version, build, OS, model).
- To disable analytics globally at runtime, call `analytics.setOptOut(true)`.



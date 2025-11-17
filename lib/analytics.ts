import { PostHog } from 'posthog-react-native';

let posthogInstance: PostHog | null = null;
let initialized = false;
let isAvailable = false;

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || 'phc_XLNZ0QN65VPSN1vDlJOXP1j0CS4PVIGmKJXKypHbFWJ';
// Note: If you used --region eu in the wizard, use: 'https://eu.posthog.com'
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com';

export const analytics = {
  setInstance: (instance: PostHog | null) => {
    posthogInstance = instance;
    isAvailable = !!instance;
    if (instance) {
      initialized = true;
      console.log('✅ PostHog instance set');
    }
  },

  init: async (): Promise<void> => {
    if (initialized) return;
    
    try {
      // For v4, PostHog is initialized via PostHogProvider
      // This function is kept for backwards compatibility but does nothing
      // The actual initialization happens in _layout.tsx with PostHogProvider
      console.log('ℹ️ PostHog v4 uses PostHogProvider - initialization handled by provider');
      initialized = true;
    } catch (error) {
      console.error('❌ PostHog initialization failed:', error);
      isAvailable = false;
      initialized = true;
    }
  },

  identify: (userId: string, props?: Record<string, any>) => {
    if (!isAvailable || !userId || !posthogInstance) return;
    try {
      posthogInstance.identify(userId, props);
      __DEV__ && console.log(`📊 PostHog: Identify user "${userId}"`, props || '');
    } catch (error) {
      console.error('PostHog identify error:', error);
    }
  },

  reset: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.reset();
    } catch (error) {
      console.error('PostHog reset error:', error);
    }
  },

  screen: (name: string, props?: Record<string, any>) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.screen(name, props);
      __DEV__ && console.log(`📊 PostHog: Screen "${name}"`, props || '');
      // Immediately flush in development for faster testing
      if (__DEV__ && posthogInstance.flush) {
        posthogInstance.flush();
      }
    } catch (error) {
      console.error('PostHog screen error:', error);
    }
  },

  capture: (event: string, props?: Record<string, any>) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture(event, props);
      __DEV__ && console.log(`📊 PostHog: Event "${event}"`, props || '');
      // Immediately flush in development for faster testing
      if (__DEV__ && posthogInstance.flush) {
        posthogInstance.flush();
      }
    } catch (error) {
      console.error('PostHog capture error:', error);
    }
  },

  flush: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      if (posthogInstance.flush) {
        posthogInstance.flush();
        __DEV__ && console.log('📤 PostHog: Flushing events');
      }
    } catch (error) {
      console.error('PostHog flush error:', error);
    }
  },

  // Paywall tracking
  paywallSubscribeAttempt: (packageId: string) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('paywall_subscribe_attempt', { package_id: packageId });
      __DEV__ && console.log('📊 PostHog: paywall_subscribe_attempt', { package_id: packageId });
    } catch (error) {
      console.error('PostHog paywallSubscribeAttempt error:', error);
    }
  },

  paywallSubscribeSuccess: (packageId: string) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('paywall_subscribe_success', { package_id: packageId });
      __DEV__ && console.log('📊 PostHog: paywall_subscribe_success', { package_id: packageId });
    } catch (error) {
      console.error('PostHog paywallSubscribeSuccess error:', error);
    }
  },

  paywallSubscribeError: (errorMessage: string) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('paywall_subscribe_error', { error_message: errorMessage });
      __DEV__ && console.log('📊 PostHog: paywall_subscribe_error', { error_message: errorMessage });
    } catch (error) {
      console.error('PostHog paywallSubscribeError error:', error);
    }
  },

  paywallSubscribeCancelled: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('paywall_subscribe_cancelled');
      __DEV__ && console.log('📊 PostHog: paywall_subscribe_cancelled');
    } catch (error) {
      console.error('PostHog paywallSubscribeCancelled error:', error);
    }
  },

  // Domain-specific helpers
  matchStart: (props: { mode: 'remote' | 'manual'; is_offline: boolean; remote_id?: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_start', props);
      __DEV__ && console.log(`📊 PostHog: match_start`, props);
      if (__DEV__ && posthogInstance.flush) {
        posthogInstance.flush();
      }
    } catch (error) {
      console.error('PostHog matchStart error:', error);
    }
  },

  scoreIncrement: (props: { side: 'you' | 'opponent'; new_score: number; period: number; is_offline: boolean }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('score_increment', props);
      __DEV__ && console.log(`📊 PostHog: score_increment`, props);
    } catch (error) {
      console.error('PostHog scoreIncrement error:', error);
    }
  },

  syncResult: (props: { success: boolean; queued_ops: number; duration_ms?: number; error_code?: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('sync_result', props);
      __DEV__ && console.log(`📊 PostHog: sync_result`, props);
    } catch (error) {
      console.error('PostHog syncResult error:', error);
    }
  },

  profileUpdate: (props: { field: 'name' | 'handedness' | 'preferred_weapon' }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('profile_update', props);
      __DEV__ && console.log(`📊 PostHog: profile_update`, props);
    } catch (error) {
      console.error('PostHog profileUpdate error:', error);
    }
  },

  setOptOut: (optOut: boolean) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      // For PostHog React Native v4, optOut might be a method or property
      if (typeof posthogInstance.optOut === 'function') {
        (posthogInstance as any).optOut(optOut);
      } else {
        (posthogInstance as any).optOut = optOut;
      }
    } catch (error) {
      console.error('PostHog setOptOut error:', error);
    }
  },

  // Authentication tracking
  loginAttempt: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('login_attempt');
      __DEV__ && console.log('📊 PostHog: login_attempt');
    } catch (error) {
      console.error('PostHog loginAttempt error:', error);
    }
  },

  loginSuccess: (props?: { method?: string; time_to_login_ms?: number }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('login_success', props);
      __DEV__ && console.log('📊 PostHog: login_success', props);
    } catch (error) {
      console.error('PostHog loginSuccess error:', error);
    }
  },

  loginFailure: (props: { error_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('login_failure', props);
      __DEV__ && console.log('📊 PostHog: login_failure', props);
    } catch (error) {
      console.error('PostHog loginFailure error:', error);
    }
  },

  signupStart: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('signup_start');
      __DEV__ && console.log('📊 PostHog: signup_start');
    } catch (error) {
      console.error('PostHog signupStart error:', error);
    }
  },

  signupSuccess: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('signup_success');
      __DEV__ && console.log('📊 PostHog: signup_success');
    } catch (error) {
      console.error('PostHog signupSuccess error:', error);
    }
  },

  signupFailure: (props: { error_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('signup_failure', props);
      __DEV__ && console.log('📊 PostHog: signup_failure', props);
    } catch (error) {
      console.error('PostHog signupFailure error:', error);
    }
  },

  signupAbandon: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('signup_abandon');
      __DEV__ && console.log('📊 PostHog: signup_abandon');
    } catch (error) {
      console.error('PostHog signupAbandon error:', error);
    }
  },

  // Match tracking
  matchCompleted: (props: { mode: 'remote' | 'manual'; duration_seconds?: number; your_score: number; opponent_score: number; is_offline: boolean }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_completed', props);
      __DEV__ && console.log('📊 PostHog: match_completed', props);
    } catch (error) {
      console.error('PostHog matchCompleted error:', error);
    }
  },

  matchCompleteFailure: (props: { error_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_complete_failure', props);
      __DEV__ && console.log('📊 PostHog: match_complete_failure', props);
    } catch (error) {
      console.error('PostHog matchCompleteFailure error:', error);
    }
  },

  matchAbandoned: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_abandoned');
      __DEV__ && console.log('📊 PostHog: match_abandoned');
    } catch (error) {
      console.error('PostHog matchAbandoned error:', error);
    }
  },

  matchSetupStart: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_setup_start');
      __DEV__ && console.log('📊 PostHog: match_setup_start');
    } catch (error) {
      console.error('PostHog matchSetupStart error:', error);
    }
  },

  matchSetupAbandon: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_setup_abandon');
      __DEV__ && console.log('📊 PostHog: match_setup_abandon');
    } catch (error) {
      console.error('PostHog matchSetupAbandon error:', error);
    }
  },

  periodTransition: (props: { period: number }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('period_transition', props);
      __DEV__ && console.log('📊 PostHog: period_transition', props);
    } catch (error) {
      console.error('PostHog periodTransition error:', error);
    }
  },

  matchSummaryViewed: (props: { match_id: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_summary_viewed', props);
      __DEV__ && console.log('📊 PostHog: match_summary_viewed', props);
    } catch (error) {
      console.error('PostHog matchSummaryViewed error:', error);
    }
  },

  // Goal tracking
  goalCreationFlowStarted: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('goal_creation_flow_started');
      __DEV__ && console.log('📊 PostHog: goal_creation_flow_started');
    } catch (error) {
      console.error('PostHog goalCreationFlowStarted error:', error);
    }
  },

  goalSaved: (props: { goal_type: string; target?: number }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('goal_save', props);
      __DEV__ && console.log('📊 PostHog: goal_save', props);
    } catch (error) {
      console.error('PostHog goalSaved error:', error);
    }
  },

  goalCompleted: (props: { goal_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('goal_completed', props);
      __DEV__ && console.log('📊 PostHog: goal_completed', props);
    } catch (error) {
      console.error('PostHog goalCompleted error:', error);
    }
  },

  goalDeleted: (props: { goal_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('goal_deleted', props);
      __DEV__ && console.log('📊 PostHog: goal_deleted', props);
    } catch (error) {
      console.error('PostHog goalDeleted error:', error);
    }
  },

  goalModalOpen: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('goal_modal_open');
      __DEV__ && console.log('📊 PostHog: goal_modal_open');
    } catch (error) {
      console.error('PostHog goalModalOpen error:', error);
    }
  },

  goalModalClose: (props: { saved: boolean }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('goal_modal_close', props);
      __DEV__ && console.log('📊 PostHog: goal_modal_close', props);
    } catch (error) {
      console.error('PostHog goalModalClose error:', error);
    }
  },

  // Progress/Weekly Targets
  progressTargetSet: (props: { activity_type: string; target_sessions: number }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('progress_target_set', props);
      __DEV__ && console.log('📊 PostHog: progress_target_set', props);
    } catch (error) {
      console.error('PostHog progressTargetSet error:', error);
    }
  },

  sessionLogged: (props: { activity_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('session_logged', props);
      __DEV__ && console.log('📊 PostHog: session_logged', props);
    } catch (error) {
      console.error('PostHog sessionLogged error:', error);
    }
  },

  progressTargetReached: (props: { activity_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('progress_target_reached', props);
      __DEV__ && console.log('📊 PostHog: progress_target_reached', props);
    } catch (error) {
      console.error('PostHog progressTargetReached error:', error);
    }
  },

  // Match History
  matchSelected: (props: { match_id: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_selected', props);
      __DEV__ && console.log('📊 PostHog: match_selected', props);
    } catch (error) {
      console.error('PostHog matchSelected error:', error);
    }
  },

  matchDeleted: (props: { match_id: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_deleted', props);
      __DEV__ && console.log('📊 PostHog: match_deleted', props);
    } catch (error) {
      console.error('PostHog matchDeleted error:', error);
    }
  },

  matchDetailsViewed: (props: { match_id: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_details_viewed', props);
      __DEV__ && console.log('📊 PostHog: match_details_viewed', props);
    } catch (error) {
      console.error('PostHog matchDetailsViewed error:', error);
    }
  },

  // Manual Match Logging
  matchFormStarted: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_form_started');
      __DEV__ && console.log('📊 PostHog: match_form_started');
    } catch (error) {
      console.error('PostHog matchFormStarted error:', error);
    }
  },

  matchSave: (props: { match_type: string; weapon_type?: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_save', props);
      __DEV__ && console.log('📊 PostHog: match_save', props);
    } catch (error) {
      console.error('PostHog matchSave error:', error);
    }
  },

  matchSaveFailure: (props: { error_type: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('match_save_failure', props);
      __DEV__ && console.log('📊 PostHog: match_save_failure', props);
    } catch (error) {
      console.error('PostHog matchSaveFailure error:', error);
    }
  },

  formAbandon: (props: { form_type: 'match' | 'goal' | 'signup' }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('form_abandon', props);
      __DEV__ && console.log('📊 PostHog: form_abandon', props);
    } catch (error) {
      console.error('PostHog formAbandon error:', error);
    }
  },

  // Offline/Sync
  offlineModeDetected: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('offline_mode_detected');
      __DEV__ && console.log('📊 PostHog: offline_mode_detected');
    } catch (error) {
      console.error('PostHog offlineModeDetected error:', error);
    }
  },

  offlineMatchSaved: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('offline_match_saved');
      __DEV__ && console.log('📊 PostHog: offline_match_saved');
    } catch (error) {
      console.error('PostHog offlineMatchSaved error:', error);
    }
  },

  syncAttempted: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('sync_attempted');
      __DEV__ && console.log('📊 PostHog: sync_attempted');
    } catch (error) {
      console.error('PostHog syncAttempted error:', error);
    }
  },

  syncFailure: (props: { error_code?: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('sync_failure', props);
      __DEV__ && console.log('📊 PostHog: sync_failure', props);
    } catch (error) {
      console.error('PostHog syncFailure error:', error);
    }
  },

  // Dashboard/Home
  dashboardImpression: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('dashboard_impression');
      __DEV__ && console.log('📊 PostHog: dashboard_impression');
    } catch (error) {
      console.error('PostHog dashboardImpression error:', error);
    }
  },

  quickActionClick: (props: { action: 'train_now' | 'log_match' | 'mindset' }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('quick_action_click', props);
      __DEV__ && console.log('📊 PostHog: quick_action_click', props);
    } catch (error) {
      console.error('PostHog quickActionClick error:', error);
    }
  },

  recentMatchTap: (props: { match_id: string }) => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('recent_match_tap', props);
      __DEV__ && console.log('📊 PostHog: recent_match_tap', props);
    } catch (error) {
      console.error('PostHog recentMatchTap error:', error);
    }
  },

  // Settings
  accountDeleted: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('account_deleted');
      __DEV__ && console.log('📊 PostHog: account_deleted');
    } catch (error) {
      console.error('PostHog accountDeleted error:', error);
    }
  },

  logout: () => {
    if (!isAvailable || !posthogInstance) return;
    try {
      posthogInstance.capture('logout');
      __DEV__ && console.log('📊 PostHog: logout');
    } catch (error) {
      console.error('PostHog logout error:', error);
    }
  },
};

// Export PostHog configuration for use in PostHogProvider
export const POSTHOG_CONFIG = {
  apiKey: POSTHOG_KEY,
  host: POSTHOG_HOST,
  // PostHog React Native v4 options
  enable: true,
  captureApplicationLifecycleEvents: true,
  captureDeepLinks: true,
  optOut: false,
  flushAt: 1, // Flush immediately in development for faster testing
  flushInterval: 2000, // 2 seconds instead of 10
  autocapture: false, // Disable autocapture for more control
  enableSessionReplay: false, // Temporarily disabled - see note below
  // NOTE: Session replay for React Native mobile apps has limited support
  // The posthog-react-native-session-replay package is causing build issues
  // Event tracking (analytics.capture/screen) works perfectly and provides better insights for mobile
  // sessionReplayConfig: { ... }, // Disabled until build issues resolved
  // Note: Session replay requires posthog-react-native-session-replay package to be installed
  // For native iOS/Android: Session replay uses screenshot mode (not wireframe)
  // Keyboard interactions may not be captured
  // Expo Go is NOT supported - requires development build
  // Note: properties are registered separately via posthog.register() in PostHogConnector
};

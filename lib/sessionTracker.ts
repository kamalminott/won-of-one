import { analytics } from './analytics';

let sessionStartedAt: number | null = null;
let sessionId: string | null = null;
let matchesThisSession = 0;

const createSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const resetSessionState = () => {
  sessionStartedAt = null;
  sessionId = null;
  matchesThisSession = 0;
};

export const sessionTracker = {
  startSession: () => {
    if (sessionStartedAt) return;
    sessionStartedAt = Date.now();
    sessionId = createSessionId();
    matchesThisSession = 0;
    analytics.capture('session_start', { session_id: sessionId });
  },

  endSession: (reason?: string) => {
    if (!sessionStartedAt || !sessionId) return;
    const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
    analytics.capture('session_end', {
      session_id: sessionId,
      duration_seconds: durationSeconds,
      matches_per_session: matchesThisSession,
      reason: reason || undefined,
    });
    analytics.capture('matches_per_session', {
      session_id: sessionId,
      matches: matchesThisSession,
      duration_seconds: durationSeconds,
    });
    resetSessionState();
  },

  incrementMatches: () => {
    if (!sessionStartedAt) {
      sessionStartedAt = Date.now();
      sessionId = createSessionId();
      matchesThisSession = 0;
      analytics.capture('session_start', { session_id: sessionId });
    }
    matchesThisSession += 1;
  },

  getSessionId: () => sessionId,
};

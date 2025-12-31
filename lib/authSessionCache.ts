import type { Session } from '@supabase/supabase-js';

let cachedSession: Session | null = null;
let lastAuthEvent: string | null = null;
let lastUpdatedAt = 0;

export const setCachedAuthSession = (session: Session | null, event?: string | null) => {
  cachedSession = session ?? null;
  lastUpdatedAt = Date.now();
  if (event !== undefined) {
    lastAuthEvent = event;
  }
};

export const getCachedAuthSession = () => cachedSession;

export const getLastAuthEvent = () => lastAuthEvent;

export const getAuthSessionUpdatedAt = () => lastUpdatedAt;

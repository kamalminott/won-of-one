/**
 * Offline Cache
 * Real AsyncStorage implementation for offline data persistence
 * Replaces the stub implementation in offlineRemoteService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys - using prefixes to organize offline data
const STORAGE_KEYS = {
  ACTIVE_SESSION: 'offline:active_remote_session',
  PENDING_EVENTS: 'offline:pending_remote_events',
  PENDING_MATCHES: 'offline:pending_matches',
  MATCH_EVENT_LOG_PREFIX: 'offline:match_events:',
};

export interface RemoteSession {
  remote_id: string;
  referee_id: string;
  fencer_1_id?: string;
  fencer_2_id?: string;
  fencer_1_name: string;
  fencer_2_name: string;
  score_1: number;
  score_2: number;
  status: string;
  current_period: number;
  match_time: number;
  period_1_time: number;
  period_2_time: number;
  period_3_time: number;
  weapon_type?: string;
  cached_at: number;
}

export interface PendingEvent {
  id?: string;
  event_uuid?: string;
  event_sequence?: number;
  remote_id: string;
  event_type: string;
  event_time: string;
  scoring_user_name?: string;
  match_time_elapsed?: number;
  metadata?: any;
}

export interface MatchEventLogEntry {
  event_uuid: string;
  event_sequence?: number;
  match_id: string;
  fencing_remote_id?: string;
  match_period_id?: string | null;
  event_time?: string;
  event_type?: string;
  scoring_user_id?: string | null;
  scoring_user_name?: string | null;
  scoring_entity?: string | null;
  card_given?: string | null;
  points_awarded?: number | null;
  score_diff?: number | null;
  seconds_since_last_event?: number | null;
  reset_segment?: number | null;
  fencer_1_name?: string | null;
  fencer_2_name?: string | null;
  cancelled_event_id?: string | null;
  cancelled_event_uuid?: string | null;
  match_time_elapsed?: number | null;
  match_event_id?: string | null;
}

export interface PendingMatch {
  matchId: string;
  queuedAt: number;
  opponentName: string;
  matchType?: 'training' | 'competition';
  fencer1Name?: string;
  fencer2Name?: string;
  youScore: number;
  opponentScore: number;
  date: string;
  isWin: boolean;
  notes?: string;
  weaponType?: string;
  duration_sec?: number;
  total_touches?: number;
  periods?: any[];
  events?: any[];
  is_offline?: boolean;
}

export const offlineCache = {
  /**
   * Save active remote session to local storage
   */
  cacheActiveRemoteSession: async (session: RemoteSession): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACTIVE_SESSION,
        JSON.stringify(session)
      );
      console.log('✅ Session cached locally:', session.remote_id);
    } catch (error) {
      console.error('❌ Failed to cache session:', error);
      throw error;
    }
  },

  /**
   * Get active remote session from local storage
   * Returns null if no session exists
   */
  getActiveRemoteSession: async (): Promise<RemoteSession | null> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      if (!data) {
        return null;
      }
      
      const session = JSON.parse(data) as RemoteSession;
      console.log('✅ Session retrieved from cache:', session.remote_id);
      return session;
    } catch (error) {
      console.error('❌ Failed to get session from cache:', error);
      return null;
    }
  },

  /**
   * Clear active session from local storage
   */
  clearActiveRemoteSession: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      console.log('✅ Active session cleared from cache');
    } catch (error) {
      console.error('❌ Failed to clear session from cache:', error);
    }
  },

  /**
   * Add pending event to queue for later sync
   */
  addPendingRemoteEvent: async (event: PendingEvent): Promise<string> => {
    try {
      const existing = await offlineCache.getPendingRemoteEvents();
      const eventWithId: PendingEvent = {
        ...event,
        id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      const updated = [...existing, eventWithId];
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_EVENTS,
        JSON.stringify(updated)
      );
      console.log('✅ Event queued for sync:', event.event_type);
      return eventWithId.id || '';
    } catch (error) {
      console.error('❌ Failed to queue event:', error);
      throw error;
    }
  },

  /**
   * Get all pending events from queue
   */
  getPendingRemoteEvents: async (): Promise<PendingEvent[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_EVENTS);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as PendingEvent[];
    } catch (error) {
      console.error('❌ Failed to get pending events:', error);
      return [];
    }
  },

  /**
   * Clear all pending events from queue (after successful sync)
   */
  clearPendingRemoteEvents: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EVENTS);
      console.log('✅ Pending events cleared');
    } catch (error) {
      console.error('❌ Failed to clear pending events:', error);
    }
  },

  /**
   * Remove a single pending event from queue (after successful immediate sync)
   */
  removePendingRemoteEvent: async (eventId: string): Promise<void> => {
    try {
      const existing = await offlineCache.getPendingRemoteEvents();
      const remaining = existing.filter(event => event.id !== eventId);
      if (remaining.length === existing.length) {
        return;
      }
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_EVENTS,
        JSON.stringify(remaining)
      );
      console.log('✅ Pending event removed:', eventId);
    } catch (error) {
      console.error('❌ Failed to remove pending event:', error);
    }
  },

  /**
   * Append a match event to the local event log for a match.
   */
  appendMatchEvent: async (
    matchId: string,
    event: MatchEventLogEntry
  ): Promise<boolean> => {
    try {
      const key = `${STORAGE_KEYS.MATCH_EVENT_LOG_PREFIX}${matchId}`;
      const existing = await offlineCache.getMatchEventLog(matchId);
      if (existing.some(item => item.event_uuid === event.event_uuid)) {
        return false;
      }
      const normalized: MatchEventLogEntry = {
        ...event,
        match_event_id: event.match_event_id || event.event_uuid,
      };
      if (!normalized.cancelled_event_id && normalized.cancelled_event_uuid) {
        normalized.cancelled_event_id = normalized.cancelled_event_uuid;
      }
      const updated = [...existing, normalized];
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return true;
    } catch (error) {
      console.error('❌ Failed to append match event log:', error);
      return false;
    }
  },

  /**
   * Get local match events for a given match id.
   */
  getMatchEventLog: async (matchId: string): Promise<MatchEventLogEntry[]> => {
    try {
      const key = `${STORAGE_KEYS.MATCH_EVENT_LOG_PREFIX}${matchId}`;
      const data = await AsyncStorage.getItem(key);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as MatchEventLogEntry[];
    } catch (error) {
      console.error('❌ Failed to get match event log:', error);
      return [];
    }
  },

  /**
   * Clear local match event log for a match.
   */
  clearMatchEventLog: async (matchId: string): Promise<void> => {
    try {
      const key = `${STORAGE_KEYS.MATCH_EVENT_LOG_PREFIX}${matchId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('❌ Failed to clear match event log:', error);
    }
  },

  /**
   * Add pending match to queue for later sync
   * Returns the match ID
   */
  addPendingMatch: async (match: Omit<PendingMatch, 'matchId' | 'queuedAt'>): Promise<string> => {
    try {
      const existing = await offlineCache.getPendingMatches();
      const matchId = `offline_match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const matchWithId: PendingMatch = {
        ...match,
        matchId,
        queuedAt: Date.now(),
      };
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_MATCHES,
        JSON.stringify([...existing, matchWithId])
      );
      console.log('✅ Match queued for sync:', matchId);
      return matchId;
    } catch (error) {
      console.error('❌ Failed to queue match:', error);
      throw error;
    }
  },

  /**
   * Get all pending matches from queue
   */
  getPendingMatches: async (): Promise<PendingMatch[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_MATCHES);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as PendingMatch[];
    } catch (error) {
      console.error('❌ Failed to get pending matches:', error);
      return [];
    }
  },

  /**
   * Remove specific pending match from queue (after successful sync)
   */
  removePendingMatch: async (matchId: string): Promise<void> => {
    try {
      const existing = await offlineCache.getPendingMatches();
      const filtered = existing.filter((m) => m.matchId !== matchId);
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_MATCHES,
        JSON.stringify(filtered)
      );
      console.log('✅ Match removed from queue:', matchId);
    } catch (error) {
      console.error('❌ Failed to remove match from queue:', error);
    }
  },

  /**
   * Update a pending match in the queue (offline edits)
   */
  updatePendingMatch: async (
    matchId: string,
    updates: Partial<Omit<PendingMatch, 'matchId' | 'queuedAt'>>
  ): Promise<boolean> => {
    try {
      const existing = await offlineCache.getPendingMatches();
      const index = existing.findIndex(match => match.matchId === matchId);
      if (index === -1) {
        console.warn('⚠️ Pending match not found for update:', matchId);
        return false;
      }

      const current = existing[index];
      const updated: PendingMatch = {
        ...current,
        ...updates,
        matchId: current.matchId,
        queuedAt: current.queuedAt,
      };

      const next = [...existing];
      next[index] = updated;
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_MATCHES, JSON.stringify(next));
      console.log('✅ Pending match updated:', matchId);
      return true;
    } catch (error) {
      console.error('❌ Failed to update pending match:', error);
      return false;
    }
  },
};

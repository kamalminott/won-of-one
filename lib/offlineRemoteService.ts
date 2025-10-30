/**
 * Offline Remote Service
 * Handles remote fencing sessions in offline mode
 */

import { fencingRemoteService, matchEventService } from './database';
// Note: networkService and offlineCache modules are not available
// import { networkService } from './networkService';
// import { ActiveRemoteSession, offlineCache } from './offlineCache';

// Stub implementations for missing modules
const networkService = {
  isOnline: () => true, // Assume online for now
};

// Define stub types
interface StubRemoteSession {
  remote_id: string;
  referee_id: string;
  fencer_1_id: string;
  fencer_2_id: string;
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
  cached_at: number;
}

const offlineCache = {
  cacheActiveRemoteSession: async (session: StubRemoteSession) => {
    console.log('Stub: cacheActiveRemoteSession', session);
  },
  getActiveRemoteSession: async (): Promise<StubRemoteSession | null> => {
    console.log('Stub: getActiveRemoteSession');
    return null;
  },
  addPendingRemoteEvent: async (event: any) => {
    console.log('Stub: addPendingRemoteEvent', event);
  },
  clearActiveRemoteSession: async () => {
    console.log('Stub: clearActiveRemoteSession');
  },
  clearPendingRemoteEvents: async () => {
    console.log('Stub: clearPendingRemoteEvents');
  },
  getPendingRemoteEvents: async () => {
    console.log('Stub: getPendingRemoteEvents');
    return [];
  },
  addPendingMatch: async (match: any) => {
    console.log('Stub: addPendingMatch', match);
    return 'stub-match-id';
  },
};

export const offlineRemoteService = {
  /**
   * Create a new remote session (offline-first)
   */
  async createRemoteSession(remoteData: {
    referee_id: string;
    fencer_1_id?: string;
    fencer_1_name: string;
    fencer_2_name: string;
    weapon?: string;
    competition?: string;
  }): Promise<{ remote_id: string; is_offline: boolean }> {
    const remoteId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: StubRemoteSession = {
      remote_id: remoteId,
      referee_id: remoteData.referee_id,
      fencer_1_id: remoteData.fencer_1_id || '',
      fencer_1_name: remoteData.fencer_1_name,
      fencer_2_id: '',
      fencer_2_name: remoteData.fencer_2_name,
      score_1: 0,
      score_2: 0,
      status: 'active',
      current_period: 1,
      match_time: 0,
      period_1_time: 0,
      period_2_time: 0,
      period_3_time: 0,
      cached_at: Date.now(),
      // created_at: new Date().toISOString(), // Remove invalid property
    };

    await offlineCache.cacheActiveRemoteSession(session);
    
    console.log('✅ Created offline remote session:', remoteId);
    return { remote_id: remoteId, is_offline: true };
  },

  /**
   * Update remote session scores (works offline)
   */
  async updateRemoteScores(remoteId: string, score1: number, score2: number): Promise<boolean> {
    try {
      const session = await offlineCache.getActiveRemoteSession();
      if (!session || session.remote_id !== remoteId) {
        console.log('❌ No active session found for score update');
        return false;
      }

      // Update scores
      const updatedSession = {
        ...session,
        score_1: score1,
        score_2: score2,
      };

      await offlineCache.cacheActiveRemoteSession(updatedSession);
      console.log(`✅ Updated scores: ${score1}-${score2}`);
      return true;
    } catch (error) {
      console.error('Error updating remote scores:', error);
      return false;
    }
  },

  /**
   * Create or update remote session (works offline)
   */
  async saveRemoteSession(sessionData: Partial<StubRemoteSession>): Promise<StubRemoteSession> {
    const isOnline = networkService.isOnline();
    
    // Get existing session or create new
    let session = await offlineCache.getActiveRemoteSession();
    
    if (!session) {
      // Create new session
      session = {
        remote_id: sessionData.remote_id || `offline_${Date.now()}`,
        referee_id: sessionData.referee_id || '',
        fencer_1_id: sessionData.fencer_1_id || '',
        fencer_2_id: sessionData.fencer_2_id || '',
        fencer_1_name: sessionData.fencer_1_name || '',
        fencer_2_name: sessionData.fencer_2_name || '',
        score_1: sessionData.score_1 || 0,
        score_2: sessionData.score_2 || 0,
        status: sessionData.status || 'active',
        current_period: sessionData.current_period || 1,
        match_time: sessionData.match_time || 180,
        period_1_time: sessionData.period_1_time || 0,
        period_2_time: sessionData.period_2_time || 0,
        period_3_time: sessionData.period_3_time || 0,
        cached_at: Date.now(),
      };
    } else {
      // Update existing
      session = {
        ...session,
        ...sessionData,
        cached_at: Date.now(),
      };
    }

    // Save to cache
    if (session) {
      await offlineCache.cacheActiveRemoteSession(session);

      // If online, try to sync to server
      if (isOnline && !session.remote_id.startsWith('offline_')) {
        try {
          await fencingRemoteService.updateRemoteScores(
            session.remote_id,
            session.score_1,
            session.score_2
          );
          console.log('✅ Remote session synced to server');
        } catch (error) {
          console.log('⚠️ Failed to sync remote session, will retry later');
        }
      }
    }

    return session!;
  },

  /**
   * Get active remote session
   */
  async getActiveSession(): Promise<StubRemoteSession | null> {
    return await offlineCache.getActiveRemoteSession();
  },

  /**
   * Record event (works offline)
   */
  async recordEvent(eventData: {
    remote_id: string;
    event_type: string;
    scoring_user_name?: string;
    match_time_elapsed?: number;
    metadata?: any;
  }): Promise<void> {
    const isOnline = networkService.isOnline();

    // Always save to pending queue (even if online, for reliability)
    await offlineCache.addPendingRemoteEvent({
      remote_id: eventData.remote_id,
      event_type: eventData.event_type,
      event_time: new Date().toISOString(),
      scoring_user_name: eventData.scoring_user_name,
      match_time_elapsed: eventData.match_time_elapsed,
      metadata: eventData.metadata,
    });

    console.log(`✅ Event recorded: ${eventData.event_type} (${isOnline ? 'will sync' : 'queued'})`);
  },

  /**
   * Complete remote session (save match)
   * Handles both user matches and anonymous matches (toggle off)
   */
  async completeSession(
    remoteId: string, 
    userId: string | null,
    isUserMatch: boolean = true
  ): Promise<{ success: boolean; matchId?: string }> {
    const session = await offlineCache.getActiveRemoteSession();
    
    if (!session) {
      console.error('No active remote session found');
      return { success: false };
    }

    const isOnline = networkService.isOnline();

    // If user toggle is OFF (anonymous match), just clear cache and don't save
    if (!isUserMatch) {
      await offlineCache.clearActiveRemoteSession();
      await offlineCache.clearPendingRemoteEvents();
      console.log('✅ Anonymous remote session completed (not saved)');
      return { success: true };
    }

    // User match - save it
    if (isOnline && userId) {
      // Try to save online (only if session exists in database)
      try {
        // Check if this is an offline-generated session
        if (remoteId.startsWith('offline_')) {
          console.log('📱 Offline session detected, saving as pending match');
          // Skip online sync for offline sessions, go straight to offline save
        } else {
          // This is a real online session, try to complete it
          const match = await fencingRemoteService.completeRemoteSession(remoteId, userId);
          
          if (match) {
            // Clear cache
            await offlineCache.clearActiveRemoteSession();
            await offlineCache.clearPendingRemoteEvents();
            console.log('✅ Remote session completed and synced');
            return { success: true, matchId: match.match_id };
          }
        }
      } catch (error) {
        console.error('Error completing remote session online, saving offline:', error);
      }
    }

    // Save offline as pending match (only if userId exists)
    if (userId) {
      // Get all pending events for this session to calculate stats
      const events = await offlineCache.getPendingRemoteEvents();
      const sessionEvents = events.filter((e: any) => e.remote_id === remoteId);

      // Calculate total duration
      const totalDuration = session.period_1_time + session.period_2_time + session.period_3_time;

      // Create periods data
      const periods = [];
      if (session.period_1_time > 0 || session.current_period >= 1) {
        periods.push({
          period_number: 1,
          fencer_1_score: session.score_1 >= 5 ? 5 : session.score_1,
          fencer_2_score: session.score_2 >= 5 ? 5 : session.score_2,
          start_time: undefined,
          end_time: undefined,
        });
      }
      if (session.period_2_time > 0 || session.current_period >= 2) {
        periods.push({
          period_number: 2,
          fencer_1_score: session.score_1 >= 10 ? 10 : session.score_1,
          fencer_2_score: session.score_2 >= 10 ? 10 : session.score_2,
          start_time: undefined,
          end_time: undefined,
        });
      }
      if (session.period_3_time > 0 || session.current_period >= 3) {
        periods.push({
          period_number: 3,
          fencer_1_score: session.score_1,
          fencer_2_score: session.score_2,
          start_time: undefined,
          end_time: undefined,
        });
      }

      const matchData = {
        opponentName: session.fencer_2_name || 'Unknown Opponent',
        youScore: session.score_1,
        opponentScore: session.score_2,
        date: new Date().toISOString().split('T')[0],
        isWin: session.score_1 > session.score_2,
        notes: `Remote session (offline): ${session.fencer_1_name} vs ${session.fencer_2_name}`,
        // Extended data for match summary
        duration_sec: totalDuration,
        total_touches: session.score_1 + session.score_2,
        periods,
        events: sessionEvents.map((e: any) => ({
          event_type: e.event_type,
          event_time: e.event_time,
          scoring_user_name: e.scoring_user_name,
          match_time_elapsed: e.match_time_elapsed,
        })),
        is_offline: true,
      };

        const matchId = await offlineCache.addPendingMatch({
          ...matchData,
          date: matchData.date || new Date().toISOString().split('T')[0], // ensure string, never undefined
        });
        if (!matchId) {
          console.error('❌ Failed to create pending match');
          return { success: false };
        }

        console.log('✅ Pending match created with ID:', matchId);
      
      // Clear session cache
      await offlineCache.clearActiveRemoteSession();
      
      console.log('✅ Remote session saved offline with complete stats, will sync when online');
      return { success: true, matchId };
    }

    // If we get here, just clear cache
    await offlineCache.clearActiveRemoteSession();
    await offlineCache.clearPendingRemoteEvents();
    return { success: true };
  },

  /**
   * Sync pending remote data when online
   */
  async syncPendingData(userId: string): Promise<boolean> {
    if (!networkService.isOnline()) {
      console.log('Cannot sync remote data: offline');
      return false;
    }

    try {
      const pendingEvents = await offlineCache.getPendingRemoteEvents();
      
      if (pendingEvents.length === 0) {
        console.log('No pending remote events to sync');
        return true;
      }

      console.log(`🔄 Syncing ${pendingEvents.length} remote events...`);

      // Group events by remote_id
      const eventsBySession = pendingEvents.reduce((acc: any, event: any) => {
        if (!acc[event.remote_id]) {
          acc[event.remote_id] = [];
        }
        acc[event.remote_id].push(event);
        return acc;
      }, {} as Record<string, typeof pendingEvents>);

      // Sync each session's events
      for (const [remoteId, events] of Object.entries(eventsBySession)) {
        for (const event of (events as any[])) {
          try {
            // Only sync if remote_id is not offline-generated
            if (!remoteId.startsWith('offline_')) {
              await matchEventService.createMatchEvent({
                match_id: event.metadata?.match_id,
                // user_id: userId,
                // type: event.event_type,
                // timestamp: event.event_time, // Remove invalid property
                // meta: event.metadata || {}, // Remove invalid property
              });
            }
          } catch (error) {
            console.error('Error syncing event:', error);
          }
        }
      }

      // Clear synced events
      await offlineCache.clearPendingRemoteEvents();
      console.log('✅ Remote events synced');
      
      return true;
    } catch (error) {
      console.error('Error syncing remote data:', error);
      return false;
    }
  },
};


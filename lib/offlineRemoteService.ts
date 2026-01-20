/**
 * Offline Remote Service
 * Handles remote fencing sessions in offline mode
 * NOW WITH REAL IMPLEMENTATION (not stubs!)
 */

import { analytics } from './analytics';
import { fencingRemoteService, matchEventService, matchPeriodService, matchService } from './database';
import { networkService } from './networkService';
import { offlineCache, PendingEvent, RemoteSession } from './offlineCache';
import { postgrestSelect, postgrestSelectOne } from './postgrest';

export const offlineRemoteService = {
  /**
   * Create a new remote session (offline-first)
   * Tries online first, falls back to offline if network fails
   */
  async createRemoteSession(remoteData: {
    referee_id: string;
    fencer_1_id?: string;
    fencer_1_name: string;
    fencer_2_name: string;
    weapon?: string;
    competition?: string;
    scoring_mode?: string;
    device_serial?: string;
  }): Promise<{ remote_id: string; is_offline: boolean }> {
    const isOnline = await networkService.isOnline();
    
    // Try online first if available
    if (isOnline) {
      try {
        // Create database-compatible data (exclude weapon_type for now since column doesn't exist in DB)
        // We'll store weapon_type in the local cache only
        const dbRemoteData: any = { ...remoteData };
        // Remove weapon field - database doesn't have weapon_type column yet
        delete dbRemoteData.weapon;
        const session = await fencingRemoteService.createRemoteSession(dbRemoteData);
        if (session) {
          // Also cache locally for offline access
          const cachedSession: RemoteSession = {
            remote_id: session.remote_id,
            referee_id: session.referee_id || remoteData.referee_id,
            fencer_1_id: session.fencer_1_id || remoteData.fencer_1_id,
            fencer_2_id: session.fencer_2_id,
            fencer_1_name: session.fencer_1_name || remoteData.fencer_1_name,
            fencer_2_name: session.fencer_2_name || remoteData.fencer_2_name,
            score_1: session.score_1 || 0,
            score_2: session.score_2 || 0,
            status: (session as any).status || 'active',
            current_period: 1,
            match_time: 180,
            period_1_time: 0,
            period_2_time: 0,
            period_3_time: 0,
            weapon_type: (session as any).weapon_type || remoteData.weapon || 'foil',
            cached_at: Date.now(),
          };
          await offlineCache.cacheActiveRemoteSession(cachedSession);
          console.log('✅ Created online remote session and cached:', session.remote_id);
          return { remote_id: session.remote_id, is_offline: false };
        }
        // If session is null, log and fall through to offline
        console.log('⚠️ Online remote session creation returned null, falling back to offline.');
      } catch (error) {
        console.log('⚠️ Online creation failed, falling back to offline:', error);
        // Fall through to offline creation
      }
    }
    
    // Create offline session (network unavailable or online creation failed)
    const remoteId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: RemoteSession = {
      remote_id: remoteId,
      referee_id: remoteData.referee_id,
      fencer_1_id: remoteData.fencer_1_id || '',
      fencer_2_id: '',
      fencer_1_name: remoteData.fencer_1_name,
      fencer_2_name: remoteData.fencer_2_name,
      score_1: 0,
      score_2: 0,
      status: 'active',
      current_period: 1,
      match_time: 180,
      period_1_time: 0,
      period_2_time: 0,
      period_3_time: 0,
      weapon_type: remoteData.weapon || 'foil',
      cached_at: Date.now(),
    };
    
    // Save to local cache
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

      // Update scores in local cache
      const updatedSession: RemoteSession = {
        ...session,
        score_1: score1,
        score_2: score2,
        cached_at: Date.now(),
      };
      await offlineCache.cacheActiveRemoteSession(updatedSession);

      // Try to sync to server if online and session exists online
      const isOnline = await networkService.isOnline();
      if (isOnline && !remoteId.startsWith('offline_')) {
        try {
          await fencingRemoteService.updateRemoteScores(remoteId, score1, score2);
          console.log('✅ Scores synced to server:', `${score1}-${score2}`);
        } catch (error) {
          console.log('⚠️ Failed to sync scores, saved locally:', error);
        }
      }
      
      console.log(`✅ Updated scores locally: ${score1}-${score2}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating remote scores:', error);
      return false;
    }
  },

  /**
   * Create or update remote session (works offline)
   */
  async saveRemoteSession(sessionData: Partial<RemoteSession>): Promise<RemoteSession> {
    const isOnline = await networkService.isOnline();
    
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
    await offlineCache.cacheActiveRemoteSession(session);

    // If online, try to sync to server (only if not offline-generated session)
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

    return session;
  },

  /**
   * Get active remote session (from cache)
   */
  async getActiveSession(): Promise<RemoteSession | null> {
    return await offlineCache.getActiveRemoteSession();
  },

  /**
   * Record event (works offline)
   * Always saves to queue for reliability, even when online
   */
  async recordEvent(eventData: {
    remote_id: string;
    event_uuid?: string;
    event_sequence?: number;
    event_type: string;
    scoring_user_name?: string;
    match_time_elapsed?: number;
    event_time?: string;
    metadata?: any;
  }): Promise<string> {
    const isOnline = await networkService.isOnline();
    const eventTime = eventData.event_time || new Date().toISOString();

    // Always save to pending queue (even if online, for reliability)
    const queuedEventId = await offlineCache.addPendingRemoteEvent({
      remote_id: eventData.remote_id,
      event_uuid: eventData.event_uuid,
      event_sequence: eventData.event_sequence,
      event_type: eventData.event_type,
      event_time: eventTime,
      scoring_user_name: eventData.scoring_user_name,
      match_time_elapsed: eventData.match_time_elapsed,
      metadata: eventData.metadata,
    });

    console.log(`✅ Event recorded: ${eventData.event_type} (${isOnline ? 'online, will sync' : 'offline, queued'})`);
    
    // If online, try immediate sync (but don't remove from queue until successful)
    if (isOnline && !eventData.remote_id.startsWith('offline_')) {
      try {
        // This would attempt immediate sync - but keeping it simple for now
        // Full sync happens via syncPendingData
      } catch (error) {
        console.log('⚠️ Immediate sync failed, will retry later');
      }
    }

    return queuedEventId;
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
      console.error('❌ No active remote session found');
      return { success: false };
    }

    const isOnline = await networkService.isOnline();

    // If user toggle is OFF (anonymous match), just clear cache and don't save
    if (!isUserMatch) {
      await offlineCache.clearActiveRemoteSession();
      await offlineCache.clearPendingRemoteEvents();
      console.log('✅ Anonymous remote session completed (not saved)');
      return { success: true };
    }

    // User match - save it
    if (isOnline && userId && !remoteId.startsWith('offline_')) {
      // Try to save online (only if session exists in database)
      try {
        const match = await fencingRemoteService.completeRemoteSession(remoteId, userId);
        
        if (match) {
          // Clear cache
          await offlineCache.clearActiveRemoteSession();
          // Clear events for this session
          const events = await offlineCache.getPendingRemoteEvents();
          const filteredEvents = events.filter(e => e.remote_id !== remoteId);
          await offlineCache.clearPendingRemoteEvents();
          // Re-add events not for this session
          for (const event of filteredEvents) {
            await offlineCache.addPendingRemoteEvent(event);
          }
          console.log('✅ Remote session completed and synced online');
          return { success: true, matchId: match.match_id };
        }
      } catch (error) {
        console.error('❌ Error completing remote session online, saving offline:', error);
      }
    }

    // Save offline as pending match (only if userId exists)
    if (userId) {
      // Get all pending events for this session to calculate stats
      const events = await offlineCache.getPendingRemoteEvents();
      const sessionEvents = events.filter((e) => e.remote_id === remoteId);

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
        matchType: 'training',
        fencer1Name: session.fencer_1_name,
        fencer2Name: session.fencer_2_name,
        youScore: session.score_1,
        opponentScore: session.score_2,
        date: new Date().toISOString().split('T')[0],
        isWin: session.score_1 > session.score_2,
        notes: `Remote session (offline): ${session.fencer_1_name} vs ${session.fencer_2_name}`,
        weaponType: session.weapon_type,
        duration_sec: totalDuration,
        total_touches: session.score_1 + session.score_2,
        periods,
        events: sessionEvents.map((e) => ({
          event_uuid: e.event_uuid,
          event_sequence: e.event_sequence,
          event_type: e.event_type,
          event_time: e.event_time,
          scoring_user_name: e.scoring_user_name,
          match_time_elapsed: e.match_time_elapsed,
          cancelled_event_id: e.metadata?.cancelled_event_id,
          cancelled_event_uuid: e.metadata?.cancelled_event_uuid,
        })),
        is_offline: true,
      };

      const matchId = await offlineCache.addPendingMatch({
        ...matchData,
        date: matchData.date || new Date().toISOString().split('T')[0],
      });
      
      if (!matchId) {
        console.error('❌ Failed to create pending match');
        return { success: false };
      }

      console.log('✅ Pending match created with ID:', matchId);
      
      // Clear session cache
      await offlineCache.clearActiveRemoteSession();
      
      console.log('✅ Remote session saved offline, will sync when online');
      return { success: true, matchId };
    }

    // If we get here, just clear cache
    await offlineCache.clearActiveRemoteSession();
    await offlineCache.clearPendingRemoteEvents();
    return { success: true };
  },

  /**
   * Sync pending remote data when online
   * Syncs both pending matches and pending events
   */
  async syncPendingData(userId: string): Promise<boolean> {
    const isOnline = await networkService.isOnline();
    if (!isOnline) {
      console.log('⚠️ Cannot sync: device is offline');
      return false;
    }

    const startTime = Date.now();
    let queuedOps = 0;

    try {
      console.log('🔄 Starting sync of pending data...');
      
      // Track sync attempt
      analytics.syncAttempted();

      // Sync pending matches first
      const pendingMatches = await offlineCache.getPendingMatches();
      console.log(`📦 Found ${pendingMatches.length} pending matches to sync`);
      queuedOps += pendingMatches.length;

      for (const match of pendingMatches) {
        try {
          const normalizedWeapon = match.weaponType?.toLowerCase() === 'saber'
            ? 'sabre'
            : match.weaponType?.toLowerCase();
          const matchType = match.matchType === 'competition' ? 'competition' : 'training';
          const fencer1Name = match.fencer1Name?.trim() || undefined;
          const fencer2Name = match.fencer2Name?.trim() || undefined;
          const opponentName = match.opponentName?.trim()
            || fencer2Name
            || 'Unknown Opponent';
          const matchResult = await matchService.createManualMatch({
            userId,
            opponentName,
            yourScore: match.youScore,
            opponentScore: match.opponentScore,
            matchType,
            date: match.date,
            time: new Date(match.queuedAt).toTimeString().split(' ')[0],
            notes: match.notes,
            weaponType: normalizedWeapon,
            fencer1Name,
            fencer2Name,
          });

          if (matchResult) {
            // Remove from queue after successful sync
            await offlineCache.removePendingMatch(match.matchId);
            console.log(`✅ Synced match: ${match.matchId} → ${matchResult.match_id}`);
          } else {
            console.log(`⚠️ Failed to sync match: ${match.matchId} (will retry later)`);
          }
        } catch (error) {
          console.error(`❌ Error syncing match ${match.matchId}:`, error);
          // Keep in queue for retry
        }
      }

      // Sync pending events
      const pendingEvents = await offlineCache.getPendingRemoteEvents();
      console.log(`📦 Found ${pendingEvents.length} pending events to sync`);
      queuedOps += pendingEvents.length;

      // Group events by remote_id
      const eventsBySession = pendingEvents.reduce((acc: Record<string, PendingEvent[]>, event) => {
        if (!acc[event.remote_id]) {
          acc[event.remote_id] = [];
        }
        acc[event.remote_id].push(event);
        return acc;
      }, {});

      const syncedEventIds: string[] = [];

      // Sync each session's events (non-offline remotes only)
      for (const [remoteId, events] of Object.entries(eventsBySession)) {
        if (remoteId.startsWith('offline_')) {
          console.log(`⚠️ Skipping events for offline session: ${remoteId} (no remote_id in database)`);
          continue;
        }

        for (const event of events) {
          const matchId = event.metadata?.match_id;
          const resetSegment = typeof event.metadata?.reset_segment === 'number'
            ? event.metadata.reset_segment
            : 0;
          const scoringEntity = event.metadata?.scoring_entity || null;
          const scoringEntityFilter = scoringEntity ? { scoring_entity: `eq.${scoringEntity}` } : {};
          const hasEventUuid = !!event.event_uuid;
          const cancelledEventUuid = event.metadata?.cancelled_event_uuid || null;
          let cancelledEventId = event.metadata?.cancelled_event_id || null;

          // Ensure match exists before attempting insert; if not, retry later
          if (matchId) {
            const { data: matchExists, error: matchExistsError } = await postgrestSelectOne<{ match_id: string }>(
              'match',
              {
                select: 'match_id',
                match_id: `eq.${matchId}`,
                limit: 1,
              }
            );

            if (matchExistsError) {
              console.error(`❌ Error checking match existence for ${matchId}:`, matchExistsError);
              continue; // retry later
            }

            if (!matchExists) {
              console.log(`⚠️ Match ${matchId} not found yet, keeping event queued: ${event.event_type}`);
              continue;
            }
          }

          if (!cancelledEventId && cancelledEventUuid && matchId) {
            const { data: cancelledMatchEvent, error: cancelledError } = await postgrestSelectOne<{ match_event_id: string }>(
              'match_event',
              {
                select: 'match_event_id',
                event_uuid: `eq.${cancelledEventUuid}`,
                match_id: `eq.${matchId}`,
                limit: 1,
              }
            );
            if (cancelledError) {
              console.error('❌ Error resolving cancelled_event_uuid:', cancelledError);
            } else if (cancelledMatchEvent?.match_event_id) {
              cancelledEventId = cancelledMatchEvent.match_event_id;
            }
          }

          // Check for duplicate event before creating (legacy events without UUID)
          if (!hasEventUuid && matchId && event.match_time_elapsed !== null && event.match_time_elapsed !== undefined && event.scoring_user_name) {
            // #region agent log
            console.log('[DEBUG] Duplicate check query params:', {
              matchId,
              match_time_elapsed: event.match_time_elapsed,
              scoring_user_name: event.scoring_user_name,
              scoring_entity: scoringEntity,
              event_type: event.event_type,
              event_time: event.event_time
            });
            // #endregion
            
            // Use limit to detect multiple matches instead of maybeSingle()
            const { data: existingEvents, error: checkError } = await postgrestSelect<{
              match_event_id: string;
              event_time?: string | null;
              timestamp?: string | null;
            }>(
              'match_event',
              {
                select: 'match_event_id,event_time,timestamp',
                match_id: `eq.${matchId}`,
                match_time_elapsed: `eq.${event.match_time_elapsed}`,
                scoring_user_name: `eq.${event.scoring_user_name}`,
                ...scoringEntityFilter,
                event_type: `eq.${event.event_type}`,
                reset_segment: `eq.${resetSegment}`,
                limit: 5,
              }
            );
            
            // #region agent log
            console.log('[DEBUG] Duplicate check query result:', {
              checkError: checkError ? { code: checkError.code, message: checkError.message, details: checkError.details } : null,
              existingEventsCount: existingEvents?.length || 0,
              existingEvents: existingEvents?.map(e => ({ id: e.match_event_id, event_time: e.event_time, timestamp: e.timestamp })) || []
            });
            // #endregion
            
            if (checkError) {
              console.error(`❌ Error checking for duplicate event:`, checkError);
              // #region agent log
              console.log('[DEBUG] Duplicate check error path:', {
                errorCode: checkError.code,
                errorMessage: checkError.message
              });
              // #endregion
              // keep event; retry later
              continue;
            } else if (existingEvents && existingEvents.length > 0) {
              const parseTimeMs = (value?: string | null) => {
                if (!value) return null;
                const ms = Date.parse(value);
                return Number.isFinite(ms) ? ms : null;
              };

              const incomingEventTime = event.event_time || null;
              const incomingEventTimeMs = parseTimeMs(incomingEventTime);

              const matchesExistingTime = incomingEventTimeMs !== null
                ? existingEvents.some(existing => {
                    const existingTimeMs = parseTimeMs((existing as any)?.event_time)
                      ?? parseTimeMs((existing as any)?.timestamp);
                    return existingTimeMs !== null && existingTimeMs === incomingEventTimeMs;
                  })
                : existingEvents.some(existing => (existing as any)?.event_time === incomingEventTime);

              // #region agent log
              console.log('[DEBUG] Duplicate check comparison:', {
                matchesExistingTime,
                incomingEventTime,
                incomingEventTimeMs,
                matchesCount: existingEvents.length
              });
              // #endregion

              if (!matchesExistingTime) {
                console.log(`ℹ️ Same elapsed/scorer found but different event_time, allowing insert`, {
                  matchId,
                  match_time_elapsed: event.match_time_elapsed,
                  scorer: event.scoring_user_name,
                  incomingEventTime,
                });
              } else {
                console.log(`🔄 Duplicate event detected during sync, skipping: match_id=${matchId}, time=${event.match_time_elapsed}s, scorer=${event.scoring_user_name}, type=${event.event_type}`);
                analytics.capture('sync_conflict', {
                  conflict_type: 'duplicate_event',
                  match_id: matchId,
                  remote_id: remoteId,
                  event_type: event.event_type,
                  match_time_elapsed: event.match_time_elapsed,
                });
                if (event.id) {
                  syncedEventIds.push(event.id);
                }
                continue;
              }
            }
          }

          // Additional duplicate guard using event_time second precision (legacy events without UUID)
          if (!hasEventUuid && matchId && event.scoring_user_name && event.event_time) {
            const compositeTimeKey = event.event_time;
            const { data: existingComposite, error: compositeError } = await postgrestSelectOne<{ match_event_id: string }>(
              'match_event',
              {
                select: 'match_event_id',
                match_id: `eq.${matchId}`,
                event_type: `eq.${event.event_type}`,
                scoring_user_name: `eq.${event.scoring_user_name}`,
                ...scoringEntityFilter,
                event_time: `eq.${compositeTimeKey}`,
                reset_segment: `eq.${resetSegment}`,
                limit: 1,
              }
            );

            if (compositeError) {
              console.error('❌ Error checking composite duplicate:', {
                matchId,
                eventTime: compositeTimeKey,
                error: compositeError,
              });
              continue;
            }

            if (existingComposite) {
              console.log(`🔄 Composite duplicate (event_time) detected, skipping: match_id=${matchId}, event_time=${compositeTimeKey}, scorer=${event.scoring_user_name}, type=${event.event_type}`);
              analytics.capture('sync_conflict', {
                conflict_type: 'composite_duplicate',
                match_id: matchId,
                remote_id: remoteId,
                event_type: event.event_type,
                event_time: compositeTimeKey,
              });
              if (event.id) {
                syncedEventIds.push(event.id);
              }
              continue;
            }
          }

          // Validate match_period_id before using it (prevent foreign key violations)
          let validatedMatchPeriodId: string | null = null;
          if (event.metadata?.match_period_id && matchId) {
            try {
              const periods = await matchPeriodService.getMatchPeriods(matchId);
              const periodExists = periods.some(
                (p: any) => p.match_period_id === event.metadata?.match_period_id
              );
              if (periodExists) {
                validatedMatchPeriodId = event.metadata.match_period_id;
              } else {
                console.warn(`⚠️ Match period ${event.metadata.match_period_id} not found for match ${matchId}, setting to null`);
              }
            } catch (error) {
              console.warn(`⚠️ Error validating match_period_id:`, error);
            }
          }

          try {
            const created = await matchEventService.createMatchEvent({
              event_uuid: event.event_uuid,
              match_id: matchId || null,
              fencing_remote_id: event.remote_id,
              event_type: event.event_type,
              event_time: event.event_time,
              scoring_user_name: event.scoring_user_name,
              match_time_elapsed: event.match_time_elapsed,
              match_period_id: validatedMatchPeriodId || undefined,
              scoring_user_id: event.metadata?.scoring_user_id || null,
              scoring_entity: event.metadata?.scoring_entity || null,
              fencer_1_name: event.metadata?.fencer_1_name || null,
              fencer_2_name: event.metadata?.fencer_2_name || null,
              card_given: event.metadata?.card_given || null,
              cancelled_event_id: cancelledEventId,
              reset_segment: resetSegment,
              score_diff: event.metadata?.score_diff || null,
              seconds_since_last_event: event.metadata?.seconds_since_last_event || null,
            });

            if (created) {
              if (event.id) {
                syncedEventIds.push(event.id);
              }
              console.log(`✅ Synced event: ${event.event_type}`);
            } else {
              console.log('⚠️ Event insert deferred (missing match or FK), will retry later');
            }
          } catch (error) {
            console.error(`❌ Error syncing event:`, error);
            // keep in queue
          }
        }
      }

      // Remove synced events from queue
      if (syncedEventIds.length > 0) {
        const remainingEvents = pendingEvents.filter(e => !syncedEventIds.includes(e.id || ''));
        await offlineCache.clearPendingRemoteEvents();
        // Re-add unsynced events
        for (const event of remainingEvents) {
          await offlineCache.addPendingRemoteEvent(event);
        }
        console.log(`✅ Removed ${syncedEventIds.length} synced events from queue`);
      }

      const remainingMatches = await offlineCache.getPendingMatches();
      const remainingEvents = await offlineCache.getPendingRemoteEvents();
      
      const duration = Date.now() - startTime;
      
      // Track sync success
      analytics.syncResult({ 
        success: true, 
        queued_ops: queuedOps, 
        duration_ms: duration 
      });
      
      console.log(`✅ Sync complete. Remaining: ${remainingMatches.length} matches, ${remainingEvents.length} events`);
      
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Track sync failure
      analytics.syncFailure({ 
        error_code: (error as Error)?.message || 'unknown_error'
      });
      // Also log sync result for tracking queued ops
      analytics.syncResult({
        success: false,
        queued_ops: queuedOps,
        duration_ms: duration,
        error_code: (error as Error)?.message || 'unknown_error'
      });
      
      console.error('❌ Error syncing remote data:', error);
      return false;
    }
  },
};

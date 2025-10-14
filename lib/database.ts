import {
    AppUser, DiaryEntry, Drill, Equipment,
    FencingRemote, Goal, Match,
    MatchApproval, MatchEvent,
    SimpleGoal, SimpleMatch
} from '@/types/database';
import { supabase } from './supabase';

// Match-related functions
export const matchService = {
  // Get recent matches for a user
  async getRecentMatches(userId: string, limit: number = 10): Promise<SimpleMatch[]> {
    const { data, error } = await supabase
      .from('match')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching matches:', error);
      return [];
    }

    return data?.map(match => ({
      id: match.match_id,
      youScore: match.final_score || 0,
      opponentScore: match.touches_against || 0,
      date: match.event_date || new Date().toISOString().split('T')[0],
      opponentName: match.fencer_2_name || 'Unknown',
      isWin: match.is_win || false,
    })) || [];
  },

  // Get all matches for training time calculation
  async getAllMatchesForTrainingTime(userId: string): Promise<{ bout_length_s: number }[]> {
    const { data, error } = await supabase
      .from('match')
      .select('bout_length_s')
      .eq('user_id', userId)
      .not('bout_length_s', 'is', null); // Only get matches with duration data

    if (error) {
      console.error('Error fetching matches for training time:', error);
      return [];
    }

    return data || [];
  },

  // Create a manual match
  async createManualMatch(matchData: {
    userId: string;
    opponentName: string;
    yourScore: number;
    opponentScore: number;
    matchType: 'training' | 'competition';
    date: string;
    time: string;
    notes?: string;
    weaponType?: string;
  }): Promise<Match | null> {
    const { userId, opponentName, yourScore, opponentScore, matchType, date, time, notes, weaponType } = matchData;
    
    // Parse date and time
    const [day, month, year] = date.split('/');
    const [hour, minute] = time.replace(/[AP]M/i, '').split(':');
    const isPM = time.toUpperCase().includes('PM');
    
    let hour24 = parseInt(hour);
    if (isPM && hour24 !== 12) hour24 += 12;
    if (!isPM && hour24 === 12) hour24 = 0;
    
    const eventDateTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minute));
    
    const insertData = {
      user_id: userId,
      fencer_1_name: 'You', // User is always fencer 1 in manual matches
      fencer_2_name: opponentName,
      final_score: yourScore,
      // touches_against: opponentScore, // This is a generated column - will be calculated automatically
      event_date: eventDateTime.toISOString().split('T')[0],
      result: yourScore > opponentScore ? 'win' : 'loss',
      score_diff: yourScore - opponentScore,
      match_type: matchType,
      weapon_type: weaponType || 'foil',
      notes: notes || null,
      source: 'manual',
      is_complete: true,
    };

    console.log('🔄 Creating manual match with data:', insertData);

    const { data, error } = await supabase
      .from('match')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating manual match:', error);
      return null;
    }

    console.log('✅ Manual match created successfully:', data);
    return data;
  },

  // Create a new match from fencing remote data
  async createMatchFromRemote(remoteData: FencingRemote, userId: string | null): Promise<Match | null> {
    const matchData = {
      user_id: userId, // Can be null if user toggle is off
      fencer_1_name: remoteData.fencer_1_name,
      fencer_2_name: remoteData.fencer_2_name,
      final_score: remoteData.score_1 || 0,
      // touches_against is a generated column - removed from insert
      event_date: new Date().toISOString().split('T')[0],
      result: userId ? ((remoteData.score_1 || 0) > (remoteData.score_2 || 0) ? 'win' : 'loss') : null, // Only set result if user is present
      // is_win is a generated column - removed from insert
      score_diff: (remoteData.score_1 || 0) - (remoteData.score_2 || 0),
      match_type: 'practice',
      source: 'remote', // User is using the fencing remote
    };

    // If userId is null, we need to use an RPC function to bypass RLS for anonymous matches
    if (userId === null) {
      // Try RPC function for anonymous matches first
      console.log('🔄 Attempting RPC call for anonymous match with data:', matchData);
      
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('create_anonymous_match', {
          match_data: matchData
        });

      console.log('📡 RPC call result:', { rpcData, rpcError });

      if (!rpcError && rpcData) {
        console.log('✅ RPC function succeeded, returning data:', rpcData);
        return rpcData;
      }

      // If RPC fails, log the specific error and try direct insert
      if (rpcError) {
        console.error('❌ RPC function failed with error:', rpcError);
      }
      console.warn('⚠️ RPC function failed, trying direct insert for anonymous match');
    }

    // Regular match creation (both authenticated and fallback for anonymous)
    const { data, error } = await supabase
      .from('match')
      .insert(matchData)
      .select()
      .single();

    if (error) {
      console.error('Error creating match:', error);
      
      // If this is an anonymous match and we get RLS error, provide helpful message
      if (userId === null && error.code === '42501') {
        console.error('❌ Anonymous matches not allowed. Please create the RPC function or modify RLS policy.');
        console.error('📝 Run this SQL in your Supabase SQL editor:');
        console.error(`
CREATE OR REPLACE FUNCTION create_anonymous_match(match_data jsonb)
RETURNS TABLE(match_id text, user_id text, fencer_1_name text, fencer_2_name text, final_score integer, event_date date, result text, score_diff integer, match_type text, source text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO match (user_id, fencer_1_name, fencer_2_name, final_score, event_date, result, score_diff, match_type, source)
  VALUES (
    (match_data->>'user_id')::text,
    (match_data->>'fencer_1_name')::text,
    (match_data->>'fencer_2_name')::text,
    (match_data->>'final_score')::integer,
    (match_data->>'event_date')::date,
    (match_data->>'result')::text,
    (match_data->>'score_diff')::integer,
    (match_data->>'match_type')::text,
    (match_data->>'source')::text
  )
  RETURNING match.match_id, match.user_id, match.fencer_1_name, match.fencer_2_name, match.final_score, match.event_date, match.result, match.score_diff, match.match_type, match.source;
END;
$$;
        `);
      }
      
      return null;
    }

    return data;
  },

  // Get match by ID
  async getMatchById(matchId: string): Promise<Match | null> {
    const { data, error } = await supabase
      .from('match')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (error) {
      console.error('Error fetching match:', error);
      return null;
    }

    return data;
  },

  // Calculate best run for a match using Event + Period Hybrid approach
  async calculateBestRun(matchId: string, userName: string, remoteId?: string): Promise<number> {
    try {
      console.log('🏃 Calculating best run for match:', matchId, 'user:', userName);
      
      // Debug: Check what events exist in the database
      const { data: allEvents, error: allEventsError } = await supabase
        .from('match_event')
        .select('*')
        .order('timestamp', { ascending: true });
      
      if (allEventsError) {
        console.error('Error fetching all events for debugging:', allEventsError);
      } else {
        console.log('🔍 Debug: Total events in database:', allEvents?.length || 0);
        if (allEvents && allEvents.length > 0) {
          console.log('🔍 Debug: Recent events:', allEvents.slice(-5).map(e => ({
            match_id: e.match_id,
            fencing_remote_id: e.fencing_remote_id,
            scoring_user_name: e.scoring_user_name,
            timestamp: e.timestamp
          })));
        }
      }
      
      // 1. Get all match events ordered by timestamp (try both match_id and fencing_remote_id)
      let matchEvents = null;
      let eventsError = null;
      
      // First try to get events by match_id
      const { data: eventsByMatchId, error: matchIdError } = await supabase
        .from('match_event')
        .select('*')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });
      
      if (matchIdError) {
        console.error('Error fetching match events by match_id:', matchIdError);
      } else if (eventsByMatchId && eventsByMatchId.length > 0) {
        matchEvents = eventsByMatchId;
        console.log('Found', matchEvents.length, 'match events by match_id');
      } else {
        // If no events found by match_id, try to find events by fencing_remote_id
        if (remoteId) {
          console.log('Trying to find events by fencing_remote_id:', remoteId);
          const { data: eventsByRemoteId, error: remoteIdError } = await supabase
            .from('match_event')
            .select('*')
            .eq('fencing_remote_id', remoteId)
            .order('timestamp', { ascending: true });
          
          if (remoteIdError) {
            console.error('Error fetching match events by fencing_remote_id:', remoteIdError);
          } else if (eventsByRemoteId && eventsByRemoteId.length > 0) {
            matchEvents = eventsByRemoteId;
            console.log('Found', matchEvents.length, 'match events by fencing_remote_id');
          }
        }
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for best run calculation');
        return 0;
      }

      // 2. Get all match periods for context
      const { data: matchPeriods, error: periodsError } = await supabase
        .from('match_period')
        .select('*')
        .eq('match_id', matchId)
        .order('period_number', { ascending: true });

      if (periodsError) {
        console.error('Error fetching match periods for best run:', periodsError);
        return 0;
      }

      // 3. Helper function to get period for an event
      const getPeriodForEvent = (event: any) => {
        if (!matchPeriods || matchPeriods.length === 0) return 1;
        
        // Find the period that contains this event's timestamp
        for (const period of matchPeriods) {
          const eventTime = new Date(event.timestamp);
          const periodStart = new Date(period.start_time);
          const periodEnd = period.end_time ? new Date(period.end_time) : new Date();
          
          if (eventTime >= periodStart && eventTime <= periodEnd) {
            return period.period_number || 1;
          }
        }
        
        // Default to period 1 if no match found
        return 1;
      };

      // 4. Calculate best run using hybrid approach
      let currentRun = 0;
      let bestRun = 0;
      let currentPeriod = 1;
      let runDetails: string[] = [];

      console.log('📊 Processing', matchEvents.length, 'match events for best run calculation');

      for (const event of matchEvents) {
        // Check if we're in a new period (for logging purposes only)
        const eventPeriod = getPeriodForEvent(event);
        if (eventPeriod !== currentPeriod) {
          // Period changed - just update tracking, don't reset run
          currentPeriod = eventPeriod;
        }

        if (event.scoring_user_name === userName) {
          currentRun++;
          bestRun = Math.max(bestRun, currentRun);
          runDetails.push(`Touch ${currentRun} in period ${eventPeriod} at ${event.timestamp}`);
        } else if (event.scoring_user_name && event.scoring_user_name !== userName) {
          // Opponent scored - reset run (only opponent touches break the run)
          if (currentRun > 0) {
            runDetails.push(`Run of ${currentRun} ended by opponent touch in period ${eventPeriod}`);
          }
          currentRun = 0;
        }
      }

      console.log('🏆 Best run calculated:', bestRun);
      console.log('📝 Run details:', runDetails);
      
      return bestRun;
    } catch (error) {
      console.error('Error calculating best run:', error);
      return 0;
    }
  },

  // Calculate score progression data for chart (for user vs opponent matches)
  async calculateScoreProgression(matchId: string, userName: string, remoteId?: string): Promise<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }> {
    try {
      console.log('📈 Calculating score progression for USER vs OPPONENT match:', matchId, 'user:', userName);
      
      // 1. Get all match events ordered by match_time_elapsed (the stored time when hit was scored)
      const { data: matchEvents, error: eventsError } = await supabase
        .from('match_event')
        .select('scoring_user_name, match_time_elapsed')
        .eq('match_id', matchId)
        .not('match_time_elapsed', 'is', null) // Only events with stored time
        .order('match_time_elapsed', { ascending: true });
      
      if (eventsError) {
        console.error('Error fetching match events for score progression:', eventsError);
        return { userData: [], opponentData: [] };
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for score progression calculation');
        return { userData: [], opponentData: [] };
      }

      // 2. Get match data to determine user vs opponent
      const { data: matchData, error: matchError } = await supabase
        .from('match')
        .select('fencer_1_name, fencer_2_name')
        .eq('match_id', matchId)
        .single();

      if (matchError || !matchData) {
        console.error('Error fetching match data for score progression:', matchError);
        return { userData: [], opponentData: [] };
      }

      console.log('📈 USER vs OPPONENT - Fencer names:', matchData.fencer_1_name, 'vs', matchData.fencer_2_name);
      console.log('📈 USER vs OPPONENT - Match events found:', matchEvents.length);

      // 3. Process events using stored match_time_elapsed
      const userData: {x: string, y: number}[] = [];
      const opponentData: {x: string, y: number}[] = [];
      
      let userScore = 0;
      let opponentScore = 0;

      for (const event of matchEvents) {
        const displaySeconds = event.match_time_elapsed || 0;
        
        // Convert to MM:SS format
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (event.scoring_user_name === userName) {
          // User scored (exact match with userName parameter)
          userScore++;
          const dataPoint = { x: timeString, y: userScore };
          userData.push(dataPoint);
        } else if (event.scoring_user_name === matchData.fencer_1_name && matchData.fencer_1_name !== userName) {
          // Fencer 1 scored, but they're not the current user (name changed scenario)
          userScore++;
          const dataPoint = { x: timeString, y: userScore };
          userData.push(dataPoint);
        } else if (event.scoring_user_name === matchData.fencer_2_name) {
          // Fencer 2 scored (opponent)
          opponentScore++;
          const dataPoint = { x: timeString, y: opponentScore };
          opponentData.push(dataPoint);
        } else {
          // Handle cases where scoring_user_name doesn't match any known fencer names
          // This happens when fencer names changed between match creation and completion
          // For now, treat any unmatched scorer as opponent (this matches the "Touches by Period" logic)
          opponentScore++;
          const dataPoint = { x: timeString, y: opponentScore };
          opponentData.push(dataPoint);
        }
      }
      

      console.log('📈 Final USER score progression:', userData);
      console.log('📈 Final OPPONENT score progression:', opponentData);

      return {
        userData,
        opponentData
      };
    } catch (error) {
      console.error('Error calculating score progression:', error);
      return { userData: [], opponentData: [] };
    }
  },

  // Calculate touches by period
  async calculateTouchesByPeriod(matchId: string, userName: string, remoteId?: string, finalUserScore?: number, finalOpponentScore?: number): Promise<{
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  }> {
    try {
      console.log('📊 Calculating touches by period for match:', matchId, 'user:', userName);
      
      // 1. Get all match events ordered by timestamp
      let matchEvents = null;
      
      // First try to get events by match_id
      const { data: eventsByMatchId, error: matchIdError } = await supabase
        .from('match_event')
        .select('*')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });
      
      if (matchIdError) {
        console.error('Error fetching match events by match_id for touches by period:', matchIdError);
      } else if (eventsByMatchId && eventsByMatchId.length > 0) {
        matchEvents = eventsByMatchId;
        console.log('Found', matchEvents.length, 'match events by match_id for touches by period');
      } else {
        // If no events found by match_id, try to find events by fencing_remote_id
        if (remoteId) {
          console.log('Trying to find events by fencing_remote_id for touches by period:', remoteId);
          const { data: eventsByRemoteId, error: remoteIdError } = await supabase
            .from('match_event')
            .select('*')
            .eq('fencing_remote_id', remoteId)
            .order('timestamp', { ascending: true });
          
          if (remoteIdError) {
            console.error('Error fetching match events by fencing_remote_id for touches by period:', remoteIdError);
          } else if (eventsByRemoteId && eventsByRemoteId.length > 0) {
            matchEvents = eventsByRemoteId;
            console.log('Found', matchEvents.length, 'match events by fencing_remote_id for touches by period');
          }
        }
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for touches by period calculation');
        return {
          period1: { user: 0, opponent: 0 },
          period2: { user: 0, opponent: 0 },
          period3: { user: 0, opponent: 0 }
        };
      }

      // 2. Get final match scores to ensure accuracy
      let authoritativeUserScore = finalUserScore;
      let authoritativeOpponentScore = finalOpponentScore;
      
      // If final scores weren't passed, fetch them from the database
      if (authoritativeUserScore === undefined || authoritativeOpponentScore === undefined) {
        const { data: matchData, error: matchError } = await supabase
          .from('match')
          .select('final_score, touches_against, is_complete')
          .eq('match_id', matchId)
          .single();

        if (matchError) {
          console.error('Error fetching match data for touches by period:', matchError);
        }

        authoritativeUserScore = matchData?.final_score || 0;
        authoritativeOpponentScore = matchData?.touches_against || 0;
      }
      
      console.log('📊 Using authoritative final scores for touches by period:', authoritativeUserScore, '-', authoritativeOpponentScore);

      // 3. Get match periods to determine period boundaries
      const { data: matchPeriods, error: periodsError } = await supabase
        .from('match_period')
        .select('*')
        .eq('match_id', matchId)
        .order('period_number', { ascending: true });

      if (periodsError || !matchPeriods || matchPeriods.length === 0) {
        console.log('No match periods found, assuming all events are in period 1');
        // Count all events as period 1, but cap at final scores
        let userTouches = 0;
        let opponentTouches = 0;
        
        for (const event of matchEvents) {
          if (event.scoring_user_name === userName && userTouches < (authoritativeUserScore || 0)) {
            userTouches++;
            console.log(`📊 User touch counted in period 1, total: ${userTouches}/${authoritativeUserScore || 0}`);
          } else if (event.scoring_user_name && event.scoring_user_name !== userName && opponentTouches < (authoritativeOpponentScore || 0)) {
            opponentTouches++;
            console.log(`📊 Opponent touch counted in period 1, total: ${opponentTouches}/${authoritativeOpponentScore || 0}`);
          } else {
            console.log(`📊 Touch skipped - final scores reached (User: ${userTouches}/${authoritativeUserScore || 0}, Opponent: ${opponentTouches}/${authoritativeOpponentScore || 0})`);
          }
        }
        
        return {
          period1: { user: userTouches, opponent: opponentTouches },
          period2: { user: 0, opponent: 0 },
          period3: { user: 0, opponent: 0 }
        };
      }

      // 4. Calculate touches for each period
      const touchesByPeriod = {
        period1: { user: 0, opponent: 0 },
        period2: { user: 0, opponent: 0 },
        period3: { user: 0, opponent: 0 }
      };

      // Track total touches to cap at final scores
      let totalUserTouches = 0;
      let totalOpponentTouches = 0;

      for (const event of matchEvents) {
        // Determine which period this event belongs to
        let eventPeriod = 1; // Default to period 1
        
        if (matchPeriods.length > 0) {
          const firstPeriodStart = new Date(matchPeriods[0].start_time);
          const eventTime = new Date(event.timestamp);
          
          console.log(`📊 Event: ${event.scoring_user_name} at ${event.timestamp}, First period start: ${firstPeriodStart.toISOString()}`);
          
          // If event happens before first period starts, count it as period 1
          if (eventTime < firstPeriodStart) {
            eventPeriod = 1;
            console.log(`📊 Event before first period start -> Period 1`);
          } else {
            // Check which period the event falls into
            for (let i = 0; i < matchPeriods.length; i++) {
              const period = matchPeriods[i];
              const periodStart = new Date(period.start_time);
              const periodEnd = period.end_time ? new Date(period.end_time) : new Date();
              
              if (eventTime >= periodStart && eventTime <= periodEnd) {
                eventPeriod = period.period_number;
                console.log(`📊 Event falls in period ${eventPeriod} (${periodStart.toISOString()} - ${periodEnd.toISOString()})`);
                break;
              }
            }
          }
        }

        // Count the touch, but only if we haven't reached the final scores
        if (event.scoring_user_name === userName && totalUserTouches < (authoritativeUserScore || 0)) {
          totalUserTouches++;
          if (eventPeriod === 1) touchesByPeriod.period1.user++;
          else if (eventPeriod === 2) touchesByPeriod.period2.user++;
          else if (eventPeriod === 3) touchesByPeriod.period3.user++;
          console.log(`📊 User touch counted in period ${eventPeriod}, total: ${totalUserTouches}/${authoritativeUserScore || 0}`);
        } else if (event.scoring_user_name && event.scoring_user_name !== userName && totalOpponentTouches < (authoritativeOpponentScore || 0)) {
          totalOpponentTouches++;
          if (eventPeriod === 1) touchesByPeriod.period1.opponent++;
          else if (eventPeriod === 2) touchesByPeriod.period2.opponent++;
          else if (eventPeriod === 3) touchesByPeriod.period3.opponent++;
          console.log(`📊 Opponent touch counted in period ${eventPeriod}, total: ${totalOpponentTouches}/${authoritativeOpponentScore || 0}`);
        } else {
          console.log(`📊 Touch skipped - final scores reached (User: ${totalUserTouches}/${authoritativeUserScore}, Opponent: ${totalOpponentTouches}/${authoritativeOpponentScore})`);
        }
      }

      console.log('📊 Touches by period calculated:', touchesByPeriod);
      return touchesByPeriod;
    } catch (error) {
      console.error('Error calculating touches by period:', error);
      return {
        period1: { user: 0, opponent: 0 },
        period2: { user: 0, opponent: 0 },
        period3: { user: 0, opponent: 0 }
      };
    }
  },

  // Update a match
  async updateMatch(matchId: string, updates: {
    final_score?: number;
    // touches_against is a generated column - removed from updates
    result?: string | null;
    score_diff?: number | null;
    final_period?: number;
    yellow_cards?: number;
    red_cards?: number;
    priority_assigned?: string;
    bout_length_s?: number;
    is_complete?: boolean;
    notes?: string;
    period_number?: number;
    score_spp?: number;
    score_by_period?: any; // JSONB field for period-by-period scores
  }): Promise<Match | null> {
    // First, try to get the match to check if it's anonymous (user_id is null)
    const { data: existingMatch } = await supabase
      .from('match')
      .select('user_id')
      .eq('match_id', matchId)
      .single();

    // If this is an anonymous match (user_id is null), use RPC function
    if (existingMatch && existingMatch.user_id === null) {
      console.log('🔄 Updating anonymous match via RPC function');
      
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('update_anonymous_match', {
          match_id_param: matchId,
          updates: updates
        });

      console.log('📡 RPC update result:', { rpcData, rpcError });

      if (!rpcError && rpcData) {
        console.log('✅ RPC update succeeded:', rpcData);
        return rpcData;
      }

      // If RPC fails, log the specific error and try direct update as fallback
      if (rpcError) {
        console.error('❌ RPC update failed with error:', rpcError);
      }
      console.warn('⚠️ RPC update failed, trying direct update for anonymous match');
    }

    // Regular match update (or fallback for anonymous)
    const { data, error } = await supabase
      .from('match')
      .update(updates)
      .eq('match_id', matchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating match:', error);
      
      // If this is an anonymous match and we get RLS error, provide helpful message
      if (existingMatch && existingMatch.user_id === null && error.code === '42501') {
        console.error('❌ Anonymous match updates not allowed. Please create the RPC function.');
        console.error('📝 Run this SQL in your Supabase SQL editor:');
        console.error(`
CREATE OR REPLACE FUNCTION update_anonymous_match(match_id_param text, updates jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    result_record record;
BEGIN
    UPDATE match
    SET 
        final_score = COALESCE((updates->>'final_score')::integer, final_score),
        result = COALESCE((updates->>'result')::text, result),
        score_diff = COALESCE((updates->>'score_diff')::integer, score_diff),
        final_period = COALESCE((updates->>'final_period')::integer, final_period),
        yellow_cards = COALESCE((updates->>'yellow_cards')::integer, yellow_cards),
        red_cards = COALESCE((updates->>'red_cards')::integer, red_cards),
        priority_assigned = COALESCE((updates->>'priority_assigned')::text, priority_assigned),
        bout_length_s = COALESCE((updates->>'bout_length_s')::integer, bout_length_s),
        is_complete = COALESCE((updates->>'is_complete')::boolean, is_complete),
        notes = COALESCE((updates->>'notes')::text, notes),
        period_number = COALESCE((updates->>'period_number')::integer, period_number),
        score_spp = COALESCE((updates->>'score_spp')::integer, score_spp),
        score_by_period = COALESCE((updates->'score_by_period')::jsonb, score_by_period)
    WHERE match_id = match_id_param::uuid
    RETURNING * INTO result_record;
    
    RETURN row_to_json(result_record);
END;
$$;
        `);
      }
      
      return null;
    }

    return data;
  },

  // Delete a match and all related records
  async deleteMatch(matchId: string, fencingRemoteId?: string): Promise<boolean> {
    try {
      console.log('🗑️ Starting deleteMatch:', { matchId, fencingRemoteId });
      
      // Delete in order: events -> periods -> match
      // 1. Delete all match events (by match_id OR fencing_remote_id)
      let eventsError = null;
      if (fencingRemoteId) {
        // Delete by fencing_remote_id (for events created during remote session)
        console.log('🗑️ Deleting match events by fencing_remote_id:', fencingRemoteId);
        const { data: eventsData, error } = await supabase
          .from('match_event')
          .delete()
          .eq('fencing_remote_id', fencingRemoteId)
          .select();
        eventsError = error;
        console.log('🗑️ Match events delete result:', { data: eventsData, error });
      } else {
        // Delete by match_id (fallback)
        console.log('🗑️ Deleting match events by match_id:', matchId);
        const { data: eventsData, error } = await supabase
          .from('match_event')
          .delete()
          .eq('match_id', matchId)
          .select();
        eventsError = error;
        console.log('🗑️ Match events delete result:', { data: eventsData, error });
      }

      if (eventsError) {
        console.error('❌ Error deleting match events:', eventsError);
        return false;
      } else {
        console.log('✅ Match events deleted successfully');
      }

      // 2. Delete all match periods
      console.log('🗑️ Deleting match periods by match_id:', matchId);
      
      // First, let's see what match_period records exist for this match_id
      const { data: existingPeriods, error: queryError } = await supabase
        .from('match_period')
        .select('*')
        .eq('match_id', matchId);
      
      if (queryError) {
        console.error('❌ Error querying match periods:', queryError);
      } else {
        console.log('🔍 Found match_period records to delete:', existingPeriods?.length || 0, existingPeriods);
      }
      
      const { data: periodsData, error: periodsError } = await supabase
        .from('match_period')
        .delete()
        .eq('match_id', matchId)
        .select();

      if (periodsError) {
        console.error('❌ Error deleting match periods:', periodsError);
        return false;
      } else {
        console.log('✅ Match periods deleted successfully:', periodsData?.length || 0, 'records deleted');
        if (periodsData && periodsData.length > 0) {
          console.log('🗑️ Deleted match_period IDs:', periodsData.map(p => p.match_period_id));
        }
      }

      // 3. Delete the match itself
      console.log('🗑️ Deleting match by match_id:', matchId);
      const { data: matchData, error: matchError } = await supabase
        .from('match')
        .delete()
        .eq('match_id', matchId)
        .select();

      if (matchError) {
        console.error('❌ Error deleting match:', matchError);
        return false;
      } else {
        console.log('✅ Match deleted successfully:', matchData);
      }

      console.log('Successfully deleted match and all related records:', matchId);
      return true;
    } catch (error) {
      console.error('Error in deleteMatch:', error);
      return false;
    }
  },

  // Calculate score progression data for anonymous matches (no user/opponent concept)
  async calculateAnonymousScoreProgression(matchId: string): Promise<{
    fencer1Data: {x: string, y: number}[],
    fencer2Data: {x: string, y: number}[]
  }> {
    try {
      console.log('📈 Calculating ANONYMOUS score progression for match:', matchId);
      
      // 1. Get all match events ordered by match_time_elapsed (the stored time when hit was scored)
      const { data: matchEvents, error: eventsError } = await supabase
        .from('match_event')
        .select('scoring_user_name, match_time_elapsed')
        .eq('match_id', matchId)
        .not('match_time_elapsed', 'is', null) // Only events with stored time
        .order('match_time_elapsed', { ascending: true });
      
      if (eventsError) {
        console.error('Error fetching match events for anonymous score progression:', eventsError);
        return { fencer1Data: [], fencer2Data: [] };
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for anonymous score progression calculation');
        return { fencer1Data: [], fencer2Data: [] };
      }

      // 2. Get match data to get fencer names and final scores
      const { data: matchData, error: matchError } = await supabase
        .from('match')
        .select('fencer_1_name, fencer_2_name, final_score, touches_against')
        .eq('match_id', matchId)
        .single();

      if (matchError || !matchData) {
        console.error('Error fetching match data for anonymous score progression:', matchError);
        return { fencer1Data: [], fencer2Data: [] };
      }

      // Get authoritative final scores to cap the count
      const maxFencer1Score = matchData.final_score || 15;
      const maxFencer2Score = matchData.touches_against || 15;

      console.log('📈 ANONYMOUS - Fencer names:', matchData.fencer_1_name, 'vs', matchData.fencer_2_name);
      console.log('📈 ANONYMOUS - Final scores (max cap):', maxFencer1Score, '-', maxFencer2Score);
      console.log('📈 ANONYMOUS - Match events found:', matchEvents.length);

      // 3. Process events using stored match_time_elapsed
      const fencer1Data: {x: string, y: number}[] = [];
      const fencer2Data: {x: string, y: number}[] = [];
      
      let fencer1Score = 0;
      let fencer2Score = 0;

      for (const event of matchEvents) {
        const displaySeconds = event.match_time_elapsed || 0;
        
        // Convert to MM:SS format
        const minutes = Math.floor(displaySeconds / 60);
        const seconds = displaySeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (event.scoring_user_name === matchData.fencer_1_name && fencer1Score < maxFencer1Score) {
          // Fencer 1 scored (only count if below final score - handles accidental score adds/removes)
          fencer1Score++;
          const dataPoint = { x: timeString, y: fencer1Score };
          fencer1Data.push(dataPoint);
          console.log(`📈 ✅ Fencer 1 (${matchData.fencer_1_name}) touch counted: ${fencer1Score}/${maxFencer1Score} at ${timeString}`);
        } else if (event.scoring_user_name === matchData.fencer_2_name && fencer2Score < maxFencer2Score) {
          // Fencer 2 scored (only count if below final score - handles accidental score adds/removes)
          fencer2Score++;
          const dataPoint = { x: timeString, y: fencer2Score };
          fencer2Data.push(dataPoint);
          console.log(`📈 ✅ Fencer 2 (${matchData.fencer_2_name}) touch counted: ${fencer2Score}/${maxFencer2Score} at ${timeString}`);
        } else {
          // Log skipped events to help diagnose issues
          console.log(`📈 ⏭️  Event skipped - Scorer: "${event.scoring_user_name}", F1: ${fencer1Score}/${maxFencer1Score}, F2: ${fencer2Score}/${maxFencer2Score}`);
        }
      }

      console.log('📈 Final fencer 1 score progression:', fencer1Data);
      console.log('📈 Final fencer 2 score progression:', fencer2Data);

      return {
        fencer1Data,
        fencer2Data
      };
    } catch (error) {
      console.error('Error calculating anonymous score progression:', error);
      return { fencer1Data: [], fencer2Data: [] };
    }
  },
};

// User-related functions
export const userService = {
  // Create a new user in app_user table
  async createUser(userId: string, email: string): Promise<AppUser | null> {
    const userData = {
      user_id: userId,
      name: email.split('@')[0], // Use email prefix as name
    };

    console.log('Creating user in app_user table:', userData);

    const { data, error } = await supabase
      .from('app_user')
      .insert(userData)
      .select()
      .single();

    console.log('User creation result - data:', data);
    console.log('User creation result - error:', error);

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }

    return data;
  },

  // Get user by ID
  async getUserById(userId: string): Promise<AppUser | null> {
    const { data, error } = await supabase
      .from('app_user')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  },
};

// Goal-related functions
export const goalService = {
  // Get active goals for a user
  async getActiveGoals(userId: string): Promise<SimpleGoal[]> {
    console.log('📊 getActiveGoals called with userId:', userId);
    
    const { data, error } = await supabase
      .from('goal')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_failed', false)  // Exclude failed goals
      .order('created_at', { ascending: false });

    console.log('📊 Raw goal data from database:', data);
    console.log('📊 Number of active goals found:', data?.length || 0);
    console.log('📊 Goal query error:', error);

    if (error) {
      console.error('Error fetching goals:', error);
      return [];
    }

    const mappedGoals = data?.map(goal => {
      const currentValue = goal.current_value || 0;
      const targetValue = goal.target_value || 1;
      const rawProgress = targetValue > 0 ? Math.round((currentValue / targetValue) * 100) : 0;
      // Cap progress between 0% and 100% for display
      const calculatedProgress = Math.max(0, Math.min(rawProgress, 100));
      
      console.log('🎯 Goal progress calculation:', {
        title: goal.category,
        currentValue,
        targetValue,
        rawProgress,
        displayProgress: calculatedProgress
      });
      
      return {
        id: goal.goal_id,
        title: goal.category,
        description: goal.description || '',
        targetValue: targetValue,
        currentValue: currentValue,
        deadline: goal.deadline,
        isCompleted: goal.is_completed || false,
        isFailed: goal.is_failed || false,
        progress: calculatedProgress,
        match_window: goal.match_window,
        starting_match_count: goal.starting_match_count,
      };
    }) || [];
    
    console.log('Mapped goals:', mappedGoals);
    return mappedGoals;
  },

  // Create a new goal
  async createGoal(goalData: Partial<Goal>, userId: string): Promise<Goal | null> {
    const newGoal = {
      ...goalData,
      user_id: userId,
      is_active: true,
      is_completed: false,
      current_value: 0,
    };

    console.log('Inserting goal with data:', newGoal);
    console.log('User ID being used:', userId);

    const { data, error } = await supabase
      .from('goal')
      .insert(newGoal)
      .select()
      .single();

    console.log('Goal creation result - data:', data);
    console.log('Goal creation result - error:', error);

    if (error) {
      console.error('Error creating goal:', error);
      return null;
    }

    return data;
  },

  // Update goal progress
  async updateGoalProgress(goalId: string, currentValue: number): Promise<{ success: boolean; justCompleted: boolean; goalData?: any }> {
    // First get the goal to check target value and current completion status
    const { data: goal, error: fetchError } = await supabase
      .from('goal')
      .select('*')
      .eq('goal_id', goalId)
      .single();

    if (fetchError) {
      console.error('Error fetching goal for progress update:', fetchError);
      return { success: false, justCompleted: false };
    }

    const wasCompletedBefore = goal?.is_completed || false;
    const isCompletedNow = currentValue >= (goal?.target_value || 0);
    const justCompleted = !wasCompletedBefore && isCompletedNow;

    const { error } = await supabase
      .from('goal')
      .update({ 
        current_value: currentValue,
        updated_at: new Date().toISOString(),
        is_completed: isCompletedNow
      })
      .eq('goal_id', goalId);

    if (error) {
      console.error('Error updating goal:', error);
      return { success: false, justCompleted: false };
    }

    console.log('✅ Goal progress updated:', { 
      goalId, 
      currentValue, 
      targetValue: goal?.target_value, 
      isCompleted: isCompletedNow,
      justCompleted 
    });
    
    return { 
      success: true, 
      justCompleted,
      goalData: justCompleted ? {
        title: goal.category,
        description: goal.description,
        targetValue: goal.target_value,
        currentValue: currentValue
      } : undefined
    };
  },

  // Get goal target value
  async getGoalTarget(goalId: string): Promise<number> {
    const { data, error } = await supabase
      .from('goal')
      .select('target_value')
      .eq('goal_id', goalId)
      .single();

    if (error) {
      console.error('Error fetching goal target:', error);
      return 0;
    }

    return data?.target_value || 0;
  },

  // Deactivate a completed goal
  async deactivateGoal(goalId: string): Promise<boolean> {
    console.log('🔒 Deactivating completed goal:', goalId);
    
    const { error } = await supabase
      .from('goal')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('goal_id', goalId);

    if (error) {
      console.error('Error deactivating goal:', error);
      return false;
    }

    console.log('✅ Goal deactivated successfully');
    return true;
  },

  // Delete a goal (soft delete by marking inactive)
  async deleteGoal(goalId: string): Promise<boolean> {
    console.log('🗑️ Deleting goal:', goalId);
    
    const { data, error } = await supabase
      .from('goal')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('goal_id', goalId)
      .select();

    if (error) {
      console.error('❌ Error deleting goal:', error);
      return false;
    }

    console.log('✅ Goal deleted successfully (deactivated):', data);
    return true;
  },

  // Deactivate all completed goals for a user
  async deactivateAllCompletedGoals(userId: string): Promise<number> {
    console.log('🧹 Deactivating all completed goals for user:', userId);
    
    const { data, error } = await supabase
      .from('goal')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_completed', true)
      .eq('is_active', true)
      .select();

    if (error) {
      console.error('❌ Error deactivating completed goals:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`✅ Deactivated ${count} completed goals`);
    return count;
  },

  // Deactivate expired goals (past deadline and not completed)
  async deactivateExpiredGoals(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    console.log('⏰ Checking for expired goals (deadline before:', today, ')');
    
    const { data, error } = await supabase
      .from('goal')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_completed', false)  // Only incomplete goals
      .lt('deadline', today)       // deadline < today
      .select();

    if (error) {
      console.error('❌ Error deactivating expired goals:', error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`⏰ Auto-deactivated ${count} expired goal(s)`);
    }
    return count;
  },

  // Mark a goal as failed (impossible to achieve)
  async markGoalAsFailed(goalId: string): Promise<boolean> {
    console.log('💥 Marking goal as failed:', goalId);
    
    const { error } = await supabase
      .from('goal')
      .update({ 
        is_failed: true,
        is_active: false,  // Also deactivate failed goals
        updated_at: new Date().toISOString()
      })
      .eq('goal_id', goalId);

    if (error) {
      console.error('❌ Error marking goal as failed:', error);
      return false;
    }

    console.log('✅ Goal marked as failed successfully');
    return true;
  },

  // Get failed goals for cleanup or display
  async getFailedGoals(userId: string): Promise<SimpleGoal[]> {
    const { data, error } = await supabase
      .from('goal')
      .select('*')
      .eq('user_id', userId)
      .eq('is_failed', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching failed goals:', error);
      return [];
    }

    return data?.map(goal => ({
      id: goal.goal_id,
      title: goal.category,
      description: goal.description || '',
      targetValue: goal.target_value,
      currentValue: goal.current_value || 0,
      deadline: goal.deadline,
      isCompleted: false, // Failed goals are not completed
      isFailed: true,
      progress: 0, // Failed goals show 0% progress
      match_window: goal.match_window,
      starting_match_count: goal.starting_match_count,
    })) || [];
  },

  // Update goals based on match completion with precise tracking
  async updateGoalsAfterMatch(userId: string, matchResult: 'win' | 'loss', finalScore: number, opponentScore: number = 0): Promise<{ completedGoals: any[] }> {
    const completedGoals: any[] = [];
    
    try {
      console.log('🎯 Updating goals after match completion:', { userId, matchResult, finalScore, opponentScore });
      
      // Get active goals for the user
      const activeGoals = await this.getActiveGoals(userId);
      console.log('📋 Found active goals:', activeGoals.map(g => ({ title: g.title, current: g.currentValue, target: g.targetValue })));
      
      // Get user's match statistics for context
      const userMatches = await matchService.getRecentMatches(userId, 1000);
      const totalMatches = userMatches.length;
      const totalWins = userMatches.filter(m => m.isWin).length;
      const currentWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
      const pointDifferential = finalScore - opponentScore;
      
      console.log('📊 Match context:', { totalMatches, totalWins, currentWinRate, pointDifferential });
      
      for (const goal of activeGoals) {
        let shouldUpdate = false;
        let newCurrentValue = goal.currentValue;
        
        console.log('🔍 Processing goal:', { 
          title: goal.title, 
          description: goal.description,
          currentValue: goal.currentValue,
          targetValue: goal.targetValue
        });
        
        // Parse the goal category to determine exact tracking type
        const category = goal.title;
        
        switch (category) {
          case 'Total Matches Played':
            // Track every match completion
            newCurrentValue = goal.currentValue + 1;
            shouldUpdate = true;
            console.log('📊 Updating Total Matches goal:', goal.currentValue, '→', newCurrentValue);
            break;
            
          case 'Wins':
            // Track only wins
            if (goal.match_window && goal.starting_match_count !== undefined) {
              // NEW: Windowed wins - "Win X out of next Y matches"
              const matchesSinceGoalCreated = userMatches.slice(0, totalMatches - (goal.starting_match_count || 0));
              const windowMatches = matchesSinceGoalCreated.slice(0, goal.match_window);
              
              if (windowMatches.length > 0) {
                const winsInWindow = windowMatches.filter(m => m.isWin).length;
                const lossesInWindow = windowMatches.filter(m => !m.isWin).length;
                const remainingMatches = goal.match_window - windowMatches.length;
                const maxPossibleWins = winsInWindow + remainingMatches;
                
                console.log('🏆 Updating Wins goal (Windowed):', {
                  previousValue: goal.currentValue,
                  newValue: winsInWindow,
                  matchesInWindow: windowMatches.length,
                  winsInWindow,
                  lossesInWindow,
                  remainingMatches,
                  maxPossibleWins,
                  targetValue: goal.targetValue,
                  windowSize: goal.match_window,
                  matchesPlayed: windowMatches.length + '/' + goal.match_window
                });
                
                // ✅ NEW: Check if goal is impossible to achieve
                if (maxPossibleWins < goal.targetValue) {
                  console.log('💥 Goal failed - impossible to achieve:', {
                    goalTitle: goal.title,
                    currentWins: winsInWindow,
                    maxPossibleWins,
                    targetValue: goal.targetValue,
                    remainingMatches
                  });
                  
                  // Mark goal as failed
                  await this.markGoalAsFailed(goal.id);
                  
                  // Don't update the goal value since it's failed
                  continue; // Skip to next goal
                }
                
                newCurrentValue = winsInWindow;
                shouldUpdate = true;
              }
            } else {
              // ORIGINAL: Simple wins goal (no window)
              if (matchResult === 'win') {
                newCurrentValue = goal.currentValue + 1;
                shouldUpdate = true;
                console.log('🏆 Updating Wins goal (Simple):', goal.currentValue, '→', newCurrentValue);
              } else {
                console.log('🔸 Wins goal not updated - match was not a win');
              }
            }
            break;
            
          case 'Win Rate %':
            // Legacy support for old "Win Rate %" goals
            // New goals should use "Wins" with match_window instead
            newCurrentValue = currentWinRate;
            shouldUpdate = true;
            console.log('📈 Updating Win Rate goal (Legacy - Career %):', goal.currentValue, '→', newCurrentValue, '%');
            break;
            
          case 'Average Margin of Victory':
            // Track average margin of victory over window
            if (goal.match_window && goal.starting_match_count !== undefined) {
              // Windowed: "Win by average X+ points over next Y matches"
              const matchesSinceGoalCreated = userMatches.slice(0, totalMatches - (goal.starting_match_count || 0));
              const windowMatches = matchesSinceGoalCreated.slice(0, goal.match_window);
              
              if (windowMatches.length > 0) {
                // Calculate average margin for ALL matches in this window (wins AND losses)
                let totalMargin = 0;
                
                // ✅ Calculate actual margin from all matches (wins are positive, losses are negative)
                for (const match of windowMatches) {
                  // Margin is positive for wins, negative for losses
                  const margin = match.youScore - match.opponentScore;
                  totalMargin += margin;
                }
                
                const averageMargin = windowMatches.length > 0 ? totalMargin / windowMatches.length : 0;
                newCurrentValue = Math.round(averageMargin * 100) / 100; // Round to 2 decimals
                
                const winCount = windowMatches.filter(m => m.isWin).length;
                const lossCount = windowMatches.filter(m => !m.isWin).length;
                
                console.log('🏆 Updating Average Margin of Victory goal (Windowed - All Matches):', {
                  previousValue: goal.currentValue,
                  newValue: newCurrentValue,
                  matchesInWindow: windowMatches.length,
                  winsInWindow: winCount,
                  lossesInWindow: lossCount,
                  totalMargin,
                  averageMargin,
                  targetValue: goal.targetValue,
                  windowSize: goal.match_window
                });
                
                // ✅ Improved failure detection
                // Goal fails if: even with perfect 15-0 wins remaining, average can't reach target
                const remainingMatches = goal.match_window - windowMatches.length;
                
                // Best case: all remaining matches are 15-0 victories
                const bestCaseTotalMargin = totalMargin + (remainingMatches * 15);
                const maxPossibleAverage = goal.match_window > 0 ? bestCaseTotalMargin / goal.match_window : 0;
                
                if (remainingMatches === 0 && averageMargin < goal.targetValue) {
                  // Window complete but target not reached
                  console.log('💥 Average Margin goal failed - window complete, target not reached:', {
                    goalTitle: goal.title,
                    currentAverage: newCurrentValue,
                    targetValue: goal.targetValue,
                    matchesPlayed: windowMatches.length,
                    windowSize: goal.match_window
                  });
                  
                  await this.markGoalAsFailed(goal.id);
                  continue; // Skip to next goal
                } else if (maxPossibleAverage < goal.targetValue) {
                  // Mathematically impossible even with perfect remaining matches
                  console.log('💥 Average Margin goal failed - mathematically impossible:', {
                    goalTitle: goal.title,
                    currentAverage: newCurrentValue,
                    maxPossibleAverage,
                    targetValue: goal.targetValue,
                    remainingMatches,
                    matchesPlayed: windowMatches.length,
                    totalMargin
                  });
                  
                  await this.markGoalAsFailed(goal.id);
                  continue; // Skip to next goal
                }
                
                shouldUpdate = true;
              }
            } else {
              // Simple/Legacy: Cumulative - not a true average
              // This adds point differential to a running total (deprecated approach)
              newCurrentValue = goal.currentValue + pointDifferential;
              shouldUpdate = true;
              console.log('🏆 Updating Average Margin goal (Simple/Legacy):', goal.currentValue, '→', newCurrentValue);
            }
            break;
            
          case 'Streaks':
            // Track current win streak
            let currentStreak = 0;
            // Calculate current streak from recent matches
            for (let i = userMatches.length - 1; i >= 0; i--) {
              if (userMatches[i].isWin) {
                currentStreak++;
              } else {
                break;
              }
            }
            newCurrentValue = currentStreak;
            shouldUpdate = true;
            console.log('🔥 Updating Streaks goal:', goal.currentValue, '→', newCurrentValue);
            break;
            
          default:
            // Handle custom goal titles with pattern matching
            const goalText = goal.title.toLowerCase();
            const goalDescription = (goal.description || '').toLowerCase();
            const combinedText = `${goalText} ${goalDescription}`;
            
            if ((combinedText.includes('win') || combinedText.includes('victory')) && 
                (combinedText.includes('match') || combinedText.includes('bout'))) {
              // Custom win goal
              if (matchResult === 'win') {
                newCurrentValue = goal.currentValue + 1;
                shouldUpdate = true;
                console.log('🏆 Updating custom win goal:', goal.title, goal.currentValue, '→', newCurrentValue);
              }
            } else if (combinedText.includes('match') || combinedText.includes('play')) {
              // Custom match goal
              newCurrentValue = goal.currentValue + 1;
              shouldUpdate = true;
              console.log('🎮 Updating custom match goal:', goal.title, goal.currentValue, '→', newCurrentValue);
            } else if (combinedText.includes('point') || combinedText.includes('score')) {
              // Custom points goal
              newCurrentValue = goal.currentValue + finalScore;
              shouldUpdate = true;
              console.log('🎯 Updating custom points goal:', goal.title, goal.currentValue, '→', newCurrentValue);
            } else {
              console.log('❓ Goal type not recognized:', goal.title);
            }
            break;
        }
        
        if (shouldUpdate) {
          const result = await this.updateGoalProgress(goal.id, newCurrentValue);
          if (result.success) {
            console.log('✅ Goal successfully updated:', goal.title, 'to', newCurrentValue);
            
            if (result.justCompleted && result.goalData) {
              console.log('🎉 GOAL JUST COMPLETED!', result.goalData);
              completedGoals.push(result.goalData);
            }
          } else {
            console.log('❌ Failed to update goal:', goal.title);
          }
        }
      }
    } catch (error) {
      console.error('Error updating goals after match:', error);
    }
    
    return { completedGoals };
  },
};

// Fencing Remote functions
export const fencingRemoteService = {
  // Create a new fencing remote session
  async createRemoteSession(remoteData: Partial<FencingRemote>): Promise<FencingRemote | null> {
    const { data, error } = await supabase
      .from('fencing_remote')
      .insert(remoteData)
      .select()
      .single();

    if (error) {
      console.error('Error creating remote session:', error);
      return null;
    }

    return data;
  },

  // Update remote session scores
  async updateRemoteScores(remoteId: string, score1: number, score2: number): Promise<boolean> {
    const { error } = await supabase
      .from('fencing_remote')
      .update({ 
        score_1: score1,
        score_2: score2,
      })
      .eq('remote_id', remoteId);

    if (error) {
      console.error('Error updating remote scores:', error);
      return false;
    }

    return true;
  },

  // Complete remote session and create match
  async completeRemoteSession(remoteId: string, userId: string): Promise<Match | null> {
    // Get the remote session data
    const { data: remoteData, error: remoteError } = await supabase
      .from('fencing_remote')
      .select('*')
      .eq('remote_id', remoteId)
      .single();

    if (remoteError || !remoteData) {
      console.error('Error fetching remote session:', remoteError);
      return null;
    }

    // Create match from remote data
    const match = await matchService.createMatchFromRemote(remoteData, userId);

    if (match) {
      // Update remote session with linked match ID
      await supabase
        .from('fencing_remote')
        .update({ linked_match_id: match.match_id })
        .eq('remote_id', remoteId);
    }

    return match;
  },

  // Delete a fencing remote session
  async deleteRemoteSession(remoteId: string): Promise<boolean> {
    console.log('🗑️ Deleting remote session:', remoteId);
    const { data, error } = await supabase
      .from('fencing_remote')
      .delete()
      .eq('remote_id', remoteId)
      .select();

    if (error) {
      console.error('❌ Error deleting remote session:', error);
      return false;
    }

    console.log('✅ Successfully deleted remote session:', { remoteId, data });
    return true;
  },

  // Clean up orphaned match_period records (for debugging)
  async cleanupOrphanedPeriods(): Promise<boolean> {
    try {
      console.log('🧹 Checking for orphaned match_period records...');
      
      // Find match_period records that don't have corresponding match records
      const { data: orphanedPeriods, error } = await supabase
        .from('match_period')
        .select('match_period_id, match_id')
        .not('match_id', 'in', `(SELECT match_id FROM match)`);
      
      if (error) {
        console.error('❌ Error finding orphaned periods:', error);
        return false;
      }
      
      if (orphanedPeriods && orphanedPeriods.length > 0) {
        console.log('🗑️ Found orphaned match_period records:', orphanedPeriods.length);
        console.log('Orphaned period IDs:', orphanedPeriods.map(p => p.match_period_id));
        
        // Delete the orphaned records
        const { error: deleteError } = await supabase
          .from('match_period')
          .delete()
          .in('match_period_id', orphanedPeriods.map(p => p.match_period_id));
        
        if (deleteError) {
          console.error('❌ Error deleting orphaned periods:', deleteError);
          return false;
        }
        
        console.log('✅ Cleaned up orphaned match_period records');
      } else {
        console.log('✅ No orphaned match_period records found');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error in cleanupOrphanedPeriods:', error);
      return false;
    }
  },
};

// Diary Entry-related functions
export const diaryService = {
  // Get diary entries for a user
  async getDiaryEntries(userId: string, limit: number = 20): Promise<DiaryEntry[]> {
    const { data, error } = await supabase
      .from('diary_entry')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching diary entries:', error);
      return [];
    }

    return data || [];
  },

  // Create a new diary entry
  async createDiaryEntry(entryData: Partial<DiaryEntry>, userId: string): Promise<DiaryEntry | null> {
    const newEntry = {
      ...entryData,
      user_id: userId,
    };

    const { data, error } = await supabase
      .from('diary_entry')
      .insert(newEntry)
      .select()
      .single();

    if (error) {
      console.error('Error creating diary entry:', error);
      return null;
    }

    return data;
  },

  // Update diary entry
  async updateDiaryEntry(entryId: string, updates: Partial<DiaryEntry>): Promise<DiaryEntry | null> {
    const { data, error } = await supabase
      .from('diary_entry')
      .update(updates)
      .eq('entry_id', entryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating diary entry:', error);
      return null;
    }

    return data;
  },

  // Delete diary entry
  async deleteDiaryEntry(entryId: string): Promise<boolean> {
    const { error } = await supabase
      .from('diary_entry')
      .delete()
      .eq('entry_id', entryId);

    if (error) {
      console.error('Error deleting diary entry:', error);
      return false;
    }

    return true;
  },
};

// Drill-related functions
export const drillService = {
  // Get all drills
  async getDrills(category?: string): Promise<Drill[]> {
    let query = supabase
      .from('drill')
      .select('*')
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching drills:', error);
      return [];
    }

    return data || [];
  },

  // Get drill by ID
  async getDrillById(drillId: string): Promise<Drill | null> {
    const { data, error } = await supabase
      .from('drill')
      .select('*')
      .eq('drill_id', drillId)
      .single();

    if (error) {
      console.error('Error fetching drill:', error);
      return null;
    }

    return data;
  },

  // Create a new drill
  async createDrill(drillData: Partial<Drill>): Promise<Drill | null> {
    const { data, error } = await supabase
      .from('drill')
      .insert(drillData)
      .select()
      .single();

    if (error) {
      console.error('Error creating drill:', error);
      return null;
    }

    return data;
  },
};

// Equipment-related functions
export const equipmentService = {
  // Get all equipment
  async getEquipment(sport?: string): Promise<Equipment[]> {
    let query = supabase
      .from('equipment')
      .select('*')
      .order('name', { ascending: true });

    if (sport) {
      query = query.eq('sport', sport);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching equipment:', error);
      return [];
    }

    return data || [];
  },

  // Get equipment by ID
  async getEquipmentById(equipmentId: string): Promise<Equipment | null> {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('equipment_id', equipmentId)
      .single();

    if (error) {
      console.error('Error fetching equipment:', error);
      return null;
    }

    return data;
  },
};

// Match Approval-related functions
export const matchApprovalService = {
  // Get approvals for a user
  async getUserApprovals(userId: string): Promise<MatchApproval[]> {
    const { data, error } = await supabase
      .from('match_approval')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching match approvals:', error);
      return [];
    }

    return data || [];
  },

  // Create or update approval
  async approveMatch(remoteId: string, userId: string, approved: boolean): Promise<MatchApproval | null> {
    const approvalData = {
      remote_id: remoteId,
      user_id: userId,
      has_approved: approved,
      timestamp: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('match_approval')
      .upsert(approvalData, { onConflict: 'remote_id,user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating approval:', error);
      return null;
    }

    return data;
  },
};

// Match Event-related functions
export const matchEventService = {
  // Get events for a match
  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    const { data, error } = await supabase
      .from('match_event')
      .select('*')
      .eq('match_id', matchId)
      .order('event_time', { ascending: true });

    if (error) {
      console.error('Error fetching match events:', error);
      return [];
    }

    return data || [];
  },

  // Create a match event
  async createMatchEvent(eventData: Partial<MatchEvent>): Promise<MatchEvent | null> {
    const { data, error } = await supabase
      .from('match_event')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      console.error('Error creating match event:', error);
      return null;
    }

    return data;
  },
};

// Match Period Service
export const matchPeriodService = {
  // Create a new match period
  createMatchPeriod: async (periodData: {
    match_id: string;
    period_number?: number;
    start_time?: string;
    end_time?: string;
    fencer_1_score?: number;
    fencer_2_score?: number;
    fencer_1_cards?: number;
    fencer_2_cards?: number;
    priority_assigned?: string;
    priority_to?: string;
    notes?: string;
  }) => {
    console.log('🔄 matchPeriodService.createMatchPeriod called with:', periodData);
    
    const { data, error } = await supabase
      .from('match_period')
      .insert(periodData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating match period:', error);
      return null;
    }

    console.log('✅ Match period created successfully:', data);
    return data;
  },

  // Get match periods for a specific match
  getMatchPeriods: async (matchId: string) => {
    const { data, error } = await supabase
      .from('match_period')
      .select('*')
      .eq('match_id', matchId)
      .order('period_number', { ascending: true });

    if (error) {
      console.error('Error fetching match periods:', error);
      return [];
    }

    return data;
  },

  // Update a match period
  updateMatchPeriod: async (periodId: string, updates: {
    end_time?: string;
    fencer_1_score?: number;
    fencer_2_score?: number;
    fencer_1_cards?: number;
    fencer_2_cards?: number;
    priority_assigned?: string;
    priority_to?: string;
    notes?: string;
    timestamp?: string; // Add timestamp to updates
  }) => {
    const { data, error } = await supabase
      .from('match_period')
      .update(updates)
      .eq('match_period_id', periodId)
      .select()
      .single();

    if (error) {
      console.error('Error updating match period:', error);
      return null;
    }

    return data;
  },

  // Note: Removed duplicate calculateScoreProgression function that was causing score inconsistencies
};

// ============================================
// WEEKLY TARGETS & SESSION LOGGING
// ============================================

// Types for Weekly Targets
export interface WeeklyTarget {
  target_id: string;
  user_id: string;
  activity_type: string;
  week_start_date: string; // ISO date string
  week_end_date: string;
  target_sessions: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklySessionLog {
  session_id: string;
  user_id: string;
  activity_type: string;
  session_date: string; // ISO date string
  duration_minutes?: number;
  notes?: string;
  created_at: string;
}

export interface WeeklyProgress {
  activity_type: string;
  target_sessions: number;
  completed_sessions: number;
  week_start_date: string;
  week_end_date: string;
  days_left: number;
  completion_rate: number; // 0-100
}

// Weekly Target Service
export const weeklyTargetService = {
  
  // Create or update a weekly target
  async setWeeklyTarget(
    userId: string,
    activityType: string,
    weekStartDate: Date,
    weekEndDate: Date,
    targetSessions: number
  ): Promise<WeeklyTarget | null> {
    try {
      const { data, error } = await supabase
        .from('weekly_target')
        .upsert({
          user_id: userId,
          activity_type: activityType,
          week_start_date: weekStartDate.toISOString().split('T')[0],
          week_end_date: weekEndDate.toISOString().split('T')[0],
          target_sessions: targetSessions,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,activity_type,week_start_date'
        })
        .select()
        .single();

      if (error) {
        console.error('Error setting weekly target:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in setWeeklyTarget:', error);
      return null;
    }
  },

  // Get target for a specific week
  async getWeeklyTarget(
    userId: string,
    activityType: string,
    weekStartDate: Date
  ): Promise<WeeklyTarget | null> {
    try {
      const dateString = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`;
      
      const { data, error } = await supabase
        .from('weekly_target')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_type', activityType)
        .eq('week_start_date', dateString)
        .single();
      
      console.log('🔍 Query params:', { userId, activityType, week_start_date: dateString });

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.error('Error getting weekly target:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getWeeklyTarget:', error);
      return null;
    }
  },

  // Delete a weekly target
  async deleteWeeklyTarget(targetId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('weekly_target')
        .delete()
        .eq('target_id', targetId);

      if (error) {
        console.error('Error deleting weekly target:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteWeeklyTarget:', error);
      return false;
    }
  }
};

// Weekly Session Log Service
export const weeklySessionLogService = {
  
  // Log a new session
  async logSession(
    userId: string,
    activityType: string,
    sessionDate?: Date,
    durationMinutes?: number,
    notes?: string
  ): Promise<WeeklySessionLog | null> {
    try {
      const { data, error } = await supabase
        .from('weekly_session_log')
        .insert({
          user_id: userId,
          activity_type: activityType,
          session_date: sessionDate 
            ? sessionDate.toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0],
          duration_minutes: durationMinutes,
          notes: notes
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in logSession:', error);
      return null;
    }
  },

  // Delete a session
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('weekly_session_log')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error deleting session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteSession:', error);
      return false;
    }
  },

  // Get sessions for a specific week
  async getSessionsForWeek(
    userId: string,
    weekStartDate: Date,
    weekEndDate: Date,
    activityType?: string
  ): Promise<WeeklySessionLog[]> {
    try {
      let query = supabase
        .from('weekly_session_log')
        .select('*')
        .eq('user_id', userId)
        .gte('session_date', weekStartDate.toISOString().split('T')[0])
        .lte('session_date', weekEndDate.toISOString().split('T')[0])
        .order('session_date', { ascending: false });

      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting sessions for week:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSessionsForWeek:', error);
      return [];
    }
  }
};

// Weekly Progress Service
export const weeklyProgressService = {
  
  // Get current week progress
  async getCurrentWeekProgress(
    userId: string,
    activityType: string
  ): Promise<WeeklyProgress | null> {
    try {
      // Calculate current week boundaries (Monday to Sunday) in local time
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Local date only
      
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysToMonday);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      console.log('📅 Week calculation:', {
        today: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
        dayOfWeek,
        daysToMonday,
        weekStart: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`,
        weekEnd: `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`
      });

      // Get target
      const target = await weeklyTargetService.getWeeklyTarget(
        userId,
        activityType,
        weekStart
      );
      
      console.log('🎯 Target fetched:', target);

      // Get completed sessions
      const sessions = await weeklySessionLogService.getSessionsForWeek(
        userId,
        weekStart,
        weekEnd,
        activityType
      );

      // Calculate days left
      const daysLeft = Math.ceil(
        (weekEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate completion rate
      const targetSessions = target?.target_sessions || 0;
      const completedSessions = sessions.length;
      const completionRate = targetSessions > 0 
        ? Math.round((completedSessions / targetSessions) * 100) 
        : 0;

      return {
        activity_type: activityType,
        target_sessions: targetSessions,
        completed_sessions: completedSessions,
        week_start_date: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`,
        week_end_date: `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`,
        days_left: Math.max(0, daysLeft),
        completion_rate: Math.min(100, completionRate)
      };
    } catch (error) {
      console.error('Error in getCurrentWeekProgress:', error);
      return null;
    }
  }
};

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

    const { data, error } = await supabase
      .from('match')
      .insert(matchData)
      .select()
      .single();

    if (error) {
      console.error('Error creating match:', error);
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

  // Calculate score progression data for chart
  async calculateScoreProgression(matchId: string, userName: string, remoteId?: string): Promise<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }> {
    try {
      console.log('📈 Calculating score progression for match:', matchId, 'user:', userName);
      
      // 1. Get all match events ordered by timestamp (same logic as best run)
      let matchEvents = null;
      
      // First try to get events by match_id
      const { data: eventsByMatchId, error: matchIdError } = await supabase
        .from('match_event')
        .select('*')
        .eq('match_id', matchId)
        .order('timestamp', { ascending: true });
      
      if (matchIdError) {
        console.error('Error fetching match events by match_id for score progression:', matchIdError);
      } else if (eventsByMatchId && eventsByMatchId.length > 0) {
        matchEvents = eventsByMatchId;
        console.log('Found', matchEvents.length, 'match events by match_id for score progression');
      } else {
        // If no events found by match_id, try to find events by fencing_remote_id
        if (remoteId) {
          console.log('Trying to find events by fencing_remote_id for score progression:', remoteId);
          const { data: eventsByRemoteId, error: remoteIdError } = await supabase
            .from('match_event')
            .select('*')
            .eq('fencing_remote_id', remoteId)
            .order('timestamp', { ascending: true });
          
          if (remoteIdError) {
            console.error('Error fetching match events by fencing_remote_id for score progression:', remoteIdError);
          } else if (eventsByRemoteId && eventsByRemoteId.length > 0) {
            matchEvents = eventsByRemoteId;
            console.log('Found', matchEvents.length, 'match events by fencing_remote_id for score progression');
          }
        }
      }

      if (!matchEvents || matchEvents.length === 0) {
        console.log('No match events found for score progression calculation');
        return { userData: [], opponentData: [] };
      }

      // 2. Get match start time from match_period
      const { data: matchPeriods, error: periodsError } = await supabase
        .from('match_period')
        .select('*')
        .eq('match_id', matchId)
        .order('period_number', { ascending: true });

      let matchStartTime: Date;
      if (periodsError || !matchPeriods || matchPeriods.length === 0) {
        console.log('No match periods found, using first event as match start');
        matchStartTime = new Date(matchEvents[0].timestamp);
      } else {
        matchStartTime = new Date(matchPeriods[0].start_time);
      }

      // 3. Calculate score progression for both user and opponent
      const userScoreProgression: {x: string, y: number}[] = [];
      const opponentScoreProgression: {x: string, y: number}[] = [];
      let userScore = 0;
      let opponentScore = 0;

      for (const event of matchEvents) {
        // Calculate elapsed time from match start
        const eventTime = new Date(event.timestamp);
        const elapsedMs = eventTime.getTime() - matchStartTime.getTime();
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        
        // Convert to MM:SS format
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeString = `(${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')})`;

        if (event.scoring_user_name === userName) {
          userScore++;
          userScoreProgression.push({
            x: timeString,
            y: userScore
          });
          console.log(`📈 User score progression: ${timeString} -> Score ${userScore}`);
        } else if (event.scoring_user_name && event.scoring_user_name !== userName) {
          opponentScore++;
          opponentScoreProgression.push({
            x: timeString,
            y: opponentScore
          });
          console.log(`📈 Opponent score progression: ${timeString} -> Score ${opponentScore}`);
        }
      }

      console.log('📈 User score progression calculated:', userScoreProgression);
      console.log('📈 Opponent score progression calculated:', opponentScoreProgression);
      return { userData: userScoreProgression, opponentData: opponentScoreProgression };
    } catch (error) {
      console.error('Error calculating score progression:', error);
      return { userData: [], opponentData: [] };
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
  }): Promise<Match | null> {
    const { data, error } = await supabase
      .from('match')
      .update(updates)
      .eq('match_id', matchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating match:', error);
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
    console.log('getActiveGoals called with userId:', userId);
    
    const { data, error } = await supabase
      .from('goal')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    console.log('Raw goal data from database:', data);
    console.log('Goal query error:', error);

    if (error) {
      console.error('Error fetching goals:', error);
      return [];
    }

    const mappedGoals = data?.map(goal => ({
      id: goal.goal_id,
      title: goal.category,
      description: goal.description || '',
      targetValue: goal.target_value,
      currentValue: goal.current_value || 0,
      deadline: goal.deadline,
      isCompleted: goal.is_completed || false,
      progress: goal.target_value > 0 ? Math.round(((goal.current_value || 0) / goal.target_value) * 100) : 0,
    })) || [];
    
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
  async updateGoalProgress(goalId: string, currentValue: number): Promise<boolean> {
    const { error } = await supabase
      .from('goal')
      .update({ 
        current_value: currentValue,
        updated_at: new Date().toISOString(),
        is_completed: currentValue >= (await this.getGoalTarget(goalId))
      })
      .eq('goal_id', goalId);

    if (error) {
      console.error('Error updating goal:', error);
      return false;
    }

    return true;
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
};

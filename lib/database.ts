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
  async createMatchFromRemote(remoteData: FencingRemote, userId: string): Promise<Match | null> {
    const matchData = {
      user_id: userId,
      fencer_1_name: remoteData.fencer_1_name,
      fencer_2_name: remoteData.fencer_2_name,
      final_score: remoteData.score_1 || 0,
      touches_against: remoteData.score_2 || 0,
      event_date: new Date().toISOString().split('T')[0],
      result: (remoteData.score_1 || 0) > (remoteData.score_2 || 0) ? 'win' : 'loss',
      is_win: (remoteData.score_1 || 0) > (remoteData.score_2 || 0),
      score_diff: (remoteData.score_1 || 0) - (remoteData.score_2 || 0),
      match_type: 'practice',
      source: 'app',
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

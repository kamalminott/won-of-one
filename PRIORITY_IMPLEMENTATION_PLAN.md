# Priority Round Implementation Plan

## 🎯 **Next Steps to Complete Priority Tracking**

### **Phase 1: Fix the Tie Bug (Immediate)**

#### **Step 1: Store Match ID Safely**
```typescript
// In app/(tabs)/remote.tsx
const [matchId, setMatchId] = useState<string | null>(null);

// When creating match period
const createMatchPeriod = async () => {
  const period = await matchPeriodService.createMatchPeriod(periodData);
  if (period) {
    setCurrentMatchPeriod(period);
    setMatchId(period.match_id); // ✅ Store ID separately
  }
};

// In completion - use stored matchId
const proceedWithMatchCompletion = async () => {
  if (!matchId || !remoteSession) {
    console.error('Cannot complete match: missing match ID or session');
    return;
  }
  
  const navParams = {
    matchId: matchId, // ✅ Always valid
    // ... rest of params
  };
};
```

#### **Step 2: Add Better Error Handling**
```typescript
// In app/match-summary.tsx
if (!match || !matchData) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 18 }}>Match not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 10, backgroundColor: '#2e2e2e', borderRadius: 8 }}>
        <Text style={{ color: 'white' }}>Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

---

### **Phase 2: Complete Priority Tracking (Using Existing Structure)**

#### **Step 3: Add Priority Winner Events**
```typescript
// In app/(tabs)/remote.tsx - when priority round is won
const handlePriorityWinner = async (winnerName: string) => {
  // Create priority winner event
  await matchEventService.createMatchEvent({
    match_id: currentMatchPeriod.match_id,
    event_type: 'priority_winner',
    event_time: new Date().toISOString(),
    scoring_user_name: winnerName,
    fencer_1_name: fencerNames.alice,
    fencer_2_name: fencerNames.bob,
  });
  
  console.log('✅ Priority winner event created:', winnerName);
};
```

#### **Step 4: Track Priority Assignment Events**
```typescript
// In app/(tabs)/remote.tsx - when priority is assigned
const assignPriorityWithAnimation = (finalFencer: 'alice' | 'bob') => {
  // ... existing animation code ...
  
  // Create priority assignment event
  matchEventService.createMatchEvent({
    match_id: currentMatchPeriod.match_id,
    event_type: 'priority_assigned',
    event_time: new Date().toISOString(),
    fencer_1_name: fencerNames.alice,
    fencer_2_name: fencerNames.bob,
    // Could add: priority_fencer: finalFencer
  });
  
  // ... rest of existing code ...
};
```

#### **Step 5: Track Priority Round Start/End**
```typescript
// When priority round starts
const startPriorityRound = async () => {
  await matchEventService.createMatchEvent({
    match_id: currentMatchPeriod.match_id,
    event_type: 'priority_round_start',
    event_time: new Date().toISOString(),
    fencer_1_name: fencerNames.alice,
    fencer_2_name: fencerNames.bob,
  });
};

// When priority round ends
const endPriorityRound = async (winnerName: string) => {
  await matchEventService.createMatchEvent({
    match_id: currentMatchPeriod.match_id,
    event_type: 'priority_round_end',
    event_time: new Date().toISOString(),
    scoring_user_name: winnerName,
    fencer_1_name: fencerNames.alice,
    fencer_2_name: fencerNames.bob,
  });
};
```

---

### **Phase 3: Analytics Implementation**

#### **Step 6: Create Priority Analytics Service**
```typescript
// In lib/database.ts
export const priorityAnalyticsService = {
  // Get priority stats for a user
  async getPriorityStats(userId: string) {
    const { data, error } = await supabase
      .from('match_period')
      .select(`
        match_id,
        priority_assigned,
        priority_to,
        match!inner(user_id, fencer_1_name, fencer_2_name)
      `)
      .eq('match.user_id', userId)
      .not('priority_assigned', 'is', null);

    if (error) throw error;

    // Get priority winners from match events
    const matchIds = data.map(mp => mp.match_id);
    const { data: winnerEvents, error: winnerError } = await supabase
      .from('match_event')
      .select('match_id, scoring_user_name, event_time')
      .in('match_id', matchIds)
      .eq('event_type', 'priority_winner');

    if (winnerError) throw winnerError;

    // Calculate stats
    const totalPriorityRounds = data.length;
    const priorityWins = data.filter(mp => {
      const winnerEvent = winnerEvents.find(we => we.match_id === mp.match_id);
      return winnerEvent && winnerEvent.scoring_user_name === mp.priority_to;
    }).length;
    
    const priorityLosses = totalPriorityRounds - priorityWins;
    const priorityWinRate = totalPriorityRounds > 0 ? (priorityWins / totalPriorityRounds) * 100 : 0;

    return {
      totalPriorityRounds,
      priorityWins,
      priorityLosses,
      priorityWinRate: Math.round(priorityWinRate * 100) / 100
    };
  },

  // Get priority performance over time
  async getPriorityPerformanceOverTime(userId: string, days: number = 30) {
    const { data, error } = await supabase
      .from('match_period')
      .select(`
        match_id,
        priority_assigned,
        priority_to,
        match!inner(user_id, event_date, fencer_1_name, fencer_2_name)
      `)
      .eq('match.user_id', userId)
      .not('priority_assigned', 'is', null)
      .gte('match.event_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (error) throw error;

    // Get priority winners
    const matchIds = data.map(mp => mp.match_id);
    const { data: winnerEvents } = await supabase
      .from('match_event')
      .select('match_id, scoring_user_name, event_time')
      .in('match_id', matchIds)
      .eq('event_type', 'priority_winner');

    // Group by date and calculate stats
    const dailyStats = data.reduce((acc, mp) => {
      const date = mp.match.event_date;
      if (!acc[date]) {
        acc[date] = { priorityRounds: 0, priorityWins: 0 };
      }
      acc[date].priorityRounds++;
      
      const winnerEvent = winnerEvents?.find(we => we.match_id === mp.match_id);
      if (winnerEvent && winnerEvent.scoring_user_name === mp.priority_to) {
        acc[date].priorityWins++;
      }
      
      return acc;
    }, {});

    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      priorityRounds: stats.priorityRounds,
      priorityWins: stats.priorityWins,
      priorityLosses: stats.priorityRounds - stats.priorityWins,
      priorityWinRate: Math.round((stats.priorityWins / stats.priorityRounds) * 100 * 100) / 100
    }));
  },

  // Get priority duration stats
  async getPriorityDurationStats(userId: string) {
    const { data, error } = await supabase
      .from('match_event')
      .select(`
        match_id,
        event_time,
        match!inner(user_id)
      `)
      .eq('match.user_id', userId)
      .in('event_type', ['priority_round_start', 'priority_round_end'])
      .order('event_time', { ascending: true });

    if (error) throw error;

    // Calculate durations
    const durations = [];
    for (let i = 0; i < data.length - 1; i += 2) {
      const start = new Date(data[i].event_time);
      const end = new Date(data[i + 1].event_time);
      const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
      durations.push(duration);
    }

    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    return {
      avgDurationSeconds: Math.round(avgDuration),
      minDurationSeconds: minDuration,
      maxDurationSeconds: maxDuration,
      totalPriorityRounds: durations.length
    };
  }
};
```

#### **Step 7: Create Priority Stats UI Component**
```typescript
// In components/PriorityStatsCard.tsx
export const PriorityStatsCard = () => {
  const [priorityStats, setPriorityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      priorityAnalyticsService.getPriorityStats(user.id)
        .then(setPriorityStats)
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <ActivityIndicator />;
  if (!priorityStats) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Priority Round Stats</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{priorityStats.totalPriorityRounds}</Text>
          <Text style={styles.statLabel}>Total Priority Rounds</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{priorityStats.priorityWins}</Text>
          <Text style={styles.statLabel}>Priority Wins</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{priorityStats.priorityLosses}</Text>
          <Text style={styles.statLabel}>Priority Losses</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{priorityStats.priorityWinRate}%</Text>
          <Text style={styles.statLabel}>Priority Win Rate</Text>
        </View>
      </View>
    </View>
  );
};
```

---

### **Phase 4: Integration & Testing**

#### **Step 8: Integrate into Profile Page**
```typescript
// In app/(tabs)/profile.tsx
import { PriorityStatsCard } from '@/components/PriorityStatsCard';

// Add to profile sections
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Priority Round Performance</Text>
  <PriorityStatsCard />
</View>
```

#### **Step 9: Add to Match History**
```typescript
// In components/MatchHistory.tsx
// Add priority round indicator
{match.priority_round && (
  <View style={styles.priorityIndicator}>
    <Ionicons name="trophy" size={16} color={Colors.yellow.accent} />
    <Text style={styles.priorityText}>Priority Round</Text>
  </View>
)}
```

#### **Step 10: Testing**
```typescript
// Test priority round flow
1. Start match
2. Score to tie (14-14)
3. Assign priority
4. Complete priority round
5. Verify events are created
6. Check analytics are accurate
```

---

## 📋 **Implementation Order**

1. **Fix tie bug** (Store match ID safely)
2. **Add priority winner events** (Track who won)
3. **Add priority round start/end events** (Track duration)
4. **Create analytics service** (Query existing data)
5. **Build UI components** (Display stats)
6. **Integrate into profile** (Show priority performance)
7. **Test complete flow** (End-to-end testing)

---

## ✅ **What This Achieves**

- ✅ **Fixes tie bug** - No more "match not found" errors
- ✅ **Tracks priority winners** - Who won each priority round
- ✅ **Tracks priority duration** - How long priority rounds last
- ✅ **Complete analytics** - Priority win/loss stats
- ✅ **No schema changes** - Uses existing database structure
- ✅ **Future-proof** - Easy to extend with more priority data

This gives you complete priority round tracking and analytics using the existing robust event system!


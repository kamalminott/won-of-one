# Priority Win/Loss Analytics Queries

## 📊 **Database Schema for Priority Analytics**

With the recommended priority columns in the `match` table:

```sql
ALTER TABLE match ADD COLUMN priority_round BOOLEAN DEFAULT FALSE;
ALTER TABLE match ADD COLUMN priority_fencer VARCHAR(50);
ALTER TABLE match ADD COLUMN priority_winner VARCHAR(50);
ALTER TABLE match ADD COLUMN priority_duration_seconds INTEGER;
```

---

## 🎯 **Priority Win/Loss Queries**

### **1. Total Priority Rounds Played**
```sql
SELECT COUNT(*) as total_priority_rounds
FROM match 
WHERE user_id = 'user-id-here' 
  AND priority_round = true 
  AND is_complete = true;
```

### **2. Priority Wins**
```sql
SELECT COUNT(*) as priority_wins
FROM match 
WHERE user_id = 'user-id-here' 
  AND priority_round = true 
  AND priority_winner = fencer_1_name  -- User is fencer_1
  AND is_complete = true;
```

### **3. Priority Losses**
```sql
SELECT COUNT(*) as priority_losses
FROM match 
WHERE user_id = 'user-id-here' 
  AND priority_round = true 
  AND priority_winner = fencer_2_name  -- User is fencer_2 (opponent won)
  AND is_complete = true;
```

### **4. Priority Win Rate**
```sql
SELECT 
  COUNT(*) as total_priority_rounds,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses,
  ROUND(
    SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
    2
  ) as priority_win_rate_percent
FROM match 
WHERE user_id = 'user-id-here' 
  AND priority_round = true 
  AND is_complete = true;
```

### **5. Priority Performance Over Time**
```sql
SELECT 
  DATE(event_date) as match_date,
  COUNT(*) as priority_rounds,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses
FROM match 
WHERE user_id = 'user-id-here' 
  AND priority_round = true 
  AND is_complete = true
GROUP BY DATE(event_date)
ORDER BY match_date DESC;
```

### **6. Priority Round Duration Analysis**
```sql
SELECT 
  AVG(priority_duration_seconds) as avg_priority_duration_seconds,
  MIN(priority_duration_seconds) as min_priority_duration_seconds,
  MAX(priority_duration_seconds) as max_priority_duration_seconds,
  COUNT(*) as total_priority_rounds
FROM match 
WHERE user_id = 'user-id-here' 
  AND priority_round = true 
  AND priority_duration_seconds IS NOT NULL
  AND is_complete = true;
```

### **7. Priority Performance by Opponent**
```sql
SELECT 
  fencer_2_name as opponent_name,
  COUNT(*) as priority_rounds_vs_opponent,
  SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) as priority_wins_vs_opponent,
  SUM(CASE WHEN priority_winner = fencer_2_name THEN 1 ELSE 0 END) as priority_losses_vs_opponent,
  ROUND(
    SUM(CASE WHEN priority_winner = fencer_1_name THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
    2
  ) as priority_win_rate_vs_opponent_percent
FROM match 
WHERE user_id = 'user-id-here' 
  AND priority_round = true 
  AND is_complete = true
GROUP BY fencer_2_name
ORDER BY priority_rounds_vs_opponent DESC;
```

---

## 🔧 **Implementation in Code**

### **Database Service Functions**

```typescript
// In lib/database.ts

export const matchService = {
  // ... existing functions ...

  async getPriorityStats(userId: string) {
    const { data, error } = await supabase
      .from('match')
      .select('priority_round, priority_winner, fencer_1_name, fencer_2_name')
      .eq('user_id', userId)
      .eq('priority_round', true)
      .eq('is_complete', true);

    if (error) throw error;

    const totalPriorityRounds = data.length;
    const priorityWins = data.filter(m => m.priority_winner === m.fencer_1_name).length;
    const priorityLosses = data.filter(m => m.priority_winner === m.fencer_2_name).length;
    const priorityWinRate = totalPriorityRounds > 0 ? (priorityWins / totalPriorityRounds) * 100 : 0;

    return {
      totalPriorityRounds,
      priorityWins,
      priorityLosses,
      priorityWinRate: Math.round(priorityWinRate * 100) / 100
    };
  },

  async getPriorityPerformanceOverTime(userId: string, days: number = 30) {
    const { data, error } = await supabase
      .from('match')
      .select('event_date, priority_winner, fencer_1_name, fencer_2_name')
      .eq('user_id', userId)
      .eq('priority_round', true)
      .eq('is_complete', true)
      .gte('event_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('event_date', { ascending: false });

    if (error) throw error;

    return data.map(match => ({
      date: match.event_date,
      priorityWon: match.priority_winner === match.fencer_1_name
    }));
  },

  async getPriorityDurationStats(userId: string) {
    const { data, error } = await supabase
      .from('match')
      .select('priority_duration_seconds')
      .eq('user_id', userId)
      .eq('priority_round', true)
      .not('priority_duration_seconds', 'is', null)
      .eq('is_complete', true);

    if (error) throw error;

    const durations = data.map(m => m.priority_duration_seconds);
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

### **UI Components**

```typescript
// In components/PriorityStatsCard.tsx

export const PriorityStatsCard = () => {
  const [priorityStats, setPriorityStats] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      matchService.getPriorityStats(user.id).then(setPriorityStats);
    }
  }, [user]);

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

## 📈 **Analytics Dashboard Features**

With these queries, you can build:

### **Priority Performance Dashboard**
- Total priority rounds played
- Priority win/loss record
- Priority win rate percentage
- Priority performance over time (chart)
- Average priority round duration
- Priority performance vs specific opponents

### **Profile Page Integration**
```typescript
// Add to profile page
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Priority Round Performance</Text>
  <PriorityStatsCard />
</View>
```

### **Match History Enhancement**
- Show priority round indicator in match list
- Display priority winner in match details
- Filter matches by priority rounds

---

## 🎯 **Benefits of This Approach**

✅ **Complete Priority Analytics** - Track all priority round data  
✅ **Performance Insights** - See priority win/loss patterns  
✅ **Opponent Analysis** - Priority performance vs specific opponents  
✅ **Time Analysis** - How long priority rounds typically last  
✅ **Trend Analysis** - Priority performance over time  
✅ **Profile Enhancement** - Rich priority statistics for users  

---

## 🚀 **Implementation Priority**

1. **Add database columns** (priority_round, priority_winner, etc.)
2. **Update match completion** to set priority data
3. **Create analytics queries** in database service
4. **Build UI components** for priority stats
5. **Integrate into profile** and match history pages

This gives you comprehensive priority round analytics that users will find valuable for understanding their performance in high-pressure situations!


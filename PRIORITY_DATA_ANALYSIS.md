# Priority Data Structure Analysis - Existing vs Proposed

## 🔍 **Current Database Structure Analysis**

### **Existing Priority Fields**

#### **1. Match Table**
```typescript
// Line 14 in types/database.ts
priority_assigned?: string;  // ❓ This exists but seems unused
```

#### **2. Match Period Table** 
```typescript
// Lines 150-151 in types/database.ts
priority_assigned?: string;  // ✅ Currently used
priority_to?: string;       // ✅ Currently used
```

#### **3. Match Event Table**
```typescript
// Lines 124-138 in types/database.ts
export interface MatchEvent {
  match_event_id: string;
  match_period_id?: string;
  fencing_remote_id?: string;
  match_id?: string;
  event_time?: string;
  event_type?: string;        // ✅ Could track "priority_assigned", "priority_winner"
  scoring_user_id?: string | null;
  scoring_user_name?: string;
  card_given?: string | null;
  score_diff?: number | null;
  seconds_since_last_event?: number;
  fencer_1_name?: string;
  fencer_2_name?: string;
}
```

---

## 📊 **How Current Priority Fields Are Used**

### **In Remote Screen (app/(tabs)/remote.tsx)**

```typescript
// Lines 806-807: When creating/updating match periods
priority_assigned: priorityFencer || undefined,  // 'alice' or 'bob'
priority_to: priorityFencer === 'alice' ? fencerNames.alice : priorityFencer === 'bob' ? fencerNames.bob : undefined,
```

**Current Usage**:
- `priority_assigned`: Stores 'alice' or 'bob' (which fencer has priority)
- `priority_to`: Stores the actual fencer name (e.g., "John Smith")

**What's Missing**:
- ❌ No tracking of who WON the priority round
- ❌ No duration of priority round
- ❌ No indication if match went to priority at all

---

## 🎯 **Data Storage Options Analysis**

### **Option 1: Use Existing Match Period Fields (Recommended)**

**Pros**:
- ✅ **Already implemented** - No schema changes needed
- ✅ **Currently working** - Priority assignment is tracked
- ✅ **Period-based** - Priority is tied to specific periods
- ✅ **Simple queries** - Easy to find priority periods

**What we can track with existing fields**:
```sql
-- Find all priority rounds
SELECT * FROM match_period 
WHERE priority_assigned IS NOT NULL;

-- Count priority rounds per user
SELECT COUNT(*) FROM match_period mp
JOIN match m ON mp.match_id = m.match_id
WHERE mp.priority_assigned IS NOT NULL 
  AND m.user_id = 'user-id';

-- Priority assignment by fencer
SELECT 
  priority_assigned,
  priority_to,
  COUNT(*) as times_assigned
FROM match_period 
WHERE priority_assigned IS NOT NULL
GROUP BY priority_assigned, priority_to;
```

**Missing Data** (what we'd need to add):
- Priority winner (who won the priority round)
- Priority duration
- Priority round completion status

---

### **Option 2: Use Match Event Table (Most Detailed)**

**Pros**:
- ✅ **Most granular** - Every action is tracked
- ✅ **Timeline-based** - Exact timing of priority events
- ✅ **Extensible** - Can add any priority-related events
- ✅ **Already exists** - No schema changes needed

**What we can track**:
```sql
-- Priority assignment events
SELECT * FROM match_event 
WHERE event_type = 'priority_assigned';

-- Priority winner events  
SELECT * FROM match_event 
WHERE event_type = 'priority_winner';

-- Priority round duration (time between assignment and winner)
SELECT 
  assignment.event_time as priority_start,
  winner.event_time as priority_end,
  EXTRACT(EPOCH FROM (winner.event_time - assignment.event_time)) as duration_seconds
FROM match_event assignment
JOIN match_event winner ON assignment.match_id = winner.match_id
WHERE assignment.event_type = 'priority_assigned'
  AND winner.event_type = 'priority_winner';
```

**Implementation**:
```typescript
// When priority is assigned
await matchEventService.createMatchEvent({
  match_id: currentMatchPeriod.match_id,
  event_type: 'priority_assigned',
  event_time: new Date().toISOString(),
  fencer_1_name: fencerNames.alice,
  fencer_2_name: fencerNames.bob,
  // Could add: priority_fencer: priorityFencer
});

// When priority round is won
await matchEventService.createMatchEvent({
  match_id: currentMatchPeriod.match_id,
  event_type: 'priority_winner',
  event_time: new Date().toISOString(),
  scoring_user_name: winnerName,
  // Could add: priority_winner: winnerName
});
```

---

### **Option 3: Add New Columns (Most Structured)**

**Pros**:
- ✅ **Clean structure** - Dedicated priority fields
- ✅ **Easy queries** - Simple priority analytics
- ✅ **Future-proof** - Room for more priority data

**Cons**:
- ❌ **Schema changes** - Requires migration
- ❌ **More complex** - Additional fields to maintain

---

## 🎯 **Recommendation: Hybrid Approach**

### **Use Existing Match Period + Match Event**

**Why this is best**:
1. **Match Period** - Track priority assignment (already working)
2. **Match Event** - Track priority winner and timing
3. **No schema changes** - Use existing structure
4. **Complete data** - Get all priority information

### **Implementation Strategy**

#### **1. Keep Current Match Period Usage**
```typescript
// Continue using existing fields
priority_assigned: priorityFencer,  // 'alice' or 'bob'
priority_to: fencerName,           // Actual fencer name
```

#### **2. Add Match Events for Priority Winner**
```typescript
// When priority round is won
await matchEventService.createMatchEvent({
  match_id: currentMatchPeriod.match_id,
  event_type: 'priority_winner',
  event_time: new Date().toISOString(),
  scoring_user_name: winnerName,
  fencer_1_name: fencerNames.alice,
  fencer_2_name: fencerNames.bob,
});
```

#### **3. Analytics Queries**
```sql
-- Priority rounds with winners
SELECT 
  mp.match_id,
  mp.priority_assigned,
  mp.priority_to,
  me.scoring_user_name as priority_winner,
  me.event_time as priority_winner_time
FROM match_period mp
LEFT JOIN match_event me ON mp.match_id = me.match_id 
  AND me.event_type = 'priority_winner'
WHERE mp.priority_assigned IS NOT NULL;

-- Priority win/loss stats
SELECT 
  COUNT(*) as total_priority_rounds,
  SUM(CASE WHEN me.scoring_user_name = mp.priority_to THEN 1 ELSE 0 END) as priority_wins,
  SUM(CASE WHEN me.scoring_user_name != mp.priority_to THEN 1 ELSE 0 END) as priority_losses
FROM match_period mp
JOIN match_event me ON mp.match_id = me.match_id 
  AND me.event_type = 'priority_winner'
JOIN match m ON mp.match_id = m.match_id
WHERE mp.priority_assigned IS NOT NULL 
  AND m.user_id = 'user-id';
```

---

## 🔧 **What We Need to Add**

### **1. Priority Winner Tracking**
- Add `priority_winner` event to match_event table
- Track when priority round is completed

### **2. Priority Duration Calculation**
- Calculate time between priority assignment and winner
- Store in match_event or calculate on-demand

### **3. Priority Analytics Functions**
- Use existing match_period + match_event data
- No schema changes required

---

## ✅ **Final Recommendation**

**Use the existing structure** with these additions:

1. **Keep current match_period priority fields** (already working)
2. **Add priority_winner events** to match_event table
3. **Build analytics on existing data** (no schema changes)
4. **Calculate priority duration** from event timestamps

This gives you complete priority analytics without any database changes, using the existing robust event system that's already tracking all match actions.

**The match_event table is indeed the right place for detailed tracking** - it's designed for this kind of granular data!


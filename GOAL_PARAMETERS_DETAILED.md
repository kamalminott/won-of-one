# Goal Parameters - Complete Breakdown

## 📊 Database Schema

Each goal is stored with these fields:

```typescript
{
  goal_id: string           // Unique identifier
  user_id: string          // Who owns this goal
  category: string         // Goal type (e.g., "Total Matches Played")
  description: string      // User's notes/description
  target_value: number     // The goal target (e.g., 10 matches)
  unit: string            // Timeframe unit (e.g., "Month")
  deadline: string        // Calculated end date (e.g., "2025-11-11")
  current_value: number   // Current progress (e.g., 3 matches)
  is_completed: boolean   // Whether goal is achieved
  is_active: boolean      // Whether goal is still active
  tracking_mode: string   // Always "manual" currently
}
```

---

## 🎯 How Goal Parameters Work Together

### **Parameters Available in UI:**

1. **Goal Type** - What you're tracking
2. **Target Value** - The number you want to achieve
3. **Timeframe Number** - How many units of time (1, 2, 3, etc.)
4. **Timeframe Unit** - Day/Week/Month/Year
5. **Over Next X Matches** - (Only for specific goal types)
6. **Notes** - Your personal description

---

## 📝 Goal-by-Goal Parameter Breakdown

### 1️⃣ **Total Matches Played** 📊

**UI Parameters Shown:**
- ✅ Target Value
- ✅ Timeframe Number
- ✅ Timeframe Unit
- ❌ Over Next X Matches (NOT shown)

**How it works:**
```
User sets: "Play 10 matches in 1 Month"

Stored in database:
- category: "Total Matches Played"
- target_value: 10
- unit: "Month"
- deadline: "2025-11-11" (calculated as today + 1 month)
- current_value: 0 (starts at 0)

Tracking:
- Every match played adds +1 to current_value
- When current_value reaches 10, goal is marked complete
- Deadline is just a visual indicator - goal can continue past deadline
```

**Example Timeline:**
```
Day 1:  Set goal "Play 10 matches in 1 Month" → current_value: 0, deadline: Nov 11
Day 3:  Play match → current_value: 1
Day 5:  Play match → current_value: 2
...
Day 20: Play match → current_value: 10 → GOAL COMPLETE! ✓
```

**Important:**
- The "1 Month" timeframe is ONLY used to calculate the deadline date
- It does NOT limit which matches count (all matches count)
- If you reach 10 matches in 2 weeks, goal completes early
- If deadline passes and you're at 8 matches, goal continues tracking

---

### 2️⃣ **Wins** 🥇

**UI Parameters Shown:**
- ✅ Target Value
- ✅ Timeframe Number
- ✅ Timeframe Unit
- ❌ Over Next X Matches (NOT shown)

**How it works:**
```
User sets: "Win 5 matches in 2 Weeks"

Stored in database:
- category: "Wins"
- target_value: 5
- unit: "Week"
- deadline: "2025-10-25" (calculated as today + 2 weeks)
- current_value: 0

Tracking:
- Only WINS add +1 to current_value
- Losses do NOT increment counter
- When current_value reaches 5, goal is marked complete
```

**Example Timeline:**
```
Day 1:  Set goal "Win 5 matches in 2 Weeks" → current_value: 0, deadline: Oct 25
Day 2:  Win match → current_value: 1
Day 3:  Lose match → current_value: 1 (no change)
Day 4:  Win match → current_value: 2
Day 5:  Win match → current_value: 3
Day 6:  Lose match → current_value: 3 (no change)
Day 7:  Win match → current_value: 4
Day 8:  Win match → current_value: 5 → GOAL COMPLETE! ✓
```

**Important:**
- The "2 Weeks" is ONLY for the deadline calculation
- ALL wins count, regardless of when they happen
- Losses don't set you back, they just don't help

---

### 3️⃣ **Win Rate %** 📈

**UI Parameters Shown:**
- ✅ Target Value (percentage)
- ✅ Timeframe Number
- ✅ Timeframe Unit
- ✅ Over Next X Matches (SHOWN but NOT USED!)

**How it works:**
```
User sets: "Achieve 70% win rate over next 20 matches"

Stored in database:
- category: "Win Rate %"
- target_value: 70
- unit: "Month" (from timeframe)
- deadline: "2025-11-11"
- current_value: 0

Tracking (CURRENT IMPLEMENTATION):
- Calculates: (Total Wins / Total Matches) × 100
- Uses ALL matches in your history, not just next 20
- Updates after EVERY match (win or loss)
- Can go UP or DOWN

Formula:
current_value = Math.round((totalWins / totalMatches) × 100)
```

**Example Timeline:**
```
Starting state: 50 total matches, 30 wins = 60% win rate

Day 1:  Set goal "70% win rate over next 20 matches" → current_value: 60%
        (Note: The "20 matches" parameter is IGNORED in calculation!)

Day 2:  Win match → 51 total, 31 wins → current_value: 60.78% → 61%
Day 3:  Win match → 52 total, 32 wins → current_value: 61.54% → 62%
Day 4:  Lose match → 53 total, 32 wins → current_value: 60.38% → 60% (went down!)
Day 5:  Win match → 54 total, 33 wins → current_value: 61.11% → 61%
...
Eventually: current_value reaches 70% → GOAL COMPLETE! ✓
```

**⚠️ CRITICAL ISSUE:**
- The UI shows "over next 20 matches" field
- This value (20) is captured in the description
- But it is NOT stored in the database as a separate field
- The tracking logic COMPLETELY IGNORES IT
- It calculates win rate from ALL matches ever played

**What users THINK happens:**
"Track my win rate over the next 20 matches I play"

**What ACTUALLY happens:**
"Track my overall career win rate, which includes all 500 matches I've ever played"

**Why this is confusing:**
- User plays 20 matches with 18 wins (90%)
- But their overall career win rate only goes from 65% → 67%
- Goal seems "broken" because the 90% in recent matches doesn't show

---

### 4️⃣ **Points Scored** 🎯

**UI Parameters Shown:**
- ✅ Target Value
- ✅ Timeframe Number
- ✅ Timeframe Unit
- ✅ Over Next X Matches (SHOWN but NOT USED!)

**How it works:**
```
User sets: "Score 100 points in 1 Month"
OR
User sets: "Score 100 points over next 10 matches"

Stored in database:
- category: "Points Scored"
- target_value: 100
- unit: "Month"
- deadline: "2025-11-11"
- current_value: 0

Tracking:
- Adds YOUR score from each match to current_value
- current_value += yourFinalScore
- Does NOT limit to specific number of matches
```

**Example Timeline:**
```
Day 1:  Set goal "Score 100 points in 1 Month" → current_value: 0
Day 2:  Match (15-10) → current_value: 0 + 15 = 15
Day 3:  Match (12-15) → current_value: 15 + 12 = 27
Day 4:  Match (15-8) → current_value: 27 + 15 = 42
Day 5:  Match (15-13) → current_value: 42 + 15 = 57
Day 6:  Match (10-15) → current_value: 57 + 10 = 67
Day 7:  Match (15-9) → current_value: 67 + 15 = 82
Day 8:  Match (15-12) → current_value: 82 + 15 = 97
Day 9:  Match (15-11) → current_value: 97 + 15 = 112 → GOAL COMPLETE! ✓
```

**⚠️ ISSUE:**
- UI shows "Over Next X Matches" field
- Users might set "Score 100 points over next 10 matches"
- The "10 matches" limit is NOT enforced
- ALL matches contribute to the total
- So you might score 100 points over 20 matches, and goal completes anyway

---

### 5️⃣ **Point Differential** ➕

**UI Parameters Shown:**
- ✅ Target Value
- ✅ Timeframe Number
- ✅ Timeframe Unit
- ✅ Over Next X Matches (SHOWN but NOT USED!)

**How it works:**
```
User sets: "End +20 in point differential over 15 matches"

Stored in database:
- category: "Point Differential"
- target_value: 20
- unit: "Month"
- deadline: "2025-11-11"
- current_value: 0

Tracking:
- Adds (Your Score - Opponent Score) to current_value
- current_value += (yourScore - opponentScore)
- Can go negative!
- Does NOT limit to 15 matches
```

**Example Timeline:**
```
Day 1:  Set goal "End +20 differential" → current_value: 0
Day 2:  Win 15-10 → current_value: 0 + (15-10) = +5
Day 3:  Win 15-14 → current_value: 5 + (15-14) = +6
Day 4:  Lose 10-15 → current_value: 6 + (10-15) = +1 (went down!)
Day 5:  Win 15-8 → current_value: 1 + (15-8) = +8
Day 6:  Win 15-5 → current_value: 8 + (15-5) = +18
Day 7:  Win 15-12 → current_value: 18 + (15-12) = +21 → GOAL COMPLETE! ✓
```

**Can go negative:**
```
Day 1:  Set goal "End +15 differential" → current_value: 0
Day 2:  Lose 8-15 → current_value: 0 + (8-15) = -7
Day 3:  Lose 10-15 → current_value: -7 + (10-15) = -12
Day 4:  Win 15-10 → current_value: -12 + (15-10) = -7
Day 5:  Win 15-5 → current_value: -7 + (15-5) = +3
(need to climb back to +15)
```

**⚠️ ISSUES:**
- "Over Next X Matches" is shown but not enforced
- Negative differential is confusing (progress shows as negative percentage)
- Users might not understand they need to "dig out" of negative

---

### 6️⃣ **Streaks** 🔥

**UI Parameters Shown:**
- ✅ Target Value
- ❌ Timeframe Number (NOT shown - makes sense)
- ❌ Timeframe Unit (NOT shown - makes sense)
- ✅ "Matches in a row" (hardcoded in description)

**How it works:**
```
User sets: "Win 5 matches in a row"

Stored in database:
- category: "Streaks"
- target_value: 5
- unit: "Month" (may still be set but ignored)
- deadline: calculated but not really relevant
- current_value: 0

Tracking:
- Counts backwards from most recent match
- Stops at first loss encountered
- Recalculates ENTIRE streak on every match
- One loss resets to 0
```

**Example Timeline:**
```
Starting state: [W, W, L, W, W] → current streak: 2 (last 2 wins)

Day 1:  Set goal "Win 5 in a row" → current_value: 2
Day 2:  Win → [W, W, L, W, W, W] → current_value: 3
Day 3:  Win → [W, W, L, W, W, W, W] → current_value: 4
Day 4:  Win → [W, W, L, W, W, W, W, W] → current_value: 5 → GOAL COMPLETE! ✓
Day 5:  Lose → [W, W, L, W, W, W, W, W, L] → current_value: 0 (RESET!)
Day 6:  Win → [W, W, L, W, W, W, W, W, L, W] → current_value: 1 (starting over)
```

**Important:**
- This is CURRENT streak, not best streak
- Very fragile - one loss wipes everything
- No timeframe applies (it's about consecutive wins)

---

## 🎯 Summary: What's Stored vs. What's Tracked

| Goal Type | Target Value | Timeframe | Over X Matches | What Actually Matters |
|-----------|-------------|-----------|----------------|----------------------|
| Total Matches | ✅ Used | ⚠️ Deadline only | ❌ Not available | Target Value |
| Wins | ✅ Used | ⚠️ Deadline only | ❌ Not available | Target Value |
| Win Rate % | ✅ Used | ⚠️ Deadline only | ⚠️ IGNORED | Target %, ALL history |
| Points Scored | ✅ Used | ⚠️ Deadline only | ⚠️ IGNORED | Target Value |
| Point Differential | ✅ Used | ⚠️ Deadline only | ⚠️ IGNORED | Target Value |
| Streaks | ✅ Used | ❌ Not shown | ❌ Not available | Target Value |

---

## 🔍 How "Over Next X Matches" SHOULD Work vs. How It DOES Work

### **What Users See in UI:**

For Win Rate %, Points Scored, Point Differential:
```
Goal Type: Win Rate %
Target Value: 70
Timeframe: 1 Month
Over Next X Matches: 20

Description shows: "Achieve 70% win rate over next 20 matches"
```

### **What Gets Stored:**

```javascript
{
  category: "Win Rate %",
  target_value: 70,
  unit: "Month",
  deadline: "2025-11-11",
  description: "Achieve 70% win rate over next 20 matches",
  current_value: 0
}
```

The "20 matches" is ONLY in the text description!
It's not stored as a separate field like `match_window: 20`

### **What Happens During Tracking:**

```javascript
case 'Win Rate %':
  // Gets ALL matches from database (ignores the "20" completely)
  const allMatches = await matchService.getRecentMatches(userId, 1000);
  const winRate = Math.round((totalWins / totalMatches) × 100);
  newCurrentValue = winRate; // This is career win rate
```

**The tracking code has NO IDEA about the "20 matches" window!**

---

## ⚠️ Critical Problems

### **Problem 1: Misleading "Over Next X Matches" Field**

**Impact:** High - Users are confused why their goals aren't tracking correctly

**Example:**
- User sets "70% win rate over next 20 matches"
- User starts at 60% overall (from 100 career matches)
- User wins 18 out of next 20 matches (90%!)
- Current value only shows 64% (because career is now 118/120 = 64%)
- User thinks the app is broken

**Root Cause:**
- UI collects the "X matches" value
- UI puts it in the description text
- Database doesn't have a field for it
- Tracking logic never uses it

### **Problem 2: Timeframe is Just a Deadline**

**Impact:** Medium - Users might think timeframe filters matches

**Example:**
- User sets "Play 10 matches in 1 Month"
- User thinks only matches in next month count
- Actually ALL matches count, forever
- If they play 10 matches in 2 months, goal still completes

**Root Cause:**
- Timeframe only calculates deadline date
- No filtering by date in tracking logic
- Goals continue tracking past deadline

### **Problem 3: No Rolling Window Implementation**

**Impact:** High - Missing expected functionality

**What's Missing:**
- No way to track "last N matches"
- No way to track "matches in date range"
- No way to track "recent performance vs. career average"

---

## 💡 Recommendations

### **Option 1: Remove "Over Next X Matches" Field**

**Change:**
- Remove the field from UI for Win Rate %, Points Scored, Point Differential
- Update descriptions to say "overall" or "career"
- Make it clear it's tracking all-time stats

**Example:**
- Old: "Achieve 70% win rate over next 20 matches"
- New: "Achieve 70% overall win rate"

**Pros:**
- Honest about what's being tracked
- No code changes needed
- Removes user confusion

**Cons:**
- Less flexible goal setting
- Users can't set scoped goals

### **Option 2: Implement Rolling Window Tracking**

**Change:**
- Add `match_window` field to database
- Store "20" in this field
- Modify tracking logic to only look at last N matches
- Add `starting_match_count` to know when goal started

**New Schema:**
```typescript
{
  ...existing fields,
  match_window: number,     // e.g., 20
  starting_match_count: number, // Total matches when goal created
}
```

**New Tracking:**
```javascript
case 'Win Rate %':
  const matchesSinceStart = allMatches.filter(m => 
    m.matchNumber > goal.starting_match_count
  );
  const relevantMatches = matchesSinceStart.slice(0, goal.match_window);
  const winRate = (relevant Matches.filter(m => m.isWin).length / relevantMatches.length) × 100;
```

**Pros:**
- Matches user expectations
- More meaningful goals
- Can track improvement over time

**Cons:**
- Requires database schema change
- Requires tracking logic overhaul
- More complex to implement

### **Option 3: Hybrid Approach**

**Change:**
- Keep current "overall" tracking for Win Rate %
- Implement rolling window for Points and Differential only
- Make UI clear about which is which

**Why:**
- Win rate is naturally an overall stat
- Points and differential make more sense as windowed goals
- Less complex than full overhaul

---

## 📊 Data Flow Diagram

```
USER ACTION: Set Goal
    ↓
UI FORM: Collects parameters
    - Goal Type
    - Target Value  
    - Timeframe Number
    - Timeframe Unit
    - Over Next X Matches (for some goals)
    - Notes
    ↓
CALCULATION: calculateDeadline()
    deadline = now + (timeframe_number × timeframe_unit)
    ↓
DATABASE: Insert goal
    {
      category: goal_type,
      target_value: number,
      unit: timeframe_unit,
      deadline: calculated_date,
      description: auto-generated_text,
      current_value: 0
    }
    ↓
USER PLAYS MATCH
    ↓
MATCH COMPLETES
    ↓
TRIGGER: updateGoalsAfterMatch()
    ↓
FETCH: Get all active goals
FETCH: Get all user matches (for context)
    ↓
FOR EACH GOAL:
    Switch on category:
        case 'Total Matches': +1
        case 'Wins': +1 if win
        case 'Win Rate %': recalculate from ALL matches
        case 'Points': +yourScore
        case 'Differential': +(yourScore - oppScore)
        case 'Streaks': recalculate current streak
    ↓
UPDATE: goal.current_value
CHECK: if current_value >= target_value
    ↓
MARK: is_completed = true
    ↓
UI: Shows updated progress
```

---

## 🧪 Testing Scenarios

### Test 1: Total Matches with Deadline
```
1. Set goal: "Play 10 matches in 1 Week"
2. Wait 2 weeks (let deadline pass)
3. Play 10 matches
4. ✅ Goal should complete (deadline doesn't prevent completion)
```

### Test 2: Win Rate Confusion
```
1. Start with 100 career matches, 50 wins (50%)
2. Set goal: "70% win rate over next 20 matches"
3. Win next 18 out of 20 matches (90% in window)
4. Check current_value
5. ❌ Shows ~57% (68/118) not 90%
6. This confuses users!
```

### Test 3: Points "Over Next X Matches" Ignored
```
1. Set goal: "Score 100 points over next 10 matches"
2. Play 20 matches averaging 6 points each
3. After match 17, reach 102 total points
4. ✅ Goal completes (but should have completed at match 10!)
5. The "10 matches" was ignored
```

### Test 4: Negative Differential
```
1. Set goal: "+15 point differential"
2. Lose 5-15 (differential: -10)
3. Lose 8-15 (differential: -17)
4. Win 15-5 (differential: -7)
5. Progress shows negative - confusing UI
```



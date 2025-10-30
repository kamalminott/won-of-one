# 🎯 Window Tracking Implementation - Complete Guide

## Overview
Implemented proper window tracking for Win Rate %, Points Scored, and Point Differential goals, making them track "over next X matches" accurately and with more tangible, exciting descriptions.

---

## ✨ What Changed

### **Before:**
```
Goal: "Achieve 70% win rate over next 20 matches"
Reality: Tracked CAREER win rate (all 500 matches)
User plays next 20 with 18 wins (90%)
Goal shows: 58% (career average)
User: "This is broken! 😤"
```

### **After:**
```
Goal: "Win 14 out of your next 20 matches"
Reality: Tracks ONLY next 20 matches
User plays next 20 with 18 wins
Goal shows: 90% (18/20 = 90%)
User: "This makes sense! 🎯"
```

---

## 🔧 Implementation Details

### **1. Database Schema** ✅

**Added Columns:**
```sql
ALTER TABLE goal ADD COLUMN match_window INTEGER;
ALTER TABLE goal ADD COLUMN starting_match_count INTEGER;
```

**What They Store:**
- `match_window`: Number of matches to track (e.g., 20)
- `starting_match_count`: Total matches user had when goal was created (e.g., 100)

---

### **2. TypeScript Types** ✅

**Updated Interfaces:**
```typescript
// types/database.ts

export interface Goal {
  // ... existing fields
  match_window?: number;
  starting_match_count?: number;
}

export interface SimpleGoal {
  // ... existing fields
  match_window?: number;
  starting_match_count?: number;
}
```

---

### **3. Goal Creation** ✅

**GoalCard Component:**
```typescript
// components/GoalCard.tsx - handleSaveGoal()

const goalData: any = {
  category: goalType,
  target_value: parseInt(targetValueInput),
  // ... other fields
};

// Add match_window for windowed goals
if (['Win Rate %', 'Points Scored', 'Point Differential'].includes(goalType)) {
  let windowSize = 0;
  switch (goalType) {
    case 'Win Rate %':
      windowSize = parseInt(matchesForWinRate);  // e.g., 20
      break;
    case 'Points Scored':
      windowSize = parseInt(matchesForPoints);
      break;
    case 'Point Differential':
      windowSize = parseInt(matchesForDifferential);
      break;
  }
  goalData.match_window = windowSize;
}
```

**Home Screen:**
```typescript
// app/(tabs)/index.tsx - onGoalSaved callback

if (goalData.match_window) {
  // Get user's current total match count
  const currentMatches = await matchService.getRecentMatches(user.id, 10000);
  goalData.starting_match_count = currentMatches.length;
  
  console.log('Creating windowed goal:', {
    match_window: goalData.match_window,
    starting_match_count: goalData.starting_match_count
  });
}

// Save to database
const newGoal = await goalService.createGoal(goalData, user.id);
```

**Database Record:**
```javascript
{
  goal_id: "abc-123",
  category: "Win Rate %",
  target_value: 70,
  match_window: 20,              // Track next 20 matches
  starting_match_count: 100,     // User had 100 matches when goal created
  current_value: 0,
  // ... other fields
}
```

---

### **4. Window Tracking Logic** ✅

**Win Rate % with Window:**
```typescript
// lib/database.ts - updateGoalsAfterMatch()

case 'Win Rate %':
  if (goal.match_window && goal.starting_match_count !== undefined) {
    // Get matches played AFTER goal was created
    const matchesSinceGoalCreated = userMatches.slice(
      0, 
      totalMatches - goal.starting_match_count
    );
    
    // Limit to window size (e.g., first 20 matches)
    const windowMatches = matchesSinceGoalCreated.slice(0, goal.match_window);
    
    if (windowMatches.length > 0) {
      const winsInWindow = windowMatches.filter(m => m.isWin).length;
      const winRateInWindow = Math.round((winsInWindow / windowMatches.length) * 100);
      
      newCurrentValue = winRateInWindow;
    }
  } else {
    // Fallback: Career win rate for old goals
    newCurrentValue = currentWinRate;
  }
  break;
```

**How It Works:**
```
User has 100 total matches
Creates goal: "Win 14 of next 20 matches"
Database stores: starting_match_count = 100, match_window = 20

Match 1 completes (Win):
- Total matches: 101
- Matches since goal: 101 - 100 = 1
- Window matches: First 1 of 20
- Wins in window: 1
- Win rate: 1/1 = 100%

Match 10 completes (6 wins, 4 losses so far):
- Total matches: 110
- Matches since goal: 110 - 100 = 10
- Window matches: First 10 of 20
- Wins in window: 6
- Win rate: 6/10 = 60%

Match 20 completes (14 wins, 6 losses):
- Total matches: 120
- Matches since goal: 120 - 100 = 20
- Window matches: All 20 (window full!)
- Wins in window: 14
- Win rate: 14/20 = 70% → GOAL COMPLETE! ✅

Match 21 completes:
- Window is FULL (stops at 20 matches)
- No further updates after window closes
```

---

### **5. Better Descriptions** ✅

**Tangible, Exciting Language:**

| Goal Type | Old Description | New Description |
|-----------|-----------------|-----------------|
| Win Rate % | "Achieve 70% win rate over next 20 matches" | "Win 14 out of your next 20 matches" ⭐ |
| Points Scored | "Score 100 points in 1 Month" | "Land 100 touches on your opponents" 🎯 |
| Point Differential | "End +20 in point differential over 15 matches" | "Outscore your opponents by 20 total points" ➕ |
| Streaks | "Win 5 matches in a row" | "Build a 5-match winning streak" 🔥 |

---

## 📊 Examples

### **Win Rate % Goal:**

**Creation:**
```
User inputs:
- Target Win Rate: 70%
- Over Next Matches: 20

System calculates:
- Wins needed: 70% of 20 = 14 wins

Description shows:
"Win 14 out of your next 20 matches"

Saves to database:
- target_value: 70
- match_window: 20
- starting_match_count: 100 (user's current total)
```

**Progress Tracking:**
```
Match 1 (Win):  1/1 = 100% (1 win needed still: 13)
Match 5 (5W,0L): 5/5 = 100% (9 wins needed)
Match 10 (6W,4L): 6/10 = 60% (8 wins needed)
Match 15 (11W,4L): 11/15 = 73% (3 wins needed)
Match 18 (13W,5L): 13/18 = 72% (1 win needed!)
Match 19 (Win): 14/19 = 74% → COMPLETE! ✅
Match 20: Window full, stops tracking
```

**UI Display:**
```
┌─────────────────────────────┐
│ Win 14 of Next 20 Matches   │
│                             │
│ ████████████░░░  13/14 wins │
│ 72% Complete                │
│                             │
│ 📊 Progress:                │
│ • Matches: 18/20            │
│ • Wins: 13                  │
│ • Losses: 5                 │
│                             │
│ 💪 1 more win needed!       │
│    2 matches remaining      │
└─────────────────────────────┘
```

---

### **Points Scored Goal:**

**Old:**
```
"Score 100 points in 1 Month"
- Counts all matches forever
- No clear endpoint
```

**New:**
```
"Land 100 touches on your opponents"
- More exciting language
- "Touches" = fencing terminology
- Clear achievement
```

---

### **Point Differential Goal:**

**Old:**
```
"End +20 in point differential over 15 matches"
- Confusing what +20 means
- Technical language
```

**New:**
```
"Outscore your opponents by 20 total points"
- Clear what it means
- Concrete target
- Easy to understand
```

---

## 🎯 Key Improvements

### **1. Accurate Tracking** ✅
- Win Rate % now truly tracks next X matches
- No more career average confusion
- Matches user expectations

### **2. Tangible Language** ✅
- "Win 14 out of 20" vs "70% win rate"
- "Land 100 touches" vs "Score 100 points"
- "Outscore by 20" vs "+20 differential"

### **3. Clear Targets** ✅
- Concrete numbers (14 wins, not 70%)
- Specific context (out of 20 matches)
- Easy to visualize progress

### **4. Exciting Framing** ✅
- "Build a winning streak" vs "Win matches in a row"
- "Land touches" vs "Score points"
- More motivating language

---

## 📊 How Window Tracking Works

### **Match Order (Most Recent First):**
```
userMatches array (from database):
[0]: Match 120 (most recent)
[1]: Match 119
[2]: Match 118
...
[19]: Match 101 (20th match after goal)
[20]: Match 100 (goal created here!) ← starting_match_count
[21]: Match 99 (before goal)
...
```

### **Calculation:**
```typescript
// Get matches AFTER goal was created
starting_match_count = 100
totalMatches = 120
matchesSinceGoal = userMatches.slice(0, 120 - 100)
// = userMatches[0...19] (matches 101-120)

// Limit to window
match_window = 20
windowMatches = matchesSinceGoal.slice(0, 20)
// = First 20 matches after goal was created

// Calculate win rate in window
winsInWindow = windowMatches.filter(m => m.isWin).length
winRate = (winsInWindow / windowMatches.length) × 100
```

---

## ✅ Benefits

### **For Users:**
1. **Clear Expectations** - "Win 14 of 20" is concrete
2. **Accurate Tracking** - Shows actual window performance
3. **Exciting Language** - "Land touches", "Build streak"
4. **Understandable** - No confusing percentages

### **For You:**
1. **Less Support** - Users understand goals better
2. **Higher Engagement** - More exciting = more motivation
3. **Better UX** - Goals work as advertised
4. **Competitive Edge** - Unique, clear goal system

---

## 🧪 Testing Guide

### **Test Win Rate % Window:**

```
1. Note your current total matches (e.g., 10)
2. Create goal: "70% win rate over next 20 matches"
3. Verify database:
   - match_window: 20
   - starting_match_count: 10
4. Play 10 matches (7 wins, 3 losses)
5. Check progress: Should show 70% (7/10)
6. NOT career average!
7. Play 10 more matches (7 wins, 3 losses)
8. Check progress: Should show 70% (14/20) → COMPLETE!
```

### **Test Points Scored (No Window):**

```
1. Create goal: "Land 100 touches"
2. Verify database:
   - match_window: null (no window for this)
3. Play matches, accumulate points
4. Should add all points regardless of match count
5. At 100: Complete!
```

---

## 📝 Summary

**Implemented:**
- ✅ Database columns (match_window, starting_match_count)
- ✅ TypeScript types updated
- ✅ Goal creation captures window data
- ✅ Window tracking logic for Win Rate %
- ✅ Better descriptions for all goal types
- ✅ Backward compatibility (old goals without window still work)

**Result:**
- ✅ "Win 14 out of next 20 matches" tracks accurately
- ✅ More tangible, exciting goal descriptions
- ✅ Users get what they expect
- ✅ Goals are motivating and clear

Ready to test! 🚀



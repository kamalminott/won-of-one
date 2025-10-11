# Goal Tracking System - Detailed Breakdown

## Overview
The goal tracking system automatically updates goal progress after each match completion. Each goal type has specific tracking logic that measures different aspects of a user's fencing performance.

---

## 🎯 Goal Types and Measurement Details

### 1. **Total Matches Played** 📊

**What it measures:**
- Every single match that is completed (win, loss, or draw)
- Increments by exactly 1 for each match

**Tracking Logic:**
```javascript
case 'Total Matches Played':
  newCurrentValue = goal.currentValue + 1;
```

**Example:**
- User sets goal: "Play 10 matches in 1 Month"
- Starting value: 0
- After 1st match: 1
- After 2nd match: 2
- ...continues until goal is reached

**Use Case:**
- Perfect for users wanting to increase their match activity
- Measures consistency and commitment
- Tracks ALL matches regardless of outcome

---

### 2. **Wins** 🥇

**What it measures:**
- Only matches where the user wins (your score > opponent score)
- Does NOT increment on losses or draws

**Tracking Logic:**
```javascript
case 'Wins':
  if (matchResult === 'win') {
    newCurrentValue = goal.currentValue + 1;
  } else {
    // No update for losses
  }
```

**Example:**
- User sets goal: "Win 5 matches in 1 Month"
- Starting value: 0
- Match 1 (Win 15-10): 1
- Match 2 (Loss 10-15): Still 1 (no change)
- Match 3 (Win 15-12): 2
- ...continues counting only wins

**Use Case:**
- For users focusing on winning performance
- Tracks competitive success
- Ignores losses completely

---

### 3. **Win Rate %** 📈

**What it measures:**
- Your overall win percentage across ALL matches in your history
- Calculated as: (Total Wins / Total Matches) × 100
- Updates after EVERY match (win or loss affects the percentage)

**Tracking Logic:**
```javascript
case 'Win Rate %':
  // Get ALL user matches
  const totalMatches = userMatches.length;
  const totalWins = userMatches.filter(m => m.isWin).length;
  const currentWinRate = Math.round((totalWins / totalMatches) * 100);
  newCurrentValue = currentWinRate;
```

**Example:**
- User sets goal: "Achieve 70% win rate"
- Starting: 10 total matches, 6 wins = 60%
- After Win (11 matches, 7 wins): 63.6% → 64%
- After Loss (12 matches, 7 wins): 58.3% → 58%
- After Win (13 matches, 8 wins): 61.5% → 62%

**Important Notes:**
- This is NOT "win X out of next Y matches"
- This tracks your OVERALL career win rate
- Can go DOWN if you lose matches
- Automatically recalculated from scratch each time

**Use Case:**
- For competitive fencers tracking overall performance
- Shows improvement trend over time
- Reflects true competitive ability

---

### 4. **Points Scored** 🎯

**What it measures:**
- Total cumulative points (touches) scored across all matches
- Adds your final score from each match
- ONLY counts YOUR points, not opponent's points

**Tracking Logic:**
```javascript
case 'Points Scored':
  newCurrentValue = goal.currentValue + finalScore;
```

**Example:**
- User sets goal: "Score 100 points in 1 Month"
- Starting value: 0
- Match 1 (15-10): 15 points
- Match 2 (12-15): 27 points total (15 + 12)
- Match 3 (15-8): 42 points total (15 + 12 + 15)
- ...continues accumulating

**Use Case:**
- Measures offensive productivity
- Encourages aggressive play
- Good for tracking scoring improvement
- Useful for training camps or intensive periods

---

### 5. **Point Differential** ➕

**What it measures:**
- Cumulative sum of (Your Score - Opponent Score) across all matches
- Can be positive (winning by more) or negative (losing by more)
- Shows dominance/competitiveness in matches

**Tracking Logic:**
```javascript
case 'Point Differential':
  const pointDifferential = finalScore - opponentScore;
  newCurrentValue = goal.currentValue + pointDifferential;
```

**Example:**
- User sets goal: "End +20 in point differential"
- Starting value: 0
- Match 1 (15-10): +5 differential
- Match 2 (12-15): +2 total (+5 + (-3))
- Match 3 (15-8): +9 total (+5 + (-3) + (+7))
- Match 4 (10-15): +4 total (+5 + (-3) + (+7) + (-5))

**Important Notes:**
- This CAN go negative if you lose by large margins
- Winning 15-14 adds +1, winning 15-5 adds +10
- Losing 10-15 adds -5 to your total
- Reflects not just winning, but HOW MUCH you win by

**Use Case:**
- Measures dominance in victories
- Tracks competitive margin
- Good for advanced fencers wanting to win convincingly
- Shows improvement in match control

---

### 6. **Streaks** 🔥

**What it measures:**
- Current consecutive wins (resets to 0 on any loss)
- Recalculated from your entire match history each time
- Shows your CURRENT streak, not best streak

**Tracking Logic:**
```javascript
case 'Streaks':
  let currentStreak = 0;
  // Start from most recent match and count backwards
  for (let i = userMatches.length - 1; i >= 0; i--) {
    if (userMatches[i].isWin) {
      currentStreak++;
    } else {
      break; // Stop at first loss
    }
  }
  newCurrentValue = currentStreak;
```

**Example:**
- User sets goal: "Achieve 5 match win streak"
- Starting matches: [W, W, L, W, W, W]
- Current streak: 3 (last 3 matches)
- After Win: 4 (last 4 matches)
- After Win: 5 (GOAL ACHIEVED!)
- After Loss: 0 (streak broken, resets)
- After Win: 1 (new streak starting)

**Important Notes:**
- ONE loss resets the entire streak to 0
- Counts only consecutive wins from most recent backwards
- Does NOT track "best streak ever" (only current)
- Updates after every match

**Use Case:**
- For momentum-focused training
- Encourages consistency
- Psychological motivation
- Fun competitive element

---

## 🔄 When Goals Are Updated

Goals are automatically updated in these scenarios:

1. **After completing a match via Fencing Remote**
   - Called in `remote.tsx` after match completion
   - Updates all active goals based on match result

2. **After completing a manual match entry**
   - Should be called after manual match is saved (may need implementation)

3. **Real-time calculation**
   - Win Rate % is recalculated from scratch each time
   - Streaks are recalculated from match history each time
   - Others are incremental (add to previous value)

---

## 📊 Progress Calculation

For all goals, progress percentage is calculated as:

```javascript
progress = Math.round((currentValue / targetValue) * 100)
```

**Example:**
- Target: 10 matches
- Current: 7 matches
- Progress: (7 / 10) × 100 = 70%

---

## ⚠️ Important Considerations

### 1. **Win Rate % Scope**
- Currently measures LIFETIME win rate (all matches ever)
- NOT "win X% of next Y matches"
- Cannot be scoped to a specific number of matches
- **Recommendation:** Consider adding "over next X matches" tracking

### 2. **Point Differential Can Go Negative**
- Users can set positive goals but have negative differential
- Example: Target +20, but currently at -10
- Progress would show as -50% (mathematically correct but confusing)
- **Recommendation:** Consider UI handling for negative values

### 3. **Streaks Are Fragile**
- One loss resets everything
- Can be demotivating if user loses after long streak
- **Recommendation:** Consider adding "best streak" tracking alongside current

### 4. **Manual Matches**
- Currently only remote matches trigger goal updates
- Manual match entry needs goal update integration
- **Action Required:** Add goal update call after manual match save

### 5. **Historical Data**
- Some goals (Win Rate, Streaks) depend on full match history
- Deleting old matches could affect these calculations
- **Recommendation:** Consider this in delete functionality

---

## 🛠️ Potential Improvements

1. **Scoped Win Rate:**
   - "Achieve 70% win rate over next 20 matches"
   - Would need to track a rolling window of matches
   - More meaningful for short-term goals

2. **Best Streak Tracking:**
   - Track both current and best streak
   - Don't lose motivation when streak breaks

3. **Time-based Goals:**
   - "Score 100 points in March"
   - Would need date-range filtering in calculations

4. **Opponent-specific Goals:**
   - "Beat John 3 times"
   - Would need opponent tracking

5. **Negative Differential Handling:**
   - Better UI for when users are below zero
   - Maybe show "X points behind goal"

---

## 🧪 Testing Recommendations

For each goal type, test:

1. **Normal progression:** Goal goes from 0 → target
2. **Edge cases:** 
   - Win Rate with 1 match (100% or 0%)
   - Streak broken immediately (0)
   - Point Differential going negative
3. **Multiple goals:** 2+ active goals update correctly
4. **Completion:** Goal marked complete when reached
5. **Manual matches:** Ensure they trigger updates

---

## 📝 Summary Table

| Goal Type | Increments On | Calculation Method | Can Decrease? | Depends On History? |
|-----------|---------------|-------------------|---------------|---------------------|
| Total Matches | Every match | Incremental (+1) | No | No |
| Wins | Only wins | Incremental (+1) | No | No |
| Win Rate % | Every match | Recalculated | Yes | Yes (all matches) |
| Points Scored | Every match | Incremental (+score) | No | No |
| Point Differential | Every match | Incremental (+/- diff) | Yes | No |
| Streaks | Every match | Recalculated | Yes | Yes (recent matches) |



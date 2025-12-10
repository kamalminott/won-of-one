# Sabre Fencing Remote Implementation Planning

## Overview
This document outlines the specific implementation requirements for the Sabre fencing remote, which is designed as a **practical club/training implementation** rather than a strict rules engine. Sabre mode intentionally ignores official bout timing and priority rules because they are almost never used in real sabre fencing practice.

**Key Design Principles:**
- **Score-only**: No timer, no time limits, no elapsed time tracking
- **Open-ended scoring**: No fixed target score enforcement; users can score beyond 15 if desired
- **Break at 8**: Single mid-bout break offered once when any fencer first reaches 8 points
- **Manual completion**: Match ends only when user presses "Complete Match" button
- **Fast and simple**: Streamlined for practical training use

---

## Key Differences: Sabre vs Foil/Epee

| Feature | Foil/Epee | Sabre |
|---------|-----------|-------|
| **Timer** | Countdown timer (3:00 → 0:00) | **NO TIMER** - Removed by design |
| **Time Tracking** | Essential (countdown, elapsed time) | **NOT TRACKED** - No time calculations |
| **Match Start** | Play button starts timer | Match starts when first score is recorded |
| **Break Trigger** | Timer reaches 0:00 at end of period | Score reaches 8 points (offered once) |
| **Period Advancement** | Time-based (timer hits 0:00) | Score-based (break at 8, then Period 2) |
| **Period Structure** | 3 periods (1/3, 2/3, 3/3) | 2 phases (Period 1: before break, Period 2: after break) |
| **Period Controls** | Manual +/- period buttons | **NO PERIOD CONTROLS** - Auto-advances based on break |
| **Match Completion** | Auto-complete at target score OR timer | **MANUAL ONLY** - Complete Match button required |
| **Target Score** | Enforced (15 or 5) | **OPEN-ENDED** - No enforcement, scoring can continue past 15 |
| **Priority/Sudden Death** | Supported | **NOT IMPLEMENTED** - Out of scope by design |
| **Black Cards** | Supported | **NOT IN V1** - Extremely rare, record manually if needed |

---

## Sabre Remote Feature Table

### Complete Feature List

| Feature | Status | Description | Notes |
|---------|--------|-------------|-------|
| **Weapon Selection** | ✅ Included | Three weapon buttons (Foil/Epee/Sabre) | Visible before match starts |
| **Score Tracking** | ✅ Included | +/- buttons for each fencer | Primary feature, works identically |
| **Score Display** | ✅ Included | Large score numbers for each fencer | Prominent display, unchanged |
| **Fencer Names** | ✅ Included | Editable name fields for both fencers | Works identically |
| **Fencer Images** | ✅ Included | Profile images for fencers | Works identically |
| **Switch Fencers** | ✅ Included | Swap fencer positions button | Works identically |
| **Match Insights** | ✅ New | Real-time match insights (lead, momentum, break warning) | Replaces timer display area |
| **Period Controls** | ✅ Included | Manual +/- period buttons | Positioned below Match Insights |
| **Break Functionality** | ✅ Modified | Break at 8 points (offered once) | Score-triggered, independent of final score |
| **Break Timer** | ✅ Included | 1-minute break countdown | Still works, triggered by score |
| **Break Popup** | ✅ Included | "Take Break" / "Skip Break" options | Same UI, different trigger |
| **Yellow Cards** | ✅ Included | Issue yellow cards to fencers | Works identically |
| **Red Cards** | ✅ Included | Issue red cards to fencers | Works identically |
| **Injury Timer** | ✅ Included | 5-minute injury timer | Works identically |
| **Complete Match Button** | ✅ Included | Manual match completion | **REQUIRED** - Only way to end sabre match |
| **Reset All** | ✅ Included | Reset entire match state | Works identically |
| **Reset Scores** | ✅ Included | Reset scores only | Works identically |
| **User Profile Toggle** | ✅ Included | Show/hide user profile | Works identically |
| **Offline Support** | ✅ Included | Works without internet | No time dependencies = easier |
| **Match Summary Navigation** | ✅ Included | Navigate to match summary | Works identically |
| **Timer Display** | ❌ Removed | Countdown timer (3:00 → 0:00) | Replaced with Match Insights |
| **Play/Pause Button** | ❌ Removed | Start/pause match timer | Not needed (match starts on first score) |
| **Add/Subtract Time** | ❌ Removed | +/- time controls | No time to adjust |
| **Edit Time Button** | ❌ Removed | Edit match time duration | No time to edit |
| **Time Remaining Display** | ❌ Removed | Shows time left in period | Not applicable |
| **Target Score Selector** | ❌ Removed | UI to set target score (15 or 5) | Open-ended scoring, no target |
| **Priority Display** | ❌ Removed | Priority light and assignment | Not implemented for sabre |
| **Auto-Completion** | ❌ Removed | Auto-complete at target score | Manual completion only |
| **Black Cards** | ❌ Removed | Issue black cards | Not in v1 (extremely rare) |

### Feature Status Legend
- ✅ **Included**: Feature is present and works (may be modified)
- ✅ **Modified**: Feature exists but works differently for sabre
- ✅ **New**: New feature specific to sabre
- ❌ **Removed**: Feature not available for sabre

---

## Confirmed Requirements

### 1. Timer Display - REMOVED BY DESIGN
- **Decision**: No timer display, no time tracking, no elapsed time calculations
- **Reason**: Sabre is score-only by design; time is not used in practical club/training sabre
- **Implementation**: 
  - Hide timer display completely for sabre
  - Replace timer area with compact Period/Break Status component
  - Do NOT track elapsed time in background
  - Do NOT calculate `match_time_elapsed` for sabre events
  - Do NOT set `bout_length_s` for sabre matches (NULL)

### 2. Match Start Logic
- **Decision**: Match starts when first score is recorded (no ready state, no play button)
- **Implementation**:
  - **No ready state**: Remote is immediately usable; no "Ready" screen or waiting state
  - **No play button**: User can start scoring immediately with +/- buttons
  - **Remote session creation**: Lazy creation on first score (via `ensureRemoteSession()`)
    - Session is created when first +/- button is pressed
    - Avoids creating unused sessions if user navigates away
    - First score is the natural start point for sabre
  - **Weapon selection visibility**: Visible until first score is recorded
    - User can change weapon before starting
    - Hides immediately when first score is recorded
    - No `isPlaying` check needed (sabre doesn't have play/pause)
  - **`hasMatchStarted` state**: Set to `true` when first score is recorded
    - Triggered when scores go from 0-0 to any score > 0
    - Used to hide weapon selection and show match controls
  - **Code flow**:
    ```
    User opens remote screen
      → Weapon selection visible (if sabre selected)
      → User presses + or - button
        → ensureRemoteSession() called (creates session if needed)
        → Score updated
        → hasMatchStarted = true (if was false)
        → Weapon selection hidden
        → Match is now active
    ```
  - Use first event `timestamp` for match start time in database

### 3. Break Logic - Score-Based, Offered Once
- **Decision**: Break triggers when either fencer (fencerA or fencerB) reaches 8 points, regardless of final score
- **Trigger Condition**: Only triggers if `breakTriggered === false` (can be reset if score goes below 8)
- **Break Popup**: 
  - Same UI as foil/epee ("Take Break" / "Skip Break")
  - Title: "Break at 8 Points"
  - Closes immediately when either option is clicked
- **Break Timer**: 
  - Runs for 1 minute (works identically to foil/epee)
  - Triggered by score, not time
  - `isBreakTime = true` during break
  - Status shows "Break Time" during break
- **Scoring During Break**: **NOT disabled** - users can continue scoring during break
- **Period Transitions**:
  - **Skip Break**: Period 2 starts immediately, no break timer runs
  - **Take Break**: Period 1 ends immediately, Period 2 starts automatically when break timer reaches 0:00
- **Break Timer Completion**: When timer reaches 0:00, timer disappears and period increments to 2 automatically
- **Important**: Break can be re-triggered if score goes below 8 and back to 8 (see Score Tracking Logic)

### 4. Period Management - Score-Based, No Manual Controls
- **Current (Foil/Epee)**: Periods advance when timer hits 0:00, manual +/- controls available
- **Sabre**:
  - **Period Structure**:
    - Period 1: 0 → 8 points (before break)
    - Break: Offered once at 8 points
    - Period 2: After break (8+ points, continues until match completion)
  - **No manual period controls**: Periods auto-advance based on break state
  - **Period 1 Creation**: Created on match start / first score
  - **Period Calculation**: Simple logic based on `breakTriggered` state
    ```typescript
    const getSabrePeriod = (breakTriggered: boolean): number => {
      return breakTriggered === false ? 1 : 2;
    };
    ```
  - **Period Display**:
    - Period/Break Status card shows: "Period 1" or "Period 2"
    - Match Insights card shows: "Break Time" when `isBreakTime === true`
  - **Period 1 End Timing**: 
    - Ends when "Skip Break" is clicked OR when break timer completes (if "Take Break" was clicked)
  - **Period 2 Start Timing**:
    - Starts immediately on "Skip Break" OR when break timer completes (if "Take Break" was clicked)

### 5. Match Completion - Manual Only
- **Decision**: Match ends ONLY when user presses "Complete Match" button
- **Complete Match Button Visibility**: Only visible once match has started (`hasMatchStarted === true`)
- **Validation**: Only one score (user or opponent) must be greater than 0 to complete match
- **Confirmation Dialog**: NO confirmation dialog (matches Foil/Epee behavior - completes directly)
- **Period 2 End**: If Period 2 is active, end it when match is completed
- **Database Updates**: Save the following fields when match is completed:
  - `final_score`: Current score at completion (e.g., "15-10")
  - `result`: Win/Loss based on final score
  - `score_diff`: Score difference
  - `bout_length_s`: `NULL` for sabre (not tracked)
  - `yellow_cards`: Current yellow card count
  - `red_cards`: Current red card count
  - `is_complete`: `true`
  - `period_number`: Current period (1 or 2)
  - `score_spp`: Score Per Period (`Math.round(finalScore / periodNumber)`)
  - `score_by_period`: Array of scores per period
  - `fencer_1_name`: Current fencer 1 name
  - `fencer_2_name`: Current fencer 2 name
  - `final_period`: Set to `1` if `breakTriggered === false` (match ended before break), `2` if `breakTriggered === true` (match ended after break)
- **Navigation**: Navigate based on `showUserProfile` toggle:
  - If `showUserProfile === true`: Navigate to `/match-summary`
  - If `showUserProfile === false`: Navigate to `/neutral-match-summary`
- **Timestamps**: Individual score events already have `timestamp` saved (as `event_time` or `timestamp`). `match_time_elapsed` is `NULL` for sabre, so no additional timestamp work needed at match completion.
- **Implementation**:
  ```typescript
  const handleCompleteMatch = async () => {
    // Validation: At least one score > 0
    if (scores.fencerA === 0 && scores.fencerB === 0) {
      Alert.alert('Cannot Complete', 'At least one score must be greater than 0');
      return;
    }
    
    // End Period 2 if active
    if (currentMatchPeriod && currentMatchPeriod.period_number === 2) {
      await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
        end_time: new Date().toISOString(),
        fencer_1_score: scores.fencerA,
        fencer_2_score: scores.fencerB,
      });
    }
    
    // Calculate final period
    const finalPeriod = breakTriggered === false ? 1 : 2;
    
    // Calculate score_spp (Score Per Period)
    const finalScore = Math.max(scores.fencerA, scores.fencerB);
    const scoreSpp = Math.round(finalScore / finalPeriod);
    
    // Update match record
    await matchService.updateMatch(matchId, {
      final_score: `${scores.fencerA}-${scores.fencerB}`,
      result: scores.fencerA > scores.fencerB ? 'win' : 'loss',
      score_diff: Math.abs(scores.fencerA - scores.fencerB),
      bout_length_s: null, // NULL for sabre
      yellow_cards: yellowCardsCount,
      red_cards: redCardsCount,
      is_complete: true,
      period_number: finalPeriod,
      score_spp: scoreSpp,
      score_by_period: [/* Period 1 scores */, /* Period 2 scores */],
      fencer_1_name: fencerNames.fencerA,
      fencer_2_name: fencerNames.fencerB,
      final_period: finalPeriod,
    });
    
    // Navigate based on showUserProfile toggle
    if (showUserProfile) {
      router.push('/match-summary');
    } else {
      router.push('/neutral-match-summary');
    }
  };
  ```
- **No target score enforcement**: Users can score to 15, 20, 30, or any score before completing
- **Complete Match button**: Visible once match has started (`hasMatchStarted === true`)

### 6. Time Tracking - NOT TRACKED
- **Decision**: Do not track elapsed time for sabre matches
- **Reasoning**:
  - Sabre is score-only by design
  - No time-based metrics needed
  - Event sequence/order is sufficient for calculations
  - Simplifies implementation (no timer logic)
- **Database**:
  - `bout_length_s`: Set to `NULL` for sabre matches
  - `match_time_elapsed`: Set to `NULL` for sabre events
  - `timestamp`: Required (for event ordering and progression charts)

---

## UI Changes

### Timer Section Replacement
**Current (Foil/Epee):**
```
[Large countdown timer: 3:00]
[Play/Pause button]
[+/- time controls]
```

**Sabre:**
```
[Match Insights Card]
- Label: "Match Insights" (replaces "Match Timer")
- Content: Real-time match insights (see Match Insights section below)
- Period Controls: [ - ] Period 1/2 [ + ] (below insights)
```

### Visual Layout
- **Remove**: Large timer display area, play/pause button, time controls
- **Replace with**: Compact Period/Break Status card
- **Keep**: Score cards (prominent), fencer names/images, all control buttons
- **Layout Priority**: Period/Break status is primary; any Match Insights/analytics are secondary

### Status Indicators
```typescript
// Sabre status display
{selectedWeapon === 'sabre' ? (
  <View style={styles.periodStatusContainer}>
    <Text style={styles.periodStatusText}>
      {isBreakTime 
        ? 'Break Time' 
        : breakTriggered 
          ? 'Period 2' 
          : 'Period 1'}
    </Text>
    {/* Optional: Show break warning when approaching 8 */}
    {!breakTriggered && 
     !isBreakTime && 
     (scores.fencerA === 7 || scores.fencerB === 7) && (
      <Text style={styles.breakWarningText}>
        Break at 8 points
      </Text>
    )}
  </View>
) : (
  // Foil/Epee: Show timer as normal
  <TimerDisplay ... />
)}
```

### Match Insights Display (Sabre)
**Location**: Replaces timer display in `timerDisplay` container  
**Label**: "Match Insights" (replaces "Match Timer" label)

**Displayed Insights**:

1. **Current Lead**
   - **When to show**: Always (when match has started)
   - **Display logic**:
     - If scores are tied (difference = 0): Show "Tied"
     - Otherwise: Show "[Fencer Name] leading by [X] points"
   - **Example**: "Alice leading by 3" or "Tied"

2. **Momentum Indicator**
   - **When to show**: Only when a fencer has 2+ consecutive scores
   - **Display logic**:
     - Track consecutive scores by the same fencer
     - Show "On a streak ([X] in a row)" when streak ≥ 2
     - Hide when streak is 0 or 1
   - **Example**: "On a streak (2 in a row)" or "On a streak (3 in a row)"

3. **Break Warning**
   - **When to show**: Only when a fencer is at 7 points (approaching 8) AND `breakTriggered === false`
   - **Display logic**:
     - Check if `scores.fencerA === 7 || scores.fencerB === 7`
     - Only show if break hasn't been triggered yet
     - Hide once break is triggered or if no fencer is at 7
   - **Example**: "⚠️ Break at 8 points"

4. **Empty State**
   - **When to show**: When match hasn't started (scores are 0-0)
   - **Display**: "Match Ready" or similar simple status

**Period Controls**:
- Positioned below the Match Insights content
- Shows: `[ - ] Period 1/2 [ + ]` (for sabre, shows `/2` instead of `/3`)
- Period number is only displayed here (not duplicated in insights)

**Visual Layout**:
```
┌─────────────────────────────────────────┐
│         Match Insights                  │  ← Label
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐ │
│  │  🎯 Current Lead                  │ │
│  │     Alice leading by 3            │ │
│  │                                   │ │
│  │  🔥 Momentum                       │ │
│  │     On a streak (2 in a row)      │ │
│  │                                   │ │
│  │  ⚠️ Break Warning                  │ │
│  │     Break at 8 points              │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │  [ - ]  Period 1/2  [ + ]        │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Implementation Notes**:
- All insights are calculated in real-time from current scores and match events
- Momentum tracking requires maintaining a streak counter (resets when opponent scores)
- Break warning is conditional and only appears when approaching break threshold
- Period controls remain functional for sabre (allows manual period adjustment if needed)

### Unchanged UI Elements (Sabre)
The following elements remain unchanged from the generic remote:
- **Fencer Cards**: Name, image, large score display, +/- score buttons
- **Switch Fencers Button**: Swap fencer positions
- **Yellow/Red Cards**: Issue cards to fencers
- **Injury Timer**: 5-minute injury timer
- **Reset Scores**: Reset scores only
- **Reset All**: Reset entire match state
- **Complete Match Button**: Manual match completion
- **Navigation**: Navigate to Match Summary

### Removed UI Elements (Sabre)
- Timer display (countdown) - **Replaced with Match Insights**
- Play/Pause button
- Time adjustment controls (+/- time)
- Edit time button
- Target score selector
- Priority display/controls

**Note**: Period +/- controls remain visible for sabre (positioned below Match Insights)

---

## State Management

### Sabre-Specific State Variables
```typescript
// Sabre-specific state
const [breakTriggered, setBreakTriggered] = useState(false); // Track if break at 8 was offered

// NO matchTargetScore state needed for sabre (open-ended scoring)
// Period is derived from breakTriggered, not from target score
```

### Modified State Logic
```typescript
// hasMatchStarted logic
const hasMatchStarted = selectedWeapon === 'sabre'
  ? (scores.fencerA > 0 || scores.fencerB > 0) // First score starts match (no ready state, no play button)
  : (isPlaying || timeRemaining < matchTime); // Timer-based for foil/epee

// Weapon selection visibility
const showWeaponSelection = selectedWeapon === 'sabre'
  ? !hasMatchStarted // Show until first score
  : (!hasMatchStarted && !isPlaying); // Foil/epee: show until match starts and timer is not playing

// Remote session creation (lazy)
const handleScoreChange = async (entity: 'fencerA' | 'fencerB', delta: number) => {
  // Ensure session exists (creates if doesn't exist)
  if (!remoteSession) {
    const session = await ensureRemoteSession();
    if (!session) {
      console.error('Failed to create remote session');
      return;
    }
  }
  
  // Mark match as started if this is first score
  if (!hasMatchStarted && (scores.fencerA === 0 && scores.fencerB === 0)) {
    setHasMatchStarted(true);
  }
  
  // Update scores and create event...
};

// isBreakTime logic
const isBreakTime = selectedWeapon === 'sabre'
  ? (breakTimerActive && breakTriggered) // Score-triggered break
  : (breakTimerActive && timeRemaining === 0); // Time-triggered break

// Current period logic
const currentPeriod = selectedWeapon === 'sabre'
  ? (breakTriggered === false ? 1 : 2) // Period 1 before break, Period 2 after
  : calculatePeriodFromTime(); // Time-based for foil/epee
```

### State Reset Logic
```typescript
const handleResetAll = () => {
  // Reset sabre-specific state
  if (selectedWeapon === 'sabre') {
    setBreakTriggered(false);
    // Period will automatically reset to 1 when breakTriggered is false
  }
  
  // Reset common state
  setScores({ fencerA: 0, fencerB: 0 });
  // ... other resets
};
```

---

## Score Tracking Logic

### Score Increment/Decrement Behavior
- **+/- buttons**: Work identically to foil/epee (increment/decrement scores)
- **Instant UI feedback**: Score updates happen immediately (synchronous state update)
- **Event creation**: Fire-and-forget (async in background, errors handled with `.catch()`)
- **Score limits**: Completely open-ended - no maximum score limit (users can score to 15, 20, 30, 50, etc.)

### Break Trigger Reset on Decrement
- **Decision**: Reset `breakTriggered` when score goes below 8
- **Logic**: If a fencer is at 8+ and we decrement to 7 or below, reset `breakTriggered = false`
- **Reason**: Allows break popup to show again if they increment back to 8
- **Implementation**:
  ```typescript
  const handleScoreDecrement = async (entity: 'fencerA' | 'fencerB') => {
    const newScore = entity === 'fencerA' 
      ? scores.fencerA - 1 
      : scores.fencerB - 1;
    
    // Update scores immediately (instant UI feedback)
    setScores(prev => ({
      ...prev,
      [entity]: newScore
    }));
    
    // Reset breakTriggered if score goes below 8 (sabre only)
    if (selectedWeapon === 'sabre' && newScore < 8 && breakTriggered) {
      setBreakTriggered(false);
    }
    
    // Create event (fire-and-forget, async in background)
    createMatchEvent({
      match_time_elapsed: null, // NULL for sabre
      timestamp: new Date().toISOString(),
      // ... other event data
    }).catch(console.error);
  };
  ```

### Score Increment with Break Check
- **Break check timing**: Immediately after score update, before event creation
- **Break check condition**: Only check if `breakTriggered === false` and `newScore === 8`
- **Implementation**:
  ```typescript
  const handleScoreIncrement = async (entity: 'fencerA' | 'fencerB') => {
    const newScore = entity === 'fencerA' 
      ? scores.fencerA + 1 
      : scores.fencerB + 1;
    
    // 1. Update scores immediately (instant UI feedback)
    setScores(prev => ({
      ...prev,
      [entity]: newScore
    }));
    
    // 2. Check for break trigger IMMEDIATELY after score update (sabre only)
    if (selectedWeapon === 'sabre' && newScore === 8 && !breakTriggered) {
      setBreakTriggered(true);
      // Show break popup
      Alert.alert(/* ... */);
    }
    
    // 3. Create event (fire-and-forget, async in background)
    createMatchEvent({
      match_time_elapsed: null, // NULL for sabre
      timestamp: new Date().toISOString(),
      // ... other event data
    }).catch(console.error);
  };
  ```

### Code Flow
```
User presses + button
  → Calculate new score
  → Update scores state (instant UI)
  → Check for break at 8 (if sabre && newScore === 8 && !breakTriggered)
    → If break needed: setBreakTriggered(true), show popup
  → Create event (fire-and-forget, async)
    → match_time_elapsed: null
    → timestamp: now
```

### Event Data
- `match_time_elapsed`: Always `NULL` for sabre (not calculated)
- `timestamp`: Required (for event ordering and progression charts)
- Event ordering: Use `timestamp` (not `match_time_elapsed`)

---

## Break Logic Implementation

### Break Trigger Condition
- **Trigger**: Either fencer (fencerA or fencerB) reaching 8 points
- **Condition**: Only triggers if `breakTriggered === false`
- **Note**: `breakTriggered` can be reset if score goes below 8 (see Score Tracking Logic)

```typescript
const SABRE_BREAK_SCORE = 8;

const checkSabreBreak = (newScore: number, entity: 'fencerA' | 'fencerB') => {
  if (selectedWeapon !== 'sabre') return;
  
  // Trigger break if:
  // 1. Score just reached 8 (either fencer)
  // 2. Break hasn't been triggered yet (!breakTriggered)
  if (newScore === SABRE_BREAK_SCORE && !breakTriggered) {
    setBreakTriggered(true);
    
    // Show break popup (same UI as foil/epee)
    Alert.alert(
      'Break at 8 Points',
      'Take a break before continuing?',
      [
        { 
          text: 'Skip Break', 
          onPress: async () => {
            // Popup closes immediately
            // Period 2 starts immediately
            await transitionToNextPeriod(2);
          }
        },
        { 
          text: 'Take Break', 
          onPress: async () => {
            // Popup closes immediately
            // Period 1 ends immediately
            await endPeriod1();
            // Start break timer (1 minute)
            setBreakTimerActive(true);
            setIsBreakTime(true);
            startBreakTimer(); // 1-minute break timer
          }
        }
      ]
    );
  }
};
```

**Note**: Break check happens immediately after score update (see Score Tracking Logic section for full implementation details).

### Break Popup Behavior
- **UI**: Same as foil/epee (no customization needed)
- **Title**: "Break at 8 Points" (instead of time-based messaging)
- **Options**: "Take Break" / "Skip Break"
- **Behavior**: Popup closes immediately when either option is clicked

### Break Timer
- **Duration**: 1 minute (works identically to foil/epee)
- **State**: `isBreakTime = true` during break
- **Status Display**: Shows "Break Time" in Period/Break Status component
- **Scoring**: **NOT disabled** during break (users can continue scoring)

### Period Transition Logic

#### When "Skip Break" is clicked:
```typescript
const handleSkipBreak = async () => {
  // 1. Popup closes immediately (handled by Alert.alert)
  // 2. Period 2 starts immediately
  await transitionToNextPeriod(2);
  // 3. isBreakTime remains false
  // 4. Status shows "Period 2"
};
```

#### When "Take Break" is clicked:
```typescript
const handleTakeBreak = async () => {
  // 1. Popup closes immediately (handled by Alert.alert)
  // 2. Period 1 ends immediately
  await endPeriod1();
  // 3. Break timer starts (1 minute)
  setBreakTimerActive(true);
  setIsBreakTime(true);
  startBreakTimer();
  // 4. Status shows "Break Time"
  // 5. Scoring remains enabled
};
```

#### When break timer reaches 0:00:
```typescript
const onBreakTimerComplete = async () => {
  // 1. Timer disappears
  setBreakTimerActive(false);
  setIsBreakTime(false);
  // 2. Period 2 starts automatically
  await transitionToNextPeriod(2);
  // 3. Status shows "Period 2"
};
```

### Period Transition Functions
```typescript
// End Period 1 (when "Take Break" is clicked)
const endPeriod1 = async () => {
  if (currentMatchPeriod && currentMatchPeriod.period_number === 1) {
    await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
      end_time: new Date().toISOString(),
      fencer_1_score: scores.fencerA,
      fencer_2_score: scores.fencerB,
    });
  }
};

// Transition to Period 2 (when break ends or is skipped)
const transitionToNextPeriod = async (periodNumber: number) => {
  if (selectedWeapon !== 'sabre') return;
  
  // End current period (if exists)
  if (currentMatchPeriod) {
    await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
      end_time: new Date().toISOString(),
      fencer_1_score: scores.fencerA,
      fencer_2_score: scores.fencerB,
    });
  }
  
  // Start Period 2
  const newPeriod = await matchPeriodService.createMatchPeriod(
    remoteSession.remote_id,
    periodNumber,
    new Date().toISOString()
  );
  
  setCurrentMatchPeriod(newPeriod);
};
```

### Break State Management
- **`breakTriggered`**: `true` when break has been offered (prevents re-triggering while score is 8+)
- **`isBreakTime`**: `true` during active break (when break timer is running)
- **`breakTimerActive`**: `true` when break timer is running
- **Status Display**: 
  - "Period 1" (before break)
  - "Break Time" (during break, when `isBreakTime === true`)
  - "Period 2" (after break, when `breakTriggered === true`)

### Complete Break Flow
```
Fencer reaches 8 points
  → checkSabreBreak() triggered
  → setBreakTriggered(true)
  → Break popup shows ("Break at 8 Points")
  
User clicks "Take Break"
  → Popup closes immediately
  → endPeriod1() called (Period 1 ends)
  → setBreakTimerActive(true)
  → setIsBreakTime(true)
  → startBreakTimer() (1 minute countdown)
  → Status shows "Break Time"
  → Scoring remains enabled
  
Break timer reaches 0:00
  → onBreakTimerComplete() called
  → setBreakTimerActive(false)
  → setIsBreakTime(false)
  → transitionToNextPeriod(2) called
  → Period 2 starts automatically
  → Status shows "Period 2"
```

**Alternative Flow (Skip Break):**
```
Fencer reaches 8 points
  → Break popup shows
  
User clicks "Skip Break"
  → Popup closes immediately
  → transitionToNextPeriod(2) called
  → Period 2 starts immediately
  → Status shows "Period 2"
  → No break timer runs
```

### Period Structure for Sabre
```typescript
// Period 1: 0 → 8 (before break)
// Break: Offered once at 8 points
// Period 2: After break (8+ points, continues until match completion)

const getSabrePeriod = (breakTriggered: boolean): number => {
  return breakTriggered === false ? 1 : 2;
};

// Period transitions
const transitionToNextPeriod = async (periodNumber: number) => {
  if (selectedWeapon !== 'sabre') return;
  
  // End current period
  if (currentMatchPeriod) {
    await matchPeriodService.updateMatchPeriod(currentMatchPeriod.match_period_id, {
      end_time: new Date().toISOString(),
      fencer_1_score: scores.fencerA,
      fencer_2_score: scores.fencerB,
    });
  }
  
  // Start new period
  const newPeriod = await matchPeriodService.createMatchPeriod(
    remoteSession.remote_id,
    periodNumber,
    new Date().toISOString()
  );
  
  setCurrentMatchPeriod(newPeriod);
};
```

---

## Period Management Logic

### Period 1 Creation
- **Timing**: Created on match start / first score
- **Implementation**: When first score is recorded and `hasMatchStarted` becomes `true`, create Period 1
  ```typescript
  const handleFirstScore = async () => {
    if (!hasMatchStarted && (scores.fencerA === 0 && scores.fencerB === 0)) {
      setHasMatchStarted(true);
      
      // Create Period 1
      const period1 = await matchPeriodService.createMatchPeriod(
        remoteSession.remote_id,
        1, // Period 1
        new Date().toISOString()
      );
      setCurrentMatchPeriod(period1);
    }
  };
  ```

### Period Calculation
- **Logic**: Simple calculation based on `breakTriggered` state
  ```typescript
  const getSabrePeriod = (breakTriggered: boolean): number => {
    return breakTriggered === false ? 1 : 2;
  };
  
  // Usage
  const currentPeriod = getSabrePeriod(breakTriggered);
  ```
- **Works for both scenarios**:
  - Skip Break: `breakTriggered = true` → Period 2 immediately
  - Take Break: `breakTriggered = true`, then Period 2 when break completes

### Period Display Logic
- **Period/Break Status Card**: Shows period number
  ```typescript
  const periodStatusText = breakTriggered === false ? 'Period 1' : 'Period 2';
  ```
- **Match Insights Card**: Shows break status
  ```typescript
  const breakStatusText = isBreakTime ? 'Break Time' : null;
  ```

### Period 1 End Timing
- **When "Skip Break" is clicked**:
  - Period 1 ends immediately
  - Period 2 starts immediately
- **When "Take Break" is clicked**:
  - Period 1 ends immediately (when break starts)
  - Period 2 starts when break timer completes (reaches 0:00)

### Period 2 Start Timing
- **Skip Break**: Period 2 starts immediately (no break timer)
- **Take Break**: Period 2 starts when break timer completes (after 1 minute)

### Period Database Records
- **Period 1**:
  - `start_time`: Match start / first score timestamp
  - `end_time`: When "Skip Break" is clicked OR when break timer completes (if "Take Break" was clicked)
  - `period_number`: 1
- **Period 2**:
  - `start_time`: When "Skip Break" is clicked OR when break timer completes (if "Take Break" was clicked)
  - `end_time`: Match completion timestamp
  - `period_number`: 2

### Complete Period Flow
```
Match starts (first score)
  → Period 1 created (period_number: 1, start_time: now)
  → Status shows "Period 1"
  
Fencer reaches 8 points
  → Break popup shows
  
User clicks "Skip Break"
  → Period 1 ends (end_time: now)
  → Period 2 created (period_number: 2, start_time: now)
  → Status shows "Period 2"
  
OR User clicks "Take Break"
  → Period 1 ends (end_time: now)
  → Break timer starts
  → Status shows "Period 1" (Period/Break Status card)
  → Match Insights shows "Break Time"
  
Break timer reaches 0:00
  → Period 2 created (period_number: 2, start_time: now)
  → Status shows "Period 2"
  → Match Insights no longer shows "Break Time"
```

---

## Match Completion Logic

### Complete Match Button Visibility
- **Condition**: Button is visible once match has started (`hasMatchStarted === true`)
- **Implementation**: Show button when `hasMatchStarted === true` (same as Foil/Epee)

### Validation
- **Requirement**: At least one score (user or opponent) must be greater than 0
- **Error Handling**: Show alert if both scores are 0 and user tries to complete

### Confirmation Dialog
- **Decision**: NO confirmation dialog (matches Foil/Epee behavior - completes directly)
- **Implementation**: Call `completeMatch()` directly without `Alert.alert` confirmation

### Period 2 End
- **Timing**: If Period 2 is active when match is completed, end it
- **Implementation**: Update Period 2 record with `end_time` and final scores

### Database Updates
When match is completed, update the following fields in the `match` table:

```typescript
{
  final_score: `${scores.fencerA}-${scores.fencerB}`, // e.g., "15-10"
  result: scores.fencerA > scores.fencerB ? 'win' : 'loss',
  score_diff: Math.abs(scores.fencerA - scores.fencerB),
  bout_length_s: null, // NULL for sabre (not tracked)
  yellow_cards: yellowCardsCount,
  red_cards: redCardsCount,
  is_complete: true,
  period_number: finalPeriod, // 1 or 2
  score_spp: Math.round(Math.max(scores.fencerA, scores.fencerB) / finalPeriod), // Score Per Period
  score_by_period: [/* Period 1 scores */, /* Period 2 scores */],
  fencer_1_name: fencerNames.fencerA,
  fencer_2_name: fencerNames.fencerB,
  final_period: finalPeriod, // 1 if breakTriggered === false, 2 if breakTriggered === true
}
```

### Final Period Calculation
- **Logic**: `final_period = breakTriggered === false ? 1 : 2`
- **Meaning**:
  - `1`: Match ended before break (before 8 points)
  - `2`: Match ended after break (after break was offered/taken)

### Score Per Period (score_spp)
- **Calculation**: `Math.round(Math.max(scores.fencerA, scores.fencerB) / finalPeriod)`
- **Example**: If final score is 15-10 and `final_period = 2`, then `score_spp = Math.round(15 / 2) = 8`

### Score By Period (score_by_period)
- **Format**: Array of scores per period
- **Example**: `[{ period: 1, fencerA: 8, fencerB: 7 }, { period: 2, fencerA: 15, fencerB: 10 }]`

### Navigation
- **Logic**: Navigate based on `showUserProfile` toggle
  - If `showUserProfile === true`: Navigate to `/match-summary`
  - If `showUserProfile === false`: Navigate to `/neutral-match-summary`

### Timestamps
- **Individual Events**: Each score event already has `timestamp` saved (as `event_time` or `timestamp`)
- **Match Time Elapsed**: `NULL` for sabre (not calculated)
- **No Additional Work**: No additional timestamp work needed at match completion

### Complete Implementation Flow
```
User presses "Complete Match" button
  → Validate: At least one score > 0
  → End Period 2 if active (update end_time, scores)
  → Calculate final_period (breakTriggered === false ? 1 : 2)
  → Calculate score_spp (Math.round(maxScore / finalPeriod))
  → Calculate score_by_period array
  → Update match record with all fields
  → Navigate to match summary (based on showUserProfile toggle)
```

---

## Match Event Tracking

### Event Timestamps
- **Keep**: `timestamp` field for event ordering (required)
- **Remove**: `match_time_elapsed` calculation for sabre (set to NULL)
- **Use**: Event sequence based on `timestamp` for progression calculations

### Event Creation
```typescript
// When scoring in sabre (fire-and-forget pattern)
const createSabreEvent = async (entity: 'fencerA' | 'fencerB', newScore: number) => {
  const event = {
    match_id: matchId || null,
    fencing_remote_id: remoteSession.remote_id,
    scoring_user_name: entity === 'fencerA' ? fencerNames.fencerA : fencerNames.fencerB,
    timestamp: new Date().toISOString(), // Required for ordering
    match_time_elapsed: null, // NULL for sabre - not tracked
    fencer_1_name: fencerNames.fencerA,
    fencer_2_name: fencerNames.fencerB,
    event_type: 'score',
    match_period_id: currentMatchPeriod?.match_period_id || null,
    // ... other fields
  };
  
  // Fire-and-forget: async in background, errors handled
  matchEventService.createEvent(event).catch(console.error);
  
  // Note: Break check happens BEFORE event creation (see Score Tracking Logic)
  // NO auto-completion check - sabre is open-ended
};
```

### Event Ordering for Charts
```typescript
// For sabre matches, order events by timestamp
const getSabreEvents = async (matchId: string) => {
  const { data: events } = await supabase
    .from('match_event')
    .select('*')
    .eq('match_id', matchId)
    .order('timestamp', { ascending: true }); // Use timestamp, not match_time_elapsed
  
  return events;
};
```

---

## Database Considerations

### Match Table
- `weapon_type`: Set to `'sabre'` for sabre matches
- `bout_length_s`: Set to `NULL` for sabre (not meaningful, not tracked)
- `final_score`: Still tracked (score when match was completed)
- `final_period`: Set to `1` or `2` (represents before break / after break)
- All other fields work identically

### Match Event Table
- `match_time_elapsed`: Set to `NULL` for sabre events (not calculated)
- `timestamp`: Required (for event ordering and progression charts)
- `match_period_id`: Links to Period 1 or Period 2
- Event sequence: Use `timestamp` ordering, not `match_time_elapsed`

### Match Period Table
- Period 1: `start_time` = match start, `end_time` = break start (or Period 2 start if break skipped)
- Period 2: `start_time` = break end (or Period 1 end), `end_time` = match completion
- `period_number`: 1 or 2 (not 1/3, 2/3, 3/3)
- `fencer_1_score` / `fencer_2_score`: Tracked at period boundaries

### Query Considerations
- When querying sabre matches, filter by `weapon_type = 'sabre'`
- When ordering sabre events, use `ORDER BY timestamp ASC`, not `match_time_elapsed`
- When calculating sabre metrics, use event count/sequence, not time intervals

---

## Files to Modify

### Primary File
- `app/(tabs)/remote.tsx`
  - Add sabre-specific Period/Break Status component (replaces timer)
  - Implement score-based break logic (trigger at 8, offered once)
  - Modify period calculation (based on break state, not time)
  - Update match start logic (first score starts match)
  - Remove timer display and controls for sabre
  - Remove auto-completion logic for sabre
  - Ensure Complete Match button is always available

### Supporting Files
- `lib/database.ts` / `matchService.ts`
  - Update match creation to set `bout_length_s = NULL` for sabre
  - Modify event creation to set `match_time_elapsed = NULL` for sabre
  - Update queries to use `timestamp` ordering for sabre events
- `lib/offlineRemoteService.ts`
  - Ensure sabre matches work offline (no time dependencies)
  - Event queuing works identically (uses timestamp)

---

## Implementation Phases

### Phase 1: UI Changes
- [ ] Hide timer display when sabre is selected
- [ ] Create Period/Break Status component
- [ ] Replace timer area with status component
- [ ] Add "Break at 8 points" warning indicator (optional)
- [ ] Test UI layout and responsiveness
- [ ] Ensure Match Insights don't obscure Period/Break status

### Phase 2: Break Logic
- [ ] Implement score-based break trigger (8 points, offered once)
- [ ] Update break popup to show for sabre
- [ ] Ensure break timer still works (1 minute)
- [ ] Handle break skip logic (move to Period 2)
- [ ] Test break at various score combinations
- [ ] Verify break is only offered once

### Phase 3: Period Logic
- [ ] Implement score-based period calculation (from break state)
- [ ] Remove manual period controls for sabre
- [ ] Ensure period transitions work correctly (Period 1 → Break → Period 2)
- [ ] Test period 1 → break → period 2 flow
- [ ] Verify period numbers are 1 or 2 (not 1/3, 2/3, 3/3)

### Phase 4: Match Start/End
- [ ] Remove play button requirement for sabre
- [ ] Implement first-score match start
- [ ] Remove auto-completion logic for sabre
- [ ] Ensure Complete Match button is always visible and functional
- [ ] Test match completion flow
- [ ] Verify match data saves correctly (bout_length_s = NULL)

### Phase 5: Database & Events
- [ ] Update event creation to set `match_time_elapsed = NULL` for sabre
- [ ] Ensure `bout_length_s = NULL` for sabre matches
- [ ] Test event ordering (timestamp-based)
- [ ] Verify match summary calculations work without time
- [ ] Update queries to handle NULL `match_time_elapsed` for sabre

### Phase 6: Testing
- [ ] Test complete sabre match flow (0 → 8 → break → continue → complete)
- [ ] Test break skip functionality
- [ ] Test scoring past 15 (open-ended)
- [ ] Test manual match completion
- [ ] Test reset functionality
- [ ] Test offline sabre matches
- [ ] Verify match summary displays correctly
- [ ] Test period transitions and break logic

---

## Match Summary Integration

### Sabre-Specific Metrics (for match summary pages)
These are tracked and displayed on both the **match summary** (`/match-summary`) and **neutral match summary** (`/neutral-match-summary`) pages, not the remote:

1. **Momentum Shifts**
   - Track: 3 consecutive hits = momentum shift
   - Display: Number of momentum shifts per fencer
   - Calculation: Count streaks of 3+ consecutive scores

2. **Score-Based Leading Percentage**
   - Track: Percentage of match where each fencer led (based on number of hits, not time)
   - Display: Percentage breakdown (fencer1%, fencer2%, tied%)
   - Calculation: Count events where each fencer was leading, divide by total events

### Score Progression Chart (Sabre)

**X-Axis: Touch Number / Event Sequence**
- **For Foil/Epee**: X-axis shows elapsed match time (e.g., "0:00", "1:30", "3:00")
- **For Sabre**: X-axis shows touch number / event sequence (1, 2, 3, 4, 5, ...)
- **Rationale**: 
  - Time is not meaningful for Sabre fencers (no time limits, no time tracking)
  - Touch sequence shows the order of scoring events, which is more relevant
  - Simple and clear: "On the 5th touch, Alice had 3, Bob had 2"
- **Display**: Numbers (1, 2, 3, 4, 5, ...) representing sequential scoring events
- **Calculation**: Number scoring events sequentially from first to last

**Y-Axis: Score (Same for All Weapons)**
- Y-axis: Score (0, 1, 2, 3, 4, ...)
- Same for all weapon types

**Example Visualization:**
```
Touch 1: Alice scores → (1, 1-0)
Touch 2: Bob scores → (2, 1-1)
Touch 3: Alice scores → (3, 2-1)
Touch 4: Alice scores → (4, 3-1)
Touch 5: Bob scores → (5, 3-2)
```

**Applies to**: Both **match summary** (`/match-summary`) and **neutral match summary** (`/neutral-match-summary`) pages

**Implementation Notes:**
- Both `match-summary.tsx` and `neutral-match-summary.tsx` use the same `ScoreProgressionChart` component
- The chart component should detect `weapon_type === 'sabre'` (or `'saber'`) and use touch number for x-axis instead of time
- For Sabre matches, calculate x-axis values as sequential event numbers (1, 2, 3, ...) instead of time strings

### Neutral Match Summary Page (Sabre)

The neutral match summary page (`/neutral-match-summary`) displays additional metric cards that need Sabre-specific handling:

**1. Match Result Card**
- **Duration**: Show "N/A" or hide duration field for Sabre matches (no time tracking)
- **Score**: Display normally (e.g., "15-12")
- **Weapon**: Display "Sabre" normally

**2. Minimal Meta Card**
- **Weapon**: ✅ Show (displays "Sabre")
- **Date**: ✅ Show (displays match date)
- **Duration**: ❌ Hide or show "N/A" for Sabre matches

**3. Touches by Period Chart**
- **For Foil/Epee**: Shows 3 periods (Period 1, Period 2, Period 3)
- **For Sabre**: Only show Period 1 and Period 2 (hide Period 3)
- **Period 1**: Before break (scores from 0 to break at 8)
- **Period 2**: After break (scores from break to match completion)

**4. Score Progression Chart**
- **X-Axis**: Touch number / event sequence (1, 2, 3, 4, 5, ...) for Sabre
- **Y-Axis**: Score (0, 1, 2, 3, 4, ...) - same for all weapons
- See "Score Progression Chart (Sabre)" section above for details

**5. Lead Changes Card**
- ✅ **Show**: Works the same for Sabre (based on score events, not time)
- Displays total number of lead changes during the match

**6. Time Leading Card**
- ❌→🔄 **Replace with "Score-Based Leading Percentage"** for Sabre
- **For Foil/Epee**: Shows percentage of match time each fencer led
- **For Sabre**: Replace with "Score-Based Leading Percentage" card showing:
  - Percentage of scoring events where each fencer led
  - Calculation: Count events where each fencer was leading, divide by total events
  - Display: Same circular progress UI (fencer1%, fencer2%, tied%)

**7. Bounce Back Time Card**
- ❌ **Hide** for Sabre matches
- **Reason**: Time-based metric (shows seconds to recover after being scored on)
- Not applicable for Sabre (no time tracking)

**8. Longest Run Card**
- ✅ **Show**: Works the same for Sabre (based on score events, not time)
- Displays longest consecutive scoring streak per fencer

**Summary Table for Neutral Match Summary:**

| Component | Foil/Epee | Sabre | Notes |
|-----------|-----------|-------|-------|
| Match Result Card | ✅ | ✅ | Duration: "N/A" for Sabre |
| Minimal Meta Card | ✅ | ✅ | Duration: Hide or "N/A" for Sabre |
| Touches by Period Chart | ✅ (3 periods) | ✅ (2 periods) | Hide Period 3 for Sabre |
| Score Progression Chart | ✅ (time x-axis) | ✅ (touch # x-axis) | Different x-axis for Sabre |
| Lead Changes Card | ✅ | ✅ | Works the same |
| Time Leading Card | ✅ | ❌→🔄 | Replace with Score-Based Leading |
| Bounce Back Time Card | ✅ | ❌ | Hide (time-based) |
| Longest Run Card | ✅ | ✅ | Works the same |

*Note: See `SABRE_MATCH_SUMMARY_PLANNING.md` for detailed match summary requirements.*

---

## Edge Cases & Considerations

### Break at 8 (Regardless of Final Score)
- Break is offered when any fencer reaches 8 points (if `breakTriggered === false`)
- Break happens even if users continue scoring past 15
- `breakTriggered` flag prevents re-triggering while score is 8+
- **Break reset**: If score goes below 8 (via decrement), `breakTriggered` is reset to `false`, allowing break to be offered again when score returns to 8
- Break is independent of match completion

### Break Skipped
- If user skips break, popup closes immediately
- Period 2 starts immediately (no break timer runs)
- `breakTriggered` flag is still set to `true` (prevents re-triggering while score is 8+)
- Period transition happens automatically
- Match can continue scoring past 15
- **Note**: If user decrements score below 8 after skipping break, `breakTriggered` resets and break can be offered again

### Break Taken
- If user takes break, popup closes immediately
- Period 1 ends immediately (period record updated)
- Break timer starts (1 minute countdown)
- `isBreakTime = true` during break
- Status shows "Break Time"
- **Scoring remains enabled** during break (users can continue scoring)
- When break timer reaches 0:00:
  - Timer disappears
  - Period 2 starts automatically (new period record created)
  - `isBreakTime = false`
  - Status shows "Period 2"

### Score Decrement Below 8
- If a fencer is at 8+ and score is decremented to 7 or below, `breakTriggered` is reset to `false`
- This allows the break popup to show again if they increment back to 8
- Example flow:
  1. Fencer A scores 8 → break popup shows → user clicks "Skip Break" → `breakTriggered = true`
  2. User decrements Fencer A to 7 → `breakTriggered = false` (reset)
  3. User increments Fencer A back to 8 → break popup shows again

### Match Reset
- Reset `breakTriggered` flag to `false`
- Reset period to 1 (derived from `breakTriggered`)
- Clear all scores
- Weapon selection reappears
- All state returns to initial sabre state

### Offline Matches
- All sabre logic must work offline
- Break triggers work the same (score-based)
- Period tracking works the same (break-based)
- No time dependencies = easier offline handling
- Events queue with `timestamp`, sync when online

### Open-Ended Scoring
- Users can score to 15, 20, 30, or any score
- No target score enforcement
- Complete Match button always available
- Match ends only when user explicitly completes

### Black Cards
- **Not implemented in v1**: Black cards/exclusions are extremely rare
- If needed, record manually in match notes
- Future enhancement: Add black card support if requested

### Priority/Sudden Death
- **Not implemented**: Priority and sudden death are out of scope
- Sabre mode is designed for practical club/training use
- Official competition rules (priority, timing) are intentionally ignored

---

## Questions Resolved

✅ **Match Start**: First score starts the match (no play button needed)  
✅ **Time Tracking**: Not tracked (NULL in database, no calculations)  
✅ **Timer Display**: Removed (replaced with Period/Break status)  
✅ **Break Logic**: Score-based (8 points, offered once, independent of final score)  
✅ **Period Advancement**: Score-based (auto-advances based on break, no manual controls)  
✅ **Match Completion**: Manual only (Complete Match button, no auto-completion)  
✅ **Target Score**: Open-ended (no enforcement, scoring can continue past 15)  
✅ **Priority**: Not implemented (out of scope by design)  

---

## Notes

- Sabre remote is significantly simpler than foil/epee (no timer complexity)
- Focus on score-based logic throughout
- Event ordering uses `timestamp`, but no time calculations needed
- Match summary will have sabre-specific metrics (momentum, score-based leading)
- All existing functionality (cards, injury timer, reset, etc.) remains, just triggered differently
- Designed for practical club/training use, not strict competition rules

---

## Future Enhancements (Sabre)

These are non-blocking ideas for potential future versions:

- **Undo Last Event**: Allow users to undo the last score or card
- **Visual Score Feedback**: Brief flash or outline on fencer card when they score
- **Official Mode**: Optional sabre mode with timer and priority (if ever needed for competition)
- **Black Card Support**: Add black card tracking if requested by users
- **Custom Break Score**: Allow users to set custom break score (default 8)

---

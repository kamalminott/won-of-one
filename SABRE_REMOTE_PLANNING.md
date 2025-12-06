# Sabre Fencing Remote Implementation Planning

## Overview
This document outlines the specific implementation requirements for the Sabre fencing remote, which differs significantly from Foil and Epee due to its score-based (rather than time-based) nature.

---

## Key Differences: Sabre vs Foil/Epee

| Feature | Foil/Epee | Sabre |
|---------|-----------|-------|
| **Time Limit** | 3 minutes per period | No time limit |
| **Timer Display** | Countdown timer (3:00 → 0:00) | No timer display |
| **Match Start** | Play button starts timer | Match starts when first score is recorded |
| **Break Trigger** | Timer reaches 0:00 at end of period | Score reaches 8 points (when target is 15) |
| **Period Advancement** | Time-based (timer hits 0:00) | Score-based (break at 8, then continue to 15) |
| **Match Completion** | Timer OR target score | Target score only (15 or 5) |
| **Time Tracking** | Essential (countdown) | Not tracked (not relevant to sabre) |

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
| **Period Display** | ✅ Modified | Shows current period (1 or 2) | Score-based, not time-based |
| **Period Controls** | ✅ Modified | +/- period buttons | Score-based advancement only |
| **Break Functionality** | ✅ Modified | Break at 8 points (target 15) | Score-triggered, not time-triggered |
| **Break Timer** | ✅ Included | 1-minute break countdown | Still works, triggered differently |
| **Break Popup** | ✅ Included | "Take Break" / "Skip Break" options | Same UI, different trigger |
| **Yellow Cards** | ✅ Included | Issue yellow cards to fencers | Works identically |
| **Red Cards** | ✅ Included | Issue red cards to fencers | Works identically |
| **Injury Timer** | ✅ Included | 5-minute injury timer | Works identically |
| **Priority Assignment** | ✅ Included | Priority light and assignment | Works identically (if applicable) |
| **Match Completion** | ✅ Modified | Auto-complete at target score | Score-only, no timer wait |
| **Complete Match Button** | ✅ Included | Manual match completion | Available if needed |
| **Reset All** | ✅ Included | Reset entire match state | Works identically |
| **Reset Scores** | ✅ Included | Reset scores only | Works identically |
| **User Profile Toggle** | ✅ Included | Show/hide user profile | Works identically |
| **Offline Support** | ✅ Included | Works without internet | No time dependencies = easier |
| **Match Summary Navigation** | ✅ Included | Navigate to match summary | Works identically |
| **Timer Display** | ❌ Removed | Countdown timer (3:00 → 0:00) | Replaced with period/break status |
| **Play/Pause Button** | ❌ Removed | Start/pause match timer | Not needed (match starts on first score) |
| **Add/Subtract Time** | ❌ Removed | +/- time controls | No time to adjust |
| **Edit Time Button** | ❌ Removed | Edit match time duration | No time to edit |
| **Time Remaining Display** | ❌ Removed | Shows time left in period | Not applicable |
| **Period Status Indicator** | ✅ New | Shows "Period 1", "Break Time", "Period 2" | Replaces timer display |
| **Break Warning** | ✅ New | "Break at 8 points" indicator | Shows when approaching break |
| **Score-Based Period Logic** | ✅ New | Periods advance based on score | Period 1: 0-8, Period 2: 8-15 |
| **Target Score Tracking** | ✅ New | Tracks match target (15 or 5) | Used for break logic |

### Feature Status Legend
- ✅ **Included**: Feature is present and works (may be modified)
- ✅ **Modified**: Feature exists but works differently for sabre
- ✅ **New**: New feature specific to sabre
- ❌ **Removed**: Feature not available for sabre

---

## Confirmed Requirements

### 1. Timer Display - REMOVED
- **Decision**: No elapsed time display on remote
- **Reason**: Sabre fencers don't use time, so showing elapsed time provides no value
- **Implementation**: 
  - Hide timer display completely for sabre
  - Replace timer area with period/break status indicator
  - No time tracking in UI (background tracking not needed)

### 2. Match Start Logic
- **Decision**: Match starts when first score is recorded
- **Implementation**:
  - No play button needed for sabre
  - `hasMatchStarted` becomes `true` when first `match_event` is created
  - Match state: "Ready" → "Active" (on first score)
  - Use first event timestamp for match start time (if needed for database)

### 3. Break Logic - Score-Based
- **Decision**: Break triggers when either fencer reaches 8 points (only when target is 15)
- **Implementation**:
  ```typescript
  const targetScore = 15; // or 5 for pool matches
  const breakScore = 8;
  
  if (targetScore === 15 && 
      (scores.fencerA === breakScore || scores.fencerB === breakScore) &&
      !breakTriggered) {
    triggerBreak();
    setBreakTriggered(true);
  }
  ```
- **Break Popup**: Same as foil/epee ("Take Break" / "Skip Break")
- **Break Timer**: Still runs (1 minute), but triggered by score, not time

### 4. Period Advancement - Score-Based
- **Current (Foil/Epee)**: Periods advance when timer hits 0:00
- **Sabre**:
  - Period 1: 0 → 8 points (break at 8)
  - Period 2: 8 → 15 points (or 5 for pool)
  - Auto-advance when break is skipped or completed
  - No time-based period transitions

### 5. Match Completion
- **Decision**: Auto-complete when target score is reached
- **Implementation**:
  ```typescript
  if (scores.fencerA >= targetScore || scores.fencerB >= targetScore) {
    triggerMatchCompletion();
  }
  ```
- **Popup**: Show completion popup immediately when target is hit
- **No timer wait**: Match ends as soon as target score is reached

### 6. Time Tracking - NOT NEEDED
- **Decision**: Do not track elapsed time for sabre matches
- **Reasoning**:
  - Sabre fencers don't use time
  - No time-based metrics needed
  - Event sequence/order is sufficient for calculations
- **Database**:
  - `bout_length_s` can be `NULL` for sabre matches
  - `match_time_elapsed` not needed in `match_event` for sabre
  - Use event `timestamp` for ordering only

---

## UI Changes

### Timer Section Replacement
**Current (Foil/Epee):**
```
[Large countdown timer: 3:00]
[Play/Pause button]
```

**Sabre:**
```
[Period Status Indicator]
- "Period 1" (before break)
- "Break Time" (during break)
- "Period 2" (after break)
- "Break at 8" warning (when score is 7-7 and target is 15)
```

### Visual Layout
- **Remove**: Large timer display area
- **Replace with**: Compact period/break status card
- **Keep**: Score cards (prominent)
- **Add**: "Break at 8" indicator when approaching break point

### Status Indicators
```typescript
// Sabre status display
{selectedWeapon === 'sabre' ? (
  <View style={styles.periodStatusContainer}>
    <Text style={styles.periodStatus}>
      {isBreakTime 
        ? 'Break Time' 
        : `Period ${currentPeriod}`}
    </Text>
    {targetScore === 15 && 
     (scores.fencerA === 7 || scores.fencerB === 7) && 
     !isBreakTime && (
      <Text style={styles.breakWarning}>
        Break at 8 points
      </Text>
    )}
  </View>
) : (
  // Foil/Epee: Show timer as normal
  <TimerDisplay ... />
)}
```

---

## State Management

### New State Variables
```typescript
// Sabre-specific state
const [matchTargetScore, setMatchTargetScore] = useState(15); // 15 or 5
const [breakTriggered, setBreakTriggered] = useState(false); // Track if break at 8 was triggered
```

### Modified State Logic
```typescript
// hasMatchStarted logic
const hasMatchStarted = selectedWeapon === 'sabre'
  ? (scores.fencerA > 0 || scores.fencerB > 0) // First score starts match
  : (isPlaying || timeRemaining < matchTime); // Timer-based for foil/epee

// isBreakTime logic
const isBreakTime = selectedWeapon === 'sabre'
  ? (breakTimerActive && breakTriggered) // Score-triggered break
  : (breakTimerActive && timeRemaining === 0); // Time-triggered break
```

---

## Break Logic Implementation

### Break Trigger Condition
```typescript
const checkSabreBreak = (newScore: number, entity: 'fencerA' | 'fencerB') => {
  if (selectedWeapon !== 'sabre') return;
  
  const targetScore = matchTargetScore; // 15 or 5
  const breakScore = 8;
  
  // Only trigger break if:
  // 1. Target is 15 (not pool matches with target 5)
  // 2. Score just reached 8
  // 3. Break hasn't been triggered yet
  if (targetScore === 15 && 
      newScore === breakScore && 
      !breakTriggered) {
    
    // Show break popup
    Alert.alert(
      'Break at 8 Points',
      'Take a break before continuing to 15?',
      [
        { 
          text: 'Skip Break', 
          onPress: async () => {
            setBreakTriggered(true);
            await transitionToNextPeriod(2);
          }
        },
        { 
          text: 'Take Break', 
          onPress: () => {
            setBreakTriggered(true);
            startBreakTimer();
          }
        }
      ]
    );
  }
};
```

### Period Structure for Sabre
```typescript
// Period 1: 0 → 8 (break at 8)
// Period 2: 8 → 15 (or 5)

const getSabrePeriod = (fencerAScore: number, fencerBScore: number): number => {
  const maxScore = Math.max(fencerAScore, fencerBScore);
  
  if (maxScore < 8) return 1;
  if (maxScore >= 8 && maxScore < matchTargetScore) return 2;
  return 2; // Period 2 continues until match ends
};
```

---

## Match Event Tracking

### Event Timestamps
- **Keep**: `timestamp` field for event ordering
- **Remove**: `match_time_elapsed` calculation for sabre
- **Use**: Event sequence number for progression calculations

### Event Creation
```typescript
// When scoring in sabre
const createSabreEvent = async (entity: 'fencerA' | 'fencerB') => {
  const event = {
    match_id: matchId,
    scoring_user_name: entity === 'fencerA' ? fencerNames.fencerA : fencerNames.fencerB,
    timestamp: new Date().toISOString(),
    // NO match_time_elapsed for sabre
    fencer_1_name: fencerNames.fencerA,
    fencer_2_name: fencerNames.fencerB,
    event_type: 'score',
    // ... other fields
  };
  
  await matchEventService.createEvent(event);
  
  // Check for break trigger
  checkSabreBreak(newScore, entity);
  
  // Check for match completion
  if (newScore >= matchTargetScore) {
    await completeMatch();
  }
};
```

---

## Database Considerations

### Match Table
- `weapon_type`: Set to `'sabre'` for sabre matches
- `bout_length_s`: Can be `NULL` for sabre (not meaningful)
- `final_score`: Still tracked (target score reached)
- `final_period`: Set to `2` (sabre has 2 periods: before/after break)

### Match Event Table
- `match_time_elapsed`: Can be `NULL` for sabre events
- `timestamp`: Required (for event ordering)
- Event sequence: Use `ROW_NUMBER()` or array index for progression

### Match Period Table
- Period 1: `start_time` = match start, `end_time` = break start (or period 2 start if break skipped)
- Period 2: `start_time` = break end (or period 1 end), `end_time` = match end
- `period_number`: 1 or 2

---

## Files to Modify

### Primary File
- `app/(tabs)/remote.tsx`
  - Add sabre-specific timer display replacement
  - Implement score-based break logic
  - Modify period advancement logic
  - Update match start logic
  - Add period/break status indicator component

### Supporting Files
- `lib/database.ts` / `matchService.ts`
  - Update match creation to handle sabre (no time tracking)
  - Modify event creation to skip `match_time_elapsed` for sabre
- `lib/offlineRemoteService.ts`
  - Ensure sabre matches work offline (no time dependencies)

---

## Implementation Phases

### Phase 1: UI Changes
- [ ] Hide timer display when sabre is selected
- [ ] Create period/break status indicator component
- [ ] Replace timer area with status indicator
- [ ] Add "Break at 8" warning indicator
- [ ] Test UI layout and responsiveness

### Phase 2: Break Logic
- [ ] Implement score-based break trigger (8 points when target is 15)
- [ ] Update break popup to show for sabre
- [ ] Ensure break timer still works (1 minute)
- [ ] Handle break skip logic
- [ ] Test break at various score combinations

### Phase 3: Period Logic
- [ ] Implement score-based period calculation
- [ ] Update period advancement (no time dependency)
- [ ] Ensure period transitions work correctly
- [ ] Test period 1 → break → period 2 flow

### Phase 4: Match Start/End
- [ ] Remove play button requirement for sabre
- [ ] Implement first-score match start
- [ ] Implement auto-completion at target score
- [ ] Test match completion popup
- [ ] Ensure match data saves correctly

### Phase 5: Database & Events
- [ ] Update event creation to skip `match_time_elapsed` for sabre
- [ ] Ensure `bout_length_s` can be NULL
- [ ] Test event ordering (timestamp-based)
- [ ] Verify match summary calculations work without time

### Phase 6: Testing
- [ ] Test complete sabre match flow (0 → 8 → break → 15)
- [ ] Test break skip functionality
- [ ] Test match completion at target score
- [ ] Test reset functionality
- [ ] Test offline sabre matches
- [ ] Verify match summary displays correctly

---

## Match Summary Integration

### Sabre-Specific Metrics (for match summary page)
These are tracked and displayed on the match summary page, not the remote:

1. **Momentum Shifts**
   - Track: 3 consecutive hits = momentum shift
   - Display: Number of momentum shifts per fencer
   - Calculation: Count streaks of 3+ consecutive scores

2. **Score-Based Leading Percentage**
   - Track: Percentage of match where each fencer led (based on number of hits, not time)
   - Display: Percentage breakdown (fencer1%, fencer2%, tied%)
   - Calculation: Count events where each fencer was leading, divide by total events

*Note: See `SABRE_MATCH_SUMMARY_PLANNING.md` for detailed match summary requirements.*

---

## Edge Cases & Considerations

### Pool Matches (Target Score = 5)
- No break at 8 (break only applies when target is 15)
- Match goes directly 0 → 5
- Single period (no break)

### Break Skipped
- If user skips break, period 2 starts immediately
- `breakTriggered` flag prevents re-triggering
- Period transition happens automatically

### Match Reset
- Reset `breakTriggered` flag
- Reset period to 1
- Clear all scores
- Weapon selection reappears

### Offline Matches
- All sabre logic must work offline
- Break triggers work the same
- Period tracking works the same
- No time dependencies = easier offline handling

---

## Questions Resolved

✅ **Match Start**: First score starts the match (no play button needed)  
✅ **Time Tracking**: Not tracked (not relevant to sabre)  
✅ **Timer Display**: Removed (replaced with period/break status)  
✅ **Break Logic**: Score-based (8 points when target is 15)  
✅ **Period Advancement**: Score-based (no time dependency)  
✅ **Match Completion**: Auto-complete at target score  

---

## Notes

- Sabre remote is significantly simpler than foil/epee (no timer complexity)
- Focus on score-based logic throughout
- Event ordering uses timestamps, but no time calculations needed
- Match summary will have sabre-specific metrics (momentum, score-based leading)
- All existing functionality (cards, periods, etc.) remains, just triggered differently





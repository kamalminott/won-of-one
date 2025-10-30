# Fencing Remote - Comprehensive Testing Guide

## Overview
This document provides systematic testing procedures for all fencing remote features.

---

## Test 1: Priority Round (Tie-Break) Functionality

### Setup
1. Start a match in period 3
2. Score to tie the match (e.g., 14-14)
3. Let timer reach 0:00

### Expected Behavior
- Timer expires with scores tied
- No automatic priority assignment
- User must manually click "Priority" button
- User chooses which fencer gets priority (left or right)
- Priority light appears on chosen side
- Next touch ends the match

### Test Steps
```
Step 1: Create a tie scenario
  1. Start timer
  2. Score to 14-14
  3. Let timer count down to 0:00
  4. Verify: Timer expires, scores remain tied

Step 2: Assign priority
  1. Click "Priority" button
  2. Choose priority position (left or right)
  3. Verify: Priority light appears on chosen side
  4. Verify: isPriorityRound = true

Step 3: Score on priority
  1. Score with fencer who has priority
  2. Verify: Alert shows "Priority Touch Scored!"
  3. Verify: User can confirm if they won on priority
  4. Verify: Match completes if yes

Step 4: Score without priority
  1. Score with fencer who doesn't have priority
  2. Verify: Match continues
  3. Verify: Next touch by priority fencer can still win
```

### Potential Issues to Check
- ❌ Priority round automatically triggering (should be manual)
- ❌ Priority light not appearing
- ❌ Priority popup not showing on first score
- ❌ Match not completing when priority fencer wins

---

## Test 2: Period Transitions (1→2, 2→3)

### Setup
Start a match in period 1

### Expected Behavior
- Period increments when timer expires (for periods 1 and 2)
- Current period is tracked in state
- Match periods are saved to database
- Previous period is marked complete with end_time
- New period starts with fresh timer

### Test Steps
```
Step 1: Period 1 → Period 2
  1. Start match
  2. Score some points (e.g., 5-3)
  3. Let timer reach 0:00
  4. Verify: Alert shows "Match Time Complete! Next: Period 2"
  5. Verify: User can start Period 2 or end match
  6. Click "Start Period 2"
  7. Verify: currentPeriod = 2
  8. Verify: Timer resets to 3:00
  9. Verify: Previous period saved with end_time

Step 2: Period 2 → Period 3
  1. Score some points (e.g., 10-8)
  2. Let timer reach 0:00
  3. Verify: Alert shows "Match Time Complete! Next: Period 3"
  4. Verify: User can start Period 3 or end match
  5. Click "Start Period 3"
  6. Verify: currentPeriod = 3
  7. Verify: Timer resets to 3:00
  8. Verify: Previous period saved with end_time

Step 3: Period 3 Completion (Tied Scenario)
  1. Score to tie (e.g., 14-14)
  2. Let timer reach 0:00
  3. Verify: Alert shows "Match tied!"
  4. Verify: User must manually assign priority
  5. Verify: Priority button is enabled

Step 4: Period 3 Completion (Winner Scenario)
  1. Score to a winner (e.g., 15-12)
  2. Let timer reach 0:00 OR complete match
  3. Verify: Match can be completed
  4. Verify: Final score saved
```

### Potential Issues to Check
- ❌ Period not incrementing
- ❌ Previous period not marked complete
- ❌ New period not starting with fresh timer
- ❌ Database records not saving correctly
- ❌ Period counter UI not updating

---

## Test 3: Complete Match Flow (Start to Finish)

### End-to-End Flow
```
1. User opens Remote screen
2. Sets fencer names (Alice and Bob)
3. Starts timer
4. Scores some points
5. Completes period 1
6. Starts period 2
7. Scores more points
8. Completes period 2
9. Starts period 3
10. Scores to a winner (e.g., 15-13)
11. Clicks "Complete Match" button
12. Views match summary
13. Checks match history
```

### Test Steps
```
Step 1: Setup
  1. Open Remote screen
  2. Verify: Empty state (0-0, Period 1, 3:00)
  3. Set names: "Alice" and "Bob"
  4. Verify: Names update in UI

Step 2: Start Match
  1. Click Play button
  2. Verify: Timer starts counting down
  3. Verify: Remote session created in database
  4. Verify: Match period record created
  5. Verify: matchStartTime is set

Step 3: Score Points
  1. Score for Alice 5 times (5-0)
  2. Verify: Alice score updates
  3. Verify: Match events logged to database
  4. Score for Bob 3 times (5-3)
  5. Verify: Bob score updates
  6. Verify: Match events logged

Step 4: Complete Period 1
  1. Let timer reach 0:00
  2. Verify: Alert appears
  3. Click "Start Period 2"
  4. Verify: Period increments
  5. Verify: Timer resets to 3:00
  6. Verify: Previous period saved with end_time

Step 5: Period 2
  1. Score more points (10-8)
  2. Let timer reach 0:00
  3. Click "Start Period 3"
  4. Verify: Period increments again
  5. Verify: Timer resets

Step 6: Complete Match
  1. Score to a winner (15-10)
  2. Click "Complete Match" button (🏁)
  3. Verify: Match completion modal appears
  4. Verify: Final score shown (15-10)
  5. Confirm completion
  6. Verify: Match saved to database with is_complete = true
  7. Verify: Match appears in match history

Step 7: View Match
  1. Navigate to match history
  2. Find the completed match
  3. Click to view details
  4. Verify: Score, periods, duration all correct
```

### Database Checks
```sql
-- Check match record
SELECT * FROM match WHERE remote_id = '<session_id>' ORDER BY created_at DESC LIMIT 1;

-- Check match periods
SELECT * FROM match_period WHERE match_id = '<match_id>' ORDER BY period_number;

-- Check match events
SELECT * FROM match_event WHERE fencing_remote_id = '<session_id>' ORDER BY timestamp;
```

### Potential Issues to Check
- ❌ Remote session not created
- ❌ Match period not created
- ❌ Match events not logged
- ❌ Match not appearing in history
- ❌ Scores incorrect in summary
- ❌ Period data missing

---

## Test 4: Cards Functionality (Yellow/Red)

### Setup
Start a match and begin scoring

### Expected Behavior
- Cards can be added via card buttons
- Yellow card shown before red card
- Cards tracked per fencer (Alice and Bob)
- Cards saved to database with match periods
- Cards reset when match is reset

### Test Steps
```
Step 1: Add Cards
  1. Start match
  2. Score some points
  3. Click "Yellow Card" button for Alice
  4. Verify: aliceCards.yellow = 1
  5. Verify: UI shows yellow card indicator
  6. Click "Yellow Card" button for Alice again
  7. Verify: aliceCards.yellow = 1 (stays at 1, can't have multiple yellows)
  8. Click "Red Card" button for Alice
  9. Verify: aliceCards.red = 1
  10. Verify: UI shows both yellow and red cards

Step 2: Track Cards Per Fencer
  1. Add yellow card for Bob
  2. Verify: bobCards.yellow = 1
  3. Verify: aliceCards still shows 1 yellow, 1 red
  4. Verify: bobCards shows 1 yellow, 0 red
  5. Add red card for Bob
  6. Verify: bobCards.red = 1

Step 3: Cards Saved to Database
  1. Complete match
  2. Check database record
  3. Verify: fencer_1_cards = aliceCards.yellow + aliceCards.red
  4. Verify: fencer_2_cards = bobCards.yellow + bobCards.red

Step 4: Reset Cards
  1. Add some cards
  2. Click "Reset All"
  3. Verify: All cards reset to 0
  4. Verify: aliceCards = { yellow: 0, red: 0 }
  5. Verify: bobCards = { yellow: 0, red: 0 }
```

### Potential Issues to Check
- ❌ Cards not incrementing
- ❌ Cards not saving to database
- ❌ Multiple yellow cards allowed (should max at 1)
- ❌ Cards not resetting
- ❌ UI not showing card indicators

---

## Test 5: Edge Cases and Bug Fixes

### Test Scenarios

#### Scenario 1: Rapid Score Changes
```
1. Score for Alice 10 times in quick succession
2. Verify: Each score increment logs a separate match event
3. Verify: Timer doesn't affect scoring
4. Verify: No race conditions or lost events
```

#### Scenario 2: Timer Interruptions
```
1. Start timer
2. Background the app
3. Wait 30 seconds
4. Return to app
5. Verify: Timer has not continued running
6. Verify: Resume prompt appears
7. Resume match
8. Verify: Timer continues from correct time
```

#### Scenario 3: Match State Persistence
```
1. Start match
2. Score some points (5-3)
3. Navigate away to another tab
4. Return to Remote tab
5. Verify: Match state restored
6. Verify: Scores correct (5-3)
7. Verify: Timer paused correctly
```

#### Scenario 4: Network Failures
```
1. Disable network
2. Start match
3. Score points
4. Complete match
5. Verify: Match events queued locally
6. Re-enable network
7. Verify: Events sync to database
```

#### Scenario 5: App Force Close
```
1. Start match
2. Score points
3. Force close app (swipe away)
4. Re-open app
5. Navigate to Remote
6. Verify: Resume prompt appears
7. Resume match
8. Verify: All state correct
```

#### Scenario 6: Multiple Users
```
1. Create match
2. Add opponent image and name
3. Verify: User toggle works correctly
4. Verify: Names persist when toggled
5. Verify: Match linked to correct user_id
```

### Potential Issues to Check
- ❌ Match state lost on app restart
- ❌ Events not syncing after network reconnect
- ❌ Race conditions on rapid interactions
- ❌ Memory leaks on long matches
- ❌ Database deadlocks

---

## Running Tests

### Manual Testing
Follow the test steps above for each feature.

### Automated Testing (TODO)
Create unit tests for:
- Priority round logic
- Period transition logic
- Match completion logic
- Card tracking logic
- State persistence

---

## Success Criteria

✅ All priority round features work correctly
✅ Period transitions save data properly
✅ Complete match flow end-to-end works
✅ Cards save and display correctly
✅ Edge cases handled gracefully
✅ No crashes or data loss

---

## Known Issues (To Fix)

1. [ ] Priority round auto-triggering (should be manual)
2. [ ] Cards not saving to database in some scenarios
3. [ ] Period transitions sometimes creating duplicate records
4. [ ] Resume prompt appearing when not needed
5. [ ] Network failure handling incomplete



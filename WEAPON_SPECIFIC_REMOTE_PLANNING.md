# Weapon-Specific Remote Implementation Planning

## Overview
Implement weapon-specific remotes (Foil, Epee, Sabre) with different features and UI adaptations based on the selected weapon.

---

## Confirmed Requirements

### 1. Weapon Selection UI
- **Location**: Remote page, above the match countdown
- **Display**: Three circular buttons with weapon icons
  - Foil icon
  - Epee icon
  - Sabre icon
- **Visibility**:
  - Visible before match starts (during countdown)
  - Hidden once match starts
  - Reappears when "Reset All" is clicked (match resets to pre-match state)

### 2. Default Weapon Selection
- **Priority**:
  1. User's `preferred_weapon` from profile/settings
  2. Weapon selected during onboarding
  3. Default to Foil if no preference exists
- **Source**: User profile field `preferred_weapon`

### 3. Epee-Specific Features
- **Double Hit Button**:
  - **Function**: Score both fencers simultaneously (+1 each)
  - **Location**: Below the switch fencer button, centered between both fencer cards
  - **Layout**: Switch button moves up, double hit button appears below it
  - **Visibility**: Only visible when Epee is selected

### 4. Sabre-Specific Features
- **Timer/Play Button**: 
  - Sabre matches don't use a time limit
  - **Status**: ⚠️ **DECISION PENDING** - See questions below

### 5. Reset Logic
- **Behavior**: All reset logic remains the same regardless of weapon selection
- **Weapon Selection**: Reappears when "Reset All" is clicked (back to pre-match state)

### 6. Weapon Icons
- **Status**: User has specific icons/images to use
- **Location**: ⚠️ **TO BE DETERMINED** - Need to know where icons are located or if they need to be added to assets folder

---

## Pending Decisions

### Sabre Match Behavior

#### Question 1: How should a Sabre match start?
- [ ] Option A: Remove play button entirely; match starts when first score is recorded
- [ ] Option B: Keep "Start Match" button (no timer, just marks match start)
- [ ] Option C: Match auto-starts when weapon is selected

#### Question 2: What should we track for Sabre matches?
- [ ] Option A: Time elapsed (for stats only, no limit)
- [ ] Option B: Just score progression (no time tracking)
- [ ] Option C: Both time elapsed and score progression

#### Question 3: For match completion in Sabre:
- [ ] Option A: Auto-complete when target score is reached (15 or 5)
- [ ] Option B: Manual "Finish Match" button when target is reached
- [ ] Option C: Both (auto-detect but allow manual override)

#### Question 4: Should the timer display be hidden for Sabre, or show elapsed time for stats?
- [ ] Option A: Completely hidden
- [ ] Option B: Show elapsed time (for statistics)
- [ ] Option C: Show "No Time Limit" text

---

## Technical Implementation Notes

### Files to Modify
- `app/(tabs)/remote.tsx` - Main remote screen
  - Add weapon selection UI
  - Add weapon state management
  - Conditionally show/hide timer for Sabre
  - Add double hit button for Epee
  - Adjust switch button position when Epee is selected

### Database Considerations
- `weapon_type` field already exists in `match` table
- `preferred_weapon` field exists in user profile
- Need to ensure weapon type is saved with match data

### State Management
- Add `selectedWeapon` state: `'foil' | 'epee' | 'sabre'`
- Initialize from user's `preferred_weapon` or default to 'foil'
- Track if match has started to hide weapon selection

### UI Components Needed
1. Weapon selection circles (3 buttons with icons)
2. Double hit button (Epee only)
3. Conditional timer/play button visibility (Sabre)

---

## Implementation Checklist

### Phase 1: Weapon Selection UI
- [ ] Create weapon selection component (3 circular buttons)
- [ ] Add weapon icons/images to assets
- [ ] Position above match countdown
- [ ] Implement visibility logic (show before match, hide after start)
- [ ] Load default weapon from user profile

### Phase 2: Weapon-Specific Features
- [ ] **Epee**: Add double hit button
  - [ ] Position below switch button, centered
  - [ ] Move switch button up
  - [ ] Implement double scoring logic
- [ ] **Sabre**: Timer/play button handling
  - [ ] ⚠️ Awaiting decisions on Sabre behavior

### Phase 3: Match Logic
- [ ] Save weapon type with match data
- [ ] Ensure reset logic preserves weapon selection visibility
- [ ] Handle match start/end based on weapon rules

### Phase 4: Testing
- [ ] Test weapon selection visibility
- [ ] Test Epee double hit functionality
- [ ] Test Sabre match flow (once decisions made)
- [ ] Test reset behavior with all weapons
- [ ] Test default weapon loading from profile

---

## Questions for User

1. **Weapon Icons**: Where are the weapon icon images located? Do they need to be added to the assets folder?

2. **Sabre Match Behavior**: See "Pending Decisions" section above - need answers to 4 questions about Sabre timer/start/completion behavior.

---

## Notes
- Remote UI remains 99% the same across all weapons
- Only slight changes: button visibility, additional buttons, timer handling
- All existing functionality (cards, periods, etc.) remains unchanged


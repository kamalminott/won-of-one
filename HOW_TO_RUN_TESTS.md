# How to Run Fencing Remote Tests

## Overview
The test document I created is a **manual testing guide**, not automated tests. It provides step-by-step procedures to verify that all features work correctly.

---

## How to Use the Test Document

The `FENCING_REMOTE_TESTS.md` file contains:

1. **Test procedures** - Step-by-step instructions
2. **Expected behaviors** - What should happen
3. **Potential issues** - What to watch out for

---

## Running the Tests

### **Option 1: Test Each Feature Manually**

Follow the test steps in `FENCING_REMOTE_TESTS.md`:

#### Test 1: Priority Round
1. Open the Remote screen
2. Start a match
3. Go to Period 3
4. Score to a tie (e.g., 14-14)
5. Let timer expire
6. Click "Priority" button
7. Check if priority light appears
8. Score and verify match completes

**✅ Success:** Priority round works, match completes correctly

---

#### Test 2: Period Transitions
1. Start a match
2. Let timer expire in Period 1
3. Click "Start Period 2"
4. Verify period increments
5. Repeat for Period 3

**✅ Success:** Period increments, data saves correctly

---

#### Test 3: Complete Match Flow
1. Start match
2. Score points
3. Complete all 3 periods
4. Complete match
5. View in match history

**✅ Success:** Match appears in history with correct data

---

#### Test 4: Cards
1. Add yellow card
2. Add red card
3. Complete match
4. Verify cards saved to database

**✅ Success:** Cards display and save correctly

---

### **Option 2: Check Database Directly**

You can verify by checking the database:

```sql
-- Run these in Supabase SQL editor

-- Check if matches are being saved
SELECT * FROM match 
WHERE is_complete = true 
ORDER BY created_at DESC 
LIMIT 5;

-- Check match periods
SELECT * FROM match_period 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if cards are being saved
SELECT fencer_1_cards, fencer_2_cards 
FROM match_period 
WHERE fencer_1_cards > 0 OR fencer_2_cards > 0;
```

**✅ Success:** Data appears in database with correct values

---

## What Success Looks Like

### ✅ **Priority Round Works:**
- Priority button appears when needed
- Priority light shows on correct side
- Match completes when priority fencer scores

### ✅ **Periods Work:**
- Period increments from 1→2→3
- Each period saves with start_time and end_time
- Timer resets correctly

### ✅ **Match Completion Works:**
- Complete button (🏁) appears
- Match saves to database
- Match appears in history
- All data is correct (scores, periods, duration)

### ✅ **Cards Work:**
- Yellow and red card buttons work
- Cards display in UI
- Cards save to database (fencer_1_cards, fencer_2_cards)

---

## How to Check Results

### **1. Visual Verification**
- Open the Remote screen
- Follow the test steps
- See if UI behaves correctly

### **2. Database Verification**
- Check Supabase dashboard
- Run SQL queries to verify data
- Confirm all fields are populated

### **3. Match History Verification**
- Complete a test match
- Go to Match History
- Check if match appears
- Click to view details
- Verify all data is correct

---

## What to Test First

I recommend starting with **Test 3: Complete Match Flow** because:

1. ✅ It tests most features together
2. ✅ You'll see results immediately in match history
3. ✅ It's the most important user journey

### Quick Test Process:
```
1. Open app
2. Go to Remote tab
3. Start match
4. Score some points
5. Complete period 1
6. Complete period 2
7. Score to winner in period 3
8. Click "Complete Match" 🏁
9. Check match history
10. Verify everything is correct
```

**If this works, the fencing remote is working!** 🎉

---

## If Tests Fail

If something doesn't work:

1. Note the specific step where it fails
2. Check console logs for errors
3. Check database to see what was saved
4. Check the test document for potential issues
5. We can fix any bugs found

---

## Summary

- **These are manual tests** - You run them yourself
- **Start with Test 3** - Complete match flow
- **Check results** - Visual, database, or history
- **Report issues** - If anything doesn't work

The tests document tells you **how to verify everything works** - it's like a checklist!



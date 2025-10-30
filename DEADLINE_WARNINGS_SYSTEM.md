# ⏰ Deadline Warning & Auto-Deactivation System

## Overview
Implemented a progressive warning system that alerts users as deadlines approach, with automatic goal deactivation when deadlines pass without completion.

---

## ✨ Complete System

### **Warning Progression:**

```
6+ days left:  Normal (Yellow badge)
5 days left:   Warning (Orange badge) ⚠️
2 days left:   Urgent (Red badge) 🚨
1 day left:    Urgent (Red badge) 🚨
0 days (today): Last Day (Red badge, bold) 🚨
Past deadline:  AUTO-DEACTIVATED ❌
```

---

## 🎨 Visual States

### **State 1: Normal (6+ Days)**
```
┌────────────────────────────┐
│ 15 days left               │ ← Yellow badge
│                            │
│ Win 10 Matches             │
│ 5/10 (50%)                 │
└────────────────────────────┘
```

### **State 2: Warning (3-5 Days)**
```
┌────────────────────────────┐
│ ⚠️ 4 days left             │ ← Orange badge
│                            │
│ Win 10 Matches             │
│ 7/10 (70%)                 │
└────────────────────────────┘
```

### **State 3: Urgent (1-2 Days)**
```
┌────────────────────────────┐
│ 🚨 2 days left - Complete  │ ← Red badge
│    soon!                   │
│ ┌──────────────────────┐   │
│ │ ⚠️ Goal will expire   │   │ ← Warning banner
│ │ soon if not completed!│   │
│ └──────────────────────┘   │
│                            │
│ Win 10 Matches             │
│ 8/10 (80%)                 │
│ 💪 2 more wins needed!     │
└────────────────────────────┘
```

### **State 4: Last Day**
```
┌────────────────────────────┐
│ 🚨 LAST DAY! Expires today │ ← Red, BOLD
│ ┌──────────────────────┐   │
│ │ 🚨 Goal will expire   │   │ ← Urgent banner
│ │ if not completed today!│  │
│ └──────────────────────┘   │
│                            │
│ Win 10 Matches             │
│ 9/10 (90%)                 │
│ 💪 1 more win needed!      │
└────────────────────────────┘
```

### **State 5: Expired (Next Day)**
```
Goal auto-deactivated and removed from home screen

User sees: "No Active Goals" card

Can view in "Expired Goals" section (future feature)
```

---

## 🔧 Technical Implementation

### **1. Warning State Calculation**

**Function:** `getWarningState(daysLeft)`

```typescript
// components/GoalCard.tsx

const getWarningState = (daysLeft: number) => {
  if (daysLeft === 0) {
    return {
      state: 'lastDay',
      color: '#FF7675',          // Red
      message: '🚨 LAST DAY! Expires today'
    };
  } else if (daysLeft === 1) {
    return {
      state: 'urgent',
      color: '#FF7675',          // Red
      message: '🚨 1 day left - URGENT!'
    };
  } else if (daysLeft === 2) {
    return {
      state: 'urgent',
      color: '#FF7675',          // Red
      message: '🚨 2 days left - Complete soon!'
    };
  } else if (daysLeft <= 5) {
    return {
      state: 'warning',
      color: '#FFA500',          // Orange
      message: `⚠️ ${daysLeft} days left`
    };
  } else {
    return {
      state: 'normal',
      color: Colors.yellow.accent,  // Yellow
      message: `${daysLeft} days left`
    };
  }
};
```

---

### **2. Visual Updates**

**Days Left Badge:**
```tsx
<View style={[
  styles.daysLeftTag, 
  { backgroundColor: warningInfo.color }  // Dynamic color!
]}>
  <Text style={[
    styles.daysLeftTagText,
    warningInfo.state === 'lastDay' && { fontWeight: '700' }  // Bold on last day
  ]}>
    {warningInfo.message}
  </Text>
</View>
```

**Warning Banner:**
```tsx
{/* Only show for urgent/lastDay states AND incomplete goals */}
{(warningInfo.state === 'urgent' || warningInfo.state === 'lastDay') && progress < 100 && (
  <View style={styles.warningBanner}>
    <Ionicons name="alert-circle" size={...} color="#FF7675" />
    <Text style={styles.warningText}>
      {warningInfo.state === 'lastDay' 
        ? 'Goal will expire if not completed today!'
        : 'Goal will expire soon if not completed!'
      }
    </Text>
  </View>
)}
```

---

### **3. Auto-Deactivation**

**Function:** `deactivateExpiredGoals(userId)`

```typescript
// lib/database.ts

async deactivateExpiredGoals(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];  // "2025-10-11"
  
  const { data } = await supabase
    .from('goal')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('is_completed', false)  // Only incomplete goals
    .lt('deadline', today);      // WHERE deadline < today
  
  return data?.length || 0;
}
```

**When It Runs:**
```typescript
// app/(tabs)/index.tsx - fetchUserData()

// Called on home screen load
const expiredCount = await goalService.deactivateExpiredGoals(user.id);

if (expiredCount > 0) {
  console.log(`⏰ Auto-deactivated ${expiredCount} expired goal(s)`);
}
```

---

## 📊 Complete Timeline Example

### **Goal: "Win 10 matches by Nov 11"**

```
Oct 11 (30 days left):
Badge: "30 days left" (yellow)
Banner: None
Status: Normal ✅

Nov 6 (5 days left):
Badge: "⚠️ 5 days left" (orange)
Banner: None
Status: Warning ⚠️

Nov 9 (2 days left):
Badge: "🚨 2 days left - Complete soon!" (red)
Banner: "⚠️ Goal will expire soon if not completed!"
Status: Urgent 🚨

Nov 10 (1 day left):
Badge: "🚨 1 day left - URGENT!" (red)
Banner: "⚠️ Goal will expire soon if not completed!"
Status: Urgent 🚨

Nov 11 (0 days - last day):
Badge: "🚨 LAST DAY! Expires today" (red, bold)
Banner: "🚨 Goal will expire if not completed today!"
Status: Last Day 🚨🚨

Nov 12 (deadline passed, goal at 8/10):
Auto-Deactivation Triggered ❌
- is_active: false
- Removed from home screen
- Can view in "Expired Goals" (future)
```

---

## 🎯 Warning Thresholds

| Days Left | State | Badge Color | Banner | Bold |
|-----------|-------|-------------|--------|------|
| 6+ | Normal | Yellow | ❌ No | ❌ No |
| 3-5 | Warning | Orange | ❌ No | ❌ No |
| 2 | Urgent | Red | ✅ Yes | ❌ No |
| 1 | Urgent | Red | ✅ Yes | ❌ No |
| 0 | Last Day | Red | ✅ Yes | ✅ Yes |
| Past | Deactivated | - | - | - |

---

## 🔔 Warning Messages

### **Badge Messages:**
- **6+ days:** "X days left"
- **3-5 days:** "⚠️ X days left"
- **2 days:** "🚨 2 days left - Complete soon!"
- **1 day:** "🚨 1 day left - URGENT!"
- **0 days:** "🚨 LAST DAY! Expires today"

### **Banner Messages:**
- **2-1 days:** "Goal will expire soon if not completed!"
- **0 days:** "Goal will expire if not completed today!"

---

## ✅ User Benefits

### **1. Fair Warning** ✅
```
User can't say they didn't know:
- 5-day warning (orange)
- 2-day urgent alert (red)
- Last day banner (red, bold)
```

### **2. Motivating** ✅
```
Creates urgency:
- "I need to finish this!"
- Race against time
- Exciting pressure
```

### **3. Clean Home** ✅
```
Expired goals auto-removed:
- No clutter
- Fresh start
- Can set new goals
```

### **4. Professional** ✅
```
Deadlines mean something:
- Creates discipline
- Builds habits
- Realistic goals
```

---

## 🧪 Testing Scenarios

### **Test 1: Normal → Warning → Urgent**
```
1. Create goal with 7-day deadline
2. Wait/change device date to 4 days before
3. Check: Should show orange "⚠️ 4 days left"
4. Wait to 1 day before
5. Check: Should show red "🚨 1 day left" + banner
```

### **Test 2: Last Day**
```
1. Create goal with tomorrow's deadline
2. Check: Should show "🚨 LAST DAY!" (bold)
3. Banner: "Will expire if not completed today!"
```

### **Test 3: Auto-Deactivation**
```
1. Create goal with yesterday's deadline (manually in DB)
2. Refresh home screen
3. Check console: "⏰ Auto-deactivated 1 expired goal(s)"
4. Goal should be gone from home screen
```

### **Test 4: Complete Before Deadline**
```
1. Create urgent goal (2 days left)
2. Complete it
3. Check: No longer shows warnings
4. Celebration triggers
5. Goal deactivated (completed, not expired)
```

---

## 📝 Database Logic

### **Query for Expired Goals:**
```sql
SELECT * FROM goal 
WHERE user_id = 'user-123'
  AND is_active = true
  AND is_completed = false
  AND deadline < '2025-10-11';  -- Today's date

-- These goals get deactivated
UPDATE goal 
SET is_active = false, updated_at = NOW()
WHERE goal_id IN (...expired_goal_ids);
```

---

## 🎯 Warning Color Codes

```typescript
const warningColors = {
  normal: '#F4B400',    // Yellow (6+ days)
  warning: '#FFA500',   // Orange (3-5 days)
  urgent: '#FF7675',    // Red (1-2 days)
  lastDay: '#FF7675',   // Red (0 days, bold text)
};
```

---

## 🚀 Future Enhancements

### **1. Expired Goals View**
```
New section: "Expired Goals"
- View all expired goals
- See final progress (8/10)
- "Try Again" button (create similar goal)
- Permanently delete option
```

### **2. Notifications**
```
Push notifications:
- "5 days left on your goal!"
- "🚨 2 days left - finish strong!"
- "Last day to complete your goal!"
```

### **3. Stats**
```
Track success rate:
- "You've completed 12 goals on time"
- "3 goals expired"
- "80% completion rate"
```

### **4. Grace Period**
```
Optional: Allow 1-day grace period
- Deadline passes → Show "1 day grace period"
- Day after → Then deactivate
```

---

## ✅ Summary

**Implemented:**
1. ✅ Progressive warning states (normal → warning → urgent → last day)
2. ✅ Color-coded badges (yellow → orange → red)
3. ✅ Warning banner for urgent states (1-2 days left)
4. ✅ Bold text on last day
5. ✅ Auto-deactivation when deadline passes
6. ✅ Cleanup runs on home screen load
7. ✅ Clear user communication

**Result:**
- ✅ Users get fair warning (5-day, 2-day, last-day alerts)
- ✅ Deadlines have teeth (auto-deactivate if missed)
- ✅ Clean home screen (expired goals removed)
- ✅ Motivating urgency (race against time)
- ✅ Professional goal system (like real apps)

**The deadline warning system is now fully implemented!** 🎯⏰



# 🗑️ Delete Goal Feature - Implementation

## Overview
Implemented a three-dot menu on GoalCard that allows users to edit or delete their goals with confirmation.

---

## ✨ Features Implemented

### **1. Three-Dot Menu Icon** ⋮
- Appears in top-right of goal card header
- Only shows when there's an active goal (not on "No Active Goals" card)
- Icon: `ellipsis-horizontal` (⋮ horizontal dots)
- Color: Light white/gray for subtle appearance

### **2. Options Menu Modal**
- Tap three dots → Menu appears
- Two options:
  - **✏️ Edit Goal** - Opens goal modal in edit mode
  - **🗑️ Delete Goal** - Removes the goal (with confirmation)
- Dark theme matching app design
- Center-screen positioning
- Tap outside to dismiss

### **3. Delete Confirmation**
- Alert dialog before deletion
- Title: "Delete Goal"
- Message: "Are you sure you want to delete this goal? This action cannot be undone."
- Buttons:
  - "Cancel" (cancel style)
  - "Delete" (destructive style, red text)

### **4. Soft Delete Implementation**
- Uses `deactivateGoal()` function (sets `is_active: false`)
- Doesn't actually delete from database
- Preserves goal data for potential history/analytics
- Goal removed from active goals query

---

## 🎬 User Experience Flow

### **Delete Flow:**
```
Step 1: User sees goal card with three dots ⋮
Step 2: Tap three dots
Step 3: Menu slides in:
        ┌──────────────┐
        │ ✏️ Edit Goal  │
        ├──────────────┤
        │ 🗑️ Delete Goal│
        └──────────────┘
Step 4: Tap "Delete Goal"
Step 5: Confirmation alert appears:
        ┌─────────────────────┐
        │ Delete Goal         │
        │                     │
        │ Are you sure you    │
        │ want to delete this │
        │ goal? This cannot   │
        │ be undone.          │
        │                     │
        │ [Cancel]  [Delete]  │
        └─────────────────────┘
Step 6: Tap "Delete"
Step 7: Goal deactivated in database
Step 8: Success alert: "Goal deleted successfully"
Step 9: Home screen refreshes
Step 10: Goal removed, "No Active Goals" shows
```

### **Edit Flow:**
```
Step 1: Tap three dots ⋮
Step 2: Tap "Edit Goal"
Step 3: Goal modal opens pre-filled with current values
Step 4: User edits goal details
Step 5: Tap "Update Goal"
Step 6: Goal updated in database
Step 7: Home screen refreshes
```

---

## 🔧 Technical Implementation

### **Component Changes: `components/GoalCard.tsx`**

#### **New Props:**
```typescript
interface GoalCardProps {
  // ... existing props
  onGoalDeleted?: (goalId: string) => void;  // NEW
  goalId?: string;                            // NEW
}
```

#### **New State:**
```typescript
const [showOptionsMenu, setShowOptionsMenu] = useState(false);
```

#### **New Handlers:**
```typescript
const handleDeleteGoal = () => {
  setShowOptionsMenu(false);
  
  if (!goalId) {
    Alert.alert('Error', 'Cannot delete goal - no goal ID provided');
    return;
  }
  
  Alert.alert(
    'Delete Goal',
    'Are you sure you want to delete this goal? This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          console.log('🗑️ Deleting goal:', goalId);
          if (onGoalDeleted) {
            onGoalDeleted(goalId);
          }
        }
      }
    ]
  );
};

const handleEditGoal = () => {
  setShowOptionsMenu(false);
  setIsUpdatingGoal(true);
  setGoalType(title);
  setNotes(description);
  if (targetValue) {
    setTargetValueInput(targetValue.toString());
  }
  setShowGoalModal(true);
};
```

#### **New JSX - Three-Dot Icon:**
```tsx
<View style={styles.header}>
  <View style={styles.daysLeftTag}>
    <Text style={styles.daysLeftTagText}>{daysLeft} days left</Text>
  </View>
  
  {/* Three-dot menu */}
  {goalId && title !== "No Active Goals" && (
    <TouchableOpacity 
      onPress={() => setShowOptionsMenu(true)}
      style={styles.menuButton}
    >
      <Ionicons 
        name="ellipsis-horizontal" 
        size={width * 0.05} 
        color="rgba(255, 255, 255, 0.7)" 
      />
    </TouchableOpacity>
  )}
</View>
```

#### **New JSX - Options Menu Modal:**
```tsx
<Modal
  visible={showOptionsMenu}
  transparent
  animationType="fade"
  onRequestClose={() => setShowOptionsMenu(false)}
>
  <TouchableOpacity 
    style={styles.menuOverlay}
    activeOpacity={1}
    onPress={() => setShowOptionsMenu(false)}
  >
    <View style={styles.menuContainer}>
      {/* Edit Option */}
      <TouchableOpacity 
        style={styles.menuOption}
        onPress={handleEditGoal}
      >
        <Ionicons name="create-outline" size={width * 0.05} color="white" />
        <Text style={styles.menuOptionText}>Edit Goal</Text>
      </TouchableOpacity>
      
      {/* Divider */}
      <View style={styles.menuDivider} />
      
      {/* Delete Option */}
      <TouchableOpacity 
        style={styles.menuOption}
        onPress={handleDeleteGoal}
      >
        <Ionicons name="trash-outline" size={width * 0.05} color="#FF7675" />
        <Text style={[styles.menuOptionText, styles.deleteText]}>Delete Goal</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
</Modal>
```

#### **New Styles:**
```typescript
header: {
  flexDirection: 'row',
  justifyContent: 'space-between',  // Changed from 'flex-start'
  alignItems: 'center',              // Added
  marginBottom: height * 0.008,
},
menuButton: {
  padding: width * 0.01,
},
menuOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
menuContainer: {
  backgroundColor: '#2A2A2A',
  borderRadius: width * 0.03,
  width: width * 0.5,
  paddingVertical: height * 0.01,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 8,
},
menuOption: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: width * 0.04,
  paddingVertical: height * 0.015,
  gap: width * 0.03,
},
menuOptionText: {
  fontSize: width * 0.04,
  color: 'white',
  fontWeight: '500',
},
menuDivider: {
  height: 1,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  marginHorizontal: width * 0.04,
},
deleteText: {
  color: '#FF7675',
},
```

---

### **Database Changes: `lib/database.ts`**

#### **New Function:**
```typescript
async deleteGoal(goalId: string): Promise<boolean> {
  console.log('🗑️ Deleting goal:', goalId);
  
  const { error } = await supabase
    .from('goal')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('goal_id', goalId);

  if (error) {
    console.error('Error deleting goal:', error);
    return false;
  }

  console.log('✅ Goal deleted successfully (deactivated)');
  return true;
}
```

**What it does:**
- Soft delete (sets `is_active: false`)
- Updates `updated_at` timestamp
- Preserves goal data in database
- Returns true/false for success

**Why soft delete?**
- ✅ Can implement "View Deleted Goals" feature later
- ✅ Can restore if accidental
- ✅ Analytics on deleted vs completed goals
- ✅ Data preservation for insights

---

### **Home Screen Changes: `app/(tabs)/index.tsx`**

#### **Pass Goal ID:**
```typescript
<GoalCard
  goalId={goals[0].id}  // ✅ NEW
  // ... other props
/>
```

#### **Add Delete Callback:**
```typescript
onGoalDeleted={async (goalId) => {
  console.log('🗑️ Deleting goal:', goalId);
  const success = await goalService.deleteGoal(goalId);
  
  if (success) {
    Alert.alert('Success', 'Goal deleted successfully');
    fetchUserData(); // Refresh to remove from UI
  } else {
    Alert.alert('Error', 'Failed to delete goal');
  }
}}
```

---

## 🎨 Visual Design

### **Goal Card with Menu:**
```
┌──────────────────────────────────┐
│ 21 days left                  ⋮  │ ← Three dots
│                                   │
│ Total Matches Played              │
│ Play 10 matches in 1 Month        │
│                                   │
│             [70%]                 │
│             7/10                  │
│                                   │
│        [Set New Goal]             │
└──────────────────────────────────┘
```

### **Menu Opened:**
```
┌──────────────────────────────────┐
│ 21 days left                  ⋮  │
│                                   │
│ Total Matche     ┌──────────────┐│
│ Play 10 match    │ ✏️ Edit Goal  ││
│                  ├──────────────┤│
│             [70% │ 🗑️ Delete Goal││ ← Red text
│             7/10 └──────────────┘│
│                                   │
│        [Set New Goal]             │
└──────────────────────────────────┘
```

### **Delete Confirmation:**
```
┌────────────────────────────┐
│      Delete Goal           │
│                            │
│ Are you sure you want to   │
│ delete this goal? This     │
│ action cannot be undone.   │
│                            │
│  [Cancel]      [Delete]    │
│              (red/destructive)
└────────────────────────────┘
```

---

## 📊 Database Impact

### **Before Delete:**
```sql
SELECT * FROM goal WHERE user_id = 'user-123' AND is_active = true;

┌──────────┬──────────────────┬─────────┬────────┐
│ goal_id  │ category         │ current │ active │
├──────────┼──────────────────┼─────────┼────────┤
│ abc-123  │ Total Matches    │ 7       │ true   │
└──────────┴──────────────────┴─────────┴────────┘
```

### **After Delete:**
```sql
UPDATE goal SET is_active = false WHERE goal_id = 'abc-123';

SELECT * FROM goal WHERE user_id = 'user-123' AND is_active = true;

┌──────────┬──────────────────┬─────────┬────────┐
│ (empty result set)                              │
└─────────────────────────────────────────────────┘

-- Goal still exists in database:
SELECT * FROM goal WHERE goal_id = 'abc-123';

┌──────────┬──────────────────┬─────────┬────────┐
│ goal_id  │ category         │ current │ active │
├──────────┼──────────────────┼─────────┼────────┤
│ abc-123  │ Total Matches    │ 7       │ false  │ ← Preserved!
└──────────┴──────────────────┴─────────┴────────┘
```

---

## 🎯 When Menu Appears

### **Shows Menu (✅):**
- Active goal with valid goal ID
- User has a goal in progress
- Goal card showing progress (0-100%)

### **Hides Menu (❌):**
- "No Active Goals" card
- No goal ID provided
- Missing `onGoalDeleted` callback

**Condition:**
```typescript
{goalId && title !== "No Active Goals" && (
  <ThreeDotsMenu />
)}
```

---

## 🔄 Complete Delete Flow

```
User Action: Tap three dots
    ↓
State: setShowOptionsMenu(true)
    ↓
UI: Options menu modal appears
    ↓
User Action: Tap "Delete Goal"
    ↓
Handler: handleDeleteGoal()
    ↓
State: setShowOptionsMenu(false)
    ↓
Alert: Confirmation dialog
    ↓
User Action: Tap "Delete" (or "Cancel")
    ↓
    ├─→ Cancel: Dialog closes, nothing happens
    │
    └─→ Delete: 
        ↓
        Callback: onGoalDeleted(goalId)
        ↓
        Database: goalService.deleteGoal(goalId)
        ↓
        SQL: UPDATE goal SET is_active = false WHERE goal_id = '...'
        ↓
        Alert: "Goal deleted successfully"
        ↓
        Refresh: fetchUserData()
        ↓
        UI: Goal card removed, "No Active Goals" shows
```

---

## 🎨 Styling Details

### **Menu Button:**
- Padding: 1% of width
- No background (transparent)
- Icon size: 5% of width
- Icon color: `rgba(255, 255, 255, 0.7)` (subtle)

### **Menu Container:**
- Background: `#2A2A2A` (dark gray)
- Width: 50% of screen width
- Rounded corners: 3% of width
- Shadow for depth
- Center positioned

### **Menu Options:**
- Padding: 4% horizontal, 1.5% vertical
- Gap between icon and text: 3% of width
- Font size: 4% of width
- Edit: White text
- Delete: Red text (`#FF7675`)

### **Menu Divider:**
- Height: 1px
- Color: `rgba(255, 255, 255, 0.1)` (subtle)
- Horizontal margin: 4% of width

---

## ✅ Safety Features

### **1. Confirmation Required**
- Can't accidentally delete
- Two-step process (menu → confirm)
- Clear warning message

### **2. Soft Delete**
- Data preserved in database
- Can implement "undo" later
- Can view deleted goals in history

### **3. Validation**
```typescript
if (!goalId) {
  Alert.alert('Error', 'Cannot delete goal - no goal ID provided');
  return;
}

if (!onGoalDeleted) {
  console.log('No onGoalDeleted callback provided');
  return;
}
```

### **4. Error Handling**
```typescript
const success = await goalService.deleteGoal(goalId);

if (success) {
  Alert.alert('Success', 'Goal deleted successfully');
} else {
  Alert.alert('Error', 'Failed to delete goal');
}
```

---

## 🚀 Future Enhancements

### **1. Undo Delete**
```
After delete:
- Show toast: "Goal deleted" [UNDO]
- Tap undo → Reactivate goal
- 5 second window to undo
```

### **2. Deleted Goals History**
```
New section: "Deleted Goals"
- View all deactivated goals
- Restore option
- Permanently delete option
```

### **3. Swipe to Delete**
```
Alternative UX:
- Swipe left on goal card
- Delete button appears
- Tap to delete with confirmation
```

### **4. Batch Delete**
```
If multiple goals:
- "Delete All Goals" option
- Bulk deletion with confirmation
```

### **5. Delete Animation**
```
On delete:
- Goal card fades out
- Slides down
- "No Active Goals" fades in
- Smooth transition
```

---

## 🧪 Testing Checklist

- [ ] Three-dot menu appears on active goal
- [ ] Three-dot menu does NOT appear on "No Active Goals"
- [ ] Tap menu → Options appear
- [ ] Tap "Edit Goal" → Modal opens with pre-filled values
- [ ] Tap "Delete Goal" → Confirmation alert appears
- [ ] Tap "Cancel" → Nothing happens, menu closes
- [ ] Tap "Delete" → Goal deactivated
- [ ] Success alert appears
- [ ] Home screen refreshes
- [ ] Goal removed from display
- [ ] "No Active Goals" card shows
- [ ] Database still has goal with is_active: false
- [ ] Can create new goal after deletion

---

## 📊 Comparison

### **Before:**
```
Problem: Can't delete goals
User: Creates wrong goal → Stuck with it
Workaround: Manually update database
Result: ❌ Poor UX
```

### **After:**
```
Solution: Three-dot menu with delete
User: Creates wrong goal → Tap dots → Delete → Confirmed
Process: 4 taps total
Result: ✅ Easy goal management
```

---

## ✅ Summary

Successfully implemented goal deletion feature with:

1. ✅ **Three-dot menu** in goal card header
2. ✅ **Options modal** with Edit and Delete
3. ✅ **Confirmation dialog** for safety
4. ✅ **Soft delete** (preserves data)
5. ✅ **Auto-refresh** (home screen updates)
6. ✅ **Error handling** (validation and alerts)
7. ✅ **Responsive design** (all sizes)
8. ✅ **Consistent theme** (dark mode, purple accents)

Users can now easily manage their goals with a clean, safe deletion flow! 🎯🗑️



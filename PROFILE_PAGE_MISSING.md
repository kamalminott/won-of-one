# Profile Page - Missing Functionality

## 📍 Locations of Missing Features

### **File**: `app/profile.tsx`
**Lines**: Check each section below

---

## ❌ **MISSING FEATURES**

### 1. **Name Editing** (Lines 163-178) ⚠️
**Location**: `app/profile.tsx:163-178`

**Issue**: The name editing functionality is defined but the UI for editing is not fully implemented

**Missing**:
- TextInput for editing name (currently just shows Text)
- Save button to confirm name changes
- Cancel button to discard changes

**Current State**:
```typescript
// Lines 163-172: Functions exist but no UI
const handleNameEdit = () => setIsEditingName(true);
const handleNameSave = () => { /* saves but no UI */ };
const handleNameCancel = () => { /* no UI */ };
```

**What to Add**:
- When `isEditingName === true`, show TextInput instead of Text
- Add Save/Cancel buttons to handle confirmation

---

### 2. **Change Password** (Line 398) ⚠️
**Location**: `app/profile.tsx:398-410`

**Issue**: "Change Password" button has no functionality

**Current State**:
```typescript
<TouchableOpacity style={styles.infoItem}>
  <Text>Change Password</Text>
  <Ionicons name="chevron-forward" />
</TouchableOpacity>
// No onPress handler - does nothing when clicked
```

**Missing**:
- onPress handler to navigate to password change screen
- Password change modal or screen
- Current password verification
- New password input
- Confirm new password input

**What to Add**:
```typescript
onPress={() => {
  // Navigate to password change screen
  // Or show password change modal
}}
```

---

### 3. **Settings Button** (Line 194) ⚠️
**Location**: `app/profile.tsx:194`

**Issue**: Settings button in header doesn't do anything

**Current State**:
```typescript
<TouchableOpacity style={styles.settingsButton}>
  <Ionicons name="settings-outline" size={24} color="white" />
</TouchableOpacity>
// No onPress handler
```

**Missing**:
- onPress handler to open settings screen
- Settings screen exists (`app/settings.tsx`) but not connected

**What to Add**:
```typescript
onPress={() => router.push('/settings')}
```

---

### 4. **View All Goals** (Line 248) ⚠️
**Location**: `app/profile.tsx:248`

**Issue**: "View All" button for goals has no functionality

**Current State**:
```typescript
<TouchableOpacity>
  <Text style={styles.viewAllText}>View All</Text>
</TouchableOpacity>
// No onPress handler
```

**Missing**:
- onPress handler to navigate to goals screen
- Full goals list view
- Goal management screen

**What to Add**:
```typescript
onPress={() => {
  // Navigate to goals screen
  // Show all goals with progress
}}
```

---

### 5. **Real User Data** (Lines 47-86) ⚠️
**Location**: `app/profile.tsx:47-86`

**Issue**: Match statistics are hardcoded, not from database

**Current State**:
```typescript
// Lines 218-235: Hardcoded stats
<Text>24</Text> // Matches Played - hardcoded
<Text>15 (60%)</Text> // Win rate - hardcoded
<Text>186</Text> // Points - hardcoded
<Text>6</Text> // Streak - hardcoded
```

**Missing**:
- Database fetch for actual match statistics
- Real-time stat calculation from matches
- Dynamic stat updates

**What to Add**:
```typescript
// Fetch from database
const fetchMatchStats = async () => {
  const matches = await matchService.getAllMatches(user.id);
  const wins = matches.filter(m => m.result === 'W');
  const totalPoints = matches.reduce((sum, m) => sum + m.score_for, 0);
  // Calculate and set real stats
};
```

---

### 6. **Email Address** (Lines 348-351) ⚠️
**Location**: `app/profile.tsx:348-351`

**Issue**: Email is hardcoded, not from user data

**Current State**:
```typescript
<Text style={styles.infoValue}>janesmith123@gmail.com</Text>
// Hardcoded email, not from user.auth
```

**Missing**:
- Get email from auth context
- Display actual user email
- Handle email editing (if needed)

**What to Add**:
```typescript
const { user } = useAuth();
<Text>{user?.email || 'No email'}</Text>
```

---

### 7. **User ID Display** (Lines 384) ⚠️
**Location**: `app/profile.tsx:384`

**Issue**: User ID is hardcoded

**Current State**:
```typescript
<Text style={styles.infoValue}>#12345678</Text>
// Hardcoded ID
```

**Missing**:
- Get actual user ID from auth
- Display real ID or user identifier

**What to Add**:
```typescript
const { user } = useAuth();
<Text>{user?.id ? `#${user.id.slice(0, 8)}` : 'Not logged in'}</Text>
```

---

## 📝 **Summary**

### **Total Missing Features: 7**

1. ⚠️ Name editing UI (incomplete implementation)
2. ❌ Change Password functionality (no handler)
3. ❌ Settings button navigation (no handler)
4. ❌ View All Goals functionality (no handler)
5. ⚠️ Real match statistics from database (hardcoded)
6. ⚠️ Real email from auth (hardcoded)
7. ⚠️ Real user ID from auth (hardcoded)

---

## 🎯 **Priority Order**

### **High Priority** (User can't complete core tasks):
1. **Change Password** - Security feature
2. **Real match statistics** - Core data accuracy
3. **Email display** - User identification

### **Medium Priority** (Improves UX):
4. **Name editing UI** - Profile customization
5. **Settings button** - Navigation

### **Low Priority** (Nice to have):
6. **View All Goals** - Additional navigation
7. **User ID display** - Technical info

---

## 🔍 **Where to Find Each Issue**

| Issue | File | Lines | Priority |
|-------|------|-------|----------|
| Name editing UI | `app/profile.tsx` | 163-178 | Medium |
| Change Password | `app/profile.tsx` | 398-410 | High |
| Settings button | `app/profile.tsx` | 194 | Medium |
| View All Goals | `app/profile.tsx` | 248 | Low |
| Match stats | `app/profile.tsx` | 218-235 | High |
| Email display | `app/profile.tsx` | 348-351 | High |
| User ID | `app/profile.tsx` | 384 | Low |

---

## ✅ **Quick Fixes Summary**

1. Add `onPress` handlers to all button elements
2. Replace hardcoded values with data from `useAuth()` context
3. Fetch match statistics from database using `matchService`
4. Implement UI for name editing with TextInput
5. Connect settings button to `/settings` route


# Offline Packages Guide: NetInfo & AsyncStorage

## Overview
This document explains the two key packages needed for offline functionality and how they'll be integrated into the fencing remote offline implementation.

---

## Package 1: @react-native-community/netinfo

### What It Does
**NetInfo** monitors the device's network connection state. It tells you:
- Whether the device is online or offline
- What type of connection (WiFi, cellular, none, etc.)
- Connection quality/detailed state information
- **Automatically detects when network status changes**

### Official Documentation Links
- **GitHub Repository**: https://github.com/react-native-netinfo/react-native-netinfo
- **NPM Package**: https://www.npmjs.com/package/@react-native-community/netinfo
- **Full Documentation**: See README in GitHub repo

### Installation (Expo)
```bash
npx expo install @react-native-community/netinfo
```

### Key Features
1. **Real-time network detection** - Know instantly when device goes online/offline
2. **Connection type detection** - WiFi, cellular, ethernet, VPN, etc.
3. **Connection quality** - Fast, slow, 2G, 3G, 4G, 5G
4. **Event listeners** - Subscribe to network state changes
5. **One-time fetch** - Check current state on demand

### How We'll Use It

#### 1. Replace Stub Network Detection
**Current (BROKEN):**
```typescript
// lib/offlineRemoteService.ts - WRONG
const networkService = {
  isOnline: () => true, // Always returns true!
};
```

**New Implementation:**
```typescript
// lib/networkService.ts - NEW FILE TO CREATE
import NetInfo from '@react-native-community/netinfo';

export const networkService = {
  /**
   * Check if device is currently online
   * @returns Promise<boolean> - true if online, false if offline
   */
  isOnline: async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  },

  /**
   * Subscribe to network state changes
   * @param callback Function called when network state changes
   * @returns Unsubscribe function
   */
  subscribe: (
    callback: (isConnected: boolean, connectionType: string) => void
  ) => {
    return NetInfo.addEventListener(state => {
      callback(
        state.isConnected ?? false,
        state.type || 'unknown'
      );
    });
  },

  /**
   * Get detailed network state
   * @returns Promise<NetworkState> - Detailed connection info
   */
  getState: async () => {
    return await NetInfo.fetch();
  }
};
```

#### 2. Monitor Network Changes in Remote Screen
```typescript
// app/(tabs)/remote.tsx
import { networkService } from '@/lib/networkService';

useEffect(() => {
  // Subscribe to network changes
  const unsubscribe = networkService.subscribe((isConnected, type) => {
    console.log(`Network changed: ${isConnected ? 'ONLINE' : 'OFFLINE'} (${type})`);
    
    if (isConnected) {
      // Network restored - trigger sync
      syncPendingData();
    } else {
      // Network lost - show offline indicator
      setOfflineMode(true);
    }
  });

  // Check initial state
  networkService.isOnline().then(isOnline => {
    setOfflineMode(!isOnline);
  });

  return () => {
    unsubscribe(); // Clean up listener
  };
}, []);
```

#### 3. Automatic Sync on Network Restoration
```typescript
// lib/offlineRemoteService.ts
import { networkService } from './networkService';

// Monitor for network restoration
networkService.subscribe((isConnected) => {
  if (isConnected) {
    // Network restored - sync all pending data
    syncPendingData(userId).catch(handleSyncError);
  }
});
```

### NetInfo State Object Structure
```typescript
{
  type: 'wifi' | 'cellular' | 'none' | 'unknown' | 'bluetooth' | 'ethernet' | 'wimax' | 'vpn' | 'other',
  isConnected: boolean | null,
  isInternetReachable: boolean | null,
  details: {
    // WiFi details
    ssid?: string,
    bssid?: string,
    strength?: number,
    // Cellular details
    cellularGeneration?: '2g' | '3g' | '4g',
    carrier?: string,
  }
}
```

---

## Package 2: @react-native-async-storage/async-storage

### What It Does
**AsyncStorage** is a persistent, asynchronous key-value storage system. Think of it as a simple database that:
- **Persists data** between app restarts
- **Stores data locally** on the device
- **Works offline** (no network needed)
- **Simple key-value pairs** (like a JavaScript Map that persists)

**IMPORTANT**: Already installed in your project! ✅

### Official Documentation Links
- **GitHub Repository**: https://github.com/react-native-async-storage/async-storage
- **NPM Package**: https://www.npmjs.com/package/@react-native-async-storage/async-storage
- **Official Docs**: https://react-native-async-storage.github.io/async-storage/
- **API Reference**: https://react-native-async-storage.github.io/async-storage/docs/api/

### Key Features
1. **Persistent** - Data survives app restarts
2. **Asynchronous** - Non-blocking, won't freeze UI
3. **Simple API** - Easy get/set/remove operations
4. **Cross-platform** - Works on iOS, Android, Web
5. **Large storage** - Can store significant amounts of data

### How We'll Use It

#### 1. Implement Real Offline Cache
**Current (BROKEN):**
```typescript
// lib/offlineRemoteService.ts - WRONG
const offlineCache = {
  cacheActiveRemoteSession: async (session) => {
    console.log('Stub: cacheActiveRemoteSession', session);
    // Does nothing! Data is lost!
  },
  getActiveRemoteSession: async () => {
    return null; // Always returns null!
  }
};
```

**New Implementation:**
```typescript
// lib/offlineCache.ts - NEW FILE TO CREATE
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  ACTIVE_SESSION: 'offline:active_remote_session',
  PENDING_EVENTS: 'offline:pending_remote_events',
  PENDING_MATCHES: 'offline:pending_matches',
};

interface RemoteSession {
  remote_id: string;
  referee_id: string;
  fencer_1_id?: string;
  fencer_1_name: string;
  fencer_2_name: string;
  score_1: number;
  score_2: number;
  status: string;
  current_period: number;
  match_time: number;
  period_1_time: number;
  period_2_time: number;
  period_3_time: number;
  cached_at: number;
}

export const offlineCache = {
  /**
   * Save active remote session
   */
  cacheActiveRemoteSession: async (session: RemoteSession): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ACTIVE_SESSION,
        JSON.stringify(session)
      );
      console.log('✅ Session cached:', session.remote_id);
    } catch (error) {
      console.error('❌ Failed to cache session:', error);
      throw error;
    }
  },

  /**
   * Get active remote session
   */
  getActiveRemoteSession: async (): Promise<RemoteSession | null> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      if (!data) return null;
      
      const session = JSON.parse(data) as RemoteSession;
      console.log('✅ Session retrieved:', session.remote_id);
      return session;
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      return null;
    }
  },

  /**
   * Clear active session
   */
  clearActiveRemoteSession: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      console.log('✅ Session cleared');
    } catch (error) {
      console.error('❌ Failed to clear session:', error);
    }
  },

  /**
   * Add pending event to queue
   */
  addPendingRemoteEvent: async (event: any): Promise<void> => {
    try {
      const existing = await offlineCache.getPendingRemoteEvents();
      const updated = [...existing, { ...event, id: Date.now().toString() }];
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_EVENTS,
        JSON.stringify(updated)
      );
      console.log('✅ Event queued:', event.event_type);
    } catch (error) {
      console.error('❌ Failed to queue event:', error);
      throw error;
    }
  },

  /**
   * Get all pending events
   */
  getPendingRemoteEvents: async (): Promise<any[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_EVENTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Failed to get pending events:', error);
      return [];
    }
  },

  /**
   * Clear pending events
   */
  clearPendingRemoteEvents: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_EVENTS);
      console.log('✅ Pending events cleared');
    } catch (error) {
      console.error('❌ Failed to clear events:', error);
    }
  },

  /**
   * Add pending match
   */
  addPendingMatch: async (match: any): Promise<string> => {
    try {
      const existing = await offlineCache.getPendingMatches();
      const matchId = `offline_match_${Date.now()}`;
      const matchWithId = { ...match, matchId, queuedAt: Date.now() };
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_MATCHES,
        JSON.stringify([...existing, matchWithId])
      );
      console.log('✅ Match queued:', matchId);
      return matchId;
    } catch (error) {
      console.error('❌ Failed to queue match:', error);
      throw error;
    }
  },

  /**
   * Get all pending matches
   */
  getPendingMatches: async (): Promise<any[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_MATCHES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Failed to get pending matches:', error);
      return [];
    }
  },

  /**
   * Remove specific pending match
   */
  removePendingMatch: async (matchId: string): Promise<void> => {
    try {
      const existing = await offlineCache.getPendingMatches();
      const filtered = existing.filter((m: any) => m.matchId !== matchId);
      
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_MATCHES,
        JSON.stringify(filtered)
      );
      console.log('✅ Match removed from queue:', matchId);
    } catch (error) {
      console.error('❌ Failed to remove match:', error);
    }
  }
};
```

#### 2. AsyncStorage API Methods We'll Use

```typescript
// Basic operations
await AsyncStorage.setItem('key', 'value');        // Save data
await AsyncStorage.getItem('key');                 // Get data
await AsyncStorage.removeItem('key');               // Delete data
await AsyncStorage.clear();                         // Clear ALL data

// Multiple operations (faster)
await AsyncStorage.multiSet([
  ['key1', 'value1'],
  ['key2', 'value2']
]);

await AsyncStorage.multiGet(['key1', 'key2']);

// Get all keys
await AsyncStorage.getAllKeys();
```

#### 3. Usage in Remote Screen (Already Partially Used)
```typescript
// app/(tabs)/remote.tsx - You're already using this!
import AsyncStorage from '@react-native-async-storage/async-storage';

// You already have this pattern:
const saveMatchState = async () => {
  await AsyncStorage.setItem('ongoing_match_state', JSON.stringify({
    aliceScore,
    bobScore,
    currentPeriod,
    // ...
  }));
};

// We'll extend this to also save to offline cache
```

---

## Combined Usage: Complete Offline Flow

### Complete Example: Offline Match Creation

```typescript
// lib/offlineRemoteService.ts
import { networkService } from './networkService';
import { offlineCache } from './offlineCache';
import { fencingRemoteService } from './database';

export const offlineRemoteService = {
  /**
   * Create remote session (works offline OR online)
   */
  async createRemoteSession(remoteData: {
    referee_id: string;
    fencer_1_name: string;
    fencer_2_name: string;
  }): Promise<{ remote_id: string; is_offline: boolean }> {
    const isOnline = await networkService.isOnline();
    
    // Try online first
    if (isOnline) {
      try {
        const session = await fencingRemoteService.createRemoteSession(remoteData);
        // Also cache locally for offline access
        await offlineCache.cacheActiveRemoteSession({
          ...session,
          cached_at: Date.now(),
        });
        return { remote_id: session.remote_id, is_offline: false };
      } catch (error) {
        console.log('⚠️ Online creation failed, falling back to offline');
        // Fall through to offline creation
      }
    }
    
    // Create offline session
    const remoteId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      remote_id: remoteId,
      referee_id: remoteData.referee_id,
      fencer_1_name: remoteData.fencer_1_name,
      fencer_2_name: remoteData.fencer_2_name,
      score_1: 0,
      score_2: 0,
      status: 'active',
      current_period: 1,
      match_time: 180,
      period_1_time: 0,
      period_2_time: 0,
      period_3_time: 0,
      cached_at: Date.now(),
    };
    
    // Save to AsyncStorage
    await offlineCache.cacheActiveRemoteSession(session);
    
    return { remote_id: remoteId, is_offline: true };
  },

  /**
   * Sync pending data when online
   */
  async syncPendingData(userId: string): Promise<boolean> {
    const isOnline = await networkService.isOnline();
    if (!isOnline) {
      console.log('⚠️ Cannot sync: offline');
      return false;
    }

    try {
      // Sync pending matches
      const pendingMatches = await offlineCache.getPendingMatches();
      for (const match of pendingMatches) {
        try {
          await matchService.createManualMatch({
            userId,
            opponentName: match.opponentName,
            yourScore: match.youScore,
            opponentScore: match.opponentScore,
            // ... other fields
          });
          
          // Remove from queue after successful sync
          await offlineCache.removePendingMatch(match.matchId);
        } catch (error) {
          console.error('Failed to sync match:', match.matchId, error);
          // Keep in queue for retry
        }
      }

      // Sync pending events
      const pendingEvents = await offlineCache.getPendingRemoteEvents();
      for (const event of pendingEvents) {
        try {
          await matchEventService.createMatchEvent(event);
        } catch (error) {
          console.error('Failed to sync event:', error);
        }
      }
      
      // Clear synced events
      await offlineCache.clearPendingRemoteEvents();
      
      console.log('✅ Sync complete');
      return true;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return false;
    }
  },
};
```

### Auto-Sync on Network Restoration

```typescript
// lib/syncManager.ts - NEW FILE
import { networkService } from './networkService';
import { offlineRemoteService } from './offlineRemoteService';
import { useAuth } from '@/contexts/AuthContext';

let syncInProgress = false;

export const setupAutoSync = (userId: string) => {
  // Subscribe to network changes
  const unsubscribe = networkService.subscribe(async (isConnected) => {
    if (isConnected && !syncInProgress) {
      syncInProgress = true;
      try {
        await offlineRemoteService.syncPendingData(userId);
      } finally {
        syncInProgress = false;
      }
    }
  });

  // Also sync on app foreground
  // (can use AppState from react-native)

  return unsubscribe;
};
```

---

## Package 3: expo-sqlite (Optional Alternative)

### When to Use SQLite Instead of AsyncStorage

**Use AsyncStorage for:**
- Simple key-value data
- Small amounts of data
- Quick reads/writes
- Simple data structures

**Use SQLite for:**
- Complex relational data
- Large datasets
- Complex queries
- Better performance with large data

### Documentation
- **Expo Docs**: https://docs.expo.dev/versions/latest/sdk/sqlite/
- **SQLite Documentation**: https://www.sqlite.org/docs.html

### Installation
```bash
npx expo install expo-sqlite
```

---

## Summary

### NetInfo Responsibilities:
1. ✅ Detect when device is online/offline
2. ✅ Monitor network state changes
3. ✅ Trigger sync when network restored
4. ✅ Show offline indicators to users

### AsyncStorage Responsibilities:
1. ✅ Persist remote sessions locally
2. ✅ Queue match events for later sync
3. ✅ Store pending matches
4. ✅ Cache data for offline access

### Combined Flow:
```
User Action (Offline)
  ↓
Save to AsyncStorage (offlineCache)
  ↓
NetInfo detects network restored
  ↓
Trigger sync (offlineRemoteService.syncPendingData)
  ↓
Read from AsyncStorage
  ↓
Upload to Supabase
  ↓
Clear from AsyncStorage
```

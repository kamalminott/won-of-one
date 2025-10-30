/**
 * Sync Manager
 * Automatically syncs pending data when network is restored
 * Call setupAutoSync() when app starts to enable automatic syncing
 */

import { networkService } from './networkService';
import { offlineRemoteService } from './offlineRemoteService';
import { AppState, AppStateStatus } from 'react-native';

let syncInProgress = false;
let unsubscribeNetwork: (() => void) | null = null;
let userIdCache: string | null = null;

/**
 * Setup automatic sync when network is restored
 * Call this when user logs in or app starts
 */
export const setupAutoSync = (userId: string) => {
  userIdCache = userId;
  
  // Subscribe to network changes
  if (unsubscribeNetwork) {
    unsubscribeNetwork(); // Clean up previous subscription
  }

  unsubscribeNetwork = networkService.subscribe(async (isConnected) => {
    if (isConnected && !syncInProgress && userIdCache) {
      console.log('🌐 Network restored, starting sync...');
      syncInProgress = true;
      try {
        await offlineRemoteService.syncPendingData(userIdCache);
      } catch (error) {
        console.error('❌ Auto-sync failed:', error);
      } finally {
        syncInProgress = false;
      }
    }
  });

  // Also sync when app comes to foreground
  const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && !syncInProgress && userIdCache) {
      const isOnline = await networkService.isOnline();
      if (isOnline) {
        console.log('📱 App foregrounded and online, starting sync...');
        syncInProgress = true;
        try {
          await offlineRemoteService.syncPendingData(userIdCache);
        } catch (error) {
          console.error('❌ Foreground sync failed:', error);
        } finally {
          syncInProgress = false;
        }
      }
    }
  });

  console.log('✅ Auto-sync setup complete');

  // Return cleanup function
  return () => {
    if (unsubscribeNetwork) {
      unsubscribeNetwork();
      unsubscribeNetwork = null;
    }
    subscription.remove();
    userIdCache = null;
  };
};

/**
 * Manually trigger sync (useful for pull-to-refresh or manual sync button)
 */
export const triggerManualSync = async (userId: string): Promise<boolean> => {
  if (syncInProgress) {
    console.log('⚠️ Sync already in progress');
    return false;
  }

  const isOnline = await networkService.isOnline();
  if (!isOnline) {
    console.log('⚠️ Cannot sync: device is offline');
    return false;
  }

  syncInProgress = true;
  try {
    const result = await offlineRemoteService.syncPendingData(userId);
    return result;
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    return false;
  } finally {
    syncInProgress = false;
  }
};

/**
 * Cleanup sync manager (call when user logs out or app closes)
 */
export const cleanupSync = () => {
  if (unsubscribeNetwork) {
    unsubscribeNetwork();
    unsubscribeNetwork = null;
  }
  userIdCache = null;
  syncInProgress = false;
};

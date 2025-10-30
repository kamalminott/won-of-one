/**
 * Network Service
 * Real network detection using @react-native-community/netinfo
 * Replaces the stub implementation in offlineRemoteService
 */

import NetInfo from '@react-native-community/netinfo';

export interface NetworkState {
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean | null;
}

export const networkService = {
  /**
   * Check if device is currently online
   * @returns Promise<boolean> - true if online, false if offline
   */
  isOnline: async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network status:', error);
      // Default to offline if we can't determine
      return false;
    }
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
      const isConnected = state.isConnected ?? false;
      const connectionType = state.type || 'unknown';
      callback(isConnected, connectionType);
    });
  },

  /**
   * Get detailed network state
   * @returns Promise<NetworkState> - Detailed connection info
   */
  getState: async (): Promise<NetworkState> => {
    try {
      const state = await NetInfo.fetch();
      return {
        isConnected: state.isConnected ?? false,
        type: state.type || 'unknown',
        isInternetReachable: state.isInternetReachable ?? null,
      };
    } catch (error) {
      console.error('Error fetching network state:', error);
      return {
        isConnected: false,
        type: 'unknown',
        isInternetReachable: null,
      };
    }
  },
};

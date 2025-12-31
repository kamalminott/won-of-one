import { BackButton } from '@/components/BackButton';
import { BugReportModal } from '@/components/BugReportModal';
import { useAuth } from '@/contexts/AuthContext';
import { accountService } from '@/lib/database';
import { analytics } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safely import expo-updates (may not be available in dev mode)
let Updates: typeof import('expo-updates') | null = null;
try {
  Updates = require('expo-updates');
} catch (error) {
  console.log('expo-updates not available (dev mode)');
}

export default function SettingsScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, signOut, session } = useAuth();
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<{
    updateId: string | null;
    createdAt: string | null;
    channel: string | null;
    runtimeVersion: string | null;
    isChecking: boolean;
  }>({
    updateId: null,
    createdAt: null,
    channel: null,
    runtimeVersion: null,
    isChecking: false,
  });
  
  const [tokenInfo, setTokenInfo] = useState<{
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    accessTokenExpiresAt: string | null;
    minutesUntilExpiry: number | null;
    willAutoRefresh: boolean;
    lastRefreshTime: string | null;
  }>({
    hasAccessToken: false,
    hasRefreshToken: false,
    accessTokenExpiresAt: null,
    minutesUntilExpiry: null,
    willAutoRefresh: false,
    lastRefreshTime: null,
  });

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);

  // Track screen view
  useFocusEffect(
    useCallback(() => {
      analytics.screen('Settings');
      loadUpdateInfo();
      loadTokenInfo();
    }, [])
  );

  // Load token information
  const loadTokenInfo = async (sessionOverride?: Session | null) => {
    try {
      let activeSession = sessionOverride ?? null;
      if (!activeSession) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error loading token info:', error);
        }
        activeSession = session;
      }
      
      if (!activeSession) {
        setTokenInfo({
          hasAccessToken: false,
          hasRefreshToken: false,
          accessTokenExpiresAt: null,
          minutesUntilExpiry: null,
          willAutoRefresh: false,
          lastRefreshTime: null,
        });
        return;
      }

      const expiresAt = activeSession.expires_at ? new Date(activeSession.expires_at * 1000) : null;
      const now = new Date();
      const minutesUntilExpiry = expiresAt 
        ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)
        : null;

      setTokenInfo({
        hasAccessToken: !!activeSession.access_token,
        hasRefreshToken: !!activeSession.refresh_token,
        accessTokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,
        minutesUntilExpiry,
        willAutoRefresh: minutesUntilExpiry !== null && minutesUntilExpiry < 60,
        lastRefreshTime: null, // We don't track this yet, but could add it
      });
    } catch (error) {
      console.error('Error loading token info:', error);
    }
  };

  useEffect(() => {
    if (session) {
      loadTokenInfo(session);
    }
  }, [session?.access_token, session?.refresh_token]);

  // Listen for token refresh events
  useEffect(() => {
    if (!user) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('✅ [SETTINGS] Token refreshed - updating display');
        loadTokenInfo();
      }
    });

    return () => subscription.unsubscribe();
  }, [user]);

  // Load update information
  const loadUpdateInfo = async () => {
    try {
      if (!Updates) {
        setUpdateInfo({
          updateId: 'Not available (dev mode)',
          createdAt: null,
          channel: 'development',
          runtimeVersion: 'N/A',
          isChecking: false,
        });
        return;
      }

      if (!Updates.isEnabled) {
        setUpdateInfo({
          updateId: 'Not available (dev mode)',
          createdAt: null,
          channel: 'development',
          runtimeVersion: 'N/A',
          isChecking: false,
        });
        return;
      }

      // Get update information from Updates API
      const manifest = Updates.manifest;
      
      setUpdateInfo({
        updateId: Updates.updateId || manifest?.id || 'Embedded',
        createdAt: manifest?.createdAt 
          ? new Date(manifest.createdAt).toLocaleString() 
          : 'Unknown',
        channel: Updates.channel || manifest?.extra?.expoConfig?.updates?.requestHeaders?.['expo-channel-name'] || 'unknown',
        runtimeVersion: Updates.runtimeVersion || manifest?.runtimeVersion || 'unknown',
        isChecking: false,
      });
    } catch (error) {
      console.error('Error loading update info:', error);
      setUpdateInfo({
        updateId: 'Not available (dev mode)',
        createdAt: null,
        channel: 'development',
        runtimeVersion: 'N/A',
        isChecking: false,
      });
    }
  };

  // Check for updates manually
  const checkForUpdates = async () => {
    if (!Updates) {
      Alert.alert('Updates Disabled', 'OTA updates are not available in development mode.');
      return;
    }

    if (!Updates.isEnabled) {
      Alert.alert('Updates Disabled', 'OTA updates are not available in development mode.');
      return;
    }

    setUpdateInfo(prev => ({ ...prev, isChecking: true }));

    try {
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        Alert.alert(
          'Update Available',
          'A new update is available. It will be downloaded and applied on the next app restart.',
          [
            {
              text: 'Download Now',
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                Alert.alert(
                  'Update Downloaded',
                  'The update has been downloaded. Restart the app to apply it.',
                  [{ text: 'OK' }]
                );
                loadUpdateInfo();
              },
            },
            { text: 'Later', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Up to Date', 'You are running the latest version.');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      Alert.alert('Error', 'Failed to check for updates. Please try again later.');
    } finally {
      setUpdateInfo(prev => ({ ...prev, isChecking: false }));
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleEditProfile = () => {
    analytics.capture('profile_edit_accessed');
    router.push('/(tabs)/profile');
  };

  const handleOpenPaywall = () => {
    analytics.capture('paywall_opened_from_settings');
    router.push('/paywall');
  };

  const handleLogOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    analytics.logout();
    try {
      // Clear critical local state so the next user starts fresh
      await AsyncStorage.multiRemove([
        'ongoing_match_state',
        'user_name',
        'user_profile_image',
      ]);

      // Sign out via AuthContext (supabase + auth state)
      await signOut();

      // Send user to login screen
      router.replace('/login');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      Alert.alert('Logout Failed', 'Something went wrong while logging out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSwitchAccount = () => {
    // TODO: Implement switch account logic
    console.log('Switch account pressed');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data including matches, goals, and diary entries.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) {
              Alert.alert('Error', 'No user found. Please try logging out and back in.');
              return;
            }

            setIsDeletingAccount(true);
            analytics.accountDeleted();

            try {
              // Delete all user data from database
              const result = await accountService.deleteAccount(user.id);

              if (!result.success) {
                Alert.alert(
                  'Error',
                  `Failed to delete account: ${result.error || 'Unknown error'}. Please contact support.`
                );
                setIsDeletingAccount(false);
                return;
              }

              // Sign out the user
              await signOut();

              // Clear AsyncStorage
              try {
                await AsyncStorage.clear();
                console.log('✅ AsyncStorage cleared');
              } catch (storageError) {
                console.error('❌ Error clearing AsyncStorage:', storageError);
                // Continue even if AsyncStorage clear fails
              }

              // Show success message and navigate to login
              Alert.alert(
                'Account Deleted',
                'Your account and all associated data have been permanently deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.replace('/login');
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('❌ Error during account deletion:', error);
              Alert.alert(
                'Error',
                `An error occurred while deleting your account: ${error.message || 'Unknown error'}. Please contact support.`
              );
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#171717',
    },
    header: {
      backgroundColor: '#212121',
      paddingTop: insets.top,
      paddingBottom: height * 0.02,
      paddingHorizontal: width * 0.04,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      width: width * 0.06,
      height: width * 0.06,
      borderRadius: width * 0.03,
      backgroundColor: '#343434',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: width * 0.05,
      fontWeight: '600',
      color: '#FFFFFF',
      flex: 1,
      textAlign: 'center',
      marginRight: width * 0.06,
    },
    content: {
      flex: 1,
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.02,
    },
    contentContainer: {
      paddingBottom: height * 0.04,
    },
    section: {
      marginBottom: height * 0.03,
    },
    sectionTitle: {
      fontSize: width * 0.045,
      fontWeight: '500',
      color: '#FFFFFF',
      marginBottom: height * 0.015,
      marginLeft: width * 0.01,
    },
    card: {
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      padding: width * 0.04,
      shadowColor: '#6C5CE7',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
    },
    hapticsCard: {
      height: height * 0.09,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    profileCard: {
      height: height * 0.09,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    authCard: {
      paddingVertical: height * 0.01,
    },
    matchDefaultsCard: {
      paddingVertical: height * 0.02,
    },
    iconContainer: {
      width: width * 0.14,
      height: width * 0.14,
      borderRadius: width * 0.07,
      backgroundColor: '#393939',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.03,
    },
    icon: {
      fontSize: width * 0.06,
      color: '#FFFFFF',
    },
    optionText: {
      fontSize: width * 0.04,
      fontWeight: '500',
      color: '#FFFFFF',
      flex: 1,
    },
    arrowIcon: {
      fontSize: width * 0.055,
      color: '#9D9D9D',
    },
    toggleContainer: {
      width: width * 0.115,
      height: height * 0.028,
      backgroundColor: '#6250F2',
      borderRadius: width * 0.04,
      justifyContent: 'center',
      paddingHorizontal: width * 0.01,
      shadowColor: '#6C5CE7',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 8,
    },
    toggleThumb: {
      width: width * 0.045,
      height: width * 0.045,
      backgroundColor: '#FFFFFF',
      borderRadius: width * 0.0225,
      alignSelf: 'flex-end',
    },
    toggleThumbOff: {
      alignSelf: 'flex-start',
    },
    separator: {
      height: 1,
      backgroundColor: '#464646',
      marginVertical: height * 0.015,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.015,
    },
    settingRowLast: {
      marginBottom: 0,
    },
    settingLabel: {
      fontSize: width * 0.04,
      fontWeight: '500',
      color: '#FFFFFF',
    },
    settingValue: {
      fontSize: width * 0.035,
      fontWeight: '600',
      color: '#9D9D9D',
      backgroundColor: '#2B2B2B',
      borderWidth: 1,
      borderColor: '#464646',
      borderRadius: width * 0.03,
      paddingHorizontal: width * 0.02,
      paddingVertical: height * 0.005,
      minWidth: width * 0.2,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.headerTitle}>Basic Settings</Text>
        <View style={{ width: width * 0.06 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + height * 0.12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Haptics Section */}
        <View style={styles.section}>
          <View style={[styles.card, styles.hapticsCard]}>
            <View style={styles.iconContainer}>
              <Ionicons name="phone-portrait" size={width * 0.06} color="#FFFFFF" />
            </View>
            <Text style={styles.optionText}>Haptics</Text>
            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => setHapticsEnabled(!hapticsEnabled)}
            >
              <View style={[
                styles.toggleThumb,
                !hapticsEnabled && styles.toggleThumbOff
              ]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={[styles.card, styles.profileCard]}>
            <View style={styles.iconContainer}>
              <Ionicons name="create" size={width * 0.06} color="#FFFFFF" />
            </View>
            <Text style={styles.optionText}>Edit Profile</Text>
            <TouchableOpacity onPress={handleEditProfile}>
              <Ionicons name="chevron-forward" size={width * 0.055} color="#9D9D9D" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <TouchableOpacity style={[styles.card, styles.profileCard]} onPress={handleOpenPaywall}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={width * 0.06} color="#FFFFFF" />
            </View>
            <Text style={styles.optionText}>Open Paywall</Text>
            <Ionicons name="chevron-forward" size={width * 0.055} color="#9D9D9D" />
          </TouchableOpacity>
        </View>

        {/* Authentication & Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication & Account</Text>
          <View style={[styles.card, styles.authCard]}>
            <TouchableOpacity style={styles.settingRow} onPress={handleLogOut} disabled={isLoggingOut}>
              <View style={styles.iconContainer}>
                <Ionicons name="log-out-outline" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>{isLoggingOut ? 'Logging Out...' : 'Log Out'}</Text>
              {isLoggingOut && <ActivityIndicator size="small" color="#FFFFFF" />}
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity style={styles.settingRow} onPress={handleSwitchAccount}>
              <View style={styles.iconContainer}>
                <Ionicons name="refresh" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Switch Account</Text>
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="trash-outline" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Delete Account</Text>
              {isDeletingAccount && (
                <ActivityIndicator size="small" color="#6C5CE7" style={{ marginLeft: width * 0.02 }} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Session Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Status</Text>
          <View style={[styles.card, styles.matchDefaultsCard]}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Access Token</Text>
              <Text style={[styles.settingValue, { color: tokenInfo.hasAccessToken ? '#4CAF50' : '#F44336' }]}>
                {tokenInfo.hasAccessToken ? '✅ Valid' : '❌ Missing'}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Refresh Token</Text>
              <Text style={[styles.settingValue, { color: tokenInfo.hasRefreshToken ? '#4CAF50' : '#F44336' }]}>
                {tokenInfo.hasRefreshToken ? '✅ Present' : '❌ Missing'}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Expires In</Text>
              <Text style={styles.settingValue}>
                {tokenInfo.minutesUntilExpiry !== null 
                  ? tokenInfo.minutesUntilExpiry > 0
                    ? `${tokenInfo.minutesUntilExpiry} minutes`
                    : 'Expired (will refresh)'
                  : 'Unknown'}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Auto-Refresh</Text>
              <Text style={[styles.settingValue, { color: tokenInfo.willAutoRefresh ? '#FF9800' : '#4CAF50' }]}>
                {tokenInfo.willAutoRefresh ? '⚠️ Will refresh soon' : '✅ Active'}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <TouchableOpacity 
              style={[styles.settingRow, styles.settingRowLast]} 
              onPress={loadTokenInfo}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="refresh" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Refresh Status</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Match Defaults Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match Defaults</Text>
          <View style={[styles.card, styles.matchDefaultsCard]}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Default Match Time</Text>
              <Text style={styles.settingValue}>3 min</Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={[styles.settingRow, styles.settingRowLast]}>
              <Text style={styles.settingLabel}>Default Periods</Text>
              <Text style={styles.settingValue}>3</Text>
            </View>
          </View>
        </View>

        {/* App Updates Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Updates</Text>
          <View style={[styles.card, styles.matchDefaultsCard]}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Update ID</Text>
              <Text style={[styles.settingValue, { fontSize: width * 0.03 }]} numberOfLines={1}>
                {updateInfo.updateId || 'Loading...'}
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Channel</Text>
              <Text style={styles.settingValue}>{updateInfo.channel || 'Loading...'}</Text>
            </View>
            
            <View style={styles.separator} />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Runtime Version</Text>
              <Text style={styles.settingValue}>{updateInfo.runtimeVersion || 'Loading...'}</Text>
            </View>
            
            <View style={styles.separator} />
            
            <TouchableOpacity 
              style={[styles.settingRow, styles.settingRowLast]} 
              onPress={checkForUpdates}
              disabled={updateInfo.isChecking || !Updates || !Updates.isEnabled}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="refresh" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Check for Updates</Text>
              {updateInfo.isChecking && (
                <ActivityIndicator size="small" color="#6C5CE7" style={{ marginLeft: width * 0.02 }} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={[styles.card, styles.matchDefaultsCard]}>
            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={() => {
                analytics.capture('bug_report_opened');
                setShowBugReportModal(true);
              }}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="bug" size={width * 0.06} color="#6C5CE7" />
              </View>
              <Text style={styles.optionText}>Report a Bug</Text>
              <Ionicons name="chevron-forward" size={width * 0.05} color="#9D9D9D" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={[styles.card, styles.matchDefaultsCard]}>
            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={() => {
                Linking.openURL('https://kamalminott.github.io/won-of-one/privacy-policy.html').catch(err => 
                  console.error('Failed to open privacy policy:', err)
                );
              }}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark-outline" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={width * 0.05} color="#9D9D9D" />
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity 
              style={[styles.settingRow, styles.settingRowLast]} 
              onPress={() => {
                Linking.openURL('https://kamalminott.github.io/won-of-one/terms-of-service.html').catch(err => 
                  console.error('Failed to open terms of service:', err)
                );
              }}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="document-text-outline" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={width * 0.05} color="#9D9D9D" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bug Report Modal */}
      <BugReportModal
        visible={showBugReportModal}
        onClose={() => setShowBugReportModal(false)}
      />
    </View>
  );
}

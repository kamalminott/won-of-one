import { BackButton } from '@/components/BackButton';
import { analytics } from '@/lib/analytics';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';

export default function SettingsScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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

  // Track screen view
  useFocusEffect(
    useCallback(() => {
      analytics.screen('Settings');
      loadUpdateInfo();
    }, [])
  );

  // Load update information
  const loadUpdateInfo = async () => {
    try {
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
      setUpdateInfo(prev => ({
        ...prev,
        updateId: 'Error loading',
        isChecking: false,
      }));
    }
  };

  // Check for updates manually
  const checkForUpdates = async () => {
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

  const handleLogOut = () => {
    analytics.logout();
    // TODO: Implement logout logic
    console.log('Log out pressed');
  };

  const handleSwitchAccount = () => {
    // TODO: Implement switch account logic
    console.log('Switch account pressed');
  };

  const handleDeleteAccount = () => {
    analytics.accountDeleted();
    // TODO: Implement delete account logic
    console.log('Delete account pressed');
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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

        {/* Authentication & Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication & Account</Text>
          <View style={[styles.card, styles.authCard]}>
            <TouchableOpacity style={styles.settingRow} onPress={handleLogOut}>
              <View style={styles.iconContainer}>
                <Ionicons name="log-out-outline" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Log Out</Text>
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity style={styles.settingRow} onPress={handleSwitchAccount}>
              <View style={styles.iconContainer}>
                <Ionicons name="refresh" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Switch Account</Text>
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
              <View style={styles.iconContainer}>
                <Ionicons name="trash-outline" size={width * 0.06} color="#FFFFFF" />
              </View>
              <Text style={styles.optionText}>Delete Account</Text>
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
              disabled={updateInfo.isChecking || !Updates.isEnabled}
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
      </ScrollView>
    </View>
  );
}

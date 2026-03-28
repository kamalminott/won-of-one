import { BackButton } from '@/components/BackButton';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminAccessService,
  type AdminAccessSearchResult,
} from '@/lib/adminAccessService';
import { analytics } from '@/lib/analytics';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_DURATION_OPTIONS = [7, 30, 90, 365];
const MAX_USER_MESSAGE_LENGTH = 180;

const formatAccessDate = (value?: string | null) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getUserDisplayName = (user: AdminAccessSearchResult) => {
  return user.name?.trim() || user.email?.trim() || 'Unnamed user';
};

const getAccessSummary = (user: AdminAccessSearchResult) => {
  if (!user.has_active_access || !user.access_ends_at) {
    return 'No active manual access';
  }
  return `Access until ${formatAccessDate(user.access_ends_at)}`;
};

const getAccessDaysRemaining = (user: AdminAccessSearchResult) => {
  if (!user.has_active_access || !user.access_ends_at) {
    return null;
  }

  const endsAt = new Date(user.access_ends_at);
  if (Number.isNaN(endsAt.getTime())) {
    return null;
  }

  const diffMs = endsAt.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (daysLeft === 1) {
    return '1 day left';
  }

  return `${daysLeft} days left`;
};

export default function AdminAccessScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminAccessSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminAccessSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedDurationDays, setSelectedDurationDays] = useState<number | null>(30);
  const [customDurationDays, setCustomDurationDays] = useState('');
  const [reason, setReason] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingDefaultUsers, setLoadingDefaultUsers] = useState(false);

  useFocusEffect(
    useCallback(() => {
      analytics.screen('AdminAccessControl');
    }, [])
  );

  useEffect(() => {
    let cancelled = false;

    const loadAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      setCheckingAdmin(true);
      const nextIsAdmin = await adminAccessService.isCurrentUserAdmin(
        session?.access_token
      );
      if (cancelled) return;

      setIsAdmin(nextIsAdmin);
      setCheckingAdmin(false);
    };

    void loadAdminStatus();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user?.id]);

  const updateSelectionFromResults = (
    foundUsers: AdminAccessSearchResult[],
    fallbackSelected?: AdminAccessSearchResult | null
  ) => {
    setSelectedUser((current) => {
      const target = fallbackSelected?.user_id ?? current?.user_id;
      if (!target) return current ?? null;
      return foundUsers.find((entry) => entry.user_id === target) ?? fallbackSelected ?? current ?? null;
    });
  };

  const loadActiveUsers = useCallback(
    async (fallbackSelected?: AdminAccessSearchResult | null) => {
      try {
        setLoadingDefaultUsers(true);
        const foundUsers = await adminAccessService.listActiveUsers(
          session?.access_token
        );
        setResults(foundUsers);
        setHasSearched(false);
        updateSelectionFromResults(foundUsers, fallbackSelected);
        return foundUsers;
      } catch (error: any) {
        Alert.alert(
          'Could not load access list',
          error?.message || 'Unable to load current access grants right now.'
        );
        return [];
      } finally {
        setLoadingDefaultUsers(false);
      }
    },
    [session?.access_token]
  );

  const runSearch = async (queryOverride?: string) => {
    const activeQuery = (queryOverride ?? query).trim();
    if (!activeQuery) {
      return loadActiveUsers();
    }

    try {
      setSearching(true);
      setHasSearched(true);
      analytics.capture('admin_access_user_search', {
        query_length: activeQuery.length,
        looks_like_uuid: activeQuery.includes('-'),
      });
      const foundUsers = await adminAccessService.searchUsers(
        activeQuery,
        session?.access_token
      );
      setResults(foundUsers);
      updateSelectionFromResults(foundUsers);
      return foundUsers;
    } catch (error: any) {
      Alert.alert('Search failed', error?.message || 'Unable to search users right now.');
      return [];
    } finally {
      setSearching(false);
    }
  };

  const refreshSelectedUser = async () => {
    if (!selectedUser) return;

    try {
      const refreshedSelection = await adminAccessService.searchUsers(
        selectedUser.user_id,
        session?.access_token,
        1
      );
      const nextSelected = refreshedSelection[0] ?? null;
      setSelectedUser(nextSelected);

      if (query.trim()) {
        const foundUsers = await adminAccessService.searchUsers(
          query.trim(),
          session?.access_token
        );
        setResults(foundUsers);
        updateSelectionFromResults(foundUsers, nextSelected);
      } else {
        await loadActiveUsers(nextSelected);
      }
    } catch (error) {
      console.warn('⚠️ Failed to refresh selected admin access user:', error);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadActiveUsers();
  }, [isAdmin, loadActiveUsers]);

  const resolvedDurationDays = (() => {
    if (selectedDurationDays && selectedDurationDays > 0) {
      return selectedDurationDays;
    }

    const parsed = parseInt(customDurationDays.trim(), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  })();

  const handleSelectUser = (nextUser: AdminAccessSearchResult) => {
    setSelectedUser(nextUser);
    setReason('');
    setUserMessage('');
  };

  const handleGrantAccess = async () => {
    if (!selectedUser) {
      Alert.alert('Select a user', 'Choose a user before granting access.');
      return;
    }

    if (!resolvedDurationDays) {
      Alert.alert('Invalid duration', 'Enter a valid number of days for the access grant.');
      return;
    }

    try {
      setGranting(true);
      const grant = await adminAccessService.grantAccess(
        {
          targetUserId: selectedUser.user_id,
          durationDays: resolvedDurationDays,
          reason,
          userMessage,
        },
        session?.access_token
      );

      analytics.capture('admin_manual_access_granted', {
        target_user_id: selectedUser.user_id,
        duration_days: resolvedDurationDays,
        has_user_message: !!userMessage.trim(),
      });

      await refreshSelectedUser();
      setReason('');
      setUserMessage('');

      Alert.alert(
        'Access granted',
        `${getUserDisplayName(selectedUser)} now has access until ${formatAccessDate(
          grant.ends_at
        )}.`
      );
    } catch (error: any) {
      Alert.alert('Grant failed', error?.message || 'Unable to grant access right now.');
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeAccess = () => {
    if (!selectedUser) return;

    Alert.alert(
      'Revoke access',
      `Remove manual access for ${getUserDisplayName(selectedUser)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              setRevoking(true);
              await adminAccessService.revokeAccess(
                selectedUser.user_id,
                session?.access_token,
                reason
              );
              analytics.capture('admin_manual_access_revoked', {
                target_user_id: selectedUser.user_id,
              });
              await refreshSelectedUser();
              Alert.alert('Access revoked', 'The manual access grant has been removed.');
            } catch (error: any) {
              Alert.alert('Revoke failed', error?.message || 'Unable to revoke access right now.');
            } finally {
              setRevoking(false);
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
      paddingBottom: insets.bottom + height * 0.08,
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
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
    },
    helperText: {
      color: '#9D9D9D',
      fontSize: width * 0.034,
      lineHeight: width * 0.05,
    },
    searchInput: {
      backgroundColor: '#1F1F1F',
      borderWidth: 1,
      borderColor: '#464646',
      borderRadius: width * 0.035,
      color: '#FFFFFF',
      paddingHorizontal: width * 0.035,
      paddingVertical: height * 0.016,
      fontSize: width * 0.04,
      marginTop: height * 0.012,
    },
    primaryButton: {
      marginTop: height * 0.016,
      backgroundColor: '#6C5CE7',
      borderRadius: width * 0.035,
      paddingVertical: height * 0.017,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: width * 0.02,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    emptyCard: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: height * 0.01,
    },
    emptyText: {
      color: '#9D9D9D',
      fontSize: width * 0.036,
      textAlign: 'center',
    },
    userResultCard: {
      marginBottom: height * 0.012,
      borderWidth: 1,
      borderColor: '#343434',
    },
    selectedResultCard: {
      borderColor: '#6C5CE7',
      backgroundColor: '#30285A',
    },
    userRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: width * 0.03,
    },
    userName: {
      color: '#FFFFFF',
      fontSize: width * 0.042,
      fontWeight: '600',
      marginBottom: height * 0.004,
    },
    userMeta: {
      color: '#B7B7B7',
      fontSize: width * 0.034,
      marginTop: height * 0.004,
    },
    statusPill: {
      paddingHorizontal: width * 0.025,
      paddingVertical: height * 0.007,
      borderRadius: width * 0.03,
      backgroundColor: '#1F1F1F',
      borderWidth: 1,
      borderColor: '#3A3A3A',
    },
    statusPillActive: {
      backgroundColor: 'rgba(108, 92, 231, 0.18)',
      borderColor: '#6C5CE7',
    },
    statusPillText: {
      color: '#FFFFFF',
      fontSize: width * 0.03,
      fontWeight: '600',
    },
    statusGroup: {
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    statusPillsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: width * 0.018,
    },
    accessMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: width * 0.02,
      marginTop: height * 0.006,
    },
    daysLeftPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: width * 0.026,
      paddingVertical: height * 0.006,
      borderRadius: width * 0.03,
      backgroundColor: 'rgba(108, 92, 231, 0.16)',
      borderWidth: 1,
      borderColor: '#6C5CE7',
    },
    daysLeftPillText: {
      color: '#FFFFFF',
      fontSize: width * 0.029,
      fontWeight: '700',
    },
    selectedLabel: {
      color: '#9D9D9D',
      fontSize: width * 0.032,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: height * 0.01,
    },
    currentStatusText: {
      color: '#FFFFFF',
      fontSize: width * 0.038,
      fontWeight: '600',
      marginTop: height * 0.008,
    },
    currentReasonText: {
      color: '#B7B7B7',
      fontSize: width * 0.033,
      marginTop: height * 0.008,
    },
    durationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: width * 0.025,
      marginTop: height * 0.014,
    },
    durationChip: {
      paddingHorizontal: width * 0.035,
      paddingVertical: height * 0.012,
      borderRadius: width * 0.06,
      backgroundColor: '#1F1F1F',
      borderWidth: 1,
      borderColor: '#464646',
    },
    durationChipActive: {
      backgroundColor: 'rgba(108, 92, 231, 0.18)',
      borderColor: '#6C5CE7',
    },
    durationChipText: {
      color: '#FFFFFF',
      fontSize: width * 0.034,
      fontWeight: '600',
    },
    inputLabel: {
      color: '#FFFFFF',
      fontSize: width * 0.036,
      fontWeight: '600',
      marginTop: height * 0.018,
      marginBottom: height * 0.01,
    },
    textArea: {
      minHeight: height * 0.12,
      textAlignVertical: 'top',
    },
    secondaryButton: {
      marginTop: height * 0.014,
      backgroundColor: '#1F1F1F',
      borderRadius: width * 0.035,
      paddingVertical: height * 0.017,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#464646',
      flexDirection: 'row',
      gap: width * 0.02,
    },
    secondaryButtonText: {
      color: '#FFFFFF',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    blockedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: width * 0.08,
      gap: height * 0.016,
    },
    blockedTitle: {
      color: '#FFFFFF',
      fontSize: width * 0.06,
      fontWeight: '700',
      textAlign: 'center',
    },
    blockedBody: {
      color: '#B7B7B7',
      fontSize: width * 0.04,
      textAlign: 'center',
      lineHeight: width * 0.055,
    },
  });

  if (checkingAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.blockedContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.blockedBody}>Checking admin access...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Access Control</Text>
          <View style={{ width: width * 0.06 }} />
        </View>
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed" size={width * 0.16} color="#6C5CE7" />
          <Text style={styles.blockedTitle}>Admin access only</Text>
          <Text style={styles.blockedBody}>
            This support tool is only available to allowlisted admin accounts.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Access Control</Text>
        <View style={{ width: width * 0.06 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Users</Text>
            <View style={styles.card}>
              <Text style={styles.helperText}>
                Users with active manual access appear here automatically. Search by user ID,
                email, or name to find anyone else.
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Paste UUID, email, or name"
                placeholderTextColor="#7C7C7C"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => {
                  void runSearch();
                }}
              />
              <TouchableOpacity
                style={[styles.primaryButton, searching && styles.primaryButtonDisabled]}
                onPress={() => {
                  void runSearch();
                }}
                disabled={searching}
              >
                {searching ? <ActivityIndicator color="#FFFFFF" /> : null}
                <Text style={styles.primaryButtonText}>
                  {searching ? 'Searching...' : 'Search'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>
            {loadingDefaultUsers ? (
              <View style={[styles.card, styles.emptyCard]}>
                <ActivityIndicator size="small" color="#6C5CE7" />
                <Text style={styles.emptyText}>Loading users with active access...</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Ionicons name="search" size={width * 0.09} color="#6C5CE7" />
                <Text style={styles.emptyText}>
                  {hasSearched
                    ? 'No users matched that search.'
                    : 'No users currently have manual access. Search to find a user and manage their access.'}
                </Text>
              </View>
            ) : (
              results.map((entry) => {
                const isSelected = selectedUser?.user_id === entry.user_id;
                const daysRemaining = getAccessDaysRemaining(entry);
                return (
                  <TouchableOpacity
                    key={entry.user_id}
                    style={[
                      styles.card,
                      styles.userResultCard,
                      isSelected && styles.selectedResultCard,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleSelectUser(entry)}
                  >
                    <View style={styles.userRowTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{getUserDisplayName(entry)}</Text>
                        <Text style={styles.userMeta}>
                          {entry.email?.trim() || 'No email on file'}
                        </Text>
                        <Text style={styles.userMeta}>ID: {entry.user_id}</Text>
                        <Text style={styles.userMeta}>{getAccessSummary(entry)}</Text>
                      </View>
                      <View style={styles.statusGroup}>
                        <View style={styles.statusPillsRow}>
                          {daysRemaining ? (
                            <View style={styles.daysLeftPill}>
                              <Text style={styles.daysLeftPillText}>{daysRemaining}</Text>
                            </View>
                          ) : null}
                          <View
                            style={[
                              styles.statusPill,
                              entry.has_active_access && styles.statusPillActive,
                            ]}
                          >
                            <Text style={styles.statusPillText}>
                              {entry.has_active_access ? 'ACTIVE' : 'NONE'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grant Access</Text>
            <View style={styles.card}>
              {selectedUser ? (
                <>
                  <Text style={styles.selectedLabel}>Selected User</Text>
                  <Text style={styles.userName}>{getUserDisplayName(selectedUser)}</Text>
                  <Text style={styles.userMeta}>
                    {selectedUser.email?.trim() || 'No email on file'}
                  </Text>
                  <Text style={styles.userMeta}>ID: {selectedUser.user_id}</Text>
                  <View style={styles.accessMetaRow}>
                    {selectedUser.has_active_access && getAccessDaysRemaining(selectedUser) ? (
                      <View style={styles.daysLeftPill}>
                        <Text style={styles.daysLeftPillText}>
                          {getAccessDaysRemaining(selectedUser)}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.currentStatusText}>{getAccessSummary(selectedUser)}</Text>
                  </View>
                  {selectedUser.access_reason ? (
                    <Text style={styles.currentReasonText}>
                      Current reason: {selectedUser.access_reason}
                    </Text>
                  ) : null}
                  {selectedUser.access_message ? (
                    <Text style={styles.currentReasonText}>
                      Current message: {selectedUser.access_message}
                    </Text>
                  ) : null}

                  <Text style={styles.inputLabel}>Duration</Text>
                  <View style={styles.durationRow}>
                    {QUICK_DURATION_OPTIONS.map((days) => {
                      const active = selectedDurationDays === days;
                      return (
                        <TouchableOpacity
                          key={days}
                          style={[
                            styles.durationChip,
                            active && styles.durationChipActive,
                          ]}
                          onPress={() => {
                            setSelectedDurationDays(days);
                            setCustomDurationDays('');
                          }}
                        >
                          <Text style={styles.durationChipText}>{days} days</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.inputLabel}>Custom days</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Enter a custom number of days"
                    placeholderTextColor="#7C7C7C"
                    keyboardType="number-pad"
                    value={customDurationDays}
                    onChangeText={(value) => {
                      setCustomDurationDays(value.replace(/[^0-9]/g, ''));
                      setSelectedDurationDays(null);
                    }}
                  />

                  <Text style={styles.inputLabel}>Reason</Text>
                  <TextInput
                    style={[styles.searchInput, styles.textArea]}
                    placeholder="Optional note for why this access was granted"
                    placeholderTextColor="#7C7C7C"
                    multiline
                    value={reason}
                    onChangeText={setReason}
                  />

                  <Text style={styles.inputLabel}>User message</Text>
                  <Text style={styles.helperText}>
                    Optional short note shown to the user in-app for a few seconds.
                  </Text>
                  <TextInput
                    style={[styles.searchInput, styles.textArea]}
                    placeholder="Example: We have added 30 free days to your account."
                    placeholderTextColor="#7C7C7C"
                    multiline
                    maxLength={MAX_USER_MESSAGE_LENGTH}
                    value={userMessage}
                    onChangeText={(value) => {
                      setUserMessage(value.slice(0, MAX_USER_MESSAGE_LENGTH));
                    }}
                  />
                  <Text style={styles.currentReasonText}>
                    {userMessage.length}/{MAX_USER_MESSAGE_LENGTH}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (granting || !resolvedDurationDays) && styles.primaryButtonDisabled,
                    ]}
                    onPress={() => {
                      void handleGrantAccess();
                    }}
                    disabled={granting || !resolvedDurationDays}
                  >
                    {granting ? <ActivityIndicator color="#FFFFFF" /> : null}
                    <Text style={styles.primaryButtonText}>
                      {granting ? 'Granting...' : 'Grant Access'}
                    </Text>
                  </TouchableOpacity>

                  {selectedUser.has_active_access ? (
                    <TouchableOpacity
                      style={[
                        styles.secondaryButton,
                        revoking && styles.primaryButtonDisabled,
                      ]}
                      onPress={handleRevokeAccess}
                      disabled={revoking}
                    >
                      {revoking ? <ActivityIndicator color="#FFFFFF" /> : null}
                      <Text style={styles.secondaryButtonText}>
                        {revoking ? 'Revoking...' : 'Revoke Current Access'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="person-circle-outline" size={width * 0.09} color="#6C5CE7" />
                  <Text style={styles.emptyText}>
                    Select a user from the results list to grant or revoke access.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

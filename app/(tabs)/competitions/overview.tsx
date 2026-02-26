import { CompetitionQrCode } from '@/components/CompetitionQrCode';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_ROLE_LABELS,
  COMPETITION_STATUS_COLORS,
  COMPETITION_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import {
  buildCompetitionJoinQrPayload,
  getCompetitionOverviewData,
  updateCompetitionRegistrationLock,
} from '@/lib/clubCompetitionService';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CompetitionOverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ competitionId?: string }>();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof getCompetitionOverviewData>
  >>(null);
  const [updatingRegistration, setUpdatingRegistration] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!user?.id || !competitionId) {
      setLoading(false);
      setErrorText('Competition not found.');
      return;
    }

    setLoading(true);
    setErrorText(null);
    const data = await getCompetitionOverviewData({
      userId: user.id,
      competitionId,
    });
    if (!data) {
      setErrorText('You do not have access to this competition.');
    }
    setOverview(data);
    setLoading(false);
  }, [competitionId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview])
  );

  const qrPayload = useMemo(() => {
    if (!overview || overview.role !== 'organiser') return null;
    return buildCompetitionJoinQrPayload(
      overview.competition.id,
      overview.competition.join_code
    );
  }, [overview]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.purple.primary} />
      </View>
    );
  }

  if (!overview) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{errorText ?? 'Competition not available.'}</Text>
        <Pressable
          onPress={() => router.replace('/(tabs)/competitions')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Hub</Text>
        </Pressable>
      </View>
    );
  }

  const { competition } = overview;
  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;
  const canToggleRegistration =
    overview.role === 'organiser' &&
    (competition.status === 'registration_open' || competition.status === 'registration_locked');

  const onToggleRegistration = () => {
    if (!canToggleRegistration || !overview) return;
    const lock = competition.status === 'registration_open';
    Alert.alert(
      lock ? 'Lock registration?' : 'Unlock registration?',
      lock
        ? 'New participants will no longer be able to join.'
        : 'New participants will be able to join again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: lock ? 'Lock' : 'Unlock',
          onPress: async () => {
            setUpdatingRegistration(true);
            const result = await updateCompetitionRegistrationLock({
              competitionId: competition.id,
              lock,
            });
            setUpdatingRegistration(false);

            if (!result.ok) {
              setErrorText(result.message);
              return;
            }

            analytics.capture(lock ? 'registration_locked' : 'registration_unlocked', {
              competition_id: competition.id,
            });

            setOverview((previous) =>
              previous
                ? {
                    ...previous,
                    competition: result.data,
                    isReadOnly: result.data.status === 'finalised',
                  }
                : previous
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: contentBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Competition Overview</Text>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.competitionName}>{competition.name}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: COMPETITION_STATUS_COLORS[competition.status] },
              ]}
            >
              <Text style={styles.statusText}>
                {COMPETITION_STATUS_LABELS[competition.status]}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {competition.weapon.toUpperCase()} • {overview.participantCount} participants
            </Text>
            <Text style={styles.roleText}>{COMPETITION_ROLE_LABELS[overview.role]}</Text>
          </View>

          {overview.isReadOnly ? (
            <View style={styles.readOnlyBanner}>
              <Text style={styles.readOnlyText}>
                This competition is finalised. You have read-only access.
              </Text>
            </View>
          ) : null}
        </View>

        {overview.role === 'organiser' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Invite</Text>
            <Text style={styles.joinCodeLabel}>Join code</Text>
            <Text style={styles.joinCodeValue}>{competition.join_code}</Text>
            {qrPayload ? (
              <View style={styles.qrContainer}>
                <CompetitionQrCode payload={qrPayload} size={170} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Progress</Text>
          <Text style={styles.progressText}>Current phase: 0 / 0 matches</Text>
          <Text style={styles.progressText}>Overall: 0 / 0 matches</Text>
        </View>

        {overview.role === 'organiser' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Registration</Text>
            <Text style={styles.progressText}>
              Current state: {COMPETITION_STATUS_LABELS[competition.status]}
            </Text>
            <Pressable
              onPress={onToggleRegistration}
              disabled={!canToggleRegistration || updatingRegistration}
              style={[
                styles.registrationButton,
                (!canToggleRegistration || updatingRegistration) && styles.disabledButton,
              ]}
            >
              {updatingRegistration ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registrationButtonText}>
                  {competition.status === 'registration_open'
                    ? 'Lock Registration'
                    : competition.status === 'registration_locked'
                      ? 'Unlock Registration'
                      : 'Registration Locked by Phase'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.navGrid}>
          <NavCard
            title="Participants & Roles"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/competitions/participants-roles',
                params: { competitionId: competition.id },
              })
            }
          />
          <NavCard
            title="Poules"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/competitions/poules',
                params: { competitionId: competition.id },
              })
            }
          />
          <NavCard
            title="Rankings"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/competitions/rankings',
                params: { competitionId: competition.id },
              })
            }
          />
          <NavCard
            title="DE Tableau"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/competitions/de-tableau',
                params: { competitionId: competition.id },
              })
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

function NavCard({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.navCard}
    >
      <Text style={styles.navCardText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.22)',
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  competitionName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    color: '#A9A9A9',
    fontSize: 13,
    fontWeight: '500',
  },
  roleText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  readOnlyBanner: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B3B3B',
    backgroundColor: '#171717',
    padding: 10,
  },
  readOnlyText: {
    color: '#D2D2D2',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  joinCodeLabel: {
    color: '#9D9D9D',
    fontSize: 12,
    marginBottom: 4,
  },
  joinCodeValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 4,
  },
  qrContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  progressText: {
    color: '#D3D3D3',
    fontSize: 13,
    lineHeight: 20,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  navCard: {
    width: '48%',
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#343434',
    backgroundColor: '#191919',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  navCardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  registrationButton: {
    borderRadius: 10,
    marginTop: 10,
    minHeight: 44,
    backgroundColor: Colors.purple.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registrationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  errorText: {
    color: '#FF7675',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  backButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#E7E7E7',
    fontSize: 14,
    fontWeight: '600',
  },
});

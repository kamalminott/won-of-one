import { CompetitionQrCode } from '@/components/CompetitionQrCode';
import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { BackButton } from '@/components/BackButton';
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
  finaliseCompetition,
  getCompetitionOverviewData,
  updateCompetitionRegistrationLock,
} from '@/lib/clubCompetitionService';
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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

type JourneyStepState = 'completed' | 'active' | 'locked';

type JourneyStep = {
  key: string;
  title: string;
  subtitle: string;
  state: JourneyStepState;
  lockReason?: string;
  onPress?: () => void;
};

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
  const [finalising, setFinalising] = useState(false);
  const overviewVersionRef = useRef('');

  const loadOverview = useCallback(async (showSpinner = true): Promise<string | null> => {
    if (!user?.id || !competitionId) {
      setLoading(false);
      setErrorText('Competition not found.');
      overviewVersionRef.current = '';
      return null;
    }

    if (showSpinner) {
      setLoading(true);
    }
    setErrorText(null);
    const data = await getCompetitionOverviewData({
      userId: user.id,
      competitionId,
    });
    if (!data) {
      setErrorText('You do not have access to this competition.');
      overviewVersionRef.current = '';
    }
    setOverview(data);
    const version = data
      ? `${data.competition.updated_at}:${data.competition.status}:${data.participantCount}`
      : '';
    overviewVersionRef.current = version;
    setLoading(false);
    return version || null;
  }, [competitionId, user?.id]);

  const {
    bannerText: realtimeBannerText,
    correctionNotice: realtimeCorrectionNotice,
    clearCorrectionNotice,
    retryNow: retryRealtime,
  } = useCompetitionRealtime({
    competitionId,
    enabled: Boolean(user?.id && competitionId),
    surface: 'overview',
    onCompetitionEvent: () => {
      void loadOverview(false);
    },
    onReconnectRefetch: async () => {
      const before = overviewVersionRef.current;
      const after = await loadOverview(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      void loadOverview(true);
    }, [loadOverview])
  );

  const qrPayload = useMemo(() => {
    if (!overview || overview.role !== 'organiser') return null;
    return buildCompetitionJoinQrPayload(
      overview.competition.id,
      overview.competition.join_code
    );
  }, [overview]);

  const journeySteps: JourneyStep[] = useMemo(() => {
    if (!overview) {
      return [];
    }

    const competition = overview.competition;
    const hasPoulesStage = competition.format !== 'de_only';
    const hasDeStage = competition.format !== 'poules_only';
    const competitionStatus = competition.status;

    const participantsState: JourneyStepState =
      competitionStatus === 'registration_open' || competitionStatus === 'registration_locked'
        ? 'active'
        : 'completed';

    const steps: JourneyStep[] = [
      {
        key: 'participants',
        title: 'Participants & Roles',
        subtitle: 'Set organisers, participants, and registration readiness.',
        state: participantsState,
        onPress: () =>
          router.push({
            pathname: '/(tabs)/competitions/participants-roles',
            params: { competitionId: competition.id },
          }),
      },
    ];

    if (hasPoulesStage) {
      const poulesState: JourneyStepState =
        competitionStatus === 'registration_open'
          ? 'locked'
          : competitionStatus === 'rankings_locked' ||
              competitionStatus === 'de_generated' ||
              competitionStatus === 'finalised'
            ? 'completed'
            : 'active';

      steps.push({
        key: 'poules',
        title: 'Poules',
        subtitle: 'Generate pools, score bouts, and lock the poule phase.',
        state: poulesState,
        lockReason:
          competitionStatus === 'registration_open'
            ? 'Lock registration to start poules.'
            : undefined,
        onPress: () =>
          router.push({
            pathname: '/(tabs)/competitions/poules',
            params: { competitionId: competition.id },
          }),
      });
    }

    const rankingsLockedByState = hasPoulesStage
      ? competitionStatus === 'registration_open' || competitionStatus === 'registration_locked'
      : competitionStatus === 'registration_open';

    const rankingsState: JourneyStepState = rankingsLockedByState
      ? 'locked'
      : competitionStatus === 'de_generated' || competitionStatus === 'finalised'
        ? 'completed'
        : competitionStatus === 'rankings_locked'
          ? 'completed'
          : 'active';

    steps.push({
      key: 'rankings',
      title: 'Rankings',
      subtitle: 'Track standings and lock rankings for seeding.',
      state: rankingsState,
      lockReason: rankingsLockedByState
        ? hasPoulesStage
          ? 'Generate poules first to unlock rankings.'
          : 'Lock registration first to unlock rankings.'
        : undefined,
      onPress: () =>
        router.push({
          pathname: '/(tabs)/competitions/rankings',
          params: { competitionId: competition.id },
        }),
    });

    if (hasDeStage) {
      const deLockedByState =
        competitionStatus === 'registration_open' ||
        competitionStatus === 'registration_locked' ||
        competitionStatus === 'poules_generated' ||
        competitionStatus === 'poules_locked';

      const deState: JourneyStepState =
        competitionStatus === 'finalised'
          ? 'completed'
          : deLockedByState
            ? 'locked'
            : 'active';

      steps.push({
        key: 'de',
        title: 'DE Tableau',
        subtitle: 'Run elimination rounds through to the final.',
        state: deState,
        lockReason: deLockedByState
          ? 'Lock rankings to unlock DE generation.'
          : undefined,
        onPress: () =>
          router.push({
            pathname: '/(tabs)/competitions/de-tableau',
            params: { competitionId: competition.id },
          }),
      });
    }

    const finalisationState: JourneyStepState = overview.isReadOnly
      ? 'completed'
      : overview.canFinalise
        ? 'active'
        : 'locked';

    steps.push({
      key: 'finalisation',
      title: 'Finalisation',
      subtitle: 'Freeze the competition and move it to Past.',
      state: finalisationState,
      lockReason:
        finalisationState === 'locked'
          ? hasDeStage
            ? 'Complete DE progression to unlock finalisation.'
            : 'Lock rankings to unlock finalisation.'
          : undefined,
    });

    return steps;
  }, [overview, router]);

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
                    canFinalise:
                      result.data.status !== 'finalised' &&
                      ((result.data.format === 'poules_only' &&
                        result.data.status === 'rankings_locked') ||
                        (result.data.format !== 'poules_only' &&
                          result.data.status === 'de_generated')),
                  }
                : previous
            );
          },
        },
      ]
    );
  };

  const onFinaliseCompetition = () => {
    if (!overview || overview.role !== 'organiser' || !overview.canFinalise || finalising) {
      return;
    }

    Alert.alert(
      'Finalise competition?',
      'This will freeze all competition edits and move it to Past. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalise',
          style: 'destructive',
          onPress: async () => {
            setFinalising(true);
            const result = await finaliseCompetition({
              competitionId: overview.competition.id,
            });
            setFinalising(false);

            if (!result.ok) {
              setErrorText(result.message);
              return;
            }

            analytics.capture('competition_finalised', {
              competition_id: overview.competition.id,
            });

            setOverview((previous) =>
              previous
                ? {
                    ...previous,
                    competition: result.data,
                    isReadOnly: true,
                    canFinalise: false,
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
        <View style={styles.backRow}>
          <BackButton
            onPress={() => router.replace('/(tabs)/competitions')}
            style={styles.backIconButton}
          />
        </View>
        <Text style={styles.title}>Competition Overview</Text>
        <CompetitionRealtimeBanner
          bannerText={realtimeBannerText}
          correctionNotice={realtimeCorrectionNotice}
          onRetry={retryRealtime}
          onDismissCorrection={clearCorrectionNotice}
        />

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

        {overview.role === 'organiser' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Finalisation</Text>
            <Text style={styles.progressText}>
              Finalise freezes results and makes the competition read-only.
            </Text>
            <Pressable
              onPress={onFinaliseCompetition}
              disabled={!overview.canFinalise || finalising}
              style={[
                styles.finaliseButton,
                (!overview.canFinalise || finalising) && styles.disabledButton,
              ]}
            >
              {finalising ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.finaliseButtonText}>Finalise Competition</Text>
              )}
            </Pressable>
            {!overview.canFinalise && !overview.isReadOnly ? (
              <Text style={styles.finaliseHintText}>
                Finalisation becomes available after rankings/DE completion.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Competition Journey</Text>
          {journeySteps.map((step, index) => (
            <View
              key={step.key}
              style={styles.journeyItem}
            >
              <Pressable
                onPress={step.onPress}
                disabled={!step.onPress}
                style={[
                  styles.journeyStepCard,
                  step.state === 'completed' && styles.journeyStepCompleted,
                  step.state === 'active' && styles.journeyStepActive,
                  step.state === 'locked' && styles.journeyStepLocked,
                ]}
              >
                <View style={styles.journeyStepHeader}>
                  <Text style={styles.journeyStepTitle}>
                    {index + 1}. {step.title}
                  </Text>
                  <View
                    style={[
                      styles.journeyStateBadge,
                      step.state === 'completed' && styles.journeyStateBadgeCompleted,
                      step.state === 'active' && styles.journeyStateBadgeActive,
                      step.state === 'locked' && styles.journeyStateBadgeLocked,
                    ]}
                  >
                    <Text style={styles.journeyStateBadgeText}>
                      {step.state === 'completed'
                        ? 'Completed'
                        : step.state === 'active'
                          ? 'Active'
                          : 'Locked'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.journeyStepSubtitle}>{step.subtitle}</Text>
                {step.lockReason ? (
                  <Text style={styles.journeyStepLockReason}>{step.lockReason}</Text>
                ) : null}
                {step.onPress ? (
                  <Text style={styles.journeyStepLink}>
                    {step.state === 'locked' ? 'Preview Step' : 'Open Step'}
                  </Text>
                ) : null}
              </Pressable>
              {index < journeySteps.length - 1 ? (
                <View style={styles.journeyArrowWrap}>
                  <Text style={styles.journeyArrow}>↓</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
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
  backRow: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#1F1F1F',
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
  journeyItem: {
    marginTop: 8,
  },
  journeyStepCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#191919',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  journeyStepCompleted: {
    borderColor: 'rgba(16,185,129,0.5)',
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  journeyStepActive: {
    borderColor: 'rgba(139,92,246,0.55)',
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  journeyStepLocked: {
    borderColor: '#3A3A3A',
    backgroundColor: '#1B1B1B',
  },
  journeyStepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  journeyStepTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  journeyStateBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  journeyStateBadgeCompleted: {
    backgroundColor: '#10B981',
  },
  journeyStateBadgeActive: {
    backgroundColor: '#8B5CF6',
  },
  journeyStateBadgeLocked: {
    backgroundColor: '#404040',
  },
  journeyStateBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  journeyStepSubtitle: {
    color: '#D3D3D3',
    fontSize: 13,
    lineHeight: 18,
  },
  journeyStepLockReason: {
    color: '#B9B9B9',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  journeyStepLink: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  journeyArrowWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  journeyArrow: {
    color: '#8B5CF6',
    fontSize: 18,
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
  finaliseButton: {
    borderRadius: 10,
    marginTop: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#A23A3A',
    backgroundColor: 'rgba(239,68,68,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finaliseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  finaliseHintText: {
    color: '#9D9D9D',
    fontSize: 12,
    marginTop: 8,
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

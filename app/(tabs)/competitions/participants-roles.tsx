import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_PARTICIPANT_STATUS_COLORS,
  COMPETITION_PARTICIPANT_STATUS_LABELS,
  COMPETITION_ROLE_LABELS,
  COMPETITION_STATUS_LABELS,
  COMPETITION_WITHDRAWAL_EDITABLE_STATUSES,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import {
  getCompetitionParticipantsData,
  leaveCompetitionAsParticipant,
  removeCompetitionParticipant,
  updateCompetitionParticipantRole,
  updateCompetitionParticipantWithdrawn,
} from '@/lib/clubCompetitionService';
import { withCompetitionReadTimeout } from '@/lib/competitionRetry';
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import type { CompetitionParticipantView, CompetitionParticipantsData } from '@/types/competition';
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

type RowAction =
  | {
      type: 'promote' | 'demote';
      participant: CompetitionParticipantView;
    }
  | {
      type: 'remove';
      participant: CompetitionParticipantView;
    }
  | {
      type: 'withdraw';
      participant: CompetitionParticipantView;
      withdrawn: boolean;
    };

const getInitials = (name: string): string => {
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0].slice(0, 1)}${words[words.length - 1].slice(0, 1)}`.toUpperCase();
};

export default function ParticipantsAndRolesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ competitionId?: string }>();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';

  const [data, setData] = useState<CompetitionParticipantsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const participantsVersionRef = useRef('');
  const loadRequestIdRef = useRef(0);

  const loadData = useCallback(async (showSpinner = true): Promise<string | null> => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!user?.id || !competitionId) {
      setLoading(false);
      setErrorText('Competition was not found.');
      participantsVersionRef.current = '';
      return null;
    }

    if (showSpinner) {
      setLoading(true);
    }
    setErrorText(null);

    try {
      const payload = await withCompetitionReadTimeout(
        () =>
          getCompetitionParticipantsData({
            userId: user.id,
            competitionId,
          }),
        { label: 'Competition participants' }
      );

      if (loadRequestIdRef.current !== requestId) {
        return null;
      }

      if (!payload) {
        setErrorText('You do not have access to this competition.');
        setData(null);
        participantsVersionRef.current = '';
        return null;
      }

      setData(payload);
      const version = `${payload.competition.updated_at}:${payload.competition.status}:${payload.participants
        .map((participant) => `${participant.user_id}:${participant.role}:${participant.status}`)
        .join('|')}`;
      participantsVersionRef.current = version;
      return version;
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return null;
      }

      console.warn('Competition participants load failed:', error);
      setErrorText('Could not load competition participants right now. Pull to retry.');
      participantsVersionRef.current = '';
      return null;
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [competitionId, user?.id]);

  const {
    bannerText: realtimeBannerText,
    correctionNotice: realtimeCorrectionNotice,
    clearCorrectionNotice,
    retryNow: retryRealtime,
  } = useCompetitionRealtime({
    competitionId,
    enabled: Boolean(user?.id && competitionId),
    surface: 'participants',
    onCompetitionEvent: () => {
      void loadData(false);
    },
    onReconnectRefetch: async () => {
      const before = participantsVersionRef.current;
      const after = await loadData(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      void loadData(true);
    }, [loadData])
  );

  const canCurrentUserManage = data?.currentUserRole === 'organiser' && data.competition.status !== 'finalised';
  const canWithdraw = useMemo(() => {
    if (!data) return false;
    return COMPETITION_WITHDRAWAL_EDITABLE_STATUSES.includes(data.competition.status);
  }, [data]);
  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;

  const runAction = async (rowAction: RowAction) => {
    if (!data) return;
    const participant = rowAction.participant;
    const actionKey = `${rowAction.type}:${participant.user_id}`;
    setActiveActionKey(actionKey);

    if (rowAction.type === 'promote' || rowAction.type === 'demote') {
      const targetRole = rowAction.type === 'promote' ? 'organiser' : 'participant';
      const result = await updateCompetitionParticipantRole({
        competitionId: data.competition.id,
        targetUserId: participant.user_id,
        newRole: targetRole,
      });

      if (!result.ok) {
        setErrorText(result.message);
        setActiveActionKey(null);
        return;
      }

      analytics.capture(targetRole === 'organiser' ? 'participant_promoted' : 'organiser_demoted', {
        competition_id: data.competition.id,
        participant_user_id: participant.user_id,
      });
      await loadData();
      setActiveActionKey(null);
      return;
    }

    if (rowAction.type === 'remove') {
      const result = await removeCompetitionParticipant({
        competitionId: data.competition.id,
        targetUserId: participant.user_id,
      });

      if (!result.ok) {
        setErrorText(result.message);
        setActiveActionKey(null);
        return;
      }

      analytics.capture('participant_removed', {
        competition_id: data.competition.id,
        participant_user_id: participant.user_id,
      });
      await loadData();
      setActiveActionKey(null);
      return;
    }

    if (rowAction.type !== 'withdraw') {
      setActiveActionKey(null);
      return;
    }

    const result = await updateCompetitionParticipantWithdrawn({
      competitionId: data.competition.id,
      targetUserId: participant.user_id,
      withdrawn: rowAction.withdrawn,
    });

    if (!result.ok) {
      setErrorText(result.message);
      setActiveActionKey(null);
      return;
    }

    analytics.capture('participant_withdrawn', {
      competition_id: data.competition.id,
      participant_user_id: participant.user_id,
      withdrawn: rowAction.withdrawn,
    });
    await loadData();
    setActiveActionKey(null);
  };

  const confirmAction = (rowAction: RowAction) => {
    const participant = rowAction.participant;
    if (rowAction.type === 'promote') {
      Alert.alert(
        'Promote to organiser?',
        `${participant.display_name} will get organiser permissions.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Promote', onPress: () => void runAction(rowAction) },
        ]
      );
      return;
    }

    if (rowAction.type === 'demote') {
      Alert.alert(
        'Demote to participant?',
        `${participant.display_name} will lose organiser permissions.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Demote', style: 'destructive', onPress: () => void runAction(rowAction) },
        ]
      );
      return;
    }

    if (rowAction.type === 'remove') {
      Alert.alert(
        'Remove participant?',
        `${participant.display_name} will be removed from this competition.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => void runAction(rowAction) },
        ]
      );
      return;
    }

    if (rowAction.type !== 'withdraw') {
      return;
    }

    Alert.alert(
      rowAction.withdrawn ? 'Mark withdrawn?' : 'Mark active?',
      rowAction.withdrawn
        ? `${participant.display_name} will be marked withdrawn.`
        : `${participant.display_name} will be marked active.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: rowAction.withdrawn ? 'Withdraw' : 'Set Active',
          onPress: () => void runAction(rowAction),
        },
      ]
    );
  };

  const onLeaveCompetition = () => {
    if (!data) return;
    Alert.alert(
      'Leave competition?',
      'You can only leave while registration is open.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActiveActionKey('leave:self');
            const result = await leaveCompetitionAsParticipant({
              competitionId: data.competition.id,
            });
            if (!result.ok) {
              setErrorText(result.message);
              setActiveActionKey(null);
              return;
            }
            router.replace('/(tabs)/competitions');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.purple.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{errorText ?? 'Participants list unavailable.'}</Text>
        <Pressable
          onPress={() => router.replace('/(tabs)/competitions')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Hub</Text>
        </Pressable>
      </View>
    );
  }

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
            onPress={() => {
              if (!competitionId) {
                router.replace('/(tabs)/competitions');
                return;
              }
              router.replace({
                pathname: '/(tabs)/competitions/overview',
                params: { competitionId },
              });
            }}
            style={styles.backIconButton}
          />
        </View>
        <Text style={styles.title}>Participants & Roles</Text>
        <CompetitionRealtimeBanner
          bannerText={realtimeBannerText}
          correctionNotice={realtimeCorrectionNotice}
          onRetry={retryRealtime}
          onDismissCorrection={clearCorrectionNotice}
        />
        <Text style={styles.subtitle}>
          {data.competition.name} • {COMPETITION_STATUS_LABELS[data.competition.status]}
        </Text>

        <View style={styles.infoRow}>
          <InfoStat
            label="Participants"
            value={`${data.participants.length}`}
          />
          <InfoStat
            label="Organisers"
            value={`${data.organiserCount}`}
          />
        </View>

        <View style={styles.listCard}>
          {data.participants.map((participant) => {
            const isLastOrganiser =
              participant.role === 'organiser' && data.organiserCount <= 1;
            const canDemote = canCurrentUserManage && !isLastOrganiser;
            const canRemove =
              canCurrentUserManage &&
              data.competition.status === 'registration_open' &&
              !participant.isSelf;
            const canToggleWithdraw = canCurrentUserManage && canWithdraw;
            const isActionLoading = (actionType: string) =>
              activeActionKey === `${actionType}:${participant.user_id}`;

            return (
              <View
                key={participant.id}
                style={[styles.participantRow, participant.isSelf && styles.participantRowSelf]}
              >
                <View style={styles.participantIdentity}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {getInitials(participant.display_name)}
                    </Text>
                  </View>
                  <View style={styles.nameColumn}>
                    <View style={styles.participantNameRow}>
                      <Text style={styles.participantName}>{participant.display_name}</Text>
                      {participant.isSelf ? (
                        <View style={styles.selfBadge}>
                          <Text style={styles.selfBadgeText}>You</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.badgesRow}>
                      <Badge
                        text={COMPETITION_ROLE_LABELS[participant.role]}
                        background={participant.role === 'organiser' ? '#6C5CE7' : '#303030'}
                      />
                      <Badge
                        text={COMPETITION_PARTICIPANT_STATUS_LABELS[participant.status]}
                        background={COMPETITION_PARTICIPANT_STATUS_COLORS[participant.status]}
                      />
                    </View>
                  </View>
                </View>

                {canCurrentUserManage ? (
                  <View style={styles.actionsWrap}>
                    {participant.role === 'participant' ? (
                      <ActionChip
                        text="Promote"
                        onPress={() =>
                          confirmAction({
                            type: 'promote',
                            participant,
                          })
                        }
                        loading={isActionLoading('promote')}
                      />
                    ) : (
                      <ActionChip
                        text="Demote"
                        disabled={!canDemote}
                        onPress={() =>
                          confirmAction({
                            type: 'demote',
                            participant,
                          })
                        }
                        loading={isActionLoading('demote')}
                      />
                    )}

                    {canRemove ? (
                      <ActionChip
                        text="Remove"
                        danger
                        onPress={() =>
                          confirmAction({
                            type: 'remove',
                            participant,
                          })
                        }
                        loading={isActionLoading('remove')}
                      />
                    ) : null}

                    {canToggleWithdraw ? (
                      <ActionChip
                        text={participant.status === 'withdrawn' ? 'Set Active' : 'Withdraw'}
                        onPress={() =>
                          confirmAction({
                            type: 'withdraw',
                            participant,
                            withdrawn: participant.status !== 'withdrawn',
                          })
                        }
                        loading={isActionLoading('withdraw')}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Leave Competition</Text>
          <Text style={styles.sectionHelp}>
            You can leave only while registration is open.
          </Text>
          <Pressable
            onPress={onLeaveCompetition}
            disabled={data.competition.status !== 'registration_open' || activeActionKey === 'leave:self'}
            style={[
              styles.leaveButton,
              (data.competition.status !== 'registration_open' || activeActionKey === 'leave:self') &&
                styles.disabledButton,
            ]}
          >
            {activeActionKey === 'leave:self' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.leaveButtonText}>Leave Competition</Text>
            )}
          </Pressable>
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
      </ScrollView>
    </View>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoStat}>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

function Badge({ text, background }: { text: string; background: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function ActionChip({
  text,
  onPress,
  danger = false,
  disabled = false,
  loading = false,
}: {
  text: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.actionChip,
        danger && styles.actionChipDanger,
        (disabled || loading) && styles.disabledButton,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={styles.actionChipText}>{text}</Text>
      )}
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
    paddingHorizontal: 24,
  },
  content: {
    paddingHorizontal: 16,
  },
  backRow: {
    alignSelf: 'flex-start',
    marginBottom: 10,
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
  },
  subtitle: {
    color: '#A0A0A0',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  infoStat: {
    flex: 1,
    backgroundColor: '#212121',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#323232',
    paddingVertical: 10,
    alignItems: 'center',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  infoLabel: {
    color: '#9D9D9D',
    fontSize: 12,
    marginTop: 2,
  },
  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.2)',
    backgroundColor: '#212121',
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  participantRow: {
    borderRadius: 12,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    padding: 10,
  },
  participantRowSelf: {
    borderColor: 'rgba(139,92,246,0.7)',
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  participantIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  nameColumn: {
    flex: 1,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  selfBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.45)',
    backgroundColor: 'rgba(200,166,255,0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  selfBadgeText: {
    color: '#EBD8FF',
    fontSize: 10,
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actionsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B4B4B',
    backgroundColor: '#232323',
    minHeight: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipDanger: {
    borderColor: '#7A2A2A',
    backgroundColor: '#3B1919',
  },
  actionChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHelp: {
    color: '#9D9D9D',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  leaveButton: {
    borderRadius: 10,
    minHeight: 42,
    backgroundColor: '#8F2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  errorText: {
    color: '#FF7675',
    fontSize: 13,
    marginTop: 2,
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

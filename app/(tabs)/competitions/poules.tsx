import { Colors } from '@/constants/Colors';
import {
  COMPETITION_MATCH_STATUS_COLORS,
  COMPETITION_MATCH_STATUS_LABELS,
  COMPETITION_ROLE_LABELS,
  COMPETITION_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import {
  generateCompetitionPoules,
  getCompetitionPoulesData,
  lockCompetitionPoules,
  moveCompetitionPoolAssignment,
} from '@/lib/clubCompetitionService';
import type {
  ClubCompetitionMatchRecord,
  CompetitionPouleParticipant,
  CompetitionPoulesData,
  CompetitionScoringMode,
} from '@/types/competition';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AssignmentMoveAction = {
  participant: CompetitionPouleParticipant;
  targetPoolId: string;
  targetPosition: number | null;
  actionKey: string;
};

const getShortName = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) return 'Unknown';
  if (normalized.length <= 18) return normalized;
  return `${normalized.slice(0, 17)}...`;
};

export default function PoulesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ competitionId?: string }>();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';

  const [data, setData] = useState<CompetitionPoulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [assignmentEditMode, setAssignmentEditMode] = useState(false);
  const [sheetMatch, setSheetMatch] = useState<ClubCompetitionMatchRecord | null>(null);

  const loadData = useCallback(
    async (showSpinner = true) => {
      if (!user?.id || !competitionId) {
        setLoading(false);
        setData(null);
        setErrorText('Competition was not found.');
        return;
      }

      if (showSpinner) {
        setLoading(true);
      }
      setErrorText(null);

      const payload = await getCompetitionPoulesData({
        userId: user.id,
        competitionId,
      });

      if (!payload) {
        setData(null);
        setLoading(false);
        setRefreshing(false);
        setErrorText('You do not have access to this competition.');
        return;
      }

      setData(payload);
      setSelectedPoolId((previous) => {
        if (payload.pools.length === 0) return null;
        if (previous && payload.pools.some((pool) => pool.pool.id === previous)) {
          return previous;
        }
        return payload.pools[0].pool.id;
      });
      if (!payload.canEditAssignments) {
        setAssignmentEditMode(false);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [competitionId, user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      analytics.capture('poules_viewed', {
        competition_id: competitionId,
      });
      void loadData(true);
    }, [competitionId, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const selectedPool = useMemo(() => {
    if (!data || !selectedPoolId) return null;
    return data.pools.find((pool) => pool.pool.id === selectedPoolId) ?? null;
  }, [data, selectedPoolId]);

  const selectedPoolIndex = useMemo(() => {
    if (!data || !selectedPool) return -1;
    return data.pools.findIndex((pool) => pool.pool.id === selectedPool.pool.id);
  }, [data, selectedPool]);

  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();
    selectedPool?.participants.forEach((entry) => {
      map.set(entry.participant.id, entry.participant.display_name);
    });
    return map;
  }, [selectedPool]);

  const runGenerate = async (regenerate: boolean) => {
    if (!data) return;
    const actionKey = regenerate ? 'regenerate' : 'generate';
    setActiveActionKey(actionKey);
    const result = await generateCompetitionPoules({
      competitionId: data.competition.id,
      regenerate,
    });
    setActiveActionKey(null);

    if (!result.ok) {
      setErrorText(result.message);
      return;
    }

    if (regenerate) {
      analytics.capture('poule_regenerated', {
        competition_id: data.competition.id,
        pool_count: result.data.pool_count,
        match_count: result.data.match_count,
      });
    } else {
      analytics.capture('poules_generated', {
        competition_id: data.competition.id,
        pool_count: result.data.pool_count,
        match_count: result.data.match_count,
      });
    }

    await loadData(true);
  };

  const onGeneratePressed = () => {
    if (!data) return;
    Alert.alert(
      'Generate poules?',
      'This creates randomized poules and all poule matches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => void runGenerate(false),
        },
      ]
    );
  };

  const onRegeneratePressed = () => {
    if (!data) return;
    Alert.alert(
      'Regenerate poules?',
      'Existing poules and poule matches will be rebuilt. This is allowed only before scoring starts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => void runGenerate(true),
        },
      ]
    );
  };

  const onLockPoules = () => {
    if (!data) return;
    Alert.alert(
      'Lock poules?',
      'Assignments can no longer be edited after locking.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          onPress: async () => {
            setActiveActionKey('lock');
            const result = await lockCompetitionPoules({
              competitionId: data.competition.id,
            });
            setActiveActionKey(null);
            if (!result.ok) {
              setErrorText(result.message);
              return;
            }
            analytics.capture('poule_locked', {
              competition_id: data.competition.id,
            });
            await loadData(true);
          },
        },
      ]
    );
  };

  const runAssignmentMove = async (action: AssignmentMoveAction) => {
    if (!data) return;
    setActiveActionKey(action.actionKey);
    const result = await moveCompetitionPoolAssignment({
      competitionId: data.competition.id,
      participantId: action.participant.participant.id,
      targetPoolId: action.targetPoolId,
      targetPosition: action.targetPosition,
    });
    setActiveActionKey(null);
    if (!result.ok) {
      setErrorText(result.message);
      return;
    }
    await loadData(false);
  };

  const onMoveUp = (participant: CompetitionPouleParticipant) => {
    if (!selectedPool) return;
    if (participant.assignment.position <= 1) return;
    void runAssignmentMove({
      participant,
      targetPoolId: selectedPool.pool.id,
      targetPosition: participant.assignment.position - 1,
      actionKey: `move-up:${participant.participant.id}`,
    });
  };

  const onMoveDown = (participant: CompetitionPouleParticipant) => {
    if (!selectedPool) return;
    if (participant.assignment.position >= selectedPool.participants.length) return;
    void runAssignmentMove({
      participant,
      targetPoolId: selectedPool.pool.id,
      targetPosition: participant.assignment.position + 1,
      actionKey: `move-down:${participant.participant.id}`,
    });
  };

  const onMoveToNeighborPool = (
    participant: CompetitionPouleParticipant,
    direction: 'prev' | 'next'
  ) => {
    if (!data || !selectedPool || selectedPoolIndex < 0) return;
    const targetIndex = direction === 'prev' ? selectedPoolIndex - 1 : selectedPoolIndex + 1;
    const targetPool = data.pools[targetIndex];
    if (!targetPool) return;

    void runAssignmentMove({
      participant,
      targetPoolId: targetPool.pool.id,
      targetPosition: null,
      actionKey: `move-pool-${direction}:${participant.participant.id}`,
    });
  };

  const navigateToScoring = (
    match: ClubCompetitionMatchRecord,
    mode: CompetitionScoringMode,
    selectedCompetitionId: string
  ) => {
    if (mode === 'remote') {
      router.push({
        pathname: '/(tabs)/remote',
        params: {
          competitionMode: 'true',
          competitionId: selectedCompetitionId,
          matchId: match.id,
          competitionFrom: 'poules',
        },
      });
      return;
    }

    router.push({
      pathname: '/(tabs)/competitions/manual-score-entry',
      params: {
        competitionId: selectedCompetitionId,
        matchId: match.id,
        mode,
        from: 'poules',
      },
    });
  };

  const onPressMatch = (match: ClubCompetitionMatchRecord) => {
    if (!data) return;

    if (match.scoring_mode === 'remote' || match.scoring_mode === 'manual') {
      navigateToScoring(match, match.scoring_mode, data.competition.id);
      return;
    }

    analytics.capture('scoring_method_sheet_opened', {
      competition_id: data.competition.id,
      match_id: match.id,
      stage: match.stage,
    });
    setSheetMatch(match);
  };

  const onSelectScoringMode = (mode: CompetitionScoringMode) => {
    if (!sheetMatch || !data) return;

    analytics.capture('scoring_method_selected', {
      competition_id: data.competition.id,
      match_id: sheetMatch.id,
      stage: sheetMatch.stage,
      scoring_mode: mode,
    });

    const match = sheetMatch;
    setSheetMatch(null);
    navigateToScoring(match, mode, data.competition.id);
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
        <Text style={styles.errorText}>{errorText ?? 'Poules data unavailable.'}</Text>
        <Pressable
          onPress={() => router.replace('/(tabs)/competitions')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Hub</Text>
        </Pressable>
      </View>
    );
  }

  const isGenerating = activeActionKey === 'generate' || activeActionKey === 'regenerate';
  const isLocking = activeActionKey === 'lock';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 20,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.purple.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Poules</Text>
        <Text style={styles.subtitle}>
          {data.competition.name} • {COMPETITION_STATUS_LABELS[data.competition.status]}
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Competition</Text>
          <Text style={styles.metaText}>
            {data.competition.weapon.toUpperCase()} • {COMPETITION_ROLE_LABELS[data.currentUserRole]}
          </Text>
          <Text style={styles.metaText}>
            Poules: {data.pools.length} • Scoring started:{' '}
            {data.hasAnyScoredPouleMatch ? 'Yes' : 'No'}
          </Text>

          {data.currentUserRole === 'organiser' ? (
            <View style={styles.controlWrap}>
              {data.canGenerate ? (
                <ActionButton
                  text="Generate Poules"
                  onPress={onGeneratePressed}
                  loading={activeActionKey === 'generate'}
                  disabled={isGenerating || isLocking}
                  primary
                />
              ) : null}

              {data.canRegenerate ? (
                <ActionButton
                  text="Regenerate"
                  onPress={onRegeneratePressed}
                  loading={activeActionKey === 'regenerate'}
                  disabled={isGenerating || isLocking}
                />
              ) : null}

              {data.canLock ? (
                <ActionButton
                  text="Lock Poules"
                  onPress={onLockPoules}
                  loading={activeActionKey === 'lock'}
                  disabled={isGenerating || isLocking}
                />
              ) : null}

              {data.canEditAssignments ? (
                <Pressable
                  onPress={() => setAssignmentEditMode((current) => !current)}
                  style={[styles.secondaryAction, assignmentEditMode && styles.secondaryActionActive]}
                >
                  <Text style={styles.secondaryActionText}>
                    {assignmentEditMode ? 'Done Editing' : 'Edit Assignments'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {data.pools.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No poules yet</Text>
            <Text style={styles.emptyText}>
              Lock registration, then generate poules to create pool assignments and matches.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.tabRow}>
              {data.pools.map((pool) => {
                const active = pool.pool.id === selectedPool?.pool.id;
                return (
                  <Pressable
                    key={pool.pool.id}
                    onPress={() => setSelectedPoolId(pool.pool.id)}
                    style={[styles.tabChip, active && styles.tabChipActive]}
                  >
                    <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                      {pool.pool.pool_label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedPool ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Poule {selectedPool.pool.pool_label}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <View style={styles.table}>
                      <View style={[styles.tableRow, styles.tableHeaderRow]}>
                        <Text style={[styles.headerCell, styles.nameCell]}>Name</Text>
                        <Text style={styles.headerCell}>W</Text>
                        <Text style={styles.headerCell}>L</Text>
                        <Text style={styles.headerCell}>IND</Text>
                        <Text style={styles.headerCell}>HS</Text>
                        <Text style={styles.headerCell}>HR</Text>
                        <Text style={styles.headerCell}>LEFT</Text>
                      </View>

                      {selectedPool.participants.map((entry) => (
                        <View
                          key={entry.assignment.id}
                          style={styles.tableRow}
                        >
                          <Text style={[styles.bodyCell, styles.nameCell]}>
                            {getShortName(entry.participant.display_name)}
                          </Text>
                          <Text style={styles.bodyCell}>{entry.stats.wins}</Text>
                          <Text style={styles.bodyCell}>{entry.stats.losses}</Text>
                          <Text style={styles.bodyCell}>{entry.stats.indicator}</Text>
                          <Text style={styles.bodyCell}>{entry.stats.hitsScored}</Text>
                          <Text style={styles.bodyCell}>{entry.stats.hitsReceived}</Text>
                          <Text style={styles.bodyCell}>{entry.stats.fightsRemaining}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {assignmentEditMode && data.canEditAssignments ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Assignment Editor</Text>
                    <Text style={styles.helperText}>
                      Move participants up/down or across neighboring poules before lock.
                    </Text>
                    {selectedPool.participants.map((entry) => {
                      const isBusy = activeActionKey?.endsWith(entry.participant.id) ?? false;
                      return (
                        <View
                          key={`editor-${entry.assignment.id}`}
                          style={styles.editorRow}
                        >
                          <Text style={styles.editorName}>
                            {entry.assignment.position}. {entry.participant.display_name}
                          </Text>
                          <View style={styles.editorActions}>
                            <MiniButton
                              text="Up"
                              onPress={() => onMoveUp(entry)}
                              disabled={entry.assignment.position <= 1 || !!activeActionKey}
                            />
                            <MiniButton
                              text="Down"
                              onPress={() => onMoveDown(entry)}
                              disabled={
                                entry.assignment.position >= selectedPool.participants.length ||
                                !!activeActionKey
                              }
                            />
                            <MiniButton
                              text="Pool -"
                              onPress={() => onMoveToNeighborPool(entry, 'prev')}
                              disabled={selectedPoolIndex <= 0 || !!activeActionKey}
                            />
                            <MiniButton
                              text="Pool +"
                              onPress={() => onMoveToNeighborPool(entry, 'next')}
                              disabled={
                                selectedPoolIndex < 0 ||
                                selectedPoolIndex >= data.pools.length - 1 ||
                                !!activeActionKey
                              }
                            />
                          </View>
                          {isBusy ? <ActivityIndicator size="small" color="#E9D7FF" /> : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Matches</Text>
                  {selectedPool.matches.length === 0 ? (
                    <Text style={styles.emptyText}>No matches in this poule yet.</Text>
                  ) : (
                    selectedPool.matches.map((match) => {
                      const fencerA =
                        (match.fencer_a_participant_id
                          ? participantNameById.get(match.fencer_a_participant_id)
                          : null) ?? 'Unknown';
                      const fencerB =
                        (match.fencer_b_participant_id
                          ? participantNameById.get(match.fencer_b_participant_id)
                          : null) ?? 'Unknown';
                      const statusLabel = COMPETITION_MATCH_STATUS_LABELS[match.status];
                      const scoreText =
                        match.status === 'completed' &&
                        match.score_a != null &&
                        match.score_b != null
                          ? `${match.score_a}-${match.score_b}`
                          : null;

                      return (
                        <Pressable
                          key={match.id}
                          onPress={() => onPressMatch(match)}
                          style={styles.matchRow}
                        >
                          <View style={styles.matchInfo}>
                            <Text style={styles.matchText}>
                              {fencerA} vs {fencerB}
                            </Text>
                            <View
                              style={[
                                styles.matchStatusBadge,
                                {
                                  backgroundColor: COMPETITION_MATCH_STATUS_COLORS[match.status],
                                },
                              ]}
                            >
                              <Text style={styles.matchStatusText}>{statusLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.matchScoreWrap}>
                            {scoreText ? <Text style={styles.scoreText}>{scoreText}</Text> : null}
                            <Text style={styles.tapHint}>Tap to score</Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={!!sheetMatch}
        onRequestClose={() => setSheetMatch(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setSheetMatch(null)}
          />
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Choose Scoring Method</Text>
            <Text style={styles.sheetSubtitle}>How do you want to score this match?</Text>

            <Pressable
              onPress={() => onSelectScoringMode('remote')}
              style={[styles.sheetButton, styles.sheetPrimaryButton]}
            >
              <Text style={styles.sheetPrimaryButtonText}>Use Remote (Live)</Text>
            </Pressable>

            <Pressable
              onPress={() => onSelectScoringMode('manual')}
              style={[styles.sheetButton, styles.sheetSecondaryButton]}
            >
              <Text style={styles.sheetSecondaryButtonText}>Enter Score Manually</Text>
            </Pressable>

            <Pressable
              onPress={() => setSheetMatch(null)}
              style={[styles.sheetButton, styles.sheetCancelButton]}
            >
              <Text style={styles.sheetCancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionButton({
  text,
  onPress,
  disabled,
  loading = false,
  primary = false,
}: {
  text: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.actionButton,
        primary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        (disabled || loading) && styles.actionButtonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : '#E9D7FF'} size="small" />
      ) : (
        <Text
          style={[
            styles.actionButtonText,
            primary ? styles.actionButtonTextPrimary : styles.actionButtonTextSecondary,
          ]}
        >
          {text}
        </Text>
      )}
    </Pressable>
  );
}

function MiniButton({
  text,
  onPress,
  disabled,
}: {
  text: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.miniButton, disabled && styles.miniButtonDisabled]}
    >
      <Text style={styles.miniButtonText}>{text}</Text>
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
  subtitle: {
    color: '#9D9D9D',
    fontSize: 13,
    marginBottom: 2,
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.24)',
    padding: 14,
    gap: 10,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    padding: 14,
    gap: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#9D9D9D',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    color: '#A9A9A9',
    fontSize: 13,
  },
  controlWrap: {
    marginTop: 4,
    gap: 8,
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.purple.primary,
  },
  actionButtonSecondary: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.45)',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  actionButtonTextSecondary: {
    color: '#E9D7FF',
  },
  secondaryAction: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionActive: {
    borderColor: Colors.purple.primary,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  secondaryActionText: {
    color: '#E9D7FF',
    fontSize: 13,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabChip: {
    minWidth: 44,
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabChipActive: {
    borderColor: Colors.purple.primary,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  tabChipText: {
    color: '#BFBFBF',
    fontSize: 13,
    fontWeight: '700',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  table: {
    minWidth: 460,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  tableHeaderRow: {
    backgroundColor: '#1F1F1F',
  },
  headerCell: {
    width: 46,
    color: '#D7D7D7',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  bodyCell: {
    width: 46,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameCell: {
    width: 180,
    textAlign: 'left',
  },
  helperText: {
    color: '#8F8F8F',
    fontSize: 12,
    marginTop: -2,
    marginBottom: 4,
  },
  editorRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    backgroundColor: '#171717',
    padding: 10,
    gap: 8,
  },
  editorName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B3B3B',
    backgroundColor: '#222222',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniButtonDisabled: {
    opacity: 0.45,
  },
  miniButtonText: {
    color: '#D8D8D8',
    fontSize: 12,
    fontWeight: '700',
  },
  matchRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    backgroundColor: '#171717',
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  matchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  matchText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  matchStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  matchScoreWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tapHint: {
    color: '#8F8F8F',
    fontSize: 12,
  },
  errorText: {
    color: '#FF7675',
    fontSize: 13,
    lineHeight: 18,
  },
  backButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#D8D8D8',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: '#212121',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.24)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 10,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: '#9D9D9D',
    fontSize: 13,
    marginBottom: 4,
  },
  sheetButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryButton: {
    backgroundColor: Colors.purple.primary,
  },
  sheetSecondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.5)',
    backgroundColor: '#1A1A1A',
  },
  sheetCancelButton: {
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#171717',
  },
  sheetPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetSecondaryButtonText: {
    color: '#E9D7FF',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetCancelButtonText: {
    color: '#CFCFCF',
    fontSize: 14,
    fontWeight: '700',
  },
});

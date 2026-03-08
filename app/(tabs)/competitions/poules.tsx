import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { BackButton } from '@/components/BackButton';
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
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import type {
  ClubCompetitionMatchRecord,
  CompetitionPouleParticipant,
  CompetitionPoulesData,
  CompetitionScoringMode,
} from '@/types/competition';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AssignmentMoveAction = {
  participant: CompetitionPouleParticipant;
  targetPoolId: string;
  targetPosition: number | null;
  actionKey: string;
  focusPoolId?: string;
};

type AssignmentRowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  position: number;
};

type AssignmentDropTarget = {
  targetPoolId: string;
  targetPosition: number | null;
  previewLabel: string;
};

type AssignmentDragState = {
  participant: CompetitionPouleParticipant;
  sourcePoolId: string;
  sourcePosition: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  rowWidth: number;
  rowHeight: number;
};

type PouleResultCell = {
  label: string;
  tone: 'neutral' | 'win' | 'loss' | 'muted';
};

const getShortName = (value: string): string => {
  const normalized = value.trim();
  if (!normalized) return 'Unknown';
  if (normalized.length <= 18) return normalized;
  return `${normalized.slice(0, 17)}...`;
};

const pointInRect = (
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number } | undefined
): boolean => {
  if (!rect) return false;
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
};

const getPairKey = (participantAId: string, participantBId: string): string => {
  return participantAId < participantBId
    ? `${participantAId}:${participantBId}`
    : `${participantBId}:${participantAId}`;
};

const getPouleResultCell = (
  match: ClubCompetitionMatchRecord | undefined,
  rowParticipantId: string
): PouleResultCell => {
  if (!match) {
    return { label: '-', tone: 'muted' };
  }

  if (match.status === 'canceled_withdrawal') {
    return { label: 'WD', tone: 'muted' };
  }

  if (match.status === 'annulled_withdrawal') {
    return { label: 'ANN', tone: 'muted' };
  }

  const rowIsFencerA = match.fencer_a_participant_id === rowParticipantId;
  const rowScore = rowIsFencerA ? match.score_a : match.score_b;
  const opponentScore = rowIsFencerA ? match.score_b : match.score_a;

  if (match.status === 'completed' && rowScore != null && opponentScore != null) {
    if (rowScore > opponentScore) {
      return { label: `V${rowScore}`, tone: 'win' };
    }
    if (rowScore < opponentScore) {
      return { label: `D${rowScore}`, tone: 'loss' };
    }
    return { label: `${rowScore}-${opponentScore}`, tone: 'neutral' };
  }

  if (match.status === 'live') {
    return {
      label: `${rowScore ?? 0}-${opponentScore ?? 0}`,
      tone: 'neutral',
    };
  }

  return { label: '-', tone: 'muted' };
};

export default function PoulesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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
  const [assignmentDrag, setAssignmentDrag] = useState<AssignmentDragState | null>(null);
  const [assignmentDropTarget, setAssignmentDropTarget] = useState<AssignmentDropTarget | null>(
    null
  );
  const [sheetMatch, setSheetMatch] = useState<ClubCompetitionMatchRecord | null>(null);
  const dataVersionRef = useRef('');
  const assignmentRowRefs = useRef<Record<string, View | null>>({});
  const poolTabRefs = useRef<Record<string, View | null>>({});
  const assignmentRowRectsRef = useRef<Record<string, AssignmentRowRect>>({});
  const poolTabRectsRef = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const assignmentDragRef = useRef<AssignmentDragState | null>(null);
  const assignmentDropTargetRef = useRef<AssignmentDropTarget | null>(null);

  const loadData = useCallback(
    async (showSpinner = true): Promise<string | null> => {
      if (!user?.id || !competitionId) {
        setLoading(false);
        setData(null);
        setErrorText('Competition was not found.');
        dataVersionRef.current = '';
        return null;
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
        dataVersionRef.current = '';
        return null;
      }

      setData(payload);
      const version = `${payload.competition.updated_at}:${payload.competition.status}:${payload.pools
        .map((pool) => {
          const participantsKey = pool.participants
            .map((entry) => `${entry.participant.id}:${entry.assignment.position}`)
            .join(',');
          const matchesKey = pool.matches
            .map(
              (match) =>
                `${match.id}:${match.status}:${match.score_a ?? ''}:${match.score_b ?? ''}:${match.updated_at}`
            )
            .join(',');
          return `${pool.pool.id}|${participantsKey}|${matchesKey}`;
        })
        .join(';')}`;
      dataVersionRef.current = version;
      setSelectedPoolId((previous) => {
        if (payload.pools.length === 0) return null;
        if (previous && payload.pools.some((pool) => pool.pool.id === previous)) {
          return previous;
        }
        return payload.pools[0].pool.id;
      });
      if (!payload.canEditAssignments) {
        setAssignmentEditMode(false);
        setAssignmentDrag(null);
        setAssignmentDropTarget(null);
      }
      setLoading(false);
      setRefreshing(false);
      return version;
    },
    [competitionId, user?.id]
  );

  const {
    bannerText: realtimeBannerText,
    correctionNotice: realtimeCorrectionNotice,
    clearCorrectionNotice,
    retryNow: retryRealtime,
  } = useCompetitionRealtime({
    competitionId,
    enabled: Boolean(user?.id && competitionId),
    surface: 'poules',
    onCompetitionEvent: () => {
      void loadData(false);
    },
    onReconnectRefetch: async () => {
      const before = dataVersionRef.current;
      const after = await loadData(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      analytics.capture('poules_viewed', {
        competition_id: competitionId,
      });
      void loadData(true);
    }, [competitionId, loadData])
  );

  useEffect(() => {
    assignmentDragRef.current = assignmentDrag;
  }, [assignmentDrag]);

  useEffect(() => {
    assignmentDropTargetRef.current = assignmentDropTarget;
  }, [assignmentDropTarget]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const selectedPool = useMemo(() => {
    if (!data || !selectedPoolId) return null;
    return data.pools.find((pool) => pool.pool.id === selectedPoolId) ?? null;
  }, [data, selectedPoolId]);

  const selectedPoolParticipantsOrdered = useMemo(() => {
    if (!selectedPool) return [];
    return selectedPool.participants
      .slice()
      .sort((a, b) => a.assignment.position - b.assignment.position);
  }, [selectedPool]);

  const selectedPoolMatchByPair = useMemo(() => {
    const map = new Map<string, ClubCompetitionMatchRecord>();
    if (!selectedPool) return map;
    selectedPool.matches.forEach((match) => {
      if (!match.fencer_a_participant_id || !match.fencer_b_participant_id) {
        return;
      }
      map.set(getPairKey(match.fencer_a_participant_id, match.fencer_b_participant_id), match);
    });
    return map;
  }, [selectedPool]);

  const formalOpponentLegend = useMemo(() => {
    if (selectedPoolParticipantsOrdered.length === 0) return '';
    return selectedPoolParticipantsOrdered
      .map((entry, index) => `${index + 1}=${getShortName(entry.participant.display_name)}`)
      .join('  •  ');
  }, [selectedPoolParticipantsOrdered]);

  const participantNameById = useMemo(() => {
    const map = new Map<string, string>();
    selectedPool?.participants.forEach((entry) => {
      map.set(entry.participant.id, entry.participant.display_name);
    });
    return map;
  }, [selectedPool]);

  const selectedPoolParticipantById = useMemo(() => {
    const map = new Map<string, CompetitionPouleParticipant['participant']>();
    selectedPool?.participants.forEach((entry) => {
      map.set(entry.participant.id, entry.participant);
    });
    return map;
  }, [selectedPool]);

  const poolLabelById = useMemo(() => {
    const map = new Map<string, string>();
    data?.pools.forEach((pool) => {
      map.set(pool.pool.id, pool.pool.pool_label);
    });
    return map;
  }, [data]);

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

  const runAssignmentMove = useCallback(
    async (action: AssignmentMoveAction) => {
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
      if (action.focusPoolId) {
        setSelectedPoolId(action.focusPoolId);
      }
      await loadData(false);
    },
    [data, loadData]
  );

  const measureViewInWindow = useCallback(
    (view: View | null): Promise<{ x: number; y: number; width: number; height: number } | null> =>
      new Promise((resolve) => {
        if (!view || typeof view.measureInWindow !== 'function') {
          resolve(null);
          return;
        }
        view.measureInWindow((x, y, width, height) => {
          if (width <= 0 || height <= 0) {
            resolve(null);
            return;
          }
          resolve({ x, y, width, height });
        });
      }),
    []
  );

  const captureAssignmentDropZones = useCallback(async () => {
    if (!data || !selectedPool) {
      assignmentRowRectsRef.current = {};
      poolTabRectsRef.current = {};
      return;
    }

    const rowRects: Record<string, AssignmentRowRect> = {};
    await Promise.all(
      selectedPool.participants.map(async (entry) => {
        const rect = await measureViewInWindow(assignmentRowRefs.current[entry.participant.id] ?? null);
        if (!rect) return;
        rowRects[entry.participant.id] = {
          ...rect,
          position: entry.assignment.position,
        };
      })
    );
    assignmentRowRectsRef.current = rowRects;

    const tabRects: Record<string, { x: number; y: number; width: number; height: number }> = {};
    await Promise.all(
      data.pools.map(async (pool) => {
        const rect = await measureViewInWindow(poolTabRefs.current[pool.pool.id] ?? null);
        if (!rect) return;
        tabRects[pool.pool.id] = rect;
      })
    );
    poolTabRectsRef.current = tabRects;
  }, [data, measureViewInWindow, selectedPool]);

  const computeSamePoolDropPosition = useCallback(
    (pageY: number, draggingParticipantId: string): number | null => {
      if (!selectedPool || selectedPool.participants.length === 0) return null;

      const nonDraggingRows = selectedPool.participants
        .filter((entry) => entry.participant.id !== draggingParticipantId)
        .map((entry) => ({
          participantId: entry.participant.id,
          rect: assignmentRowRectsRef.current[entry.participant.id],
        }))
        .filter(
          (
            row
          ): row is {
            participantId: string;
            rect: AssignmentRowRect;
          } => Boolean(row.rect)
        );

      if (nonDraggingRows.length === 0) {
        return 1;
      }

      let insertionIndex = selectedPool.participants.length;
      for (let index = 0; index < nonDraggingRows.length; index += 1) {
        const row = nonDraggingRows[index];
        const rowCenter = row.rect.y + row.rect.height / 2;
        if (pageY < rowCenter) {
          insertionIndex = index + 1;
          break;
        }
      }
      return insertionIndex;
    },
    [selectedPool]
  );

  const computeAssignmentDropTarget = useCallback(
    (
      pageX: number,
      pageY: number,
      draggingParticipant: CompetitionPouleParticipant
    ): AssignmentDropTarget | null => {
      if (!data || !selectedPool) return null;

      const hoveredOtherPool = data.pools.find((pool) => {
        if (pool.pool.id === selectedPool.pool.id) return false;
        return pointInRect(pageX, pageY, poolTabRectsRef.current[pool.pool.id]);
      });

      if (hoveredOtherPool) {
        return {
          targetPoolId: hoveredOtherPool.pool.id,
          targetPosition: null,
          previewLabel: `Drop into Pool ${hoveredOtherPool.pool.pool_label}`,
        };
      }

      const samePoolPosition = computeSamePoolDropPosition(
        pageY,
        draggingParticipant.participant.id
      );
      if (samePoolPosition == null) {
        return null;
      }

      return {
        targetPoolId: selectedPool.pool.id,
        targetPosition: samePoolPosition,
        previewLabel: `Drop in Pool ${selectedPool.pool.pool_label} at position ${samePoolPosition}`,
      };
    },
    [computeSamePoolDropPosition, data, selectedPool]
  );

  const startAssignmentDrag = useCallback(
    async (participant: CompetitionPouleParticipant, event: GestureResponderEvent) => {
      if (!data || !selectedPool || !assignmentEditMode || !!activeActionKey || !!assignmentDragRef.current) {
        return;
      }

      await captureAssignmentDropZones();
      const rowRect = assignmentRowRectsRef.current[participant.participant.id];
      if (!rowRect) {
        return;
      }

      const pointerX = event.nativeEvent.pageX;
      const pointerY = event.nativeEvent.pageY;
      const offsetX = Math.max(0, Math.min(pointerX - rowRect.x, rowRect.width));
      const offsetY = Math.max(0, Math.min(pointerY - rowRect.y, rowRect.height));

      setAssignmentDrag({
        participant,
        sourcePoolId: selectedPool.pool.id,
        sourcePosition: participant.assignment.position,
        pointerX,
        pointerY,
        offsetX,
        offsetY,
        rowWidth: rowRect.width,
        rowHeight: rowRect.height,
      });

      setAssignmentDropTarget({
        targetPoolId: selectedPool.pool.id,
        targetPosition: participant.assignment.position,
        previewLabel: `Dragging in Pool ${selectedPool.pool.pool_label}`,
      });
    },
    [activeActionKey, assignmentEditMode, captureAssignmentDropZones, data, selectedPool]
  );

  const onAssignmentDragMove = useCallback(
    (event: GestureResponderEvent) => {
      const drag = assignmentDragRef.current;
      if (!drag) return;

      const pointerX = event.nativeEvent.pageX;
      const pointerY = event.nativeEvent.pageY;

      setAssignmentDrag((previous) =>
        previous
          ? {
              ...previous,
              pointerX,
              pointerY,
            }
          : previous
      );

      const target = computeAssignmentDropTarget(pointerX, pointerY, drag.participant);
      setAssignmentDropTarget(target);
    },
    [computeAssignmentDropTarget]
  );

  const endAssignmentDrag = useCallback(async () => {
    const drag = assignmentDragRef.current;
    const target = assignmentDropTargetRef.current;

    setAssignmentDrag(null);
    setAssignmentDropTarget(null);

    if (!drag || !target) return;

    const noOpSamePool =
      target.targetPoolId === drag.sourcePoolId &&
      target.targetPosition != null &&
      target.targetPosition === drag.sourcePosition;

    if (noOpSamePool) {
      return;
    }

    await runAssignmentMove({
      participant: drag.participant,
      targetPoolId: target.targetPoolId,
      targetPosition: target.targetPosition,
      actionKey: `drag:${drag.participant.participant.id}`,
      focusPoolId: target.targetPoolId,
    });
  }, [runAssignmentMove]);

  const onAssignmentDragEndTouch = useCallback(() => {
    if (!assignmentDragRef.current) return;
    void endAssignmentDrag();
  }, [endAssignmentDrag]);

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
    if (data.competition.status === 'finalised') {
      setErrorText('Competition is finalised. Matches are read-only.');
      return;
    }
    if (match.status !== 'pending' && match.status !== 'live') {
      return;
    }

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
  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;

  return (
    <View
      style={styles.container}
      onTouchMove={onAssignmentDragMove}
      onTouchEnd={onAssignmentDragEndTouch}
      onTouchCancel={onAssignmentDragEndTouch}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: contentBottomPadding,
          },
        ]}
        scrollEnabled={!assignmentDrag}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.purple.primary}
          />
        }
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
        <Text style={styles.title}>Poules</Text>
        <CompetitionRealtimeBanner
          bannerText={realtimeBannerText}
          correctionNotice={realtimeCorrectionNotice}
          onRetry={retryRealtime}
          onDismissCorrection={clearCorrectionNotice}
        />
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
                  onPress={() =>
                    setAssignmentEditMode((current) => {
                      const next = !current;
                      if (!next) {
                        setAssignmentDrag(null);
                        setAssignmentDropTarget(null);
                      }
                      return next;
                    })
                  }
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
                    ref={(node) => {
                      poolTabRefs.current[pool.pool.id] = node;
                    }}
                    disabled={!!assignmentDrag}
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
                  <Text style={styles.formalTableHint}>
                    Formal poule sheet: each column number is an opponent in this pool.
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <View
                      style={[
                        styles.table,
                        {
                          minWidth:
                            210 + selectedPoolParticipantsOrdered.length * 40 + 6 * 46,
                        },
                      ]}
                    >
                      <View style={[styles.tableRow, styles.tableHeaderRow]}>
                        <Text style={[styles.headerCell, styles.formalNameCell]}>Name</Text>
                        {selectedPoolParticipantsOrdered.map((entry, index) => (
                          <Text
                            key={`formal-header-${entry.participant.id}`}
                            style={[styles.headerCell, styles.formalVsCell]}
                          >
                            {index + 1}
                          </Text>
                        ))}
                        <Text style={styles.headerCell}>W</Text>
                        <Text style={styles.headerCell}>L</Text>
                        <Text style={styles.headerCell}>IND</Text>
                        <Text style={styles.headerCell}>HS</Text>
                        <Text style={styles.headerCell}>HR</Text>
                        <Text style={styles.headerCell}>LEFT</Text>
                      </View>

                      {selectedPoolParticipantsOrdered.map((entry, rowIndex) => (
                        <View
                          key={entry.assignment.id}
                          style={[styles.tableRow, entry.participant.isSelf && styles.tableRowSelf]}
                        >
                          <Text
                            style={[
                              styles.bodyCell,
                              styles.formalNameCell,
                              entry.participant.isSelf && styles.bodyCellSelf,
                            ]}
                          >
                            {rowIndex + 1}. {getShortName(entry.participant.display_name)}
                            {entry.participant.isSelf ? ' • You' : ''}
                          </Text>
                          {selectedPoolParticipantsOrdered.map((opponent) => {
                            if (opponent.participant.id === entry.participant.id) {
                              return (
                                <Text
                                  key={`formal-cell-${entry.participant.id}-${opponent.participant.id}`}
                                  style={[
                                    styles.bodyCell,
                                    styles.formalVsCell,
                                    styles.formalDiagonalCell,
                                  ]}
                                >
                                  X
                                </Text>
                              );
                            }

                            const cell = getPouleResultCell(
                              selectedPoolMatchByPair.get(
                                getPairKey(entry.participant.id, opponent.participant.id)
                              ),
                              entry.participant.id
                            );

                            return (
                              <Text
                                key={`formal-cell-${entry.participant.id}-${opponent.participant.id}`}
                                style={[
                                  styles.bodyCell,
                                  styles.formalVsCell,
                                  cell.tone === 'win' && styles.formalCellWin,
                                  cell.tone === 'loss' && styles.formalCellLoss,
                                  cell.tone === 'muted' && styles.formalCellMuted,
                                ]}
                              >
                                {cell.label}
                              </Text>
                            );
                          })}
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
                  {formalOpponentLegend ? (
                    <Text style={styles.formalLegendText}>{formalOpponentLegend}</Text>
                  ) : null}
                </View>

                {assignmentEditMode && data.canEditAssignments ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Assignment Editor</Text>
                    <Text style={styles.helperText}>
                      Long-press and drag a participant to reorder. Drop on another pool tab to move pools.
                    </Text>
                    {assignmentDrag && assignmentDropTarget ? (
                      <Text style={styles.dragPreviewText}>{assignmentDropTarget.previewLabel}</Text>
                    ) : null}
                    {selectedPool.participants.map((entry) => {
                      const isBusy = activeActionKey?.endsWith(entry.participant.id) ?? false;
                      const isDragging = assignmentDrag?.participant.participant.id === entry.participant.id;
                      const isSamePoolDropTarget =
                        assignmentDropTarget?.targetPoolId === selectedPool.pool.id &&
                        assignmentDropTarget?.targetPosition === entry.assignment.position;
                      return (
                        <Pressable
                          key={`editor-${entry.assignment.id}`}
                          ref={(node) => {
                            assignmentRowRefs.current[entry.participant.id] = node;
                          }}
                          onLongPress={(event) => void startAssignmentDrag(entry, event)}
                          delayLongPress={180}
                          disabled={!!activeActionKey || !!assignmentDrag}
                          style={[
                            styles.editorRow,
                            entry.participant.isSelf && styles.editorRowSelf,
                            isDragging && styles.editorRowDragging,
                            isSamePoolDropTarget && !isDragging && styles.editorRowDropTarget,
                          ]}
                        >
                          <View style={styles.editorRowTop}>
                            <Text style={styles.dragHandle}>☰</Text>
                            <Text style={styles.editorName}>
                              {entry.assignment.position}. {entry.participant.display_name}
                              {entry.participant.isSelf ? ' • You' : ''}
                            </Text>
                          </View>
                          <Text style={styles.editorDragHint}>Press and hold to drag</Text>
                          {isBusy ? <ActivityIndicator size="small" color="#E9D7FF" /> : null}
                        </Pressable>
                      );
                    })}
                    {assignmentDropTarget?.targetPoolId === selectedPool.pool.id &&
                    assignmentDropTarget.targetPosition === selectedPool.participants.length ? (
                      <View style={styles.editorEndDropTarget}>
                        <Text style={styles.editorEndDropTargetText}>Drop at end of pool</Text>
                      </View>
                    ) : null}
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
                      const canOpenMatch =
                        data.competition.status !== 'finalised' &&
                        (match.status === 'pending' || match.status === 'live');
                      const isFencerASelf = Boolean(
                        match.fencer_a_participant_id &&
                          selectedPoolParticipantById.get(match.fencer_a_participant_id)?.isSelf
                      );
                      const isFencerBSelf = Boolean(
                        match.fencer_b_participant_id &&
                          selectedPoolParticipantById.get(match.fencer_b_participant_id)?.isSelf
                      );
                      const isUserMatch = isFencerASelf || isFencerBSelf;

                      return (
                        <Pressable
                          key={match.id}
                          onPress={() => onPressMatch(match)}
                          disabled={!canOpenMatch}
                          style={[
                            styles.matchRow,
                            isUserMatch && styles.matchRowSelf,
                            !canOpenMatch && styles.matchRowDisabled,
                          ]}
                        >
                          <View style={styles.matchInfo}>
                            <Text style={styles.matchText}>
                              <Text style={[styles.matchFencerText, isFencerASelf && styles.matchFencerTextSelf]}>
                                {fencerA}
                              </Text>
                              {' vs '}
                              <Text style={[styles.matchFencerText, isFencerBSelf && styles.matchFencerTextSelf]}>
                                {fencerB}
                              </Text>
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
                            <Text style={styles.tapHint}>
                              {canOpenMatch
                                ? 'Tap to score'
                                : data.competition.status === 'finalised'
                                  ? 'Read-only'
                                  : scoreText
                                    ? 'Result saved'
                                    : 'Waiting for fencers'}
                            </Text>
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

      {assignmentDrag ? (
        <View
          pointerEvents="none"
          style={[
            styles.assignmentDragGhost,
            {
              left: assignmentDrag.pointerX - assignmentDrag.offsetX,
              top: assignmentDrag.pointerY - assignmentDrag.offsetY,
              width: assignmentDrag.rowWidth,
              minHeight: assignmentDrag.rowHeight,
            },
          ]}
        >
          <View style={styles.editorRowTop}>
            <Text style={styles.dragHandle}>☰</Text>
            <Text style={styles.editorName}>
              {assignmentDrag.participant.assignment.position}.{' '}
              {assignmentDrag.participant.participant.display_name}
            </Text>
          </View>
          <Text style={styles.editorDragHint}>
            {assignmentDropTarget?.previewLabel ?? `Dragging in Pool ${poolLabelById.get(assignmentDrag.sourcePoolId) ?? '?'}`}
          </Text>
        </View>
      ) : null}

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
  tableRowSelf: {
    backgroundColor: 'rgba(139,92,246,0.1)',
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
  bodyCellSelf: {
    color: '#EBD8FF',
    fontWeight: '700',
  },
  formalNameCell: {
    width: 210,
    textAlign: 'left',
  },
  formalVsCell: {
    width: 40,
    textAlign: 'center',
  },
  formalDiagonalCell: {
    color: '#8F8F8F',
    fontWeight: '700',
  },
  formalCellWin: {
    color: '#10B981',
    fontWeight: '700',
  },
  formalCellLoss: {
    color: '#FF7675',
    fontWeight: '700',
  },
  formalCellMuted: {
    color: '#9D9D9D',
  },
  formalTableHint: {
    color: '#B6B6B6',
    fontSize: 12,
    marginTop: -2,
    marginBottom: 2,
  },
  formalLegendText: {
    color: '#9D9D9D',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  helperText: {
    color: '#8F8F8F',
    fontSize: 12,
    marginTop: -2,
    marginBottom: 4,
  },
  dragPreviewText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '600',
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
  editorRowSelf: {
    borderColor: 'rgba(139,92,246,0.62)',
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  editorRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragHandle: {
    color: '#C8A6FF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: -1,
  },
  editorRowDragging: {
    opacity: 0.35,
  },
  editorRowDropTarget: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  editorName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  editorDragHint: {
    color: '#9D9D9D',
    fontSize: 12,
  },
  editorEndDropTarget: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  editorEndDropTargetText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '600',
  },
  assignmentDragGhost: {
    position: 'absolute',
    zIndex: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    backgroundColor: '#222022',
    padding: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
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
  matchRowSelf: {
    borderColor: 'rgba(139,92,246,0.62)',
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  matchRowDisabled: {
    opacity: 0.72,
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
  matchFencerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  matchFencerTextSelf: {
    color: '#EBD8FF',
    fontWeight: '800',
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

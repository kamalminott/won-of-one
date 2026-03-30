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
  generateCompetitionDeTableau,
  getCompetitionDeTableauData,
  overrideCompetitionDeMatchResult,
  resetCompetitionDeMatch,
} from '@/lib/clubCompetitionService';
import { runCompetitionWriteWithRetry } from '@/lib/competitionRetry';
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import type { ClubCompetitionMatchRecord, CompetitionScoringMode } from '@/types/competition';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OverrideState = {
  match: ClubCompetitionMatchRecord;
  scoreA: string;
  scoreB: string;
  reason: string;
};

type DeRoundMatchView = NonNullable<
  Awaited<ReturnType<typeof getCompetitionDeTableauData>>
>['rounds'][number]['matches'][number];

type DeTreeNode = {
  matchIndex: number;
  top: number;
  centerY: number;
  matchView: DeRoundMatchView;
};

type DeTreeColumn = {
  roundLabel: string;
  roundIndex: number;
  columnLeft: number;
  nodes: DeTreeNode[];
};

type DeTreeConnector = {
  key: string;
  startX: number;
  kneeX: number;
  endX: number;
  startY: number;
  endY: number;
};

const DE_NODE_WIDTH = 210;
const DE_NODE_HEIGHT = 140;
const DE_NODE_GAP = 16;
const DE_ROUND_COLUMN_WIDTH = 226;
const DE_ROUND_COLUMN_GAP = 20;
const DE_CONNECTOR_STROKE = 2;
const DE_CONNECTOR_KNEE_OFFSET = 14;

export default function DeTableauScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ competitionId?: string }>();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [sheetMatch, setSheetMatch] = useState<ClubCompetitionMatchRecord | null>(null);
  const [overrideState, setOverrideState] = useState<OverrideState | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCompetitionDeTableauData>>>(null);
  const deVersionRef = useRef('');

  const loadData = useCallback(
    async (showSpinner = true): Promise<string | null> => {
      if (!user?.id || !competitionId) {
        setLoading(false);
        setData(null);
        setErrorText('Competition was not found.');
        deVersionRef.current = '';
        return null;
      }

      if (showSpinner) {
        setLoading(true);
      }
      setErrorText(null);

      const payload = await getCompetitionDeTableauData({
        userId: user.id,
        competitionId,
      });

      if (!payload) {
        setData(null);
        setLoading(false);
        setRefreshing(false);
        setErrorText('You do not have access to this competition.');
        deVersionRef.current = '';
        return null;
      }

      setData(payload);
      const version = `${payload.competition.updated_at}:${payload.competition.status}:${payload.rounds
        .map((round) =>
          round.matches
            .map(
              (matchView) =>
                `${matchView.match.id}:${matchView.match.status}:${matchView.match.score_a ?? ''}:${matchView.match.score_b ?? ''}:${matchView.match.updated_at}`
            )
            .join('|')
        )
        .join(';')}`;
      deVersionRef.current = version;
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
    surface: 'de',
    onCompetitionEvent: () => {
      void loadData(false);
    },
    onReconnectRefetch: async () => {
      const before = deVersionRef.current;
      const after = await loadData(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      analytics.capture('de_viewed', {
        competition_id: competitionId,
      });
      void loadData(true);
    }, [competitionId, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };
  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;

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
          competitionFrom: 'de',
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
        from: 'de',
      },
    });
  };

  const roundMatchViewById = useMemo(() => {
    const map = new Map<
      string,
      {
        canScore: boolean;
        canOverride: boolean;
        canReset: boolean;
      }
    >();
    data?.rounds.forEach((round) => {
      round.matches.forEach((matchView) => {
        map.set(matchView.match.id, {
          canScore: matchView.canScore,
          canOverride: matchView.canOverride,
          canReset: matchView.canReset,
        });
      });
    });
    return map;
  }, [data]);

  const overrideLabelsByMatchId = useMemo(() => {
    const map = new Map<
      string,
      {
        scoreALabel: string;
        scoreBLabel: string;
      }
    >();

    data?.rounds.forEach((round) => {
      round.matches.forEach((matchView) => {
        map.set(matchView.match.id, {
          scoreALabel: matchView.fencerA?.display_name ?? 'Fencer A',
          scoreBLabel: matchView.fencerB?.display_name ?? 'Fencer B',
        });
      });
    });

    return map;
  }, [data]);

  const deTree = useMemo(() => {
    if (!data || data.rounds.length === 0) {
      return {
        treeHeight: 0,
        treeWidth: 0,
        roundColumns: [] as DeTreeColumn[],
        connectors: [] as DeTreeConnector[],
      };
    }

    const firstRoundCount = data.rounds[0]?.matches.length ?? 0;
    if (firstRoundCount <= 0) {
      return {
        treeHeight: 0,
        treeWidth: 0,
        roundColumns: [] as DeTreeColumn[],
        connectors: [] as DeTreeConnector[],
      };
    }

    const slotStep = DE_NODE_HEIGHT + DE_NODE_GAP;
    const columnStep = DE_ROUND_COLUMN_WIDTH + DE_ROUND_COLUMN_GAP;
    const roundCount = data.rounds.length;
    const treeHeight =
      firstRoundCount * DE_NODE_HEIGHT + Math.max(0, firstRoundCount - 1) * DE_NODE_GAP;
    const treeWidth =
      roundCount * DE_ROUND_COLUMN_WIDTH + Math.max(0, roundCount - 1) * DE_ROUND_COLUMN_GAP;

    const roundColumns = data.rounds.map((round, roundIndex) => {
      const span = 2 ** roundIndex;
      const nodes = round.matches.map((matchView, matchIndex) => ({
        matchIndex,
        top: (matchIndex * span + (span - 1) / 2) * slotStep,
        centerY: (matchIndex * span + (span - 1) / 2) * slotStep + DE_NODE_HEIGHT / 2,
        matchView,
      }));

      return {
        roundLabel: round.roundLabel,
        roundIndex,
        columnLeft: roundIndex * columnStep,
        nodes,
      };
    });

    const connectors: DeTreeConnector[] = [];
    for (let roundIndex = 0; roundIndex < roundColumns.length - 1; roundIndex += 1) {
      const currentColumn = roundColumns[roundIndex];
      const nextColumn = roundColumns[roundIndex + 1];
      currentColumn.nodes.forEach((node) => {
        const nextNode = nextColumn.nodes[Math.floor(node.matchIndex / 2)];
        if (!nextNode) return;

        const startX = currentColumn.columnLeft + DE_NODE_WIDTH - 1;
        const kneeX = currentColumn.columnLeft + DE_NODE_WIDTH + DE_CONNECTOR_KNEE_OFFSET;
        const endX = nextColumn.columnLeft + 1;
        connectors.push({
          key: `${roundIndex}-${node.matchIndex}-to-${roundIndex + 1}-${Math.floor(node.matchIndex / 2)}`,
          startX,
          kneeX,
          endX,
          startY: node.centerY,
          endY: nextNode.centerY,
        });
      });
    }

    return {
      treeHeight,
      treeWidth,
      roundColumns,
      connectors,
    };
  }, [data]);

  const onPressMatch = (match: ClubCompetitionMatchRecord) => {
    if (!data) return;
    const matchView = roundMatchViewById.get(match.id);
    if (!matchView?.canScore) {
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

    const targetMatch = sheetMatch;
    setSheetMatch(null);
    navigateToScoring(targetMatch, mode, data.competition.id);
  };

  const onGenerateDe = () => {
    if (!data) return;
    Alert.alert(
      'Generate DE tableau?',
      'This creates the seeded elimination bracket and applies automatic byes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate DE',
          onPress: async () => {
            setActionKey('generate');
            const execution = await runCompetitionWriteWithRetry(() =>
              generateCompetitionDeTableau({
                competitionId: data.competition.id,
              })
            );
            const result = execution.result;
            setActionKey(null);
            if (!result.ok) {
              if (execution.exhausted) {
                analytics.capture('competition_write_retry_exhausted', {
                  competition_id: data.competition.id,
                  match_id: null,
                  stage: 'de',
                  operation: 'generate_de',
                  attempts: execution.attempts,
                });
              }
              setErrorText(result.message);
              analytics.capture('competition_de_generate_failed', {
                competition_id: data.competition.id,
                source: 'de_tableau',
              });
              return;
            }

            analytics.capture('de_generated', {
              competition_id: data.competition.id,
              participant_count: result.data.participant_count,
              bracket_size: result.data.bracket_size,
              match_count: result.data.match_count,
            });

            await loadData(true);
          },
        },
      ]
    );
  };

  const onOpenOverride = (match: ClubCompetitionMatchRecord) => {
    setOverrideState({
      match,
      scoreA: String(match.score_a ?? 0),
      scoreB: String(match.score_b ?? 0),
      reason: '',
    });
  };

  const onSubmitOverride = async () => {
    if (!overrideState) return;
    const parsedA = Number.parseInt(overrideState.scoreA, 10);
    const parsedB = Number.parseInt(overrideState.scoreB, 10);
    if (!Number.isFinite(parsedA) || !Number.isFinite(parsedB)) {
      setErrorText('Enter valid numeric scores.');
      return;
    }
    if (overrideState.reason.trim().length < 4) {
      setErrorText('Please provide a short reason (at least 4 characters).');
      return;
    }

    setActionKey(`override:${overrideState.match.id}`);
    const execution = await runCompetitionWriteWithRetry(() =>
      overrideCompetitionDeMatchResult({
        matchId: overrideState.match.id,
        scoreA: parsedA,
        scoreB: parsedB,
        reason: overrideState.reason.trim(),
      })
    );
    const result = execution.result;
    setActionKey(null);

    if (!result.ok) {
      if (execution.exhausted) {
        analytics.capture('competition_write_retry_exhausted', {
          competition_id: data?.competition.id ?? competitionId,
          match_id: overrideState.match.id,
          stage: 'de',
          operation: 'override_de_result',
          attempts: execution.attempts,
        });
      }
      setErrorText(result.message);
      analytics.capture('competition_override_failed', {
        competition_id: data?.competition.id ?? competitionId,
        match_id: overrideState.match.id,
        stage: 'de',
        source: 'de_tableau',
      });
      return;
    }

    analytics.capture('de_match_override', {
      competition_id: result.data.competition_id,
      match_id: result.data.id,
    });

    setOverrideState(null);
    await loadData(false);
  };

  const onResetMatch = (match: ClubCompetitionMatchRecord) => {
    Alert.alert(
      'Reset this match?',
      'This clears the result and sets the match back to pending. This is only allowed before the next round starts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setActionKey(`reset:${match.id}`);
            const execution = await runCompetitionWriteWithRetry(() =>
              resetCompetitionDeMatch({
                matchId: match.id,
                reason: 'organiser_reset_before_downstream_start',
              })
            );
            const result = execution.result;
            setActionKey(null);
            if (!result.ok) {
              if (execution.exhausted) {
                analytics.capture('competition_write_retry_exhausted', {
                  competition_id: data?.competition.id ?? competitionId,
                  match_id: match.id,
                  stage: 'de',
                  operation: 'reset_de_match',
                  attempts: execution.attempts,
                });
              }
              setErrorText(result.message);
              analytics.capture('competition_reset_failed', {
                competition_id: data?.competition.id ?? competitionId,
                match_id: match.id,
                stage: 'de',
                source: 'de_tableau',
              });
              return;
            }

            analytics.capture('de_match_reset', {
              competition_id: result.data.competition_id,
              match_id: result.data.id,
            });

            await loadData(false);
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
        <Text style={styles.errorText}>{errorText ?? 'DE data unavailable.'}</Text>
        <Pressable
          onPress={() => router.replace('/(tabs)/competitions')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Hub</Text>
        </Pressable>
      </View>
    );
  }

  const overrideLabels = overrideState
    ? overrideLabelsByMatchId.get(overrideState.match.id) ?? {
        scoreALabel: 'Fencer A',
        scoreBLabel: 'Fencer B',
      }
    : null;

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
        <Text style={styles.title}>DE Tableau</Text>
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
          <Text style={styles.metaText}>Rounds: {data.rounds.length}</Text>
          {data.currentUserRole === 'organiser' && data.canGenerateDe ? (
            <Pressable
              onPress={onGenerateDe}
              disabled={actionKey === 'generate'}
              style={[styles.actionButton, actionKey === 'generate' && styles.actionButtonDisabled]}
            >
              {actionKey === 'generate' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>Generate DE</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {deTree.roundColumns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No DE tableau yet</Text>
            <Text style={styles.emptyText}>
              Lock rankings, then generate the DE bracket to begin elimination rounds.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.treeScrollContent}
          >
            <View style={[styles.treeBracket, { width: deTree.treeWidth }]}>
              <View style={styles.treeRoundTitleRow}>
                {deTree.roundColumns.map((roundColumn) => (
                  <View
                    key={`title-${roundColumn.roundIndex}`}
                    style={styles.treeRoundTitleCell}
                  >
                    <Text style={styles.treeRoundTitle}>{roundColumn.roundLabel}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.treeBodyCanvas, { height: deTree.treeHeight }]}>
                <View
                  pointerEvents="none"
                  style={styles.treeConnectorLayer}
                >
                  {deTree.connectors.map((connector) => {
                    const verticalTop = Math.min(connector.startY, connector.endY);
                    const verticalHeight = Math.max(
                      DE_CONNECTOR_STROKE,
                      Math.abs(connector.endY - connector.startY)
                    );
                    return (
                      <View
                        key={connector.key}
                        style={styles.treeConnectorGroup}
                      >
                        <View
                          style={[
                            styles.treeConnector,
                            {
                              left: connector.startX,
                              top: connector.startY - DE_CONNECTOR_STROKE / 2,
                              width: connector.kneeX - connector.startX + 1,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.treeConnector,
                            {
                              left: connector.kneeX - DE_CONNECTOR_STROKE / 2,
                              top: verticalTop,
                              width: DE_CONNECTOR_STROKE,
                              height: verticalHeight,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.treeConnector,
                            {
                              left: connector.kneeX,
                              top: connector.endY - DE_CONNECTOR_STROKE / 2,
                              width: connector.endX - connector.kneeX + 1,
                            },
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>

                {deTree.roundColumns.map((roundColumn) => (
                  <View
                    key={`round-${roundColumn.roundIndex}`}
                    style={[styles.treeRoundColumn, { left: roundColumn.columnLeft }]}
                  >
                    {roundColumn.nodes.map((node) => {
                      const { matchView, top } = node;
                      const {
                        match,
                        fencerA,
                        fencerB,
                        fencerASeedRank,
                        fencerBSeedRank,
                        canScore,
                        canOverride,
                        canReset,
                      } = matchView;
                      const statusLabel = COMPETITION_MATCH_STATUS_LABELS[match.status];
                      const hasAdminActions = canOverride || canReset;
                      const isByeAdvance =
                        match.status === 'completed' &&
                        match.canceled_reason === 'bye';
                      const hasScores = match.score_a != null && match.score_b != null;
                      const hintText = isByeAdvance
                        ? 'Advanced by bye'
                        : match.status === 'live'
                          ? 'Live score updating'
                        : canScore
                          ? 'Tap to score'
                        : data.competition.status === 'finalised'
                          ? 'Read-only'
                          : hasScores
                            ? 'Result saved'
                            : 'Waiting for fencers';
                      const fencerADisplayName =
                        fencerA?.display_name ?? (isByeAdvance && !fencerA ? 'BYE' : 'TBD');
                      const fencerBDisplayName =
                        fencerB?.display_name ?? (isByeAdvance && !fencerB ? 'BYE' : 'TBD');
                      const showVsDivider = fencerADisplayName !== 'BYE' && fencerBDisplayName !== 'BYE';
                      const showFencerARow = !(
                        isByeAdvance &&
                        fencerADisplayName === 'BYE' &&
                        fencerBDisplayName !== 'BYE'
                      );
                      const showFencerBRow = !(
                        isByeAdvance &&
                        fencerBDisplayName === 'BYE' &&
                        fencerADisplayName !== 'BYE'
                      );
                      const fencerASeedLabel =
                        fencerASeedRank != null &&
                        fencerADisplayName !== 'BYE' &&
                        fencerADisplayName !== 'TBD'
                          ? `#${fencerASeedRank}`
                          : null;
                      const fencerBSeedLabel =
                        fencerBSeedRank != null &&
                        fencerBDisplayName !== 'BYE' &&
                        fencerBDisplayName !== 'TBD'
                          ? `#${fencerBSeedRank}`
                          : null;
                      const fencerAIsSelf = Boolean(fencerA?.isSelf && fencerADisplayName !== 'BYE');
                      const fencerBIsSelf = Boolean(fencerB?.isSelf && fencerBDisplayName !== 'BYE');
                      const fencerAResult =
                        isByeAdvance && fencerADisplayName !== 'BYE'
                          ? { label: 'BYE', tone: 'bye' as const }
                          : match.status === 'live' && fencerA
                            ? {
                                label: `${match.score_a ?? 0}`,
                                tone: 'live' as const,
                              }
                          : match.status === 'completed' && hasScores && fencerA
                            ? {
                                label: `${
                                  (match.winner_participant_id
                                    ? match.winner_participant_id === fencerA.id
                                    : (match.score_a as number) > (match.score_b as number))
                                    ? 'V'
                                    : 'L'
                                }${match.score_a}`,
                                tone: (match.winner_participant_id
                                  ? match.winner_participant_id === fencerA.id
                                  : (match.score_a as number) > (match.score_b as number))
                                  ? ('win' as const)
                                  : ('loss' as const),
                              }
                            : null;
                      const fencerBResult =
                        isByeAdvance && fencerBDisplayName !== 'BYE'
                          ? { label: 'BYE', tone: 'bye' as const }
                          : match.status === 'live' && fencerB
                            ? {
                                label: `${match.score_b ?? 0}`,
                                tone: 'live' as const,
                              }
                          : match.status === 'completed' && hasScores && fencerB
                            ? {
                                label: `${
                                  (match.winner_participant_id
                                    ? match.winner_participant_id === fencerB.id
                                    : (match.score_b as number) > (match.score_a as number))
                                    ? 'V'
                                    : 'L'
                                }${match.score_b}`,
                                tone: (match.winner_participant_id
                                  ? match.winner_participant_id === fencerB.id
                                  : (match.score_b as number) > (match.score_a as number))
                                  ? ('win' as const)
                                  : ('loss' as const),
                              }
                            : null;

                      return (
                        <View
                          key={match.id}
                          style={[styles.treeNodeWrap, { top }]}
                        >
                          {canScore ? (
                            <Pressable
                              onPress={() => onPressMatch(match)}
                              style={[
                                styles.treeNodeCard,
                                match.status === 'completed' && styles.treeNodeCardCompleted,
                                match.status === 'live' && styles.treeNodeCardLive,
                                canScore && styles.treeNodeCardScorable,
                              ]}
                            >
                              <View style={styles.treeNodeHeader}>
                                <View style={styles.treeNodeHeaderSpacer} />
                                <View
                                  style={[
                                    styles.treeStatusBadge,
                                    { backgroundColor: COMPETITION_MATCH_STATUS_COLORS[match.status] },
                                  ]}
                                >
                                  <Text style={styles.treeStatusBadgeText}>{statusLabel}</Text>
                                </View>
                              </View>
                              <View style={styles.treeFencersWrap}>
                                {showFencerARow ? (
                                  <View style={styles.treeFencerRow}>
                                    <View style={styles.treeFencerIdentity}>
                                      {fencerASeedLabel ? (
                                        <View style={styles.treeFencerSeedWrap}>
                                          <View style={styles.treeSeedBadge}>
                                            <Text style={styles.treeSeedBadgeText}>{fencerASeedLabel}</Text>
                                          </View>
                                        </View>
                                      ) : null}
                                      <View style={styles.treeFencerNameWrap}>
                                        {fencerAIsSelf ? (
                                          <View style={styles.treeSelfNamePill}>
                                            <Text
                                              style={styles.treeFencerNameSelfText}
                                              numberOfLines={1}
                                            >
                                              {fencerADisplayName}
                                            </Text>
                                          </View>
                                        ) : (
                                          <Text
                                            style={styles.treeFencerName}
                                            numberOfLines={1}
                                          >
                                            {fencerADisplayName}
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                    {fencerAResult ? (
                                      <View style={styles.treeFencerResultWrap}>
                                        <View
                                          style={[
                                            styles.treeResultBadge,
                                            fencerAResult.tone === 'win' && styles.treeResultBadgeWin,
                                            fencerAResult.tone === 'loss' && styles.treeResultBadgeLoss,
                                            fencerAResult.tone === 'live' && styles.treeResultBadgeLive,
                                            fencerAResult.tone === 'bye' && styles.treeResultBadgeBye,
                                          ]}
                                        >
                                          <Text style={styles.treeResultBadgeText}>{fencerAResult.label}</Text>
                                        </View>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}
                                {showVsDivider ? <Text style={styles.treeVsText}>vs</Text> : null}
                                {showFencerBRow ? (
                                  <View style={styles.treeFencerRow}>
                                    <View style={styles.treeFencerIdentity}>
                                      {fencerBSeedLabel ? (
                                        <View style={styles.treeFencerSeedWrap}>
                                          <View style={styles.treeSeedBadge}>
                                            <Text style={styles.treeSeedBadgeText}>{fencerBSeedLabel}</Text>
                                          </View>
                                        </View>
                                      ) : null}
                                      <View style={styles.treeFencerNameWrap}>
                                        {fencerBIsSelf ? (
                                          <View style={styles.treeSelfNamePill}>
                                            <Text
                                              style={styles.treeFencerNameSelfText}
                                              numberOfLines={1}
                                            >
                                              {fencerBDisplayName}
                                            </Text>
                                          </View>
                                        ) : (
                                          <Text
                                            style={styles.treeFencerName}
                                            numberOfLines={1}
                                          >
                                            {fencerBDisplayName}
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                    {fencerBResult ? (
                                      <View style={styles.treeFencerResultWrap}>
                                        <View
                                          style={[
                                            styles.treeResultBadge,
                                            fencerBResult.tone === 'win' && styles.treeResultBadgeWin,
                                            fencerBResult.tone === 'loss' && styles.treeResultBadgeLoss,
                                            fencerBResult.tone === 'live' && styles.treeResultBadgeLive,
                                            fencerBResult.tone === 'bye' && styles.treeResultBadgeBye,
                                          ]}
                                        >
                                          <Text style={styles.treeResultBadgeText}>{fencerBResult.label}</Text>
                                        </View>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}
                              </View>
                              <View style={styles.treeNodeFooter}>
                                <Text
                                  style={styles.treeHintText}
                                  numberOfLines={1}
                                >
                                  {hintText}
                                </Text>
                              </View>
                            </Pressable>
                          ) : (
                            <View
                              style={[
                                styles.treeNodeCard,
                                match.status === 'completed' && styles.treeNodeCardCompleted,
                                match.status === 'live' && styles.treeNodeCardLive,
                              ]}
                            >
                              <View style={styles.treeNodeHeader}>
                                <View style={styles.treeNodeHeaderSpacer} />
                                <View
                                  style={[
                                    styles.treeStatusBadge,
                                    { backgroundColor: COMPETITION_MATCH_STATUS_COLORS[match.status] },
                                  ]}
                                >
                                  <Text style={styles.treeStatusBadgeText}>{statusLabel}</Text>
                                </View>
                              </View>
                              <View style={styles.treeFencersWrap}>
                                {showFencerARow ? (
                                  <View style={styles.treeFencerRow}>
                                    <View style={styles.treeFencerIdentity}>
                                      {fencerASeedLabel ? (
                                        <View style={styles.treeFencerSeedWrap}>
                                          <View style={styles.treeSeedBadge}>
                                            <Text style={styles.treeSeedBadgeText}>{fencerASeedLabel}</Text>
                                          </View>
                                        </View>
                                      ) : null}
                                      <View style={styles.treeFencerNameWrap}>
                                        {fencerAIsSelf ? (
                                          <View style={styles.treeSelfNamePill}>
                                            <Text
                                              style={styles.treeFencerNameSelfText}
                                              numberOfLines={1}
                                            >
                                              {fencerADisplayName}
                                            </Text>
                                          </View>
                                        ) : (
                                          <Text
                                            style={styles.treeFencerName}
                                            numberOfLines={1}
                                          >
                                            {fencerADisplayName}
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                    {fencerAResult ? (
                                      <View style={styles.treeFencerResultWrap}>
                                        <View
                                          style={[
                                            styles.treeResultBadge,
                                            fencerAResult.tone === 'win' && styles.treeResultBadgeWin,
                                            fencerAResult.tone === 'loss' && styles.treeResultBadgeLoss,
                                            fencerAResult.tone === 'live' && styles.treeResultBadgeLive,
                                            fencerAResult.tone === 'bye' && styles.treeResultBadgeBye,
                                          ]}
                                        >
                                          <Text style={styles.treeResultBadgeText}>{fencerAResult.label}</Text>
                                        </View>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}
                                {showVsDivider ? <Text style={styles.treeVsText}>vs</Text> : null}
                                {showFencerBRow ? (
                                  <View style={styles.treeFencerRow}>
                                    <View style={styles.treeFencerIdentity}>
                                      {fencerBSeedLabel ? (
                                        <View style={styles.treeFencerSeedWrap}>
                                          <View style={styles.treeSeedBadge}>
                                            <Text style={styles.treeSeedBadgeText}>{fencerBSeedLabel}</Text>
                                          </View>
                                        </View>
                                      ) : null}
                                      <View style={styles.treeFencerNameWrap}>
                                        {fencerBIsSelf ? (
                                          <View style={styles.treeSelfNamePill}>
                                            <Text
                                              style={styles.treeFencerNameSelfText}
                                              numberOfLines={1}
                                            >
                                              {fencerBDisplayName}
                                            </Text>
                                          </View>
                                        ) : (
                                          <Text
                                            style={styles.treeFencerName}
                                            numberOfLines={1}
                                          >
                                            {fencerBDisplayName}
                                          </Text>
                                        )}
                                      </View>
                                    </View>
                                    {fencerBResult ? (
                                      <View style={styles.treeFencerResultWrap}>
                                        <View
                                          style={[
                                            styles.treeResultBadge,
                                            fencerBResult.tone === 'win' && styles.treeResultBadgeWin,
                                            fencerBResult.tone === 'loss' && styles.treeResultBadgeLoss,
                                            fencerBResult.tone === 'live' && styles.treeResultBadgeLive,
                                            fencerBResult.tone === 'bye' && styles.treeResultBadgeBye,
                                          ]}
                                        >
                                          <Text style={styles.treeResultBadgeText}>{fencerBResult.label}</Text>
                                        </View>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}
                              </View>
                              <View style={styles.treeNodeFooter}>
                                {hasAdminActions ? (
                                  <View style={styles.treeAdminRow}>
                                    {canOverride ? (
                                      <Pressable
                                        onPress={() => onOpenOverride(match)}
                                        style={styles.treeAdminButton}
                                      >
                                        <Text style={styles.treeAdminButtonText}>Override</Text>
                                      </Pressable>
                                    ) : null}
                                    {canReset ? (
                                      <Pressable
                                        onPress={() => onResetMatch(match)}
                                        style={[styles.treeAdminButton, styles.treeAdminButtonDanger]}
                                      >
                                        {actionKey === `reset:${match.id}` ? (
                                          <ActivityIndicator
                                            color="#FFFFFF"
                                            size="small"
                                          />
                                        ) : (
                                          <Text style={styles.treeAdminButtonText}>Reset</Text>
                                        )}
                                      </Pressable>
                                    ) : null}
                                  </View>
                                ) : (
                                  <Text
                                    style={styles.treeHintText}
                                    numberOfLines={1}
                                  >
                                    {hintText}
                                  </Text>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
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

      <Modal
        animationType="fade"
        transparent
        visible={!!overrideState}
        onRequestClose={() => setOverrideState(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overrideOverlay}
        >
          <Pressable
            style={styles.overrideBackdrop}
            onPress={() => setOverrideState(null)}
          />
          <View style={styles.overrideCard}>
            <Text style={styles.overrideTitle}>Override DE Result</Text>
            <Text style={styles.overrideSubtitle}>
              Enter corrected score and explain the reason for audit.
            </Text>

            <View style={styles.overrideInputRow}>
              <View style={styles.scoreInputWrap}>
                <Text style={styles.inputLabel}>{overrideLabels?.scoreALabel ?? 'Fencer A'}</Text>
                <TextInput
                  value={overrideState?.scoreA ?? ''}
                  onChangeText={(next) =>
                    setOverrideState((prev) => (prev ? { ...prev, scoreA: next.replace(/[^0-9]/g, '') } : prev))
                  }
                  keyboardType="number-pad"
                  style={styles.scoreInput}
                  placeholder="0"
                  placeholderTextColor="#6F6F6F"
                />
              </View>
              <View style={styles.scoreInputWrap}>
                <Text style={styles.inputLabel}>{overrideLabels?.scoreBLabel ?? 'Fencer B'}</Text>
                <TextInput
                  value={overrideState?.scoreB ?? ''}
                  onChangeText={(next) =>
                    setOverrideState((prev) => (prev ? { ...prev, scoreB: next.replace(/[^0-9]/g, '') } : prev))
                  }
                  keyboardType="number-pad"
                  style={styles.scoreInput}
                  placeholder="0"
                  placeholderTextColor="#6F6F6F"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              value={overrideState?.reason ?? ''}
              onChangeText={(next) =>
                setOverrideState((prev) => (prev ? { ...prev, reason: next } : prev))
              }
              style={styles.reasonInput}
              placeholder="Why is this override needed?"
              placeholderTextColor="#6F6F6F"
              multiline
            />

            <View style={styles.overrideActionRow}>
              <Pressable
                onPress={() => setOverrideState(null)}
                style={[styles.sheetButton, styles.overrideCancelButton]}
              >
                <Text style={styles.sheetCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onSubmitOverride()}
                disabled={!overrideState || actionKey === `override:${overrideState.match.id}`}
                style={[
                  styles.sheetButton,
                  styles.overrideSubmitButton,
                  overrideState && actionKey === `override:${overrideState.match.id}` && styles.actionButtonDisabled,
                ]}
              >
                {overrideState && actionKey === `override:${overrideState.match.id}` ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sheetPrimaryButtonText}>Save Override</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    color: '#A9A9A9',
    fontSize: 13,
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: Colors.purple.primary,
    marginTop: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  treeScrollContent: {
    paddingRight: 12,
  },
  treeBracket: {
    position: 'relative',
  },
  treeRoundTitleRow: {
    flexDirection: 'row',
    gap: DE_ROUND_COLUMN_GAP,
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  treeRoundTitleCell: {
    width: DE_ROUND_COLUMN_WIDTH,
  },
  treeRoundColumn: {
    position: 'absolute',
    top: 0,
    width: DE_ROUND_COLUMN_WIDTH,
    overflow: 'visible',
  },
  treeRoundTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  treeBodyCanvas: {
    position: 'relative',
    overflow: 'visible',
  },
  treeConnectorLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  treeConnectorGroup: {
    ...StyleSheet.absoluteFillObject,
  },
  treeNodeWrap: {
    position: 'absolute',
    left: 0,
    width: DE_NODE_WIDTH,
    overflow: 'visible',
  },
  treeNodeCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    backgroundColor: '#171717',
    padding: 10,
    height: DE_NODE_HEIGHT,
    justifyContent: 'space-between',
    zIndex: 3,
  },
  treeNodeCardCompleted: {
    borderColor: 'rgba(16,185,129,0.45)',
  },
  treeNodeCardLive: {
    borderColor: 'rgba(139,92,246,0.5)',
  },
  treeNodeCardScorable: {
    borderColor: 'rgba(200,166,255,0.5)',
  },
  treeNodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  treeNodeHeaderSpacer: {
    flex: 1,
  },
  treeFencersWrap: {
    gap: 4,
  },
  treeFencerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  treeFencerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  treeFencerNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  treeFencerName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  treeSelfNamePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.45)',
    backgroundColor: 'rgba(200,166,255,0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  treeFencerNameSelfText: {
    color: '#EBD8FF',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
  },
  treeFencerSeedWrap: {
    flexShrink: 0,
  },
  treeFencerResultWrap: {
    marginLeft: 8,
    flexShrink: 0,
  },
  treeVsText: {
    color: '#8F8F8F',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  treeSeedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.35)',
    backgroundColor: 'rgba(200,166,255,0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  treeSeedBadgeText: {
    color: '#EBD8FF',
    fontSize: 10,
    fontWeight: '700',
  },
  treeResultBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#2A2A2A',
    borderColor: '#4A4A4A',
  },
  treeResultBadgeWin: {
    backgroundColor: 'rgba(16,185,129,0.18)',
    borderColor: 'rgba(16,185,129,0.42)',
  },
  treeResultBadgeLoss: {
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  treeResultBadgeLive: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(96,165,250,0.42)',
  },
  treeResultBadgeBye: {
    backgroundColor: 'rgba(148,163,184,0.16)',
    borderColor: 'rgba(148,163,184,0.38)',
  },
  treeResultBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  treeNodeNames: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  treeStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  treeStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  treeNodeFooter: {
    minHeight: 28,
    justifyContent: 'center',
    paddingBottom: 2,
  },
  treeHintText: {
    color: '#8F8F8F',
    fontSize: 12,
    lineHeight: 16,
  },
  treeAdminRow: {
    flexDirection: 'row',
    gap: 6,
  },
  treeAdminButton: {
    flex: 1,
    minHeight: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  treeAdminButtonDanger: {
    borderColor: '#7A2A2A',
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  treeAdminButtonText: {
    color: '#E9D7FF',
    fontSize: 11,
    fontWeight: '700',
  },
  treeConnector: {
    position: 'absolute',
    backgroundColor: 'rgba(200,166,255,0.9)',
    height: DE_CONNECTOR_STROKE,
    borderRadius: DE_CONNECTOR_STROKE,
    zIndex: 2,
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
    paddingHorizontal: 12,
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
  overrideOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 16,
  },
  overrideBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  overrideCard: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.24)',
    padding: 14,
    gap: 10,
  },
  overrideTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  overrideSubtitle: {
    color: '#9D9D9D',
    fontSize: 13,
  },
  overrideInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scoreInputWrap: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    color: '#D7D7D7',
    fontSize: 12,
    fontWeight: '700',
  },
  scoreInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  reasonInput: {
    minHeight: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  overrideActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  overrideCancelButton: {
    flex: 1,
  },
  overrideSubmitButton: {
    flex: 1,
    backgroundColor: Colors.purple.primary,
  },
});

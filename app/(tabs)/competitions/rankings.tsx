import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_ROLE_LABELS,
  COMPETITION_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import { analytics } from '@/lib/analytics';
import {
  generateCompetitionDeTableau,
  getCompetitionRankingsData,
  lockCompetitionRankings,
  reorderCompetitionDeSeeds,
} from '@/lib/clubCompetitionService';
import { withCompetitionReadTimeout } from '@/lib/competitionRetry';
import type { CompetitionRankingEntry } from '@/types/competition';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RankingRowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  rank: number;
};

type RankingDropTarget = {
  targetRank: number;
  previewLabel: string;
};

type RankingDragState = {
  entry: CompetitionRankingEntry;
  sourceRank: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  rowWidth: number;
  rowHeight: number;
};

const resequenceRankingEntries = (
  entries: CompetitionRankingEntry[]
): CompetitionRankingEntry[] =>
  entries.map((entry, index) => ({
    ...entry,
    ranking: {
      ...entry.ranking,
      rank: index + 1,
    },
  }));

const reorderRankingEntries = (
  entries: CompetitionRankingEntry[],
  participantId: string,
  targetRank: number
): CompetitionRankingEntry[] => {
  const sourceIndex = entries.findIndex((entry) => entry.participant.id === participantId);
  if (sourceIndex < 0) return entries;

  const nextEntries = entries.slice();
  const [movedEntry] = nextEntries.splice(sourceIndex, 1);
  if (!movedEntry) return entries;

  const boundedIndex = Math.max(0, Math.min(targetRank - 1, nextEntries.length));
  nextEntries.splice(boundedIndex, 0, movedEntry);
  return resequenceRankingEntries(nextEntries);
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const nextItems = items.slice();
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }
  return nextItems;
};

export default function RankingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ competitionId?: string }>();
  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<'lock' | 'generate' | 'randomize' | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getCompetitionRankingsData>>>(null);
  const [rankingDrag, setRankingDrag] = useState<RankingDragState | null>(null);
  const [rankingDropTarget, setRankingDropTarget] = useState<RankingDropTarget | null>(null);
  const [seedSaveParticipantId, setSeedSaveParticipantId] = useState<string | null>(null);
  const rankingsVersionRef = useRef('');
  const rankingRowRefs = useRef<Record<string, View | null>>({});
  const rankingRowRectsRef = useRef<Record<string, RankingRowRect>>({});
  const rankingDragRef = useRef<RankingDragState | null>(null);
  const rankingDropTargetRef = useRef<RankingDropTarget | null>(null);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const loadData = useCallback(
    async (showSpinner = true): Promise<string | null> => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;

      if (!user?.id || !competitionId) {
        setLoading(false);
        setData(null);
        setErrorText('Competition was not found.');
        rankingsVersionRef.current = '';
        return null;
      }

      if (showSpinner) {
        setLoading(true);
      }
      setErrorText(null);

      try {
        const payload = await withCompetitionReadTimeout(
          () =>
            getCompetitionRankingsData({
              userId: user.id,
              competitionId,
            }),
          { label: 'Competition rankings' }
        );

        if (loadRequestIdRef.current !== requestId) {
          return null;
        }

        if (!payload) {
          setData(null);
          setErrorText('You do not have access to this competition.');
          rankingsVersionRef.current = '';
          return null;
        }

        setData(payload);
        const version = `${payload.competition.updated_at}:${payload.competition.status}:${payload.rankings
          .map(
            (entry) =>
              `${entry.participant.id}:${entry.ranking.rank}:${entry.ranking.wins}:${entry.ranking.losses}:${entry.ranking.indicator}:${entry.ranking.hits_scored}:${entry.ranking.hits_received}`
          )
          .join('|')}`;
        rankingsVersionRef.current = version;
        return version;
      } catch (error) {
        if (loadRequestIdRef.current !== requestId) {
          return null;
        }

        console.warn('Competition rankings load failed:', error);
        setErrorText('Could not load rankings right now. Pull to retry.');
        rankingsVersionRef.current = '';
        return null;
      } finally {
        if (loadRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [competitionId, user?.id]
  );

  const measureViewInWindow = useCallback(
    (view: View | null) =>
      new Promise<Omit<RankingRowRect, 'rank'> | null>((resolve) => {
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

  const captureRankingDropZones = useCallback(async () => {
    if (!data) {
      rankingRowRectsRef.current = {};
      return;
    }

    const rects: Record<string, RankingRowRect> = {};
    await Promise.all(
      data.rankings.map(async (entry) => {
        const rect = await measureViewInWindow(rankingRowRefs.current[entry.participant.id] ?? null);
        if (!rect) return;
        rects[entry.participant.id] = {
          ...rect,
          rank: entry.ranking.rank,
        };
      })
    );
    rankingRowRectsRef.current = rects;
  }, [data, measureViewInWindow]);

  const computeRankingDropPosition = useCallback(
    (pageY: number, draggingParticipantId: string): number | null => {
      if (!data || data.rankings.length === 0) return null;

      const nonDraggingRows = data.rankings
        .filter((entry) => entry.participant.id !== draggingParticipantId)
        .map((entry) => ({
          rect: rankingRowRectsRef.current[entry.participant.id],
        }))
        .filter(
          (
            row
          ): row is {
            rect: RankingRowRect;
          } => Boolean(row.rect)
        );

      if (nonDraggingRows.length === 0) {
        return 1;
      }

      let insertionIndex = data.rankings.length;
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
    [data]
  );

  const startRankingDrag = useCallback(
    async (entry: CompetitionRankingEntry, event: GestureResponderEvent) => {
      if (
        !data?.canEditSeedOrder ||
        !!actionKey ||
        !!seedSaveParticipantId ||
        !!rankingDragRef.current
      ) {
        return;
      }

      await captureRankingDropZones();
      const rowRect = rankingRowRectsRef.current[entry.participant.id];
      if (!rowRect) {
        return;
      }

      const pointerX = event.nativeEvent.pageX;
      const pointerY = event.nativeEvent.pageY;
      const offsetX = Math.max(0, Math.min(pointerX - rowRect.x, rowRect.width));
      const offsetY = Math.max(0, Math.min(pointerY - rowRect.y, rowRect.height));

      setRankingDrag({
        entry,
        sourceRank: entry.ranking.rank,
        pointerX,
        pointerY,
        offsetX,
        offsetY,
        rowWidth: rowRect.width,
        rowHeight: rowRect.height,
      });
      setRankingDropTarget({
        targetRank: entry.ranking.rank,
        previewLabel: `Move to seed #${entry.ranking.rank}`,
      });
    },
    [actionKey, captureRankingDropZones, data?.canEditSeedOrder, seedSaveParticipantId]
  );

  const onRankingDragMove = useCallback(
    (event: GestureResponderEvent) => {
      const drag = rankingDragRef.current;
      if (!drag) return;

      const pointerX = event.nativeEvent.pageX;
      const pointerY = event.nativeEvent.pageY;

      setRankingDrag((previous) =>
        previous
          ? {
              ...previous,
              pointerX,
              pointerY,
            }
          : previous
      );

      const targetRank = computeRankingDropPosition(pointerY, drag.entry.participant.id);
      if (targetRank == null) {
        setRankingDropTarget(null);
        return;
      }

      setRankingDropTarget({
        targetRank,
        previewLabel:
          targetRank === drag.sourceRank
            ? `Keep ${drag.entry.participant.display_name} at seed #${targetRank}`
            : `Drop ${drag.entry.participant.display_name} at seed #${targetRank}`,
      });
    },
    [computeRankingDropPosition]
  );

  const endRankingDrag = useCallback(async () => {
    const drag = rankingDragRef.current;
    const dropTarget = rankingDropTargetRef.current;
    const currentData = data;

    setRankingDrag(null);
    setRankingDropTarget(null);

    if (!drag || !dropTarget || !currentData) {
      return;
    }

    if (dropTarget.targetRank === drag.sourceRank) {
      return;
    }

    const previousRankings = currentData.rankings;
    const nextRankings = reorderRankingEntries(
      previousRankings,
      drag.entry.participant.id,
      dropTarget.targetRank
    );

    setData((previous) =>
      previous
        ? {
            ...previous,
            rankings: nextRankings,
          }
        : previous
    );
    setSeedSaveParticipantId(drag.entry.participant.id);

    const result = await reorderCompetitionDeSeeds({
      competitionId: currentData.competition.id,
      participantIds: nextRankings.map((entry) => entry.participant.id),
    });

    if (!result.ok) {
      setData((previous) =>
        previous
          ? {
              ...previous,
              rankings: previousRankings,
            }
          : previous
      );
      setSeedSaveParticipantId(null);
      setErrorText(result.message);
      return;
    }

    analytics.capture('de_seed_order_reordered', {
      competition_id: currentData.competition.id,
      participant_id: drag.entry.participant.id,
      from_seed: drag.sourceRank,
      to_seed: dropTarget.targetRank,
    });

    await loadData(false);
    setSeedSaveParticipantId(null);
  }, [data, loadData]);

  const onRankingDragEndTouch = useCallback(() => {
    if (!rankingDragRef.current) return;
    void endRankingDrag();
  }, [endRankingDrag]);

  rankingDragRef.current = rankingDrag;
  rankingDropTargetRef.current = rankingDropTarget;

  const {
    bannerText: realtimeBannerText,
    correctionNotice: realtimeCorrectionNotice,
    clearCorrectionNotice,
    retryNow: retryRealtime,
  } = useCompetitionRealtime({
    competitionId,
    enabled: Boolean(user?.id && competitionId),
    surface: 'rankings',
    onCompetitionEvent: () => {
      if (rankingDragRef.current) return;
      void loadData(false);
    },
    onReconnectRefetch: async () => {
      const before = rankingsVersionRef.current;
      const after = await loadData(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      analytics.capture('rankings_viewed', {
        competition_id: competitionId,
      });
      void loadData(true);
    }, [competitionId, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
  };

  const onLockRankings = () => {
    if (!data) return;

    Alert.alert(
      'Lock rankings?',
      data.competition.format === 'de_only'
        ? 'This freezes the DE seed order for bracket generation.'
        : 'This freezes ranking order and blocks further poule score edits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          onPress: async () => {
            setActionKey('lock');
            const result = await lockCompetitionRankings({
              competitionId: data.competition.id,
            });
            setActionKey(null);
            if (!result.ok) {
              setErrorText(result.message);
              return;
            }

            analytics.capture('rankings_locked', {
              competition_id: data.competition.id,
            });

            await loadData(true);
          },
        },
      ]
    );
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
            const result = await generateCompetitionDeTableau({
              competitionId: data.competition.id,
            });
            setActionKey(null);
            if (!result.ok) {
              setErrorText(result.message);
              return;
            }

            analytics.capture('de_generated', {
              competition_id: data.competition.id,
              participant_count: result.data.participant_count,
              bracket_size: result.data.bracket_size,
              match_count: result.data.match_count,
            });

            await loadData(true);
            router.push({
              pathname: '/(tabs)/competitions/de-tableau',
              params: { competitionId: data.competition.id },
            });
          },
        },
      ]
    );
  };

  const onRandomizeSeeds = () => {
    if (!data || !data.canEditSeedOrder) return;

    Alert.alert(
      'Randomise seeds?',
      'This will shuffle the DE seed order for active participants. You can still drag to adjust it before locking rankings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Randomise',
          onPress: async () => {
            const activeEntries = data.rankings.filter(
              (entry) => entry.participant.status !== 'withdrawn'
            );
            const withdrawnEntries = data.rankings.filter(
              (entry) => entry.participant.status === 'withdrawn'
            );

            if (activeEntries.length < 2) {
              setErrorText('At least two active participants are needed to randomise seeds.');
              return;
            }

            const shuffledActiveEntries = shuffleArray(activeEntries);
            const nextRankings = resequenceRankingEntries([
              ...shuffledActiveEntries,
              ...withdrawnEntries,
            ]);
            const previousRankings = data.rankings;

            setActionKey('randomize');
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setData((previous) =>
              previous
                ? {
                    ...previous,
                    rankings: nextRankings,
                  }
                : previous
            );

            const result = await reorderCompetitionDeSeeds({
              competitionId: data.competition.id,
              participantIds: nextRankings.map((entry) => entry.participant.id),
            });

            if (!result.ok) {
              setData((previous) =>
                previous
                  ? {
                      ...previous,
                      rankings: previousRankings,
                    }
                  : previous
              );
              setActionKey(null);
              setErrorText(result.message);
              return;
            }

            analytics.capture('de_seed_order_randomized', {
              competition_id: data.competition.id,
              participant_count: activeEntries.length,
            });

            await loadData(false);
            setActionKey(null);
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
        <Text style={styles.errorText}>{errorText ?? 'Rankings data unavailable.'}</Text>
        <Pressable
          onPress={() => router.replace('/(tabs)/competitions')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Hub</Text>
        </Pressable>
      </View>
    );
  }

  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;
  const isManualSeedMode = data.competition.format === 'de_only';
  const isSavingSeedOrder = seedSaveParticipantId !== null;

  return (
    <View
      style={styles.container}
      onTouchMove={onRankingDragMove}
      onTouchEnd={onRankingDragEndTouch}
      onTouchCancel={onRankingDragEndTouch}
    >
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
        scrollEnabled={!rankingDrag}
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
        <Text style={styles.title}>Rankings</Text>
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
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.metaText}>
            {data.competition.weapon.toUpperCase()} • {COMPETITION_ROLE_LABELS[data.currentUserRole]}
          </Text>
          <Text style={styles.metaText}>{data.tieBreakCaption}</Text>
          {data.hasWithdrawalAdjustments ? (
            <Text style={styles.noteText}>
              Withdrawal annulments applied: bouts involving withdrawn fencers are excluded.
            </Text>
          ) : null}

          {data.currentUserRole === 'organiser' ? (
            <View style={styles.controlWrap}>
              {data.canLockRankings ? (
                <ActionButton
                  text="Lock Rankings"
                  onPress={onLockRankings}
                  loading={actionKey === 'lock'}
                  disabled={actionKey === 'generate' || actionKey === 'randomize' || isSavingSeedOrder}
                  primary
                />
              ) : null}
              {data.canEditSeedOrder ? (
                <ActionButton
                  text="Randomise Seeds"
                  onPress={onRandomizeSeeds}
                  loading={actionKey === 'randomize'}
                  disabled={actionKey === 'lock' || actionKey === 'generate' || isSavingSeedOrder}
                />
              ) : null}
              {data.canGenerateDe ? (
                <ActionButton
                  text="Generate DE"
                  onPress={onGenerateDe}
                  loading={actionKey === 'generate'}
                  disabled={actionKey === 'lock' || actionKey === 'randomize' || isSavingSeedOrder}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isManualSeedMode ? 'Seed Order' : 'Standings'}</Text>
          {data.canEditSeedOrder ? (
            <>
              <Text style={styles.helperText}>
                Long-press and drag a participant to change the DE seed order. Changes save as soon
                as you drop.
              </Text>
              {isSavingSeedOrder ? (
                <Text style={styles.dragPreviewText}>Saving updated seed order…</Text>
              ) : null}
              {rankingDrag && rankingDropTarget ? (
                <Text style={styles.dragPreviewText}>{rankingDropTarget.previewLabel}</Text>
              ) : null}
            </>
          ) : null}

          {data.rankings.length === 0 ? (
            <Text style={styles.emptyText}>No ranking data yet.</Text>
          ) : (
            data.rankings.map((entry) => {
              const { ranking, participant } = entry;
              const isSelf = participant.isSelf;
              const isDragging = rankingDrag?.entry.participant.id === participant.id;
              const isDropTarget = rankingDropTarget?.targetRank === ranking.rank && !isDragging;
              const isSavingRow = seedSaveParticipantId === participant.id;

              const rowContent = (
                <>
                  <View style={styles.rowLeft}>
                    {data.canEditSeedOrder ? <Text style={styles.dragHandle}>☰</Text> : null}
                    <Text style={styles.rankValue}>#{ranking.rank}</Text>
                    <View style={styles.nameBlock}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.nameText, isSelf && styles.nameTextSelf]}>
                          {participant.display_name}
                        </Text>
                        {isSelf ? (
                          <View style={styles.selfBadge}>
                            <Text style={styles.selfBadgeText}>You</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.subMetaText}>
                        {isManualSeedMode
                          ? data.canEditSeedOrder
                            ? 'Press and hold to drag'
                            : 'Seed order locked for DE tableau'
                          : `W ${ranking.wins} • L ${ranking.losses} • IND ${ranking.indicator}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rowRight}>
                    {isSavingRow ? (
                      <ActivityIndicator size="small" color="#E9D7FF" />
                    ) : isManualSeedMode ? null : (
                      <>
                        <Text style={styles.statText}>HS {ranking.hits_scored}</Text>
                        <Text style={styles.statText}>HR {ranking.hits_received}</Text>
                        <Text style={styles.statText}>
                          Win% {(ranking.win_pct * 100).toFixed(1)}
                        </Text>
                      </>
                    )}
                    {participant.status === 'withdrawn' ? (
                      <Text style={styles.withdrawnText}>Withdrawn</Text>
                    ) : null}
                  </View>
                </>
              );

              if (data.canEditSeedOrder) {
                return (
                  <Pressable
                    key={participant.id}
                    ref={(node) => {
                      rankingRowRefs.current[participant.id] = node;
                    }}
                    onLongPress={(event) => void startRankingDrag(entry, event)}
                    delayLongPress={180}
                    disabled={!!actionKey || !!rankingDrag || isSavingSeedOrder}
                    style={[
                      styles.row,
                      styles.rowEditable,
                      isSelf && styles.rowSelf,
                      isDragging && styles.rowDragging,
                      isDropTarget && styles.rowDropTarget,
                    ]}
                  >
                    {rowContent}
                  </Pressable>
                );
              }

              return (
                <View
                  key={participant.id}
                  style={[styles.row, isSelf && styles.rowSelf]}
                >
                  {rowContent}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {rankingDrag ? (
        <View
          pointerEvents="none"
          style={[
            styles.rankingDragGhost,
            {
              left: rankingDrag.pointerX - rankingDrag.offsetX,
              top: rankingDrag.pointerY - rankingDrag.offsetY,
              width: rankingDrag.rowWidth,
              minHeight: rankingDrag.rowHeight,
            },
          ]}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.dragHandle}>☰</Text>
            <Text style={styles.rankValue}>#{rankingDrag.sourceRank}</Text>
            <View style={styles.nameBlock}>
              <Text style={styles.nameText}>{rankingDrag.entry.participant.display_name}</Text>
              <Text style={styles.subMetaText}>
                {rankingDropTarget?.previewLabel ?? `Move to seed #${rankingDrag.sourceRank}`}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
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
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    color: '#A9A9A9',
    fontSize: 13,
  },
  noteText: {
    color: '#E9D7FF',
    fontSize: 12,
    lineHeight: 17,
  },
  helperText: {
    color: '#9D9D9D',
    fontSize: 12,
    lineHeight: 18,
  },
  dragPreviewText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '600',
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
  row: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    backgroundColor: '#171717',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowEditable: {
    minHeight: 68,
  },
  rowSelf: {
    borderColor: 'rgba(139,92,246,0.65)',
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  rowDragging: {
    opacity: 0.32,
  },
  rowDropTarget: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  nameBlock: {
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 86,
  },
  dragHandle: {
    color: '#C8A6FF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: -1,
  },
  rankValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 36,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameTextSelf: {
    color: '#EBD8FF',
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
  subMetaText: {
    color: '#A9A9A9',
    fontSize: 12,
    marginTop: 2,
  },
  statText: {
    color: '#D7D7D7',
    fontSize: 12,
    fontWeight: '600',
  },
  withdrawnText: {
    color: '#FF7675',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
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
  rankingDragGhost: {
    position: 'absolute',
    zIndex: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    backgroundColor: '#1F1A28',
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 16,
  },
});

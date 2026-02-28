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
import type { ClubCompetitionMatchRecord, CompetitionScoringMode } from '@/types/competition';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OverrideState = {
  match: ClubCompetitionMatchRecord;
  scoreA: string;
  scoreB: string;
  reason: string;
};

export default function DeTableauScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

      const payload = await getCompetitionDeTableauData({
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
      setLoading(false);
      setRefreshing(false);
    },
    [competitionId, user?.id]
  );

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
    const result = await overrideCompetitionDeMatchResult({
      matchId: overrideState.match.id,
      scoreA: parsedA,
      scoreB: parsedB,
      reason: overrideState.reason.trim(),
    });
    setActionKey(null);

    if (!result.ok) {
      setErrorText(result.message);
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
            const result = await resetCompetitionDeMatch({
              matchId: match.id,
              reason: 'organiser_reset_before_downstream_start',
            });
            setActionKey(null);
            if (!result.ok) {
              setErrorText(result.message);
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
        <Text style={styles.title}>DE Tableau</Text>
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

        {data.rounds.length === 0 ? (
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
            contentContainerStyle={styles.roundsRow}
          >
            {data.rounds.map((round) => (
              <View
                key={`round-${round.roundIndex}`}
                style={styles.roundColumn}
              >
                <Text style={styles.roundTitle}>{round.roundLabel}</Text>
                {round.matches.map((matchView) => {
                  const { match, fencerA, fencerB } = matchView;
                  const statusLabel = COMPETITION_MATCH_STATUS_LABELS[match.status];
                  const scoreText =
                    match.status === 'completed' &&
                    match.score_a != null &&
                    match.score_b != null
                      ? `${match.score_a}-${match.score_b}`
                      : null;
                  const canOpen = matchView.canScore;
                  const hasAdminActions = matchView.canOverride || matchView.canReset;

                  return (
                    <Pressable
                      key={match.id}
                      onPress={() => onPressMatch(match)}
                      disabled={!canOpen}
                      style={[styles.matchCard, !canOpen && styles.matchCardDisabled]}
                    >
                      <View style={styles.matchTop}>
                        <Text style={styles.matchNames}>
                          {fencerA?.display_name ?? 'TBD'} vs {fencerB?.display_name ?? 'TBD'}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: COMPETITION_MATCH_STATUS_COLORS[match.status],
                            },
                          ]}
                        >
                          <Text style={styles.statusText}>{statusLabel}</Text>
                        </View>
                      </View>

                      {scoreText ? <Text style={styles.scoreText}>{scoreText}</Text> : null}
                      <Text style={styles.tapHint}>
                        {canOpen ? 'Tap to score' : scoreText ? 'Result saved' : 'Waiting for fencers'}
                      </Text>

                      {hasAdminActions ? (
                        <View style={styles.adminActionRow}>
                          {matchView.canOverride ? (
                            <Pressable
                              onPress={() => onOpenOverride(match)}
                              style={styles.adminActionButton}
                            >
                              <Text style={styles.adminActionText}>Override</Text>
                            </Pressable>
                          ) : null}
                          {matchView.canReset ? (
                            <Pressable
                              onPress={() => onResetMatch(match)}
                              style={[styles.adminActionButton, styles.adminActionDanger]}
                            >
                              {actionKey === `reset:${match.id}` ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                              ) : (
                                <Text style={styles.adminActionText}>Reset</Text>
                              )}
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
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
                <Text style={styles.inputLabel}>Score A</Text>
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
                <Text style={styles.inputLabel}>Score B</Text>
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
  roundsRow: {
    paddingRight: 12,
    gap: 10,
  },
  roundColumn: {
    width: 300,
    gap: 8,
  },
  roundTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  matchCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    backgroundColor: '#171717',
    padding: 10,
    gap: 8,
  },
  matchCardDisabled: {
    opacity: 0.9,
  },
  matchTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  matchNames: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  tapHint: {
    color: '#8F8F8F',
    fontSize: 12,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  adminActionButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminActionDanger: {
    borderColor: '#7A2A2A',
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  adminActionText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '700',
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

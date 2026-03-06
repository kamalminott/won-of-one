import { CompetitionRealtimeBanner } from '@/components/CompetitionRealtimeBanner';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_ENABLE_RESULT_AGREEMENT,
  COMPETITION_MATCH_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import {
  completeCompetitionMatchScore,
  getCompetitionMatchScoringData,
  prepareCompetitionMatchScoring,
  setCompetitionMatchLiveScore,
  takeOverCompetitionMatchRemoteScoring,
} from '@/lib/clubCompetitionService';
import { runCompetitionWriteWithRetry } from '@/lib/competitionRetry';
import { useCompetitionRealtime } from '@/hooks/useCompetitionRealtime';
import type { CompetitionMatchScoringData, CompetitionScoringMode } from '@/types/competition';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const parseMode = (value: string | undefined): CompetitionScoringMode | null => {
  if (value === 'remote' || value === 'manual') return value;
  return null;
};

const showSuccessToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert('Saved', message);
};

export default function ManualScoreEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    competitionId?: string;
    matchId?: string;
    mode?: string;
    from?: string;
  }>();

  const competitionId = typeof params.competitionId === 'string' ? params.competitionId : '';
  const matchId = typeof params.matchId === 'string' ? params.matchId : '';
  const routeMode = parseMode(typeof params.mode === 'string' ? params.mode : undefined);
  const returnTo = typeof params.from === 'string' ? params.from : 'poules';

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);
  const [data, setData] = useState<CompetitionMatchScoringData | null>(null);
  const [scoringMode, setScoringMode] = useState<CompetitionScoringMode>('manual');
  const [scoreAInput, setScoreAInput] = useState('');
  const [scoreBInput, setScoreBInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingLiveScore, setUpdatingLiveScore] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const matchVersionRef = useRef('');

  const loadData = useCallback(async (showSpinner = true): Promise<string | null> => {
    if (!user?.id || !competitionId || !matchId) {
      setErrorText('Match context was not found.');
      setLoading(false);
      matchVersionRef.current = '';
      return null;
    }

    if (showSpinner) {
      setLoading(true);
    }
    setErrorText(null);
    setInfoText(null);

    const initial = await getCompetitionMatchScoringData({
      userId: user.id,
      competitionId,
      matchId,
    });

    if (!initial) {
      setErrorText('You do not have access to this match.');
      setData(null);
      setLoading(false);
      matchVersionRef.current = '';
      return null;
    }

    const requestedMode = routeMode ?? initial.match.scoring_mode ?? 'manual';
    const shouldTrackRemoteStart =
      requestedMode === 'remote' &&
      (initial.match.scoring_mode !== 'remote' ||
        initial.match.status !== 'live' ||
        initial.match.authoritative_scorer_user_id !== user.id);
    const isCompetitionReadOnly = initial.competition.status === 'finalised';

    if (isCompetitionReadOnly) {
      setInfoText('Competition is finalised. This match is read-only.');
    } else if (initial.match.status !== 'completed') {
      const preparation = await prepareCompetitionMatchScoring({
        matchId,
        mode: requestedMode,
      });

      if (!preparation.ok) {
        if (preparation.reason === 'remote_scorer_already_assigned') {
          setInfoText('Match is being scored by another user. You are in view-only mode.');
        } else if (preparation.reason === 'scoring_mode_locked_once_live') {
          setInfoText('Scoring mode is already locked for this live match.');
        } else {
          setErrorText(preparation.message);
        }
      } else if (shouldTrackRemoteStart) {
        analytics.capture('remote_scoring_started', {
          competition_id: competitionId,
          match_id: matchId,
        });
      }
    }

    const refreshed = await getCompetitionMatchScoringData({
      userId: user.id,
      competitionId,
      matchId,
    });

    if (!refreshed) {
      setErrorText('Match could not be loaded.');
      setData(null);
      setLoading(false);
      matchVersionRef.current = '';
      return null;
    }

    const resolvedMode = refreshed.match.scoring_mode ?? requestedMode;
    setScoringMode(resolvedMode);
    setData(refreshed);
    setScoreAInput(
      refreshed.match.score_a != null ? String(refreshed.match.score_a) : ''
    );
    setScoreBInput(
      refreshed.match.score_b != null ? String(refreshed.match.score_b) : ''
    );
    const version = `${refreshed.competition.updated_at}:${refreshed.match.updated_at}:${refreshed.match.status}:${refreshed.match.score_a ?? ''}:${refreshed.match.score_b ?? ''}`;
    matchVersionRef.current = version;
    setLoading(false);
    return version;
  }, [competitionId, matchId, routeMode, user?.id]);

  const {
    bannerText: realtimeBannerText,
    correctionNotice: realtimeCorrectionNotice,
    clearCorrectionNotice,
    retryNow: retryRealtime,
  } = useCompetitionRealtime({
    competitionId,
    activeMatchId: matchId,
    enabled: Boolean(user?.id && competitionId && matchId),
    surface: 'manual',
    onCompetitionEvent: () => {
      void loadData(false);
    },
    onMatchEvent: () => {
      void loadData(false);
    },
    onReconnectRefetch: async () => {
      const before = matchVersionRef.current;
      const after = await loadData(false);
      return Boolean(after && after !== before);
    },
  });

  useFocusEffect(
    useCallback(() => {
      void loadData(true);
    }, [loadData])
  );

  const fencerAName = useMemo(() => {
    if (!data?.fencerA) return 'Fencer A';
    return data.fencerA.display_name;
  }, [data?.fencerA]);

  const fencerBName = useMemo(() => {
    if (!data?.fencerB) return 'Fencer B';
    return data.fencerB.display_name;
  }, [data?.fencerB]);

  const currentScoreA = data?.match.score_a ?? 0;
  const currentScoreB = data?.match.score_b ?? 0;
  const touchLimit = data?.match.touch_limit ?? 5;

  const canEditRemoteScore =
    !!data &&
    scoringMode === 'remote' &&
    data.competition.status !== 'finalised' &&
    data.match.status !== 'completed' &&
    data.isAuthoritativeScorer;

  const completeDisabled =
    saving ||
    loading ||
    !data ||
    data.competition.status === 'finalised' ||
    data.match.status === 'completed' ||
    (scoringMode === 'remote' && !data.isAuthoritativeScorer);

  const navigateBackToSource = () => {
    if (returnTo === 'de') {
      router.replace({
        pathname: '/(tabs)/competitions/de-tableau',
        params: { competitionId },
      });
      return;
    }

    if (returnTo === 'overview') {
      router.replace({
        pathname: '/(tabs)/competitions/overview',
        params: { competitionId },
      });
      return;
    }

    router.replace({
      pathname: '/(tabs)/competitions/poules',
      params: { competitionId },
    });
  };

  const ensureOnlineForSave = async (): Promise<boolean> => {
    const netInfoState = await NetInfo.fetch();
    if (!netInfoState.isConnected || netInfoState.isInternetReachable === false) {
      setErrorText('You are offline. Connect to the internet before saving this match.');
      return false;
    }
    return true;
  };

  const validateFinalScore = (scoreA: number, scoreB: number): string | null => {
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
      return 'Enter valid numeric scores.';
    }
    if (scoreA < 0 || scoreB < 0) {
      return 'Scores cannot be negative.';
    }
    if (scoreA === scoreB) {
      return 'Ties are not allowed.';
    }
    if (scoreA > touchLimit || scoreB > touchLimit) {
      return 'Score cannot exceed touch limit.';
    }
    return null;
  };

  const submitCompletion = async (scoreA: number, scoreB: number) => {
    if (!data) return;

    if (COMPETITION_ENABLE_RESULT_AGREEMENT) {
      Alert.alert(
        'Result Agreement Staged',
        'Score agreement flow is feature-flagged and currently disabled in this V1 build.'
      );
      return;
    }

    const online = await ensureOnlineForSave();
    if (!online) return;

    const validationError = validateFinalScore(scoreA, scoreB);
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    setSaving(true);
    setErrorText(null);

    const execution = await runCompetitionWriteWithRetry(() =>
      completeCompetitionMatchScore({
        matchId,
        scoreA,
        scoreB,
        mode: scoringMode,
      })
    );
    const result = execution.result;

    setSaving(false);
    if (!result.ok) {
      if (execution.exhausted) {
        analytics.capture('competition_write_retry_exhausted', {
          competition_id: competitionId,
          match_id: matchId,
          stage: data.match.stage,
          operation: 'complete_match',
          attempts: execution.attempts,
        });
      }
      setErrorText(result.message);
      analytics.capture('competition_score_save_failed', {
        competition_id: competitionId,
        match_id: matchId,
        stage: data.match.stage,
        scoring_mode: scoringMode,
      });
      return;
    }

    if (scoringMode === 'manual') {
      analytics.capture('manual_score_submitted', {
        competition_id: competitionId,
        match_id: matchId,
        stage: data.match.stage,
      });
    }

    showSuccessToast('Score saved');
    navigateBackToSource();
  };

  const onManualSave = async () => {
    const parsedA = Number.parseInt(scoreAInput, 10);
    const parsedB = Number.parseInt(scoreBInput, 10);
    await submitCompletion(parsedA, parsedB);
  };

  const onRemoteAdjust = async (side: 'a' | 'b', delta: -1 | 1) => {
    if (!data || !canEditRemoteScore || updatingLiveScore) return;
    const nextA = side === 'a' ? Math.max(0, Math.min(touchLimit, currentScoreA + delta)) : currentScoreA;
    const nextB = side === 'b' ? Math.max(0, Math.min(touchLimit, currentScoreB + delta)) : currentScoreB;

    if (nextA === currentScoreA && nextB === currentScoreB) return;

    setUpdatingLiveScore(true);
    const execution = await runCompetitionWriteWithRetry(() =>
      setCompetitionMatchLiveScore({
        matchId,
        scoreA: nextA,
        scoreB: nextB,
      })
    );
    const result = execution.result;
    setUpdatingLiveScore(false);

    if (!result.ok) {
      if (execution.exhausted) {
        analytics.capture('competition_write_retry_exhausted', {
          competition_id: competitionId,
          match_id: matchId,
          stage: data.match.stage,
          operation: 'set_live_score',
          attempts: execution.attempts,
        });
      }
      setErrorText(result.message);
      analytics.capture('competition_live_score_failed', {
        competition_id: competitionId,
        match_id: matchId,
        stage: data.match.stage,
      });
      return;
    }

    setData((previous) =>
      previous
        ? {
            ...previous,
            match: result.data,
            isAuthoritativeScorer: result.data.authoritative_scorer_user_id === user?.id,
          }
        : previous
    );
  };

  const onTakeOver = () => {
    if (!data?.canTakeOverRemote || takingOver) return;

    analytics.capture('scoring_takeover_initiated', {
      competition_id: competitionId,
      match_id: matchId,
    });

    Alert.alert(
      'Take over scoring?',
      'You will become the authoritative scorer for this remote match.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Over',
          onPress: async () => {
            setTakingOver(true);
            const execution = await runCompetitionWriteWithRetry(() =>
              takeOverCompetitionMatchRemoteScoring({ matchId })
            );
            const result = execution.result;
            setTakingOver(false);

            if (!result.ok) {
              if (execution.exhausted) {
                analytics.capture('competition_write_retry_exhausted', {
                  competition_id: competitionId,
                  match_id: matchId,
                  stage: data.match.stage,
                  operation: 'take_over_remote',
                  attempts: execution.attempts,
                });
              }
              setErrorText(result.message);
              analytics.capture('competition_takeover_failed', {
                competition_id: competitionId,
                match_id: matchId,
                stage: data.match.stage,
              });
              return;
            }

            analytics.capture('scoring_takeover_confirmed', {
              competition_id: competitionId,
              match_id: matchId,
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
        <Text style={styles.errorText}>{errorText ?? 'Match not available.'}</Text>
        <Pressable
          onPress={navigateBackToSource}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const authoritativeName = data.authoritativeScorer?.display_name ?? 'Another user';

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 20,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>
            {scoringMode === 'remote' ? 'Remote Scoring' : 'Manual Score Entry'}
          </Text>
          <CompetitionRealtimeBanner
            bannerText={realtimeBannerText}
            correctionNotice={realtimeCorrectionNotice}
            onRetry={retryRealtime}
            onDismissCorrection={clearCorrectionNotice}
          />
          <Text style={styles.subtitle}>
            {fencerAName} vs {fencerBName}
          </Text>

          <View style={styles.card}>
            <Text style={styles.metaText}>Touch limit: {touchLimit}</Text>
            <Text style={styles.metaText}>
              Status: {COMPETITION_MATCH_STATUS_LABELS[data.match.status]}
            </Text>
            <Text style={styles.metaText}>
              Mode: {scoringMode === 'remote' ? 'Remote' : 'Manual'}
            </Text>
          </View>

          {scoringMode === 'remote' &&
          data.match.status !== 'completed' &&
          !data.isAuthoritativeScorer ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>Scored by {authoritativeName}. You are in view-only mode.</Text>
              {data.canTakeOverRemote ? (
                <Pressable
                  onPress={onTakeOver}
                  disabled={takingOver}
                  style={[styles.takeOverButton, takingOver && styles.disabledButton]}
                >
                  {takingOver ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.takeOverButtonText}>Take Over</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          {infoText ? <Text style={styles.infoText}>{infoText}</Text> : null}

          {scoringMode === 'remote' ? (
            <View style={styles.card}>
              <RemoteScoreRow
                name={fencerAName}
                score={currentScoreA}
                onDecrement={() => void onRemoteAdjust('a', -1)}
                onIncrement={() => void onRemoteAdjust('a', 1)}
                disabled={!canEditRemoteScore || updatingLiveScore || saving}
              />
              <RemoteScoreRow
                name={fencerBName}
                score={currentScoreB}
                onDecrement={() => void onRemoteAdjust('b', -1)}
                onIncrement={() => void onRemoteAdjust('b', 1)}
                disabled={!canEditRemoteScore || updatingLiveScore || saving}
              />

              <Pressable
                onPress={() => void submitCompletion(currentScoreA, currentScoreB)}
                disabled={completeDisabled}
                style={[styles.primaryButton, completeDisabled && styles.disabledButton]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Complete Match</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <ScoreInput
                label={fencerAName}
                value={scoreAInput}
                onChangeText={setScoreAInput}
                editable={
                  !saving &&
                  data.competition.status !== 'finalised' &&
                  data.match.status !== 'completed'
                }
              />
              <ScoreInput
                label={fencerBName}
                value={scoreBInput}
                onChangeText={setScoreBInput}
                editable={
                  !saving &&
                  data.competition.status !== 'finalised' &&
                  data.match.status !== 'completed'
                }
              />

              <Pressable
                onPress={() => void onManualSave()}
                disabled={completeDisabled}
                style={[styles.primaryButton, completeDisabled && styles.disabledButton]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Score</Text>
                )}
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={navigateBackToSource}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ScoreInput({
  label,
  value,
  onChangeText,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        style={[styles.input, !editable && styles.inputDisabled]}
        editable={editable}
        placeholder="0"
        placeholderTextColor="#6F6F6F"
      />
    </View>
  );
}

function RemoteScoreRow({
  name,
  score,
  onIncrement,
  onDecrement,
  disabled,
}: {
  name: string;
  score: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.remoteRow}>
      <Text style={styles.remoteName}>{name}</Text>
      <View style={styles.remoteActions}>
        <Pressable
          onPress={onDecrement}
          disabled={disabled}
          style={[styles.adjustButton, disabled && styles.disabledButton]}
        >
          <Text style={styles.adjustButtonText}>-</Text>
        </Pressable>
        <Text style={styles.scoreValue}>{score}</Text>
        <Pressable
          onPress={onIncrement}
          disabled={disabled}
          style={[styles.adjustButton, disabled && styles.disabledButton]}
        >
          <Text style={styles.adjustButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  flex: {
    flex: 1,
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
  },
  subtitle: {
    color: '#9D9D9D',
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.24)',
    padding: 14,
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#20222A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B445A',
    padding: 12,
    gap: 10,
  },
  metaText: {
    color: '#CFCFCF',
    fontSize: 13,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#171717',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  remoteRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#171717',
    padding: 12,
    gap: 10,
  },
  remoteName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  remoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjustButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    minWidth: 56,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.purple.primary,
    borderRadius: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  takeOverButton: {
    backgroundColor: '#FF7675',
    borderRadius: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takeOverButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#1A1A1A',
  },
  secondaryButtonText: {
    color: '#E9D7FF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  errorText: {
    color: '#FF7675',
    fontSize: 13,
    lineHeight: 18,
  },
  infoText: {
    color: '#D0D8FF',
    fontSize: 13,
    lineHeight: 18,
  },
});

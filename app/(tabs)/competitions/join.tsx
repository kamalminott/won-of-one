import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import {
  joinCompetitionByCode,
  joinCompetitionByQr,
} from '@/lib/clubCompetitionService';
import {
  getJoinCooldownRemainingMs,
  registerInvalidJoinAttempt,
  resetJoinThrottle,
} from '@/lib/competitionJoinThrottle';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatCooldownMessage = (milliseconds: number): string => {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

const sanitizeCode = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 6);
};

export default function JoinCompetitionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userName } = useAuth();
  const params = useLocalSearchParams<{
    competition_id?: string;
    competitionId?: string;
    join_code?: string;
    joinCode?: string;
  }>();

  const [code, setCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [submittingQr, setSubmittingQr] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);
  const deepLinkAttemptedRef = useRef<string | null>(null);

  const deepLinkCompetitionId = useMemo(() => {
    const value =
      typeof params.competition_id === 'string'
        ? params.competition_id
        : typeof params.competitionId === 'string'
          ? params.competitionId
          : '';
    return value.trim();
  }, [params.competitionId, params.competition_id]);

  const deepLinkJoinCode = useMemo(() => {
    const value =
      typeof params.join_code === 'string'
        ? params.join_code
        : typeof params.joinCode === 'string'
          ? params.joinCode
          : '';
    return sanitizeCode(value);
  }, [params.joinCode, params.join_code]);

  const deepLinkQrPayload = useMemo(() => {
    if (!deepLinkCompetitionId || deepLinkJoinCode.length !== 6) {
      return null;
    }
    return `wonofone://competition/join?competition_id=${encodeURIComponent(
      deepLinkCompetitionId
    )}&join_code=${encodeURIComponent(deepLinkJoinCode)}`;
  }, [deepLinkCompetitionId, deepLinkJoinCode]);

  const deepLinkAttemptKey = useMemo(() => {
    if (deepLinkQrPayload) {
      return `qr:${deepLinkCompetitionId}:${deepLinkJoinCode}`;
    }
    if (deepLinkJoinCode.length === 6) {
      return `code:${deepLinkJoinCode}`;
    }
    return null;
  }, [deepLinkCompetitionId, deepLinkJoinCode, deepLinkQrPayload]);

  useEffect(() => {
    if (deepLinkJoinCode.length !== 6) return;
    setCode((currentCode) => (currentCode.length === 0 ? deepLinkJoinCode : currentCode));
  }, [deepLinkJoinCode]);

  const canJoinByCode = useMemo(() => code.length === 6 && !submittingCode, [code, submittingCode]);

  const navigateToOverview = useCallback((competitionId: string) => {
    router.replace({
      pathname: '/(tabs)/competitions/overview',
      params: {
        competitionId,
      },
    });
  }, [router]);

  const checkCooldown = useCallback(async (): Promise<number> => {
    const remaining = await getJoinCooldownRemainingMs();
    if (remaining > 0) {
      setErrorText(
        `Too many invalid attempts. Try again in ${formatCooldownMessage(remaining)}.`
      );
    }
    return remaining;
  }, []);

  const decodeQrPayloadFromImage = async (imageUri: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: 'competition-qr.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      symbol?: {
        data?: string | null;
        error?: string | null;
      }[];
    }[];

    const decoded = payload?.[0]?.symbol?.[0]?.data?.trim();
    if (!decoded) return null;
    return decoded;
  };

  const submitQrPayload = useCallback(async (
    payload: string,
    method: 'qr_camera' | 'qr_deep_link'
  ) => {
    if (!user?.id) {
      setErrorText('You need to be signed in to join a competition.');
      return;
    }

    const cooldownRemaining = await checkCooldown();
    if (cooldownRemaining > 0) return;

    setSubmittingQr(true);
    setErrorText(null);
    setInfoText(null);

    analytics.capture('competition_join_attempt', {
      method,
    });

    const result = await joinCompetitionByQr({
      userId: user.id,
      displayName: userName || 'Participant',
      rawPayload: payload,
    });

    setSubmittingQr(false);

    if (!result.ok) {
      if (result.reason === 'invalid_qr') {
        const throttleState = await registerInvalidJoinAttempt();
        if (throttleState.cooldownUntil) {
          const remainingMs = throttleState.cooldownUntil - Date.now();
          setErrorText(
            `Too many invalid attempts. Try again in ${formatCooldownMessage(
              Math.max(0, remainingMs)
            )}.`
          );
        } else {
          setErrorText(
            `${result.message} ${throttleState.attemptsLeft} attempts left before cooldown.`
          );
        }
      } else {
        setErrorText(result.message);
      }

      analytics.capture('competition_join_error', {
        method,
        reason: result.reason,
      });
      return;
    }

    await resetJoinThrottle();
    analytics.capture('competition_join_success', {
      method,
      competition_id: result.competition.id,
      read_only: result.readOnly,
      already_joined: result.alreadyJoined,
    });
    navigateToOverview(result.competition.id);
  }, [checkCooldown, navigateToOverview, user?.id, userName]);

  const submitCodeValue = useCallback(async (
    normalizedCode: string,
    method: 'code' | 'code_deep_link'
  ) => {
    if (!user?.id) {
      setErrorText('You need to be signed in to join a competition.');
      return;
    }

    if (normalizedCode.length !== 6) {
      setErrorText('Enter a valid 6-digit code.');
      return;
    }

    const cooldownRemaining = await checkCooldown();
    if (cooldownRemaining > 0) return;

    setSubmittingCode(true);
    setErrorText(null);
    setInfoText(null);

    analytics.capture('competition_join_attempt', {
      method,
      code_length: normalizedCode.length,
    });

    const result = await joinCompetitionByCode({
      userId: user.id,
      displayName: userName || 'Participant',
      joinCode: normalizedCode,
    });

    setSubmittingCode(false);

    if (!result.ok) {
      if (result.reason === 'invalid_code') {
        const throttleState = await registerInvalidJoinAttempt();
        if (throttleState.cooldownUntil) {
          const remainingMs = throttleState.cooldownUntil - Date.now();
          setErrorText(
            `Too many invalid attempts. Try again in ${formatCooldownMessage(
              Math.max(0, remainingMs)
            )}.`
          );
        } else {
          setErrorText(
            `${result.message} ${throttleState.attemptsLeft} attempts left before cooldown.`
          );
        }
      } else {
        setErrorText(result.message);
      }

      analytics.capture('competition_join_error', {
        method,
        reason: result.reason,
      });
      return;
    }

    await resetJoinThrottle();
    analytics.capture('competition_join_success', {
      method,
      competition_id: result.competition.id,
      read_only: result.readOnly,
      already_joined: result.alreadyJoined,
    });
    navigateToOverview(result.competition.id);
  }, [checkCooldown, navigateToOverview, user?.id, userName]);

  const onJoinByCode = async () => {
    const normalizedCode = sanitizeCode(code);
    await submitCodeValue(normalizedCode, 'code');
  };

  const onScanQrWithCamera = async () => {
    if (!user?.id) {
      setErrorText('You need to be signed in to join a competition.');
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      setErrorText('Camera permission is required to scan QR codes.');
      return;
    }

    const scanResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (scanResult.canceled || !scanResult.assets?.[0]?.uri) {
      return;
    }

    setSubmittingQr(true);
    setErrorText(null);
    setInfoText('Reading QR code...');

    const payload = await decodeQrPayloadFromImage(scanResult.assets[0].uri);
    setSubmittingQr(false);

    if (!payload) {
      setInfoText(null);
      setErrorText('Could not read QR code. Try scanning again or use the 6-digit code.');
      return;
    }

    await submitQrPayload(payload, 'qr_camera');
  };

  useEffect(() => {
    if (!user?.id || !deepLinkAttemptKey) {
      return;
    }
    if (deepLinkAttemptedRef.current === deepLinkAttemptKey) {
      return;
    }

    deepLinkAttemptedRef.current = deepLinkAttemptKey;
    setErrorText(null);
    setInfoText('Invite loaded. Joining competition...');

    if (deepLinkQrPayload) {
      void submitQrPayload(deepLinkQrPayload, 'qr_deep_link');
      return;
    }

    if (deepLinkJoinCode.length === 6) {
      void submitCodeValue(deepLinkJoinCode, 'code_deep_link');
    }
  }, [
    deepLinkAttemptKey,
    deepLinkJoinCode,
    deepLinkQrPayload,
    submitCodeValue,
    submitQrPayload,
    user?.id,
  ]);

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
          <Text style={styles.title}>Join Competition</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code or scan a QR invite to join.
          </Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>6-digit code</Text>
            <TextInput
              value={code}
              onChangeText={(next) => setCode(sanitizeCode(next))}
              placeholder="123456"
              placeholderTextColor="#6F6F6F"
              keyboardType="number-pad"
              maxLength={6}
              style={styles.codeInput}
            />

            <Pressable
              onPress={onJoinByCode}
              disabled={!canJoinByCode}
              style={[styles.primaryButton, !canJoinByCode && styles.primaryButtonDisabled]}
            >
              {submittingCode ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Join with Code</Text>
              )}
            </Pressable>

            <Pressable
              onPress={onScanQrWithCamera}
              style={styles.secondaryButton}
            >
              {submittingQr ? (
                <ActivityIndicator color="#E9D7FF" />
              ) : (
                <Text style={styles.secondaryButtonText}>Scan QR</Text>
              )}
            </Pressable>
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          {infoText ? <Text style={styles.infoText}>{infoText}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    paddingHorizontal: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9D9D9D',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.24)',
    padding: 14,
    gap: 12,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  codeInput: {
    backgroundColor: '#171717',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    paddingVertical: 12,
  },
  primaryButton: {
    backgroundColor: Colors.purple.primary,
    borderRadius: 12,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.5)',
    backgroundColor: '#1A1A1A',
  },
  secondaryButtonText: {
    color: '#E9D7FF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 12,
    color: '#FF7675',
    fontSize: 13,
  },
  infoText: {
    marginTop: 8,
    color: '#A0A0A0',
    fontSize: 12,
  },
});

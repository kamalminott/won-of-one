import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { resolveCompetitionDisplayName } from '@/lib/competitionDisplayName';
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
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
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

const QR_BARCODE_TYPES = ['qr'];

type ExpoCameraModule = typeof import('expo-camera');

const loadExpoCameraModule = async (): Promise<ExpoCameraModule | null> => {
  try {
    const expoModulesCore = await import('expo-modules-core');
    const cameraNativeModule = expoModulesCore.requireOptionalNativeModule('ExpoCamera');
    if (!cameraNativeModule) {
      return null;
    }
    return await import('expo-camera');
  } catch (error) {
    console.error('ExpoCamera native module is unavailable:', error);
    return null;
  }
};

export default function JoinCompetitionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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
  const qrScannerSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const hasHandledScannerResultRef = useRef(false);
  const competitionDisplayName = useMemo(
    () =>
      resolveCompetitionDisplayName({
        preferredName: userName,
        user,
        fallback: 'Fencer',
      }),
    [user, userName]
  );

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
  const cameraButtonLabel = Platform.OS === 'android' ? 'Open Camera App' : 'Scan QR';
  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;

  const navigateToParticipantsAndRoles = useCallback((competitionId: string) => {
    router.replace({
      pathname: '/(tabs)/competitions/participants-roles',
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

  const clearQrScannerSubscription = useCallback(() => {
    qrScannerSubscriptionRef.current?.remove();
    qrScannerSubscriptionRef.current = null;
  }, []);

  const submitQrPayload = useCallback(async (
    payload: string,
    method: 'qr_scanner' | 'qr_deep_link'
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
      displayName: competitionDisplayName,
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
    navigateToParticipantsAndRoles(result.competition.id);
  }, [checkCooldown, competitionDisplayName, navigateToParticipantsAndRoles, user?.id]);

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
      displayName: competitionDisplayName,
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
    navigateToParticipantsAndRoles(result.competition.id);
  }, [checkCooldown, competitionDisplayName, navigateToParticipantsAndRoles, user?.id]);

  const onJoinByCode = async () => {
    const normalizedCode = sanitizeCode(code);
    await submitCodeValue(normalizedCode, 'code');
  };

  const onScanQrWithCamera = async () => {
    setErrorText(null);
    setInfoText(null);

    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent('android.media.action.STILL_IMAGE_CAMERA');
        setInfoText(
          'Your camera app is open. Scan the QR invite there and tap the prompt to return here.'
        );
      } catch (error) {
        console.error('Error opening system camera:', error);
        setErrorText('Could not open your camera app. Use the 6-digit code instead.');
      }
      return;
    }

    setSubmittingQr(true);

    try {
      const cameraModule = await loadExpoCameraModule();
      if (!cameraModule) {
        setErrorText('QR scanner is not available in this build yet. Reinstall the latest iPhone dev build or use the 6-digit code.');
        return;
      }

      const CameraView = cameraModule.CameraView;
      const requestCameraPermissionsAsync =
        cameraModule.requestCameraPermissionsAsync ??
        cameraModule.Camera?.requestCameraPermissionsAsync;
      if (!requestCameraPermissionsAsync) {
        setErrorText('QR scanner permission API is unavailable in this build. Reinstall the latest iPhone dev build or use the 6-digit code.');
        return;
      }
      const permissionResult = await requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        setErrorText('Camera permission is required to scan competition QR codes.');
        return;
      }

      if (!CameraView.isModernBarcodeScannerAvailable) {
        setErrorText('QR scanning on iPhone requires iOS 16 or later. Use the 6-digit code instead.');
        return;
      }

      clearQrScannerSubscription();
      hasHandledScannerResultRef.current = false;
      qrScannerSubscriptionRef.current = CameraView.onModernBarcodeScanned(async (event) => {
        if (hasHandledScannerResultRef.current) {
          return;
        }
        hasHandledScannerResultRef.current = true;
        clearQrScannerSubscription();

        try {
          await CameraView.dismissScanner();
        } catch (error) {
          console.error('Error dismissing QR scanner:', error);
        }

        const payload = event.data?.trim();
        if (!payload) {
          setErrorText('Could not read QR code. Try scanning again or use the 6-digit code.');
          return;
        }

        setInfoText('QR scanned. Joining competition...');
        await submitQrPayload(payload, 'qr_scanner');
      });

      await CameraView.launchScanner({
        barcodeTypes: QR_BARCODE_TYPES,
      });
      setInfoText('Scan the competition QR code.');
    } catch (error) {
      console.error('Error opening QR scanner:', error);
      clearQrScannerSubscription();
      setErrorText('Could not open QR scanner. Use the 6-digit code instead.');
    } finally {
      setSubmittingQr(false);
    }
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

  useEffect(() => {
    return () => {
      clearQrScannerSubscription();
      if (Platform.OS === 'ios') {
        void loadExpoCameraModule().then((cameraModule) => {
          if (cameraModule) {
            void cameraModule.CameraView.dismissScanner().catch(() => undefined);
          }
        });
      }
    };
  }, [clearQrScannerSubscription]);

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
              paddingBottom: contentBottomPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backRow}>
            <BackButton
              onPress={() => router.replace('/(tabs)/competitions')}
              style={styles.backIconButton}
            />
          </View>
          <Text style={styles.title}>Join Competition</Text>
          <Text style={styles.subtitle}>
            {'Enter the 6-digit code or scan a QR invite to join.'}
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
                <Text style={styles.secondaryButtonText}>{cameraButtonLabel}</Text>
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

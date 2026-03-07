import { BackButton } from '@/components/BackButton';
import { Colors } from '@/constants/Colors';
import {
  COMPETITION_FORMAT_LABELS,
  COMPETITION_WEAPON_LABELS,
  DE_TOUCH_LIMIT_OPTIONS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { createClubCompetition } from '@/lib/clubCompetitionService';
import { resolveCompetitionDisplayName } from '@/lib/competitionDisplayName';
import type { CompetitionFormat, CompetitionWeapon } from '@/types/competition';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

export default function CreateCompetitionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { user, userName } = useAuth();

  const [name, setName] = useState('');
  const [weapon, setWeapon] = useState<CompetitionWeapon>('foil');
  const [format, setFormat] = useState<CompetitionFormat>('poules_then_de');
  const [deTouchLimit, setDeTouchLimit] = useState<10 | 15>(15);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameLength = useMemo(() => name.trim().length, [name]);
  const canSubmit = nameLength >= 2 && !submitting;
  const tabBarOverlayHeight = windowHeight * 0.08 + insets.bottom;
  const contentBottomPadding = tabBarOverlayHeight + 20;
  const competitionDisplayName = useMemo(
    () =>
      resolveCompetitionDisplayName({
        preferredName: userName,
        user,
        fallback: 'Fencer',
      }),
    [user, userName]
  );

  const onCreateCompetition = async () => {
    if (!user?.id) {
      setErrorText('You need to be signed in to create a competition.');
      return;
    }

    const cleanedName = name.trim().replace(/\s+/g, ' ');
    if (cleanedName.length < 2) {
      setErrorText('Competition name must be at least 2 characters.');
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    const result = await createClubCompetition({
      userId: user.id,
      displayName: competitionDisplayName,
      name: cleanedName,
      weapon,
      format,
      deTouchLimit,
    });

    setSubmitting(false);

    if (!result.ok) {
      setErrorText(result.message);
      return;
    }

    analytics.capture('competition_created', {
      competition_id: result.competition.id,
      weapon,
      format,
      de_touch_limit: deTouchLimit,
    });

    router.replace({
      pathname: '/(tabs)/competitions/overview',
      params: {
        competitionId: result.competition.id,
      },
    });
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
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
          <Text style={styles.title}>Create Competition</Text>
          <Text style={styles.subtitle}>
            Set up your event, then share the join code or QR from the overview.
          </Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Saturday Club Open"
              placeholderTextColor="#6F6F6F"
              style={styles.input}
              maxLength={80}
              autoCapitalize="words"
            />
            <Text style={styles.helperText}>{nameLength}/80</Text>

            <Text style={styles.fieldLabel}>Weapon</Text>
            <View style={styles.optionRow}>
              {(['foil', 'epee', 'sabre'] as const).map((value) => (
                <OptionChip
                  key={value}
                  label={COMPETITION_WEAPON_LABELS[value]}
                  active={weapon === value}
                  onPress={() => setWeapon(value)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Format</Text>
            <View style={styles.formatColumn}>
              {(['poules_then_de', 'poules_only', 'de_only'] as const).map((value) => (
                <OptionChip
                  key={value}
                  label={COMPETITION_FORMAT_LABELS[value]}
                  active={format === value}
                  onPress={() => setFormat(value)}
                  fullWidth
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>DE Touch Limit</Text>
            <View style={styles.optionRow}>
              {DE_TOUCH_LIMIT_OPTIONS.map((value) => (
                <OptionChip
                  key={value}
                  label={`${value}`}
                  active={deTouchLimit === value}
                  onPress={() => setDeTouchLimit(value)}
                />
              ))}
            </View>
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <Pressable
            onPress={onCreateCompetition}
            style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>Create Competition</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OptionChip({
  label,
  active,
  onPress,
  fullWidth = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionChip,
        active && styles.optionChipActive,
        fullWidth && styles.optionChipFullWidth,
      ]}
    >
      <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
        {label}
      </Text>
    </Pressable>
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
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#171717',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  helperText: {
    color: '#8D8D8D',
    fontSize: 12,
    marginTop: 6,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  formatColumn: {
    gap: 8,
  },
  optionChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#171717',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  optionChipFullWidth: {
    width: '100%',
    alignItems: 'flex-start',
  },
  optionChipActive: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor: Colors.purple.primary,
  },
  optionChipText: {
    color: '#B9B9B9',
    fontSize: 13,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FF7675',
    fontSize: 13,
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: Colors.purple.primary,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.45,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#D3D3D3',
    fontSize: 14,
    fontWeight: '600',
  },
});

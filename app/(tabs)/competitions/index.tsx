import { Colors } from '@/constants/Colors';
import {
  COMPETITION_ROLE_LABELS,
  COMPETITION_STATUS_COLORS,
  COMPETITION_STATUS_LABELS,
} from '@/constants/competition';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { listCompetitionSummariesForUser } from '@/lib/clubCompetitionService';
import type { CompetitionSummary } from '@/types/competition';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CompetitionsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeCompetitions, setActiveCompetitions] = useState<CompetitionSummary[]>([]);
  const [pastCompetitions, setPastCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCompetitions = useCallback(async () => {
    if (!user?.id) {
      setActiveCompetitions([]);
      setPastCompetitions([]);
      setLoading(false);
      return;
    }

    const summaries = await listCompetitionSummariesForUser(user.id);
    setActiveCompetitions(summaries.active);
    setPastCompetitions(summaries.past);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      analytics.capture('competition_hub_viewed');
      setLoading(true);
      void loadCompetitions();
    }, [loadCompetitions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetitions();
    setRefreshing(false);
  };

  const hasActive = activeCompetitions.length > 0;
  const hasPast = pastCompetitions.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
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
        <Text style={styles.title}>Competition Hub</Text>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => router.push('/(tabs)/competitions/create')}
            style={[styles.actionButton, styles.primaryButton]}
          >
            <Text style={styles.primaryButtonText}>Create Competition</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/competitions/join')}
            style={[styles.actionButton, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Join</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.purple.primary} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active</Text>
              {hasActive ? (
                activeCompetitions.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                  />
                ))
              ) : (
                <EmptyState text="No active competitions yet." />
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Past</Text>
              {hasPast ? (
                pastCompetitions.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                  />
                ))
              ) : (
                <EmptyState text="No past competitions yet." />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CompetitionCard({ competition }: { competition: CompetitionSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        analytics.capture('competition_opened', {
          competition_id: competition.id,
          status: competition.status,
        });
        router.push({
          pathname: '/(tabs)/competitions/overview',
          params: {
            competitionId: competition.id,
          },
        });
      }}
      style={styles.card}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.cardTitle}>{competition.name}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: COMPETITION_STATUS_COLORS[competition.status] },
          ]}
        >
          <Text style={styles.statusText}>
            {COMPETITION_STATUS_LABELS[competition.status]}
          </Text>
        </View>
      </View>

      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>
          {competition.weapon.toUpperCase()} • {competition.participantCount}{' '}
          participants
        </Text>
        <Text style={styles.roleText}>
          {COMPETITION_ROLE_LABELS[competition.role]}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.purple.primary,
    flex: 1.6,
  },
  secondaryButton: {
    backgroundColor: '#212121',
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.4)',
    flex: 1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#E9D7FF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#212121',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,166,255,0.2)',
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    color: '#9D9D9D',
    fontSize: 13,
    fontWeight: '500',
  },
  roleText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    padding: 14,
  },
  emptyText: {
    color: '#9D9D9D',
    fontSize: 14,
  },
});

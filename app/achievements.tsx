import { BackButton } from '@/components/BackButton';
import { AchievementCard } from '@/components/achievements/AchievementCard';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { achievementService } from '@/lib/achievementService';
import type { AchievementCardData, AchievementDashboardData } from '@/types/achievements';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TIER_COLORS: Record<string, { fill: string; soft: string; locked: string }> = {
  starter: { fill: '#9CA3AF', soft: 'rgba(156, 163, 175, 0.18)', locked: '#3A3A40' },
  bronze: { fill: '#CD7F32', soft: 'rgba(205, 127, 50, 0.18)', locked: '#3A2A1F' },
  silver: { fill: '#C0C0C0', soft: 'rgba(192, 192, 192, 0.18)', locked: '#3A3A3F' },
  gold: { fill: '#FFD700', soft: 'rgba(255, 215, 0, 0.18)', locked: '#3D341A' },
  platinum: { fill: '#E5E4E2', soft: 'rgba(229, 228, 226, 0.2)', locked: '#3A3A40' },
};

const getTierColor = (tierKey: string) =>
  TIER_COLORS[tierKey] ?? { fill: '#8B5CF6', soft: 'rgba(139, 92, 246, 0.18)', locked: '#3A3A40' };

const getProgressSummary = (achievement: AchievementCardData): string => {
  if (achievement.nextTier) {
    return `${achievement.currentValue} / ${achievement.nextTier.threshold} to ${achievement.nextTier.label}`;
  }

  if (achievement.latestUnlockedTier && achievement.tiers.length > 1) {
    return `${achievement.currentValueLabel} · ${achievement.latestUnlockedTier.label} complete`;
  }

  return achievement.currentValueLabel;
};

const formatCount = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural}`;

const getThresholdLabel = (achievement: AchievementCardData, threshold: number): string => {
  switch (achievement.key) {
    case 'match_master':
    case 'first_match':
      return formatCount(threshold, 'total match', 'total matches');
    case 'victory_hunter':
    case 'first_win':
      return formatCount(threshold, 'total win', 'total wins');
    case 'hot_streak':
      return formatCount(threshold, 'win in a row', 'wins in a row');
    case 'competitor':
      return formatCount(threshold, 'competition', 'competitions');
    case 'organiser':
      return formatCount(threshold, 'competition created', 'competitions created');
    case 'closer':
      return formatCount(threshold, 'competition finalised', 'competitions finalised');
    case 'competition_scorer':
      return formatCount(threshold, 'competition match', 'competition matches');
    case 'training_ground':
      return formatCount(threshold, 'training session', 'training sessions');
    case 'consistency_chain':
      return formatCount(threshold, 'consecutive day', 'consecutive days');
    case 'goal_setter':
      return formatCount(threshold, 'goal created', 'goals created');
    case 'goal_crusher':
      return formatCount(threshold, 'completed goal', 'completed goals');
    case 'remote_contender':
      return formatCount(threshold, 'remote match', 'remote matches');
    case 'profile_ready':
      return 'a completed profile';
    default:
      return formatCount(threshold, 'step', 'steps');
  }
};

const getModalDescription = (achievement: AchievementCardData): string => {
  if (!achievement.nextTier) {
    return 'All tiers complete.';
  }

  const nextTierLabel =
    achievement.nextTier.label === 'Unlocked' ? 'this achievement' : achievement.nextTier.label;
  const nextThresholdLabel = getThresholdLabel(achievement, achievement.nextTier.threshold);

  switch (achievement.key) {
    case 'first_match':
    case 'match_master':
      return `Log ${nextThresholdLabel} to unlock ${nextTierLabel}.`;
    case 'first_win':
    case 'victory_hunter':
      return `Win ${nextThresholdLabel} in saved matches to unlock ${nextTierLabel}.`;
    case 'hot_streak':
      return `Win ${nextThresholdLabel} to unlock ${nextTierLabel}.`;
    case 'shutout_artist':
      return 'Win 1 saved match without conceding a touch to unlock this achievement.';
    case 'competitor':
      return `Join ${nextThresholdLabel} to unlock ${nextTierLabel}.`;
    case 'organiser':
      return 'Create 1 competition to unlock this achievement.';
    case 'closer':
      return 'Finalise 1 competition you created to unlock this achievement.';
    case 'competition_scorer':
      return 'Save 1 match inside a competition to unlock this achievement.';
    case 'training_ground':
      return `Log ${nextThresholdLabel} to unlock ${nextTierLabel}.`;
    case 'consistency_chain':
      return `Log training sessions on ${nextThresholdLabel} to unlock ${nextTierLabel}.`;
    case 'goal_setter':
      return 'Create 1 goal to unlock this achievement.';
    case 'goal_crusher':
      return `Complete ${nextThresholdLabel} you created to unlock ${nextTierLabel}.`;
    case 'remote_contender':
      return `Score ${nextThresholdLabel} using Remote to unlock ${nextTierLabel}.`;
    case 'profile_ready':
      return 'Complete your full name, handedness, and preferred weapon to unlock this achievement.';
    default:
      return `Reach ${nextThresholdLabel} to unlock ${nextTierLabel}.`;
  }
};

export default function AchievementsScreen() {
  const { user, userName, session } = useAuth();
  const accessToken = session?.access_token ?? undefined;

  const [dashboard, setDashboard] = useState<AchievementDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] =
    useState<AchievementCardData | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setDashboard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextDashboard = await achievementService.loadDashboard({
        userId: user.id,
        accessToken,
        userName,
        syncSource: 'achievements_screen',
      });
      setDashboard(nextDashboard);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Failed to load achievements';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.id, userName]);

  useFocusEffect(
    useCallback(() => {
      analytics.screen('Achievements');
      analytics.capture('achievements_screen_viewed');
      void loadDashboard();
    }, [loadDashboard])
  );

  const newAchievementKeys = useMemo(
    () => new Set(dashboard?.newUnlocks.map((unlock) => unlock.achievementKey) ?? []),
    [dashboard?.newUnlocks]
  );

  const openAchievementDetail = useCallback((achievement: AchievementCardData) => {
    setSelectedAchievement(achievement);
    analytics.capture('achievement_detail_opened', {
      achievement_key: achievement.key,
      category: achievement.category,
      unlocked_tiers: achievement.unlockedTierCount,
      total_tiers: achievement.totalTierCount,
    });
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#8B5CF6" size="large" />
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Achievements unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void loadDashboard()}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : dashboard ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View>
                <Text style={styles.summaryEyebrow}>Overall Progress</Text>
                <Text style={styles.summaryTitle}>
                  {dashboard.totalUnlockedTierCount}/{dashboard.totalTierCount} unlocked
                </Text>
              </View>
              <Text style={styles.summaryPercent}>{dashboard.completionPercentage}%</Text>
            </View>

            <View style={styles.summaryProgressTrack}>
              <View
                style={[
                  styles.summaryProgressFill,
                  { width: `${dashboard.completionPercentage}%` },
                ]}
              />
            </View>

            {dashboard.newUnlocks.length > 0 ? (
              <View style={styles.newUnlocksRow}>
                <Ionicons color="#F4C542" name="sparkles" size={14} />
                <Text style={styles.newUnlocksText}>
                  {dashboard.newUnlocks.length === 1
                    ? '1 new achievement unlocked'
                    : `${dashboard.newUnlocks.length} new achievements unlocked`}
                </Text>
              </View>
            ) : null}
          </View>

          {dashboard.highlightedAchievements.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Featured</Text>
              </View>
              <View style={styles.grid}>
                {dashboard.highlightedAchievements.map((achievement) => (
                  <View key={achievement.key} style={styles.gridCell}>
                    <AchievementCard
                      achievement={achievement}
                      isNew={newAchievementKeys.has(achievement.key)}
                      onPress={() => openAchievementDetail(achievement)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {dashboard.sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionMeta}>
                  {section.unlockedTierCount}/{section.totalTierCount}
                </Text>
              </View>

              <View style={styles.grid}>
                {section.achievements.map((achievement) => (
                  <View key={achievement.key} style={styles.gridCell}>
                    <AchievementCard
                      achievement={achievement}
                      isNew={newAchievementKeys.has(achievement.key)}
                      onPress={() => openAchievementDetail(achievement)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedAchievement(null)}
        transparent
        visible={Boolean(selectedAchievement)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSelectedAchievement(null)}
            style={StyleSheet.absoluteFillObject}
          />

          {selectedAchievement ? (
            <View style={styles.modalCard}>
              <View
                style={[
                  styles.modalIconWrap,
                  {
                    backgroundColor: selectedAchievement.accentSoftColor,
                  },
                ]}
              >
                <Ionicons
                  color={selectedAchievement.accentColor}
                  name={selectedAchievement.icon}
                  size={26}
                />
              </View>

              <Text style={styles.modalTitle}>{selectedAchievement.title}</Text>
              <Text style={styles.modalDescription}>
                {getModalDescription(selectedAchievement)}
              </Text>

              {selectedAchievement.tiers.length > 1 ? (
                <View style={styles.modalTierOverview}>
                  <View style={styles.modalTierMarkerRow}>
                    {selectedAchievement.tiers.map((tier) => {
                      const tierColor = getTierColor(tier.key);
                      const isCurrent =
                        selectedAchievement.latestUnlockedTier?.key === tier.key;
                      return (
                        <View
                          key={`${selectedAchievement.key}-${tier.key}-overview-marker`}
                          style={styles.modalTierMarkerWrap}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.modalTierOverviewLabel,
                              isCurrent ? styles.modalTierOverviewLabelCurrent : null,
                              { color: tierColor.fill },
                            ]}
                          >
                            {tier.label}
                          </Text>
                          <View
                            style={[
                              styles.modalTierMedal,
                              {
                                backgroundColor: tier.unlocked ? tierColor.fill : 'transparent',
                                borderColor: tier.unlocked ? tierColor.fill : tierColor.locked,
                              },
                            ]}
                          >
                            {tier.unlocked ? (
                              <Ionicons color="#1A1A1A" name="checkmark" size={20} />
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.modalProgressTrack}>
                <View
                  style={[
                    styles.modalProgressFill,
                    {
                      backgroundColor: selectedAchievement.accentColor,
                      width: `${selectedAchievement.progressPercent}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.modalProgressText}>
                {getProgressSummary(selectedAchievement)}
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedAchievement(null)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 14,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#C6C6CC',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  gridCell: {
    width: '31%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  loadingText: {
    color: '#C6C6CC',
    fontSize: 14,
    marginTop: 14,
  },
  modalCard: {
    backgroundColor: '#17171B',
    borderColor: '#2A2A30',
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 20,
    padding: 20,
  },
  modalDescription: {
    color: '#C6C6CC',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  modalIconWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 20,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    flex: 1,
    justifyContent: 'center',
  },
  modalProgressFill: {
    borderRadius: 999,
    height: 6,
  },
  modalProgressText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalProgressTrack: {
    backgroundColor: '#26262B',
    borderRadius: 999,
    height: 6,
    marginTop: 16,
    overflow: 'hidden',
  },
  modalTierMarkerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  modalTierMarkerWrap: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  modalTierMedal: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  modalTierOverview: {
    marginTop: 20,
  },
  modalTierOverviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalTierOverviewLabelCurrent: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  newUnlocksRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 12,
  },
  newUnlocksText: {
    color: '#F5E39A',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#131313',
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionMeta: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#17171B',
    borderColor: '#26262B',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  summaryEyebrow: {
    color: '#8D8D93',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryPercent: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  summaryProgressFill: {
    backgroundColor: '#8B5CF6',
    borderRadius: 999,
    height: 6,
  },
  summaryProgressTrack: {
    backgroundColor: '#26262B',
    borderRadius: 999,
    height: 6,
    marginTop: 14,
    overflow: 'hidden',
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryTopRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

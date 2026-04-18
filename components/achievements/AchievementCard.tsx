import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { AchievementCardData } from '@/types/achievements';

type AchievementCardProps = {
  achievement: AchievementCardData;
  compact?: boolean;
  isNew?: boolean;
  onPress?: () => void;
};

const TIER_STATUS_COLORS = {
  starter: { icon: '#6D3FD6', soft: 'rgba(139, 92, 246, 0.18)' },
  bronze: { icon: '#A65E27', soft: 'rgba(205, 127, 50, 0.18)' },
  silver: { icon: '#8C919B', soft: 'rgba(192, 192, 192, 0.18)' },
  gold: { icon: '#C59A16', soft: 'rgba(255, 215, 0, 0.18)' },
  platinum: { icon: '#4E9FC3', soft: 'rgba(125, 211, 252, 0.18)' },
} as const;

export function AchievementCard({
  achievement,
  compact = false,
  isNew = false,
  onPress,
}: AchievementCardProps) {
  const progressLabel = achievement.nextTier
    ? `${achievement.currentValue} / ${achievement.nextTier.threshold} ${achievement.currentValueLabel.replace(/^\d+\s*/, '')}`
    : achievement.currentValueLabel;
  const unlockedStatusColors =
    achievement.latestUnlockedTier && achievement.unlockedTierCount > 0
      ? TIER_STATUS_COLORS[achievement.latestUnlockedTier.key]
      : null;
  const statusIconColor = unlockedStatusColors?.icon ?? achievement.accentColor;
  const statusSoftColor = unlockedStatusColors?.soft ?? achievement.accentSoftColor;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.card,
        compact ? styles.compactCard : styles.fullCard,
        achievement.unlockedTierCount > 0 ? styles.unlockedCard : styles.lockedCard,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.statusWrap}>
          {isNew ? (
            <View style={styles.newPill}>
              <Text style={styles.newPillText}>New</Text>
            </View>
          ) : (
            <View
              style={[
                styles.statusDot,
                achievement.unlockedTierCount > 0
                  ? { backgroundColor: statusSoftColor }
                  : styles.statusDotLocked,
              ]}
            >
              <Ionicons
                color={
                  achievement.unlockedTierCount > 0
                    ? statusIconColor
                    : '#8D8D93'
                }
                name={
                  achievement.unlockedTierCount > 0
                    ? 'checkmark'
                    : 'lock-closed'
                }
                size={compact ? 14 : 16}
              />
            </View>
          )}
        </View>
      </View>

      <View
        style={[
          styles.iconWrap,
          compact ? styles.compactIconWrap : styles.fullIconWrap,
          {
            backgroundColor: achievement.accentSoftColor,
          },
          achievement.unlockedTierCount === 0 ? styles.iconWrapLocked : null,
        ]}
      >
        <Ionicons
          color={achievement.unlockedTierCount > 0 ? achievement.accentColor : '#A1A1AA'}
          name={achievement.icon}
          size={compact ? 20 : 22}
        />
      </View>

      <Text
        numberOfLines={2}
        style={[styles.title, compact ? styles.compactTitle : styles.fullTitle]}
      >
        {achievement.title}
      </Text>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor:
                  achievement.unlockedTierCount > 0
                    ? achievement.accentColor
                    : '#8D8D93',
                width: `${achievement.progressPercent}%`,
              },
            ]}
          />
        </View>
        <Text numberOfLines={1} style={styles.progressCaption}>
          {progressLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
  },
  compactCard: {
    minHeight: 154,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: '100%',
  },
  compactIconWrap: {
    height: 42,
    width: 42,
  },
  compactTitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  fullCard: {
    aspectRatio: 0.64,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: '100%',
  },
  fullIconWrap: {
    height: 50,
    width: 50,
  },
  fullTitle: {
    fontSize: 15,
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 6,
  },
  iconWrapLocked: {
    backgroundColor: '#2A2A30',
  },
  lockedCard: {
    borderColor: '#26262B',
  },
  newPill: {
    backgroundColor: '#F4C542',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newPillText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  progressFill: {
    borderRadius: 999,
    height: 4,
  },
  progressCaption: {
    color: '#8D8D93',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  progressTrack: {
    backgroundColor: '#26262B',
    borderRadius: 999,
    height: 4,
    overflow: 'hidden',
  },
  progressWrap: {
    marginTop: 'auto',
    paddingTop: 10,
  },
  statusDot: {
    alignItems: 'center',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  statusDotLocked: {
    backgroundColor: '#26262B',
  },
  statusWrap: {
    alignItems: 'flex-end',
    minHeight: 22,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 10,
    minHeight: 34,
    textAlign: 'center',
  },
  topRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unlockedCard: {
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
});

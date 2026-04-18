import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type AchievementIconName = ComponentProps<typeof Ionicons>['name'];

export type AchievementCategory =
  | 'matches'
  | 'competitions'
  | 'training'
  | 'goals'
  | 'remote'
  | 'profile';

export type AchievementTierKey =
  | 'starter'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum';

export interface UserAchievementRecord {
  id: string;
  user_id: string;
  achievement_key: string;
  tier_key: string;
  category: AchievementCategory;
  unlocked_at: string;
  unlock_source: string;
  progress_snapshot?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AchievementTierDefinition {
  key: AchievementTierKey;
  label: string;
  threshold: number;
}

export interface AchievementTierStatus extends AchievementTierDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface AchievementCardData {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  categoryLabel: string;
  icon: AchievementIconName;
  accentColor: string;
  accentSoftColor: string;
  secret: boolean;
  hidden: boolean;
  currentValue: number;
  currentValueLabel: string;
  unlockedTierCount: number;
  totalTierCount: number;
  latestUnlockedTier: AchievementTierStatus | null;
  nextTier: AchievementTierStatus | null;
  progressPercent: number;
  progressText: string;
  completionText: string;
  tiers: AchievementTierStatus[];
}

export interface AchievementUnlockItem {
  id: string;
  achievementKey: string;
  title: string;
  tierKey: AchievementTierKey;
  tierLabel: string;
  category: AchievementCategory;
  categoryLabel: string;
  icon: AchievementIconName;
  accentColor: string;
  unlockedAt: string;
}

export interface AchievementCategorySection {
  key: AchievementCategory;
  title: string;
  description: string;
  unlockedTierCount: number;
  totalTierCount: number;
  completionPercentage: number;
  achievements: AchievementCardData[];
}

export interface AchievementDashboardData {
  totalUnlockedTierCount: number;
  totalTierCount: number;
  completionPercentage: number;
  sections: AchievementCategorySection[];
  highlightedAchievements: AchievementCardData[];
  recentUnlocks: AchievementUnlockItem[];
  newUnlocks: AchievementUnlockItem[];
}

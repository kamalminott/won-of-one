import { analytics } from '@/lib/analytics';
import { listCompetitionSummariesForUser } from '@/lib/clubCompetitionService';
import { matchService, userService } from '@/lib/database';
import { postgrestInsert, postgrestSelect } from '@/lib/postgrest';
import type { AppUser, Goal, SimpleMatch, WeeklySessionLog } from '@/types/database';
import type {
  AchievementCardData,
  AchievementCategory,
  AchievementCategorySection,
  AchievementDashboardData,
  AchievementIconName,
  AchievementTierDefinition,
  AchievementTierStatus,
  AchievementUnlockItem,
  UserAchievementRecord,
} from '@/types/achievements';

type AchievementMetrics = {
  totalMatches: number;
  totalWins: number;
  longestWinStreak: number;
  perfectBoutCount: number;
  competitionsJoined: number;
  competitionsCreated: number;
  competitionsFinalised: number;
  competitionMatchesLogged: number;
  trainingSessions: number;
  longestTrainingDayStreak: number;
  goalsSet: number;
  goalsCompleted: number;
  remoteMatches: number;
  profileCompleted: number;
};

type AchievementDefinition = {
  key: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: AchievementIconName;
  accentColor: string;
  accentSoftColor: string;
  tiers: AchievementTierDefinition[];
  unitSingular: string;
  unitPlural: string;
  unlockSource: string;
  secret?: boolean;
  getValue: (metrics: AchievementMetrics) => number;
};

const CATEGORY_METADATA: Record<
  AchievementCategory,
  { title: string; description: string }
> = {
  matches: {
    title: 'Matches',
    description: 'Build momentum through matches, wins, and streaks.',
  },
  competitions: {
    title: 'Competitions',
    description: 'Reward joining, organising, and scoring competitive bouts.',
  },
  training: {
    title: 'Training',
    description: 'Celebrate volume and consistency in training.',
  },
  goals: {
    title: 'Goals',
    description: 'Reward setting targets and actually finishing them.',
  },
  remote: {
    title: 'Remote',
    description: 'Encourage use of the remote scoring experience.',
  },
  profile: {
    title: 'Profile',
    description: 'Complete the basics so the rest of the app works better.',
  },
};

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    key: 'first_match',
    title: 'First Match Logged',
    description: 'Save 1 match in the app to unlock this achievement.',
    category: 'matches',
    icon: 'trophy',
    accentColor: '#8B5CF6',
    accentSoftColor: 'rgba(139, 92, 246, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'match',
    unitPlural: 'matches',
    unlockSource: 'match_saved',
    getValue: (metrics) => metrics.totalMatches,
  },
  {
    key: 'match_master',
    title: 'Match Master',
    description: 'Log matches in the app. Reach 10 for Bronze, 25 for Silver, and 50 for Gold.',
    category: 'matches',
    icon: 'medal',
    accentColor: '#8B5CF6',
    accentSoftColor: 'rgba(139, 92, 246, 0.16)',
    tiers: [
      { key: 'bronze', label: 'Bronze', threshold: 10 },
      { key: 'silver', label: 'Silver', threshold: 25 },
      { key: 'gold', label: 'Gold', threshold: 50 },
    ],
    unitSingular: 'match',
    unitPlural: 'matches',
    unlockSource: 'match_saved',
    getValue: (metrics) => metrics.totalMatches,
  },
  {
    key: 'first_win',
    title: 'First Win',
    description: 'Record your first win in a saved match.',
    category: 'matches',
    icon: 'ribbon',
    accentColor: '#8B5CF6',
    accentSoftColor: 'rgba(139, 92, 246, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'win',
    unitPlural: 'wins',
    unlockSource: 'match_saved',
    getValue: (metrics) => metrics.totalWins,
  },
  {
    key: 'victory_hunter',
    title: 'Victory Hunter',
    description: 'Win saved matches. Reach 10 wins for Bronze, 25 for Silver, and 50 for Gold.',
    category: 'matches',
    icon: 'podium',
    accentColor: '#8B5CF6',
    accentSoftColor: 'rgba(139, 92, 246, 0.16)',
    tiers: [
      { key: 'bronze', label: 'Bronze', threshold: 10 },
      { key: 'silver', label: 'Silver', threshold: 25 },
      { key: 'gold', label: 'Gold', threshold: 50 },
    ],
    unitSingular: 'win',
    unitPlural: 'wins',
    unlockSource: 'match_saved',
    getValue: (metrics) => metrics.totalWins,
  },
  {
    key: 'hot_streak',
    title: 'Hot Streak',
    description: 'Build a consecutive win streak. Reach 3 in a row for Bronze and 5 in a row for Silver.',
    category: 'matches',
    icon: 'flame',
    accentColor: '#8B5CF6',
    accentSoftColor: 'rgba(139, 92, 246, 0.16)',
    tiers: [
      { key: 'bronze', label: 'Bronze', threshold: 3 },
      { key: 'silver', label: 'Silver', threshold: 5 },
    ],
    unitSingular: 'win streak',
    unitPlural: 'win streak',
    unlockSource: 'match_saved',
    getValue: (metrics) => metrics.longestWinStreak,
  },
  {
    key: 'shutout_artist',
    title: 'Shutout Artist',
    description: 'Win a saved match without allowing your opponent to score a single touch.',
    category: 'matches',
    icon: 'sparkles',
    accentColor: '#A855F7',
    accentSoftColor: 'rgba(168, 85, 247, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'perfect bout',
    unitPlural: 'perfect bouts',
    unlockSource: 'match_saved',
    secret: true,
    getValue: (metrics) => metrics.perfectBoutCount,
  },
  {
    key: 'competitor',
    title: 'Competitor',
    description: 'Join competitions in the app. Join 1 for Bronze and 5 for Silver.',
    category: 'competitions',
    icon: 'flag',
    accentColor: '#F97316',
    accentSoftColor: 'rgba(249, 115, 22, 0.16)',
    tiers: [
      { key: 'bronze', label: 'Bronze', threshold: 1 },
      { key: 'silver', label: 'Silver', threshold: 5 },
    ],
    unitSingular: 'competition',
    unitPlural: 'competitions',
    unlockSource: 'competition_joined',
    getValue: (metrics) => metrics.competitionsJoined,
  },
  {
    key: 'organiser',
    title: 'Organiser',
    description: 'Create 1 competition in the app to unlock this achievement.',
    category: 'competitions',
    icon: 'construct',
    accentColor: '#F97316',
    accentSoftColor: 'rgba(249, 115, 22, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'competition created',
    unitPlural: 'competitions created',
    unlockSource: 'competition_created',
    getValue: (metrics) => metrics.competitionsCreated,
  },
  {
    key: 'closer',
    title: 'Closer',
    description: 'Finish and finalise a competition that you created.',
    category: 'competitions',
    icon: 'checkmark-done-circle',
    accentColor: '#F97316',
    accentSoftColor: 'rgba(249, 115, 22, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'competition finalised',
    unitPlural: 'competitions finalised',
    unlockSource: 'competition_finalised',
    getValue: (metrics) => metrics.competitionsFinalised,
  },
  {
    key: 'competition_scorer',
    title: 'Competition Scorer',
    description: 'Save 1 match inside a competition to unlock this achievement.',
    category: 'competitions',
    icon: 'stats-chart',
    accentColor: '#F97316',
    accentSoftColor: 'rgba(249, 115, 22, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'competition match',
    unitPlural: 'competition matches',
    unlockSource: 'competition_match_saved',
    getValue: (metrics) => metrics.competitionMatchesLogged,
  },
  {
    key: 'training_ground',
    title: 'Training Ground',
    description: 'Log training sessions in the app. Reach 1 for Bronze, 10 for Silver, and 30 for Gold.',
    category: 'training',
    icon: 'barbell',
    accentColor: '#14B8A6',
    accentSoftColor: 'rgba(20, 184, 166, 0.16)',
    tiers: [
      { key: 'bronze', label: 'Bronze', threshold: 1 },
      { key: 'silver', label: 'Silver', threshold: 10 },
      { key: 'gold', label: 'Gold', threshold: 30 },
    ],
    unitSingular: 'session',
    unitPlural: 'sessions',
    unlockSource: 'training_session_logged',
    getValue: (metrics) => metrics.trainingSessions,
  },
  {
    key: 'consistency_chain',
    title: 'Consistency Chain',
    description: 'Log a training session on 7 consecutive days to unlock Gold.',
    category: 'training',
    icon: 'calendar',
    accentColor: '#14B8A6',
    accentSoftColor: 'rgba(20, 184, 166, 0.16)',
    tiers: [{ key: 'gold', label: 'Gold', threshold: 7 }],
    unitSingular: 'day',
    unitPlural: 'days',
    unlockSource: 'training_session_logged',
    getValue: (metrics) => metrics.longestTrainingDayStreak,
  },
  {
    key: 'goal_setter',
    title: 'Goal Setter',
    description: 'Create your first goal in the app to unlock this achievement.',
    category: 'goals',
    icon: 'flag',
    accentColor: '#22C55E',
    accentSoftColor: 'rgba(34, 197, 94, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'goal set',
    unitPlural: 'goals set',
    unlockSource: 'goal_created',
    getValue: (metrics) => metrics.goalsSet,
  },
  {
    key: 'goal_crusher',
    title: 'Goal Crusher',
    description: 'Complete goals you created in the app. Complete 1 for Bronze and 5 for Silver.',
    category: 'goals',
    icon: 'checkmark-circle',
    accentColor: '#22C55E',
    accentSoftColor: 'rgba(34, 197, 94, 0.16)',
    tiers: [
      { key: 'bronze', label: 'Bronze', threshold: 1 },
      { key: 'silver', label: 'Silver', threshold: 5 },
    ],
    unitSingular: 'goal completed',
    unitPlural: 'goals completed',
    unlockSource: 'goal_completed',
    getValue: (metrics) => metrics.goalsCompleted,
  },
  {
    key: 'remote_contender',
    title: 'Remote Contender',
    description: 'Score matches using Remote. Complete 1 remote match for Bronze and 10 for Silver.',
    category: 'remote',
    icon: 'radio',
    accentColor: '#38BDF8',
    accentSoftColor: 'rgba(56, 189, 248, 0.16)',
    tiers: [
      { key: 'bronze', label: 'Bronze', threshold: 1 },
      { key: 'silver', label: 'Silver', threshold: 10 },
    ],
    unitSingular: 'remote match',
    unitPlural: 'remote matches',
    unlockSource: 'remote_match_saved',
    getValue: (metrics) => metrics.remoteMatches,
  },
  {
    key: 'profile_ready',
    title: 'Profile Ready',
    description: 'Fill in your full name, handedness, and preferred weapon in your profile.',
    category: 'profile',
    icon: 'person-circle',
    accentColor: '#EC4899',
    accentSoftColor: 'rgba(236, 72, 153, 0.16)',
    tiers: [{ key: 'starter', label: 'Unlocked', threshold: 1 }],
    unitSingular: 'profile',
    unitPlural: 'profiles',
    unlockSource: 'profile_updated',
    getValue: (metrics) => metrics.profileCompleted,
  },
];

const formatMetricLabel = (
  value: number,
  singular: string,
  plural: string
): string => {
  const unit = value === 1 ? singular : plural;
  return `${value} ${unit}`;
};

const calculateLongestWinStreak = (matches: SimpleMatch[]): number => {
  let longest = 0;
  let current = 0;

  matches.forEach((match) => {
    if (match.isWin) {
      current += 1;
      longest = Math.max(longest, current);
      return;
    }
    current = 0;
  });

  return longest;
};

const calculateLongestConsecutiveDayStreak = (
  sessions: WeeklySessionLog[]
): number => {
  const uniqueDays = Array.from(
    new Set(
      sessions
        .map((session) => session.session_date)
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));

  if (uniqueDays.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = new Date(uniqueDays[index - 1]);
    const next = new Date(uniqueDays[index]);
    const differenceMs = next.getTime() - previous.getTime();
    const differenceDays = Math.round(differenceMs / 86_400_000);

    if (differenceDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (differenceDays > 1) {
      current = 1;
    }
  }

  return longest;
};

const buildMetrics = (
  user: AppUser | null,
  matches: SimpleMatch[],
  goals: Goal[],
  sessions: WeeklySessionLog[],
  competitionIds: {
    joined: Set<string>;
    created: Set<string>;
    finalised: Set<string>;
  }
): AchievementMetrics => {
  const totalWins = matches.filter((match) => match.isWin).length;
  const competitionMatchesLogged = matches.filter((match) => Boolean(match.competitionId)).length;
  const perfectBoutCount = matches.filter(
    (match) => match.isWin && match.opponentScore === 0
  ).length;
  const remoteMatches = matches.filter((match) => match.source === 'remote').length;
  const goalsCompleted = goals.filter((goal) => goal.is_completed).length;
  const profileCompleted =
    user?.name?.trim() && user?.handedness?.trim() && user?.preferred_weapon?.trim()
      ? 1
      : 0;

  return {
    totalMatches: matches.length,
    totalWins,
    longestWinStreak: calculateLongestWinStreak(matches),
    perfectBoutCount,
    competitionsJoined: competitionIds.joined.size,
    competitionsCreated: competitionIds.created.size,
    competitionsFinalised: competitionIds.finalised.size,
    competitionMatchesLogged,
    trainingSessions: sessions.length,
    longestTrainingDayStreak: calculateLongestConsecutiveDayStreak(sessions),
    goalsSet: goals.length,
    goalsCompleted,
    remoteMatches,
    profileCompleted,
  };
};

const mapUnlockRows = (
  rows: UserAchievementRecord[]
): Map<string, UserAchievementRecord> => {
  const map = new Map<string, UserAchievementRecord>();
  rows.forEach((row) => {
    map.set(`${row.achievement_key}:${row.tier_key}`, row);
  });
  return map;
};

const buildAchievementCard = (
  definition: AchievementDefinition,
  metrics: AchievementMetrics,
  unlockMap: Map<string, UserAchievementRecord>
): AchievementCardData => {
  const currentValue = definition.getValue(metrics);
  const tiers: AchievementTierStatus[] = definition.tiers.map((tier) => {
    const row = unlockMap.get(`${definition.key}:${tier.key}`);
    return {
      ...tier,
      unlocked: Boolean(row),
      unlockedAt: row?.unlocked_at ?? null,
    };
  });

  const unlockedTiers = tiers.filter((tier) => tier.unlocked);
  const latestUnlockedTier =
    unlockedTiers.length > 0 ? unlockedTiers[unlockedTiers.length - 1] : null;
  const nextTier = tiers.find((tier) => !tier.unlocked) ?? null;
  const previousThreshold = latestUnlockedTier?.threshold ?? 0;

  let progressPercent = 100;
  if (nextTier) {
    const progressRange = Math.max(1, nextTier.threshold - previousThreshold);
    const progressValue = Math.max(0, currentValue - previousThreshold);
    progressPercent = Math.max(
      0,
      Math.min(100, Math.round((progressValue / progressRange) * 100))
    );
  }

  const progressText = nextTier
    ? `${formatMetricLabel(
        currentValue,
        definition.unitSingular,
        definition.unitPlural
      )} / ${formatMetricLabel(
        nextTier.threshold,
        definition.unitSingular,
        definition.unitPlural
      )}`
    : 'All tiers unlocked';

  return {
    key: definition.key,
    title: definition.title,
    description: definition.description,
    category: definition.category,
    categoryLabel: CATEGORY_METADATA[definition.category].title,
    icon: definition.icon,
    accentColor: definition.accentColor,
    accentSoftColor: definition.accentSoftColor,
    secret: definition.secret ?? false,
    hidden: Boolean(definition.secret) && unlockedTiers.length === 0,
    currentValue,
    currentValueLabel: formatMetricLabel(
      currentValue,
      definition.unitSingular,
      definition.unitPlural
    ),
    unlockedTierCount: unlockedTiers.length,
    totalTierCount: tiers.length,
    latestUnlockedTier,
    nextTier,
    progressPercent,
    progressText,
    completionText:
      unlockedTiers.length === tiers.length
        ? 'Complete'
        : `${unlockedTiers.length}/${tiers.length} tiers unlocked`,
    tiers,
  };
};

const buildUnlockItems = (
  rows: UserAchievementRecord[],
  cardMap: Map<string, AchievementCardData>
): AchievementUnlockItem[] =>
  rows
    .map((row) => {
      const card = cardMap.get(row.achievement_key);
      if (!card) return null;
      const tier = card.tiers.find((item) => item.key === row.tier_key);
      if (!tier) return null;
      return {
        id: row.id,
        achievementKey: card.key,
        title: card.title,
        tierKey: tier.key,
        tierLabel: tier.label,
        category: card.category,
        categoryLabel: card.categoryLabel,
        icon: card.icon,
        accentColor: card.accentColor,
        unlockedAt: row.unlocked_at,
      };
    })
    .filter((item): item is AchievementUnlockItem => item !== null)
    .sort((left, right) => right.unlockedAt.localeCompare(left.unlockedAt));

const chooseHighlights = (
  cards: AchievementCardData[],
  recentUnlocks: AchievementUnlockItem[]
): AchievementCardData[] => {
  const cardMap = new Map(cards.map((card) => [card.key, card]));
  const highlights: AchievementCardData[] = [];
  const seen = new Set<string>();

  recentUnlocks.forEach((unlock) => {
    const card = cardMap.get(unlock.achievementKey);
    if (!card || seen.has(card.key) || card.hidden) return;
    highlights.push(card);
    seen.add(card.key);
  });

  cards
    .filter((card) => !card.hidden && !seen.has(card.key))
    .sort((left, right) => {
      if (left.progressPercent !== right.progressPercent) {
        return right.progressPercent - left.progressPercent;
      }
      return right.currentValue - left.currentValue;
    })
    .slice(0, Math.max(0, 3 - highlights.length))
    .forEach((card) => {
      highlights.push(card);
      seen.add(card.key);
    });

  return highlights.slice(0, 3);
};

const fetchAllGoals = async (
  userId: string,
  accessToken?: string | null
): Promise<Goal[]> => {
  const { data, error } = await postgrestSelect<Goal>(
    'goal',
    {
      select:
        'goal_id,user_id,category,description,target_value,unit,deadline,is_completed,current_value,tracking_mode,linked_session_id,is_active,is_failed,created_at,updated_at,match_window,starting_match_count',
      user_id: `eq.${userId}`,
      order: 'created_at.asc',
    },
    { accessToken }
  );

  if (error) {
    throw new Error(error.message || 'Failed to load goals');
  }

  return data ?? [];
};

const fetchAllSessions = async (
  userId: string,
  accessToken?: string | null
): Promise<WeeklySessionLog[]> => {
  const { data, error } = await postgrestSelect<WeeklySessionLog>(
    'weekly_session_log',
    {
      select: 'session_id,user_id,activity_type,session_date,duration_minutes,notes,created_at',
      user_id: `eq.${userId}`,
      order: 'session_date.asc',
    },
    { accessToken }
  );

  if (error) {
    throw new Error(error.message || 'Failed to load training sessions');
  }

  return data ?? [];
};

const fetchUnlockRows = async (
  userId: string,
  accessToken?: string | null
): Promise<UserAchievementRecord[]> => {
  const { data, error } = await postgrestSelect<UserAchievementRecord>(
    'user_achievements',
    {
      select:
        'id,user_id,achievement_key,tier_key,category,unlocked_at,unlock_source,progress_snapshot,created_at,updated_at',
      user_id: `eq.${userId}`,
      order: 'unlocked_at.desc',
    },
    { accessToken }
  );

  if (error) {
    throw new Error(error.message || 'Failed to load achievements');
  }

  return data ?? [];
};

const syncAchievementUnlocks = async (
  userId: string,
  cards: AchievementCardData[],
  definitionsByKey: Map<string, AchievementDefinition>,
  unlockMap: Map<string, UserAchievementRecord>,
  accessToken?: string | null,
  syncSource: string = 'achievement_sync'
): Promise<UserAchievementRecord[]> => {
  const nowIso = new Date().toISOString();
  const pendingRows = cards.flatMap((card) => {
    const definition = definitionsByKey.get(card.key);
    if (!definition) return [];

    return card.tiers
      .filter(
        (tier) =>
          card.currentValue >= tier.threshold &&
          !unlockMap.has(`${card.key}:${tier.key}`)
      )
      .map((tier) => ({
        user_id: userId,
        achievement_key: card.key,
        tier_key: tier.key,
        category: card.category,
        unlocked_at: nowIso,
        unlock_source: definition.unlockSource,
        progress_snapshot: {
          current_value: card.currentValue,
          threshold: tier.threshold,
          sync_source: syncSource,
        },
      }));
  });

  if (pendingRows.length === 0) {
    return [];
  }

  const { data, error } = await postgrestInsert<UserAchievementRecord>(
    'user_achievements',
    pendingRows,
    {
      select:
        'id,user_id,achievement_key,tier_key,category,unlocked_at,unlock_source,progress_snapshot,created_at,updated_at',
      on_conflict: 'user_id,achievement_key,tier_key',
    },
    {
      accessToken,
      prefer: 'return=representation, resolution=ignore-duplicates',
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to sync achievements');
  }

  const insertedRows = data ?? [];
  insertedRows.forEach((row) => {
    const card = cards.find((item) => item.key === row.achievement_key);
    const tier = card?.tiers.find((item) => item.key === row.tier_key);

    analytics.capture('achievement_unlocked', {
      achievement_key: row.achievement_key,
      tier_key: row.tier_key,
      tier_label: tier?.label ?? row.tier_key,
      category: row.category,
      unlock_source: row.unlock_source,
      sync_source: syncSource,
      is_retroactive: true,
      current_value: card?.currentValue ?? 0,
      threshold: tier?.threshold ?? null,
    });
  });

  return insertedRows;
};

export const achievementService = {
  async loadDashboard(params: {
    userId: string;
    accessToken?: string | null;
    userName?: string | null;
    syncSource?: string;
  }): Promise<AchievementDashboardData> {
    const { userId, accessToken, userName, syncSource = 'achievement_sync' } = params;

    const [user, matches, goals, sessions, competitionSummaries, existingUnlocks] =
      await Promise.all([
        userService.getUserById(userId, accessToken),
        matchService.getRecentMatches(userId, 2000, userName ?? undefined, accessToken),
        fetchAllGoals(userId, accessToken),
        fetchAllSessions(userId, accessToken),
        listCompetitionSummariesForUser(userId),
        fetchUnlockRows(userId, accessToken),
      ]);

    const joinedCompetitionIds = new Set<string>();
    const createdCompetitionIds = new Set<string>();
    const finalisedCompetitionIds = new Set<string>();

    [...competitionSummaries.active, ...competitionSummaries.past, ...competitionSummaries.archived].forEach(
      (competition) => {
        joinedCompetitionIds.add(competition.id);
        if (competition.role === 'organiser') {
          createdCompetitionIds.add(competition.id);
          if (competition.status === 'finalised') {
            finalisedCompetitionIds.add(competition.id);
          }
        }
      }
    );

    const metrics = buildMetrics(user, matches, goals, sessions, {
      joined: joinedCompetitionIds,
      created: createdCompetitionIds,
      finalised: finalisedCompetitionIds,
    });

    const definitionsByKey = new Map(
      ACHIEVEMENT_DEFINITIONS.map((definition) => [definition.key, definition])
    );
    let unlockMap = mapUnlockRows(existingUnlocks);
    let cards = ACHIEVEMENT_DEFINITIONS.map((definition) =>
      buildAchievementCard(definition, metrics, unlockMap)
    );

    const newUnlockRows = await syncAchievementUnlocks(
      userId,
      cards,
      definitionsByKey,
      unlockMap,
      accessToken,
      syncSource
    );

    if (newUnlockRows.length > 0) {
      newUnlockRows.forEach((row) => {
        unlockMap.set(`${row.achievement_key}:${row.tier_key}`, row);
      });
      cards = ACHIEVEMENT_DEFINITIONS.map((definition) =>
        buildAchievementCard(definition, metrics, unlockMap)
      );
    }

    const cardMap = new Map(cards.map((card) => [card.key, card]));
    const recentUnlocks = buildUnlockItems(
      [...newUnlockRows, ...existingUnlocks],
      cardMap
    ).slice(0, 6);
    const newUnlocks = buildUnlockItems(newUnlockRows, cardMap);

    const sections: AchievementCategorySection[] = (
      Object.keys(CATEGORY_METADATA) as AchievementCategory[]
    ).map((category) => {
      const achievements = cards
        .filter((card) => card.category === category && !card.hidden)
        .sort((left, right) => {
          if (left.unlockedTierCount !== right.unlockedTierCount) {
            return right.unlockedTierCount - left.unlockedTierCount;
          }
          return right.progressPercent - left.progressPercent;
        });

      const unlockedTierCount = achievements.reduce(
        (sum, achievement) => sum + achievement.unlockedTierCount,
        0
      );
      const totalTierCount = achievements.reduce(
        (sum, achievement) => sum + achievement.totalTierCount,
        0
      );

      return {
        key: category,
        title: CATEGORY_METADATA[category].title,
        description: CATEGORY_METADATA[category].description,
        unlockedTierCount,
        totalTierCount,
        completionPercentage:
          totalTierCount > 0 ? Math.round((unlockedTierCount / totalTierCount) * 100) : 0,
        achievements,
      };
    });

    const totalUnlockedTierCount = sections.reduce(
      (sum, section) => sum + section.unlockedTierCount,
      0
    );
    const totalTierCount = sections.reduce(
      (sum, section) => sum + section.totalTierCount,
      0
    );

    return {
      totalUnlockedTierCount,
      totalTierCount,
      completionPercentage:
        totalTierCount > 0
          ? Math.round((totalUnlockedTierCount / totalTierCount) * 100)
          : 0,
      sections,
      highlightedAchievements: chooseHighlights(cards, recentUnlocks),
      recentUnlocks,
      newUnlocks,
    };
  },
};

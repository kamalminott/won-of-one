import { SimpleMatch } from '@/types/database';
import React from 'react';
import { MatchCarousel, MatchCarouselItem } from './MatchCarousel';

interface RecentMatchesProps {
  matches: SimpleMatch[];
  onViewAll: () => void;
  onSwipeRight?: () => void;
  userName?: string;
  userProfileImage?: string | null;
  hasActiveGoals?: boolean;
  maxItems?: number;
}

export const RecentMatches: React.FC<RecentMatchesProps> = ({
  matches,
  onViewAll,
  userName,
  userProfileImage,
  hasActiveGoals = true,
  maxItems = 3,
}) => {
  const parseDate = (value: string): number => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const competitionMap = new Map<
    string,
    {
      id: string;
      name: string;
      date: string;
      weaponType?: string | null;
      wins: number;
      losses: number;
      placement?: number | null;
      fieldSize?: number | null;
    }
  >();

  matches.forEach(match => {
    if (!match.competitionId) return;

    const existing = competitionMap.get(match.competitionId);
    const isWin = match.isWin;
    const date = match.competitionDate || match.date;
    const name = match.competitionName || 'Competition';

    if (!existing) {
      competitionMap.set(match.competitionId, {
        id: match.competitionId,
        name,
        date,
        weaponType: match.competitionWeaponType ?? null,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        placement: match.competitionPlacement ?? null,
        fieldSize: match.competitionFieldSize ?? null,
      });
      return;
    }

    existing.wins += isWin ? 1 : 0;
    existing.losses += isWin ? 0 : 1;

    if (!existing.weaponType && match.competitionWeaponType) {
      existing.weaponType = match.competitionWeaponType;
    }
    if (!existing.placement && match.competitionPlacement) {
      existing.placement = match.competitionPlacement;
    }
    if (!existing.fieldSize && match.competitionFieldSize) {
      existing.fieldSize = match.competitionFieldSize;
    }
  });

  const competitionItems: MatchCarouselItem[] = Array.from(competitionMap.values())
    .sort((a, b) => parseDate(b.date) - parseDate(a.date))
    .slice(0, 2)
    .map((competition) => ({
      type: 'competition',
      id: `competition-${competition.id}`,
      date: competition.date,
      competitionId: competition.id,
      competitionName: competition.name,
      competitionWeaponType: competition.weaponType ?? null,
      wins: competition.wins,
      losses: competition.losses,
      placement: competition.placement ?? null,
      fieldSize: competition.fieldSize ?? null,
    }));

  const matchItems: MatchCarouselItem[] = matches.map(match => ({
    type: 'match',
    id: match.id,
    date: match.date,
    isWin: match.isWin,
    youScore: match.youScore,
    opponentScore: match.opponentScore,
    opponentName: match.opponentName,
    source: match.source,
    notes: match.notes,
    matchType: match.matchType,
  }));

  const carouselItems = [...competitionItems, ...matchItems]
    .sort((a, b) => {
      const diff = parseDate(b.date) - parseDate(a.date);
      if (diff !== 0) return diff;
      if (a.type === 'competition' && b.type === 'match') return -1;
      if (a.type === 'match' && b.type === 'competition') return 1;
      return 0;
    })
    .slice(0, maxItems);

  return (
    <MatchCarousel
      items={carouselItems}
      onViewAll={onViewAll}
      userName={userName}
      userProfileImage={userProfileImage}
      hasActiveGoals={hasActiveGoals}
      maxItems={maxItems}
    />
  );
};

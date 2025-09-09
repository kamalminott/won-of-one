import { SimpleMatch } from '@/types/database';
import React from 'react';
import { MatchCarousel } from './MatchCarousel';

interface RecentMatchesProps {
  matches: SimpleMatch[];
  onViewAll: () => void;
  onAddNewMatch?: () => void;
  onSwipeRight?: () => void;
}

export const RecentMatches: React.FC<RecentMatchesProps> = ({
  matches,
  onViewAll,
  onAddNewMatch,
}) => {
  // Convert SimpleMatch to CarouselItem format
  const carouselItems = matches.map(match => ({
    id: match.id,
    date: match.date,
    isWin: match.isWin,
    youScore: match.youScore,
    opponentScore: match.opponentScore,
    opponentName: match.opponentName,
  }));

  return (
    <MatchCarousel
      items={carouselItems}
      onViewAll={onViewAll}
      onAddNewMatch={onAddNewMatch || (() => {})}
    />
  );
};
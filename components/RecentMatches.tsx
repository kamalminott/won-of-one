import { SimpleMatch } from '@/types/database';
import React from 'react';
import { MatchCarousel } from './MatchCarousel';

interface RecentMatchesProps {
  matches: SimpleMatch[];
  onViewAll: () => void;
  onSwipeRight?: () => void;
  userName?: string;
  userProfileImage?: string | null;
}

export const RecentMatches: React.FC<RecentMatchesProps> = ({
  matches,
  onViewAll,
  userName,
  userProfileImage,
}) => {
  // Convert SimpleMatch to CarouselItem format (already ordered by most recent first from database)
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
      userName={userName}
      userProfileImage={userProfileImage}
    />
  );
};
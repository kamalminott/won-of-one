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
  // Convert SimpleMatch to CarouselItem format and reverse to show most recent first
  const carouselItems = matches.map(match => ({
    id: match.id,
    date: match.date,
    isWin: match.isWin,
    youScore: match.youScore,
    opponentScore: match.opponentScore,
    opponentName: match.opponentName,
  })).reverse();

  return (
    <MatchCarousel
      items={carouselItems}
      onViewAll={onViewAll}
      userName={userName}
      userProfileImage={userProfileImage}
    />
  );
};
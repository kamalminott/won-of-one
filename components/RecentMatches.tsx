import { SimpleMatch } from '@/types/database';
import React from 'react';
import { MatchCarousel } from './MatchCarousel';

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
  // Convert SimpleMatch to CarouselItem format (already ordered by most recent first from database)
  const carouselItems = matches.slice(0, maxItems).map(match => {
    return {
      id: match.id,
      date: match.date,
      isWin: match.isWin,
      youScore: match.youScore,
      opponentScore: match.opponentScore,
      opponentName: match.opponentName,
      source: match.source, // Pass through source field
      notes: match.notes, // Pass through notes field
      matchType: match.matchType, // Pass through match type from database
    };
  });

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

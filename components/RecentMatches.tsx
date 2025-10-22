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
  const carouselItems = matches.map(match => {
    console.log('🔄 Converting match to carousel item:', { 
      id: match.id, 
      source: match.source, 
      opponentName: match.opponentName 
    });
    return {
      id: match.id,
      date: match.date,
      isWin: match.isWin,
      youScore: match.youScore,
      opponentScore: match.opponentScore,
      opponentName: match.opponentName,
      source: match.source, // Pass through source field
      notes: match.notes, // Pass through notes field
    };
  });

  return (
    <MatchCarousel
      items={carouselItems}
      onViewAll={onViewAll}
      userName={userName}
      userProfileImage={userProfileImage}
    />
  );
};
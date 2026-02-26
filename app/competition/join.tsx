import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function CompetitionJoinDeepLinkRedirect() {
  const params = useLocalSearchParams<{
    competition_id?: string;
    competitionId?: string;
    join_code?: string;
    joinCode?: string;
  }>();

  const competitionId =
    typeof params.competition_id === 'string'
      ? params.competition_id
      : typeof params.competitionId === 'string'
        ? params.competitionId
        : undefined;

  const joinCode =
    typeof params.join_code === 'string'
      ? params.join_code
      : typeof params.joinCode === 'string'
        ? params.joinCode
        : undefined;

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/competitions/join',
        params: {
          ...(competitionId ? { competition_id: competitionId } : {}),
          ...(joinCode ? { join_code: joinCode } : {}),
        },
      }}
    />
  );
}

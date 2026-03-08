import { Stack } from 'expo-router';
import React from 'react';

export default function CompetitionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="join" />
      <Stack.Screen name="overview" />
      <Stack.Screen name="participants-roles" />
      <Stack.Screen name="poules" />
      <Stack.Screen name="rankings" />
      <Stack.Screen name="de-tableau" />
      <Stack.Screen name="final-standings" />
      <Stack.Screen name="manual-score-entry" />
    </Stack>
  );
}

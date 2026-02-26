import { Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="remote"
        options={{
          title: 'Remote',
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          href: null, // Hidden from tab bar for now
        }}
      />
      <Tabs.Screen
        name="competitions"
        options={{
          title: 'Competition',
        }}
      />
      <Tabs.Screen
        name="mindset"
        options={{
          title: 'Mindset',
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          href: null, // This hides the tab from the tab bar
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

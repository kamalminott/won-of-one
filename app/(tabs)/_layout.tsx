import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';

export default function TabLayout() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.red.accent,
        tabBarInactiveTintColor: Colors.gray.light,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            backgroundColor: 'rgba(31, 41, 55, 0.9)',
            borderTopWidth: 0,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: height * 0.11,
            paddingBottom: height * 0.025,
          },
          default: {
            backgroundColor: 'rgba(31, 41, 55, 0.9)',
            borderTopWidth: 0,
            position: 'absolute',
            bottom: insets.bottom,
            left: 0,
            right: 0,
            height: height * 0.09,
            paddingBottom: height * 0.015,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={height * 0.035} 
              name="house.fill" 
              color={focused ? Colors.red.accent : color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="remote"
        options={{
          title: 'Remote',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={height * 0.035} 
              name="logo-game-controller-a" 
              color={focused ? Colors.red.accent : color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={height * 0.035} 
              name="figure.run" 
              color={focused ? Colors.red.accent : color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mindset"
        options={{
          title: 'Mindset',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={height * 0.035} 
              name="brain.head.profile" 
              color={focused ? Colors.red.accent : color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: 'Diary',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={height * 0.035} 
              name="book.fill" 
              color={focused ? Colors.red.accent : color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={height * 0.035} 
              name="person.fill" 
              color={focused ? Colors.red.accent : color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}

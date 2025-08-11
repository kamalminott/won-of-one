import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';

export default function TabLayout() {

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
            height: 90,
            paddingBottom: 20,
          },
          default: {
            backgroundColor: 'rgba(31, 41, 55, 0.9)',
            borderTopWidth: 0,
            height: 70,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={28} 
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
              size={28} 
              name="gamecontroller.fill" 
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
              size={28} 
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
              size={28} 
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
              size={28} 
              name="book.fill" 
              color={focused ? Colors.red.accent : color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}

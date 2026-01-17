import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Entypo from 'react-native-vector-icons/Entypo';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { analytics } from '@/lib/analytics';

const iconMap = {
  'home': Entypo,
  'settings-remote': MaterialIcons,
  'shield-sword': MaterialCommunityIcons,
  'brain': MaterialCommunityIcons,
  'person': Ionicons,
};

const iconNames = {
  'home': 'home',
  'settings-remote': 'settings-remote',
  'shield-sword': 'shield-sword',
  'brain': 'brain',
  'person': 'person',
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const currentTab = state.routes[state.index]?.name;

  return (
    <View style={[styles.tabBar, { 
      height: height * 0.08 + insets.bottom,
      paddingBottom: insets.bottom,
    }]}>
      {state.routes
        .filter((route) => route.name !== 'diary') // Hide diary tab
        .map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
            analytics.capture('tab_switched', {
              from_tab: currentTab,
              to_tab: route.name,
            });
          }

          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        };

        const getIconComponent = (routeName: string) => {
          switch (routeName) {
            case 'index':
              return { Component: Entypo, name: 'home' };
            case 'remote':
              return { Component: MaterialIcons, name: 'settings-remote' };
            case 'training':
              return { Component: MaterialCommunityIcons, name: 'shield-sword' };
            case 'mindset':
              return { Component: MaterialCommunityIcons, name: 'brain' };
            case 'profile':
              return { Component: Ionicons, name: 'person' };
            default:
              return { Component: Entypo, name: 'home' };
          }
        };

        const { Component, name } = getIconComponent(route.name);
        const iconColor = isFocused ? 'rgba(255, 118, 117, 1)' : 'rgba(143, 143, 143, 1)';
        const textColor = isFocused ? 'rgba(255, 118, 117, 1)' : 'rgba(143, 143, 143, 1)';

        return (
          <PlatformPressable
            key={route.key}
            onPress={onPress}
            style={styles.tabButton}
          >
            <View style={styles.tabContent}>
              {/* Indicator bar above icon */}
              {isFocused && (
                <View style={[styles.indicator, { 
                  width: width * 0.05, // 20px equivalent
                  height: height * 0.004, // 3px equivalent
                  borderRadius: width * 0.025, // 60px equivalent
                  top: -height * 0.020, // Dynamic positioning based on screen height
                }]} />
              )}
              
              {/* Icon */}
              <Component
                name={name}
                size={height * 0.023}
                color={iconColor}
              />
              
              {/* Text */}
              <Text style={[styles.tabText, { color: textColor }]}>
                {options.title}
              </Text>
            </View>
          </PlatformPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(19, 19, 19, 1)',
    borderTopWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  indicator: {
    backgroundColor: '#FF7675',
    position: 'absolute',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
    textAlign: 'center',
  },
});

/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
  // New colors for Won-Of-One app
  purple: {
    primary: '#8B5CF6',
    light: '#A78BFA',
    gradient: ['#8B5CF6', '#C4B5FD'],
  },
  pink: {
    light: '#FCE7F3',
  },
  blue: {
    light: '#DBEAFE',
  },
  red: {
    light: '#FEE2E2',
    accent: '#EF4444',
  },
  yellow: {
    accent: '#F59E0B',
  },
  gray: {
    dark: '#1F2937',
    medium: '#374151',
    light: '#6B7280',
  },
};

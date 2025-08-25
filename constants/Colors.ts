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
    dark: '#4C1D95',
    accent: '#C4B5FD',
    gradient: ['#8B5CF6', '#C4B5FD'],
  },
  glassyGradient: {
    colors: ['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)'] as const,
    borderColor: '#D2A3F0',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  gradientButton: {
    colors: ['#6C5CE7', '#5741FF'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  timerBackground: {
    colors: ['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    borderColors: ['#D2A3F0', '#989DFA'] as const,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
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
  green: {
    accent: '#10B981',
  },
  yellow: {
    accent: '#F59E0B',
  },
  orange: {
    accent: '#F97316',
  },
  gray: {
    dark: '#1F2937',
    medium: '#374151',
    light: '#6B7280',
  },
};

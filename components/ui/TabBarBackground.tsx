import { View } from 'react-native';

// This provides a dark background for Android and web
export default function TabBarBackground() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(19, 19, 19, 1)',
      }}
    />
  );
}

export function useBottomTabOverflow() {
  return 0;
}

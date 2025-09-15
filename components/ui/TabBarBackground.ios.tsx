import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';

export default function BlurTabBarBackground() {
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
  return useBottomTabBarHeight();
}

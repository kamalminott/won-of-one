import { useEffect, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Centralized multipliers for global control
const PADDING_MULTIPLIER = 0.5;
const MARGIN_MULTIPLIER = 0.3;

const useDynamicLayout = () => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const aspectRatio = height / width;

  // Convert insets to percentages for consistent scaling
  const safeAreaAdjustment = {
    top: insets.top / height,
    bottom: insets.bottom / height,
    left: insets.left / width,
    right: insets.right / width,
  };

  // Aspect ratio classifications
  const aspectAdjustment = {
    isWide: aspectRatio < 2.0,      // iPhone X style
    isTall: aspectRatio > 2.1,      // Very tall screens
    isStandard: aspectRatio >= 2.0 && aspectRatio <= 2.1,
  };

  // Helper function to safely handle undefined values
  const safeValue = (value: number | undefined) => value || 0;

  // Dynamic adjustment functions
  const adjustPadding = (basePadding: number, direction: 'top' | 'bottom' | 'left' | 'right') => {
    return basePadding + (safeAreaAdjustment[direction] * PADDING_MULTIPLIER);
  };

  const adjustMargin = (baseMargin: number, direction: 'top' | 'bottom' | 'left' | 'right') => {
    return baseMargin + (safeAreaAdjustment[direction] * MARGIN_MULTIPLIER);
  };

  // Platform-specific adjustments
  const getPlatformAdjustments = () => {
    if (Platform.OS === 'ios') {
      return {
        bottomNavOffset: insets.bottom > 0 ? insets.bottom * 0.1 : 0,
        topOffset: insets.top > 0 ? insets.top * 0.05 : 0,
      };
    } else {
      // Android
      return {
        bottomNavOffset: insets.bottom > 0 ? insets.bottom * 0.15 : 0,
        topOffset: insets.top > 0 ? insets.top * 0.03 : 0,
      };
    }
  };

  // Development logging for debugging
  useEffect(() => {
    if (__DEV__) {
      console.log('🔧 Dynamic Layout Debug:');
      console.log('  Insets:', { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right });
      console.log('  Aspect Ratio:', aspectRatio.toFixed(2));
      console.log('  Screen:', { width, height });
      console.log('  Platform:', Platform.OS);
      console.log('  Safe Area Adjustments:', safeAreaAdjustment);
    }
  }, [insets, aspectRatio, width, height]);

  // Memoize the return value for performance
  const layoutData = useMemo(() => ({
    width,
    height,
    insets,
    safeAreaAdjustment,
    aspectAdjustment,
    adjustPadding,
    adjustMargin,
    getPlatformAdjustments,
    // Helper for creating responsive values
    responsive: {
      width: (percentage: number) => width * percentage,
      height: (percentage: number) => height * percentage,
      fontSize: (baseSize: number) => Math.max(baseSize, width * 0.03), // Minimum readable font size
    }
  }), [width, height, insets, aspectRatio]);

  return layoutData;
};

export default useDynamicLayout;

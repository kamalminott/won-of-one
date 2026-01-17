import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';

const buildOnceKey = (eventName: string, userId?: string | null) => {
  const userScope = userId ? `user:${userId}` : 'anon';
  return `analytics_once:${userScope}:${eventName}`;
};

export const trackOnce = async (
  eventName: string,
  props?: Record<string, any>,
  userId?: string | null
) => {
  try {
    const key = buildOnceKey(eventName, userId);
    const existing = await AsyncStorage.getItem(key);
    if (existing === 'true') return;
    analytics.capture(eventName, props);
    await AsyncStorage.setItem(key, 'true');
  } catch (error) {
    console.warn('⚠️ Failed to track once event:', eventName, error);
  }
};

export const trackFeatureFirstUse = async (
  featureName: string,
  props?: Record<string, any>,
  userId?: string | null
) => {
  const eventName = `feature_first_use_${featureName}`;
  return trackOnce(eventName, props, userId);
};

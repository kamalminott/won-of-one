import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from './analytics';

const buildOnceKey = (eventName: string, userId?: string | null) => {
  const userScope = userId ? `user:${userId}` : 'anon';
  return `analytics_once:${userScope}:${eventName}`;
};

const buildDailyKey = (eventName: string, dateKey: string, userId?: string | null) => {
  const userScope = userId ? `user:${userId}` : 'anon';
  return `analytics_daily:${userScope}:${eventName}:${dateKey}`;
};

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export const trackOncePerDay = async (
  eventName: string,
  props?: Record<string, any>,
  userId?: string | null,
  dateKey: string = getLocalDateKey()
) => {
  try {
    const key = buildDailyKey(eventName, dateKey, userId);
    const existing = await AsyncStorage.getItem(key);
    if (existing === 'true') return;
    analytics.capture(eventName, props);
    await AsyncStorage.setItem(key, 'true');
  } catch (error) {
    console.warn('⚠️ Failed to track daily event:', eventName, error);
  }
};

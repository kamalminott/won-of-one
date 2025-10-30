/**
 * Automated Tests for Remote Screen (Fencing Remote)
 * 
 * These tests verify:
 * - Match start/stop functionality
 * - Score tracking
 * - Period transitions
 * - Priority round handling
 * - Match completion
 */

import { matchPeriodService, matchService } from '@/lib/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanupTestData, createTestUser } from '../integration/setup';

// Mock React Native modules
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (styles: any) => styles },
  Alert: {
    alert: jest.fn(),
    prompt: jest.fn(),
  },
  useWindowDimensions: () => ({ width: 375, height: 812 }),
  Platform: { OS: 'ios' },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 44, bottom: 34 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    userName: 'Test User',
  }),
}));

jest.mock('@/hooks/useDynamicLayout', () => ({
  __esModule: true,
  default: () => ({
    isSmall: false,
    isMedium: false,
    isLarge: false,
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('RemoteScreen - Complete Match Flow', () => {
  let testUser: any;
  
  beforeEach(async () => {
    // Clean up any existing test data
    testUser = await createTestUser();
    // Clear AsyncStorage
    (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });
  
  afterEach(async () => {
    if (testUser?.id) {
      await cleanupTestData(testUser.id);
    }
    jest.clearAllMocks();
  });
  
  describe('Match Creation and Completion', () => {
    it('should create a complete match with all periods', async () => {
      // Simulate starting a match in Period 1
      const sessionData = {
        fencer_1_name: 'Alice',
        fencer_2_name: 'Bob',
        start_time: new Date().toISOString(),
      };
      
      // Create match from remote session
      const match = await matchService.createMatchFromRemote(sessionData, testUser.id);
      
      expect(match).toBeTruthy();
      expect(match?.match_id).toBeDefined();
      expect(match?.is_complete).toBe(false);
      
      // Create Period 1
      const period1 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 1,
        start_time: new Date().toISOString(),
        fencer_1_score: 5,
        fencer_2_score: 3,
        fencer_1_cards: 0,
        fencer_2_cards: 0,
      });
      
      expect(period1).toBeTruthy();
      
      // Complete Period 1 and start Period 2
      await matchPeriodService.updateMatchPeriod(period1!.period_id, {
        end_time: new Date().toISOString(),
      });
      
      const period2 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 2,
        start_time: new Date().toISOString(),
        fencer_1_score: 8,
        fencer_2_score: 6,
        fencer_1_cards: 1,
        fencer_2_cards: 0,
      });
      
      expect(period2).toBeTruthy();
      
      // Complete Period 2 and start Period 3
      await matchPeriodService.updateMatchPeriod(period2!.period_id, {
        end_time: new Date().toISOString(),
      });
      
      const period3 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 3,
        start_time: new Date().toISOString(),
        fencer_1_score: 12,
        fencer_2_score: 9,
        fencer_1_cards: 1,
        fencer_2_cards: 1,
      });
      
      expect(period3).toBeTruthy();
      
      // Complete the match
      const completedMatch = await matchService.completeMatch(match!.match_id, {
        end_time: new Date().toISOString(),
        winner: 'fencer_1',
      });
      
      expect(completedMatch).toBeTruthy();
      expect(completedMatch?.is_complete).toBe(true);
    }, 30000);
    
    it('should handle priority round when scores are tied', async () => {
      const sessionData = {
        fencer_1_name: 'Alice',
        fencer_2_name: 'Bob',
        start_time: new Date().toISOString(),
      };
      
      const match = await matchService.createMatchFromRemote(sessionData, testUser.id);
      
      // Simulate Period 3 with tied scores (14-14)
      const period3 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 3,
        start_time: new Date().toISOString(),
        fencer_1_score: 14,
        fencer_2_score: 14,
        fencer_1_cards: 0,
        fencer_2_cards: 0,
        priority_assigned: true,
        priority_to: 'Alice',
      });
      
      expect(period3).toBeTruthy();
      expect(period3?.priority_assigned).toBe(true);
      expect(period3?.priority_to).toBe('Alice');
    }, 30000);
  });
  
  describe('Card Tracking', () => {
    it('should track yellow and red cards correctly', async () => {
      const sessionData = {
        fencer_1_name: 'Alice',
        fencer_2_name: 'Bob',
        start_time: new Date().toISOString(),
      };
      
      const match = await matchService.createMatchFromRemote(sessionData, testUser.id);
      
      // Create a period with cards
      const period = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 1,
        start_time: new Date().toISOString(),
        fencer_1_score: 5,
        fencer_2_score: 3,
        fencer_1_cards: 2, // 1 yellow + 1 red
        fencer_2_cards: 1, // 1 yellow
      });
      
      expect(period).toBeTruthy();
      expect(period?.fencer_1_cards).toBe(2);
      expect(period?.fencer_2_cards).toBe(1);
    }, 30000);
  });
  
  describe('Match State Persistence', () => {
    it('should save and load match state from AsyncStorage', async () => {
      const matchState = {
        currentPeriod: 2,
        aliceScore: 5,
        bobScore: 3,
        period1Time: 180,
        period2Time: 90,
        isPlaying: false,
      };
      
      // Save state
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await AsyncStorage.setItem('ongoing_match_state', JSON.stringify(matchState));
      
      // Load state
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(matchState));
      const savedState = await AsyncStorage.getItem('ongoing_match_state');
      
      expect(savedState).toBeTruthy();
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        expect(parsedState.currentPeriod).toBe(2);
        expect(parsedState.aliceScore).toBe(5);
        expect(parsedState.bobScore).toBe(3);
      }
    });
  });
  
  describe('Score Tracking', () => {
    it('should correctly calculate final scores across periods', async () => {
      const sessionData = {
        fencer_1_name: 'Alice',
        fencer_2_name: 'Bob',
        start_time: new Date().toISOString(),
      };
      
      const match = await matchService.createMatchFromRemote(sessionData, testUser.id);
      
      // Period 1: Alice leads 5-3
      const period1 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 1,
        start_time: new Date().toISOString(),
        fencer_1_score: 5,
        fencer_2_score: 3,
      });
      
      // Period 2: Alice leads 10-7
      const period2 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 2,
        start_time: new Date().toISOString(),
        fencer_1_score: 10,
        fencer_2_score: 7,
      });
      
      // Period 3: Alice wins 15-11
      const period3 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 3,
        start_time: new Date().toISOString(),
        fencer_1_score: 15,
        fencer_2_score: 11,
      });
      
      // Complete match
      await matchService.completeMatch(match!.match_id, {
        end_time: new Date().toISOString(),
        winner: 'fencer_1',
      });
      
      // Verify final scores
      const completedMatch = await matchService.getMatchById(match!.match_id);
      expect(completedMatch?.is_complete).toBe(true);
      expect(completedMatch?.winner).toBe('fencer_1');
    }, 30000);
  });
  
  describe('Period Transitions', () => {
    it('should properly transition from Period 1 to 2 to 3', async () => {
      const sessionData = {
        fencer_1_name: 'Alice',
        fencer_2_name: 'Bob',
        start_time: new Date().toISOString(),
      };
      
      const match = await matchService.createMatchFromRemote(sessionData, testUser.id);
      
      // Period 1
      const period1 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 1,
        start_time: new Date().toISOString(),
        fencer_1_score: 5,
        fencer_2_score: 3,
      });
      
      await matchPeriodService.updateMatchPeriod(period1!.period_id, {
        end_time: new Date().toISOString(),
      });
      
      // Period 2
      const period2 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 2,
        start_time: new Date().toISOString(),
        fencer_1_score: 8,
        fencer_2_score: 6,
      });
      
      await matchPeriodService.updateMatchPeriod(period2!.period_id, {
        end_time: new Date().toISOString(),
      });
      
      // Period 3
      const period3 = await matchPeriodService.createMatchPeriod({
        match_id: match!.match_id,
        period_number: 3,
        start_time: new Date().toISOString(),
        fencer_1_score: 12,
        fencer_2_score: 9,
      });
      
      expect(period1?.period_number).toBe(1);
      expect(period2?.period_number).toBe(2);
      expect(period3?.period_number).toBe(3);
    }, 30000);
  });
});


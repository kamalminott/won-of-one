import { ScoreProgressionChart } from '@/components/ScoreProgressionChart';
import { TouchesByPeriodChart } from '@/components/TouchesByPeriodChart';
import { matchService } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function NeutralMatchSummary() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [matchData, setMatchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Extract match data from params
  const {
    matchId,
    aliceScore,
    bobScore,
    aliceCards,
    bobCards,
    matchDuration,
    fencer1Name,
    fencer2Name,
  } = params;

  useEffect(() => {
    const loadMatchData = async () => {
      try {
        if (matchId) {
          const data = await matchService.getMatchById(matchId as string);
          setMatchData(data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading match data:', error);
        setLoading(false);
      }
    };

    loadMatchData();
  }, [matchId]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
  };


  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
            <Text style={styles.loadingText}>Loading match summary...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const aliceScoreNum = parseInt(aliceScore as string) || 0;
  const bobScoreNum = parseInt(bobScore as string) || 0;
  const matchDurationNum = parseInt(matchDuration as string) || 0;
  const aliceCardsData = aliceCards ? JSON.parse(aliceCards as string) : { yellow: 0, red: 0 };
  const bobCardsData = bobCards ? JSON.parse(bobCards as string) : { yellow: 0, red: 0 };

  // Calculate winner
  const winner = aliceScoreNum > bobScoreNum ? fencer1Name : bobScoreNum > aliceScoreNum ? fencer2Name : 'Tied';
  const scoreDiff = Math.abs(aliceScoreNum - bobScoreNum);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#171717" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Neutral Match Summary</Text>
        
        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="create-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Match Result Card with Gradient */}
        <View style={styles.resultCardContainer}>
          {/* Win Badge */}
          <View style={styles.winBadge}>
            <View style={styles.winBadgeContent}>
              <View style={styles.checkIcon} />
              <Text style={styles.winText}>Win</Text>
            </View>
          </View>
          
          <LinearGradient
            colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
            style={styles.resultCard}
          >
            {/* Player 1 - Left */}
            <View style={styles.playerLeft}>
              <View style={styles.playerAvatar} />
              <Text style={styles.playerName}>{fencer1Name}</Text>
            </View>
            
            {/* Center Content */}
            <View style={styles.centerContent}>
              <Text style={styles.scoreText}>{aliceScoreNum} - {bobScoreNum}</Text>
              <Text style={styles.durationText}>Duration: {formatTime(matchDurationNum)}</Text>
              <View style={styles.trainingBadge}>
                <Text style={styles.trainingText}>Training</Text>
              </View>
            </View>
            
            {/* Player 2 - Right */}
            <View style={styles.playerRight}>
              <View style={styles.playerAvatar} />
              <Text style={styles.playerName}>{fencer2Name}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Two Column Layout for Meta and Touches */}
        <View style={styles.twoColumnContainer}>
          {/* Minimal Meta Card */}
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Minimal Meta</Text>
            
            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="flash" size={20} color="white" />
              </View>
              <View style={styles.metaContent}>
                <Text style={styles.metaValue}>Foil</Text>
                <Text style={styles.metaLabel}>Weapon</Text>
              </View>
            </View>

            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="calendar" size={20} color="white" />
              </View>
              <View style={styles.metaContent}>
                <Text style={styles.metaValue}>{formatDate(new Date().toISOString())}</Text>
                <Text style={styles.metaLabel}>Date</Text>
              </View>
            </View>

            <View style={styles.metaItem}>
              <View style={styles.metaIcon}>
                <Ionicons name="time" size={20} color="white" />
              </View>
              <View style={styles.metaContent}>
                <Text style={styles.metaValue}>{formatTime(matchDurationNum)}</Text>
                <Text style={styles.metaLabel}>Duration</Text>
              </View>
            </View>
          </View>

          {/* Touches by Period Chart Card */}
          <View style={styles.touchesChartCard}>
            <Text style={styles.chartTitle}>Touches by Period</Text>
            <TouchesByPeriodChart 
              touchesByPeriod={{
                period1: { user: 0, opponent: 0 },
                period2: { user: 0, opponent: 0 },
                period3: { user: 0, opponent: 0 }
              }}
              userLabel={fencer1Name as string}
              opponentLabel={fencer2Name as string}
            />
          </View>
        </View>

        {/* Score Progression Chart Card */}
        <View style={styles.scoreProgressionCard}>
          <Text style={styles.chartTitle}>Score Progression</Text>
          <ScoreProgressionChart 
            scoreProgression={{
              userData: [],
              opponentData: []
            }}
            userScore={aliceScoreNum}
            opponentScore={bobScoreNum}
            userLabel={fencer1Name as string}
            opponentLabel={fencer2Name as string}
          />
        </View>

        {/* Two Column Layout for Lead Changes and Time Leading */}
        <View style={styles.twoColumnContainer}>
          {/* Lead Changes Card */}
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Lead Changes</Text>
            <View style={styles.statContent}>
              <View style={styles.statItem}>
                <View style={styles.statCircle}>
                  <Text style={styles.statValue}>4</Text>
                </View>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Time Leading Card */}
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Time Leading</Text>
            <View style={styles.statContent}>
              <View style={styles.statItem}>
                <View style={[styles.statCircle, { backgroundColor: '#FF7675' }]}>
                  <Text style={styles.statValue}>65%</Text>
                </View>
                <Text style={styles.statLabel}>{fencer1Name}</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statCircle, { backgroundColor: '#00B894' }]}>
                  <Text style={styles.statValue}>25%</Text>
                </View>
                <Text style={styles.statLabel}>{fencer2Name}</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statCircle, { backgroundColor: 'white' }]}>
                  <Text style={[styles.statValue, { color: '#171717' }]}>10%</Text>
                </View>
                <Text style={styles.statLabel}>Tied</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Two Column Layout for Bounce Back and Longest Run */}
        <View style={styles.twoColumnContainer}>
          {/* Bounce Back Time Card */}
          <View style={styles.bounceBackCard}>
            <Text style={styles.statTitle}>Bounce Back Time</Text>
            <View style={styles.bounceBackContent}>
              <View style={styles.bounceBackItem}>
                <View style={[styles.bounceBackCircle, { backgroundColor: '#FF7675' }]}>
                  <Text style={styles.bounceBackValue}>10s</Text>
                </View>
                <Text style={styles.bounceBackLabel}>{fencer1Name}</Text>
              </View>
              <View style={styles.bounceBackItem}>
                <View style={[styles.bounceBackCircle, { backgroundColor: '#00B894' }]}>
                  <Text style={styles.bounceBackValue}>14s</Text>
                </View>
                <Text style={styles.bounceBackLabel}>{fencer2Name}</Text>
              </View>
            </View>
          </View>

          {/* Longest Run Card */}
          <View style={styles.longestRunCard}>
            <Text style={styles.statTitle}>Longest Run</Text>
            <View style={styles.bounceBackContent}>
              <View style={styles.bounceBackItem}>
                <View style={[styles.bounceBackCircle, { backgroundColor: '#FF7675' }]}>
                  <Text style={styles.bounceBackValue}>3x</Text>
                </View>
                <Text style={styles.bounceBackLabel}>{fencer1Name}</Text>
              </View>
              <View style={styles.bounceBackItem}>
                <View style={[styles.bounceBackCircle, { backgroundColor: '#00B894' }]}>
                  <Text style={styles.bounceBackValue}>2x</Text>
                </View>
                <Text style={styles.bounceBackLabel}>{fencer2Name}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cards Section */}
        <View style={styles.cardsSection}>
          <Text style={styles.cardsTitle}>Cards</Text>
          <View style={styles.cardsContent}>
            <View style={styles.cardItem}>
              <View style={styles.cardAvatar} />
              <Text style={styles.cardName}>{fencer1Name}</Text>
            </View>
            
            <View style={styles.cardsScore}>
              <View style={styles.cardIndicator}>
                <View style={[styles.cardSquare, { backgroundColor: '#FDCB6E' }]} />
                <Text style={styles.cardsScoreText}>{aliceCardsData.yellow + aliceCardsData.red} - {bobCardsData.yellow + bobCardsData.red}</Text>
                <View style={[styles.cardSquare, { backgroundColor: '#FC5655' }]} />
              </View>
            </View>
            
            <View style={styles.cardItem}>
              <Text style={styles.cardName}>{fencer2Name}</Text>
              <View style={styles.cardAvatar} />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171717',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#212121',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#343434',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Articulat CF',
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#343434',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCardContainer: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  winBadge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: [{ translateX: -37.5 }], // 75px / 2
    zIndex: 10,
    backgroundColor: '#4D4159',
    borderWidth: 2,
    borderColor: '#D1A3F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 75,
    height: 34,
  },
  winBadgeContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  checkIcon: {
    width: 14,
    height: 14,
    backgroundColor: 'white',
    borderRadius: 2,
  },
  winText: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: '#FFFFFF',
  },
  resultCard: {
    width: 358,
    height: 160,
    borderRadius: 20,
    shadowColor: 'rgba(108, 92, 231, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  playerLeft: {
    alignItems: 'center',
    width: 60,
    height: 89,
  },
  playerRight: {
    alignItems: 'center',
    width: 60,
    height: 89,
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#343434',
    marginBottom: 8,
  },
  playerName: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 20,
  },
  scoreText: {
    fontFamily: 'Articulat CF',
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 41,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  durationText: {
    fontFamily: 'Articulat CF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    color: '#9D9D9D',
    textAlign: 'center',
    marginBottom: 8,
  },
  trainingBadge: {
    backgroundColor: '#625971',
    borderRadius: 60,
    paddingHorizontal: 12,
    paddingVertical: 4,
    width: 67,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainingText: {
    fontFamily: 'Articulat CF',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: '#FFFFFF',
  },
  twoColumnContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 16,
  },
  metaCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  metaTitle: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  metaContent: {
    flex: 1,
  },
  metaValue: {
    fontFamily: 'Articulat CF',
    fontSize: 18,
    fontWeight: '500',
    color: 'white',
    marginBottom: 4,
  },
  metaLabel: {
    fontFamily: 'Articulat CF',
    fontSize: 12,
    fontWeight: '400',
    color: 'white',
  },
  touchesChartCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  scoreProgressionCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  chartTitle: {
    fontFamily: 'Articulat CF',
    fontSize: 18,
    fontWeight: '500',
    color: 'white',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  statTitle: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginBottom: 16,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: 'Articulat CF',
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
  statLabel: {
    fontFamily: 'Articulat CF',
    fontSize: 12,
    fontWeight: '400',
    color: 'white',
  },
  bounceBackCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  longestRunCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  bounceBackContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bounceBackItem: {
    alignItems: 'center',
  },
  bounceBackCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bounceBackValue: {
    fontFamily: 'Articulat CF',
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  bounceBackLabel: {
    fontFamily: 'Articulat CF',
    fontSize: 12,
    fontWeight: '400',
    color: 'white',
  },
  cardsSection: {
    backgroundColor: '#2A2A2A',
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  cardsTitle: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginBottom: 16,
  },
  cardsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardItem: {
    alignItems: 'center',
  },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#343434',
    borderWidth: 1,
    borderColor: 'white',
    marginBottom: 8,
  },
  cardName: {
    fontFamily: 'Articulat CF',
    fontSize: 12,
    fontWeight: '400',
    color: 'white',
  },
  cardsScore: {
    alignItems: 'center',
  },
  cardIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#393939',
    borderRadius: 86,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  cardSquare: {
    width: 14,
    height: 18,
    borderRadius: 3,
  },
  cardsScoreText: {
    fontFamily: 'Articulat CF',
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
});
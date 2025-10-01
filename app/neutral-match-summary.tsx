import { ScoreProgressionChart } from '@/components/ScoreProgressionChart';
import { TouchesByPeriodChart } from '@/components/TouchesByPeriodChart';
import { matchService } from '@/lib/database';
import { supabase } from '@/lib/supabase';
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
  const [touchesByPeriod, setTouchesByPeriod] = useState<{
    period1: { user: number; opponent: number };
    period2: { user: number; opponent: number };
    period3: { user: number; opponent: number };
  }>({
    period1: { user: 0, opponent: 0 },
    period2: { user: 0, opponent: 0 },
    period3: { user: 0, opponent: 0 }
  });
  const [scoreProgression, setScoreProgression] = useState<{
    userData: {x: string, y: number}[],
    opponentData: {x: string, y: number}[]
  }>({ userData: [], opponentData: [] });

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
          
          // Fetch actual period scores from match_period table
          try {
            const { data: matchPeriods, error: periodsError } = await supabase
              .from('match_period')
              .select('period_number, fencer_1_score, fencer_2_score')
              .eq('match_id', matchId as string)
              .order('period_number', { ascending: true });

            if (periodsError) {
              console.error('Error fetching match periods:', periodsError);
              throw periodsError;
            }

            if (matchPeriods && matchPeriods.length > 0) {
              console.log('📊 Found match periods:', matchPeriods);
              
              // Initialize with zeros
              const touchesByPeriodData = {
                period1: { user: 0, opponent: 0 },
                period2: { user: 0, opponent: 0 },
                period3: { user: 0, opponent: 0 }
              };

              // Fill in actual period scores
              matchPeriods.forEach(period => {
                const periodNum = period.period_number || 1;
                if (periodNum === 1) {
                  touchesByPeriodData.period1.user = period.fencer_1_score || 0;
                  touchesByPeriodData.period1.opponent = period.fencer_2_score || 0;
                } else if (periodNum === 2) {
                  touchesByPeriodData.period2.user = period.fencer_1_score || 0;
                  touchesByPeriodData.period2.opponent = period.fencer_2_score || 0;
                } else if (periodNum === 3) {
                  touchesByPeriodData.period3.user = period.fencer_1_score || 0;
                  touchesByPeriodData.period3.opponent = period.fencer_2_score || 0;
                }
              });

              console.log('📊 Using actual period scores from database:', touchesByPeriodData);
              setTouchesByPeriod(touchesByPeriodData);
              
              // Also fetch score progression data
              if (data && data.fencer_1_name) {
                try {
                  const calculatedScoreProgression = await matchService.calculateAnonymousScoreProgression(
                    matchId as string
                  );
                  console.log('📈 Calculated anonymous score progression from database:', calculatedScoreProgression);
                  
                  // Check if we got meaningful data for both players
                  const hasFencer1Data = calculatedScoreProgression.fencer1Data.length > 0;
                  const hasFencer2Data = calculatedScoreProgression.fencer2Data.length > 0;
                  
                  console.log('📈 DATA VALIDATION:', {
                    hasFencer1Data,
                    hasFencer2Data,
                    fencer1DataLength: calculatedScoreProgression.fencer1Data.length,
                    fencer2DataLength: calculatedScoreProgression.fencer2Data.length
                  });
                  
                  if (hasFencer1Data && hasFencer2Data) {
                    console.log('📈 Using real anonymous score progression data from database');
                    // Convert to the format expected by the chart component
                    const scoreProgression = {
                      userData: calculatedScoreProgression.fencer1Data,
                      opponentData: calculatedScoreProgression.fencer2Data
                    };
                    setScoreProgression(scoreProgression);
                  } else {
                    console.log('📈 Anonymous score progression data incomplete, using real data where available');
                    // Use the real data we have and create simple fallback for missing data
                    const aliceScoreNum = parseInt(aliceScore as string) || 0;
                    const bobScoreNum = parseInt(bobScore as string) || 0;
                    const matchDurationNum = parseInt(matchDuration as string) || 1;
                    
                    let finalFencer1Data = calculatedScoreProgression.fencer1Data;
                    let finalFencer2Data = calculatedScoreProgression.fencer2Data;
                    
                    // If fencer 1 data is missing, create simple fallback
                    if (!hasFencer1Data && aliceScoreNum > 0) {
                      const finalTime = `${Math.floor(matchDurationNum/60)}:${(matchDurationNum%60).toString().padStart(2, '0')}`;
                      finalFencer1Data = [
                        { x: "0:00", y: 0 },
                        { x: finalTime, y: aliceScoreNum }
                      ];
                    }
                    
                    // If fencer 2 data is missing, create simple fallback
                    if (!hasFencer2Data && bobScoreNum > 0) {
                      const finalTime = `${Math.floor(matchDurationNum/60)}:${(matchDurationNum%60).toString().padStart(2, '0')}`;
                      finalFencer2Data = [
                        { x: "0:00", y: 0 },
                        { x: finalTime, y: bobScoreNum }
                      ];
                    }
                    
                    const mixedScoreProgression = {
                      userData: finalFencer1Data,
                      opponentData: finalFencer2Data
                    };
                    
                    console.log('📈 Using mixed anonymous score progression (real + fallback):', mixedScoreProgression);
                    setScoreProgression(mixedScoreProgression);
                  }
                } catch (error) {
                  console.error('Error calculating score progression:', error);
                  
                  // Create simple fallback score progression from final scores
                  const aliceScoreNum = parseInt(aliceScore as string) || 0;
                  const bobScoreNum = parseInt(bobScore as string) || 0;
                  const matchDurationNum = parseInt(matchDuration as string) || 1;
                  
                  const finalTime = `${Math.floor(matchDurationNum/60)}:${(matchDurationNum%60).toString().padStart(2, '0')}`;
                  
                  const fallbackScoreProgression = {
                    userData: [
                      { x: "0:00", y: 0 },
                      { x: finalTime, y: aliceScoreNum }
                    ],
                    opponentData: [
                      { x: "0:00", y: 0 },
                      { x: finalTime, y: bobScoreNum }
                    ]
                  };
                  
                  console.log('📈 ERROR: Simple fallback score progression:', fallbackScoreProgression);
                  setScoreProgression(fallbackScoreProgression);
                }
              }
            } else {
              console.log('📊 No match periods found, using final scores as fallback');
              // Fallback to final scores if no period data
              const aliceScoreNum = parseInt(aliceScore as string) || 0;
              const bobScoreNum = parseInt(bobScore as string) || 0;
              
              const touchesByPeriodData = {
                period1: { user: aliceScoreNum, opponent: bobScoreNum },
                period2: { user: 0, opponent: 0 },
                period3: { user: 0, opponent: 0 }
              };
              
              setTouchesByPeriod(touchesByPeriodData);
            }
          } catch (error) {
            console.error('Error fetching period data:', error);
            // Fallback to final scores
            const aliceScoreNum = parseInt(aliceScore as string) || 0;
            const bobScoreNum = parseInt(bobScore as string) || 0;
            
            const touchesByPeriodData = {
              period1: { user: aliceScoreNum, opponent: bobScoreNum },
              period2: { user: 0, opponent: 0 },
              period3: { user: 0, opponent: 0 }
            };
            
            setTouchesByPeriod(touchesByPeriodData);
          }
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
        {/* Match Result Card with Gradient Border */}
        <View style={styles.resultCardContainer}>
          {/* Win Badge */}
          <View style={styles.winBadge}>
            <Text style={styles.winText}>Result</Text>
          </View>
          
          {/* Card with Gradient Border */}
          <View style={styles.resultCardBorder}>
            <LinearGradient
              colors={['#D2A3F0', '#989DFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.resultCardGradientBorder}
            >
              <View style={styles.resultCard}>
                {/* Left Player */}
                <View style={styles.leftPlayerContainer}>
                  <View style={styles.playerAvatar} />
                  <Text style={styles.playerName}>{fencer1Name}</Text>
                </View>

                {/* Right Player */}
                <View style={styles.rightPlayerContainer}>
                  <View style={styles.playerAvatar} />
                  <Text style={styles.playerName}>{fencer2Name}</Text>
                </View>

                {/* Score Container */}
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreText}>{aliceScoreNum} - {bobScoreNum}</Text>
                  <Text style={styles.durationText}>Duration: {formatTime(matchDurationNum)}</Text>
                  <View style={styles.matchTypeBadge}>
                    <Text style={styles.matchTypeText}>Training</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
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
              title=""
              touchesByPeriod={touchesByPeriod}
              userLabel={fencer1Name as string}
              opponentLabel={fencer2Name as string}
            />
          </View>
        </View>

        {/* Score Progression Chart Card */}
        <View style={styles.scoreProgressionCard}>
          <Text style={styles.chartTitle}>Score Progression</Text>
          <ScoreProgressionChart 
            title=""
            scoreProgression={scoreProgression}
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
    marginHorizontal: 0,
    marginTop: 20,
    marginBottom: 20,
    position: 'relative',
  },
  winBadge: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -37.5,
    zIndex: 10,
    backgroundColor: '#4D4159',
    borderWidth: 2,
    borderColor: '#D1A3F0',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 75,
    height: 34,
  },
  winIcon: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 7,
    lineHeight: 22,
    marginTop: -2,
  },
  winText: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: '#FFFFFF',
    marginTop: -2,
  },
  resultCardBorder: {
    width: '92%',
    height: 160,
    borderRadius: 24,
    padding: 5,
    alignSelf: 'center',
  },
  resultCardGradientBorder: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  resultCard: {
    flex: 1,
    margin: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(77, 65, 89, 1)',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
    position: 'relative',
  },
  leftPlayerContainer: {
    position: 'absolute',
    width: 60,
    height: 89,
    left: 20,
    top: 32,
    alignItems: 'center',
  },
  rightPlayerContainer: {
    position: 'absolute',
    width: 60,
    height: 89,
    right: 20,
    top: 32,
    alignItems: 'center',
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#343434',
    marginBottom: 8,
  },
  playerName: {
    position: 'absolute',
    width: 60,
    height: 22,
    left: 0,
    top: 68,
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  scoreContainer: {
    position: 'absolute',
    width: 150,
    height: 95,
    left: '50%',
    marginLeft: -75,
    top: 32,
    alignItems: 'center',
  },
  scoreText: {
    position: 'absolute',
    width: 80,
    height: 41,
    left: 35,
    top: 0,
    fontSize: 30,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  durationText: {
    position: 'absolute',
    width: 150,
    height: 19,
    left: 0,
    top: 44,
    fontSize: 14,
    fontWeight: '500',
    color: '#9D9D9D',
    textAlign: 'center',
  },
  matchTypeBadge: {
    position: 'absolute',
    width: 80,
    height: 24,
    left: 35,
    top: 71,
    backgroundColor: '#625971',
    borderRadius: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  matchTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
    textAlign: 'center',
  },
  twoColumnContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
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
    marginBottom: 28,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  metaIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: -12,
  },
  metaContent: {
    flex: 1,
  },
  metaValue: {
    fontFamily: 'Articulat CF',
    fontSize: 16,
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
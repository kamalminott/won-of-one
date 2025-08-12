import { Colors } from '@/constants/Colors';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RemoteScreen() {
  const [currentPeriod, setCurrentPeriod] = useState(3);
  const [aliceScore, setAliceScore] = useState(3);
  const [bobScore, setBobScore] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [matchTime, setMatchTime] = useState(0); // in seconds
  const [period1Time, setPeriod1Time] = useState(0); // in seconds
  const [period2Time, setPeriod2Time] = useState(0); // in seconds
  const [period3Time, setPeriod3Time] = useState(0); // in seconds
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editTimeInput, setEditTimeInput] = useState('');

  const incrementPeriod = () => {
    if (currentPeriod < 5) setCurrentPeriod(currentPeriod + 1);
  };

  const decrementPeriod = () => {
    if (currentPeriod > 1) setCurrentPeriod(currentPeriod - 1);
  };

  const incrementAliceScore = () => setAliceScore(aliceScore + 1);
  const decrementAliceScore = () => setAliceScore(Math.max(0, aliceScore - 1));
  const incrementBobScore = () => setBobScore(bobScore + 1);
  const decrementBobScore = () => setBobScore(Math.max(0, bobScore - 1));

  const togglePlay = () => setIsPlaying(!isPlaying);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let i = 0; i <= 599; i++) { // 0:00 to 9:59
      times.push(i);
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  const handleTimerScroll = (event: any, setter: (value: number) => void) => {
    const { contentOffset } = event.nativeEvent;
    const index = Math.round(contentOffset.y / 54); // 54px per time option
    const clampedIndex = Math.max(0, Math.min(index, timeOptions.length - 1));
    const newTime = timeOptions[clampedIndex];
    
    if (setter === setMatchTime) setMatchTime(newTime);
    else if (setter === setPeriod1Time) setPeriod1Time(newTime);
    else if (setter === setPeriod2Time) setPeriod2Time(newTime);
    else setPeriod3Time(newTime);
  };

  const getCurrentTimeIndex = (time: number) => {
    return timeOptions.indexOf(time);
  };

  const handleEditTime = () => {
    setEditTimeInput(formatTime(matchTime));
    setShowEditPopup(true);
  };

  const handleSaveTime = () => {
    const [minutes, seconds] = editTimeInput.split(':').map(Number);
    if (!isNaN(minutes) && !isNaN(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
      const totalSeconds = minutes * 60 + seconds;
      if (totalSeconds <= 599) { // Max 9:59
        setMatchTime(totalSeconds);
        setShowEditPopup(false);
        setEditTimeInput('');
      }
    }
  };

  const handleTimeInputChange = (text: string) => {
    // Remove any non-numeric characters except colon
    const cleaned = text.replace(/[^0-9:]/g, '');
    
    // Handle automatic colon insertion
    if (cleaned.length === 1 && cleaned !== ':') {
      // Single digit, add colon
      setEditTimeInput(cleaned + ':');
    } else if (cleaned.length === 2 && !cleaned.includes(':')) {
      // Two digits, insert colon in middle
      setEditTimeInput(cleaned[0] + ':' + cleaned[1]);
    } else if (cleaned.length === 3 && cleaned[1] === ':') {
      // Format: X:XX
      setEditTimeInput(cleaned);
    } else if (cleaned.length === 4 && cleaned[1] === ':') {
      // Format: XX:XX
      setEditTimeInput(cleaned);
    } else if (cleaned.includes(':')) {
      // Keep existing colon format
      setEditTimeInput(cleaned);
    } else {
      // Fallback for other cases
      setEditTimeInput(cleaned);
    }
  };

  const handleCancelEdit = () => {
    setShowEditPopup(false);
    setEditTimeInput('');
  };

  return (
    <View style={styles.container}>
      {/* Match Timer Section */}
      <View style={styles.matchTimerCard}>
        <View style={styles.timerHeader}>
          <View style={styles.timerLabel}>
            <Text style={styles.timerLabelText}>Match Timer</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleEditTime}>
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
        </View>
        
                <View style={styles.timerDisplay}>
          <View style={styles.timerPickerContainer}>
            <ScrollView 
              style={styles.timerScroll}
              contentContainerStyle={styles.timerScrollContent}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => handleTimerScroll(event, setMatchTime)}
              scrollEventThrottle={16}
              snapToInterval={54}
              decelerationRate="fast"
              contentOffset={{ x: 0, y: getCurrentTimeIndex(matchTime) * 54 }}
            >
              {timeOptions.map((time, index) => {
                const currentIndex = getCurrentTimeIndex(matchTime);
                const distance = Math.abs(index - currentIndex);
                
                let opacity = 1;
                let scale = 1;
                let zIndex = 1;
                
                if (distance === 0) {
                  // Center number - fully visible
                  opacity = 1;
                  scale = 1;
                  zIndex = 3;
                } else if (distance === 1) {
                  // Adjacent numbers - translucent and smaller
                  opacity = 0.4;
                  scale = 0.9;
                  zIndex = 2;
                } else {
                  // Far numbers - very translucent and smaller
                  opacity = 0.1;
                  scale = 0.8;
                  zIndex = 1;
                }
                
                return (
                  <Text key={index} style={[
                    styles.timerTextActive,
                    { 
                      height: 50, 
                      lineHeight: 50, 
                      marginVertical: 2,
                      opacity,
                      transform: [{ scale }],
                      zIndex,
                    }
                  ]}>
                    {formatTime(time)}
                  </Text>
                );
              })}
            </ScrollView>
            <View style={styles.timerPickerMask} />
            <View style={styles.timerPickerCenterHighlight} />
          </View>
        </View>
        
        <View style={styles.periodControl}>
          <TouchableOpacity style={styles.periodButton} onPress={decrementPeriod}>
            <Text style={styles.periodButtonText}>-</Text>
          </TouchableOpacity>
          <View style={styles.periodDisplay}>
            <Text style={styles.periodText}>Period</Text>
            <Text style={styles.periodNumber}>{currentPeriod}/3</Text>
          </View>
          <TouchableOpacity style={styles.periodButton} onPress={incrementPeriod}>
            <Text style={styles.periodButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fencers Section */}
      <Text style={styles.fencersHeading}>Fencers</Text>
      
      <View style={styles.fencersContainer}>
        {/* Alice Card */}
        <View style={styles.fencerCard}>
          <View style={styles.fencerCardHeader}>
            <View style={styles.profileContainer}>
              <View style={styles.profilePicture}>
                <Text style={styles.profileInitial}>A</Text>
                <View style={styles.cameraIcon}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
              </View>
            </View>
            <View style={styles.priorityStar}>
              <Text style={styles.starIcon}>⭐</Text>
            </View>
          </View>
          
          <Text style={styles.fencerName}>Alice</Text>
          <Text style={styles.fencerScore}>{aliceScore.toString().padStart(2, '0')}</Text>
          
          <View style={styles.scoreControls}>
            <TouchableOpacity style={styles.scoreButton} onPress={decrementAliceScore}>
              <Text style={styles.scoreButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scoreButton} onPress={incrementAliceScore}>
              <Text style={styles.scoreButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Button */}
        <TouchableOpacity style={styles.swapButton}>
          <Text style={styles.swapIcon}>↔️</Text>
        </TouchableOpacity>

        {/* Bob Card */}
        <View style={styles.fencerCard}>
          <View style={styles.fencerCardHeader}>
            <View style={styles.profileContainer}>
              <View style={styles.profilePicture}>
                <Text style={styles.profileInitial}>B</Text>
                <View style={styles.cameraIcon}>
                  <Text style={styles.cameraIconText}>📷</Text>
                </View>
              </View>
            </View>
          </View>
          
          <Text style={styles.fencerName}>Bob</Text>
          <Text style={styles.fencerScore}>{bobScore.toString().padStart(2, '0')}</Text>
          
          <View style={styles.scoreControls}>
            <TouchableOpacity style={styles.scoreButton} onPress={decrementBobScore}>
              <Text style={styles.scoreButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scoreButton} onPress={incrementBobScore}>
              <Text style={styles.scoreButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.decorativeCards}>
          <View style={[styles.decorativeCard, styles.cardRed]} />
          <View style={[styles.decorativeCard, styles.cardYellow]} />
          <View style={[styles.decorativeCard, styles.cardBlack]} />
        </View>
        
        <TouchableOpacity style={styles.assignPriorityButton}>
          <Text style={styles.assignPriorityIcon}>🎲</Text>
          <Text style={styles.assignPriorityText}>Assign Priority</Text>
        </TouchableOpacity>
        
        <View style={styles.decorativeCards}>
          <View style={[styles.decorativeCard, styles.cardBlack]} />
          <View style={[styles.decorativeCard, styles.cardRed]} />
          <View style={[styles.decorativeCard, styles.cardYellow]} />
        </View>
      </View>

      {/* Play and Reset Controls */}
      <View style={styles.playControls}>
        <TouchableOpacity style={styles.playButton} onPress={togglePlay}>
          <Text style={styles.playIcon}>▶️</Text>
          <Text style={styles.playText}>Play</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.resetButton}>
          <Text style={styles.resetIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Complete Match Button */}
      <TouchableOpacity style={styles.completeMatchButton}>
        <Text style={styles.completeMatchIcon}>{'>>'}</Text>
        <Text style={styles.completeMatchText}>Complete The Match</Text>
      </TouchableOpacity>

      {/* Edit Time Popup */}
      {showEditPopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>Edit Match Time</Text>
            <TextInput
              style={styles.timeInput}
              value={editTimeInput}
              onChangeText={handleTimeInputChange}
              placeholder="0:00"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              keyboardType="numeric"
              autoFocus
              maxLength={5}
              selectTextOnFocus
            />
            <Text style={styles.inputHint}>Format: M:SS or MM:SS</Text>
            <View style={styles.popupButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveTime}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 20,
    paddingTop: 60,
  },
  
  // Match Timer Section
  matchTimerCard: {
    backgroundColor: Colors.purple.dark || '#4C1D95',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    position: 'relative',
  },
  timerLabel: {
    backgroundColor: Colors.yellow.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    position: 'absolute',
    top: -12,
    left: '50%',
    transform: [{ translateX: -40 }],
    zIndex: 10,
  },
  timerLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray.dark,
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  timerScroll: {
    height: 162,
    overflow: 'hidden',
    borderRadius: 8,
  },
  timerScrollContent: {
    alignItems: 'center',
    paddingVertical: 54,
  },
  timerPickerContainer: {
    position: 'relative',
    width: 120,
    height: 162,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  timerPickerMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31, 41, 55, 0.1)',
    pointerEvents: 'none',
  },
  timerPickerCenterHighlight: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    pointerEvents: 'none',
  },
  timerTextFaded: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 2,
    textAlign: 'center',
  },
  timerTextActive: {
    fontSize: 48,
    color: 'white',
    fontWeight: '700',
    marginVertical: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 16,
  },
  periodControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.purple.light || '#A78BFA',
    borderRadius: 12,
    padding: 12,
  },
  periodButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.purple.dark || '#4C1D95',
  },
  periodDisplay: {
    alignItems: 'center',
  },
  periodText: {
    fontSize: 12,
    color: Colors.gray.dark,
    fontWeight: '500',
  },
  periodNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray.dark,
  },

  // Fencers Section
  fencersHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 16,
  },
  fencersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  fencerCard: {
    flex: 1,
    backgroundColor: Colors.pink.light,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  fencerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  profileContainer: {
    alignItems: 'center',
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.gray.medium,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gray.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconText: {
    fontSize: 10,
  },
  priorityStar: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  starIcon: {
    fontSize: 16,
  },
  fencerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gray.dark,
    marginBottom: 8,
  },
  fencerScore: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.gray.dark,
    marginBottom: 16,
  },
  scoreControls: {
    flexDirection: 'row',
    gap: 12,
  },
  scoreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray.dark,
  },

  // Swap Button
  swapButton: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.purple.light || '#A78BFA',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  swapIcon: {
    fontSize: 20,
  },

  // Bottom Controls
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  decorativeCards: {
    flexDirection: 'row',
    gap: 4,
  },
  decorativeCard: {
    width: 8,
    height: 12,
    borderRadius: 2,
  },
  cardRed: {
    backgroundColor: Colors.red.accent,
  },
  cardYellow: {
    backgroundColor: Colors.yellow.accent,
  },
  cardBlack: {
    backgroundColor: Colors.gray.dark,
  },
  assignPriorityButton: {
    backgroundColor: Colors.gray.medium,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  assignPriorityIcon: {
    fontSize: 16,
  },
  assignPriorityText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },

  // Play Controls
  playControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 16,
  },
  playButton: {
    backgroundColor: Colors.gray.dark,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  playIcon: {
    fontSize: 20,
  },
  playText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  resetButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.red.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetIcon: {
    fontSize: 20,
  },

  // Complete Match Button
  completeMatchButton: {
    backgroundColor: Colors.purple.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  completeMatchIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  completeMatchText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  // Edit Time Popup
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  popupContainer: {
    backgroundColor: Colors.purple.dark || '#4C1D95',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  timeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    width: '100%',
    marginBottom: 12,
  },
  inputHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  popupButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: Colors.gray.medium,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  saveButton: {
    backgroundColor: Colors.purple.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});

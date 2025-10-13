import { Colors } from '@/constants/Colors';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

interface SetNewGoalPromptProps {
  visible: boolean;
  completedGoal: {
    title: string;
    description?: string;
    targetValue: number;
  } | null;
  onSetGoal: () => void;
  onLater: () => void;
}

export const SetNewGoalPrompt: React.FC<SetNewGoalPromptProps> = ({
  visible,
  completedGoal,
  onSetGoal,
  onLater,
}) => {
  const { width, height } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide up and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations
      slideAnim.setValue(height);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!completedGoal) return null;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContainer: {
      backgroundColor: '#2A2A2A',
      borderTopLeftRadius: width * 0.08,
      borderTopRightRadius: width * 0.08,
      padding: width * 0.06,
      paddingBottom: height * 0.05,
      alignItems: 'center',
    },
    emojiIcon: {
      fontSize: width * 0.15,
      marginBottom: height * 0.02,
    },
    title: {
      fontSize: width * 0.065,
      fontWeight: '700',
      color: Colors.purple.primary,
      marginBottom: height * 0.02,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: width * 0.038,
      color: Colors.gray.light,
      marginBottom: height * 0.008,
      textAlign: 'center',
    },
    completedGoalTitle: {
      fontSize: width * 0.045,
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.025,
      textAlign: 'center',
      paddingHorizontal: width * 0.04,
    },
    prompt: {
      fontSize: width * 0.04,
      color: 'white',
      textAlign: 'center',
      marginBottom: height * 0.035,
      paddingHorizontal: width * 0.03,
      lineHeight: width * 0.055,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: width * 0.03,
      width: '100%',
    },
    button: {
      flex: 1,
      paddingVertical: height * 0.02,
      borderRadius: width * 0.03,
      alignItems: 'center',
    },
    laterButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    setGoalButton: {
      backgroundColor: Colors.purple.primary,
    },
    buttonText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onLater}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.emojiIcon}>🎯</Text>
          
          <Text style={styles.title}>Keep the Momentum!</Text>
          
          <Text style={styles.subtitle}>You just completed:</Text>
          <Text style={styles.completedGoalTitle}>
            "{completedGoal.title}"
          </Text>
          
          <Text style={styles.prompt}>
            Ready to set your next challenge and keep improving?
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.laterButton]}
              onPress={onLater}
            >
              <Text style={styles.buttonText}>Maybe Later</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.setGoalButton]}
              onPress={onSetGoal}
            >
              <Text style={styles.buttonText}>Set New Goal</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};


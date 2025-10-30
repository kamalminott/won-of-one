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
import ConfettiCannon from 'react-native-confetti-cannon';

interface GoalCelebrationModalProps {
  visible: boolean;
  goalData: {
    title: string;
    description?: string;
    targetValue: number;
    currentValue: number;
  } | null;
  onClose: () => void;
}

export const GoalCelebrationModal: React.FC<GoalCelebrationModalProps> = ({
  visible,
  goalData,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const confettiRef = useRef<any>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && confettiRef.current) {
      // Fire confetti
      confettiRef.current.start();
      
      // Animate modal appearance
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
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
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!goalData) return null;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContainer: {
      width: width * 0.85,
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.06,
      padding: width * 0.06,
      alignItems: 'center',
      shadowColor: Colors.purple.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    trophyIcon: {
      fontSize: width * 0.2,
      marginBottom: height * 0.02,
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: height * 0.02,
    },
    congratsText: {
      fontSize: width * 0.07,
      fontWeight: '700',
      color: Colors.purple.primary,
      marginBottom: height * 0.01,
      textAlign: 'center',
    },
    subtitleText: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
      marginBottom: height * 0.005,
      textAlign: 'center',
    },
    goalTitle: {
      fontSize: width * 0.05,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.015,
      textAlign: 'center',
    },
    goalDescription: {
      fontSize: width * 0.035,
      color: Colors.gray.light,
      textAlign: 'center',
      marginBottom: height * 0.02,
      paddingHorizontal: width * 0.02,
    },
    statsContainer: {
      backgroundColor: 'rgba(108, 92, 231, 0.1)',
      borderRadius: width * 0.04,
      padding: width * 0.04,
      marginBottom: height * 0.03,
      width: '100%',
      alignItems: 'center',
    },
    statsText: {
      fontSize: width * 0.06,
      fontWeight: '700',
      color: Colors.purple.primary,
    },
    statsLabel: {
      fontSize: width * 0.035,
      color: Colors.gray.light,
      marginTop: height * 0.005,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: width * 0.03,
      width: '100%',
    },
    button: {
      flex: 1,
      backgroundColor: Colors.purple.primary,
      paddingVertical: height * 0.018,
      borderRadius: width * 0.03,
      alignItems: 'center',
    },
    secondaryButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    buttonText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '600',
    },
    confettiContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{ x: width / 2, y: -10 }}
          autoStart={false}
          fadeOut
          fallSpeed={2500}
          colors={[
            Colors.purple.primary,
            Colors.pink.light,
            Colors.yellow.accent,
            Colors.blue.light,
            '#00B894',
            '#FF7675',
          ]}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.trophyIcon}>🏆</Text>
          
          <View style={styles.titleContainer}>
            <Text style={styles.congratsText}>Congratulations!</Text>
            <Text style={styles.subtitleText}>Goal Achieved</Text>
          </View>
          
          <Text style={styles.goalTitle}>{goalData.title}</Text>
          
          {goalData.description && (
            <Text style={styles.goalDescription}>{goalData.description}</Text>
          )}
          
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {goalData.currentValue}/{goalData.targetValue}
            </Text>
            <Text style={styles.statsLabel}>Target Reached!</Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>View Progress</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.button}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};


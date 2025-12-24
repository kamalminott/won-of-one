import { Colors } from '@/constants/Colors';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const HomeSkeleton: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const animatedStyle = { opacity: pulse };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerSafeArea: {
      backgroundColor: 'rgba(33, 33, 33, 1)',
    },
    safeArea: {
      flex: 1,
      backgroundColor: Colors.dark.background,
    },
    headerRow: {
      paddingHorizontal: '5%',
      paddingVertical: height * 0.008,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.03,
    },
    headerText: {
      gap: height * 0.006,
    },
    content: {
      padding: '4%',
      paddingTop: 0,
      paddingBottom: height * 0.25,
      width: '100%',
    },
    summaryRow: {
      flexDirection: 'row',
      gap: width * 0.04,
      marginBottom: height * 0.012,
    },
    addButtonRow: {
      alignItems: 'flex-end',
      marginBottom: height * 0.008,
    },
    recentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.012,
      marginTop: height * 0.01,
    },
    block: {
      backgroundColor: '#2A2A2A',
    },
    avatar: {
      width: width * 0.12,
      height: width * 0.12,
      borderRadius: width * 0.06,
    },
    headerLineShort: {
      width: width * 0.25,
      height: height * 0.012,
      borderRadius: 6,
    },
    headerLineLong: {
      width: width * 0.4,
      height: height * 0.012,
      borderRadius: 6,
    },
    headerIcon: {
      width: width * 0.1,
      height: width * 0.1,
      borderRadius: width * 0.05,
    },
    progressCard: {
      height: height * 0.12,
      borderRadius: width * 0.05,
      marginBottom: height * 0.014,
    },
    summaryCard: {
      flex: 1,
      height: height * 0.09,
      borderRadius: width * 0.045,
    },
    goalCard: {
      height: height * 0.17,
      borderRadius: width * 0.05,
      marginBottom: height * 0.02,
    },
    addButton: {
      width: width * 0.14,
      height: width * 0.14,
      borderRadius: width * 0.07,
    },
    recentTitle: {
      width: width * 0.35,
      height: height * 0.014,
      borderRadius: 6,
    },
    recentAction: {
      width: width * 0.18,
      height: height * 0.014,
      borderRadius: 6,
    },
    recentCard: {
      height: height * 0.16,
      borderRadius: width * 0.05,
    },
  });

  return (
    <>
      <ExpoStatusBar style="light" />
      <View style={styles.container}>
        <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Animated.View style={[styles.block, styles.avatar, animatedStyle]} />
              <View style={styles.headerText}>
                <Animated.View style={[styles.block, styles.headerLineShort, animatedStyle]} />
                <Animated.View style={[styles.block, styles.headerLineLong, animatedStyle]} />
              </View>
            </View>
            <Animated.View style={[styles.block, styles.headerIcon, animatedStyle]} />
          </View>
        </SafeAreaView>

        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.content}>
            <Animated.View style={[styles.block, styles.progressCard, animatedStyle]} />

            <View style={styles.summaryRow}>
              <Animated.View style={[styles.block, styles.summaryCard, animatedStyle]} />
              <Animated.View style={[styles.block, styles.summaryCard, animatedStyle]} />
            </View>

            <Animated.View style={[styles.block, styles.goalCard, animatedStyle]} />

            <View style={styles.addButtonRow}>
              <Animated.View style={[styles.block, styles.addButton, animatedStyle]} />
            </View>

            <View style={styles.recentHeader}>
              <Animated.View style={[styles.block, styles.recentTitle, animatedStyle]} />
              <Animated.View style={[styles.block, styles.recentAction, animatedStyle]} />
            </View>

            <Animated.View style={[styles.block, styles.recentCard, animatedStyle]} />
          </View>
        </SafeAreaView>
      </View>
    </>
  );
};

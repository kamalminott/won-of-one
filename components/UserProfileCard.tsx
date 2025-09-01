import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface UserProfileCardProps {
  userName: string;
  handedness: string;
  weapon: string;
  matchesPlayed: number;
  winCount: number;
  winRate: number;
  pointsScored: number;
  currentStreak: number;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userName,
  handedness,
  weapon,
  matchesPlayed,
  winCount,
  winRate,
  pointsScored,
  currentStreak,
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    profileCard: {
      backgroundColor: '#2A2A2A',
      shadowColor: '#6C5CE7',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.04,
      shadowRadius: 30,
      elevation: 8,
      marginHorizontal: width * 0.04,
      marginTop: height * 0.02,
      padding: width * 0.04,
      borderRadius: width * 0.05,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileImage: {
      width: width * 0.13,
      height: width * 0.13,
      borderRadius: width * 0.065,
      backgroundColor: '#393939',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInfo: {
      flex: 1,
      marginLeft: width * 0.04,
    },
    userName: {
      fontSize: width * 0.04,
      fontWeight: '600',
      color: 'white',
    },
    userHandedness: {
      fontSize: width * 0.035,
      color: '#9D9D9D',
      marginTop: height * 0.005,
    },
    weaponTag: {
      backgroundColor: '#393939',
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.01,
      paddingHorizontal: width * 0.025,
      paddingVertical: height * 0.008,
      borderRadius: width * 0.15,
    },
    weaponText: {
      fontSize: width * 0.035,
      fontWeight: '500',
      color: 'white',
    },
    divider: {
      height: 1,
      backgroundColor: '#464646',
      marginVertical: height * 0.015,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },

    statNumber: {
      fontSize: width * 0.05,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.005,
    },
    statLabel: {
      fontSize: width * 0.03,
      color: '#9D9D9D',
      textAlign: 'center',
      marginTop: height * 0.008,
      width: width * 0.15,
    },
    statDivider: {
      width: 1,
      height: height * 0.04,
      backgroundColor: '#464646',
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.01,
    },
    statPercentage: {
      fontSize: width * 0.035,
      color: '#9D9D9D',
      fontWeight: '400',
    },
  });

  return (
    <View style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View style={styles.profileImage}>
          <Ionicons name="person" size={width * 0.06} color="white" />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userHandedness}>{handedness}</Text>
        </View>
        <View style={styles.weaponTag}>
          <Ionicons name="flash" size={width * 0.035} color="white" />
          <Text style={styles.weaponText}>{weapon}</Text>
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{matchesPlayed}</Text>
          <Text style={styles.statLabel}>Matches Played</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <View style={styles.statRow}>
            <Text style={styles.statNumber}>{winCount}</Text>
            <Text style={styles.statPercentage}>({winRate}%)</Text>
          </View>
          <Text style={styles.statLabel}>Win & Win Rate%</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{pointsScored}</Text>
          <Text style={styles.statLabel}>Points Scored</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{currentStreak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
      </View>
    </View>
  );
};

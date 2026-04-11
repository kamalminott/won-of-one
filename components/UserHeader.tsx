import { Colors } from '@/constants/Colors';
import { getCountryFlagEmoji } from '@/lib/countryUtils';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface UserHeaderProps {
  userName: string;
  streak: number;
  avatarUrl?: string | null;
  countryCode?: string | null;
  onSettingsPress: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  userName,
  streak,
  avatarUrl,
  countryCode,
  onSettingsPress,
}) => {
  const { width, height } = useWindowDimensions();

  const handleProfilePress = () => {
    router.push('/(tabs)/profile');
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: height * 0.005,
      paddingHorizontal: 0,
      width: '100%',
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: width * 0.03,
    },
    textAndCountryRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: width * 0.02,
    },
    avatar: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: Colors.purple.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.025,
    },
    countryContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: width * 0.095,
      flexShrink: 0,
    },
    countryCircle: {
      width: width * 0.058,
      height: width * 0.058,
      borderRadius: width * 0.029,
      backgroundColor: Colors.gray.medium,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.004,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    countryFlag: {
      fontSize: width * 0.032,
    },
    countryCode: {
      fontSize: width * 0.023,
      color: Colors.gray.light,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    avatarText: {
      color: 'white',
      fontSize: width * 0.04,
      fontWeight: '700',
    },
    textContainer: {
      flex: 1,
    },
    greeting: {
      fontSize: width * 0.042,
      fontWeight: '700',
      color: 'white',
      marginBottom: height * 0.003,
    },
    subtitle: {
      fontSize: width * 0.03,
      color: Colors.gray.light,
      fontWeight: '500',
      marginBottom: height * 0.006,
    },
    streakContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: width * 0.01,
    },
    fireEmoji: {
      fontSize: width * 0.035,
    },
    streakText: {
      fontSize: width * 0.03,
      color: Colors.yellow.accent,
      fontWeight: '600',
    },
    settingsButton: {
      width: width * 0.075,
      height: width * 0.075,
      borderRadius: width * 0.0375,
      backgroundColor: Colors.gray.medium,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    settingsIcon: {
      fontSize: width * 0.045,
    },
  });

  const trimmedName = userName.trim();
  const firstName = trimmedName ? trimmedName.split(' ')[0] : '';
  const greeting = firstName ? `Hi, ${firstName}` : 'Hi';
  const avatarInitial = trimmedName ? trimmedName.charAt(0) : '';
  const normalizedCountryCode = countryCode?.trim().toUpperCase() || null;
  const countryFlag = getCountryFlagEmoji(normalizedCountryCode);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.userInfo} onPress={handleProfilePress} activeOpacity={0.7}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: width * 0.04,
              }}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          )}
        </View>
        <View style={styles.textAndCountryRow}>
          <View style={styles.textContainer}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.subtitle}>Your Daily Fitness Goals</Text>
          </View>
          {normalizedCountryCode && countryFlag ? (
            <View style={styles.countryContainer}>
              <View style={styles.countryCircle}>
                <Text style={styles.countryFlag}>{countryFlag}</Text>
              </View>
              <Text style={styles.countryCode}>{normalizedCountryCode}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
        <Ionicons name="settings-outline" size={width * 0.045} color="white" />
      </TouchableOpacity>
    </View>
  );
};

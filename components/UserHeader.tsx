import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface UserHeaderProps {
  userName: string;
  streak: number;
  avatarUrl?: string | null;
  onSettingsPress: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  userName,
  streak,
  avatarUrl,
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
    avatar: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.04,
      backgroundColor: Colors.purple.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: width * 0.025,
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
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>Hi, {userName.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>Your Daily Fitness Goals</Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
        <Ionicons name="settings-outline" size={width * 0.045} color="white" />
      </TouchableOpacity>
    </View>
  );
};

import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UserHeaderProps {
  userName: string;
  avatarUrl?: string;
  streak: number;
  onSettingsPress: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  userName,
  avatarUrl,
  streak,
  onSettingsPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          ) : (
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>Hi, {userName}</Text>
          <Text style={styles.subtitle}>Your Daily Fitness Goals</Text>
          <View style={styles.streakContainer}>
            <Text style={styles.fireEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streak} day streak</Text>
          </View>
        </View>
      </View>
      
      <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
    width: '100%',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.purple.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray.light,
    fontWeight: '500',
    marginBottom: 6,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fireEmoji: {
    fontSize: 14,
  },
  streakText: {
    fontSize: 12,
    color: Colors.yellow.accent,
    fontWeight: '600',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray.medium,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsIcon: {
    fontSize: 18,
  },
});

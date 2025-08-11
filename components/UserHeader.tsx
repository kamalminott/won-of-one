import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UserHeaderProps {
  userName: string;
  avatarUrl?: string;
  onSettingsPress: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  userName,
  avatarUrl,
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
    marginBottom: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.purple.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray.light,
    fontWeight: '500',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
});

import { BackButton } from '@/components/BackButton';
import { UserProfileCard } from '@/components/UserProfileCard';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // Helper function to get stable dimensions
  const getDimension = (percentage: number, base: number) => {
    return Math.round(base * percentage);
  };
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleLogout = () => {
    // TODO: Implement logout logic
    console.log('Logging out...');
    router.push('/login');
  };

  // Load profile data on component mount
  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    await Promise.all([
      loadProfileImage(),
      loadUserName()
    ]);
  };

  const loadProfileImage = async () => {
    try {
      const savedImage = await AsyncStorage.getItem('user_profile_image');
      if (savedImage) {
        setProfileImage(savedImage);
      }
    } catch (error) {
      console.error('Error loading profile image:', error);
    }
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Select Profile Picture',
      'Choose how you want to set your profile picture',
      [
        {
          text: 'Camera',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Photo Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Remove Picture',
          onPress: () => removeProfileImage(),
          style: 'destructive',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Photo library permission is required to select images.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfileImage(imageUri);
        await AsyncStorage.setItem('user_profile_image', imageUri);
        console.log('✅ Profile image saved to AsyncStorage');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const removeProfileImage = async () => {
    try {
      setProfileImage(null);
      await AsyncStorage.removeItem('user_profile_image');
      console.log('✅ Profile image removed from AsyncStorage');
    } catch (error) {
      console.error('Error removing profile image:', error);
    }
  };

  const loadUserName = async () => {
    try {
      const savedName = await AsyncStorage.getItem('user_name');
      if (savedName) {
        setUserName(savedName);
      } else {
        // Default to a generic name if no saved name
        setUserName('Jane Smith');
      }
    } catch (error) {
      console.error('Error loading user name:', error);
      setUserName('Jane Smith');
    }
  };

  const saveUserName = async (newName: string) => {
    try {
      setUserName(newName);
      await AsyncStorage.setItem('user_name', newName);
      console.log('✅ User name saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving user name:', error);
    }
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    if (userName.trim()) {
      saveUserName(userName.trim());
      setIsEditingName(false);
    }
  };

  const handleNameCancel = () => {
    // Reset to saved name
    loadUserName();
    setIsEditingName(false);
  };

  return (
    <SafeAreaView style={[styles.container, {
      paddingBottom: insets.bottom,
      backgroundColor: '#171717'
    }]}>
      {/* Header */}
      <View style={[styles.header, {
        height: height * 0.08,
        paddingHorizontal: width * 0.04,
        paddingVertical: height * 0.01
      }]}>
        <BackButton onPress={handleBack} />
        <Text style={[styles.headerTitle, { fontSize: width * 0.05 }]}>Profile</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        <UserProfileCard
          userName={userName}
          handedness="Right-handed"
          weapon="Sword"
          matchesPlayed={24}
          winCount={15}
          winRate={60}
          pointsScored={186}
          currentStreak={6}
          profileImage={profileImage}
          onImagePress={handleImagePicker}
        />

        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>24</Text>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Matches Played</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>15 (60%)</Text>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Win & Win Rate%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>186</Text>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Points Scored</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>6</Text>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Current Streak</Text>
          </View>
        </View>

      {/* Active Goals Section */}
      <View style={[styles.section, {
        marginHorizontal: width * 0.04,
        marginTop: height * 0.02,
        padding: width * 0.04,
        borderRadius: width * 0.05
      }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: width * 0.045 }]}>Active Goals</Text>
          <TouchableOpacity>
            <Text style={[styles.viewAllText, { fontSize: width * 0.03 }]}>View All</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.goalsContainer}>
          <View style={[styles.goalCard, {
            width: width * 0.42,
            padding: width * 0.03,
            borderRadius: width * 0.05
          }]}>
            <View style={[styles.progressCircle, {
              width: width * 0.18,
              height: width * 0.18,
              borderRadius: width * 0.09
            }]}>
              <Text style={[styles.progressText, { fontSize: width * 0.04 }]}>9/20</Text>
            </View>
            <Text style={[styles.goalText, { fontSize: width * 0.035 }]}>Play 20 matches</Text>
          </View>
          
          <View style={[styles.goalCard, {
            width: width * 0.42,
            padding: width * 0.03,
            borderRadius: width * 0.05
          }]}>
            <View style={[styles.progressCircle, {
              width: width * 0.18,
              height: width * 0.18,
              borderRadius: width * 0.09
            }]}>
              <Text style={[styles.progressText, { fontSize: width * 0.04 }]}>30/50</Text>
            </View>
            <Text style={[styles.goalText, { fontSize: width * 0.035 }]}>Score 50 points</Text>
          </View>
        </View>
      </View>

      {/* Achievements Section */}
      <View style={[styles.section, {
        marginHorizontal: width * 0.04,
        marginTop: height * 0.02,
        padding: width * 0.04,
        borderRadius: width * 0.05
      }]}>
        <Text style={[styles.sectionTitle, { fontSize: width * 0.045 }]}>Achievements</Text>
        
        <View style={styles.achievementsContainer}>
          <View style={styles.achievementItem}>
            <View style={[styles.achievementIcon, {
              width: width * 0.14,
              height: width * 0.14,
              borderRadius: width * 0.07
            }]}>
              <Ionicons name="trophy" size={width * 0.06} color="white" />
            </View>
            <Text style={[styles.achievementText, { fontSize: width * 0.035 }]}>First Win</Text>
          </View>
          
          <View style={styles.achievementItem}>
            <View style={[styles.achievementIcon, {
              width: width * 0.14,
              height: width * 0.14,
              borderRadius: width * 0.07
            }]}>
              <Ionicons name="fitness" size={width * 0.06} color="white" />
            </View>
            <Text style={[styles.achievementText, { fontSize: width * 0.035 }]}>Perfect Bout</Text>
          </View>
          
          <View style={styles.achievementItem}>
            <View style={[styles.achievementIcon, {
              width: width * 0.14,
              height: width * 0.14,
              borderRadius: width * 0.07
            }]}>
              <Ionicons name="medal" size={width * 0.06} color="white" />
            </View>
            <Text style={[styles.achievementText, { fontSize: width * 0.035 }]}>10 Wins in a Season</Text>
          </View>
        </View>
      </View>

      {/* Account Information Section */}
      <View style={[styles.section, {
        marginHorizontal: width * 0.04,
        marginTop: height * 0.02,
        padding: width * 0.04,
        borderRadius: width * 0.05
      }]}>
        <Text style={[styles.sectionTitle, { fontSize: width * 0.045 }]}>Account Information</Text>
        
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07
          }]}>
            <Ionicons name="mail" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Email Address</Text>
            <Text style={[styles.infoValue, { fontSize: width * 0.035 }]}>janesmith123@gmail.com</Text>
          </View>
        </View>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <TouchableOpacity style={styles.infoItem} onPress={handleNameEdit}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07
          }]}>
            <Ionicons name="person" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Name</Text>
            <Text style={[styles.infoValue, { fontSize: width * 0.035 }]}>
              {userName}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9D9D9D" />
        </TouchableOpacity>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07
          }]}>
            <Ionicons name="key" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>User ID</Text>
            <Text style={[styles.infoValue, { fontSize: width * 0.035 }]}>#12345678</Text>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={[styles.section, {
        marginHorizontal: width * 0.04,
        marginTop: height * 0.02,
        padding: width * 0.04,
        borderRadius: width * 0.05
      }]}>
        <Text style={[styles.sectionTitle, { fontSize: width * 0.045 }]}>Settings</Text>
        
        <TouchableOpacity style={styles.infoItem}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07
          }]}>
            <Ionicons name="lock-closed" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Change Password</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9D9D9D" />
        </TouchableOpacity>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07
          }]}>
            <Ionicons name="notifications" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#181818', true: '#6250F2' }}
            thumbColor={notificationsEnabled ? '#FFFFFF' : '#3D3D3D'}
          />
        </View>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07
          }]}>
            <Ionicons name="moon" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Dark Mode</Text>
          </View>
          <Switch
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
            trackColor={{ false: '#181818', true: '#6250F2' }}
            thumbColor={darkModeEnabled ? '#FFFFFF' : '#3D3D3D'}
          />
        </View>
      </View>

      </ScrollView>

      {/* Log Out Button */}
      <TouchableOpacity 
        style={[styles.logoutButton, {
          marginHorizontal: width * 0.04,
          marginTop: height * 0.03,
          marginBottom: height * 0.02,
          height: height * 0.06,
          borderRadius: width * 0.04
        }]}
        onPress={handleLogout}
      >
        <LinearGradient
          colors={['#6C5CE7', '#5741FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.logoutGradient, {
            borderRadius: width * 0.04
          }]}
        >
          <View style={[styles.logoutIcon, {
            width: width * 0.085,
            height: width * 0.085,
            borderRadius: width * 0.03
          }]}>
            <Ionicons name="log-out-outline" size={width * 0.04} color="#292D32" />
          </View>
          <Text style={[styles.logoutText, { fontSize: width * 0.04 }]}>Log Out</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#212121',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontWeight: '700',
    color: 'white',
  },
  settingsButton: {
    padding: 8,
  },
  profileCard: {
    backgroundColor: '#2A2A2A',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontWeight: '600',
    color: 'white',
  },
  userHandedness: {
    color: '#9D9D9D',
    marginTop: 4,
  },
  weaponTag: {
    backgroundColor: '#393939',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  weaponText: {
    fontWeight: '500',
    color: 'white',
  },
  divider: {
    height: 1,
    backgroundColor: '#464646',
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
    fontWeight: '600',
    color: 'white',
  },
  statLabel: {
    color: '#9D9D9D',
    textAlign: 'center',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#464646',
  },
  section: {
    backgroundColor: '#2A2A2A',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '500',
    color: 'white',
  },
  viewAllText: {
    color: '#9D9D9D',
    textDecorationLine: 'underline',
  },
  goalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalCard: {
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  progressCircle: {
    backgroundColor: '#434343',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontWeight: '700',
    color: 'white',
  },
  goalText: {
    color: '#9D9D9D',
    textAlign: 'center',
  },
  achievementsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  achievementItem: {
    alignItems: 'center',
    flex: 1,
  },
  achievementIcon: {
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achievementText: {
    color: '#9D9D9D',
    textAlign: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoIcon: {
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontWeight: '600',
    color: 'white',
  },
  infoValue: {
    color: '#9D9D9D',
    marginTop: 4,
  },
  logoutButton: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  logoutGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoutIcon: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontWeight: '600',
    color: 'white',
  },
});

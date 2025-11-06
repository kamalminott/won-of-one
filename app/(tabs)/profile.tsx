import { BackButton } from '@/components/BackButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { matchService, userService } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, userName, setUserName, loadUserName, profileImage, setProfileImage } = useAuth();
  
  // Helper function to get stable dimensions
  const getDimension = (percentage: number, base: number) => {
    return Math.round(base * percentage);
  };
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [handedness, setHandedness] = useState<string>('right');
  const [preferredWeapon, setPreferredWeapon] = useState<string>('foil');
  const [showHandednessPicker, setShowHandednessPicker] = useState(false);
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  
  // Match statistics state
  const [matchStats, setMatchStats] = useState({
    totalMatches: 0,
    wins: 0,
    winRate: 0,
    totalPoints: 0,
    currentStreak: 0
  });

  const handleBack = () => {
    router.back();
  };

  const handleLogout = () => {
    // TODO: Implement logout logic
    console.log('Logging out...');
    router.push('/login');
  };

  // Fetch user match statistics
  const fetchMatchStatistics = async () => {
    if (!user?.id) return;

    try {
      // Get all user matches (using high limit to get all matches)
      const matches = await matchService.getRecentMatches(user.id, 1000);
      
      console.log('📊 Profile statistics debug:', {
        userId: user.id,
        matchesFound: matches?.length || 0,
        matches: matches
      });
      
      if (matches) {
        const totalMatches = matches.length;
        
        // Debug each match's result field
        console.log('🔍 Match results debug:');
        matches.forEach((match, index) => {
          console.log(`Match ${index + 1}:`, {
            matchId: match.id,
            isWin: match.isWin,
            youScore: match.youScore,
            opponentScore: match.opponentScore,
            opponentName: match.opponentName
          });
        });
        
        // Use SimpleMatch structure: isWin instead of result === 'win'
        const wins = matches.filter(match => match.isWin === true).length;
        const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
        
        console.log('📊 Calculated statistics:', {
          totalMatches,
          wins,
          winRate,
          winsFilter: matches.filter(match => match.isWin === true)
        });
        
        // Calculate total points scored across all matches (use youScore instead of final_score)
        const totalPoints = matches.reduce((sum, match) => sum + (match.youScore || 0), 0);
        
        // Calculate current streak (consecutive wins from most recent matches)
        let currentStreak = 0;
        for (let i = matches.length - 1; i >= 0; i--) {
          if (matches[i].isWin === true) {
            currentStreak++;
          } else {
            break;
          }
        }

        setMatchStats({
          totalMatches,
          wins,
          winRate,
          totalPoints,
          currentStreak
        });
      }
    } catch (error) {
      console.error('Error fetching match statistics:', error);
    }
  };

  // Load match statistics when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      fetchMatchStatistics();
      loadUserProfile();
    }
  }, [user?.id]);

  // Load user profile data (handedness and weapon)
  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const userData = await userService.getUserById(user.id);
      if (userData) {
        if (userData.handedness) {
          setHandedness(userData.handedness);
        }
        if (userData.preferred_weapon) {
          setPreferredWeapon(userData.preferred_weapon);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Parse userName into first and last name
  useEffect(() => {
    if (userName) {
      const nameParts = userName.trim().split(' ');
      if (nameParts.length > 1) {
        setFirstName(nameParts[0]);
        setLastName(nameParts.slice(1).join(' '));
      } else {
        setFirstName(nameParts[0] || '');
        setLastName('');
      }
    }
  }, [userName]);

  // Track screen view
  useFocusEffect(
    useCallback(() => {
      analytics.screen('Profile');
    }, [])
  );

  // No need to load profile data since it's handled by context

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
        await setProfileImage(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const removeProfileImage = async () => {
    try {
      await setProfileImage(null);
    } catch (error) {
      console.error('Error removing profile image:', error);
    }
  };

  const handleNameEdit = () => {
    // Parse current userName into first and last name
    const nameParts = userName.trim().split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setShowNameEditModal(true);
  };

  const handleNameSave = async () => {
    // Helper function to capitalize first letter of each word
    const capitalizeName = (name: string): string => {
      return name
        .trim()
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };
    
    const capitalizedFirst = capitalizeName(firstName);
    const capitalizedLast = capitalizeName(lastName);
    const fullName = `${capitalizedFirst} ${capitalizedLast}`.trim();
    
    if (fullName) {
      if (user?.id) {
        // Save to database first (source of truth)
        const updatedUser = await userService.updateUser(user.id, { name: fullName });
        if (updatedUser?.name) {
          // Update Supabase Auth user metadata (display_name)
          try {
            const { error: updateError } = await supabase.auth.updateUser({
              data: { display_name: fullName },
            });
            if (updateError) {
              console.warn('⚠️ Failed to update auth display_name:', updateError);
            } else {
              console.log('✅ Auth display_name updated:', fullName);
            }
          } catch (error) {
            console.warn('⚠️ Error updating auth display_name:', error);
          }
          
          // Then sync to AsyncStorage
          await setUserName(updatedUser.name);
          console.log('✅ Name updated in database and synced to AsyncStorage:', updatedUser.name);
        } else {
          // Fallback: save to AsyncStorage even if DB update fails
          await setUserName(fullName);
          console.warn('⚠️ Database update may have failed, saved to AsyncStorage only');
        }
        analytics.profileUpdate({ field: 'name' });
        analytics.identify(user.id, { name: fullName });
      } else {
        // No user ID, just save to AsyncStorage
        await setUserName(fullName);
      }
      setShowNameEditModal(false);
    } else {
      Alert.alert('Error', 'Please enter at least a first name.');
    }
  };

  const handleNameCancel = () => {
    // Reset to current userName
    const nameParts = userName.trim().split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setShowNameEditModal(false);
  };

  // Handledness handlers
  const handleHandednessSelect = async (value: string) => {
    setHandedness(value);
    setShowHandednessPicker(false);
    
    if (user?.id) {
      try {
        await userService.updateUser(user.id, { handedness: value });
        analytics.profileUpdate({ field: 'handedness' });
        analytics.identify(user.id, { handedness: value });
        console.log('✅ Handedness updated:', value);
      } catch (error) {
        console.error('Error updating handedness:', error);
        Alert.alert('Error', 'Failed to update handedness. Please try again.');
      }
    }
  };

  // Weapon handlers
  const handleWeaponSelect = async (value: string) => {
    setPreferredWeapon(value);
    setShowWeaponPicker(false);
    
    if (user?.id) {
      try {
        await userService.updateUser(user.id, { preferred_weapon: value });
        analytics.profileUpdate({ field: 'preferred_weapon' });
        analytics.identify(user.id, { preferred_weapon: value });
        console.log('✅ Preferred weapon updated:', value);
      } catch (error) {
        console.error('Error updating weapon:', error);
        Alert.alert('Error', 'Failed to update weapon. Please try again.');
      }
    }
  };

  // Format handedness for display
  const getHandednessDisplay = (value: string) => {
    return value === 'left' ? 'Left-handed' : 'Right-handed';
  };

  // Format weapon for display
  const getWeaponDisplay = (value: string) => {
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  return (
    <SafeAreaView style={[styles.container, {
      paddingBottom: insets.bottom,
      backgroundColor: '#171717'
    }]}>
      {/* Overlay to color the OS status bar area without affecting layout */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: '#212121' }} />
      {/* Header */}
      <View style={[styles.header, {
        height: height * 0.08,
        paddingHorizontal: width * 0.04,
        paddingVertical: height * 0.005
      }]}> 
        <BackButton onPress={handleBack} />
        <Text style={[styles.headerTitle, { fontSize: width * 0.05 }]}>Profile</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={width * 0.06} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: height * 0.030 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Card */}
        <View style={[styles.profileCard, {
          marginHorizontal: width * 0.04,
          marginTop: height * 0.01,
          padding: width * 0.04,
          borderRadius: width * 0.05
        }]}>
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={[styles.profileImage, {
              width: width * 0.13,
              height: width * 0.13,
              borderRadius: width * 0.065
            }]}
            onPress={handleImagePicker}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: width * 0.065,
                }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={width * 0.06} color="white" />
            )}
          </TouchableOpacity>
                  <View style={[styles.profileInfo, { marginLeft: width * 0.04 }]}>
            <Text style={[styles.userName, { fontSize: width * 0.04 }]}>
              {userName}
            </Text>
          <Text style={[styles.userHandedness, { fontSize: width * 0.035 }]}>
            {getHandednessDisplay(handedness)}
          </Text>
        </View>
          <View style={[styles.weaponTag, {
            paddingHorizontal: width * 0.025,
            paddingVertical: height * 0.008,
            borderRadius: width * 0.15
          }]}>
            <Ionicons name="flash" size={width * 0.035} color="white" />
            <Text style={[styles.weaponText, { fontSize: width * 0.035 }]}>
              {getWeaponDisplay(preferredWeapon)}
            </Text>
          </View>
        </View>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>{matchStats.totalMatches}</Text>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Matches Played</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statRow}>
              <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>{matchStats.wins}</Text>
              <Text style={[styles.statPercentage, { fontSize: width * 0.035 }]}>({matchStats.winRate}%)</Text>
            </View>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Win & Win Rate%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>{matchStats.totalPoints}</Text>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Points{`\n`}Scored</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { fontSize: width * 0.05 }]}>{matchStats.currentStreak}</Text>
            <Text style={[styles.statLabel, { fontSize: width * 0.03 }]}>Current{`\n`}Streak</Text>
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
            borderRadius: width * 0.07,
            marginRight: width * 0.04
          }]}>
            <Ionicons name="mail" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Email Address</Text>
            <Text style={[styles.infoValue, { fontSize: width * 0.035 }]}>
              {user?.email || 'Not logged in'}
            </Text>
          </View>
        </View>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <TouchableOpacity style={styles.infoItem} onPress={handleNameEdit}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07,
            marginRight: width * 0.04
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
        
        <TouchableOpacity 
          style={styles.infoItem} 
          onPress={() => setShowHandednessPicker(true)}
        >
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07,
            marginRight: width * 0.04
          }]}>
            <Ionicons name="hand-right-outline" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Handedness</Text>
            <Text style={[styles.infoValue, { fontSize: width * 0.035 }]}>
              {getHandednessDisplay(handedness)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9D9D9D" />
        </TouchableOpacity>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <TouchableOpacity 
          style={styles.infoItem} 
          onPress={() => setShowWeaponPicker(true)}
        >
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07,
            marginRight: width * 0.04
          }]}>
            <Ionicons name="flash" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Preferred Weapon</Text>
            <Text style={[styles.infoValue, { fontSize: width * 0.035 }]}>
              {getWeaponDisplay(preferredWeapon)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9D9D9D" />
        </TouchableOpacity>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <View style={styles.infoItem}>
          <View style={[styles.infoIcon, {
            width: width * 0.14,
            height: width * 0.14,
            borderRadius: width * 0.07,
            marginRight: width * 0.04
          }]}>
            <Ionicons name="key" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>User ID</Text>
            <Text style={[styles.infoValue, { fontSize: width * 0.035 }]}>
              {user?.id ? `#${user.id.slice(0, 8)}` : 'Not logged in'}
            </Text>
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
            borderRadius: width * 0.07,
            marginRight: width * 0.04
          }]}>
            <Ionicons name="lock-closed" size={width * 0.06} color="white" />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { fontSize: width * 0.04 }]}>Change Password</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9D9D9D" />
        </TouchableOpacity>
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <ToggleSwitch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          label="Notifications"
          icon="notifications"
        />
        
        <View style={[styles.divider, { marginVertical: height * 0.015 }]} />
        
        <ToggleSwitch
          value={darkModeEnabled}
          onValueChange={setDarkModeEnabled}
          label="Dark Mode"
          icon="moon"
        />
      </View>

      {/* Log Out Button */}
      <TouchableOpacity 
        style={[styles.logoutButton, {
          marginHorizontal: width * 0.04,
          marginTop: height * 0.02,
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

      </ScrollView>

      {/* Handedness Picker Modal */}
      {showHandednessPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Handedness</Text>
            <TouchableOpacity 
              style={[styles.modalOption, handedness === 'left' && styles.modalOptionSelected]}
              onPress={() => handleHandednessSelect('left')}
            >
              <Text style={[styles.modalOptionText, handedness === 'left' && styles.modalOptionTextSelected]}>
                Left-handed
              </Text>
              {handedness === 'left' && <Ionicons name="checkmark" size={20} color="#6C5CE7" />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalOption, handedness === 'right' && styles.modalOptionSelected]}
              onPress={() => handleHandednessSelect('right')}
            >
              <Text style={[styles.modalOptionText, handedness === 'right' && styles.modalOptionTextSelected]}>
                Right-handed
              </Text>
              {handedness === 'right' && <Ionicons name="checkmark" size={20} color="#6C5CE7" />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCancel}
              onPress={() => setShowHandednessPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Weapon Picker Modal */}
      {showWeaponPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Preferred Weapon</Text>
            <TouchableOpacity 
              style={[styles.modalOption, preferredWeapon === 'foil' && styles.modalOptionSelected]}
              onPress={() => handleWeaponSelect('foil')}
            >
              <Text style={[styles.modalOptionText, preferredWeapon === 'foil' && styles.modalOptionTextSelected]}>
                Foil
              </Text>
              {preferredWeapon === 'foil' && <Ionicons name="checkmark" size={20} color="#6C5CE7" />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalOption, preferredWeapon === 'epee' && styles.modalOptionSelected]}
              onPress={() => handleWeaponSelect('epee')}
            >
              <Text style={[styles.modalOptionText, preferredWeapon === 'epee' && styles.modalOptionTextSelected]}>
                Épée
              </Text>
              {preferredWeapon === 'epee' && <Ionicons name="checkmark" size={20} color="#6C5CE7" />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalOption, preferredWeapon === 'sabre' && styles.modalOptionSelected]}
              onPress={() => handleWeaponSelect('sabre')}
            >
              <Text style={[styles.modalOptionText, preferredWeapon === 'sabre' && styles.modalOptionTextSelected]}>
                Sabre
              </Text>
              {preferredWeapon === 'sabre' && <Ionicons name="checkmark" size={20} color="#6C5CE7" />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalCancel}
              onPress={() => setShowWeaponPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Name Edit Modal */}
      {showNameEditModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Name</Text>
            
            <View style={styles.nameInputContainer}>
              <Text style={styles.nameInputLabel}>First Name</Text>
              <TextInput
                style={styles.nameInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#9D9D9D"
                autoFocus
                maxLength={30}
              />
            </View>
            
            <View style={styles.nameInputContainer}>
              <Text style={styles.nameInputLabel}>Last Name</Text>
              <TextInput
                style={styles.nameInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor="#9D9D9D"
                maxLength={30}
              />
            </View>
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleNameCancel}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleNameSave}
              >
                <Text style={styles.modalButtonSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  scrollContent: {
    // paddingBottom moved to inline style
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
    // marginLeft moved to inline style
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
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statPercentage: {
    color: '#9D9D9D',
    fontWeight: '400',
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
    justifyContent: 'space-around',
    alignItems: 'flex-start',
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
    // marginRight moved to inline style
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    width: '80%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#393939',
  },
  modalOptionSelected: {
    backgroundColor: '#3A2F4F',
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#9D9D9D',
    fontWeight: '500',
  },
  modalOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#9D9D9D',
    fontWeight: '500',
  },
  nameInputContainer: {
    marginBottom: 20,
  },
  nameInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9D9D9D',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#393939',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#464646',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#393939',
  },
  modalButtonSave: {
    backgroundColor: '#6C5CE7',
  },
  modalButtonCancelText: {
    fontSize: 16,
    color: '#9D9D9D',
    fontWeight: '600',
  },
  modalButtonSaveText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

interface ProgressCardProps {
  title: string;
  current: number;
  total: number;
  subtitle?: string;
  daysRemaining?: number;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  current,
  total,
  subtitle,
  daysRemaining,
}) => {
  const { width, height } = useWindowDimensions();
  const progress = current / total;
  const [showModal, setShowModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('Conditioning');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const activityOptions = ['Footwork', '1-2-1 Lessons', 'Recovery', 'Video Review'];
  
  const styles = StyleSheet.create({
    container: {
      width: 358,
      height: 172,
      alignSelf: 'center',
      marginBottom: height * 0.02,
      position: 'relative',
      overflow: 'visible',
    },
    mainCard: {
      flex: 1,
      borderRadius: 20,
      borderWidth: 4,
      borderColor: '#D1A3F0',
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 8,
    },
    // Days Left Pill
    daysLeftPill: {
      position: 'absolute',
      top: -17, // Half outside the card
      left: '50%',
      marginLeft: -62.5, // Half of pill width (125px / 2)
      width: 125,
      height: 34,
      backgroundColor: '#4D4159',
      borderWidth: 2,
      borderColor: '#D1A3F0',
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 7,
      zIndex: 10,
    },
    daysLeftText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 20,
      color: '#FFFFFF',
      marginTop: -2,
    },
    // Main content area
    mainContent: {
      position: 'absolute',
      left: 32,
      top: 40, // Space for the pill
      width: 211,
      height: 111,
    },
    title: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 28,
      color: '#FFFFFF',
      marginBottom: 4,
    },
    progressText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 28,
      color: '#FFFFFF',
      marginBottom: 16,
    },
    progressBar: {
      width: 211,
      height: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 60,
      marginBottom: 16,
    },
    progressFill: {
      height: 12,
      backgroundColor: '#FFFFFF',
      borderRadius: 60,
      width: `${progress * 100}%`,
    },
    subtitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 19,
      color: '#FFFFFF',
    },
    // Control bar
    controlBar: {
      position: 'absolute',
      right: 14,
      top: 28,
      width: 44,
      height: 122,
      backgroundColor: '#625971',
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    controlButton: {
      width: 36,
      height: 36,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    upButton: {
      backgroundColor: '#4A4159',
    },
    downButton: {
      backgroundColor: '#42405A',
    },
    plusOneText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 22,
      color: '#FFFFFF',
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: '#171717',
    },
    modalHeader: {
      width: 390,
      height: 124,
      backgroundColor: '#212121',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 60,
    },
    headerButton: {
      width: 44,
      height: 44,
      backgroundColor: '#343434',
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 27,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    modalCard: {
      position: 'absolute',
      width: 358,
      height: 444,
      left: '50%',
      marginLeft: -179, // Half of width
      top: 144,
      backgroundColor: '#2A2A2A',
      borderRadius: 20,
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 8,
      padding: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 28,
      color: '#FFFFFF',
    },
    closeButton: {
      width: 36,
      height: 36,
      backgroundColor: '#393939',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    dropdown: {
      width: 150,
      height: 40,
      backgroundColor: '#393939',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    dropdownText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 22,
      color: '#FFFFFF',
    },
    dropdownMenu: {
      position: 'absolute',
      top: 44,
      left: 0,
      width: 150,
      backgroundColor: '#393939',
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    },
    dropdownItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedDropdownItem: {
      backgroundColor: 'rgba(108, 92, 231, 0.3)',
    },
    dropdownItemText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 20,
      color: '#FFFFFF',
    },
    selectedDropdownItemText: {
      fontWeight: '700',
      color: '#FFFFFF',
    },
    dateRange: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 19,
      color: '#CDCDCD',
      marginBottom: 16,
    },
    targetTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 28,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 16,
    },
    sessionCounter: {
      width: 326,
      height: 62,
      backgroundColor: '#393939',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    counterButton: {
      width: 46,
      height: 46,
      backgroundColor: '#2A2A2A',
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 28,
      color: '#FFFFFF',
    },
    statusText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 19,
      color: '#CDCDCD',
      textAlign: 'center',
      marginBottom: 16,
    },
    saveButton: {
      width: 326,
      height: 50,
      backgroundColor: '#6C5CE7',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      shadowColor: 'rgba(108, 92, 231, 0.25)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 8,
    },
    saveButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 22,
      color: '#FFFFFF',
    },
    clearButton: {
      width: 326,
      height: 50,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#FF7675',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 22,
      color: '#FF7675',
    },
  });
  
  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        {/* Days Left Pill */}
        <View style={styles.daysLeftPill}>
          <Text style={styles.daysLeftText}>
            {daysRemaining || 5} Days Left
          </Text>
        </View>

        <LinearGradient
          colors={['rgba(210, 164, 241, 0.3)', 'rgba(153, 157, 249, 0.3)']}
          style={styles.mainCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Main Content */}
          <View style={styles.mainContent}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.progressText}>{`${current}/${total}`}</Text>
            
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
            
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}
          </View>

          {/* Control Bar */}
          <View style={styles.controlBar}>
            <TouchableOpacity style={[styles.controlButton, styles.upButton]}>
              <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.plusOneText}>+1</Text>
            
            <TouchableOpacity style={[styles.controlButton, styles.downButton]}>
              <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Set Weekly Target Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Set Goal Modal</Text>
            
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="settings" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <TouchableOpacity 
            style={styles.modalCard}
            activeOpacity={1}
            onPress={() => {}} // Prevent dropdown from closing when clicking card
          >
            {/* Set Weekly Target Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Set Weekly Target</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Activity Type Dropdown */}
            <View style={styles.dropdownContainer}>
              <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => setShowDropdown(!showDropdown)}
              >
                <Text style={styles.dropdownText}>{selectedActivity}</Text>
                <Ionicons 
                  name={showDropdown ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              
              {showDropdown && (
                <View style={styles.dropdownMenu}>
                  {activityOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.dropdownItem,
                        selectedActivity === option && styles.selectedDropdownItem
                      ]}
                      onPress={() => {
                        setSelectedActivity(option);
                        setShowDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        selectedActivity === option && styles.selectedDropdownItemText
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Date Range */}
            <Text style={styles.dateRange}>Week of sept 23 - sep 29 - 4 days left</Text>

            {/* Target For This Week */}
            <Text style={styles.targetTitle}>Target For This Week</Text>

            {/* Session Counter */}
            <View style={styles.sessionCounter}>
              <TouchableOpacity style={styles.counterButton}>
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              
              <Text style={styles.sessionText}>Sessions 3</Text>
              
              <TouchableOpacity style={styles.counterButton}>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Status Message */}
            <Text style={styles.statusText}>No sessions logged yet.</Text>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save Target</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear Target</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

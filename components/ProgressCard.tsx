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
      width: '100%',
      height: height * 0.14,
      marginBottom: height * 0.012,
      position: 'relative',
      overflow: 'visible',
    },
    mainCard: {
      flex: 1,
      borderRadius: width * 0.05,
      borderWidth: width * 0.01,
      borderColor: '#D1A3F0',
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: width * 0.01 },
      shadowOpacity: 1,
      shadowRadius: width * 0.075,
      elevation: 8,
    },
    // Days Left Pill
    daysLeftPill: {
      position: 'absolute',
      top: -height * 0.015, // Reduced half outside the card
      left: '50%',
      marginLeft: -width * 0.15, // Half of pill width
      width: width * 0.3,
      height: height * 0.035,
      backgroundColor: '#4D4159',
      borderWidth: width * 0.005,
      borderColor: '#D1A3F0',
      borderRadius: width * 0.035,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: width * 0.025,
      paddingVertical: height * 0.006,
      gap: width * 0.015,
      zIndex: 10,
    },
    daysLeftText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.035,
      lineHeight: height * 0.02,
      color: '#FFFFFF',
      marginTop: -height * 0.002,
    },
    // Main content area
    mainContent: {
      position: 'absolute',
      left: width * 0.08,
      top: height * 0.04, // Reduced space for the pill
      width: '60%',
      height: '70%',
    },
    title: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.045,
      lineHeight: height * 0.025,
      color: '#FFFFFF',
      marginBottom: height * 0.003,
    },
    progressText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.06,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
      marginBottom: height * 0.015,
    },
    progressBar: {
      width: '100%',
      height: height * 0.012,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: width * 0.15,
      marginBottom: height * 0.015,
    },
    progressFill: {
      height: height * 0.012,
      backgroundColor: '#FFFFFF',
      borderRadius: width * 0.15,
      width: `${progress * 100}%`,
    },
    subtitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.03,
      lineHeight: height * 0.02,
      color: '#FFFFFF',
    },
    // Control bar
    controlBar: {
      position: 'absolute',
      right: width * 0.035,
      top: height * 0.03,
      width: width * 0.11,
      height: height * 0.12,
      backgroundColor: '#625971',
      borderRadius: width * 0.15,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: height * 0.003,
    },
    controlButton: {
      width: width * 0.08,
      height: width * 0.08,
      borderRadius: width * 0.15,
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
      fontSize: width * 0.035,
      lineHeight: height * 0.025,
      color: '#FFFFFF',
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: '#171717',
    },
    modalHeader: {
      width: '100%',
      height: height * 0.15,
      backgroundColor: '#212121',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
      paddingTop: height * 0.07,
    },
    headerButton: {
      width: width * 0.11,
      height: width * 0.11,
      backgroundColor: '#343434',
      borderRadius: width * 0.055,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.034,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    modalCard: {
      position: 'absolute',
      width: '90%',
      height: height * 0.55,
      left: '5%',
      top: height * 0.18,
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.05,
      shadowColor: 'rgba(108, 92, 231, 0.04)',
      shadowOffset: { width: 0, height: width * 0.01 },
      shadowOpacity: 1,
      shadowRadius: width * 0.075,
      elevation: 8,
      padding: width * 0.05,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: height * 0.02,
    },
    sectionTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
    },
    closeButton: {
      width: width * 0.09,
      height: width * 0.09,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownContainer: {
      position: 'relative',
      marginBottom: height * 0.02,
    },
    dropdown: {
      width: width * 0.4,
      height: height * 0.05,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
    },
    dropdownText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: '#FFFFFF',
    },
    dropdownMenu: {
      position: 'absolute',
      top: height * 0.055,
      left: 0,
      width: width * 0.4,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: width * 0.005 },
      shadowOpacity: 0.25,
      shadowRadius: width * 0.02,
      elevation: 8,
      zIndex: 1000,
    },
    dropdownItem: {
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    selectedDropdownItem: {
      backgroundColor: 'rgba(108, 92, 231, 0.3)',
    },
    dropdownItemText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.025,
      color: '#FFFFFF',
    },
    selectedDropdownItemText: {
      fontWeight: '700',
      color: '#FFFFFF',
    },
    dateRange: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: '#CDCDCD',
      marginBottom: height * 0.02,
    },
    targetTitle: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: height * 0.02,
    },
    sessionCounter: {
      width: '100%',
      height: height * 0.08,
      backgroundColor: '#393939',
      borderRadius: width * 0.04,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: width * 0.04,
      marginBottom: height * 0.02,
    },
    counterButton: {
      width: width * 0.12,
      height: width * 0.12,
      backgroundColor: '#2A2A2A',
      borderRadius: width * 0.075,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.05,
      lineHeight: height * 0.035,
      color: '#FFFFFF',
    },
    statusText: {
      fontFamily: 'Articulat CF',
      fontWeight: '500',
      fontSize: width * 0.035,
      lineHeight: height * 0.024,
      color: '#CDCDCD',
      textAlign: 'center',
      marginBottom: height * 0.02,
    },
    saveButton: {
      width: '100%',
      height: height * 0.065,
      backgroundColor: '#6C5CE7',
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: height * 0.02,
      shadowColor: 'rgba(108, 92, 231, 0.25)',
      shadowOffset: { width: 0, height: width * 0.01 },
      shadowOpacity: 1,
      shadowRadius: width * 0.035,
      elevation: 8,
    },
    saveButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
      color: '#FFFFFF',
    },
    clearButton: {
      width: '100%',
      height: height * 0.065,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#FF7675',
      borderRadius: width * 0.04,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearButtonText: {
      fontFamily: 'Articulat CF',
      fontWeight: '700',
      fontSize: width * 0.04,
      lineHeight: height * 0.028,
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

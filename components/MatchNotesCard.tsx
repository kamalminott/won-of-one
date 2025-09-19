import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';

interface MatchNotesCardProps {
  notes?: string;
  onNotesChange?: (notes: string) => void;
  customStyle?: object;
  isPreview?: boolean;
  onPress?: () => void;
}

export const MatchNotesCard: React.FC<MatchNotesCardProps> = ({
  notes = '',
  onNotesChange,
  customStyle = {},
  isPreview = false,
  onPress
}) => {
  const { width, height } = useWindowDimensions();
  const [localNotes, setLocalNotes] = useState(notes);

  // Update local notes when props change
  React.useEffect(() => {
    setLocalNotes(notes);
  }, [notes]);

  const handleTextChange = (text: string) => {
    setLocalNotes(text);
    onNotesChange?.(text);
  };

  const styles = StyleSheet.create({
    container: {
      borderRadius: width * 0.02,
      padding: width * 0.04,
      marginHorizontal: width * 0.02,
      marginTop: height * 0.002,
      marginBottom: height * 0.02,
      borderWidth: 1,
      borderColor: Colors.glassyGradient.borderColor,
      overflow: 'hidden',
      ...customStyle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.015,
    },
    icon: {
      marginRight: width * 0.03,
    },
    title: {
      color: 'white',
      fontSize: Math.round(width * 0.045),
      fontWeight: '600',
    },
    inputContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.02,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      minHeight: height * 0.12,
    },
    textInput: {
      color: 'white',
      fontSize: Math.round(width * 0.04),
      padding: width * 0.03,
      textAlignVertical: 'top',
      minHeight: height * 0.12,
    },
    placeholder: {
      color: 'rgba(255, 255, 255, 0.5)',
    },
    characterCount: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: Math.round(width * 0.03),
      textAlign: 'right',
      marginTop: height * 0.005,
    },
    previewContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: width * 0.02,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      minHeight: height * 0.12,
      padding: width * 0.03,
      justifyContent: 'center',
    },
    previewText: {
      color: localNotes ? 'white' : 'rgba(255, 255, 255, 0.5)',
      fontSize: Math.round(width * 0.04),
      textAlignVertical: 'top',
      minHeight: height * 0.12,
    },
  });

  return (
    <LinearGradient
      colors={Colors.glassyGradient.colors}
      style={styles.container}
      start={Colors.glassyGradient.start}
      end={Colors.glassyGradient.end}
    >
      <View style={styles.header}>
        <Ionicons 
          name="document-text" 
          size={Math.round(width * 0.05)} 
          color="white" 
          style={styles.icon}
        />
        <Text style={styles.title}>Match Notes</Text>
      </View>
      
      {isPreview ? (
        <TouchableOpacity 
          style={styles.previewContainer} 
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.previewText}>
            {localNotes || 'Tap to add match notes...'}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={localNotes}
              onChangeText={handleTextChange}
              placeholder="Add your thoughts about this match..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline
              maxLength={500}
            />
          </View>
          
          <Text style={styles.characterCount}>
            {localNotes.length}/500
          </Text>
        </>
      )}
    </LinearGradient>
  );
};

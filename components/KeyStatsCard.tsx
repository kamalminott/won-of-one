import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface StatItem {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface KeyStatsCardProps {
  stats?: StatItem[];
  bestRun?: number;
  yellowCards?: number;
  redCards?: number;
  matchDurationSeconds?: number;
  customStyle?: object;
}

export const KeyStatsCard: React.FC<KeyStatsCardProps> = ({
  stats,
  bestRun = 0,
  yellowCards = 0,
  redCards = 0,
  matchDurationSeconds = 0,
  customStyle = {}
}) => {
  // Format match duration from seconds to MM:SS
  const formatMatchTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Create default stats with real data
  const defaultStats: StatItem[] = [
    { icon: 'flame', text: `${bestRun} Streak` },
    { icon: 'card', text: `${yellowCards}Y or ${redCards}R Cards` },
    { icon: 'time', text: `${formatMatchTime(matchDurationSeconds)} Time` },
  ];

  const displayStats = stats || defaultStats;
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      borderRadius: width * 0.02,
      padding: width * 0.04,
      marginHorizontal: width * 0.01,
      flex: 1,
      height: height * 0.22,
      marginBottom: height * 0.01,
      borderWidth: 1,
      borderColor: Colors.glassyGradient.borderColor,
      ...customStyle,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.015,
    },
    statIcon: {
      marginRight: width * 0.03,
    },
    statContent: {
      flex: 1,
      alignItems: 'flex-start',
    },
    statNumber: {
      color: 'white',
      fontSize: Math.round(width * 0.05),
      fontWeight: '700',
      marginBottom: height * 0.003,
    },
    statText: {
      color: 'white',
      fontSize: Math.round(width * 0.035),
      fontWeight: '300',
    },
  });

  return (
    <LinearGradient
      colors={Colors.glassyGradient.colors}
      style={styles.container}
      start={Colors.glassyGradient.start}
      end={Colors.glassyGradient.end}
    >
      {displayStats.map((stat, index) => {
        // Split the text to keep "1Y or 0R" together
        const words = stat.text.split(' ');
        const isSpecialCase = stat.text.includes(' or ') || stat.text.includes('Cards') || stat.text.includes('Time');
        
        let numberText, labelText;
        
        if (isSpecialCase) {
          // For "1Y or 0R Cards" -> number: "1Y or 0R", label: "Cards"
          // For "6:45 Time" -> number: "6:45", label: "Time"
          if (stat.text.includes('Cards')) {
            numberText = `${yellowCards}Y or ${redCards}R`;
            labelText = 'Cards';
          } else if (stat.text.includes('Time')) {
            numberText = formatMatchTime(matchDurationSeconds);
            labelText = 'Time';
          } else {
            numberText = words.slice(0, -1).join(' ');
            labelText = words[words.length - 1];
          }
        } else {
          // For "4 Streak" -> number: "4", label: "Streak"
          numberText = words[0];
          labelText = words.slice(1).join(' ');
        }
        
        return (
          <View key={index} style={styles.statRow}>
            <Ionicons 
              name={stat.icon} 
              size={Math.round(width * 0.06)} 
              color="white" 
              style={styles.statIcon}
            />
            <View style={styles.statContent}>
              <Text style={styles.statNumber}>{numberText}</Text>
              <Text style={styles.statText}>{labelText}</Text>
            </View>
          </View>
        );
      })}
    </LinearGradient>
  );
};

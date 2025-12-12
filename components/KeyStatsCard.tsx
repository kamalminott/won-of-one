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
  heightOverride?: number;
}

export const KeyStatsCard: React.FC<KeyStatsCardProps> = ({
  stats,
  bestRun = 0,
  yellowCards = 0,
  redCards = 0,
  matchDurationSeconds = 0,
  customStyle = {},
  heightOverride
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
  const statsCount = displayStats.length || 1;
  const baseHeight = height * 0.22;
  const containerHeight = heightOverride || (baseHeight * Math.max(1, statsCount / 3));

  // Custom overlapping cards icon component
  const OverlappingCardsIcon = () => {
    const cardSize = Math.round(width * 0.035);
    const cardWidth = cardSize * 1.2;
    const cardHeight = cardSize * 1.4;
    
    return (
      <View style={[styles.cardsContainer, { width: cardWidth + 8, height: cardHeight + 8 }]}>
        {/* Back card */}
        <View style={[
          styles.card,
          {
            width: cardWidth,
            height: cardHeight,
            backgroundColor: '#FFD700', // Gold color
            transform: [{ rotate: '-15deg' }],
            zIndex: 1,
            position: 'absolute',
            top: 0,
            left: 0,
          }
        ]} />
        {/* Front card */}
        <View style={[
          styles.card,
          {
            width: cardWidth,
            height: cardHeight,
            backgroundColor: '#FF6B6B', // Red color
            transform: [{ rotate: '5deg' }],
            zIndex: 2,
            position: 'absolute',
            top: 3,
            left: 6,
          }
        ]} />
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      borderRadius: width * 0.02,
      padding: width * 0.04,
      marginHorizontal: 0, // No margin - rowContainer handles alignment
      flex: 1,
      height: containerHeight,
      marginBottom: height * 0.01,
      borderWidth: 1,
      borderColor: Colors.glassyGradient.borderColor,
      overflow: 'hidden',
      ...customStyle,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: height * 0.012,
      flex: 1,
      minHeight: 0,
    },
    statIcon: {
      marginRight: width * 0.025,
      flexShrink: 0,
    },
    statContent: {
      flex: 1,
      alignItems: 'flex-start',
      minWidth: 0,
    },
    statNumber: {
      color: 'white',
      fontSize: Math.round(width * 0.045),
      fontWeight: '700',
      marginBottom: height * 0.002,
      flexShrink: 1,
    },
    statText: {
      color: 'white',
      fontSize: Math.round(width * 0.03),
      fontWeight: '300',
      flexShrink: 1,
    },
    cardsContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      borderRadius: 3,
      position: 'absolute',
      top: 0,
      left: 0,
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
            {stat.icon === 'card' ? (
              <View style={styles.statIcon}>
                <OverlappingCardsIcon />
              </View>
            ) : (
              <Ionicons 
                name={stat.icon} 
                size={Math.round(width * 0.05)} 
                color="white" 
                style={styles.statIcon}
              />
            )}
            <View style={styles.statContent}>
              <Text style={styles.statNumber} numberOfLines={1} ellipsizeMode="tail">{numberText}</Text>
              <Text style={styles.statText} numberOfLines={1} ellipsizeMode="tail">{labelText}</Text>
            </View>
          </View>
        );
      })}
    </LinearGradient>
  );
};

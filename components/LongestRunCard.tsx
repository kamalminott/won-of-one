import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

interface LongestRunCardProps {
  fencer1Name: string;
  fencer2Name: string;
  longestRuns: {
    fencer1: number;
    fencer2: number;
  };
}

export default function LongestRunCard({ 
  fencer1Name, 
  fencer2Name, 
  longestRuns 
}: LongestRunCardProps) {
  const { width } = Dimensions.get('window');
  
  return (
    <View style={[styles.longestRunCard, { borderRadius: width * 0.05 }]}>
      <Text style={[styles.statTitle, { fontSize: width * 0.04 }]}>Longest Run</Text>
      <View style={styles.bounceBackContent}>
        <View style={styles.bounceBackItem}>
          <View style={[styles.bounceBackCircle, { 
            backgroundColor: 'rgb(58,48,48)',
            width: width * 0.115,
            height: width * 0.115,
            borderRadius: width * 0.0575,
            marginBottom: width * 0.02,
          }]}>
            <Text style={[styles.bounceBackValue, { 
              color: '#FF7675',
              fontSize: width * 0.045,
            }]}>{longestRuns.fencer1}x</Text>
          </View>
          <Text style={[styles.bounceBackLabel, { fontSize: width * 0.03 }]}>{fencer1Name}</Text>
        </View>
        <View style={styles.bounceBackItem}>
          <View style={[styles.bounceBackCircle, { 
            backgroundColor: 'rgb(39,53,50)',
            width: width * 0.115,
            height: width * 0.115,
            borderRadius: width * 0.0575,
            marginBottom: width * 0.02,
          }]}>
            <Text style={[styles.bounceBackValue, { 
              color: '#00B894',
              fontSize: width * 0.045,
            }]}>{longestRuns.fencer2}x</Text>
          </View>
          <Text style={[styles.bounceBackLabel, { fontSize: width * 0.03 }]}>{fencer2Name}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  longestRunCard: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    padding: '5%',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  statTitle: {
    fontFamily: 'Articulat CF',
    fontWeight: '500',
    color: 'white',
    marginBottom: '4%',
  },
  bounceBackContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bounceBackItem: {
    alignItems: 'center',
  },
  bounceBackCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bounceBackValue: {
    fontFamily: 'Articulat CF',
    fontWeight: '700',
    color: 'white',
  },
  bounceBackLabel: {
    fontFamily: 'Articulat CF',
    fontWeight: '400',
    color: 'white',
  },
});

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  disabled?: boolean;
  customStyle?: object;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onValueChange,
  label,
  icon,
  iconColor = 'white',
  disabled = false,
  customStyle = {}
}) => {
  const { width, height } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: height * 0.01,
      ...customStyle,
    },
    iconContainer: {
      backgroundColor: '#393939',
      alignItems: 'center',
      justifyContent: 'center',
      width: width * 0.12,
      height: width * 0.12,
      borderRadius: width * 0.06,
      marginRight: width * 0.04,
    },
    content: {
      flex: 1,
    },
    label: {
      color: 'white',
      fontWeight: '600',
      fontSize: width * 0.04,
    },
    switch: {
      // Switch styling is handled via props
    },
  });

  return (
    <View style={styles.container}>
      {icon && (
        <View style={styles.iconContainer}>
          <Ionicons 
            name={icon} 
            size={width * 0.06} 
            color={iconColor} 
          />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Switch
        style={styles.switch}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#181818', true: '#6250F2' }}
        thumbColor={value ? '#FFFFFF' : '#3D3D3D'}
        disabled={disabled}
      />
    </View>
  );
};

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type CompetitionQrCodeProps = {
  payload: string;
  size?: number;
};

const buildQrImageUrl = (payload: string, size: number): string => {
  const encodedPayload = encodeURIComponent(payload);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedPayload}`;
};

export function CompetitionQrCode({ payload, size = 180 }: CompetitionQrCodeProps) {
  if (!payload) {
    return (
      <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>QR unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Image
        source={{
          uri: buildQrImageUrl(payload, size),
        }}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 8,
    alignSelf: 'center',
  },
  fallbackContainer: {
    alignSelf: 'center',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#212121',
  },
  fallbackText: {
    color: '#9D9D9D',
    fontSize: 13,
    fontWeight: '600',
  },
});


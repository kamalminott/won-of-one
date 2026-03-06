import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type CompetitionRealtimeBannerProps = {
  bannerText?: string | null;
  correctionNotice?: string | null;
  onRetry?: () => void;
  onDismissCorrection?: () => void;
};

export function CompetitionRealtimeBanner({
  bannerText,
  correctionNotice,
  onRetry,
  onDismissCorrection,
}: CompetitionRealtimeBannerProps) {
  if (!bannerText && !correctionNotice) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      {bannerText ? (
        <View style={styles.bannerRow}>
          <Text style={styles.bannerText}>{bannerText}</Text>
          {onRetry ? (
            <Pressable
              onPress={onRetry}
              style={styles.bannerAction}
            >
              <Text style={styles.bannerActionText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {correctionNotice ? (
        <View style={styles.noticeRow}>
          <Text style={styles.noticeText}>{correctionNotice}</Text>
          {onDismissCorrection ? (
            <Pressable
              onPress={onDismissCorrection}
              style={styles.noticeAction}
            >
              <Text style={styles.noticeActionText}>Dismiss</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    marginBottom: 12,
  },
  bannerRow: {
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bannerText: {
    color: '#FFB4B4',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  bannerAction: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  noticeRow: {
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  noticeText: {
    color: '#BEF7D4',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  noticeAction: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(233,215,255,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  noticeActionText: {
    color: '#E9D7FF',
    fontSize: 12,
    fontWeight: '700',
  },
});

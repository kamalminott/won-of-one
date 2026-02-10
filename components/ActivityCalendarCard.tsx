import { useAuth } from '@/contexts/AuthContext';
import { activityCalendarService, ActivityCalendarDay } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const TOTAL_MONTHS = 12;
const INTENSITY_COLORS = ['#2A2A2A', '#3D3558', '#5A4B86', '#7A66B0', '#9A7AE0'];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string): Date | null => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getIntensityLevel = (count: number) => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
};

const getWeekStartsOn = () => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';

  try {
    const LocaleCtor = (Intl as any).Locale;
    if (LocaleCtor) {
      const weekInfo = new LocaleCtor(locale).weekInfo;
      if (weekInfo?.firstDay && Number.isFinite(weekInfo.firstDay)) {
        const firstDay = Number(weekInfo.firstDay);
        if (firstDay >= 1 && firstDay <= 7) {
          return firstDay % 7;
        }
      }
    }
  } catch {
    // Ignore and use fallback below.
  }

  return locale.toLowerCase().startsWith('en-us') ? 0 : 1;
};

const getWeekdayLabels = (weekStartsOn: number) => {
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const sundayReference = new Date(Date.UTC(2024, 0, 7)); // Sunday

  return Array.from({ length: 7 }, (_, index) => {
    const weekday = (weekStartsOn + index) % 7;
    const date = new Date(sundayReference);
    date.setUTCDate(sundayReference.getUTCDate() + weekday);
    return formatter.format(date).slice(0, 2);
  });
};

const buildMonthCells = (monthDate: Date, weekStartsOn: number): (Date | null)[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const leadingBlankDays = (firstWeekday - weekStartsOn + 7) % 7;

  const cells: (Date | null)[] = Array.from({ length: leadingBlankDays }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export const ActivityCalendarCard: React.FC = () => {
  const { width } = useWindowDimensions();
  const { user, session } = useAuth();
  const accessToken = session?.access_token ?? undefined;

  const [monthOffset, setMonthOffset] = useState(0);
  const [activityDays, setActivityDays] = useState<ActivityCalendarDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const weekStartsOn = useMemo(() => getWeekStartsOn(), []);
  const weekdayLabels = useMemo(() => getWeekdayLabels(weekStartsOn), [weekStartsOn]);
  const baseMonth = useMemo(() => startOfMonth(new Date()), []);
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const rangeStart = useMemo(() => startOfMonth(addMonths(baseMonth, -(TOTAL_MONTHS - 1))), [baseMonth]);
  const rangeEnd = useMemo(() => endOfMonth(baseMonth), [baseMonth]);

  const monthDate = useMemo(() => addMonths(baseMonth, -monthOffset), [baseMonth, monthOffset]);
  const monthCells = useMemo(() => buildMonthCells(monthDate, weekStartsOn), [monthDate, weekStartsOn]);

  const activityByDate = useMemo(() => {
    const map = new Map<string, ActivityCalendarDay>();
    activityDays.forEach(day => {
      map.set(day.activity_date, day);
    });
    return map;
  }, [activityDays]);

  const selectedDay = selectedDateKey ? activityByDate.get(selectedDateKey) ?? null : null;
  const hasAnyActivity = activityDays.length > 0;

  const loadCalendar = useCallback(async () => {
    if (!user?.id) {
      setActivityDays([]);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const rows = await activityCalendarService.getActivityCalendar(
        user.id,
        rangeStart,
        rangeEnd,
        timezone,
        accessToken
      );
      setActivityDays(rows);
    } catch (error) {
      console.error('Error loading activity calendar:', error);
      setErrorMessage('Could not load activity right now.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, rangeEnd, rangeStart, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadCalendar();
    }, [loadCalendar])
  );

  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const formatReadableDate = (dateKey: string) => {
    const date = parseDateKey(dateKey);
    if (!date) return dateKey;
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const cardHorizontalPadding = width * 0.04;
  const cardRadius = width * 0.05;
  const dayTextSize = Math.max(11, Math.min(14, width * 0.03));

  return (
    <View
      style={[
        styles.container,
        {
          marginHorizontal: width * 0.04,
          marginTop: width * 0.04,
          padding: cardHorizontalPadding,
          borderRadius: cardRadius,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { fontSize: width * 0.045 }]}>Activity Calendar</Text>
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            style={[styles.monthButton, monthOffset >= TOTAL_MONTHS - 1 && styles.monthButtonDisabled]}
            onPress={() => setMonthOffset(prev => Math.min(TOTAL_MONTHS - 1, prev + 1))}
            disabled={monthOffset >= TOTAL_MONTHS - 1}
            accessibilityRole="button"
            accessibilityLabel="Show previous month"
          >
            <Ionicons name="chevron-back" size={16} color="white" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            style={[styles.monthButton, monthOffset === 0 && styles.monthButtonDisabled]}
            onPress={() => setMonthOffset(prev => Math.max(0, prev - 1))}
            disabled={monthOffset === 0}
            accessibilityRole="button"
            accessibilityLabel="Show next month"
          >
            <Ionicons name="chevron-forward" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color="#9A7AE0" />
          <Text style={styles.stateText}>Loading activity…</Text>
        </View>
      ) : (
        <>
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => void loadCalendar()} accessibilityRole="button">
                <Text style={styles.errorRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, index) => (
              <View key={`${label}-${index}`} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {monthCells.map((date, index) => {
              if (!date) {
                return <View key={`blank-${index}`} style={styles.dayCell} />;
              }

              const dateKey = toDateKey(date);
              const activity = activityByDate.get(dateKey);
              const count = activity?.total_count ?? 0;
              const intensityLevel = getIntensityLevel(count);
              const isFutureDay = dateKey > todayKey;
              const isActive = count > 0 && !isFutureDay;
              const hasCompetitionActivity = (activity?.competition_match_count ?? 0) > 0 && !isFutureDay;
              const buttonColor = isFutureDay ? '#2A2A2A' : INTENSITY_COLORS[intensityLevel];

              const competitionMatches = activity?.competition_match_count ?? 0;
              const trainingMatches = activity?.training_match_count ?? 0;
              const performanceSessions = activity?.performance_session_count ?? 0;

              const activityBreakdown = [
                competitionMatches > 0 ? `${competitionMatches} competition matches` : null,
                trainingMatches > 0 ? `${trainingMatches} training matches` : null,
                performanceSessions > 0 ? `${performanceSessions} performance sessions` : null,
              ].filter(Boolean).join(', ');

              const accessibilityLabel = isActive
                ? `${formatReadableDate(dateKey)}. ${count} activities logged. ${activityBreakdown}.`
                : isFutureDay
                  ? `${formatReadableDate(dateKey)}. Future day.`
                  : `${formatReadableDate(dateKey)}. No activity logged.`;

              return (
                <View key={dateKey} style={styles.dayCell}>
                  <Pressable
                    style={[
                      styles.dayButton,
                      { backgroundColor: buttonColor, opacity: isFutureDay ? 0.35 : 1 },
                      !isActive && styles.dayButtonInactive,
                      hasCompetitionActivity && styles.competitionDayRing,
                    ]}
                    disabled={!isActive}
                    onPress={() => setSelectedDateKey(dateKey)}
                    accessibilityRole={isActive ? 'button' : undefined}
                    accessibilityLabel={accessibilityLabel}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        { fontSize: dayTextSize },
                        !isActive && !isFutureDay && styles.dayNumberMuted,
                        isFutureDay && styles.dayNumberFuture,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {isActive ? (
                      <View style={styles.activityDotRow}>
                        {activity?.training_match_count ? <View style={styles.trainingMatchDot} /> : null}
                        {activity?.performance_session_count ? <View style={styles.performanceSessionDot} /> : null}
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <Text style={styles.legendText}>Less</Text>
            <View style={styles.legendSquares}>
              {INTENSITY_COLORS.slice(1).map(color => (
                <View key={color} style={[styles.legendSquare, { backgroundColor: color }]} />
              ))}
            </View>
            <Text style={styles.legendText}>More</Text>
          </View>

          {!hasAnyActivity ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No activity logged yet</Text>
              <Text style={styles.emptyDescription}>
                Your match and performance session days will appear here once you log activity.
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/add-match')}>
                  <Text style={styles.emptyButtonText}>Log Match</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.emptyButtonSecondary} onPress={() => router.push('/(tabs)')}>
                  <Text style={styles.emptyButtonText}>Go Home</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </>
      )}

      <Modal
        visible={!!selectedDay}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDateKey(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedDateKey(null)}>
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDateKey ? formatReadableDate(selectedDateKey) : ''}
              </Text>
              <TouchableOpacity onPress={() => setSelectedDateKey(null)}>
                <Ionicons name="close" size={20} color="#9D9D9D" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTotal}>
              {selectedDay?.total_count ?? 0} activities logged
            </Text>

            <View style={styles.modalMetricRow}>
              <View style={styles.metricLabelWrap}>
                <View style={styles.competitionDot} />
                <Text style={styles.metricLabel}>Competition Matches</Text>
              </View>
              <Text style={styles.metricValue}>{selectedDay?.competition_match_count ?? 0}</Text>
            </View>

            <View style={styles.modalMetricRow}>
              <View style={styles.metricLabelWrap}>
                <View style={styles.trainingMatchDot} />
                <Text style={styles.metricLabel}>Training Matches</Text>
              </View>
              <Text style={styles.metricValue}>{selectedDay?.training_match_count ?? 0}</Text>
            </View>

            <View style={styles.modalMetricRow}>
              <View style={styles.metricLabelWrap}>
                <View style={styles.performanceSessionDot} />
                <Text style={styles.metricLabel}>Performance Sessions</Text>
              </View>
              <Text style={styles.metricValue}>{selectedDay?.performance_session_count ?? 0}</Text>
            </View>

            {selectedDay?.performance_activity_types?.length ? (
              <View style={styles.typesWrap}>
                <Text style={styles.typesTitle}>Performance Types</Text>
                <View style={styles.typesRow}>
                  {selectedDay.performance_activity_types.map(type => (
                    <View key={type} style={styles.typeChip}>
                      <Text style={styles.typeChipText}>{type}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2A2A2A',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: 'white',
    fontWeight: '500',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#393939',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: {
    opacity: 0.35,
  },
  monthLabel: {
    color: '#E4E4E4',
    fontSize: 13,
    minWidth: 115,
    textAlign: 'center',
    fontWeight: '500',
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateText: {
    color: '#9D9D9D',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderColor: 'rgba(255, 107, 107, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: {
    color: '#FF9C9C',
    flex: 1,
    fontSize: 12,
  },
  errorRetryText: {
    color: '#FFB3B3',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
  },
  weekdayText: {
    color: '#8E8E8E',
    fontSize: 11,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    alignItems: 'center',
    marginBottom: 6,
  },
  dayButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C3C3C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
    paddingBottom: 3,
  },
  dayButtonInactive: {
    borderColor: '#343434',
  },
  competitionDayRing: {
    borderColor: '#F5C451',
    borderWidth: 2,
  },
  dayNumber: {
    color: 'white',
    fontWeight: '600',
    lineHeight: 14,
  },
  dayNumberMuted: {
    color: '#7B7B7B',
  },
  dayNumberFuture: {
    color: '#8C8C8C',
  },
  activityDotRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  competitionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F5C451',
  },
  trainingMatchDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#AF94FF',
  },
  performanceSessionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#54C0FF',
  },
  legendRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legendText: {
    color: '#9D9D9D',
    fontSize: 11,
  },
  legendSquares: {
    flexDirection: 'row',
    gap: 4,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  emptyState: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B3B3B',
    backgroundColor: '#262626',
    padding: 12,
  },
  emptyTitle: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyDescription: {
    color: '#A0A0A0',
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  emptyButton: {
    flex: 1,
    backgroundColor: '#6C5CE7',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  emptyButtonSecondary: {
    flex: 1,
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#2A2A2A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3F3F3F',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  modalTotal: {
    color: '#CFCFCF',
    fontSize: 13,
    marginBottom: 12,
  },
  modalMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    color: '#E4E4E4',
    fontSize: 13,
  },
  metricValue: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  typesWrap: {
    marginTop: 4,
  },
  typesTitle: {
    color: '#AFAFAF',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    backgroundColor: '#3B3153',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#52447D',
  },
  typeChipText: {
    color: '#E4DBFF',
    fontSize: 11,
    fontWeight: '500',
  },
});

const UTC_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UTC_DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: string | Date): Date => (value instanceof Date ? value : new Date(value));

export const getUtcWeekWindow = (now: Date = new Date()) => {
  const utcDay = now.getUTCDay();
  const daysSinceMonday = utcDay === 0 ? 6 : utcDay - 1;
  const weekStartMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0
  );

  return {
    weekStartUtc: new Date(weekStartMs),
    nextResetUtc: new Date(weekStartMs + UTC_WEEK_MS),
  };
};

export const getUtcCountdownParts = (target: string | Date, now: Date = new Date()) => {
  const targetDate = toDate(target);
  const diffMs = targetDate.getTime() - now.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return {
    totalMs: diffMs,
    days,
    hours,
    minutes,
  };
};

export const formatUtcResetCountdown = (target: string | Date, now: Date = new Date()) => {
  const { totalMs, days, hours, minutes } = getUtcCountdownParts(target, now);

  if (totalMs <= 0) {
    return 'Resets now';
  }

  if (days > 0) {
    return `Resets in ${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `Resets in ${hours}h ${minutes}m`;
  }

  return `Resets in ${minutes}m`;
};

export const formatUtcWeekRange = (weekStart: string | Date, nextReset: string | Date) => {
  const startDate = toDate(weekStart);
  const nextResetDate = toDate(nextReset);
  const displayEndDate = new Date(nextResetDate.getTime() - UTC_DAY_MS);

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  });

  return `${formatter.format(startDate)} - ${formatter.format(displayEndDate)} • UTC`;
};

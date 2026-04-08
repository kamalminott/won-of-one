const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 350;
const MAX_BACKOFF_MS = 3000;
const DEFAULT_READ_TIMEOUT_MS = 12000;

type RetryableResult = {
  ok: boolean;
  reason?: string;
  message?: string;
};

type RetryOptions = {
  maxAttempts?: number;
};

type CompetitionReadTimeoutOptions = {
  timeoutMs?: number;
  label?: string;
};

export type RetryExecutionResult<T extends RetryableResult> = {
  result: T;
  attempts: number;
  exhausted: boolean;
};

const isRetryableFailure = (result: RetryableResult): boolean => {
  if (result.ok) return false;
  const reason = result.reason?.toLowerCase() ?? '';
  if (reason === 'unknown') return true;

  const message = result.message?.toLowerCase() ?? '';
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('abort') ||
    message.includes('temporar')
  );
};

const getBackoffMs = (attempt: number): number => {
  const uncapped = BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(MAX_BACKOFF_MS, uncapped);
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const withCompetitionReadTimeout = async <T>(
  operation: Promise<T> | (() => Promise<T>),
  options?: CompetitionReadTimeoutOptions
): Promise<T> => {
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS);
  const label = options?.label ?? 'Competition request';
  const promise = typeof operation === 'function' ? operation() : operation;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const runCompetitionWriteWithRetry = async <T extends RetryableResult>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<RetryExecutionResult<T>> => {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  let attempts = 0;
  let lastResult: T | null = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    lastResult = await operation();
    if (lastResult.ok) {
      return {
        result: lastResult,
        attempts,
        exhausted: false,
      };
    }

    if (!isRetryableFailure(lastResult) || attempts >= maxAttempts) {
      break;
    }

    await wait(getBackoffMs(attempts));
  }

  return {
    result: lastResult as T,
    attempts,
    exhausted: true,
  };
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const getNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const sanitizeRecord = (value: Record<string, unknown>) => {
  const sanitized: Record<string, unknown> = {};

  Object.entries(value).forEach(([key, entry]) => {
    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      sanitized[key] = entry;
    }
  });

  return sanitized;
};

export const formatErrorForLog = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return JSON.stringify({
      name: getString(record.name),
      message: getString(record.message) ?? getString(record.error),
      details: getString(record.details),
      hint: getString(record.hint),
      code: getString(record.code),
      status: getNumber(record.status),
      raw: sanitizeRecord(record),
    });
  }

  return String(error);
};

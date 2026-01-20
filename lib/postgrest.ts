import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';
import { analytics } from './analytics';
import { getCachedAuthSession } from './authSessionCache';

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue | QueryValue[]>;

type PostgrestError = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
  status: number;
};

type PostgrestResult<T> = {
  data: T | null;
  error: PostgrestError | null;
  status: number;
};

const POSTGREST_TIMEOUT_MS = 8000;

const buildUrl = (path: string, query?: QueryParams) => {
  const cleanedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(`${SUPABASE_URL}/rest/v1/${cleanedPath}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item === undefined || item === null) return;
          url.searchParams.append(key, String(item));
        });
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

const fetchWithTimeout = async (
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number
) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('postgrest_timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const resolveAccessToken = (accessToken?: string | null) => {
  if (accessToken) return accessToken;
  return getCachedAuthSession()?.access_token ?? null;
};

const parseJson = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const postgrestRequest = async <T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: QueryParams;
    body?: unknown;
    accessToken?: string | null;
    preferReturn?: boolean;
    prefer?: string;
    headers?: Record<string, string>;
    allowAnon?: boolean;
  } = {}
): Promise<PostgrestResult<T>> => {
  const method = options.method ?? 'GET';
  const accessToken = resolveAccessToken(options.accessToken);

  if (!accessToken && !options.allowAnon) {
    analytics.capture('api_error', {
      endpoint: path,
      status: 401,
      code: 'auth_session_missing',
      method,
    });
    return {
      data: null,
      error: { message: 'auth_session_missing', status: 401 },
      status: 401,
    };
  }

  const url = buildUrl(path, options.query);
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (options.prefer) {
    headers.Prefer = options.prefer;
  } else if (options.preferReturn && method !== 'GET') {
    headers.Prefer = 'return=representation';
  }
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method,
        headers,
        body,
      },
      POSTGREST_TIMEOUT_MS
    );

    const payload = await parseJson(response);
    if (!response.ok) {
      const error = payload || {};
      analytics.capture('api_error', {
        endpoint: path,
        status: response.status,
        code: error.code,
        message: error.message || error.error,
        method,
      });
      return {
        data: null,
        error: {
          message: error.message || error.error || 'postgrest_error',
          details: error.details,
          hint: error.hint,
          code: error.code,
          status: response.status,
        },
        status: response.status,
      };
    }

    return {
      data: (payload as T) ?? null,
      error: null,
      status: response.status,
    };
  } catch (error) {
    analytics.capture('api_error', {
      endpoint: path,
      status: 0,
      code: error instanceof Error ? error.message : 'postgrest_request_failed',
      method,
    });
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'postgrest_request_failed',
        status: 0,
      },
      status: 0,
    };
  }
};

export const postgrestSelect = async <T>(
  table: string,
  query: QueryParams,
  options?: { accessToken?: string | null; allowAnon?: boolean }
): Promise<PostgrestResult<T[]>> => {
  return postgrestRequest<T[]>(table, {
    method: 'GET',
    query,
    accessToken: options?.accessToken,
    allowAnon: options?.allowAnon,
  });
};

export const postgrestSelectOne = async <T>(
  table: string,
  query: QueryParams,
  options?: { accessToken?: string | null; allowAnon?: boolean }
): Promise<PostgrestResult<T | null>> => {
  const result = await postgrestSelect<T>(table, query, options);
  if (result.error) {
    return { data: null, error: result.error, status: result.status };
  }
  const row = Array.isArray(result.data) ? result.data[0] ?? null : null;
  return { data: row, error: null, status: result.status };
};

export const postgrestInsert = async <T>(
  table: string,
  body: unknown,
  query?: QueryParams,
  options?: { accessToken?: string | null; preferReturn?: boolean; prefer?: string }
): Promise<PostgrestResult<T[]>> => {
  return postgrestRequest<T[]>(table, {
    method: 'POST',
    query,
    body,
    accessToken: options?.accessToken,
    preferReturn: options?.preferReturn ?? true,
    prefer: options?.prefer,
  });
};

export const postgrestUpsert = async <T>(
  table: string,
  body: unknown,
  query?: QueryParams,
  options?: { accessToken?: string | null; preferReturn?: boolean; prefer?: string }
): Promise<PostgrestResult<T[]>> => {
  return postgrestRequest<T[]>(table, {
    method: 'POST',
    query,
    body,
    accessToken: options?.accessToken,
    preferReturn: options?.preferReturn ?? true,
    prefer: options?.prefer ?? 'return=representation, resolution=merge-duplicates',
  });
};

export const postgrestUpdate = async <T>(
  table: string,
  body: unknown,
  query?: QueryParams,
  options?: { accessToken?: string | null; preferReturn?: boolean; prefer?: string }
): Promise<PostgrestResult<T[]>> => {
  return postgrestRequest<T[]>(table, {
    method: 'PATCH',
    query,
    body,
    accessToken: options?.accessToken,
    preferReturn: options?.preferReturn ?? true,
    prefer: options?.prefer,
  });
};

export const postgrestDelete = async <T>(
  table: string,
  query?: QueryParams,
  options?: { accessToken?: string | null; preferReturn?: boolean; prefer?: string }
): Promise<PostgrestResult<T[]>> => {
  return postgrestRequest<T[]>(table, {
    method: 'DELETE',
    query,
    accessToken: options?.accessToken,
    preferReturn: options?.preferReturn ?? false,
    prefer: options?.prefer,
  });
};

export const postgrestCount = async (
  table: string,
  query: QueryParams,
  options?: { accessToken?: string | null; allowAnon?: boolean }
): Promise<{ count: number; error: PostgrestError | null; status: number }> => {
  const accessToken = resolveAccessToken(options?.accessToken);
  if (!accessToken && !options?.allowAnon) {
    return {
      count: 0,
      error: { message: 'auth_session_missing', status: 401 },
      status: 401,
    };
  }

  const url = buildUrl(table, query);
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Prefer: 'count=exact',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers },
      POSTGREST_TIMEOUT_MS
    );

    if (!response.ok) {
      const payload = await parseJson(response);
      const error = payload || {};
      return {
        count: 0,
        error: {
          message: error.message || error.error || 'postgrest_error',
          details: error.details,
          hint: error.hint,
          code: error.code,
          status: response.status,
        },
        status: response.status,
      };
    }

    const contentRange = response.headers.get('content-range') || '';
    const totalPart = contentRange.split('/')[1];
    const parsedCount = totalPart ? Number(totalPart) : NaN;
    return {
      count: Number.isFinite(parsedCount) ? parsedCount : 0,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      count: 0,
      error: {
        message: error instanceof Error ? error.message : 'postgrest_request_failed',
        status: 0,
      },
      status: 0,
    };
  }
};

export const postgrestRpc = async <T>(
  functionName: string,
  body?: unknown,
  options?: { accessToken?: string | null; allowAnon?: boolean; prefer?: string }
): Promise<PostgrestResult<T>> => {
  return postgrestRequest<T>(`rpc/${functionName}`, {
    method: 'POST',
    body,
    accessToken: options?.accessToken,
    allowAnon: options?.allowAnon,
    prefer: options?.prefer,
  });
};

import { postgrestRpc } from './postgrest';

export interface ManualAccessStatus {
  grant_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  granted_by_user_id: string;
  user_message: string | null;
}

export interface ManualAccessGrantRecord {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  granted_by_user_id: string;
  user_message: string | null;
}

export interface AdminAccessSearchResult {
  user_id: string;
  email: string | null;
  name: string | null;
  has_active_access: boolean;
  access_starts_at: string | null;
  access_ends_at: string | null;
  access_reason: string | null;
  access_message: string | null;
}

export interface AdminGrantAccessInput {
  targetUserId: string;
  durationDays: number;
  reason?: string;
  userMessage?: string;
}

const extractErrorMessage = (error: {
  message?: string;
  details?: string;
  hint?: string;
} | null) => {
  if (!error) return 'unknown_error';
  return error.message || error.details || error.hint || 'unknown_error';
};

export const adminAccessService = {
  async isCurrentUserAdmin(accessToken?: string | null): Promise<boolean> {
    const { data, error } = await postgrestRpc<boolean>(
      'is_current_user_admin',
      {},
      accessToken ? { accessToken } : undefined
    );

    if (error) {
      console.warn('⚠️ Failed to resolve current admin status:', error);
      return false;
    }

    return data === true;
  },

  async getCurrentManualAccessStatus(
    accessToken?: string | null
  ): Promise<ManualAccessStatus | null> {
    const { data, error } = await postgrestRpc<ManualAccessStatus[]>(
      'get_current_manual_access_status',
      {},
      accessToken ? { accessToken } : undefined
    );

    if (error) {
      console.warn('⚠️ Failed to resolve manual access status:', error);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return data[0] ?? null;
  },

  async searchUsers(
    query: string,
    accessToken?: string | null,
    limit: number = 20
  ): Promise<AdminAccessSearchResult[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const { data, error } = await postgrestRpc<AdminAccessSearchResult[]>(
      'admin_search_access_users',
      {
        p_query: trimmedQuery,
        p_limit: limit,
      },
      accessToken ? { accessToken } : undefined
    );

    if (error) {
      throw new Error(extractErrorMessage(error));
    }

    return Array.isArray(data) ? data : [];
  },

  async grantAccess(
    input: AdminGrantAccessInput,
    accessToken?: string | null
  ): Promise<ManualAccessGrantRecord> {
    const { data, error } = await postgrestRpc<ManualAccessGrantRecord>(
      'admin_grant_manual_access',
      {
        p_target_user_id: input.targetUserId,
        p_duration_days: input.durationDays,
        p_reason: input.reason?.trim() || null,
        p_user_message: input.userMessage?.trim() || null,
      },
      accessToken ? { accessToken } : undefined
    );

    if (error || !data) {
      throw new Error(extractErrorMessage(error));
    }

    return data;
  },

  async revokeAccess(
    targetUserId: string,
    accessToken?: string | null,
    reason?: string
  ): Promise<number> {
    const { data, error } = await postgrestRpc<number>(
      'admin_revoke_manual_access',
      {
        p_target_user_id: targetUserId,
        p_reason: reason?.trim() || null,
      },
      accessToken ? { accessToken } : undefined
    );

    if (error) {
      throw new Error(extractErrorMessage(error));
    }

    return typeof data === 'number' ? data : 0;
  },
};

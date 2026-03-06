import { resolveAuthMetadataDisplayName } from '@/lib/displayName';

type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const GENERIC_NAMES = new Set(['participant', 'organiser', 'organizer', 'fencer', 'unnamed user']);

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ');

const isGenericName = (value: string): boolean => GENERIC_NAMES.has(value.trim().toLowerCase());

const fromMetadata = (user: UserLike | null | undefined): string | null => {
  const resolved = resolveAuthMetadataDisplayName(user);
  return resolved || null;
};

const fromEmail = (email: string | null | undefined): string | null => {
  if (!email || !email.includes('@')) return null;
  const localPart = normalize(email.split('@')[0] ?? '');
  if (!localPart) return null;
  const cleaned = localPart.replace(/[._-]+/g, ' ');
  const words = cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`);
  const candidate = normalize(words.join(' '));
  return candidate.length > 0 ? candidate : null;
};

export const resolveCompetitionDisplayName = (input: {
  preferredName?: string | null;
  user?: UserLike | null;
  fallback?: string;
}): string => {
  const fallback = normalize(input.fallback ?? 'Fencer');

  const preferred = normalize(input.preferredName ?? '');
  if (preferred.length > 0 && !isGenericName(preferred)) {
    return preferred;
  }

  const metadataName = fromMetadata(input.user);
  if (metadataName && !isGenericName(metadataName)) {
    return metadataName;
  }

  const emailName = fromEmail(input.user?.email);
  if (emailName && !isGenericName(emailName)) {
    return emailName;
  }

  return fallback;
};

export const isCompetitionGenericDisplayName = (value: string | null | undefined): boolean => {
  if (!value) return true;
  const normalized = normalize(value);
  if (normalized.length === 0) return true;
  return isGenericName(normalized);
};

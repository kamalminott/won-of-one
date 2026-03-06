type MetadataLike = Record<string, unknown> | null | undefined;

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK_NAME_VALUES = new Set(['user', 'guest user', 'guest', 'unknown']);

const readMetadataValue = (metadata: MetadataLike, key: string): string => {
  if (!metadata) return '';
  const value = metadata[key];
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
};

const joinNameParts = (...parts: string[]) => parts.filter(Boolean).join(' ').trim();

export const normalizeDisplayName = (value?: string | null): string => {
  if (!value) return '';
  return value.trim().replace(/\s+/g, ' ');
};

export const isOpaqueIdentifierName = (value?: string | null): boolean => {
  const normalized = normalizeDisplayName(value);
  if (!normalized) return false;
  return UUID_LIKE_REGEX.test(normalized);
};

export const isFallbackDisplayName = (value?: string | null): boolean => {
  const normalized = normalizeDisplayName(value).toLowerCase();
  if (!normalized) return true;
  return FALLBACK_NAME_VALUES.has(normalized);
};

export const isPlaceholderDisplayName = (value?: string | null, email?: string | null): boolean => {
  const normalized = normalizeDisplayName(value);
  if (!normalized) return true;
  if (isFallbackDisplayName(normalized)) return true;
  if (isOpaqueIdentifierName(normalized)) return true;

  const emailPrefix = normalizeDisplayName(email?.split('@')[0] ?? '').toLowerCase();
  if (emailPrefix && normalized.toLowerCase() === emailPrefix) return true;

  return false;
};

export const resolveMetadataDisplayName = (metadata: MetadataLike): string => {
  if (!metadata) return '';

  const fullName = readMetadataValue(metadata, 'full_name');
  const displayName = readMetadataValue(metadata, 'display_name');
  const givenName = readMetadataValue(metadata, 'given_name');
  const familyName = readMetadataValue(metadata, 'family_name');
  const firstName = readMetadataValue(metadata, 'first_name');
  const lastName = readMetadataValue(metadata, 'last_name');
  const combinedGivenFamily = joinNameParts(givenName, familyName);
  const combinedFirstLast = joinNameParts(firstName, lastName);
  const legacyName = readMetadataValue(metadata, 'name');

  const candidates = [
    fullName,
    displayName,
    combinedGivenFamily,
    combinedFirstLast,
    givenName,
    firstName,
    legacyName,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isFallbackDisplayName(candidate)) continue;
    if (isOpaqueIdentifierName(candidate)) continue;
    return candidate;
  }

  return '';
};

export const resolveAuthMetadataDisplayName = (user?: { user_metadata?: MetadataLike } | null): string => {
  return resolveMetadataDisplayName(user?.user_metadata);
};

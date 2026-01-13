export const userProfileImageStorageKey = (userId?: string | null) => {
  return userId ? `user_profile_image:${userId}` : 'user_profile_image';
};

export const userProfileImageUrlStorageKey = (userId?: string | null) => {
  return userId ? `user_profile_image_url:${userId}` : 'user_profile_image_url';
};

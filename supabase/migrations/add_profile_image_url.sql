alter table app_user
  add column if not exists profile_image_url text;

comment on column app_user.profile_image_url is 'Public profile image URL stored in Supabase Storage.';

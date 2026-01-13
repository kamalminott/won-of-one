insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

create policy "Profile images are publicly readable"
on storage.objects
for select
using (bucket_id = 'profile-images');

create policy "Users can upload their own profile images"
on storage.objects
for insert
with check (
  bucket_id = 'profile-images'
  and auth.role() = 'authenticated'
  and name like auth.uid()::text || '/%'
);

create policy "Users can update their own profile images"
on storage.objects
for update
using (
  bucket_id = 'profile-images'
  and auth.role() = 'authenticated'
  and name like auth.uid()::text || '/%'
);

create policy "Users can delete their own profile images"
on storage.objects
for delete
using (
  bucket_id = 'profile-images'
  and auth.role() = 'authenticated'
  and name like auth.uid()::text || '/%'
);

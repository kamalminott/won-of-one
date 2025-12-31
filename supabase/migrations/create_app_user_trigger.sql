-- Create app_user rows automatically when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_user (user_id, email, name)
  values (
    new.id,
    new.email,
    nullif(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'display_name'
      ),
      ''
    )
  )
  on conflict (user_id) do update
    set email = excluded.email,
        name = coalesce(app_user.name, excluded.name);

  return new;
end;
$$;

-- Ensure the trigger exists and points to the function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill any existing auth users missing app_user rows
insert into public.app_user (user_id, email, name)
select
  u.id,
  u.email,
  nullif(
    coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'display_name'
    ),
    ''
  )
from auth.users u
on conflict (user_id) do update
  set email = excluded.email,
      name = coalesce(app_user.name, excluded.name);

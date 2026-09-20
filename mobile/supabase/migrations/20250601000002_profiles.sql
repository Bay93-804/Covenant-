-- profiles: 1:1 with auth.users (docs/phase1/DATABASE_SCHEMA.md)

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role profile_role not null default 'athlete',
  date_of_birth date,
  timezone text not null default 'UTC',
  units_weight units_weight not null default 'lb',
  units_distance units_distance not null default 'mi',
  bodyweight_lb numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

-- Profile creation flow: a bare profile row is created automatically the
-- moment a Supabase auth user is created, so onboarding always has a row to
-- update rather than needing to insert one (insert would otherwise race
-- against RLS + FK timing on first sign-up). Onboarding fills in the rest
-- (display name, DOB, units, etc.) via an update, never an insert.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

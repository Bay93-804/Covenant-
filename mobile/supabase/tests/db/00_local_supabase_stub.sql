-- Minimal stand-in for the pieces of a Supabase database the migrations
-- depend on (auth schema, auth.uid()/auth.role(), API roles), so the
-- migrations + tests in this folder can run against a plain Postgres
-- container via scripts/test-db.sh. NOT a migration — never apply this to a
-- real Supabase project (which already has all of this).

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create function auth.role() returns text
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text) $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase grants API roles access to everything created in `public` by
-- default; mirror that so the migrations' explicit REVOKEs are what's tested.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

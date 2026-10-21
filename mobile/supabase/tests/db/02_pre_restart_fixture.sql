-- Applied by scripts/test-db.sh AFTER the pre-existing migrations and
-- BEFORE 20261020000001_program_restart.sql: simulates a production user who
-- already has two "active" runs (possible before the unique index existed),
-- so the migration's one-time normalization is exercised.

insert into auth.users (id, email) values ('99999999-0000-0000-0000-000000000000', 'dupe@example.com');
insert into program_enrollments (id, user_id, program_version_id, start_date, status, created_at)
values
  ('99999999-0000-0000-0000-0000000000e1', '99999999-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a1', '2026-01-05', 'active', '2026-01-01T00:00:00Z'),
  ('99999999-0000-0000-0000-0000000000e2', '99999999-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a1', '2026-02-02', 'active', '2026-01-20T00:00:00Z');

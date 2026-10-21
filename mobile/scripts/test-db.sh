#!/usr/bin/env bash
# Runs every migration plus the SQL tests in supabase/tests/db/ against a
# throwaway Postgres container (no Supabase project, no network calls beyond
# pulling the image). Usage: npm run test:db
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
NAME="coachconde-test-db-$$"
TESTS=supabase/tests/db
MIGRATIONS=supabase/migrations
# Pre-existing migrations get the duplicate-run fixture applied after them,
# before the migrations that introduce the one-current-run constraint.
FIXTURE_BEFORE=20261020000001_program_restart.sql

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres -q && break
  sleep 0.5
done
# pg_isready can report ready during the image's init restart; confirm a real query works.
for _ in $(seq 1 60); do
  docker exec "$NAME" psql -U postgres -tAc 'select 1' >/dev/null 2>&1 && break
  sleep 0.5
done

psql_file() {
  docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -f - <"$1"
}

echo "== stub + migrations"
psql_file "$TESTS/00_local_supabase_stub.sql"
fixtures_loaded=0
for migration in $(ls "$MIGRATIONS"/*.sql | sort); do
  base=$(basename "$migration")
  if [[ "$base" == "$FIXTURE_BEFORE" ]]; then
    psql_file "$TESTS/01_fixtures.sql"
    psql_file "$TESTS/02_pre_restart_fixture.sql"
    fixtures_loaded=1
  fi
  echo "   $base"
  psql_file "$migration"
done
[[ $fixtures_loaded == 1 ]] || { echo "fixture anchor migration $FIXTURE_BEFORE not found" >&2; exit 1; }

for test in "$TESTS"/*.test.sql; do
  echo "== $(basename "$test")"
  psql_file "$test" 2>&1 | sed -n 's/^.*NOTICE:  //p'
  [[ ${PIPESTATUS[0]} == 0 ]] || { echo "FAILED: $test" >&2; exit 1; }
done

echo "== concurrent restart attempts"
docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -c "
  insert into auth.users (id) values ('eeeeeeee-0000-0000-0000-000000000000');
  insert into program_enrollments (id, user_id, program_version_id, start_date)
  values ('eeeeeeee-0000-0000-0000-0000000000e1', 'eeeeeeee-0000-0000-0000-000000000000',
          '00000000-0000-0000-0000-0000000000a1', '2026-09-07');"
restart_sql="begin;
  select test_act_as('eeeeeeee-0000-0000-0000-000000000000');
  select id from restart_program('eeeeeeee-0000-0000-0000-0000000000e1', '2026-10-26');
  select pg_sleep(0.5);
  commit;"
for i in 1 2 3; do
  docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -tAq -c "$restart_sql" >"/tmp/$NAME-$i.out" &
done
wait
ids=$(cat /tmp/$NAME-*.out | grep -E '^[0-9a-f-]{36}$' | sort -u)
rm -f /tmp/$NAME-*.out
current=$(docker exec "$NAME" psql -U postgres -tAc \
  "select count(*) from program_enrollments where user_id = 'eeeeeeee-0000-0000-0000-000000000000' and status in ('active','paused')")
total=$(docker exec "$NAME" psql -U postgres -tAc \
  "select count(*) from program_enrollments where user_id = 'eeeeeeee-0000-0000-0000-000000000000'")
if [[ $(echo "$ids" | wc -l) == 1 && $current == 1 && $total == 2 ]]; then
  echo "ok - 3 simultaneous restarts returned one new run ($ids); 1 current, 1 archived"
else
  echo "FAILED: concurrent restarts -> ids=[$ids] current=$current total=$total" >&2
  exit 1
fi

echo "All database tests passed."

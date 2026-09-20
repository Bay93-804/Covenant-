# Coach Conde — The Long Game (Athletic Edition)

A single-athlete mobile app for following Coach Conde's 12-week "Long Game — Athletic Edition"
program: Week 0 baseline testing → 12 weeks of AM/PM sessions across three blocks (Absorb, Build,
Express) → Week 6 mid-program retest → Week 12 final test.

This is the **Phase 2** deliverable: application scaffold, design system, app shell, onboarding,
Supabase foundation, and the program-content layer. See `../docs/phase1/` for the approved product
requirements, database design, screen map, and program-content model this phase implements —
those documents (and `../data/program/coach-conde-long-game-athletic-v1.json`) are the source of
truth and were not re-extracted or reinterpreted here.

## Stack

- Expo React Native + TypeScript (strict mode) + Expo Router (file-based routing)
- NativeWind (Tailwind CSS for React Native) for the Coach Conde design system
- Supabase (Postgres + Auth) with Row-Level Security, via a typed client
- TanStack Query for server state
- Zod for schema validation (program content, environment variables, onboarding forms)
- `expo-secure-store` for small sensitive values, `@react-native-async-storage/async-storage` for
  bulkier local state
- Jest (`jest-expo` preset) + ESLint (flat config) + Prettier

## Getting started

```bash
npm install
npm run start        # Expo dev server — open in Expo Go on iOS/Android, or press w for web
```

The app works immediately with **no backend configured** — see [Local demo mode](#local-demo-mode)
below. To connect a real Supabase project, see [Environment variables](#environment-variables).

### Useful scripts

| Script                                      | What it does                                                                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run start` / `ios` / `android` / `web` | Launch the Expo dev server                                                                                                                                       |
| `npm run typecheck`                         | `tsc --noEmit`                                                                                                                                                   |
| `npm run lint` / `lint:fix`                 | ESLint (flat config)                                                                                                                                             |
| `npm run format` / `format:check`           | Prettier                                                                                                                                                         |
| `npm test` / `test:watch`                   | Jest unit tests                                                                                                                                                  |
| `npm run validate:program`                  | Validates `data/program/*.json` against the Zod schema and prints a summary                                                                                      |
| `npm run seed:print`                        | Expands the program JSON into DB-row-shaped seed data and prints row counts (sanity check, no network)                                                           |
| `npm run seed:supabase`                     | Seeds a real Supabase project's program-content tables (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in the environment — **never** run this from the app) |
| `npm run export:web`                        | `expo export --platform web` — a quick way to smoke-test that the whole app bundles                                                                              |

## Environment variables

Copy `.env.example` to `.env` and fill in your Supabase project's values:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Only `EXPO_PUBLIC_*` variables are readable from the client bundle (Expo inlines them at build
time) — this is exactly why the **service-role key is never given an `EXPO_PUBLIC_` prefix** and
never referenced anywhere under `app/` or `src/`. It's only read (as a plain `SUPABASE_SERVICE_ROLE_KEY`
env var) by `scripts/seed-supabase.ts`, a trusted-environment CLI script, never by the mobile app
itself.

Environment variables are validated with Zod in `src/lib/env.ts`. If they're absent or malformed,
the app does **not** crash — it falls back to local demo mode automatically.

## Local demo mode

If `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not set, the app boots in demo
mode:

- **Mock authentication** (`src/lib/demo/demoAuth.ts`) — sign up / sign in / sign out / password
  reset, all local to the device. Passwords are hashed (SHA-256 via `expo-crypto`) before being
  stored; there is no server and this is not a production auth system.
- **Local storage** (`src/lib/demo/demoContentStore.ts`, `src/lib/demo/storage.ts`) — profile,
  program enrollment, notification preferences, and exercise maxes are persisted with
  `AsyncStorage`; the small "who's currently signed in" pointer uses `SecureStore` (falling back
  to `AsyncStorage` on web, where `expo-secure-store` has no native implementation).
- **Real program content, always.** Demo mode never fabricates workout data — it reads the exact
  same validated `data/program/coach-conde-long-game-athletic-v1.json` through
  `src/content/repository.ts` that Supabase-backed mode does.

Demo-mode code lives entirely under `src/lib/demo/` and is never imported by `src/lib/supabase/`
or vice versa — the only place that branches between them is `src/lib/auth/AuthContext.tsx` and
`src/lib/onboarding/onboardingService.ts`, both keyed off `isSupabaseConfigured`.

## Supabase setup (optional — for the real backend)

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` **in filename order** (via the Supabase CLI,
   `supabase db push`, or by pasting each file into the SQL editor in order). They create every
   table, enum, index, foreign key, and Row-Level Security policy described in
   `../docs/phase1/DATABASE_SCHEMA.md`.
3. Seed the program-content tables from the authoritative JSON:
   ```bash
   SUPABASE_URL=https://<project>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   npm run seed:supabase
   ```
   This is idempotent — every row id is a deterministic uuid v5 derived from stable natural keys
   (see `src/content/seed/expandProgram.ts`), so re-running it upserts rather than duplicating.
4. Set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` and restart the dev
   server.

A new Supabase user automatically gets a bare `profiles` row via a database trigger
(`handle_new_user()`, in `20250601000002_profiles.sql`) the moment they sign up — onboarding then
**updates** that row rather than inserting one, and creates their `program_enrollments`,
`notification_preferences`, and `exercise_maxes` rows.

## Project structure

```
app/                          Expo Router routes (file-based)
├── _layout.tsx                Root layout: QueryClient, AuthProvider, splash-screen handling
├── index.tsx                  Redirect: signed-out → (auth), no enrollment → (onboarding), else → (tabs)
├── (auth)/                    sign-in, sign-up, forgot-password
├── (onboarding)/               7-step onboarding flow (see below)
├── (tabs)/                    Today (real data) · Program · Progress · Testing · Profile
│
src/
├── design-system/             Coach Conde tokens (Midnight Navy / Burnished Gold / Bone / Silver)
│                               + reusable primitives (Button, Card, TextField, ChoiceGroup, ...)
├── content/                   Program-content layer — the only thing screens read workout data from
│   ├── schema.ts                Zod schema for data/program/*.json
│   ├── source.ts                The one file that imports the raw JSON (via metro watchFolders)
│   ├── repository.ts            Version-aware accessors (resolveWeekContext, getStrengthDayForWeek, ...)
│   └── seed/expandProgram.ts    Deterministic expansion into DB-row-shaped seed data
├── features/
│   ├── auth/                    Shared auth UI (BrandHeader)
│   ├── onboarding/               Onboarding Zod schema, step context, shared step screen
│   └── today/                    Today-screen date math (program week/day resolution)
├── lib/
│   ├── env.ts                    Zod-validated environment variables
│   ├── auth/AuthContext.tsx      Unified auth (Supabase or demo) — the only place that branches
│   ├── supabase/                 Typed client, hand-written database types, mutations
│   ├── demo/                     Local mock auth + storage (fully isolated from supabase/)
│   ├── onboarding/                Unified onboarding submission + enrollment-status query
│   └── profile/                   Profile summary query (backend-agnostic)
│
supabase/migrations/           Numbered SQL migrations (schema, indexes, FKs, RLS)
scripts/                       validate-program.ts · seed-print.ts · seed-supabase.ts
__tests__/                     Program-content and onboarding-schema unit tests
```

## What's real vs. placeholder in this phase

Per the Phase 2 brief, later-phase screens get **attractive placeholder states**, not fabricated
functionality:

- **Real, content-driven:** the full onboarding flow; Today's week/block/day resolution and AM/PM
  session titles (pulled live from the program JSON, never hardcoded); the Program tab's block
  overview; the Testing tab's Week 0/6/12 marker counts; Profile.
- **Placeholder (Phase 3+):** the guided workout player / set logging, the readiness-check safety
  gate UI, sport-adjustment flow, and the Progress dashboard's charts — all of these need real user
  _instance_ data (workout sessions, completed sets) that this phase's schema supports but doesn't
  yet have a logging UI for.

Every safety rule, progression rule, substitution, and sport-adjustment rule from the source
program is preserved in `data/program/*.json` and typed end-to-end in `src/content/schema.ts` —
none of it is dropped, even though the runtime "safety engine" that acts on it during a live
workout is future work.

## Known limitations (honest, not hidden)

- Date of birth and the Week 1 Start Date use the native OS date picker
  (`@react-native-community/datetimepicker`) on iOS/Android; since that library has no web
  implementation, the web build (used only as a bundling smoke test) falls back to a plain
  validated text field instead.
- Native date pickers can't restrict which weekdays are selectable, so the Week 1 Start Date field
  accepts any date from the picker and relies on Zod (`week1StartDateSchema`) to reject a
  non-Monday choice with an inline error, rather than graying out non-Mondays in the calendar UI.
- The Today screen's "Start Session" and Testing's marker-entry rows are intentionally
  non-functional placeholders (see above) — the program _plan_ shown is real, the _logging_ isn't
  built yet.
- `src/lib/supabase/database.types.ts` is hand-written from the approved DDL rather than generated
  by the Supabase CLI (there's no live project to generate from yet); regenerate and diff it once
  one exists.
- Push notifications are modeled as user preferences (`notification_preferences`) but no actual
  scheduling/delivery is wired up yet.

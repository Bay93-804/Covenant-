# Coach Conde — The Long Game (Athletic Edition)

A single-athlete mobile app for following Coach Conde's 12-week "Long Game — Athletic Edition"
program: Week 0 baseline testing → 12 weeks of AM/PM sessions across three blocks (Absorb, Build,
Express) → Week 6 mid-program retest → Week 12 final test.

This repository has grown through four phases: **Phase 2** (application scaffold, design system,
app shell, onboarding, Supabase foundation, the program-content layer), **Phase 3** (the schedule
engine, Today screen, guided workout player, and offline-first workout tracking), and **Phase 4**
(the full Week 0/6/12 testing system and the Progress dashboard — see below). See `../docs/phase1/`
for the approved product requirements, database design, screen map, and program-content model every
phase implements against — those documents (and
`../data/program/coach-conde-long-game-athletic-v1.json`) are the source of truth and were not
re-extracted or reinterpreted at any phase.

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
| `npm run e2e`                               | `playwright test` — the mobile-web Playwright suite (`e2e/`), against a real `expo start --web` dev server it launches itself                                    |

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
├── (tabs)/                    Today · Program · Progress · Testing · Profile
│   ├── today/_layout.tsx        Stack wrapping today/index + readiness-check + safety-adjustment
│   ├── program/_layout.tsx      Stack wrapping program/index + day/[date] + week/[weekNumber] + sport-adjustment
│   ├── progress/_layout.tsx     Stack wrapping progress/index + exercise/* + readiness-history
│   ├── testing/_layout.tsx      Stack wrapping testing/index + session/[eventKey] + marker/[markerNumber] +
│   │                             rhr/[eventKey] + history/[markerNumber] + compare
│   └── (every tab directory MUST have its own `_layout.tsx` — see "Expo Router pitfall" below)
├── workout/[sessionId]/       Overview → player → summary (outside the tab bar, a focused flow)
│
src/
├── design-system/             Coach Conde tokens (Midnight Navy / Burnished Gold / Bone / Silver)
│                               + reusable primitives (Button, Card, TextField, ChoiceGroup, ...)
│   └── charts/                  BarTrendChart, LineTrendChart — react-native-svg + plain Views, no new dependency
├── content/                   Program-content layer — the only thing screens read workout data from
│   ├── schema.ts                Zod schema for data/program/*.json
│   ├── source.ts                The one file that imports the raw JSON (via metro watchFolders)
│   ├── repository.ts            Version-aware accessors (resolveWeekContext, getStrengthDayForWeek, ...)
│   └── seed/expandProgram.ts    Deterministic expansion into DB-row-shaped seed data
├── features/
│   ├── auth/                    Shared auth UI (BrandHeader)
│   ├── onboarding/               Onboarding Zod schema, step context, shared step screen
│   ├── today/                    Today-screen date math (program week/day resolution)
│   ├── testing/                  Phase 4 testing domain: schedule, repository, RHR workflow, sprint
│   │                              deferral, safety gate, marker formats/classification, results
│   │                              aggregation, comparison, and the useTesting.ts React Query layer
│   └── progress/                 Phase 4 progress domain: adherence, exercise history + PB detection,
│                                  readiness/adjustment trends, and useProgress.ts
├── lib/
│   ├── env.ts                    Zod-validated environment variables
│   ├── auth/AuthContext.tsx      Unified auth (Supabase or demo) — the only place that branches
│   ├── supabase/                 Typed client, hand-written database types, mutations
│   ├── demo/                     Local mock auth + storage (fully isolated from supabase/)
│   ├── onboarding/                Unified onboarding submission + enrollment-status query
│   └── profile/                   Profile summary query + bodyweightService.ts (Phase 4, for marker #7)
│
supabase/migrations/           Numbered SQL migrations (schema, indexes, FKs, RLS) — none added in Phase 4;
│                               testing_sessions/testing_results already existed from Phase 2
scripts/                       validate-program.ts · seed-print.ts · seed-supabase.ts
__tests__/                     Jest unit/integration tests (program content, onboarding, workout, testing, progress)
e2e/                           Playwright mobile-web end-to-end specs (routing.spec.ts, full-flow.spec.ts, helpers.ts)
playwright.config.ts           Chromium + a mobile device profile, launches its own `expo start --web` server
```

### An Expo Router pitfall this phase hit and fixed

Every tab (`today/`, `program/`, `progress/`, `testing/`) now has its own `_layout.tsx`
wrapping a `Stack`. Without one, Expo Router auto-promotes every route file directly under a tab
directory into its **own sibling tab** of the parent `Tabs` navigator instead of a screen pushed
within that tab — Phase 3's `program/day/[date].tsx`, `program/week/[weekNumber].tsx`,
`program/sport-adjustment.tsx`, `today/readiness-check.tsx`, and `today/safety-adjustment.tsx` were
all silently affected by this (each showed up as its own extra bottom-tab icon instead of a pushed
screen) until Phase 4 added the missing layouts. `e2e/routing.spec.ts` is a permanent regression
guard for this — it asserts the tab bar always shows exactly five tabs, including after navigating
into every nested screen and after a direct/deep link. **Any new file added directly under a tab's
directory needs no extra work** as long as that tab's `_layout.tsx` already exists; only a brand
new top-level tab directory would need one.

## What's real vs. placeholder, as of Phase 4

- **Real, content-driven, with live user instance data:** onboarding; the schedule engine (Week
  0-12, timezone-aware, pause/resume/restart-at-block-start); the Today screen (readiness gate,
  safety-adjustment confirmation, session status, missed-week restart banner); the Program calendar
  (12-week grid, week/day detail, read-only history); the guided workout player (cluster-based set
  logging for PM strength and Tuesday AM Core/Balance/Brake, segment checklists for the other three
  AM session types, rest/session timers, substitutions, completion summary); the pickup-sport
  adjustment flow; **the full Week 0/6/12 testing system** (marker-specific entry for all 15
  markers, the three-morning RHR workflow, sprint deferral, safety-gated Athletic Five entry,
  session finalization, Week 0/6/12 comparison); **the Progress dashboard** (program adherence,
  testing comparisons, exercise history with personal-best detection, readiness/safety trends,
  charts). All of it is offline-first and works identically in demo mode and Supabase mode.
- **Placeholder (Phase 5+):** coaching dashboards, subscriptions, social features, push-notification
  delivery, live deployment. None of this phase's work depends on any of it.

Every safety rule, progression rule, substitution, sport-adjustment rule, and testing marker
definition from the source program is preserved in `data/program/*.json` and typed end-to-end in
`src/content/schema.ts` — none of it is dropped, and the program JSON was never reinterpreted or
overwritten to build any of the above.

## Phase 4: testing, progress, and history

### Testing rules (never silently inferred)

- **Week 0** is the complete 15-marker baseline, always available from the moment onboarding
  finishes (`testing.events.week0` has no fixed start day per the source PDF — only a "before Week
  1 begins" deadline). The suggested 4-session schedule shown on the hub is explicitly labeled
  flexible, never a PDF prescription.
- **Week 6** carries **exactly** the 6 PDF-specified markers (#1, #4, #5, #9, #12, #15), plus the
  10-yard sprint (#11) **only** when it was deferred at Week 0 — never a full 15-marker retest. The
  Testing tab and session screen both reflect this marker count honestly.
- **Week 12** is the complete 15-marker final test.
- **Resting heart rate (#1)** always follows its own protocol — three separate morning readings,
  averaged — at whichever event it's tested (Week 0, 6, or 12). A single reading is never presented
  as the established baseline; `computeEstablishedRhr` requires exactly 3 recorded mornings, keyed
  by calendar date so the same morning can't be logged twice without an explicit, audit-preserving
  correction. The established value feeds the daily readiness check's baseline-RHR field.
- **Sprint deferral (#11)** is recorded as its own row (reason + date) — never silently dropped or
  conflated with a real attempt — and is carried forward as a conditional Week 6 marker.
- **Classification** (below-baseline/baseline/solid/strong) is computed only from the program's own
  baseline/solid/strong thresholds (`src/features/testing/markerFormats.ts`), converted through the
  same unit parsers used for entry (mm:ss, ft-in, the two textual forms the Deep Squat Hold marker
  uses). A marker with no comparable data is always "not classified," never guessed.
- **Athletic Five markers (#11–15)** are gated by the same calf/Achilles/hamstring/joint-pain safety
  rules that gate a training day's sprint/plyo work (`testingSafetyGate.ts` reuses
  `readinessRules.ts` directly rather than re-implementing the thresholds).
- **Raw attempts are always preserved.** Every attempt (including a corrected one) is its own
  `testing_results` row; the "selected/best result" shown to the athlete is always a pure function
  over those raw rows, computed at read time — never the only thing stored.

### Progress-calculation definitions

- **Program adherence** (`src/features/progress/adherence.ts`): per week, `(completed + adjusted) /
scheduled` sessions, counted only for weeks that have actually started — a week that hasn't begun
  yet shows "not yet reached," never a fabricated 0%. A day counts as missed only once its date is
  strictly in the past with no completed/adjusted session.
- **Testing comparison** (`testingResultsAggregation.ts`): Week 0 → Week 12 is the full 15-marker
  comparison; Week 0 → Week 6 only for the 6 (or 7) markers Week 6 actually carries. Percentage
  change is computed only when the baseline value is non-zero and the marker is numeric (never for
  a qualitative marker or a zero baseline). "Improved"/"declined" always derives from the marker's
  own `direction` field (`lower_better` / `higher_better`) — never assumed. Marker #11's baseline,
  when deferred at Week 0, becomes Week 6's value instead, and the UI says so explicitly.
- **Personal bests** (`exerciseHistory.ts`): computed only from logged values of the same kind
  (heaviest weight vs. heaviest weight, most reps vs. most reps, etc.) — never a derived/estimated
  1RM. Volume trend sums `weight × reps` only over sets that logged both.
- **Readiness/adjustment history**: a plain, factual log of what the athlete entered — sleep, RHR,
  safety flags, pickup-sport sessions — never framed as a diagnosis or treatment recommendation.

### Data, storage, and sync

No new tables were needed — `testing_sessions` and `testing_results` already existed in the Phase 2
schema (`supabase/migrations/20250601000006_testing.sql`) but were unused by any screen until this
phase. The testing repository (`src/features/testing/testingRepository.ts`) follows the exact
offline-first pattern `workoutRepository.ts` established: every write lands in the local store
first (instant, works offline), then queues a best-effort background push when Supabase is
configured. IDs are deterministic wherever a natural key exists (session: `(enrollment, event_key)`;
result: `(session, marker, attempt, side)`), so a retried autosave or a duplicate tap upserts the
same row instead of duplicating it. `profiles.bodyweight_lb` (already reserved in the Phase 1
schema, previously unused) is now written the first time the athlete enters marker #7.

### Migrations and dependencies added

- **SQL migrations:** none. `testing_sessions`/`testing_results`/`exercise_maxes`/
  `profiles.bodyweight_lb` were already in place from Phase 2's migrations.
- **npm dependencies:** none added to the app itself — the charts (`src/design-system/charts/`) are
  built on `react-native-svg` (already a Phase 2 dependency) plus plain `View`s, and `@playwright/test`
  (already a Phase 3 devDependency, just never actually configured — see below) now has a real
  `playwright.config.ts` and `e2e/` suite.

### Demo-mode instructions

No backend is required. `npm install && npm run web` (or `npm start` and press `w`) boots the app in
demo mode exactly as Phase 2/3 described; the Testing and Progress tabs work identically to
Supabase mode, reading/writing the same local offline store. To exercise the full Week 0 → Week 6 →
Week 12 flow without waiting 12 real weeks, see `e2e/full-flow.spec.ts`, which uses Playwright's
`page.clock` to fast-forward the simulated "now."

### Validation commands

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run format:check     # Prettier
npm test                 # Jest (199 tests as of Phase 4)
npm run validate:program # Zod-validates data/program/*.json
npm run e2e              # Playwright — routing.spec.ts + full-flow.spec.ts
npm run export:web       # expo export --platform web
npx expo export --platform ios
npx expo export --platform android
```

## Known limitations (honest, not hidden)

- Date of birth and the Week 1 Start Date use the native OS date picker
  (`@react-native-community/datetimepicker`) on iOS/Android; since that library has no web
  implementation, the web build falls back to a plain validated text field instead.
- Native date pickers can't restrict which weekdays are selectable, so the Week 1 Start Date field
  accepts any date from the picker and relies on Zod (`week1StartDateSchema`) to reject a
  non-Monday choice with an inline error, rather than graying out non-Mondays in the calendar UI.
- `src/lib/supabase/database.types.ts` is hand-written from the approved DDL rather than generated
  by the Supabase CLI (there's no live project to generate from yet); regenerate and diff it once
  one exists.
- Push notifications are modeled as user preferences (`notification_preferences`) but no actual
  scheduling/delivery is wired up yet.
- **Single-device sync only.** The offline sync engine (`src/features/workout/syncEngine.ts`)
  assumes one writer per athlete, per the PRD's single-athlete-per-install scope. It pushes local
  writes to Supabase with an idempotent upsert-on-id (safe to retry, never duplicates), but it does
  not pull or merge edits made from a second device — if the same athlete ever logged workouts from
  two devices concurrently, the two devices' local stores would not reconcile with each other. This
  is an accepted limitation for Phase 3, not something silently working around a real need.
- **Not tested on a physical iOS/Android simulator or device.** This environment has no Xcode or
  Android SDK; iOS/Android builds were verified with `expo export --platform ios|android`, which
  bundles the JS/asset payload each platform would run cleanly, but native rendering, gestures, and
  platform-specific timer/haptic/audio behavior have only been exercised via the web build (Chromium,
  Playwright, mobile viewport) and are unverified on an actual iOS/Android runtime.
- **AM session logging.** Monday Speed/Plyo, Thursday Tempo/Agility, and Saturday's long run are
  prose-described blocks in the source PDF (warm-up/plyo/acceleration/easy-run text), not a
  sets/reps grid — the guided player logs these at the session/journal level (an ordered segment
  checklist with notes) rather than inventing a per-exercise sets table the program doesn't
  prescribe. Tuesday's Core/Balance/Brake circuit, which _does_ have a clean per-movement structure
  in the source JSON, gets full per-set logging like PM strength.
- **Percentage-load-calculator lift mapping.** The source PDF prescribes percentage loads per
  exercise but never states which of the athlete's three tracked estimated maxes (trap-bar
  deadlift, back squat, bench press) a given day's percentage column is a percentage _of_. This is
  derived from each strength day's own authoritative `mainLift` field
  (`src/features/loadCalculator/resolveLiftKeyFromMainLift.ts` classifies the `mainLift` text
  itself — trap-bar/squat/bench keywords — rather than hard-coding a lookup by day letter), so a
  future edition that changes what a letter's main lift is keeps working with no code change. For
  this program version that resolves to: Day A → trap-bar deadlift, Day B → bench press, Day C →
  back squat, Day D (Athletic Resilience, kettlebell/bodyweight work) → no percentage-load
  calculator, since its `mainLift` ("Kettlebell Swing") matches none of the three tracked lifts.
- **`Alert.alert` has no web implementation.** `react-native-web`'s `Alert` module is a no-op
  (`static alert() {}`) — any `Alert.alert(...)` confirmation dialog silently does nothing on web.
  This affected two new Phase 4 confirmation flows (finalizing a testing session; replacing a
  duplicate RHR morning reading), both since rebuilt as inline, in-card confirmation UI that works
  identically on every platform (and is arguably better UX than a blocking native alert). It also
  affects two pre-existing Phase 3 flows on web specifically — `workout/[sessionId]/player.tsx`'s
  "Abandon workout?" and "Skip rest?" confirmations — which this phase did not touch, since they're
  outside Phase 4's scope; they still work correctly on iOS/Android (`Alert.alert` is real there).
- **Marker #4's "best of 2" attempts aren't in the structured content model.** The single-leg
  balance (eyes closed) marker's protocol text says "best of 2" but, unlike markers #11–14, the
  JSON's marker definition has no `attempts` field for it. The testing entry screen honors the
  protocol text (2 attempts per side) rather than the structured field, which is a gap in the
  source content model, not a Phase 4 invention — flagged for confirmation.
- **Side-plank and balance classification uses the weaker side.** Markers #4 and #9 give one
  baseline/solid/strong scale, not a per-side one, so classifying the _pair_ of left/right results
  requires a judgment call. This phase uses the lower (weaker) side's value, on the reasoning that a
  single-scale standard is most honestly met when _both_ sides clear it — this is an inference, not
  a PDF rule, and is called out here for confirmation rather than resolved silently.
- **The 3-morning RHR average is stored unrounded** (displayed to one decimal place) since the PDF
  states the protocol ("3 days averaged") but not a rounding convention; this mirrors how the
  existing e1RM formula's "round to nearest 5" convention is explicit in the PDF while RHR's isn't.
- **`workout_sessions.status` never actually becomes `'adjusted'`.** The enum value and the Program
  calendar's "adjusted" badge already existed in Phase 3, but nothing ever set a session to that
  status — `completeSession` always writes `'completed'` regardless of same-day safety adjustments.
  Phase 4's Progress/history screens work around this by reading `safety_adjustments` rows directly
  (each one already carries the trigger, reason, and recommended change) rather than relying on
  session status, so "original vs. adjusted" is still honestly answerable — but the badge itself is
  effectively dead code today. Not fixed here since changing `completeSession`'s write behavior is
  outside this phase's stated scope; flagged for a decision.
- **Onboarding's sprint-deferral answer doesn't pre-fill the Testing tab.** `week0-testing-intro`
  asks the same "have you sprinted recently" question and stores `deferWeek0SprintTest`, but the
  actual deferral record (reason + date, in `testing_results`) is only ever created by the explicit
  "defer" action on marker #11's entry screen — by design, per "never silently applied" — so an
  athlete who answered at onboarding still confirms again in Testing. A nicety (pre-filling the
  reason) was left for a future pass rather than adding scope here.
- **Not tested on a physical iOS/Android simulator or device**, same caveat as Phase 3 — this
  environment has no Xcode or Android SDK. The Playwright suite (`e2e/`) exercises the real running
  app end to end on a Chromium mobile viewport; iOS/Android were verified via
  `expo export --platform ios|android` only (bundles cleanly, native rendering unverified).

## What remains for Phase 5

Everything explicitly out of scope for Phase 4 per its brief, none of it started:

- Coaching dashboards (the schema has always reserved `program_enrollments.coach_id` and
  `profiles.role` for this — see `docs/phase1/DATABASE_SCHEMA.md`'s "Admin-readiness" section).
- Subscriptions/payments.
- Social features.
- Push-notification delivery (`notification_preferences` still only stores the athlete's chosen
  times; nothing schedules or sends anything).
- Live deployment / App Store submission.
- The smaller follow-ups flagged above under "Known limitations" (Alert-on-web for the two
  pre-existing Phase 3 dialogs, `workout_sessions.status = 'adjusted'` never being written,
  onboarding→Testing sprint-deferral pre-fill) — each is a small, scoped fix a future phase can pick
  up without re-deriving the reasoning already written down here.

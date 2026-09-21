# Phase 4 Implementation & Verification Notes

## Coach Conde — The Long Game: Athletic Edition

Phase 4 builds the complete testing, progress, history, and athlete-insight layer on top of the
Phase 3 workout tracker: the Week 0/6/12 testing system, the three-morning RHR workflow, sprint
deferral, the Progress dashboard (adherence, testing comparisons, exercise history, readiness
trends), and history/detail screens. This document is the audit trail for what was built, what was
inferred versus what came directly from the approved program data, and what needs a product-owner
decision. `mobile/README.md`'s "Phase 4" section is the user-facing summary; this document is the
detailed backing for it.

## Scope confirmation

Before writing any code, this phase confirmed:

- The working branch (`claude/coach-conde-phase-4-acdpe8`) started from `origin/main` at commit
  `dda05e9` — the merged Phase 3 pull request — with no divergence.
  `docs/phase1/PRD.md`, `DATABASE_SCHEMA.md`, `SCREEN_MAP.md`, `PROGRAM_CONTENT_MODEL.md`,
  `EXTRACTION_AUDIT.md`, `data/program/coach-conde-long-game-athletic-v1.json`, and
  `mobile/README.md` were all read before any design decision.
- Phase 2/3 code was audited (content layer, schedule engine, workout repository, offline sync,
  readiness/safety rules, design system) so Phase 4 reuses the same patterns rather than inventing
  parallel ones — see the "Architecture" section below.

## Architecture — reusing, not duplicating, Phase 2/3 patterns

- **Testing repository** (`src/features/testing/testingRepository.ts`) mirrors
  `workoutRepository.ts` exactly: local-store-first, deterministic IDs for idempotency, background
  sync only when Supabase is configured. No new offline-store abstraction was invented.
- **`testing_sessions`/`testing_results`** already existed in the Phase 2 schema
  (`supabase/migrations/20250601000006_testing.sql`) but no screen used them — Phase 4 is the first
  consumer. No SQL migration was needed.
- **Safety gating for the Athletic Five** (`testingSafetyGate.ts`) calls
  `src/features/readiness/readinessRules.ts`'s `evaluateReadiness` directly rather than
  re-implementing the calf/Achilles/hamstring/joint-pain thresholds a second time.
- **Charts** (`src/design-system/charts/`) use `react-native-svg` (already a Phase 2 dependency) and
  plain `View`s — no new npm dependency.
- **Classification** is computed only from `testing.longevityTen`/`testing.athleticFive`'s own
  `baseline`/`solid`/`strong` fields in the approved program JSON — never a fabricated threshold.

## Ambiguities found in the source data (not resolved silently)

These are gaps or tensions in the approved program content/data model that Phase 4 had to make a
judgment call on. Each is implemented with a documented, reversible choice and was originally
flagged here for confirmation. A correction round resolved items 1, 2, 3, and 5 per explicit
product-owner direction (see "Correction round" below); item 4 needed no change.

1. **RESOLVED — Marker #4 (single-leg balance, eyes closed) "best of 2" attempts.** Its protocol
   text says "best of 2" but the JSON marker definition originally had no `attempts` field (unlike
   markers #11–14, which do). Resolved as an extraction-model omission, not a program-content
   change: the JSON now carries `attempts: 2, bestAttempt: true` on marker #4's own definition,
   matching markers #11–14's shape, so the app reads structured data instead of interpreting prose
   at runtime. See `docs/phase1/EXTRACTION_AUDIT.md` item 11.
2. **RESOLVED — Side-plank (#9) and balance (#4) classification side.** The PDF gives one
   baseline/solid/strong scale per marker, not a per-side one, and both markers record left and
   right independently. Phase 4 originally classified against the weaker side by inference; this
   was **not a PDF rule** and has been removed. The app now preserves and displays left/right
   independently, classifies each side against the marker's own scale, and shows the factual
   side-to-side difference — but never produces a combined classification or a combined Week
   0→6/12 change, since no source-backed aggregation rule exists. Comparison screens show an
   explicit "no rule for combining left and right" reason instead of a fabricated verdict. See
   `docs/phase1/EXTRACTION_AUDIT.md` item 12 and `PROGRAM_CONTENT_MODEL.md`'s "Attempts and
   bilateral markers" section.
3. **RESOLVED — 3-morning RHR averaging precision/rounding.** The PDF states the protocol ("3 days
   averaged") but not a rounding convention. The app stores all three raw morning readings and
   computes the arithmetic mean at full floating-point precision; that unrounded value (`bpm`) is
   what every internal comparison and readiness rule uses (see
   `src/features/readiness/readinessRules.ts`'s `RHR_ELEVATION_THRESHOLD_BPM` check). A separate
   `bpmDisplay` field — the mean rounded to one decimal place — is display-only and is never used
   for a calculation or stored as a baseline. See `src/features/testing/rhrWorkflow.ts`'s
   `EstablishedRhr` interface.
4. **Deceleration deficit (#15) component-time protocol.** As already flagged in
   `docs/phase1/EXTRACTION_AUDIT.md` item 7, the PDF gives the formula but not full administration
   detail. Phase 4 presents "sprint-and-stop time" and "sprint-through time" as two separate raw
   inputs and computes the deficit — consistent with the Phase 1 audit's own recommendation, not a
   new judgment call. Unchanged by the correction round.
5. **RESOLVED — CMJ (#13) arm-swing method enforcement stays warn, not hard-block.** Per
   `EXTRACTION_AUDIT.md` item 8, the app stores the chosen method and **warns** — via a Card that
   explicitly states "This is a warning, not a block" — when a later entry's method differs from
   the athlete's first-ever recorded method for this marker, rather than hard-blocking the entry.
   This was confirmed as the intended behavior. What was added in the correction round: the
   Week 0→6/12 **comparison** layer now also checks whether the compared events used the same
   method, and if they differ, marks that comparison **noncomparable** (no improved/declined
   verdict is computed or shown) with a stated reason, instead of silently comparing jump heights
   recorded under two different techniques.

## A real bug found via live-app testing: Expo Router tab auto-promotion

While building the Playwright mobile-web flow, running the actual app surfaced a routing bug:
`app/(tabs)/<tab>/` directories had no `_layout.tsx` of their own, so Expo Router auto-promoted
every nested route file (Phase 3's `program/day/[date].tsx`, `today/readiness-check.tsx`, etc., and
every new Phase 4 screen) into its **own sibling tab** of the bottom tab bar instead of a screen
pushed within that tab. The tab bar showed 18 tabs instead of 5.

**Fix:** added `_layout.tsx` (a `Stack`, headers styled to match the design system, hidden only on
each tab's own `index` route) to `today/`, `program/`, `progress/`, and `testing/`. This was a
pre-existing Phase 3 issue, not a Phase 4 regression — Phase 3's own nested routes were already
affected, just not caught because there was no committed Playwright suite to catch it with. Fixing
it was in scope because Phase 4 significantly expands nested routes under every tab, and the full
Playwright flow requires correct navigation. `mobile/e2e/routing.spec.ts` is a permanent regression
guard: it asserts exactly 5 tabs after onboarding, through every nested Testing/Progress screen,
after back-navigation, and after direct/deep links.

## A real bug found via live-app testing: `Alert.alert` is a no-op on web

`react-native-web`'s `Alert` module is `static alert() {}` — a complete no-op. This silently broke
two new Phase 4 confirmation flows on web: finalizing a testing session, and confirming a duplicate
RHR-morning replacement. **Fix:** both were rebuilt as inline, in-card confirmation UI (a Card with
Cancel/Confirm buttons) instead of `Alert.alert`, which works identically on iOS, Android, and web.
This is documented as a known limitation in `mobile/README.md` rather than silently patched
everywhere — two pre-existing Phase 3 `Alert.alert` call sites in `workout/[sessionId]/player.tsx`
("Abandon workout?", "Skip rest?") are unaffected by this fix and still won't show a dialog on web,
though they work correctly on iOS/Android. Fixing those was judged out of Phase 4's scope (workout
player abandon/skip flows, not testing/progress) and is flagged for a future pass instead of
expanding this phase's surface area.

## Correction round: five reported items resolved

After the initial Phase 4 build, the product owner reviewed the five ambiguities above and one
additional Phase 3 defect, and gave explicit resolutions for all five. This section documents what
changed as a result — all treated as corrections to the initial extraction/implementation, not new
scope.

1–3, 5 are documented inline above where each ambiguity is described. Item 4 (adjusted-workout
persistence) is the largest and is documented here in full.

### A real Phase 3 defect: `workout_sessions.status` never became `'adjusted'`, so a completed
### session's adjustment history was unrecoverable

`workout_sessions.status` has always had an `'adjusted'` enum value, and the Program calendar
already had badge/state code for it, but nothing ever wrote it — `completeSession` always writes
`'completed'` regardless of same-day safety adjustments. A session that was safety- or
pickup-sport-adjusted and later completed had no way to be identified as adjusted afterward; the
Progress dashboard's "adjusted" counters were always zero.

**Why the fix doesn't just make `completeSession` write `'adjusted'` sometimes:** a single enum
column can't hold two independent facts (completion state, and whether an adjustment applied) at
once without one silently overwriting the other the moment both are true — exactly the scenario
this defect needed fixed. Instead:

- **`src/features/workout/sessionAdjustment.ts`** (new) derives "was this session adjusted" by
  joining `workout_sessions.readiness_entry_id` to *confirmed* `safety_adjustments.readiness_entry_id`
  rows, plus `sport_sessions.affected_workout_session_id` for pickup-sport adjustments.
  `computeAdjustedSessionIds` does this as a bulk join for lists (adherence, calendar);
  `isSessionAdjusted`/`safetyAdjustmentsForSession`/`sportAdjustmentsForSession` do it per session.
  `workout_sessions.status` is untouched by any of this and stays completion-state-only
  ('scheduled'/'in_progress'/'completed'/'skipped'); `'adjusted'` is kept in the Postgres enum only
  for backward compatibility and is never written or read as meaningful.
- **`getOrCreateSession`** now links a session to that day's existing readiness entry
  (`readiness_entry_id`) at creation time — previously always `null`. The Today flow always runs
  the readiness check (which creates the readiness entry, keyed on user+date) before it creates the
  session for a readiness-gated slot, so this link is reliable without needing the reverse
  (`safety_adjustments.workout_session_id`, which has an AM/PM ambiguity problem since one
  readiness entry can gate both sessions on the same day).
- **Snapshots that were always `null` are now populated.** `safety_adjustments` already had
  `original_prescription_snapshot`/`adjusted_prescription_snapshot` (jsonb) columns from Phase 2,
  but no code ever wrote them. `useReadinessGate.ts`'s `useSubmitReadiness` now populates both:
  the original snapshot is the affected slot's scheduled session type/title (built from the
  schedule engine, since no `workout_sessions` row exists yet at readiness-submission time); the
  adjusted snapshot is the trigger code + recommended adjustment in structured form.
  `confirmed_at` (already existed) is set by the existing `confirmSafetyAdjustment`.
- **`sport_sessions` brought up to the same audit-trail shape.** It previously had no
  `confirmed_at`/snapshot columns at all — migration
  `supabase/migrations/20250601000010_adjustment_audit_trail.sql` adds them, plus indexes on
  `workout_sessions.readiness_entry_id` and `safety_adjustments.readiness_entry_id` for the new
  join. `createSportSession`/`confirmSportSession` populate and set them.
- **A genuine pre-existing bug, fixed alongside this:** `program/sport-adjustment.tsx`'s "Confirm
  adjustment" button called `createSportSession` directly, which hardcoded `user_confirmed: false`
  — clicking "Confirm" never actually recorded a confirmation. It now passes `userConfirmed: true`
  (plus the original/adjusted snapshots) since that button press is itself the athlete's explicit
  confirmation.
- **`WeekAdherence.completedCount`/`adjustedCount`** (`src/features/progress/adherence.ts`) are now
  non-overlapping subsets of "trained" sessions — completed-not-adjusted vs.
  completed-and-adjusted — computed from an `adjustedSessionIds` set passed in by
  `useProgress.ts`'s `fetchProgramAdherence`, instead of the dead `status === 'adjusted'` check.
  `useProgramCalendar.ts`'s `DayCalendarState` dropped `'adjusted'` as a mutually-exclusive state
  value (a day is now `'completed'` *and* separately flagged `amAdjusted`/`pmAdjusted`), so the
  Program week/day detail screens and the Today screen can show "Completed" and "Adjusted" badges
  side by side. The readiness/adjustment history screen
  (`app/(tabs)/progress/readiness-history.tsx`) now also shows each adjustment's confirmation date
  alongside when it was triggered.
- Demo storage needed no schema change — `src/lib/offline/localWorkoutStore.ts` stores whatever
  object shape a row is given, so the new fields work identically in demo and Supabase modes once
  the repository/type layer carries them.

## Validation results

The initial Phase 4 build's validation numbers are superseded by the correction round's — both
are kept here for the audit trail.

**Initial Phase 4 build:** TypeScript 0 errors; ESLint 0 errors/0 warnings; Prettier all formatted;
Jest 199/199 across 26 suites; Playwright 7/7 (`routing.spec.ts` ×6, `full-flow.spec.ts` ×1);
platform exports (web/ios/android) all succeed; `validate:program` passes.

**After the five-item correction round** (final state of the branch):

- **TypeScript:** `npm run typecheck` — 0 errors.
- **ESLint:** `npm run lint` — 0 errors, 0 warnings.
- **Prettier:** `npm run format:check` — all files formatted.
- **Jest:** `npm test` — 212/212 tests passing across 27 suites (199 from the initial Phase 4 build
  plus 13 new: RHR full-precision-vs-display-rounding coverage, bilateral marker no-aggregation
  comparison coverage, CMJ method-mismatch noncomparable coverage, and a new
  `__tests__/sessionAdjustment.test.ts` suite (6 tests) plus `workoutRepository.test.ts` additions
  covering the adjusted-workout-persistence fix end to end — readiness-entry linking, confirmed vs.
  unconfirmed adjustments, pickup-sport confirmation, and "adjusted survives completion").
- **Playwright (`npm run e2e`):** 7/7 tests passing, unchanged in count but re-run against every
  correction — `e2e/routing.spec.ts` (6 tests: exactly five top-level tabs, nested-screen
  navigation, back navigation, direct/deep links, pre-existing Phase 3 routes) and
  `e2e/full-flow.spec.ts` (1 test: the complete sign-up → onboarding → Week 0 testing (3 RHR
  mornings, marker entry with autosave/resume, sprint deferral, session finalization) → Week 1
  workout completion (exercising the corrected `getOrCreateSession` readiness-entry linking) →
  Progress dashboard → exercise history → readiness history → Week 6 partial-retest verification
  flow, with zero console/page errors asserted throughout).
- **Platform exports:** `expo export --platform web|ios|android` all succeed.
- **`npm run validate:program`:** program content (including marker #4's corrected `attempts`
  field) still validates against its Zod schema.

## What Phase 4 did not touch

- The approved program JSON's prescribed program content (loads, reps, schedules, thresholds) —
  read-only throughout. The correction round added one structured metadata field
  (`attempts`/`bestAttempt` on marker #4) to correct an extraction-model omission, per explicit
  product-owner instruction — see "Correction round" above; this is not a change to what the
  program prescribes.
- Phase 3's workout player, schedule engine, readiness/safety rules engine, load calculator, or
  pickup-sport rules — only consumed via their existing exports.
- The initial Phase 4 build needed no SQL migration (the testing tables already existed). The
  correction round added one migration
  (`supabase/migrations/20250601000010_adjustment_audit_trail.sql`) to fix the Phase 3
  adjusted-workout-persistence defect — see "Correction round" above.

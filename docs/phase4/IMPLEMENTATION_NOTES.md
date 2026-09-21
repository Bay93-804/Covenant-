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
judgment call on. Each is implemented with a documented, reversible choice and flagged here for
confirmation — none of it silently reinterprets the program.

1. **Marker #4 (single-leg balance, eyes closed) "best of 2" isn't a structured field.** Its
   protocol text says "best of 2" but the JSON marker definition has no `attempts` field (unlike
   markers #11–14, which do). Phase 4 honors the protocol text and lets the athlete log up to 2
   attempts per side. *Needs confirmation: is this the intended reading, or should marker #4 be
   single-attempt like marker #9?*
2. **Side-plank (#9) and balance (#4) classification side.** The PDF gives one baseline/solid/strong
   scale per marker, not a per-side one, but both markers record left and right independently. Phase
   4 classifies against the **weaker** side. *Needs confirmation: weaker side, better side, or an
   average?*
3. **3-morning RHR averaging has no stated rounding rule.** Phase 4 stores/display the arithmetic
   mean to one decimal place (e.g. `58.7`). This is different from the e1RM formula, which the PDF
   explicitly says to round to the nearest 5 lb. *Needs confirmation: is one-decimal display
   acceptable, or should this round to a whole bpm?*
4. **Deceleration deficit (#15) component-time protocol.** As already flagged in
   `docs/phase1/EXTRACTION_AUDIT.md` item 7, the PDF gives the formula but not full administration
   detail. Phase 4 presents "sprint-and-stop time" and "sprint-through time" as two separate raw
   inputs and computes the deficit — consistent with the Phase 1 audit's own recommendation, not a
   new judgment call.
5. **CMJ (#13) arm-swing method enforcement.** Per `EXTRACTION_AUDIT.md` item 8, the app stores the
   chosen method and **warns** (via a locked-looking radio pre-selected from prior data) rather than
   hard-blocking a later entry that picks the other method — chosen to avoid blocking a legitimate
   re-test if the athlete's earlier choice was a mistake. *Needs confirmation: warn or hard-block?*

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

## Validation results

All commands below were run against the final state of the branch.

- **TypeScript:** `npm run typecheck` — 0 errors.
- **ESLint:** `npm run lint` — 0 errors, 0 warnings.
- **Prettier:** `npm run format:check` — all files formatted.
- **Jest:** `npm test` — 199/199 tests passing across 26 suites (131 pre-existing Phase 2/3 tests,
  68 new Phase 4 tests covering scheduling, RHR, sprint deferral, marker classification/parsing,
  results aggregation, adherence, exercise history/PB detection, readiness trends, offline sync
  parity, and repository idempotency).
- **Playwright (`npm run e2e`):** 7/7 tests passing —
  `e2e/routing.spec.ts` (6 tests: tab-count regression guard, nested-screen navigation, back
  navigation, direct/deep links, pre-existing Phase 3 routes) and `e2e/full-flow.spec.ts` (1 test:
  the complete sign-up → onboarding → Week 0 testing (3 RHR mornings, marker entry with
  autosave/resume, sprint deferral, session finalization) → Week 1 workout completion → Progress
  dashboard → exercise history → readiness history → Week 6 partial-retest verification flow, with
  zero console/page errors asserted throughout).
- **Platform exports:** `expo export --platform web|ios|android` all succeed.
- **`npm run validate:program`:** program content still validates against its Zod schema —
  untouched by this phase.

## What Phase 4 did not touch

- The approved program JSON (`data/program/*.json`) — read-only throughout.
- Phase 3's workout player, schedule engine, readiness/safety rules engine, load calculator, or
  pickup-sport rules — only consumed via their existing exports.
- Any SQL migration — the testing tables already existed.

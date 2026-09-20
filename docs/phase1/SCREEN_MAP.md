# Route & Screen Map — Phase 1 Plan
## Coach Conde — The Long Game: Athletic Edition

Expo Router, file-based. Five tabs after onboarding: **Today · Program · Progress · Testing · Profile**.

```
app/
├── _layout.tsx                         Root layout: theme provider, TanStack Query client,
│                                        Supabase session listener, offline-sync provider
├── index.tsx                           Redirect: -> onboarding if no active enrollment,
│                                        else -> /(tabs)/today
│
├── (auth)/
│   ├── _layout.tsx                     Unauthenticated stack
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   └── forgot-password.tsx
│
├── (onboarding)/
│   ├── _layout.tsx                     Gated: authenticated, no active enrollment
│   ├── welcome.tsx                     Brand intro: Mindset·Character·Purpose·Success
│   ├── profile-setup.tsx               Units (lb/kg, mi/km), display name, DOB (optional)
│   ├── medical-clearance.tsx           PDF disclaimer + clearance acknowledgement (required checkbox)
│   ├── program-start-date.tsx          Calendar picker -> creates program_enrollment
│   ├── starting-maxes.tsx              Optional: enter/estimate e1RM for trap-bar DL / squat / bench
│   ├── week0-testing-intro.tsx         Explains Week 0 baseline test, sprint-test deferral caution
│   └── notification-setup.tsx          AM/PM reminder times -> notification_preferences
│
├── (tabs)/
│   ├── _layout.tsx                     Tab bar: Today, Program, Progress, Testing, Profile
│   │
│   ├── today/
│   │   ├── index.tsx                   TODAY — week/block/day, AM+PM cards, readiness gate entry,
│   │   │                                completion %, next session, rest-day guidance
│   │   ├── readiness-check.tsx         Modal/route: sleep, RHR, calf/Achilles, hamstring, joint
│   │   │                                pain, 1-5 readiness -> may render a safety-adjustment card
│   │   └── safety-adjustment.tsx       Shows triggered rule, reason, recommended change;
│   │                                    requires explicit "Confirm adjustment" (never silent)
│   │
│   ├── program/
│   │   ├── index.tsx                   PROGRAM CALENDAR — 12-week grid grouped by block
│   │   │                                (Absorb/Build/Express), deload + retest markers, Week 0 chip
│   │   ├── week/[weekNumber].tsx       Week detail: Mon-Sun, AM/PM per day
│   │   ├── day/[dayId].tsx             Day detail: session cards for AM/PM, tap -> workout or
│   │   │                                read-only past-session summary (never re-opens for edit
│   │   │                                past a grace window — see PRD "preserve history")
│   │   └── sport-adjustment.tsx        Log a pickup game -> shows matching PDF rule -> confirm
│   │
│   ├── progress/
│   │   ├── index.tsx                   PROGRESS DASHBOARD — 12-wk completion, streak, AM/PM
│   │   │                                adherence, block-by-block completion, RIR accuracy,
│   │   │                                readiness/sleep/RHR trend sparklines, pain flags (neutral tone)
│   │   ├── strength/[liftKey].tsx      Per-lift load progression chart (e1RM history + set log)
│   │   ├── running.tsx                 Running volume, sprint volume trend (vs weeklySpeedPlan target)
│   │   └── records.tsx                 Personal records list (lift PRs, sprint/jump PRs)
│   │
│   ├── testing/
│   │   ├── index.tsx                   TESTING — Week 0 / Week 6 / Week 12 cards + comparison entry
│   │   ├── session/[eventKey].tsx      Marker checklist for that test event (week0/week6/week12)
│   │   ├── marker/[markerNumber].tsx   Single-marker entry form (attempts, L/R, units, notes) —
│   │   │                                shared component parameterized by testing_marker_defs
│   │   └── compare.tsx                 Week 0 vs 6 vs 12 comparison charts + baseline/solid/strong
│   │                                    classification (Week 6 explicitly partial — see audit)
│   │
│   └── profile/
│       ├── index.tsx                   PROFILE — units, program status (active/paused), restart,
│       │                                account, sign out
│       ├── edit.tsx                    Edit profile fields
│       ├── maxes.tsx                   Manage e1RM estimates (trap-bar DL, squat, bench) + history
│       ├── notifications.tsx           notification_preferences editor
│       ├── program-management.tsx      Pause / resume / restart-at-block-start flow
│       └── about.tsx                   Program disclaimer, brand footer, version/edition info
│
├── workout/
│   ├── [sessionId]/
│   │   ├── _layout.tsx                 Guards: confirm-before-abandon, autosave provider
│   │   ├── overview.tsx                Session preview before starting (exercise list, est. time,
│   │   │                                substitution options, prior performance)
│   │   ├── player.tsx                  WORKOUT PLAYER — one exercise/cluster at a time, rest
│   │   │                                timer, set logging, pain flag, notes, substitution picker
│   │   └── summary.tsx                 Post-workout summary, journal prompts, completion %
│   │
└── modal/
    ├── substitution-picker.tsx
    ├── unit-converter.tsx
    └── confirm-abandon-workout.tsx
```

## Screen-to-data mapping (high level)

| Screen | Primary reads | Primary writes |
|---|---|---|
| Today | active `program_enrollments`, today's `workout_sessions` (create-if-missing from templates), latest `readiness_entries` | `readiness_entries`, `workout_sessions.status` |
| Program Calendar | `program_weeks`/`program_days`/`workout_templates` (content) joined with the enrollment's `workout_sessions` (instance) | `sport_sessions` (via sport-adjustment) |
| Workout Player | `workout_exercises` + `prescribed_sets` for the current week, prior `completed_sets` for "previous performance" | `completed_sets` (autosaved per set), `journal_entries` (set/exercise level) |
| Testing | `testing_marker_defs`, `testing_sessions`, `testing_results` | `testing_results`, `personal_records`, `exercise_maxes` (trap-bar E1RM marker) |
| Progress | aggregates over `workout_sessions`, `completed_sets`, `readiness_entries`, `testing_results` | none (read-only dashboards) |
| Profile | `profiles`, `notification_preferences`, `exercise_maxes` | `profiles`, `notification_preferences`, `program_enrollments` (pause/restart) |

## Navigation rules worth calling out

- Opening a **past** day/session from Program Calendar routes to a **read-only** summary, not `workout/[sessionId]/player`, unless that session's `status` is still `scheduled`/`in_progress` for *today or a future date* — this is what "must be able to open past workouts without accidentally overwriting them" (PRD) maps to concretely.
- `workout/[sessionId]/player` is wrapped in a confirm-before-abandon guard (`modal/confirm-abandon-workout`) triggered on back-navigation or app backgrounding beyond a threshold.
- Safety-adjustment and sport-adjustment flows are **modals that block continuation** until the user taps Confirm or Cancel — never auto-applied.

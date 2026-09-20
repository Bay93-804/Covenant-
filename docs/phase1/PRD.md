# Product Requirements Document
## Coach Conde — The Long Game: Athletic Edition (mobile app)

Status: **Phase 1 — audit & architecture only. No application code written yet.**
Source of truth: `Coach Conde - The Long Game Athletic Edition.pdf` (17 pages, Edition 1.0), fully transcribed and cross-verified (rendered-page read + raw PDF text layer) into `data/program/coach-conde-long-game-athletic-v1.json`.

---

## 1. Purpose

A single-athlete (MVP), admin-architected-for-future-coach, cross-platform mobile app that lets a user follow and fully track Coach Conde's 12-week "Long Game — Athletic Edition" program end to end: Week 0 baseline testing → 12 weeks of AM/PM sessions across three blocks (Absorb, Build, Express) → Week 6 mid-program retest → Week 12 final test — with offline-capable logging, readiness/safety gating, sport-adjustment handling, and progress/testing comparison views.

## 2. Who it's for

One athlete per install initially (the signed-in Supabase user). Schema is normalized and ownership-scoped so a future coach dashboard can attach to the same tables without a rewrite (see `DATABASE_SCHEMA.md` §"Admin-readiness").

## 3. Program facts the app must encode (see full detail in the content model)

- 12 weeks, 4 training days/week (Mon, Tue, Thu, Sat), 2 sessions/day (AM ~30–40 min, PM ~40–45 min) ≈ 75 min/training day. Wed/Fri/Sun are off (walk or mobility optional).
- Three 4-week blocks: **Block 1 Absorb** (wk 1–4, deload wk 4), **Block 2 Build** (wk 5–8, retest wk 6, deload wk 8), **Block 3 Express** (wk 9–12, contrast training, wk 12 = taper + full test week).
- Every PM strength day (A=Mon/Hinge, B=Tue/Upper, C=Thu/Squat, D=Sat/Resilience) is built from clusters (A/B/C, quality-cap primer → main lift → finisher), each with 2–4 rounds and per-exercise weekly progression (% of e1RM, RIR, or quality-cap bodyweight work).
- AM days: Monday = Speed & Plyometrics (35 min), Tuesday = Core/Balance/Brake (30 min), Thursday = Tempo/repeat-sprint + agility, Saturday = long easy run + mobility flow. A 10-minute mobility flow follows every AM run.
- 15 testing markers (Longevity Ten + Athletic Five) at Week 0 (baseline, full 15), Week 6 (**partial, 6 markers only** — see audit), Week 12 (full 15, spread over a 3-day test week).
- Hard safety rules (sleep, RHR, calf/Achilles, hamstring, joint pain, missed weeks) that must gate and visibly modify sessions, never silently.
- Pickup-sport adjustment rules that require user confirmation before altering the calendar.
- No true 1RM testing; all percentage work capped at 80%; e1RM estimated via "heavy set of 5 @ RIR1 × 1.15."

## 4. Primary user journeys

1. **Onboarding** → set program start date → optional Week 0 baseline testing (all 15 markers, or defer #11 per PDF caution) → enter starting e1RM estimates for trap-bar deadlift / back squat / bench press (or estimate from a heavy-5 set) → notification preferences.
2. **Daily use** → Today screen shows current week/block/day, AM+PM cards, readiness check gate before speed/strength sessions, Start Workout → guided Workout Player (one exercise/cluster at a time) → autosaved logging → completion summary.
3. **Testing** → Week 0/6/12 structured entry forms per marker, with attempts, best-attempt selection, L/R capture, auto-computed E1RM and deceleration deficit, and baseline/solid/strong classification.
4. **Safety** → readiness questionnaire before speed/plyo/strength sessions; if a rule triggers (e.g., RHR +7bpm × 3 mornings, sleep <6h, calf/Achilles twinge, hamstring "grabby," joint pain, 2 missed weeks), show the reason + PDF-specified adjustment and require explicit confirmation before the session is modified. Never auto-mutate silently.
5. **Sport day** → log a pickup game → app proposes the matching adjustment (Thursday agility swap, Monday speed reduction, Strength D move, Block-1-first gate for long-absent players) → user confirms → calendar updates, history preserved.
6. **Progress & Testing review** → adherence, PRs, RIR accuracy, readiness/sleep/RHR trends, pain flags (non-shaming), Week 0 vs 6 vs 12 comparison charts.
7. **Pause/resume/restart** → pausing preserves history; a 2-missed-week gap prompts a restart-at-block-start per PDF rule, with explicit confirmation, never silent recalculation.

## 5. Non-functional requirements

- Expo React Native + TypeScript + Expo Router, testable in Expo Go on iOS & Android.
- Offline-first workout logging (local persistence + background sync to Supabase); no data loss on airplane-mode sessions.
- Supabase Postgres + Auth + RLS; service-role key never shipped in the client; `.env.example` provided; app falls back to bundled mock/local data when Supabase env vars are absent, so the UI is previewable without a backend.
- Zod validation at every form boundary; TanStack Query for server state; business logic (load calculators, safety-rule engine, progression engine) isolated from UI components and unit-testable.
- Accessibility: Dynamic Type support, screen-reader labels, ≥44pt touch targets.
- Duplicate-submission guards, confirm-before-abandon on an active workout, autosave per set.
- Design system: Midnight Navy background / Burnished Gold accents / Bone text / Silver secondary — athletic, premium, disciplined, minimal; no gamified badges, streak-shaming, or SaaS-dashboard clichés.

## 6. Explicitly out of scope for MVP

- Coach dashboard UI (schema must support it; no screens built now).
- Payments, social features, wearable integrations.
- True 1RM testing (against program rules — must never be offered).

## 7. Versioning

`program_content` is stored as versioned, importable JSON (`data/program/coach-conde-long-game-athletic-v1.json`), not hardcoded into screens, so a future "Edition 2.0" or a different Coach Conde program can be authored and swapped without an app rebuild. The importer (Phase 2) reads this file into `program_weeks` / `program_days` / `workout_templates` / `exercise_templates` / `prescribed_sets`.

## 8. Resolved decisions and remaining open items

Two decisions below were open questions in an earlier draft of this PRD and have since been confirmed by the product owner; the rest still need confirmation before Phase 2 locks them in (full list in `EXTRACTION_AUDIT.md`).

**Resolved — Week 0 baseline testing.** Week 0 is the complete baseline for all 15 markers, finished before Week 1 begins. Resting heart rate (#1) is collected across three mornings and averaged; the Athletic Five (#11-15) is tested together on a separate, fresh day after a full warm-up; the 10-yard sprint (#11) is deferred to Week 6 if the athlete hasn't run fast since their twenties (markers #12-15 are still tested at Week 0 regardless). The app may recommend a three-session schedule modeled on Week 12's format, but presents it as a **flexible suggested schedule**, never a fixed prescription — the PDF doesn't specify exact Week 0 weekdays. See `testing.events.week0.suggestedSchedule` (`isFlexible: true`) in the content model.

**Resolved — Week 6 retest scope.** Week 6 is a partial retest of exactly six markers: resting heart rate (#1), single-leg balance eyes closed (#4), sit-to-rise (#5), side plank (#9), standing broad jump (#12), and the 10-to-5 deceleration deficit (#15) — plus the 10-yard sprint (#11) only when it was deferred at Week 0. It is never presented as a full 15-marker retest. The Progress/Testing screens show a full 15-marker Week 0 vs Week 12 comparison, and a separate 6-or-7-marker comparison that includes Week 6.

**Still open:** the remaining smaller items in `EXTRACTION_AUDIT.md` (combo/contrast exercise-cell presentation, substitution-to-exercise mapping, Week 8 max re-estimation UX, program-start-date weekday constraint, etc.).

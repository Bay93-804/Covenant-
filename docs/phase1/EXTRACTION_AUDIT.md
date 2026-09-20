# PDF Extraction Audit
## Coach Conde — The Long Game: Athletic Edition

**Method:** Every one of the 17 pages was read twice — once as rendered page images, once via `pdftotext -layout` against the PDF's actual text layer — and cross-checked value by value. All strength-day tables (4 days × 3 blocks × 3 clusters × ~4 exercises × 4 weeks), the two testing tables (15 markers), the weekly speed/plyo/running table (12 rows), the AM block templates, and all rule/protocol tables matched between the two extraction methods with no discrepancies found. The resulting structured file is `data/program/coach-conde-long-game-athletic-v1.json`.

Below is everything that is **not** a literal transcription — i.e., anywhere the app needs to make a judgment call, fill a gap the PDF leaves open, or resolve an apparent tension. Each item needs your confirmation before Phase 2 locks it into the data model or business logic.

---

## 1. Week 0 baseline-test day-by-day schedule is not specified

The PDF gives a full Monday–Sunday breakdown for **Week 12** (test days Wed/Thu/Sat) and a single-day breakdown for **Week 6** (Wednesday, 6 markers). It never gives an equivalent schedule for **Week 0** — only "Fifteen markers. Tested Week 0, Week 6 and Week 12" (cover) and the medical-clearance/sprint-deferral callout (p.4).

**Proposed default:** mirror the Week 12 structure — Day 1: the 6 Longevity Ten "quick" markers (RHR, grip, balance-eyes-closed, sit-to-rise, deep squat hold, shoulder flexion); Day 2: Athletic Five, fresh, full warm-up, nothing else that day; Day 3: trap-bar E1RM, push-ups, side plank, optional 1.5-mile run. This is encoded in `data/program/coach-conde-long-game-athletic-v1.json` under `testing.events.week0` with `scheduleSpecifiedInPdf: false` so it's traceable as an assumption, not a fact.

**Needs your confirmation:** does Week 0 happen before "Week 1" starts (i.e., its own untrained days), or does it borrow Week 1's off-days (Wed/Fri/Sun)? The PDF's "12 weeks" framing suggests Week 0 is a distinct pre-week, not counted in the 12 — the app should model it that way (program start date = first day of Week 0, Week 1 Monday begins after Week 0 testing completes), but this is an inference, not a stated rule.

## 2. Week 6 retest is intentionally partial — only 6 of 15 markers

Explicitly stated (p.12): resting heart rate, single-leg balance eyes closed, sit-to-rise, side plank, standing broad jump, and the 10-to-5 deceleration deficit — plus, conditionally, the 10-yard sprint if it was deferred at Week 0.

The original task description says "Compare Week 0, Week 6, and Week 12 results" for all fifteen markers. **This is a real tension**, not an extraction failure — the source program simply does not retest all 15 markers at Week 6. The app should surface a 6-marker (or 7, if the sprint was deferred) comparison at Week 6, and a full 15-marker comparison only between Week 0 and Week 12. Flagging so the Progress/Testing UI doesn't imply data that doesn't exist. Encoded as `testing.events.week6.markers` (6 items) vs `week0`/`week12` (15 items each) in the content JSON.

## 3. Week 8 "re-estimate maxes" has no stated test protocol

Progression Rules (p.16): "Percentage lifts: the card tells you. Re-estimate maxes at Week 8, not before." No protocol is given for *how* — unlike the Longevity Ten's explicit trap-bar E1RM protocol (heavy 5 @ RIR1 × 1.15), which is only formally re-tested at Week 0/6\*/12 (\*not actually part of Week 6's 6-marker subset — see item 2).

**Proposed default:** an on-demand "Update Estimated Max" action (available from Week 8 onward, and any time) that applies the same formula — heavy set of 5 at RIR 1, × 1.15, rounded to nearest 5 lb — to trap-bar deadlift, back squat, and bench press independently, since all three use the same percentage scheme. Encoded as `testing.maxRecalculation` in the content JSON. **Needs your confirmation**, since this is the app inventing a UI flow for a rule the PDF states but doesn't operationalize.

## 4. Combo/paired cells that don't fit a clean one-exercise-one-prescription row

- **Block 3, Strength B, Cluster C3:** "Face Pull + Band External Rotation" prints as one row with a slash-separated rep pair (`x20 / x15`). Modeled as a single `workout_exercises` row with `is_combo = true` and `reps_display` retaining the slash text — the Workout Player will need a small UI affordance (two rep inputs under one card) rather than the standard single-exercise card. Confirm this is acceptable, vs. splitting into two exercise rows sharing one rest interval.
- **Block 3 Contrast clusters** (all four Strength days' Cluster B): each B-cluster pairs a heavy main-lift set with an explosive movement (e.g., Trap-Bar Deadlift + Broad Jump, Back Squat + Countermovement Jump). The PDF's own language — "heavy set → 60s → jump" — implies the two rows execute as one contrast pair within the round, not as independent supersets. Modeled with a `notes: "Contrast pair with B1/B3"` annotation on the paired row; the Workout Player should present these as a linked pair (heavy set, short internal rest, explosive rep) rather than two unrelated exercises sharing a cluster.

## 5. Substitution table gives prose guidance, not always a 1:1 exercise mapping

The Substitutions table (p.16) is equipment/situation → prose recommendation ("Somewhere to sprint" → "A bike or rower for the aerobic work, plus hill walking. But find somewhere to sprint..."). Only some rows map cleanly to a specific alternate `exercise_templates` row (e.g., "Back squat" → "Goblet squat" is a clean 1:1). Others (hills/sleds, "somewhere to sprint") are situational guidance, not an exercise swap. The schema's `substitutions.exercise_template_id` is left nullable for exactly this reason — Phase 2 will need a judgment call per row on which are structured swaps vs. free-text guidance to display as-is.

## 6. "The 15 markers" test-day groupings differ slightly between Week 6 and Week 12 Day 1

Week 12 Test Day 1 groups RHR + grip + balance-eyes-closed + sit-to-rise + deep-squat-hold + shoulder-flexion (6 markers). Week 6's list is RHR + balance-eyes-closed + sit-to-rise + side-plank + broad-jump + decel-deficit (a different 6, mixing one Athletic-Five marker in). These are correctly captured as two distinct lists in the content JSON — flagging only so a future edit doesn't assume they're the same "quick 6" reused verbatim.

## 7. Deceleration Deficit (#15) protocol is a formula, not a fully specified test procedure

"Sprint-and-stop time minus sprint-through time over 10 yards" (p.4) gives the calculation but not full operational detail (how "stop" is defined/timed — e.g., full stationary stop vs. deceleration-to-walk, starting cues, whether it's electronic timing or phone-app). Reasonable for a coach delivering this in person; underspecified for a self-serve digital form. Phase 2's testing form should present the two component times (sprint-and-stop, sprint-through) as separate inputs and auto-compute the deficit, with the exact administration instructions left as coach-authorable copy rather than hardcoded assumptions.

## 8. Countermovement Jump arm-swing method — "pick one and never change it"

Marker #13's protocol explicitly requires the athlete to lock in either "hands on hips" or "arm swing" at first test and reuse it every time. This is a data-integrity rule, not just a protocol note — the app should store the chosen method at Week 0 and either enforce it or warn if a later test entry tries to record the other method. Encoded as a `note` on the marker definition; Phase 2 should turn it into a stored per-user setting.

## 9. Nothing in the PDF gives exact rest-day/off-day AM structure beyond "walk 20-30 min if you want" / "or the mobility flow on its own"

Wednesday and Friday AM are optional, not prescribed with sets/reps — this is correct as extracted (not a gap), but noting it so the Today screen's "rest day" guidance is built as *optional suggestions* (walk, or standalone mobility flow), not a schedulable/loggable workout template in the same sense as the four training days.

## 10. No day-of-week is given for Week 0 relative to program start date

The user picks "a program start date" (PRD requirement). Whether that start date should land on a Monday (so Week 1 begins cleanly) or can be any weekday (with Week 0 testing absorbing the partial week) is an app UX decision the PDF doesn't address. Recommend constraining the start-date picker to Mondays for schedule clarity — **flagging for your decision**, not assuming it silently.

---

## Not a gap, just worth stating plainly

Every numeric prescription in the four Strength Days (A/B/C/D) across all three blocks, every AM template (Monday Speed & Plyo, Tuesday Core/Balance/Brake, Mobility Flow) across all three blocks, the full 12-row weekly speed/plyo/running table, both 10-marker/5-marker testing tables, the pickup-sport table, the six progression-rule bullets, the eight substitution rows, and the six back-off signal rows are **directly and completely transcribed** with no interpretation required. Those are the parts of "do not summarize or create generic placeholder workouts" that are simply done, verified twice, and ready for the Phase 2 seed-data importer to consume as-is from `data/program/coach-conde-long-game-athletic-v1.json`.

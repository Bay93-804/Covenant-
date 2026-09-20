# Structured Program-Content Model

The full 12-week program extracted from the PDF lives at:

**`data/program/coach-conde-long-game-athletic-v1.json`**

This is the Phase 1 "structured program-content model" deliverable — a versioned, importable data file, not hardcoded screen content. Phase 2's seed-data importer reads this file and writes it into `program_versions` / `program_weeks` / `program_days` / `workout_templates` / `exercise_templates` / `workout_exercises` / `prescribed_sets` / `testing_marker_defs` / `am_week_overlays` (see `DATABASE_SCHEMA.md`).

## Top-level shape

```
{
  meta: { id, title, subtitle, tagline, closingTagline, brandLines[], edition,
          durationWeeks, sessionsPerDay, daysPerWeekTrained, avgTrainingDayMinutes,
          amMinutesRange, pmMinutesRange, sourceDocument, sourcePages, disclaimer },

  clustersGlossary: [ {slot, role, description} ]          // A1/B1/A2-B2/A3-B3/A4-B4-C
  executionRules: [ string ]                                // the 4 numbered execution rules
  loadingMethods: [ {method, looksLike, meaning} ]           // PERCENTAGE / RIR_CAP / QUALITY_CAP
  twoSafetyRules: [ string ]                                 // "nothing above 80%..." / "no sprinting cold..."

  weeklyTemplate: [ {day, am:{minutes,label,ref}, pm:{minutes,label,ref}} ]  // the 7-day skeleton

  blocks: [ {id, name, weeks[], deloadWeek, retestWeek?, taperAndTestWeek?,
             strengthPowerNote, speedPlyoNote, loading:{pctRange,rir,repRange}, narrative} ]
  deloadWeeksGeneric: {...}
  deloadWeeks: [4, 8, 12]

  mondayAmSpeedPlyo: { title, minutes, byBlock: {1:{...},2:{...},3:{...}} }
  tuesdayAmCoreBalanceBrake: { title, minutes, structure, narrative,
                                movements: [ {order,name,coachingKey,byBlock:{1,2,3},eachSide} ] }
  mobilityFlow: { title, minutes, when, movements: [ {name, byBlock:{1,2,3}} ] }

  weeklySpeedPlan: [                                          // 12 entries, one per week 1-12
    {week, monAm, thuAm, satAmMinutes, sprintVolumeYd, note, deload?, retest?, testWeek?}
  ]
  speedRules: [ {rule, detail} ]

  strengthDays: {
    A: { "1": {day,focus,mainLift,weeks:[1,2,3,4],clusters:[...]}, "2": {...weeks 5-8}, "3": {...weeks 9-12} },
    B: { same shape, keyed by block "1"/"2"/"3" },
    C: { same shape },
    D: { same shape }
  }

  testing: {
    longevityTen: [ {num,name,protocol,unit,direction,baseline,solid,strong,thresholdOp,...} ],  // markers 1-10
    athleticFive: [ {num,name,protocol,unit,direction,baseline,solid,strong,thresholdOp,...} ],  // markers 11-15
    events: { week0: {...}, week6: {...}, week12: {...} },     // which markers, which days, see audit
    maxRecalculation: {...}                                     // Week 8 re-estimate guidance
  }

  pickupSportRules: [ {situation, action} ]
  progressionRules: [ {category, rule} ]
  substitutions: [ {missing, useInstead, isSafetyRule?} ]
  backOffSignals: [ {signal, response, code, recommendEvaluation?} ]
  recoveryPrinciples: [ string ]
}
```

## `strengthDays.<A|B|C|D>.<block>.clusters[]` shape

Each cluster (`A`, `B`, `C`) carries `id`, `label`, `rounds`, `restNote`, `qualityCap`, `contrast`, and an `exercises[]` array. Each exercise:

```
{
  order: "B1",                     // matches the PDF's row label
  name: "Trap-Bar Deadlift",
  rest: "75s",
  eachSide: false,
  comboExercise: false,            // true only for the one paired-cell row (see audit item 4)
  notes: "Contrast pair with B1",  // present on Block-3 contrast partners
  weeks: [                          // exactly 4 entries = the 4 weeks of this block
    { load: { type: "percentage", value: 65 }, reps: "x8" },
    { load: { type: "percentage", value: 68 }, reps: "x8" },
    { load: { type: "percentage", value: 72 }, reps: "x8" },
    { load: { type: "percentage", value: 60 }, reps: "x8" }   // deload week of the block
  ]
}
```

`load.type` is one of `percentage` (of current e1RM), `rir` (reps-in-reserve target), or `none` (bodyweight/quality-cap/mobility work where the PDF prints "—" in the %/RIR column — reps/time/distance is still prescribed in `reps`).

`weeks[i]` corresponds to `block.weeks[i]` (i.e., `strengthDays.A["2"].clusters[1].exercises[0].weeks[2]` is week 7, the third of weeks 5–8).

## Validation performed

- Every table value was read from rendered page images **and** from `pdftotext -layout` output of the same PDF, independently, and diffed by eye — zero discrepancies found across all 17 pages.
- `python3 -m json.tool` validates the output file parses as JSON.
- Spot-checked combo/contrast rows programmatically post-generation (see audit item 4) to confirm they carry the right flags.

## What Phase 2's importer still needs to do (not done here)

- Expand `strengthDays` + `weeklyTemplate` + `weeklySpeedPlan` + `am*` templates into concrete `program_days`/`workout_templates`/`workout_exercises`/`prescribed_sets` rows for a given `program_version_id`.
- Materialize `am_week_overlays` rows from `weeklySpeedPlan`.
- Materialize `testing_marker_defs` rows from `testing.longevityTen` + `testing.athleticFive`.
- Resolve `substitutions[].exercise_template_id` where a clean 1:1 exercise mapping exists (see audit item 5).

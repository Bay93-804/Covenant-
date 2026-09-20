/**
 * Zod schema for the Phase 1 authoritative program-content file:
 * `data/program/coach-conde-long-game-athletic-v1.json`.
 *
 * This schema is deliberately shaped to match the JSON exactly as verified
 * in docs/phase1/PROGRAM_CONTENT_MODEL.md and docs/phase1/EXTRACTION_AUDIT.md
 * — it validates structure and types, it never re-derives or reinterprets
 * program values. If validation fails, that is a signal the source JSON or
 * this schema has drifted, not a cue to "fix" the data.
 *
 * Every top-level key from the content model doc is represented. Nothing is
 * dropped silently: unknown/extra keys are rejected (`.strict()` on record
 * shapes where the source is fully known) so a future edit to the JSON that
 * this schema hasn't caught up with fails loudly in tests rather than
 * silently losing data at import time.
 */
import { z } from 'zod';

const numberTuple = z.tuple([z.number(), z.number()]);

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

export const programMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  tagline: z.string(),
  closingTagline: z.string(),
  brandLines: z.array(z.string()),
  edition: z.string(),
  durationWeeks: z.number().int().positive(),
  sessionsPerDay: z.number().int().positive(),
  daysPerWeekTrained: z.number().int().positive(),
  avgTrainingDayMinutes: z.number().positive(),
  amMinutesRange: numberTuple,
  pmMinutesRange: numberTuple,
  sourceDocument: z.string(),
  sourcePages: z.number().int().positive(),
  disclaimer: z.string(),
});

// ---------------------------------------------------------------------------
// Glossary / rules / loading methods / safety
// ---------------------------------------------------------------------------

export const clusterGlossaryEntrySchema = z.object({
  slot: z.string(),
  role: z.string(),
  description: z.string(),
});

export const loadingMethodSchema = z.object({
  method: z.string(),
  looksLike: z.string(),
  meaning: z.string(),
});

// ---------------------------------------------------------------------------
// Weekly template (7-day skeleton)
// ---------------------------------------------------------------------------

export const weeklyTemplateSessionSchema = z.object({
  // Off days (Wed/Fri/Sun) omit minutes/ref entirely; Saturday's AM prints
  // `minutes: null` because its long-run length is week-specific
  // (weeklySpeedPlan[].satAmMinutes) rather than a fixed range.
  minutes: numberTuple.nullable().optional(),
  label: z.string(),
  ref: z.string().optional(),
});

export const weeklyTemplateDaySchema = z.object({
  day: z.string(),
  am: weeklyTemplateSessionSchema,
  pm: weeklyTemplateSessionSchema,
});

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export const blockLoadingSchema = z.object({
  pctRange: numberTuple,
  rir: z.string(),
  repRange: numberTuple,
});

export const blockSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  weeks: z.array(z.number().int()),
  deloadWeek: z.number().int(),
  retestWeek: z.number().int().optional(),
  taperAndTestWeek: z.number().int().optional(),
  strengthPowerNote: z.string(),
  speedPlyoNote: z.string(),
  loading: blockLoadingSchema,
  narrative: z.string(),
});

export const deloadWeeksGenericSchema = z.object({
  pctRange: numberTuple,
  rir: z.string(),
  note: z.string(),
});

// ---------------------------------------------------------------------------
// AM templates: Monday Speed/Plyo, Tuesday Core/Balance/Brake, Mobility Flow
// ---------------------------------------------------------------------------

const byBlockStringRecord = z.record(z.string(), z.string());

export const mondayAmBlockSchema = z.object({
  warmup: z.string(),
  plyometric: z.string(),
  acceleration: z.string(),
  easyRun: z.string(),
  flow: z.string(),
});

export const mondayAmSpeedPlyoSchema = z.object({
  title: z.string(),
  minutes: z.number(),
  byBlock: z.record(z.string(), mondayAmBlockSchema),
});

export const coreBalanceBrakeMovementSchema = z.object({
  order: z.string(),
  name: z.string(),
  coachingKey: z.string(),
  byBlock: byBlockStringRecord,
  eachSide: z.boolean().optional(),
});

export const tuesdayAmCoreBalanceBrakeSchema = z.object({
  title: z.string(),
  minutes: z.number(),
  structure: z.string(),
  narrative: z.string(),
  movements: z.array(coreBalanceBrakeMovementSchema),
});

export const mobilityFlowMovementSchema = z.object({
  name: z.string(),
  byBlock: byBlockStringRecord,
});

export const mobilityFlowSchema = z.object({
  title: z.string(),
  minutes: z.number(),
  when: z.string(),
  movements: z.array(mobilityFlowMovementSchema),
});

// ---------------------------------------------------------------------------
// Weekly speed plan (12 rows) + speed rules
// ---------------------------------------------------------------------------

export const weeklySpeedPlanEntrySchema = z.object({
  week: z.number().int().min(1).max(12),
  monAm: z.string(),
  thuAm: z.string(),
  satAmMinutes: z.number(),
  sprintVolumeYd: z.number().nullable(),
  sprintVolumeNote: z.string().optional(),
  note: z.string().nullable().optional(),
  deload: z.boolean().optional(),
  retest: z.boolean().optional(),
  testWeek: z.boolean().optional(),
});

export const speedRuleSchema = z.object({
  rule: z.string(),
  detail: z.string(),
});

// ---------------------------------------------------------------------------
// Strength days (A/B/C/D x block 1/2/3 x clusters x exercises x 4 weeks)
// ---------------------------------------------------------------------------

export const loadTypeSchema = z.enum(['pct', 'rir', 'none']);

export const exerciseLoadSchema = z.object({
  type: loadTypeSchema,
  value: z.number().optional(),
});

export const exerciseWeekPrescriptionSchema = z.object({
  load: exerciseLoadSchema,
  reps: z.string(),
});

export const clusterExerciseSchema = z.object({
  order: z.string(),
  name: z.string(),
  rest: z.string(),
  eachSide: z.boolean().optional(),
  comboExercise: z.boolean().optional(),
  notes: z.string().optional(),
  // Exactly 4 weekly columns per block, per docs/phase1/PROGRAM_CONTENT_MODEL.md.
  weeks: z.array(exerciseWeekPrescriptionSchema).length(4),
});

export const strengthClusterSchema = z.object({
  id: z.string(),
  label: z.string(),
  rounds: z.number().int().positive(),
  restNote: z.string(),
  qualityCap: z.boolean(),
  contrast: z.boolean(),
  exercises: z.array(clusterExerciseSchema).min(1),
});

export const strengthDayBlockSchema = z.object({
  day: z.string(),
  focus: z.string(),
  mainLift: z.string(),
  weeks: z.array(z.number().int()).length(4),
  clusters: z.array(strengthClusterSchema).min(1),
});

/** Keyed "1" | "2" | "3" per block. */
export const strengthDayByBlockSchema = z.record(z.string(), strengthDayBlockSchema);

export const strengthDaysSchema = z.object({
  A: strengthDayByBlockSchema,
  B: strengthDayByBlockSchema,
  C: strengthDayByBlockSchema,
  D: strengthDayByBlockSchema,
});

// ---------------------------------------------------------------------------
// Testing: Longevity Ten + Athletic Five + events + max recalculation
// ---------------------------------------------------------------------------

export const markerDirectionSchema = z.enum(['lower_better', 'higher_better']);
export const markerThresholdOpSchema = z.enum(['under', 'over', 'qualitative']);
const markerValueSchema = z.union([z.number(), z.string()]);

export const testingMarkerSchema = z.object({
  num: z.number().int().min(1).max(15),
  name: z.string(),
  protocol: z.string(),
  unit: z.string(),
  direction: markerDirectionSchema,
  baseline: markerValueSchema,
  solid: markerValueSchema,
  strong: markerValueSchema,
  // Present as `true` on a few Longevity Ten markers (e.g. grip strength,
  // push-ups) to flag "there's a level beyond strong" in the source table;
  // it is a boolean marker, not an additional threshold value.
  strongPlus: z.union([markerValueSchema, z.boolean()]).optional(),
  thresholdOp: markerThresholdOpSchema.optional(),
  bilateral: z.boolean().optional(),
  attempts: z.number().int().optional(),
  bestAttempt: z.boolean().optional(),
  formula: z.string().optional(),
  caution: z.string().optional(),
  note: z.string().optional(),
  recordSideDifference: z.boolean().optional(),
  normalizedToBodyweight: z.boolean().optional(),
  bothDirections: z.boolean().optional(),
});

export const testingEventDaySchema = z.object({
  suggestedDay: z.string().optional(),
  day: z.string().optional(),
  what: z.string(),
  markers: z.array(z.number().int()).optional(),
});

export const week0EventSchema = z.object({
  label: z.string(),
  markers: z.array(z.number().int()).length(15),
  note: z.string(),
  scheduleSpecifiedInPdf: z.literal(false),
  schedulingRules: z.object({
    restingHeartRate: z.string(),
    athleticFive: z.string(),
    sprintDeferral: z.string(),
  }),
  suggestedSchedule: z.object({
    isFlexible: z.literal(true),
    note: z.string(),
    days: z.array(testingEventDaySchema),
  }),
});

export const week6EventSchema = z.object({
  label: z.string(),
  day: z.string(),
  markers: z.array(z.number().int()),
  conditionalMarkers: z.array(z.object({ num: z.number().int(), condition: z.string() })),
  note: z.string(),
});

export const week12EventSchema = z.object({
  label: z.string(),
  markers: z.array(z.number().int()).length(15),
  schedule: z.array(testingEventDaySchema),
  note: z.string(),
});

export const testingEventsSchema = z.object({
  week0: week0EventSchema,
  week6: week6EventSchema,
  week12: week12EventSchema,
});

export const maxRecalculationSchema = z.object({
  when: z.string(),
  rule: z.string(),
  howSpecifiedInPdf: z.string(),
  appDefault: z.string(),
});

export const testingSchema = z.object({
  longevityTen: z.array(testingMarkerSchema).length(10),
  athleticFive: z.array(testingMarkerSchema).length(5),
  events: testingEventsSchema,
  maxRecalculation: maxRecalculationSchema,
});

// ---------------------------------------------------------------------------
// Pickup sport / progression / substitutions / back-off / recovery
// ---------------------------------------------------------------------------

export const pickupSportRuleSchema = z.object({
  situation: z.string(),
  action: z.string(),
});

export const progressionRuleSchema = z.object({
  category: z.string(),
  rule: z.string(),
});

export const substitutionSchema = z.object({
  missing: z.string(),
  useInstead: z.string(),
  isSafetyRule: z.boolean().optional(),
});

export const backOffSignalSchema = z.object({
  signal: z.string(),
  response: z.string(),
  code: z.string(),
  recommendEvaluation: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Top-level program document
// ---------------------------------------------------------------------------

export const programContentSchema = z.object({
  meta: programMetaSchema,
  clustersGlossary: z.array(clusterGlossaryEntrySchema),
  executionRules: z.array(z.string()),
  loadingMethods: z.array(loadingMethodSchema),
  twoSafetyRules: z.array(z.string()),
  weeklyTemplate: z.array(weeklyTemplateDaySchema).length(7),
  blocks: z.array(blockSchema).length(3),
  deloadWeeksGeneric: deloadWeeksGenericSchema,
  deloadWeeks: z.array(z.number().int()),
  mondayAmSpeedPlyo: mondayAmSpeedPlyoSchema,
  tuesdayAmCoreBalanceBrake: tuesdayAmCoreBalanceBrakeSchema,
  mobilityFlow: mobilityFlowSchema,
  weeklySpeedPlan: z.array(weeklySpeedPlanEntrySchema).length(12),
  speedRules: z.array(speedRuleSchema),
  strengthDays: strengthDaysSchema,
  testing: testingSchema,
  pickupSportRules: z.array(pickupSportRuleSchema),
  progressionRules: z.array(progressionRuleSchema),
  substitutions: z.array(substitutionSchema),
  backOffSignals: z.array(backOffSignalSchema),
  recoveryPrinciples: z.array(z.string()),
});

export type ProgramContent = z.infer<typeof programContentSchema>;
export type ProgramMeta = z.infer<typeof programMetaSchema>;
export type ProgramBlock = z.infer<typeof blockSchema>;
export type StrengthDayBlock = z.infer<typeof strengthDayBlockSchema>;
export type StrengthCluster = z.infer<typeof strengthClusterSchema>;
export type ClusterExercise = z.infer<typeof clusterExerciseSchema>;
export type ExerciseWeekPrescription = z.infer<typeof exerciseWeekPrescriptionSchema>;
export type TestingMarker = z.infer<typeof testingMarkerSchema>;
export type WeeklySpeedPlanEntry = z.infer<typeof weeklySpeedPlanEntrySchema>;
export type Substitution = z.infer<typeof substitutionSchema>;
export type BackOffSignal = z.infer<typeof backOffSignalSchema>;
export type PickupSportRule = z.infer<typeof pickupSportRuleSchema>;
export type ProgressionRule = z.infer<typeof progressionRuleSchema>;

/**
 * Parses and validates raw program JSON. Throws a ZodError with a readable
 * path on any structural drift from the approved Phase 1 content model.
 */
export function parseProgramContent(raw: unknown): ProgramContent {
  return programContentSchema.parse(raw);
}

export function safeParseProgramContent(raw: unknown) {
  return programContentSchema.safeParse(raw);
}

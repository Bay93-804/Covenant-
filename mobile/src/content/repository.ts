/**
 * Version-aware program-content repository/service.
 *
 * This is the *only* module the rest of the app should import program data
 * from. Screens must never hardcode workout content — they call these
 * accessors, which validate the raw JSON once (via Zod) and memoize the
 * result per program version slug.
 */
import {
  parseProgramContent,
  type ProgramBlock,
  type ProgramContent,
  type StrengthDayBlock,
  type WeeklySpeedPlanEntry,
} from './schema';
import {
  DEFAULT_PROGRAM_VERSION_SLUG,
  programSourcesBySlug,
  type ProgramVersionSlug,
} from './source';

const parsedCache = new Map<ProgramVersionSlug, ProgramContent>();

/** Returns the fully validated program content for a version slug (default: v1). */
export function getProgramContent(
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): ProgramContent {
  const cached = parsedCache.get(slug);
  if (cached) return cached;

  const raw = programSourcesBySlug[slug];
  const parsed = parseProgramContent(raw);
  parsedCache.set(slug, parsed);
  return parsed;
}

export function listAvailableProgramVersions(): ProgramVersionSlug[] {
  return Object.keys(programSourcesBySlug) as ProgramVersionSlug[];
}

export type StrengthDayLetter = 'A' | 'B' | 'C' | 'D';

/** Monday=0 .. Sunday=6, matching `program_days.day_of_week` in the DB schema. */
export type DayOfWeekIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeekContext {
  /** 0 = pre-program baseline testing window; 1-12 = in-program week. */
  weekNumber: number;
  block: ProgramBlock | null;
  /** Index of this week within its block's `weeks` array (0-3), or null for week 0. */
  inBlockIndex: number | null;
  isDeload: boolean;
  isRetest: boolean;
  isTaperAndTest: boolean;
}

/**
 * Resolves which block (and which of its 4 weekly columns) a given absolute
 * week number belongs to. Week 0 resolves to a baseline context with no
 * block, per docs/phase1/PROGRAM_CONTENT_MODEL.md.
 */
export function resolveWeekContext(
  weekNumber: number,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): WeekContext {
  if (weekNumber <= 0) {
    return {
      weekNumber: 0,
      block: null,
      inBlockIndex: null,
      isDeload: false,
      isRetest: false,
      isTaperAndTest: false,
    };
  }

  const content = getProgramContent(slug);
  const block = content.blocks.find((b) => b.weeks.includes(weekNumber)) ?? null;
  const inBlockIndex = block ? block.weeks.indexOf(weekNumber) : null;

  return {
    weekNumber,
    block,
    inBlockIndex,
    isDeload: block?.deloadWeek === weekNumber,
    isRetest: block?.retestWeek === weekNumber,
    isTaperAndTest: block?.taperAndTestWeek === weekNumber,
  };
}

/** The generic 7-day skeleton entry (Monday=0..Sunday=6) — labels only, not week-specific. */
export function getWeeklyTemplateDay(
  dayOfWeek: DayOfWeekIndex,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
) {
  const content = getProgramContent(slug);
  const entry = content.weeklyTemplate[dayOfWeek];
  if (!entry) {
    throw new Error(`No weeklyTemplate entry for day index ${dayOfWeek}`);
  }
  return entry;
}

/**
 * Resolves the concrete strength-day prescription (clusters + per-exercise
 * loads) for a given lift day and absolute week number, by locating the
 * correct block and selecting `weeks[inBlockIndex]` on every exercise.
 */
export function getStrengthDayForWeek(
  letter: StrengthDayLetter,
  weekNumber: number,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): { dayBlock: StrengthDayBlock; context: WeekContext } | null {
  const context = resolveWeekContext(weekNumber, slug);
  if (!context.block) return null;

  const content = getProgramContent(slug);
  const dayBlock = content.strengthDays[letter][String(context.block.id)];
  if (!dayBlock) return null;

  return { dayBlock, context };
}

export function getWeeklySpeedPlanForWeek(
  weekNumber: number,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): WeeklySpeedPlanEntry | null {
  const content = getProgramContent(slug);
  return content.weeklySpeedPlan.find((w) => w.week === weekNumber) ?? null;
}

export function getTestingEvent<K extends keyof ProgramContent['testing']['events']>(
  key: K,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): ProgramContent['testing']['events'][K] {
  return getProgramContent(slug).testing.events[key];
}

export function getAllTestingMarkers(slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG) {
  const content = getProgramContent(slug);
  return [...content.testing.longevityTen, ...content.testing.athleticFive].sort(
    (a, b) => a.num - b.num,
  );
}

export function getTestingMarker(
  markerNumber: number,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
) {
  return getAllTestingMarkers(slug).find((m) => m.num === markerNumber) ?? null;
}

export function listSubstitutions(slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG) {
  return getProgramContent(slug).substitutions;
}

export function listBackOffSignals(slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG) {
  return getProgramContent(slug).backOffSignals;
}

export function listPickupSportRules(slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG) {
  return getProgramContent(slug).pickupSportRules;
}

export function listProgressionRules(slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG) {
  return getProgramContent(slug).progressionRules;
}

export function listRecoveryPrinciples(slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG) {
  return getProgramContent(slug).recoveryPrinciples;
}

/** Day-of-week label + AM/PM session summary for the Today screen. */
export interface TodaySessionSummary {
  dayLabel: string;
  weekContext: WeekContext;
  am: { label: string; minutesLow: number | null; minutesHigh: number | null; isRestDay: boolean };
  pm: { label: string; minutesLow: number | null; minutesHigh: number | null; isRestDay: boolean };
  speedPlan: WeeklySpeedPlanEntry | null;
}

export function getTodaySessionSummary(
  weekNumber: number,
  dayOfWeek: DayOfWeekIndex,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): TodaySessionSummary {
  const template = getWeeklyTemplateDay(dayOfWeek, slug);
  const weekContext = resolveWeekContext(weekNumber, slug);
  const speedPlan = getWeeklySpeedPlanForWeek(weekNumber, slug);

  return {
    dayLabel: template.day,
    weekContext,
    am: {
      label: template.am.label,
      minutesLow: template.am.minutes?.[0] ?? null,
      minutesHigh: template.am.minutes?.[1] ?? null,
      isRestDay: !template.am.ref,
    },
    pm: {
      label: template.pm.label,
      minutesLow: template.pm.minutes?.[0] ?? null,
      minutesHigh: template.pm.minutes?.[1] ?? null,
      isRestDay: !template.pm.ref,
    },
    speedPlan,
  };
}

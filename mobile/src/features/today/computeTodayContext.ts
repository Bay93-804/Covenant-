import type { DayOfWeekIndex } from '../../content/repository';

export interface TodayContext {
  /** 0 = still in the pre-Week-1 baseline testing window. */
  weekNumber: number;
  dayOfWeek: DayOfWeekIndex;
  isBeforeProgramStart: boolean;
  isProgramComplete: boolean;
}

/**
 * Program start date is Week 1's Monday (see docs/phase1/EXTRACTION_AUDIT.md
 * #10 and the onboarding program-start-date screen, which enforces this).
 * Anything before it is the flexible Week 0 baseline-testing window.
 */
export function computeTodayContext(startDateIso: string, now: Date = new Date()): TodayContext {
  const start = new Date(`${startDateIso}T00:00:00`);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - start.getTime()) / 86_400_000);
  const jsDay = today.getDay(); // 0=Sun..6=Sat
  const dayOfWeek = ((jsDay + 6) % 7) as DayOfWeekIndex; // 0=Mon..6=Sun

  if (diffDays < 0) {
    return { weekNumber: 0, dayOfWeek, isBeforeProgramStart: true, isProgramComplete: false };
  }

  const weekNumber = Math.floor(diffDays / 7) + 1;
  return {
    weekNumber: Math.min(weekNumber, 12),
    dayOfWeek,
    isBeforeProgramStart: false,
    isProgramComplete: weekNumber > 12,
  };
}

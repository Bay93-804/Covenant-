import fs from 'node:fs';
import path from 'node:path';

import { parseProgramContent, safeParseProgramContent } from '../src/content/schema';
import { expandProgramContent, programVersionIdForSlug } from '../src/content/seed/expandProgram';
import {
  getStrengthDayForWeek,
  getTestingEvent,
  getTodaySessionSummary,
  resolveWeekContext,
} from '../src/content/repository';

const jsonPath = path.resolve(
  __dirname,
  '../../data/program/coach-conde-long-game-athletic-v1.json',
);

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

describe('program content JSON', () => {
  it('validates against the Zod schema with no issues', () => {
    const result = safeParseProgramContent(raw);
    expect(result.success).toBe(true);
  });

  it('preserves the full 12-week / 3-block / 4-strength-day structure', () => {
    const content = parseProgramContent(raw);
    expect(content.meta.durationWeeks).toBe(12);
    expect(content.blocks).toHaveLength(3);
    expect(Object.keys(content.strengthDays).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(content.weeklySpeedPlan).toHaveLength(12);
    expect(content.weeklyTemplate).toHaveLength(7);
  });

  it('preserves the Week 0 / Week 6 / Week 12 testing scope exactly (see EXTRACTION_AUDIT.md #2)', () => {
    const content = parseProgramContent(raw);
    expect(content.testing.events.week0.markers).toHaveLength(15);
    // Week 6 is intentionally a PARTIAL retest of exactly 6 markers — never 15.
    expect(content.testing.events.week6.markers).toEqual([1, 4, 5, 9, 12, 15]);
    expect(content.testing.events.week12.markers).toHaveLength(15);
  });

  it('preserves every safety back-off signal and its trigger code', () => {
    const content = parseProgramContent(raw);
    const codes = content.backOffSignals.map((s) => s.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'RHR_ELEVATED',
        'CALF_ACHILLES_WARNING',
        'SLEEP_UNDER_6H',
        'HAMSTRING_GRABBY',
        'JOINT_PAIN_MOVEMENT_CHANGE',
        'TWO_MISSED_WEEKS',
      ]),
    );
  });

  it('flags the "joint that hurts" substitution row as a safety rule, never a swap', () => {
    const content = parseProgramContent(raw);
    const jointRule = content.substitutions.find((s) => s.missing.toLowerCase().includes('joint'));
    expect(jointRule?.isSafetyRule).toBe(true);
  });

  it('preserves the two hard percentage/sprint safety rules', () => {
    const content = parseProgramContent(raw);
    expect(content.twoSafetyRules).toHaveLength(2);
  });
});

describe('program repository', () => {
  const content = parseProgramContent(raw);

  it('resolves week context to the right block, in-block index, and deload/retest flags', () => {
    const week1 = resolveWeekContext(1);
    expect(week1.block?.name).toBe('ABSORB');
    expect(week1.inBlockIndex).toBe(0);
    expect(week1.isDeload).toBe(false);

    const week4 = resolveWeekContext(4);
    expect(week4.isDeload).toBe(true);

    const week6 = resolveWeekContext(6);
    expect(week6.isRetest).toBe(true);

    const week12 = resolveWeekContext(12);
    expect(week12.isTaperAndTest).toBe(true);

    const week0 = resolveWeekContext(0);
    expect(week0.block).toBeNull();
  });

  it('resolves the correct strength-day prescription for a mid-block week', () => {
    const result = getStrengthDayForWeek('A', 7);
    expect(result).not.toBeNull();
    expect(result?.dayBlock.mainLift).toBe(content.strengthDays.A['2']?.mainLift);
    expect(result?.context.inBlockIndex).toBe(2); // week 7 is the 3rd week of block 2 (5,6,7,8)
  });

  it('builds a Monday Today summary with a real AM speed label and PM strength title', () => {
    const summary = getTodaySessionSummary(1, 0); // Monday, week 1
    expect(summary.am.isRestDay).toBe(false);
    expect(summary.pm.isRestDay).toBe(false);
    expect(summary.am.label).toContain('SPEED');
    expect(summary.pm.label).toContain('STRENGTH A');
  });

  it('marks Wednesday as a rest day with no PM session', () => {
    const summary = getTodaySessionSummary(1, 2); // Wednesday
    expect(summary.am.isRestDay).toBe(true);
    expect(summary.pm.isRestDay).toBe(true);
  });

  it('exposes the Week 6 partial retest event distinctly from Week 0/12', () => {
    const week6 = getTestingEvent('week6');
    expect(week6.markers).toHaveLength(6);
  });
});

describe('deterministic seed expansion', () => {
  const content = parseProgramContent(raw);
  const programVersionId = programVersionIdForSlug(content.meta.id);

  it('produces the same ids across repeated runs (idempotent import)', () => {
    const first = expandProgramContent(content, programVersionId);
    const second = expandProgramContent(content, programVersionId);
    expect(first.programVersion.id).toEqual(second.programVersion.id);
    expect(first.workoutExercises.map((w) => w.id)).toEqual(
      second.workoutExercises.map((w) => w.id),
    );
  });

  it('expands to 48 workout_templates (4 strength days × 3 blocks × 4 weeks)', () => {
    const expanded = expandProgramContent(content, programVersionId);
    expect(expanded.workoutTemplates).toHaveLength(48);
  });

  it('produces exactly one testing_marker_def per marker number 1-15', () => {
    const expanded = expandProgramContent(content, programVersionId);
    const numbers = expanded.testingMarkerDefs.map((m) => m.marker_number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });
});

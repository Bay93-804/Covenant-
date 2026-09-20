import { strengthWorkoutExerciseId, strengthWorkoutTemplateId } from '../src/content/contentIds';
import { expandProgramContent, programVersionIdForSlug } from '../src/content/seed/expandProgram';
import { getProgramContent, getStrengthDayForWeek } from '../src/content/repository';
import { DEFAULT_PROGRAM_VERSION_SLUG } from '../src/content/source';

describe('contentIds cross-check against expandProgram.ts', () => {
  it('derives the same workout_exercise ids the seed importer would write, for every strength day/week/exercise', () => {
    const programVersionId = programVersionIdForSlug(DEFAULT_PROGRAM_VERSION_SLUG);
    const expanded = expandProgramContent(getProgramContent(), programVersionId);
    const seededById = new Map(expanded.workoutExercises.map((e) => [e.id, e]));

    let checked = 0;
    for (const letter of ['A', 'B', 'C', 'D'] as const) {
      for (let week = 1; week <= 12; week++) {
        const resolved = getStrengthDayForWeek(letter, week);
        if (!resolved) continue;
        const templateId = strengthWorkoutTemplateId(letter, week);
        expect(expanded.workoutTemplates.some((t) => t.id === templateId)).toBe(true);

        for (const cluster of resolved.dayBlock.clusters) {
          for (const exercise of cluster.exercises) {
            const runtimeId = strengthWorkoutExerciseId(letter, week, exercise.order);
            expect(seededById.has(runtimeId)).toBe(true);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

/**
 * CLI: expands the validated program content into DB-row-shaped seed data
 * (see src/content/seed/expandProgram.ts) and prints row counts per table,
 * as a sanity check that the deterministic importer covers every rule
 * category without loss. Run: npm run seed:print
 */
import fs from 'node:fs';
import path from 'node:path';

import { parseProgramContent } from '../src/content/schema';
import { expandProgramContent, programVersionIdForSlug } from '../src/content/seed/expandProgram';

const jsonPath = path.resolve(
  __dirname,
  '../../data/program/coach-conde-long-game-athletic-v1.json',
);

function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const content = parseProgramContent(raw);
  const programVersionId = programVersionIdForSlug(content.meta.id);
  const expanded = expandProgramContent(content, programVersionId);

  console.log(`program_versions: 1 (id=${programVersionId})`);
  console.log(`program_weeks: ${expanded.weeks.length}`);
  console.log(`program_days: ${expanded.days.length}`);
  console.log(`exercise_templates: ${expanded.exerciseTemplates.length}`);
  console.log(`workout_templates: ${expanded.workoutTemplates.length}`);
  console.log(`workout_exercises: ${expanded.workoutExercises.length}`);
  console.log(`prescribed_sets: ${expanded.prescribedSets.length}`);
  console.log(`am_week_overlays: ${expanded.amWeekOverlays.length}`);
  console.log(`testing_marker_defs: ${expanded.testingMarkerDefs.length}`);
  console.log(`substitutions: ${expanded.substitutions.length}`);

  // Re-running the expansion must be perfectly deterministic (idempotent ids).
  const expandedAgain = expandProgramContent(content, programVersionId);
  const stable = JSON.stringify(expanded) === JSON.stringify(expandedAgain);
  console.log(`\nDeterministic re-expansion: ${stable ? '✅ stable' : '❌ NOT stable'}`);
  if (!stable) process.exit(1);
}

main();

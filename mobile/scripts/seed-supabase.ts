/**
 * CLI: seeds a real Supabase project's program-content tables from the
 * authoritative program JSON, using the deterministic expansion in
 * src/content/seed/expandProgram.ts.
 *
 * This is a trusted-environment script (your machine or CI), never part of
 * the mobile app bundle: it is the one place allowed to use
 * SUPABASE_SERVICE_ROLE_KEY (read from plain env, NOT an EXPO_PUBLIC_* var,
 * so it can never end up inlined into the client bundle).
 *
 * Safe to re-run: every id is deterministic (uuid v5, keyed off natural
 * keys), so this upserts rather than duplicating rows.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:supabase
 */
import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { parseProgramContent } from '../src/content/schema';
import { expandProgramContent, programVersionIdForSlug } from '../src/content/seed/expandProgram';
import type { Database } from '../src/lib/supabase/database.types';

const jsonPath = path.resolve(
  __dirname,
  '../../data/program/coach-conde-long-game-athletic-v1.json',
);

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. This script must be run with the ' +
        'service-role key from a trusted environment — it must never be shipped in the app.',
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const content = parseProgramContent(raw);
  const programVersionId = programVersionIdForSlug(content.meta.id);
  const expanded = expandProgramContent(content, programVersionId);

  console.log(
    `Seeding "${content.meta.title}" (${content.meta.edition}) as ${programVersionId}...`,
  );

  const { error: versionError } = await supabase
    .from('program_versions')
    .upsert(expanded.programVersion as never, { onConflict: 'id' });
  if (versionError) throw versionError;

  const steps: [string, unknown[]][] = [
    ['program_weeks', expanded.weeks],
    ['program_days', expanded.days],
    ['exercise_templates', expanded.exerciseTemplates],
    ['workout_templates', expanded.workoutTemplates],
    ['workout_exercises', expanded.workoutExercises],
    ['prescribed_sets', expanded.prescribedSets],
    ['am_week_overlays', expanded.amWeekOverlays],
    ['testing_marker_defs', expanded.testingMarkerDefs],
    ['substitutions', expanded.substitutions],
  ];

  for (const [table, rows] of steps) {
    if (rows.length === 0) continue;
    // Chunk to stay well under request size limits on the larger tables.
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from(table as never)
        .upsert(chunk as never, { onConflict: 'id' });
      if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);
    }
    console.log(`  ✓ ${table}: ${rows.length} rows`);
  }

  console.log('\n✅ Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

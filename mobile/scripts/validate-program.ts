/**
 * CLI: validates the authoritative Phase 1 program JSON
 * (data/program/coach-conde-long-game-athletic-v1.json) against the Zod
 * schema in src/content/schema.ts, and prints a structural summary.
 *
 * Run: npm run validate:program
 */
import fs from 'node:fs';
import path from 'node:path';

import { safeParseProgramContent } from '../src/content/schema';

const jsonPath = path.resolve(
  __dirname,
  '../../data/program/coach-conde-long-game-athletic-v1.json',
);

function main() {
  if (!fs.existsSync(jsonPath)) {
    console.error(`Program JSON not found at ${jsonPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const result = safeParseProgramContent(raw);

  if (!result.success) {
    console.error('❌ Program content failed validation:\n');
    for (const issue of result.error.issues) {
      console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
    }
    process.exit(1);
  }

  const content = result.data;
  console.log('✅ Program content is valid.\n');
  console.log(`Program: ${content.meta.title} (edition ${content.meta.edition})`);
  console.log(`Duration: ${content.meta.durationWeeks} weeks`);
  console.log(`Blocks: ${content.blocks.map((b) => b.name).join(', ')}`);
  console.log(`Strength day letters: ${Object.keys(content.strengthDays).join(', ')}`);
  console.log(
    `Testing markers: ${content.testing.longevityTen.length} Longevity Ten + ${content.testing.athleticFive.length} Athletic Five`,
  );
  console.log(`Week 0 markers: ${content.testing.events.week0.markers.length}`);
  console.log(`Week 6 markers (partial by design): ${content.testing.events.week6.markers.length}`);
  console.log(`Week 12 markers: ${content.testing.events.week12.markers.length}`);
  console.log(`Substitutions: ${content.substitutions.length}`);
  console.log(`Back-off safety signals: ${content.backOffSignals.length}`);
  console.log(`Weekly speed plan rows: ${content.weeklySpeedPlan.length}`);
}

main();

/**
 * The one place in the app that touches the raw JSON file path. Everything
 * else imports from `./repository`. Metro resolves this via the
 * `watchFolders` entry in metro.config.js, which watches the repository
 * root so this file can be required without copying or transforming it.
 */
import rawProgramContentV1 from '../../../data/program/coach-conde-long-game-athletic-v1.json';

export const PROGRAM_VERSION_V1_SLUG = 'coach-conde-long-game-athletic-edition-v1' as const;

export const programSourcesBySlug = {
  [PROGRAM_VERSION_V1_SLUG]: rawProgramContentV1,
} as const;

export type ProgramVersionSlug = keyof typeof programSourcesBySlug;

export const DEFAULT_PROGRAM_VERSION_SLUG: ProgramVersionSlug = PROGRAM_VERSION_V1_SLUG;

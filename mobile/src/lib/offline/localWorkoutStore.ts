/**
 * Offline-first local storage for all workout *instance* data (sessions,
 * sets, readiness entries, safety adjustments, sport sessions, journal
 * entries, exercise maxes, personal records, pause events).
 *
 * This is the single source of truth the UI reads from and writes to in
 * BOTH backends:
 *  - Demo mode: this is the only storage — there is no sync.
 *  - Supabase mode: writes land here first (instant, works offline,
 *    survives app restart), then `syncPendingWorkoutData` pushes any row
 *    still marked `_pendingSync` to Supabase. Every row's `id` is generated
 *    on-device at creation time (see `generateId`), so a push is a plain
 *    `upsert(...).on_conflict('id')` — retrying a failed push, or pushing
 *    the same row twice, can never create a duplicate or silently clobber
 *    a different row (see docs/phase1/DATABASE_SCHEMA.md's client_uuid
 *    idempotency principle, generalized here to every writable table by
 *    always generating `id` client-side rather than relying on the
 *    database default).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

type WithSyncMeta<T> = T & { _pendingSync?: boolean };

const NAMESPACE = 'coachconde.offline';

export const Collections = {
  sessions: 'sessions',
  sets: 'sets',
  readiness: 'readiness',
  safetyAdjustments: 'safety_adjustments',
  sportSessions: 'sport_sessions',
  journal: 'journal',
  exerciseMaxes: 'exercise_maxes',
  personalRecords: 'personal_records',
  pauseEvents: 'pause_events',
  testingSessions: 'testing_sessions',
  testingResults: 'testing_results',
} as const;
export type CollectionName = (typeof Collections)[keyof typeof Collections];

export function generateId(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

function storageKey(userId: string, collection: CollectionName): string {
  return `${NAMESPACE}:${collection}:${userId}`;
}

/**
 * Per-(user, collection) write lock. `upsert`/`markSynced` are read-modify-
 * write over the whole collection array, so two concurrent calls for the
 * same collection (e.g. `Promise.all` creating several safety_adjustments
 * from one readiness submission) can otherwise both read the pre-write
 * array and then each write back their own copy — the second write clobbers
 * the first, silently losing a row. Every mutation for a given key is
 * queued onto the same promise chain so they always run one at a time.
 */
const writeLocks = new Map<string, Promise<unknown>>();

function withWriteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // Swallow the result/rejection for chaining purposes only — callers still
  // get the real result/error via the returned `next` promise.
  writeLocks.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

async function readRaw<T extends { id: string }>(
  userId: string,
  collection: CollectionName,
): Promise<WithSyncMeta<T>[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId, collection));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WithSyncMeta<T>[];
  } catch {
    return [];
  }
}

async function writeRaw<T extends { id: string }>(
  userId: string,
  collection: CollectionName,
  rows: WithSyncMeta<T>[],
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId, collection), JSON.stringify(rows));
}

function stripMeta<T>(row: WithSyncMeta<T>): T {
  const { _pendingSync: _omit, ...rest } = row;
  return rest as T;
}

export async function listAll<T extends { id: string }>(
  userId: string,
  collection: CollectionName,
): Promise<T[]> {
  const rows = await readRaw<T>(userId, collection);
  return rows.map(stripMeta);
}

export async function findById<T extends { id: string }>(
  userId: string,
  collection: CollectionName,
  id: string,
): Promise<T | null> {
  const rows = await readRaw<T>(userId, collection);
  const found = rows.find((r) => r.id === id);
  return found ? stripMeta(found) : null;
}

export async function queryAll<T extends { id: string }>(
  userId: string,
  collection: CollectionName,
  predicate: (row: T) => boolean,
): Promise<T[]> {
  const rows = await listAll<T>(userId, collection);
  return rows.filter(predicate);
}

/**
 * Inserts or replaces a row by `id`. Marking `pendingSync` (the default)
 * queues it for a background push in Supabase mode; demo mode ignores the
 * flag entirely since there's nowhere to sync to.
 */
export function upsert<T extends { id: string }>(
  userId: string,
  collection: CollectionName,
  row: T,
  pendingSync = true,
): Promise<T> {
  return withWriteLock(storageKey(userId, collection), async () => {
    const rows = await readRaw<T>(userId, collection);
    const idx = rows.findIndex((r) => r.id === row.id);
    const withMeta: WithSyncMeta<T> = { ...row, _pendingSync: pendingSync };
    if (idx >= 0) rows[idx] = withMeta;
    else rows.push(withMeta);
    await writeRaw(userId, collection, rows);
    return row;
  });
}

export function markSynced(userId: string, collection: CollectionName, id: string): Promise<void> {
  return withWriteLock(storageKey(userId, collection), async () => {
    const rows = await readRaw(userId, collection);
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    row._pendingSync = false;
    await writeRaw(userId, collection, rows);
  });
}

export async function listPending<T extends { id: string }>(
  userId: string,
  collection: CollectionName,
): Promise<T[]> {
  const rows = await readRaw<T>(userId, collection);
  return rows.filter((r) => r._pendingSync).map(stripMeta);
}

export async function hasPending(userId: string, collection: CollectionName): Promise<boolean> {
  const rows = await readRaw(userId, collection);
  return rows.some((r) => r._pendingSync);
}

/**
 * Removes every locally-stored workout/testing collection for one user —
 * used by account deletion (src/lib/accountDeletion/) after the cloud
 * record is gone, so no trace of that athlete's data is left on the
 * device. Never used for anything short of that: normal sign-out leaves
 * this data in place so the same athlete signing back in on the same
 * device still has it offline.
 */
export async function clearAllForUser(userId: string): Promise<void> {
  const keys = Object.values(Collections).map((collection) =>
    storageKey(userId, collection as CollectionName),
  );
  await AsyncStorage.multiRemove(keys);
}

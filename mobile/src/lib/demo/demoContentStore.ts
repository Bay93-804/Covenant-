/**
 * Local "database" for demo-mode user data (profile, enrollment,
 * notification preferences, exercise maxes). Row shapes intentionally
 * mirror the Supabase table shapes (see src/lib/supabase/database.types.ts)
 * so screens can consume either backend through the same domain types —
 * see src/lib/onboarding/onboardingService.ts, which is the only place
 * that branches on backend.
 */
import * as Crypto from 'expo-crypto';

import { programVersionIdForSlug } from '../../content/seed/deterministicId';
import { DEFAULT_PROGRAM_VERSION_SLUG } from '../../content/source';
import { demoStorageKeys, readJson, writeJson } from './storage';

export interface DemoProfile {
  id: string;
  display_name: string | null;
  date_of_birth: string | null;
  units_weight: 'lb' | 'kg';
  units_distance: 'mi' | 'km';
  training_experience: 'new' | 'returning' | 'experienced' | null;
  equipment_available: string[];
  injury_notes: string | null;
  has_sprinted_recently: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface DemoEnrollment {
  id: string;
  user_id: string;
  program_version_id: string;
  start_date: string;
  status: 'active' | 'paused' | 'completed' | 'restarted' | 'abandoned';
  defer_week0_sprint_test: boolean;
  created_at: string;
}

export interface DemoNotificationPreferences {
  user_id: string;
  am_session_reminder_enabled: boolean;
  am_reminder_time: string;
  pm_session_reminder_enabled: boolean;
  pm_reminder_time: string;
  readiness_check_reminder_enabled: boolean;
  testing_reminder_enabled: boolean;
}

export interface DemoExerciseMax {
  lift_key: 'trap_bar_deadlift' | 'back_squat' | 'bench_press';
  estimated_1rm: number;
  weight_unit: 'lb' | 'kg';
  recorded_at: string;
}

export async function getDemoProfile(userId: string): Promise<DemoProfile | null> {
  return readJson<DemoProfile>(demoStorageKeys.profile(userId));
}

export async function upsertDemoProfile(
  userId: string,
  patch: Partial<Omit<DemoProfile, 'id' | 'created_at'>>,
): Promise<DemoProfile> {
  const existing = await getDemoProfile(userId);
  const now = new Date().toISOString();
  const next: DemoProfile = {
    id: userId,
    display_name: null,
    date_of_birth: null,
    units_weight: 'lb',
    units_distance: 'mi',
    training_experience: null,
    equipment_available: [],
    injury_notes: null,
    has_sprinted_recently: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    ...existing,
    ...patch,
  };
  await writeJson(demoStorageKeys.profile(userId), next);
  return next;
}

export async function getDemoEnrollment(userId: string): Promise<DemoEnrollment | null> {
  return readJson<DemoEnrollment>(demoStorageKeys.enrollment(userId));
}

export async function createDemoEnrollment(
  userId: string,
  input: { start_date: string; defer_week0_sprint_test: boolean },
): Promise<DemoEnrollment> {
  const enrollment: DemoEnrollment = {
    id: Crypto.randomUUID(),
    user_id: userId,
    program_version_id: programVersionIdForSlug(DEFAULT_PROGRAM_VERSION_SLUG),
    start_date: input.start_date,
    status: 'active',
    defer_week0_sprint_test: input.defer_week0_sprint_test,
    created_at: new Date().toISOString(),
  };
  await writeJson(demoStorageKeys.enrollment(userId), enrollment);
  return enrollment;
}

const defaultNotificationPreferences = (userId: string): DemoNotificationPreferences => ({
  user_id: userId,
  am_session_reminder_enabled: true,
  am_reminder_time: '06:30',
  pm_session_reminder_enabled: true,
  pm_reminder_time: '17:30',
  readiness_check_reminder_enabled: true,
  testing_reminder_enabled: true,
});

export async function getDemoNotificationPreferences(
  userId: string,
): Promise<DemoNotificationPreferences> {
  const existing = await readJson<DemoNotificationPreferences>(
    demoStorageKeys.notificationPreferences(userId),
  );
  return existing ?? defaultNotificationPreferences(userId);
}

export async function upsertDemoNotificationPreferences(
  userId: string,
  patch: Partial<Omit<DemoNotificationPreferences, 'user_id'>>,
): Promise<DemoNotificationPreferences> {
  const existing = await getDemoNotificationPreferences(userId);
  const next = { ...existing, ...patch };
  await writeJson(demoStorageKeys.notificationPreferences(userId), next);
  return next;
}

export async function getDemoExerciseMaxes(userId: string): Promise<DemoExerciseMax[]> {
  return (await readJson<DemoExerciseMax[]>(demoStorageKeys.exerciseMaxes(userId))) ?? [];
}

export async function addDemoExerciseMax(userId: string, entry: DemoExerciseMax): Promise<void> {
  const existing = await getDemoExerciseMaxes(userId);
  await writeJson(demoStorageKeys.exerciseMaxes(userId), [...existing, entry]);
}

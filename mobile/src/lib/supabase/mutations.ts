import { requireSupabase } from './client';
import { programVersionIdForSlug } from '../../content/seed/deterministicId';
import { DEFAULT_PROGRAM_VERSION_SLUG } from '../../content/source';
import type {
  NotificationPreferencesInsert,
  ProfileUpdate,
  ProgramEnrollmentInsert,
} from './database.types';

export async function upsertProfile(userId: string, patch: ProfileUpdate) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

/**
 * Ensures the current program version's content row exists (service-role
 * seeding should normally have already done this — see
 * scripts/seed-supabase.ts — but onboarding must not hard-fail if a fresh
 * project hasn't been seeded yet).
 */
export async function getOrCreateActiveProgramVersionId(): Promise<string> {
  const supabase = requireSupabase();
  const expectedId = programVersionIdForSlug(DEFAULT_PROGRAM_VERSION_SLUG);

  const { data, error } = await supabase
    .from('program_versions')
    .select('id')
    .eq('id', expectedId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;

  throw new Error(
    'Program content has not been seeded into Supabase yet. Run `npm run seed:supabase` with the service-role key before enrolling users.',
  );
}

export async function createProgramEnrollment(
  input: Omit<ProgramEnrollmentInsert, 'program_version_id'> & { program_version_id?: string },
) {
  const supabase = requireSupabase();
  const programVersionId = input.program_version_id ?? (await getOrCreateActiveProgramVersionId());

  const { data, error } = await supabase
    .from('program_enrollments')
    .insert({ ...input, program_version_id: programVersionId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertNotificationPreferences(input: NotificationPreferencesInsert) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(input, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function createExerciseMax(input: {
  user_id: string;
  lift_key: string;
  estimated_1rm: number;
  weight_unit: 'lb' | 'kg';
}) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('exercise_maxes').insert(input);
  if (error) throw error;
}

export async function getActiveEnrollment(userId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('program_enrollments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

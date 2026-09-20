/**
 * The single place onboarding submission branches on backend. Every screen
 * calls `completeOnboarding` — none of them know or care whether they're
 * running against Supabase or local demo mode.
 */
import type { OnboardingData } from '../../features/onboarding/schema';
import {
  addDemoExerciseMax,
  createDemoEnrollment,
  upsertDemoNotificationPreferences,
  upsertDemoProfile,
} from '../demo/demoContentStore';
import { isSupabaseConfigured } from '../env';
import {
  createExerciseMax,
  createProgramEnrollment,
  upsertNotificationPreferences,
  upsertProfile,
} from '../supabase/mutations';

export async function completeOnboarding(userId: string, data: OnboardingData): Promise<void> {
  if (isSupabaseConfigured) {
    await upsertProfile(userId, {
      display_name: data.displayName,
      date_of_birth: data.dateOfBirth || null,
      units_weight: data.unitsWeight,
      units_distance: data.unitsDistance,
    });

    await createProgramEnrollment({
      user_id: userId,
      start_date: data.week1StartDate,
    });

    await upsertNotificationPreferences({
      user_id: userId,
      am_session_reminder_enabled: data.notificationPreferences.amReminderEnabled,
      am_reminder_time: data.notificationPreferences.amReminderTime,
      pm_session_reminder_enabled: data.notificationPreferences.pmReminderEnabled,
      pm_reminder_time: data.notificationPreferences.pmReminderTime,
      readiness_check_reminder_enabled: data.notificationPreferences.readinessReminderEnabled,
      testing_reminder_enabled: data.notificationPreferences.testingReminderEnabled,
    });

    for (const max of data.estimatedMaxes) {
      if (!max.estimated1RM) continue;
      await createExerciseMax({
        user_id: userId,
        lift_key: max.liftKey,
        estimated_1rm: max.estimated1RM,
        weight_unit: data.unitsWeight,
      });
    }
    return;
  }

  await upsertDemoProfile(userId, {
    display_name: data.displayName,
    date_of_birth: data.dateOfBirth || null,
    units_weight: data.unitsWeight,
    units_distance: data.unitsDistance,
    training_experience: data.trainingExperience,
    equipment_available: data.equipmentAvailable,
    injury_notes: data.injuryNotes || null,
    has_sprinted_recently: data.hasSprintedRecently,
  });

  await createDemoEnrollment(userId, {
    start_date: data.week1StartDate,
    defer_week0_sprint_test: data.deferWeek0SprintTest,
  });

  await upsertDemoNotificationPreferences(userId, {
    am_session_reminder_enabled: data.notificationPreferences.amReminderEnabled,
    am_reminder_time: data.notificationPreferences.amReminderTime,
    pm_session_reminder_enabled: data.notificationPreferences.pmReminderEnabled,
    pm_reminder_time: data.notificationPreferences.pmReminderTime,
    readiness_check_reminder_enabled: data.notificationPreferences.readinessReminderEnabled,
    testing_reminder_enabled: data.notificationPreferences.testingReminderEnabled,
  });

  for (const max of data.estimatedMaxes) {
    if (!max.estimated1RM) continue;
    await addDemoExerciseMax(userId, {
      lift_key: max.liftKey,
      estimated_1rm: max.estimated1RM,
      weight_unit: data.unitsWeight,
      recorded_at: new Date().toISOString(),
    });
  }
}

export interface EnrollmentStatusResult {
  hasActiveEnrollment: boolean;
  startDate: string | null;
}

export async function getEnrollmentStatus(userId: string): Promise<EnrollmentStatusResult> {
  if (isSupabaseConfigured) {
    const { getActiveEnrollment } = await import('../supabase/mutations');
    const enrollment = await getActiveEnrollment(userId);
    return { hasActiveEnrollment: Boolean(enrollment), startDate: enrollment?.start_date ?? null };
  }

  const { getDemoEnrollment } = await import('../demo/demoContentStore');
  const enrollment = await getDemoEnrollment(userId);
  return {
    hasActiveEnrollment: Boolean(enrollment && enrollment.status === 'active'),
    startDate: enrollment?.start_date ?? null,
  };
}

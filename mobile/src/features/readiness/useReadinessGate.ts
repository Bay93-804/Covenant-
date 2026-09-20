/**
 * Wires the pure readiness-rules engine to the repository: fetches the
 * trailing window of readiness history the rules need (3 mornings for the
 * RHR rule, 72 hours for the calf/Achilles clearance rule), evaluates
 * today's check-in against it, and persists the entry + any triggered
 * safety_adjustments — always requiring explicit confirmation before an
 * adjustment is considered "applied" (see confirmSafetyAdjustment).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays } from '../schedule/dateUtils';
import {
  createReadinessEntry,
  createSafetyAdjustment,
  confirmSafetyAdjustment as confirmSafetyAdjustmentRepo,
  listReadinessHistory,
} from '../workout/workoutRepository';
import type { SafetyTriggerCode } from '../../lib/supabase/database.types';
import { evaluateReadiness, type ReadinessInput } from './readinessRules';
import { useAuth } from '../../lib/auth/AuthContext';

export interface SubmitReadinessInput {
  entryDate: string;
  sleepHours: number | null;
  restingHr: number | null;
  baselineRestingHr: number | null;
  calfAchillesFlag: boolean;
  hamstringGrabbyFlag: boolean;
  jointPainFlag: boolean;
  jointPainLocation?: string | null;
  readinessScore: number | null;
  notes?: string | null;
  workoutSessionId?: string | null;
}

const HISTORY_WINDOW_DAYS = 4; // today + 3 prior mornings covers both the RHR and 72h calf/Achilles rules

export function useReadinessHistory(entryDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['readiness-history', user?.id, entryDate],
    queryFn: () =>
      listReadinessHistory(
        user!.id,
        addDays(entryDate, -HISTORY_WINDOW_DAYS),
        addDays(entryDate, -1),
      ),
    enabled: Boolean(user),
  });
}

export function useSubmitReadiness() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitReadinessInput) => {
      const userId = user!.id;
      const history = await listReadinessHistory(
        userId,
        addDays(input.entryDate, -HISTORY_WINDOW_DAYS),
        addDays(input.entryDate, -1),
      );

      const evaluationInput: ReadinessInput = {
        entryDate: input.entryDate,
        sleepHours: input.sleepHours,
        restingHr: input.restingHr,
        baselineRestingHr: input.baselineRestingHr,
        calfAchillesFlag: input.calfAchillesFlag,
        hamstringGrabbyFlag: input.hamstringGrabbyFlag,
        jointPainFlag: input.jointPainFlag,
        jointPainLocation: input.jointPainLocation,
        readinessScore: input.readinessScore,
        notes: input.notes,
      };
      const evaluation = evaluateReadiness(
        evaluationInput,
        history.map((h) => ({
          entryDate: h.entry_date,
          restingHr: h.resting_hr,
          baselineRestingHr: h.baseline_resting_hr,
          calfAchillesFlag: h.calf_achilles_flag,
        })),
      );

      const entry = await createReadinessEntry({
        id: '',
        userId,
        workoutSessionId: input.workoutSessionId,
        entryDate: input.entryDate,
        sleepHours: input.sleepHours,
        restingHr: input.restingHr,
        baselineRestingHr: input.baselineRestingHr,
        calfAchillesFlag: input.calfAchillesFlag,
        hamstringGrabbyFlag: input.hamstringGrabbyFlag,
        jointPainFlag: input.jointPainFlag,
        jointPainLocation: input.jointPainLocation,
        readinessScore: input.readinessScore,
        notes: input.notes,
      });

      const safetyAdjustments = await Promise.all(
        evaluation.triggers.map((trigger) =>
          createSafetyAdjustment({
            id: '',
            userId,
            workoutSessionId: input.workoutSessionId,
            readinessEntryId: entry.id,
            triggerCode: trigger.code as SafetyTriggerCode,
            reason: trigger.reason,
            recommendedAdjustment: trigger.recommendation,
          }),
        ),
      );

      return { entry, evaluation, safetyAdjustments };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['readiness-history', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['today-sessions', user?.id] });
    },
  });
}

export function useConfirmSafetyAdjustment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (adjustmentId: string) => confirmSafetyAdjustmentRepo(user!.id, adjustmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-sessions', user?.id] });
    },
  });
}

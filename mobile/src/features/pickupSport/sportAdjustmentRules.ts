/**
 * Pickup-sport adjustment rules, verbatim from `data/program/*.json`'s
 * `pickupSportRules`. This module only *recommends* — every recommendation
 * is previewed and requires explicit user confirmation before the schedule
 * changes (see Phase 3 brief §9), matching the safety-adjustment pattern.
 */
import { isoWeekdayIndex, type IsoDate } from '../schedule/dateUtils';

export type SportAdjustmentCode =
  | 'REPLACE_THU_AGILITY'
  | 'REDUCE_MON_SPEED'
  | 'MOVE_STRENGTH_D'
  | 'BLOCK1_GATE_REQUIRED';

export interface SportAdjustmentRecommendation {
  code: SportAdjustmentCode;
  description: string;
  requiresUserChoice: boolean;
  choices?: { value: string; label: string }[];
}

export interface SportLogInput {
  playedOn: IsoDate;
  sport: string;
  /** Total competitive games this week, including this one. */
  gamesThisWeek: number;
  /** The athlete self-reports "I haven't played in months" — a qualitative PDF condition, not a numeric threshold. */
  returningAfterMonthsAway: boolean;
  hasCompletedBlock1: boolean;
}

export interface SportAdjustmentEvaluation {
  gateBlocked: boolean;
  gateReason: string | null;
  recommendations: SportAdjustmentRecommendation[];
  pregameWarmup: string;
  postGameNote: string;
}

export const PREGAME_WARMUP_DESCRIPTION =
  'Full RAMP warm-up plus build-ups: 2x30 yd at 70%, 2x30 at 85%, 2x20 yd at 90%, and five drop-and-sticks. Ten minutes.';

export const POST_GAME_NOTE =
  'Walk it out, hydrate, sleep. The next session drops one RIR column.';

const SATURDAY_INDEX = 5; // 0=Mon..6=Sun

export function evaluatePickupSportAdjustments(input: SportLogInput): SportAdjustmentEvaluation {
  if (input.returningAfterMonthsAway && !input.hasCompletedBlock1) {
    return {
      gateBlocked: true,
      gateReason:
        'Do not go back to a competitive game until you have finished Block 1. Four weeks of landings, hills and sled work first.',
      recommendations: [{ code: 'BLOCK1_GATE_REQUIRED', description: 'Finish Block 1 before competitive play.', requiresUserChoice: false }],
      pregameWarmup: PREGAME_WARMUP_DESCRIPTION,
      postGameNote: POST_GAME_NOTE,
    };
  }

  const recommendations: SportAdjustmentRecommendation[] = [];

  if (input.gamesThisWeek === 1) {
    recommendations.push({
      code: 'REPLACE_THU_AGILITY',
      description:
        'That game replaces the Thursday AM agility work. Everything else stays. Lift the day AFTER the game, not the day before.',
      requiresUserChoice: false,
    });
  } else if (input.gamesThisWeek >= 2) {
    recommendations.push({
      code: 'REDUCE_MON_SPEED',
      description:
        'Drop the Monday AM speed session to landings and build-ups only. The games supply your sprint exposure. Keep all four lifts.',
      requiresUserChoice: false,
    });
  }

  if (isoWeekdayIndex(input.playedOn) === SATURDAY_INDEX) {
    recommendations.push({
      code: 'MOVE_STRENGTH_D',
      description:
        'Move Strength D to Sunday or drop its Cluster C. Saturday AM becomes a warm-up, not a long run.',
      requiresUserChoice: true,
      choices: [
        { value: 'move_to_sunday', label: 'Move Strength D to Sunday' },
        { value: 'drop_cluster_c', label: 'Drop Cluster C from Strength D' },
      ],
    });
  }

  return {
    gateBlocked: false,
    gateReason: null,
    recommendations,
    pregameWarmup: PREGAME_WARMUP_DESCRIPTION,
    postGameNote: POST_GAME_NOTE,
  };
}

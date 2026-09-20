import { evaluatePickupSportAdjustments } from '../src/features/pickupSport/sportAdjustmentRules';

describe('evaluatePickupSportAdjustments', () => {
  it('gates competitive play behind finishing Block 1 for a long-absent player', () => {
    const result = evaluatePickupSportAdjustments({
      playedOn: '2026-02-03', // a Tuesday
      sport: 'basketball',
      gamesThisWeek: 1,
      returningAfterMonthsAway: true,
      hasCompletedBlock1: false,
    });
    expect(result.gateBlocked).toBe(true);
    expect(result.gateReason).toMatch(/finished Block 1/);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].code).toBe('BLOCK1_GATE_REQUIRED');
  });

  it('does not gate a long-absent player who has already completed Block 1', () => {
    const result = evaluatePickupSportAdjustments({
      playedOn: '2026-02-03',
      sport: 'basketball',
      gamesThisWeek: 1,
      returningAfterMonthsAway: true,
      hasCompletedBlock1: true,
    });
    expect(result.gateBlocked).toBe(false);
  });

  it('one weekly game replaces Thursday AM agility', () => {
    const result = evaluatePickupSportAdjustments({
      playedOn: '2026-02-03',
      sport: 'soccer',
      gamesThisWeek: 1,
      returningAfterMonthsAway: false,
      hasCompletedBlock1: true,
    });
    expect(result.recommendations.map((r) => r.code)).toEqual(['REPLACE_THU_AGILITY']);
  });

  it('two weekly games reduce Monday speed to landings and build-ups', () => {
    const result = evaluatePickupSportAdjustments({
      playedOn: '2026-02-03',
      sport: 'soccer',
      gamesThisWeek: 2,
      returningAfterMonthsAway: false,
      hasCompletedBlock1: true,
    });
    expect(result.recommendations.map((r) => r.code)).toEqual(['REDUCE_MON_SPEED']);
  });

  it('a Saturday game recommends moving Strength D or dropping Cluster C, and requires the user to choose', () => {
    const result = evaluatePickupSportAdjustments({
      playedOn: '2026-02-07', // a Saturday
      sport: 'flag football',
      gamesThisWeek: 1,
      returningAfterMonthsAway: false,
      hasCompletedBlock1: true,
    });
    const moveRule = result.recommendations.find((r) => r.code === 'MOVE_STRENGTH_D');
    expect(moveRule?.requiresUserChoice).toBe(true);
    expect(moveRule?.choices).toHaveLength(2);
  });

  it('always includes the pregame warm-up and post-game note', () => {
    const result = evaluatePickupSportAdjustments({
      playedOn: '2026-02-03',
      sport: 'tennis',
      gamesThisWeek: 1,
      returningAfterMonthsAway: false,
      hasCompletedBlock1: true,
    });
    expect(result.pregameWarmup).toMatch(/RAMP warm-up/);
    expect(result.postGameNote).toMatch(/drops one RIR column/);
  });

  it('can combine a Saturday game with the two-games-per-week reduction', () => {
    const result = evaluatePickupSportAdjustments({
      playedOn: '2026-02-07',
      sport: 'basketball',
      gamesThisWeek: 2,
      returningAfterMonthsAway: false,
      hasCompletedBlock1: true,
    });
    expect(result.recommendations.map((r) => r.code).sort()).toEqual(
      ['MOVE_STRENGTH_D', 'REDUCE_MON_SPEED'].sort(),
    );
  });
});

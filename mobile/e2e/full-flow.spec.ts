import { expect, test } from '@playwright/test';

import { expectExactlyFiveTabs, signUpAndOnboard, trackPageErrors } from './helpers';

/**
 * The complete Phase 4 mobile-web flow, driven end to end in demo mode (no
 * backend required): sign-up → onboarding → Week 0 testing (three RHR
 * mornings, marker entry with autosave/resume, sprint deferral, session
 * finalization) → program/workout completion → Progress dashboard →
 * exercise history → readiness history → Week 6 partial-retest
 * verification.
 *
 * Playwright's clock API (`page.clock`) fast-forwards the simulated "now"
 * so the schedule engine's `todayIso()` (which defaults to `new Date()`)
 * reaches Week 1 and Week 6 without the test actually waiting weeks —
 * every date the schedule engine computes is driven from the same faked
 * clock consistently. The clock is installed at a fixed, known Wednesday
 * (2026-01-07) before any onboarding step runs, so the recommended Week 1
 * Start Date default is deterministic across runs.
 */
test.describe('full Phase 4 flow', () => {
  test('sign-up through Week 6 partial-retest verification', async ({ page }) => {
    const errors = trackPageErrors(page);
    page.on('dialog', (dialog) => dialog.accept());

    await page.clock.install({ time: new Date('2026-01-07T09:00:00') });

    // --- sign-up / demo entry -> onboarding -------------------------------
    await signUpAndOnboard(page, { deferSprint: true });
    await expectExactlyFiveTabs(page);

    // --- Week 0 testing -----------------------------------------------------
    await page.getByRole('tab', { name: 'Testing' }).click();
    await page.getByRole('button', { name: /Week 0 Baseline, Available/ }).click();
    await expect(page).toHaveURL(/\/testing\/session\/week0/);

    // --- three RHR mornings ---------------------------------------------
    await page.getByText(/Log a morning reading/).click();
    await expect(page).toHaveURL(/\/testing\/rhr\/week0/);
    await expect(page.getByText('PROGRESS: 0 OF 3')).toBeVisible();

    for (const [date, bpm] of [
      ['2026-01-01', '58'],
      ['2026-01-02', '56'],
      ['2026-01-03', '60'],
    ] as const) {
      const dateField = page.getByRole('textbox', { name: 'Morning' });
      await dateField.fill(date);
      await page.getByLabel('Resting heart rate (bpm)').fill(bpm);
      await page.getByRole('button', { name: 'Save this morning' }).click();
      await expect(page.getByText(date)).toBeVisible();
    }
    await expect(page.getByText('Established baseline: 58 bpm')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/testing\/session\/week0/);
    await expect(page.getByText(/3 of 3 mornings logged/)).toBeVisible();

    // --- marker entry with autosave/resume -------------------------------
    // Marker #3 (grip strength): enter a value, navigate away, come back,
    // and confirm the value survived — this is the autosave/resume check.
    await page.getByText(/^#3 Grip strength/).click();
    await expect(page).toHaveURL(/\/testing\/marker\/3/);
    await page.getByLabel('Result (kg)').fill('47');
    await page.getByLabel('Result (kg)').blur();
    await expect(page.getByText('SELECTED RESULT')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/testing\/session\/week0/);
    await page.getByText(/^#3 Grip strength/).click();
    await expect(page).toHaveURL(/\/testing\/marker\/3/);
    await expect(page.getByLabel('Result (kg)')).toHaveValue('47');
    await page.getByRole('button', { name: 'Done with this marker' }).click();
    await expect(page).toHaveURL(/\/testing\/session\/week0/);

    // --- sprint deferral (marker #11) ------------------------------------
    await page.getByText(/^#11 10-yard sprint/).click();
    await expect(page).toHaveURL(/\/testing\/marker\/11/);
    await page.getByText(/haven't sprinted at or near full effort/).click();
    await page
      .getByLabel('Reason for deferring')
      .fill("Haven't sprinted at full effort since my twenties");
    await page.getByRole('button', { name: 'Confirm deferral to Week 6' }).click();
    await expect(page.getByText('Deferred', { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/testing\/session\/week0/);
    await expect(page.getByText('Sprint deferred')).toBeVisible();

    // --- the remaining markers, minimally filled ---------------------------
    const simpleMarkers: [number, string, string][] = [
      [2, 'Time (mm:ss)', '12:30'],
      [5, 'Result (score(0-10))', '8'],
      [6, 'Hold time', '90s'],
      [8, 'Result (reps)', '30'],
    ];
    for (const [num, label, value] of simpleMarkers) {
      await page.getByText(new RegExp(`^#${num} `)).click();
      await expect(page).toHaveURL(new RegExp(`/testing/marker/${num}`));
      await page.getByLabel(label).fill(value);
      await page.getByLabel(label).blur();
      await expect(page.getByText('SELECTED RESULT')).toBeVisible();
      await page.getByRole('button', { name: 'Done with this marker' }).click();
      await expect(page).toHaveURL(/\/testing\/session\/week0/);
    }

    // Marker #4 (bilateral, best-of-2 per side).
    await page.getByText(/^#4 /).click();
    await page.getByLabel('Attempt 1 (seconds)').nth(0).fill('15');
    await page.getByLabel('Attempt 1 (seconds)').nth(0).blur();
    await page.getByLabel('Attempt 1 (seconds)').nth(1).fill('18');
    await page.getByLabel('Attempt 1 (seconds)').nth(1).blur();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // Marker #7 (e1RM from a heavy-5 set).
    await page.getByText(/^#7 /).click();
    await page.getByLabel(/Heavy set of 5 weight/).fill('200');
    await page.getByLabel(/Heavy set of 5 weight/).blur();
    await expect(page.getByText(/Estimated 1RM: 230/)).toBeVisible();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // Marker #9 (bilateral, single value per side).
    await page.getByText(/^#9 /).click();
    await page.getByLabel('Left side (seconds)').fill('60');
    await page.getByLabel('Left side (seconds)').blur();
    await page.getByLabel('Right side (seconds)').fill('55');
    await page.getByLabel('Right side (seconds)').blur();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // Marker #10 (qualitative — pick the baseline phrase).
    await page.getByText(/^#10 /).click();
    await page.getByRole('radio', { name: /Within/ }).click();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // Marker #12 (broad jump, feet/inches attempts).
    await page.getByText(/^#12 /).click();
    await page.getByLabel('Attempt 1 — feet').fill('7');
    await page.getByLabel('inches').nth(0).fill('0');
    await page.getByLabel('inches').nth(0).blur();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // Marker #13 (CMJ — lock the arm-swing method, then an attempt).
    await page.getByText(/^#13 /).click();
    await page.getByRole('radio', { name: 'Hands on hips' }).click();
    await page.getByLabel('Attempt 1 (inches)').fill('20');
    await page.getByLabel('Attempt 1 (inches)').blur();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // Marker #14 (5-10-5, two directions).
    await page.getByText(/^#14 /).click();
    await page.getByLabel('Attempt 1 (seconds)').nth(0).fill('5.2');
    await page.getByLabel('Attempt 1 (seconds)').nth(0).blur();
    await page.getByLabel('Attempt 1 (seconds)').nth(1).fill('5.1');
    await page.getByLabel('Attempt 1 (seconds)').nth(1).blur();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // Marker #15 (deceleration deficit, two component times).
    await page.getByText(/^#15 /).click();
    await page.getByLabel(/Sprint-and-stop time/).fill('1.6');
    await page.getByLabel(/Sprint-and-stop time/).blur();
    await page.getByLabel(/Sprint-through time/).fill('0.9');
    await page.getByLabel(/Sprint-through time/).blur();
    await expect(page.getByText(/Deceleration deficit: 0.7s/)).toBeVisible();
    await page.getByRole('button', { name: 'Done with this marker' }).click();

    // --- testing-session finalization -------------------------------------
    await expect(page.getByRole('button', { name: 'Finalize testing session' })).toBeEnabled();
    await page.getByRole('button', { name: 'Finalize testing session' }).click();
    await expect(page.getByText('Finalize this testing session?')).toBeVisible();
    await page.getByRole('button', { name: 'Finalize', exact: true }).click();
    await expect(page.getByText(/This session was finalized on/)).toBeVisible({ timeout: 20_000 });

    // --- program/workout completion (fast-forward to Week 1 Monday) --------
    await page.clock.setFixedTime(new Date('2026-01-19T08:00:00'));
    await page.reload();
    await expectExactlyFiveTabs(page);
    await page.getByRole('tab', { name: 'Today' }).click();
    await expect(page.getByText('Monday', { exact: true })).toBeVisible();

    // The Monday AM session (Speed & Plyo) requires a readiness check first.
    await page.getByText('Readiness check').first().click();
    await expect(page).toHaveURL(/\/today\/readiness-check/);
    await page.getByLabel(/Sleep last night/).fill('8');
    await page.getByLabel(/this morning/).fill('55');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.waitForURL('**/today', { timeout: 20_000 });
    await page.getByText('Start session').first().click();
    await expect(page).toHaveURL(/\/workout\//);
    await page.getByRole('button', { name: /Start session|Resume session/ }).click();
    await expect(page).toHaveURL(/\/player/);
    await page.getByRole('button', { name: 'Complete workout' }).click();
    await expect(page).toHaveURL(/\/summary/, { timeout: 20_000 });
    await expect(page.getByText('WORKOUT COMPLETE')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Today' }).click();
    await page.waitForURL('**/today', { timeout: 20_000 });

    // --- Progress dashboard --------------------------------------------
    await page.getByRole('tab', { name: 'Progress' }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByText('PROGRAM PROGRESS')).toBeVisible();
    await expect(page.getByText('Week 1 · ABSORB', { exact: true })).toBeVisible();

    // --- exercise history -------------------------------------------------
    await expect(page.getByText('EXERCISE PROGRESS')).toBeVisible();

    // --- readiness history -------------------------------------------------
    await page.getByText('Full readiness history').click();
    await expect(page).toHaveURL(/\/progress\/readiness-history/);
    await expect(page.getByText(/READINESS CHECK-INS/)).toBeVisible();
    await page.goBack();

    // --- Week 6 partial-retest verification --------------------------------
    await page.clock.setFixedTime(new Date('2026-02-25T08:00:00')); // Week 6's Wednesday
    await page.reload();
    await expectExactlyFiveTabs(page);
    await page.getByRole('tab', { name: 'Testing' }).click();
    // Exactly the 6 PDF-specified markers, plus the deferred sprint (#11) — never a full 15.
    await expect(page.getByText(/of 7 markers/).first()).toBeVisible();
    await page.getByRole('button', { name: /Week 6 Mid-Program Retest/ }).click();
    await expect(page).toHaveURL(/\/testing\/session\/week6/);
    const week6MarkerNumbers = [1, 4, 5, 9, 11, 12, 15];
    for (const num of week6MarkerNumbers) {
      await expect(page.getByText(new RegExp(`^#${num} `)).first()).toBeVisible();
    }
    // Never presented as a full 15-marker retest.
    await expect(page.getByText(/^#2 /)).toHaveCount(0);
    await expect(page.getByText(/^#7 /)).toHaveCount(0);

    expect(errors.pageErrors, 'page errors across the full flow').toEqual([]);
    expect(errors.consoleErrors, 'console errors across the full flow').toEqual([]);
  });
});

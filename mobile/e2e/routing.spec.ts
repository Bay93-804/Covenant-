import { expect, test } from '@playwright/test';

import { expectExactlyFiveTabs, signUpAndOnboard, trackPageErrors } from './helpers';

/**
 * Regression coverage for the Expo Router tab-explosion bug found while
 * building Phase 4: every route file directly under `(tabs)/<tab>/` without
 * a nested `_layout.tsx` gets auto-promoted into its own top-level tab
 * instead of staying nested inside that tab's Stack (see
 * app/(tabs)/today/_layout.tsx). This file asserts the fix holds across
 * every nested screen Phase 3 and Phase 4 added.
 */
test.describe('routing', () => {
  test('exactly five top-level tabs exist, with zero console/page errors, after onboarding', async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    await signUpAndOnboard(page);
    await expectExactlyFiveTabs(page);
    expect(errors.pageErrors, 'page errors during onboarding').toEqual([]);
    expect(errors.consoleErrors, 'console errors during onboarding').toEqual([]);
  });

  test('nested Testing screens stay nested in the Testing tab stack, never becoming new tabs', async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    await signUpAndOnboard(page);

    await page.getByRole('tab', { name: 'Testing' }).click();
    await expect(page).toHaveURL(/\/testing$/);
    await expectExactlyFiveTabs(page);

    // Testing hub -> Week 0 session screen (nested nav, not a new tab).
    await page.getByRole('button', { name: /Week 0 Baseline, Available/ }).click();
    await expect(page).toHaveURL(/\/testing\/session\/week0/);
    await expectExactlyFiveTabs(page);

    // Session screen -> an individual marker screen (two levels deep).
    await page.getByText(/#3 Grip strength/).click();
    await expect(page).toHaveURL(/\/testing\/marker\/3/);
    await expectExactlyFiveTabs(page);

    // Back navigation returns to the session screen, then the hub — never a tab switch.
    await page.goBack();
    await expect(page).toHaveURL(/\/testing\/session\/week0/);
    await expectExactlyFiveTabs(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/testing$/);
    await expectExactlyFiveTabs(page);

    expect(errors.pageErrors, 'page errors navigating Testing').toEqual([]);
    expect(errors.consoleErrors, 'console errors navigating Testing').toEqual([]);
  });

  test('the testing comparison and marker-history screens are reachable and stay nested', async ({
    page,
  }) => {
    await signUpAndOnboard(page);
    await page.getByRole('tab', { name: 'Testing' }).click();

    await page.getByText('View Week 0 · 6 · 12 comparison').click();
    await expect(page).toHaveURL(/\/testing\/compare/);
    await expectExactlyFiveTabs(page);
    await expect(page.getByText('Week 0 · 6 · 12', { exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/testing$/);
    await expectExactlyFiveTabs(page);
  });

  test('Progress tab history/detail screens stay nested (exercise history, readiness history)', async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    await page.getByRole('tab', { name: 'Progress' }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expectExactlyFiveTabs(page);

    await page.getByText('Full readiness history').click();
    await expect(page).toHaveURL(/\/progress\/readiness-history/);
    await expectExactlyFiveTabs(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/progress$/);
    await expectExactlyFiveTabs(page);
  });

  test('pre-existing Phase 3 nested routes (Today, Program) still work and stay nested', async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    // Program tab -> sport-adjustment (a Phase 3 nested route).
    await page.getByRole('tab', { name: 'Program' }).click();
    await expect(page).toHaveURL(/\/program$/);
    await expectExactlyFiveTabs(page);

    await page.goto('/program/sport-adjustment');
    await expect(page).toHaveURL(/\/program\/sport-adjustment/);
    await expectExactlyFiveTabs(page);
    await page.goBack();
    await expectExactlyFiveTabs(page);
  });

  test('direct/deep links to nested routes render correctly inside their tab', async ({ page }) => {
    await signUpAndOnboard(page);

    // Deep-link directly to a nested Testing route without clicking through the hub first.
    await page.goto('/testing/compare');
    await expect(page).toHaveURL(/\/testing\/compare/);
    await expectExactlyFiveTabs(page);
    await expect(page.getByText('Week 0 · 6 · 12', { exact: true })).toBeVisible();

    // Deep-link to a nested Progress route.
    await page.goto('/progress/readiness-history');
    await expect(page).toHaveURL(/\/progress\/readiness-history/);
    await expectExactlyFiveTabs(page);
    await expect(page.getByText('Readiness history')).toBeVisible();

    // Deep-link back to a top-level tab still resolves cleanly.
    await page.goto('/today');
    await expect(page).toHaveURL(/\/today$/);
    await expectExactlyFiveTabs(page);
  });
});

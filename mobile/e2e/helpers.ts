import type { Page } from '@playwright/test';

export const TAB_LABELS = ['Today', 'Program', 'Progress', 'Testing', 'Profile'] as const;

/** Collects every page error and console error for the lifetime of a page, for assertion at the end of a test. */
export function trackPageErrors(page: Page): { pageErrors: string[]; consoleErrors: string[] } {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

export interface OnboardingOptions {
  deferSprint?: boolean;
}

/**
 * Drives a fresh demo-mode sign-up through every onboarding step, accepting
 * the recommended Week 1 Start Date default, and lands on the Today tab.
 * Returns the email used, in case a test wants to sign back in later.
 */
export async function signUpAndOnboard(
  page: Page,
  options: OnboardingOptions = {},
): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto('/sign-up');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirm password').fill('Password123!');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await page.getByRole('button', { name: 'Get Started' }).click();

  // profile-setup
  await page.getByLabel('Name', { exact: true }).fill('Test Athlete');
  await page.getByRole('radio', { name: 'Pounds (lb)' }).click();
  await page.getByRole('radio', { name: 'Miles' }).click();
  await page.getByRole('radio', { name: 'Returning after a break' }).click();
  await page.getByRole('checkbox', { name: 'Bodyweight only' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // medical-clearance
  await page.getByRole('checkbox', { name: /medically cleared/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // program-start-date — accept the recommended default.
  await page.getByRole('button', { name: 'Continue' }).click();

  // week0-testing-intro
  const sprintOption = options.deferSprint ? /not since I was younger/ : /^Yes$/;
  await page.getByRole('radio', { name: sprintOption }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // starting-maxes — skip.
  await page.getByRole('button', { name: 'Continue' }).click();

  // notification-setup — finish.
  await page.getByRole('button', { name: 'Finish Setup' }).click();

  await page.waitForURL('**/today', { timeout: 20_000 });
  return email;
}

/**
 * Asserts the bottom tab bar (`role="tab"` under `role="tablist"`, per
 * React Navigation's web output) shows exactly the five declared tabs —
 * Today/Program/Progress/Testing/Profile — and nothing else. This is the
 * regression guard for the Expo Router pitfall this phase hit: a nested
 * route file with no `_layout.tsx` of its own gets auto-promoted into an
 * extra sibling tab instead of staying nested inside its tab's stack (see
 * app/(tabs)/today/_layout.tsx's header comment).
 */
export async function expectExactlyFiveTabs(page: Page): Promise<void> {
  const tabElements = await page.locator('[role="tab"]').all();
  if (tabElements.length !== TAB_LABELS.length) {
    const texts = await Promise.all(tabElements.map((t) => t.textContent()));
    throw new Error(
      `Expected exactly ${TAB_LABELS.length} tabs, found ${tabElements.length}: ${JSON.stringify(texts)}`,
    );
  }
  for (const label of TAB_LABELS) {
    const count = await page.getByRole('tab', { name: label }).count();
    if (count !== 1) {
      throw new Error(`Expected exactly one "${label}" tab, found ${count}`);
    }
  }
}

import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 4 end-to-end coverage: a full mobile-web flow through demo mode
 * (no backend required — see mobile/README.md's Local demo mode). Runs
 * against the Expo web dev server in a mobile viewport (iPhone 13), since
 * the app's real targets are Expo Go on iOS/Android and this is the closest
 * approximation Playwright can drive directly (see mobile/README.md's Known
 * limitations — the same caveat Phase 3 already documents for its own
 * Playwright verification).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:8090',
    trace: 'retain-on-failure',
    // Chromium only — this environment ships Chromium, not WebKit/Firefox
    // (see the pre-installed browser note in the session's environment
    // docs), so a Chromium-based mobile device profile is used instead of
    // an iOS one to exercise a real mobile viewport without requiring an
    // unavailable browser binary.
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'npx expo start --web --port 8090',
    url: 'http://127.0.0.1:8090',
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

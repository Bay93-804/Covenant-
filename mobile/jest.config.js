/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  // e2e/ holds Playwright specs (run via `npx playwright test`), never Jest — see playwright.config.ts.
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '<rootDir>/e2e/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};

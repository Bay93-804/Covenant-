const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      'dist/*',
      'dist-web/*',
      'dist-ios/*',
      'dist-android/*',
      '.expo/*',
      'android/*',
      'ios/*',
      'supabase/migrations/*',
      // Deno Edge Function — a separate runtime with its own module
      // resolution (jsr:/npm: specifiers), not part of this TS project.
      'supabase/functions/*',
      'node_modules/*',
      'coverage/*',
    ],
  },
  {
    rules: {
      // Deliberate `console.warn`/`console.error` usage in env/error-boundary
      // style code (see src/lib/env.ts) — not a lint violation here.
      'no-console': 'off',
    },
  },
]);

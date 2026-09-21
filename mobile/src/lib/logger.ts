/**
 * Release-safe logging.
 *
 * In development this is a thin pass-through to `console`, so nothing about
 * debugging changes locally. In a release build (`__DEV__ === false`) info
 * and warn are silenced entirely — nothing an athlete's device logs is
 * ever collected, transmitted, or visible outside the device's own system
 * console, so keeping non-error logs out of release builds avoids paying
 * for that even in principle. `error` still logs in release builds (visible
 * only via a locally-attached debugger/device console, never transmitted
 * anywhere) since a released app crashing silently is worse than one that
 * logs the fact locally.
 *
 * Every call site is responsible for never passing raw tokens, passwords,
 * or full Supabase error payloads that might embed a service response
 * body — pass `error.message`, not `error`, when the error could carry a
 * response body wider than we want in a device console.
 */
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

function fmt(scope: string, message: string): string {
  return `[${scope}] ${message}`;
}

export const logger = {
  info(scope: string, message: string, ...args: unknown[]): void {
    if (!isDev) return;
    console.log(fmt(scope, message), ...args);
  },
  warn(scope: string, message: string, ...args: unknown[]): void {
    if (!isDev) return;
    console.warn(fmt(scope, message), ...args);
  },
  error(scope: string, message: string, ...args: unknown[]): void {
    console.error(fmt(scope, message), ...args);
  },
};

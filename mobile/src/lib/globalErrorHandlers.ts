/**
 * Global, app-wide handlers for the two error classes React's component
 * tree can't catch on its own:
 *
 *  - Uncaught JS exceptions outside of render (event handlers, timers,
 *    non-awaited callbacks) — via React Native's `ErrorUtils` global.
 *  - Unhandled promise rejections (an `async` call whose rejection nobody
 *    `.catch()`ed) — via the global `unhandledrejection` event, which
 *    `react-native`'s Promise polyfill (and the Hermes engine) dispatch the
 *    same way a browser does.
 *
 * Both only *log* (locally — see src/lib/logger.ts) and, for fatal JS
 * errors, still hand off to React Native's own previous/default handler so
 * release-build crash behavior (and any crash-reporting tool wired up in a
 * future phase) is unchanged. Call `installGlobalErrorHandlers()` exactly
 * once, as early as possible — see app/_layout.tsx.
 */
import { logger } from './logger';

let installed = false;

export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  const globalAny = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
    addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  };

  if (globalAny.ErrorUtils) {
    const previousHandler = globalAny.ErrorUtils.getGlobalHandler();
    globalAny.ErrorUtils.setGlobalHandler((error, isFatal) => {
      logger.error('app', `Uncaught ${isFatal ? 'fatal' : 'non-fatal'} error`, error);
      previousHandler(error, isFatal);
    });
  }

  if (typeof globalAny.addEventListener === 'function') {
    globalAny.addEventListener('unhandledrejection', (event: unknown) => {
      const reason = (event as { reason?: unknown } | undefined)?.reason;
      logger.error('app', 'Unhandled promise rejection', reason);
    });
  }
}

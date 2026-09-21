/**
 * Deep-link URL parsing for the password-reset flow. Supabase attaches the
 * recovery session as either a query string or a URL fragment depending on
 * the flow — parseAuthParams must handle both, and handleIncomingUrl (via
 * useAuthDeepLink) must never throw on a link that has neither.
 */
import { parseAuthParams, passwordResetRedirectUrl } from '../src/lib/auth/authDeepLink';

// Hoisted above the import above by babel-plugin-jest-hoist, so
// authDeepLink picks up these mocks regardless of source order.
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `coachconde://${path}`),
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('../src/lib/supabase/client', () => ({ supabase: null }));

describe('parseAuthParams', () => {
  it('parses tokens from a query string', () => {
    const params = parseAuthParams(
      'coachconde://reset-password?access_token=abc&refresh_token=def&type=recovery',
    );
    expect(params?.get('access_token')).toBe('abc');
    expect(params?.get('refresh_token')).toBe('def');
    expect(params?.get('type')).toBe('recovery');
  });

  it('parses tokens from a URL fragment', () => {
    const params = parseAuthParams(
      'coachconde://reset-password#access_token=abc&refresh_token=def&type=recovery',
    );
    expect(params?.get('access_token')).toBe('abc');
    expect(params?.get('refresh_token')).toBe('def');
  });

  it('merges query and fragment when both are present', () => {
    const params = parseAuthParams('coachconde://reset-password?type=recovery#access_token=abc');
    expect(params?.get('type')).toBe('recovery');
    expect(params?.get('access_token')).toBe('abc');
  });

  it('returns null for a plain link with no params', () => {
    expect(parseAuthParams('coachconde://reset-password')).toBeNull();
  });

  it('surfaces an error_description param so callers can detect a failed link', () => {
    const params = parseAuthParams('coachconde://reset-password?error_description=Link+expired');
    expect(params?.get('error_description')).toBe('Link expired');
  });
});

describe('passwordResetRedirectUrl', () => {
  it('builds a coachconde:// deep link to the reset-password screen', () => {
    expect(passwordResetRedirectUrl()).toBe('coachconde://reset-password');
  });
});

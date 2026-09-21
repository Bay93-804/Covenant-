/* eslint-disable @typescript-eslint/no-require-imports -- mid-test require() reaches the jest.mock'd AsyncStorage module directly to assert on its raw (encrypted) contents */
import { secureSessionStorage } from '../src/lib/supabase/secureSessionStorage';

describe('secureSessionStorage', () => {
  it('round-trips a value through encrypted AsyncStorage', async () => {
    const key = 'sb-test-auth-token';
    const value = JSON.stringify({ access_token: 'a.b.c', refresh_token: 'r.s.t' });

    await secureSessionStorage.setItem(key, value);
    const readBack = await secureSessionStorage.getItem(key);

    expect(readBack).toBe(value);
  });

  it('never stores the plaintext value in AsyncStorage', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const key = 'sb-test-plaintext-check';
    const value = 'super-secret-refresh-token';

    await secureSessionStorage.setItem(key, value);
    const rawStored = await AsyncStorage.getItem(key);

    expect(rawStored).not.toBeNull();
    expect(rawStored).not.toBe(value);
    expect(rawStored).not.toContain(value);
  });

  it('returns null for a missing key', async () => {
    const result = await secureSessionStorage.getItem('sb-does-not-exist');
    expect(result).toBeNull();
  });

  it('removeItem clears the stored value', async () => {
    const key = 'sb-test-remove';
    await secureSessionStorage.setItem(key, 'value');
    await secureSessionStorage.removeItem(key);
    const result = await secureSessionStorage.getItem(key);
    expect(result).toBeNull();
  });
});

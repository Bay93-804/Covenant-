/**
 * Encrypted session storage for the Supabase auth client.
 *
 * A Supabase session (access + refresh JWT, several hundred bytes to a few
 * KB) is too large to store directly in `expo-secure-store` reliably across
 * devices/OS versions (iOS Keychain item sizes are not guaranteed past a
 * few KB in practice) — that's why `src/lib/supabase/client.ts` originally
 * used plain `AsyncStorage`, per Supabase's own baseline React Native
 * guidance. But AsyncStorage is unencrypted on-device storage: on a lost or
 * compromised device, anyone with file-system access could read a raw
 * session token straight out of it.
 *
 * This closes that gap using Supabase's own documented pattern ("Storing
 * data in Expo Secure Store" — supabase.com/docs/guides/auth/sessions,
 * building-a-user-management-app/expo quickstart): generate a random AES
 * key, keep *that* key (tiny — safely within SecureStore's size headroom)
 * in `expo-secure-store`, and use it to encrypt/decrypt the session blob
 * before it ever touches AsyncStorage. AsyncStorage still holds the data
 * (so it keeps working across app restarts and isn't capped by Keychain
 * size limits), but what it holds is ciphertext, not a usable token.
 *
 * Web has no SecureStore implementation (see src/lib/demo/storage.ts's
 * same caveat) — encryption is skipped there and this falls back to plain
 * AsyncStorage, matching the browser's own security model (there is no
 * OS-level keychain to protect a key with in the first place).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ENCRYPTION_KEY_STORAGE_KEY = 'coachconde.supabase.session-key';
const isSecureStoreAvailable = Platform.OS !== 'web';

async function getOrCreateEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
  if (existing) return existing;

  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const key = aesjs.utils.hex.fromBytes(Array.from(randomBytes));
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, key);
  return key;
}

function encrypt(key: string, value: string): string {
  const keyBytes = aesjs.utils.hex.toBytes(key);
  // A fresh counter per encryption (derived from random bytes, prepended to
  // the ciphertext) — CTR mode is only safe when the counter never repeats
  // for a given key, and this key is long-lived across many session writes.
  const counterBytes = Crypto.getRandomBytes(16);
  const aesCtr = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(counterBytes));
  const valueBytes = aesjs.utils.utf8.toBytes(value);
  const encryptedBytes = aesCtr.encrypt(valueBytes);
  return `${aesjs.utils.hex.fromBytes(Array.from(counterBytes))}:${aesjs.utils.hex.fromBytes(encryptedBytes)}`;
}

function decrypt(key: string, stored: string): string | null {
  const [counterHex, cipherHex] = stored.split(':');
  if (!counterHex || !cipherHex) return null;
  try {
    const keyBytes = aesjs.utils.hex.toBytes(key);
    const counterBytes = aesjs.utils.hex.toBytes(counterHex);
    const aesCtr = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(counterBytes));
    const decryptedBytes = aesCtr.decrypt(aesjs.utils.hex.toBytes(cipherHex));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  } catch {
    return null;
  }
}

/**
 * Implements the storage interface `@supabase/supabase-js`'s
 * `auth.storage` option expects (`getItem`/`setItem`/`removeItem`, each
 * returning a Promise) — passed directly as the client's session storage in
 * src/lib/supabase/client.ts.
 */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isSecureStoreAvailable) {
      return AsyncStorage.getItem(key);
    }
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    const encryptionKey = await getOrCreateEncryptionKey();
    return decrypt(encryptionKey, stored);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isSecureStoreAvailable) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    const encryptionKey = await getOrCreateEncryptionKey();
    await AsyncStorage.setItem(key, encrypt(encryptionKey, value));
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

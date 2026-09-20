/**
 * Local demo-mode storage primitives.
 *
 * This file — and everything else under src/lib/demo/ — is completely
 * isolated from src/lib/supabase/. Nothing here ever imports the Supabase
 * client, and nothing in src/lib/supabase/ imports this. The two are wired
 * together only by src/lib/auth/AuthContext.tsx, which picks one provider
 * at startup based on `isSupabaseConfigured` and never mixes them.
 *
 * Storage split, matching the task's brief:
 *  - SecureStore holds the small, sensitive "current session" pointer
 *    (which local demo user is signed in) — it's tiny and benefits from
 *    OS-level encryption.
 *  - AsyncStorage holds the bulkier local "database" (accounts, profiles,
 *    enrollments, preferences) — this is demo data a user can already see
 *    in the app UI, not secret, and AsyncStorage has no practical size
 *    ceiling the way SecureStore does.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_SESSION_KEY = 'coachconde.demo.session';
const ASYNC_NAMESPACE = 'coachconde.demo';

export interface DemoSessionPointer {
  userId: string;
  email: string;
}

/**
 * expo-secure-store has no web implementation (it's a native-only module by
 * design — see its ExpoSecureStore.web.ts, which is an empty stub). The
 * PRD's real targets are Expo Go on iOS/Android, but app.json also lists a
 * `web` platform for convenience (e.g. `expo export --platform web` as a
 * quick bundling smoke test), so this falls back to AsyncStorage on web
 * rather than crashing the whole app on that one platform.
 */
const isSecureStoreAvailable = Platform.OS !== 'web';

export async function readDemoSession(): Promise<DemoSessionPointer | null> {
  const raw = isSecureStoreAvailable
    ? await SecureStore.getItemAsync(SECURE_SESSION_KEY)
    : await AsyncStorage.getItem(SECURE_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoSessionPointer;
  } catch {
    return null;
  }
}

export async function writeDemoSession(session: DemoSessionPointer | null): Promise<void> {
  if (!session) {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(SECURE_SESSION_KEY);
    } else {
      await AsyncStorage.removeItem(SECURE_SESSION_KEY);
    }
    return;
  }

  const serialized = JSON.stringify(session);
  if (isSecureStoreAvailable) {
    await SecureStore.setItemAsync(SECURE_SESSION_KEY, serialized);
  } else {
    await AsyncStorage.setItem(SECURE_SESSION_KEY, serialized);
  }
}

function key(...parts: string[]): string {
  return [ASYNC_NAMESPACE, ...parts].join(':');
}

export async function readJson<T>(storageKey: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key(storageKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson<T>(storageKey: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key(storageKey), JSON.stringify(value));
}

export async function removeKey(storageKey: string): Promise<void> {
  await AsyncStorage.removeItem(key(storageKey));
}

export const demoStorageKeys = {
  accounts: 'accounts', // email -> { userId, passwordHash }
  profile: (userId: string) => `profile:${userId}`,
  enrollment: (userId: string) => `enrollment:${userId}`,
  notificationPreferences: (userId: string) => `notification-prefs:${userId}`,
  exerciseMaxes: (userId: string) => `exercise-maxes:${userId}`,
};

/**
 * Local mock authentication for demo mode. Fully isolated from Supabase —
 * see the header comment in ./storage.ts. This exists so the app is fully
 * usable (sign up, sign in, onboarding, a real Today screen driven by the
 * real program content) with zero backend configured.
 *
 * Password "hashing" here is SHA-256 via expo-crypto — good enough to avoid
 * storing plaintext on-device for a local demo account, but this is
 * explicitly not a production auth system: there is no server, no session
 * expiry, and no protection against a compromised device. Never reuse this
 * module's approach for the real Supabase-backed auth path.
 */
import * as Crypto from 'expo-crypto';

import { demoStorageKeys, readDemoSession, readJson, writeDemoSession, writeJson } from './storage';

export interface DemoUser {
  id: string;
  email: string;
}

interface DemoAccount {
  userId: string;
  email: string;
  passwordHash: string;
}

type DemoAccountsIndex = Record<string, DemoAccount>; // key: lowercased email

type AuthListener = (user: DemoUser | null) => void;

const listeners = new Set<AuthListener>();

function notify(user: DemoUser | null) {
  for (const listener of listeners) listener(user);
}

async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

async function loadAccounts(): Promise<DemoAccountsIndex> {
  return (await readJson<DemoAccountsIndex>(demoStorageKeys.accounts)) ?? {};
}

async function saveAccounts(accounts: DemoAccountsIndex): Promise<void> {
  await writeJson(demoStorageKeys.accounts, accounts);
}

export class DemoAuthError extends Error {}

export async function demoSignUp(email: string, password: string): Promise<DemoUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = await loadAccounts();

  if (accounts[normalizedEmail]) {
    throw new DemoAuthError('An account with this email already exists.');
  }

  const userId = Crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  accounts[normalizedEmail] = { userId, email: normalizedEmail, passwordHash };
  await saveAccounts(accounts);

  const user: DemoUser = { id: userId, email: normalizedEmail };
  await writeDemoSession({ userId, email: normalizedEmail });
  notify(user);
  return user;
}

export async function demoSignIn(email: string, password: string): Promise<DemoUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = await loadAccounts();
  const account = accounts[normalizedEmail];

  if (!account) {
    throw new DemoAuthError('No account found with this email in demo mode.');
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== account.passwordHash) {
    throw new DemoAuthError('Incorrect password.');
  }

  const user: DemoUser = { id: account.userId, email: account.email };
  await writeDemoSession({ userId: account.userId, email: account.email });
  notify(user);
  return user;
}

export async function demoSignOut(): Promise<void> {
  await writeDemoSession(null);
  notify(null);
}

/**
 * Demo mode has no real password recovery — this simulates the flow's shape
 * (so the Forgot Password screen has real behavior to call) without ever
 * pretending to send an email.
 */
export async function demoRequestPasswordReset(email: string): Promise<void> {
  const accounts = await loadAccounts();
  const normalizedEmail = email.trim().toLowerCase();
  if (!accounts[normalizedEmail]) {
    throw new DemoAuthError('No account found with this email in demo mode.');
  }
  // No-op beyond validation: there's no email service in demo mode.
}

/**
 * Removes one demo account's credentials so it can no longer sign in, and
 * clears the current session if it belonged to that account. Does not touch
 * that user's profile/enrollment/workout data — callers (see
 * src/lib/accountDeletion/deleteAccount.ts) clear those separately so this
 * module stays scoped to authentication only, matching demoContentStore.ts's
 * separation of concerns.
 */
export async function demoDeleteAccount(userId: string): Promise<void> {
  const accounts = await loadAccounts();
  const normalizedEmail = Object.keys(accounts).find((email) => accounts[email]?.userId === userId);
  if (normalizedEmail) {
    delete accounts[normalizedEmail];
    await saveAccounts(accounts);
  }

  const current = await readDemoSession();
  if (current?.userId === userId) {
    await writeDemoSession(null);
    notify(null);
  }
}

export async function getDemoSession(): Promise<DemoUser | null> {
  const pointer = await readDemoSession();
  if (!pointer) return null;
  return { id: pointer.userId, email: pointer.email };
}

export function onDemoAuthStateChange(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

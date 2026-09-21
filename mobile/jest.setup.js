/* eslint-disable no-undef */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm, data) => {
    // Deterministic, test-only stand-in for a real digest — good enough to
    // exercise demoAuth's "hash before compare" logic without needing a
    // native crypto module under Jest.
    let hash = 0;
    for (let i = 0; i < data.length; i += 1) {
      hash = (hash * 31 + data.charCodeAt(i)) | 0;
    }
    return `test-hash-${hash}`;
  }),
  randomUUID: jest.fn(() => {
    // RFC4122-shaped but not cryptographically random — fine for tests,
    // which only need uniqueness and shape, never unpredictability.
    const hex = () => Math.floor(Math.random() * 16).toString(16);
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return template.replace(/[xy]/g, (c) => {
      if (c === 'y') return ((Math.floor(Math.random() * 16) & 0x3) | 0x8).toString(16);
      return hex();
    });
  }),
  getRandomBytes: jest.fn((byteCount) => {
    const bytes = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return bytes;
  }),
  getRandomBytesAsync: jest.fn(async (byteCount) => {
    const bytes = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return bytes;
  }),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

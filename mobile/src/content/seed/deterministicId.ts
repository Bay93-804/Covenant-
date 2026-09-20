/**
 * Deterministic RFC 4122 v5 (SHA-1, namespace + name) UUID generation, with
 * zero platform-specific dependencies — no `node:crypto`, no `expo-crypto`.
 *
 * This is used both by Node-only tooling (scripts/, __tests__/) *and* by
 * app runtime code (src/lib/supabase/mutations.ts,
 * src/lib/demo/demoContentStore.ts both need `programVersionIdForSlug` to
 * agree with the same ids the seed importer produced) — so it must bundle
 * cleanly for Metro/React Native as well as run under plain Node via
 * ts-node. A pure-JS SHA-1 is the simplest way to guarantee that; the
 * `uuid` npm package was tried first and rejected for this because it
 * ships ESM-only builds that fight Jest's CJS transform (see git history),
 * and `node:crypto` doesn't exist in the React Native runtime at all.
 */

function sha1(bytes: Uint8Array): Uint8Array {
  const h = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);

  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 2 ** 32), false);

  const w = new Uint32Array(80);

  for (let chunkStart = 0; chunkStart < paddedLength; chunkStart += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(chunkStart + i * 4, false);
    }
    for (let i = 16; i < 80; i += 1) {
      const value = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
      w[i] = (value << 1) | (value >>> 31);
    }

    let [a, b, c, d, e] = h;

    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b! & c!) | (~b! & d!);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b! ^ c! ^ d!;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b! & c!) | (b! & d!) | (c! & d!);
        k = 0x8f1bbcdc;
      } else {
        f = b! ^ c! ^ d!;
        k = 0xca62c1d6;
      }

      const temp = (((a! << 5) | (a! >>> 27)) + f + e! + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = ((b! << 30) | (b! >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h[0] = (h[0]! + a!) >>> 0;
    h[1] = (h[1]! + b!) >>> 0;
    h[2] = (h[2]! + c!) >>> 0;
    h[3] = (h[3]! + d!) >>> 0;
    h[4] = (h[4]! + e!) >>> 0;
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 5; i += 1) outView.setUint32(i * 4, h[i]!, false);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function utf8Bytes(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i += 1) {
    const code = str.codePointAt(i)!;
    if (code > 0xffff) i += 1; // consumed a surrogate pair
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

/** Fixed namespace for this app's deterministic content ids. Never change — changing it reassigns every id on the next import. */
const NAMESPACE = 'b3c4a9d2-6f1e-4a7c-8b2d-1e9f0a5c7d3b';

function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = hexToBytes(namespace);
  const nameBytes = utf8Bytes(name);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes);
  combined.set(nameBytes, namespaceBytes.length);

  const hash = sha1(combined).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // variant RFC4122
  return bytesToUuid(hash);
}

/** Deterministic id derived from arbitrary stable key parts, joined with `::`. */
export function deterministicId(...parts: (string | number)[]): string {
  return uuidV5(parts.join('::'), NAMESPACE);
}

/**
 * Stable, deterministic program_version_id for a given slug. Used by the
 * Supabase seeder, the deterministic expansion (see expandProgram.ts), and
 * app runtime code (src/lib/supabase/mutations.ts,
 * src/lib/demo/demoContentStore.ts) so ids never drift between environments.
 */
export function programVersionIdForSlug(slug: string): string {
  return deterministicId('program_version', slug);
}

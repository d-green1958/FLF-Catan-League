// How an admin proves they know the admin code, on a public site, without the code ever being published.
//
// The code is stretched into an Ed25519 signing key. The repo holds only the matching public key
// (data/league.json, set by scripts/set-admin-code.js). The browser signs an admin's changes, and the
// GitHub Action checks that signature. The signature goes in a public issue, and the code does not.
//
// The salt and public key are public, so someone could try guessing the code offline. That is why the
// stretching is deliberately slow, and why a long code is required.
// Works in browsers and in Node, which share the same Web Crypto API.

export const MIN_CODE_LENGTH = 12;
export const ITERATIONS = 600_000;

// A signature can be replayed by anyone who copies it from the issue, so each one expires.
const SIGNATURE_LIFETIME_MS = 60 * 60 * 1000;
const CLOCK_TOLERANCE_MS = 10 * 60 * 1000;

// The fixed header that wraps a 32-byte seed into a standard Ed25519 private key.
const PKCS8_HEADER = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

export const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

/** Slowly turns a code or password into 32 bytes, which is what makes guessing expensive. */
export async function stretch(secret, { salt, iterations }) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.trim().normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations }, material, 256);
}

async function deriveKeys(code, adminKey) {
  const seed = await stretch(code, adminKey);
  const pkcs8 = new Uint8Array([...PKCS8_HEADER, ...new Uint8Array(seed)]);
  const readable = await crypto.subtle.importKey('pkcs8', pkcs8, 'Ed25519', true, ['sign']);
  const { x: publicKey } = await crypto.subtle.exportKey('jwk', readable);
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, 'Ed25519', false, ['sign']);
  return { privateKey, publicKey };
}

/** The public details stored in data/league.json. They reveal the code only if it can be guessed. */
export async function createAdminKey(code) {
  if (code.trim().length < MIN_CODE_LENGTH) throw new Error(`The admin code must be at least ${MIN_CODE_LENGTH} characters long.`);
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const { publicKey } = await deriveKeys(code, { salt, iterations: ITERATIONS });
  return { salt, iterations: ITERATIONS, publicKey };
}

/** Returns the key for signing if the code is right, or null if it is not. */
export async function unlockWithCode(code, adminKey) {
  const { privateKey, publicKey } = await deriveKeys(code, adminKey);
  return publicKey === adminKey.publicKey ? privateKey : null;
}

function signedBytes(changes, signedAt) {
  const { profiles, games } = changes;
  const content = JSON.stringify({
    profiles: { saved: profiles.saved, deleted: profiles.deleted },
    games: { saved: games.saved, deleted: games.deleted },
  });
  return new TextEncoder().encode(`flfoxtan-admin-v1\n${signedAt}\n${content}`);
}

export async function signChanges(privateKey, changes, signedAt = Date.now()) {
  const signature = await crypto.subtle.sign('Ed25519', privateKey, signedBytes(changes, signedAt));
  return { signedAt, signature: toBase64(signature) };
}

/** Returns 'valid', 'invalid' or 'expired'. Any change to the signed content makes it invalid. */
export async function checkAuthorisation(adminKey, changes, { signedAt, signature }, now = Date.now()) {
  if (!adminKey) return 'invalid';
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: adminKey.publicKey }, 'Ed25519', false, ['verify']);
    const genuine = await crypto.subtle.verify('Ed25519', key, fromBase64(signature), signedBytes(changes, signedAt));
    if (!genuine) return 'invalid';
  } catch {
    return 'invalid';
  }
  const expired = now - signedAt > SIGNATURE_LIFETIME_MS || signedAt - now > CLOCK_TOLERANCE_MS;
  return expired ? 'expired' : 'valid';
}

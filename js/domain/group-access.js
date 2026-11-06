// How someone with the group password can add to the league without a GitHub account.
//
// A static site cannot post to GitHub by itself, so data/league.json holds a GitHub token encrypted with
// the group password (set by scripts/set-group-password.js). The browser decrypts it and opens the issue
// directly. The token can only manage issues on this repo, and the League submission Action still applies
// the usual rules, so the password lets someone add but never change or remove anything.
//
// Admins get their own copy, encrypted with the admin code (set by scripts/set-admin-access.js), so that
// entering the code is enough for them. The code proves to the Action what they may do, using the public
// key, but opening the issue that carries the proof still takes a GitHub token.
//
// The encrypted token is public, so someone could try guessing the password offline. A guessed password
// exposes the token, which is why it needs to be long and why the token must have so little access.
import { fromBase64, ITERATIONS, MIN_CODE_LENGTH, stretch, toBase64 } from './admin-key.js';

async function encryptionKey(password, details) {
  const bytes = await stretch(password, details);
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** The details stored in data/league.json. The token can only be read with the password. */
export async function createGroupAccess(password, token) {
  if (password.trim().length < MIN_CODE_LENGTH) throw new Error(`The password must be at least ${MIN_CODE_LENGTH} characters long.`);
  // Classic tokens starting "ghp_" can reach everything their owner can, which is far too much to store here.
  if (!/^github_pat_\w+$/.test(token.trim())) throw new Error('That is not a fine-grained GitHub token. It should start with "github_pat_".');
  const details = { salt: toBase64(crypto.getRandomValues(new Uint8Array(16))), iterations: ITERATIONS };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(password, details);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token.trim()));
  return { ...details, iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

/** Returns the token if the password is right, or null if it is not. */
export async function openGroupAccess(password, groupAccess) {
  const key = await encryptionKey(password, groupAccess);
  try {
    const token = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(groupAccess.iv) }, key, fromBase64(groupAccess.ciphertext));
    return new TextDecoder().decode(token);
  } catch {
    return null;
  }
}

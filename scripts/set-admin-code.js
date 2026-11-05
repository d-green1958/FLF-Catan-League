// Sets or changes the admin code. Run it from the repo folder, then commit data/league.json:
//
//   node scripts/set-admin-code.js
//
// The code is typed at a hidden prompt and never saved. Only a public key derived from it goes in the
// file, so the commit is safe in a public repo. Changing the code stops the old one working.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createAdminKey } from '../js/domain/admin-key.js';

const file = join(process.env.DATA_DIR || 'data', 'league.json');
const KEY_LINE = /"adminKey":\s*(null|\{[^}]*\})/;

async function readCode() {
  if (!process.stdin.isTTY) return readFileSync(0, 'utf8').split('\n')[0];
  console.log('Choose something long and hard to guess: at least 12 characters, ideally four or more random words.');

  // Sending the reader's output nowhere is what stops the typed code appearing on screen.
  const silent = new Writable({ write: (chunk, encoding, done) => done() });
  const reader = createInterface({ input: process.stdin, output: silent, terminal: true });
  const askHidden = async (prompt) => {
    process.stdout.write(prompt);
    const answer = await reader.question('');
    process.stdout.write('\n');
    return answer;
  };
  try {
    const code = await askHidden('New admin code: ');
    if (code !== await askHidden('Type it again:  ')) throw new Error('Those did not match, so nothing has changed.');
    return code;
  } finally {
    reader.close();
  }
}

try {
  const before = readFileSync(file, 'utf8');
  if (!KEY_LINE.test(before)) throw new Error(`Could not find "adminKey" in ${file}.`);
  const adminKey = await createAdminKey(await readCode());
  writeFileSync(file, before.replace(KEY_LINE, `"adminKey": ${JSON.stringify(adminKey)}`));
  console.log(`Saved to ${file}. Commit and push that file for the new code to take effect.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

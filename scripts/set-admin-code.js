// Sets or changes the admin code. Run it from the repo folder, then commit data/league.json:
//
//   node scripts/set-admin-code.js
//
// The code is typed at a hidden prompt and never saved. Only a public key derived from it goes in the
// file, so the commit is safe in a public repo. Changing the code stops the old one working.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAdminKey } from '../js/domain/admin-key.js';
import { withHiddenPrompt } from './hidden-prompt.js';

const file = join(process.env.DATA_DIR || 'data', 'league.json');
const KEY_LINE = /"adminKey":\s*(null|\{[^}]*\})/;

async function readCode(ask) {
  if (process.stdin.isTTY) console.log('Choose something long and hard to guess: at least 12 characters, ideally four or more random words.');
  const code = await ask('New admin code: ');
  if (process.stdin.isTTY && code !== await ask('Type it again:  ')) throw new Error('Those did not match, so nothing has changed.');
  return code;
}

try {
  const before = readFileSync(file, 'utf8');
  if (!KEY_LINE.test(before)) throw new Error(`Could not find "adminKey" in ${file}.`);
  const adminKey = await createAdminKey(await withHiddenPrompt(readCode));
  writeFileSync(file, before.replace(KEY_LINE, `"adminKey": ${JSON.stringify(adminKey)}`));
  console.log(`Saved to ${file}. Commit and push that file for the new code to take effect.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

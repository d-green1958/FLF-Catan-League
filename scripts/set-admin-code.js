// Sets or changes the admin code. Run it from the repo folder, then commit data/league.json:
//
//   node scripts/set-admin-code.js
//
// The code is typed at a hidden prompt and never saved. Only a public key derived from it goes in the
// file, so the commit is safe in a public repo. Changing the code stops the old one working.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAdminKey } from '../js/domain/admin-key.js';
import { openGroupAccess } from '../js/domain/group-access.js';
import { withHiddenPrompt } from './hidden-prompt.js';

const file = join(process.env.DATA_DIR || 'data', 'league.json');
const KEY_LINE = /"adminKey":\s*(null|\{[^}]*\})/;
const ADMIN_ACCESS_LINE = /"adminAccess":\s*(null|\{[^}]*\})/;

async function readCode(ask) {
  if (process.stdin.isTTY) console.log('Choose something long and hard to guess: at least 12 characters, ideally four or more random words.');
  const code = await ask('New admin code: ');
  if (process.stdin.isTTY && code !== await ask('Type it again:  ')) throw new Error('Those did not match, so nothing has changed.');
  return code;
}

try {
  const before = readFileSync(file, 'utf8');
  if (!KEY_LINE.test(before)) throw new Error(`Could not find "adminKey" in ${file}.`);
  const code = await withHiddenPrompt(readCode);
  const adminKey = await createAdminKey(code);
  const { groupAccess, adminAccess } = JSON.parse(before);
  // The two must differ, or everyone with the group password could also remove things.
  if (groupAccess && await openGroupAccess(code, groupAccess)) throw new Error('The admin code must be different from the group password.');
  // The admins' copy of the token is locked with the old code, so it has to be made again with the new one.
  writeFileSync(file, before.replace(KEY_LINE, `"adminKey": ${JSON.stringify(adminKey)}`).replace(ADMIN_ACCESS_LINE, '"adminAccess": null'));
  console.log(`Saved to ${file}. Commit and push that file for the new code to take effect.`);
  if (adminAccess) console.log('Run scripts/set-admin-access.js as well, so admins can send without being asked. If the old code leaked, delete the GitHub token and make a new one first, because the old code still opens the copy in the Git history.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

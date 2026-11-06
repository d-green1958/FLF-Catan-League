// Sets or changes the group password, which lets people add without a GitHub account.
// Run it from the repo folder, then commit data/league.json:
//
//   node scripts/set-group-password.js
//
// It needs a fine-grained GitHub token from the repo owner: see "Add without a GitHub account" in the
// README. The password and token are typed at hidden prompts. Only the token, encrypted with the password,
// goes in the file. Running this again stops the old password working, but also delete the old token on
// GitHub, because anyone who already had it could still use it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unlockWithCode } from '../js/domain/admin-key.js';
import { createGroupAccess } from '../js/domain/group-access.js';
import { withHiddenPrompt } from './hidden-prompt.js';

const file = join(process.env.DATA_DIR || 'data', 'league.json');
const ACCESS_LINE = /"groupAccess":\s*(null|\{[^}]*\})/;
const ADMIN_ACCESS_LINE = /"adminAccess":\s*(null|\{[^}]*\})/;

async function readSecrets(ask) {
  if (process.stdin.isTTY) console.log('Choose something long and hard to guess: at least 12 characters, ideally four or more random words.');
  const password = await ask('New group password: ');
  if (process.stdin.isTTY && password !== await ask('Type it again:      ')) throw new Error('Those did not match, so nothing has changed.');
  const token = await ask('GitHub token:       ');
  return { password, token };
}

try {
  const before = readFileSync(file, 'utf8');
  if (!ACCESS_LINE.test(before)) throw new Error(`Could not find "groupAccess" in ${file}.`);
  const { password, token } = await withHiddenPrompt(readSecrets);
  const { adminKey } = JSON.parse(before);
  // The two must differ, or everyone with the group password could also remove things.
  if (adminKey && password.trim() && await unlockWithCode(password, adminKey)) throw new Error('The group password must be different from the admin code.');
  const groupAccess = await createGroupAccess(password, token);
  // The admins' copy may hold an old token, so it has to be made again from the new one.
  const hadAdminAccess = Boolean(JSON.parse(before).adminAccess);
  writeFileSync(file, before.replace(ACCESS_LINE, `"groupAccess": ${JSON.stringify(groupAccess)}`).replace(ADMIN_ACCESS_LINE, '"adminAccess": null'));
  console.log(`Saved to ${file}. Commit and push that file for the new password to take effect.`);
  if (hadAdminAccess) console.log('Run scripts/set-admin-access.js as well, so admins can send without being asked.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

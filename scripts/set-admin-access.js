// Lets admins send changes without being asked about a GitHub account or the group password.
// Run it from the repo folder after setting both of those, then commit data/league.json:
//
//   node scripts/set-admin-access.js
//
// It opens the GitHub token with the group password, and stores a second copy encrypted with the admin
// code. Both are typed at hidden prompts and checked against the file. You do not need the token itself.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unlockWithCode } from '../js/domain/admin-key.js';
import { createGroupAccess, openGroupAccess } from '../js/domain/group-access.js';
import { withHiddenPrompt } from './hidden-prompt.js';

const file = join(process.env.DATA_DIR || 'data', 'league.json');
const ACCESS_LINE = /"adminAccess":\s*(null|\{[^}]*\})/;

try {
  const before = readFileSync(file, 'utf8');
  if (!ACCESS_LINE.test(before)) throw new Error(`Could not find "adminAccess" in ${file}.`);
  const { adminKey, groupAccess } = JSON.parse(before);
  if (!adminKey) throw new Error('Set the admin code first, with scripts/set-admin-code.js.');
  if (!groupAccess) throw new Error('Set the group password first, with scripts/set-group-password.js.');
  const { password, code } = await withHiddenPrompt(async (ask) => ({
    password: await ask('Group password: '),
    code: await ask('Admin code:     '),
  }));
  const token = await openGroupAccess(password, groupAccess);
  if (!token) throw new Error('That group password is not right, so nothing has changed.');
  if (!await unlockWithCode(code, adminKey)) throw new Error('That admin code is not right, so nothing has changed.');
  const adminAccess = await createGroupAccess(code, token);
  writeFileSync(file, before.replace(ACCESS_LINE, `"adminAccess": ${JSON.stringify(adminAccess)}`));
  console.log(`Saved to ${file}. Commit and push that file for it to take effect.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

// Asks for secrets at a hidden prompt. Shared by the scripts that set the admin code and group password.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

/** Calls use(ask), where ask(prompt) returns one hidden answer. Piped input is read line by line instead. */
export async function withHiddenPrompt(use) {
  if (!process.stdin.isTTY) {
    const lines = readFileSync(0, 'utf8').split('\n');
    return use(async () => lines.shift() ?? '');
  }
  // Sending the reader's output nowhere is what stops the typed secret appearing on screen.
  const silent = new Writable({ write: (chunk, encoding, done) => done() });
  const reader = createInterface({ input: process.stdin, output: silent, terminal: true });
  try {
    return await use(async (prompt) => {
      process.stdout.write(prompt);
      const answer = await reader.question('');
      process.stdout.write('\n');
      return answer;
    });
  } finally {
    reader.close();
  }
}

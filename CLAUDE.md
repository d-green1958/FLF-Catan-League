# Instructions for Claude

## Claude may only commit to `indrasbranch`

Claude may make commits on `indrasbranch`. Claude must never make commits on `main` or any other branch.

Before every commit, run `git branch --show-current`. If the result is not `indrasbranch`, do not commit. Tell the user which branch is checked out and wait for their instructions.

On any branch other than `indrasbranch`, do not:

- Run `git commit`, including `--amend`.
- Run any other command that creates or rewrites commits, such as `git merge`, `git rebase`, `git cherry-pick`, or `git revert`.

## Pushing and pull requests

- Do not push unless the user asks. Only ever push `indrasbranch`, and never push to `main` or any other remote branch.
- Do not merge `indrasbranch` into `main` or any other branch, and do not merge pull requests.

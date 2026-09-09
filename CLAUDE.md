# @openscan/hardhat-plugin

pnpm workspace. Packages live under [packages/](packages/).

## Git workflow

`MatiasOS/hardhat-plugin` (`origin`) is a fork of `openscan-explorer/hardhat-plugin`
(`openscan`), where most work happens. Its default branch is **`dev`**; upstream's
is `main`. Pull requests run cross-fork: `MatiasOS:<branch>` → base `main` on
`openscan-explorer/hardhat-plugin`.

**One branch per issue.** Never commit directly to the default branch — `dev`
here, `main` in an upstream clone; the hook resolves it per clone. Branch first:

- `issue-<n>-<slug>` when there's a tracked issue — `issue-42-verify-on-deploy`
- `<type>/<slug>` when there isn't — `ci/add-missing-repo-url`, `fix/network-name-restriction`

**Conventional Commits, strictly** — `type(scope)?: description`

- Lowercase type from: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Subject ≤72 characters, no trailing period, imperative mood
- Scopes in use here: `explorer`, `plugin`, `example-project`
- Exempt: merge, revert, `fixup!`/`squash!`, and release subjects (`v1.3.0`)

```text
feat(explorer): open browser on network page
fix(plugin): prevent multiple logs on startup
chore(example-project): dont track ignition dir for easy testing
```

## Enforcement

These rules are not advisory — [.githooks/](.githooks/) enforces them for every
contributor, activated by `pnpm install` via the `prepare` script. `commit-msg`
checks the subject format and scans for attribution; `pre-commit` guards the
default branch. The rules live in one place,
[.githooks/lib/git-rules.mjs](.githooks/lib/git-rules.mjs), covered by
`pnpm test:hooks`.

A rejection is the rule firing, not a flaky failure — fix the message or the
branch rather than retrying. For a deliberate exception, ask first, then prefix
the command with `ALLOW_NONCONVENTIONAL_COMMIT=1`, `ALLOW_DEFAULT_BRANCH_COMMIT=1`
or `ALLOW_AI_ATTRIBUTION=1`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Authorship

Commits and PRs carry no AI attribution — no `Co-Authored-By: Claude` trailer, no
`🤖 Generated with [Claude Code]` footer, no "AI-generated" notes in code comments or
PR bodies. The human running the session is the sole author; write commit messages in
their voice, describing the change rather than what produced it.

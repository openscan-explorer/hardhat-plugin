# Contributing

## Setup

```bash
pnpm install
```

That also activates this repo's git hooks by pointing `core.hooksPath` at
[.githooks/](.githooks/). They need nothing but the Node you already have.

## Branches

Work on each issue in its own branch. Committing straight to your clone's
default branch is rejected — that's `dev` in the `MatiasOS/hardhat-plugin` fork
where most work happens, and `main` in `openscan-explorer/hardhat-plugin`. The
hook resolves it from your own `origin/HEAD`, so either clone is guarded.

```bash
git checkout -b issue-42-verify-on-deploy   # when there is a tracked issue
git checkout -b fix/network-name-restriction # when there is not
```

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), enforced:

```text
type(scope): description
```

- Type is lowercase, one of: `feat`, `fix`, `docs`, `style`, `refactor`,
  `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Subject is 72 characters or fewer, imperative mood, no trailing period
- Scopes in use: `explorer`, `plugin`, `example-project`

```text
feat(explorer): open browser on network page
fix(plugin): prevent multiple logs on startup
docs: add steps to test the plugin
```

Merge, revert, `fixup!`/`squash!` and release subjects (`v1.3.0`) are exempt.

## Authorship

Commits carry no AI attribution — no `Co-Authored-By` trailer naming an AI
assistant, no "Generated with …" footer, no "AI-generated" notes in commit
messages or code comments. Whoever makes the commit is its author; write the
message in your own voice, describing the change rather than what produced it.

Use whatever tools you like — this is about the record they leave, not how you
work. If you use Claude Code, add this to your own user settings so it stops
appending the trailer:

```json
{ "attribution": { "commit": "", "pr": "" } }
```

## Overrides

Each rule has an escape hatch for the deliberate exception:

```bash
ALLOW_NONCONVENTIONAL_COMMIT=1 git commit -m "..."
ALLOW_DEFAULT_BRANCH_COMMIT=1 git commit -m "..."
ALLOW_AI_ATTRIBUTION=1 git commit -m "..."
```

`git commit --no-verify` skips the hooks entirely.

## Pull requests

```bash
pnpm build && pnpm test && pnpm lint
pnpm test:hooks   # only if you changed .githooks/
```

Push your branch to your fork and open the PR against
`openscan-explorer/hardhat-plugin`, base `main`:

```bash
git push -u origin <your-branch>
gh pr create --repo openscan-explorer/hardhat-plugin --base main
```

#!/usr/bin/env node
/**
 * Git rules for this repository, shared by the commit-msg and pre-commit hooks.
 *
 *   1. No AI self-attribution in commit messages.
 *   2. One branch per issue — never commit onto the default branch.
 *   3. Conventional Commits, strictly.
 *
 * Run directly as a hook entry point:
 *
 *   node .githooks/lib/git-rules.mjs commit-msg <message-file>
 *   node .githooks/lib/git-rules.mjs pre-commit
 *
 * Exit 1 rejects the commit. Each rule has an environment escape hatch for the
 * deliberate exception, and `git commit --no-verify` skips the hooks entirely.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const MAX_SUBJECT_LEN = 72;

export const TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];

/** Scope allows spaces — this repo's history contains `feat(contract verification):`. */
export const CONVENTIONAL_RE = new RegExp(
  `^(?:${TYPES.join("|")})(?:\\([a-z0-9 ._-]+\\))?!?: .+`,
);

/** git-generated and release subjects are never format-checked. */
export const EXEMPT_RE = /^(?:Merge |Revert |fixup! |squash! |v?\d+\.\d+\.\d+)/;

export const ATTRIBUTION_PATTERNS = [
  [
    /co-authored-by:\s*(?:claude|anthropic|copilot|cursor|codex|devin|aider|chatgpt|openai|gemini)/i,
    "AI co-author trailer",
  ],
  [/co-authored-by:.*\[bot\]/i, "bot co-author trailer"],
  [/noreply@anthropic\.com/i, "Anthropic noreply address"],
  [/generated with \[?claude/i, "'Generated with Claude Code' footer"],
  [/🤖\s*generated with/i, "'robot Generated with' footer"],
  [
    /generated (?:with|by) (?:claude|ai|an ai|copilot|cursor|chatgpt)/i,
    "AI generation credit",
  ],
  [/claude\.com\/claude-code/i, "Claude Code URL"],
  [/claude\.ai\/code/i, "Claude Code URL"],
  [/(?:ai|machine)-generated/i, "'AI-generated' note"],
  [/written by (?:claude|ai|an ai)/i, "'written by AI' note"],
];

/**
 * Default branch when `origin/HEAD` cannot be resolved (a clone that never set
 * it). `dev` is this repository's default; main/master cover a fork that
 * renamed. A fork with its own default still resolves from its `origin/HEAD`.
 */
export const DEFAULT_BRANCH_FALLBACK = "dev";

export const ENV_ALLOW_ATTRIBUTION = "ALLOW_AI_ATTRIBUTION";
export const ENV_ALLOW_FORMAT = "ALLOW_NONCONVENTIONAL_COMMIT";
export const ENV_ALLOW_DEFAULT_BRANCH = "ALLOW_DEFAULT_BRANCH_COMMIT";

// ---------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------

/** The label of the first attribution pattern found in `text`, else null. */
export function findAttribution(text) {
  if (!text) return null;
  for (const [pattern, label] of ATTRIBUTION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

/** The first non-empty line of a commit message. */
export function subjectOf(message) {
  if (!message) return "";
  for (const line of message.split("\n")) {
    if (line.trim()) return line.trim();
  }
  return "";
}

/**
 * Strip what git itself would strip: comment lines, and everything from the
 * scissors line on (where `--verbose` puts the diff).
 */
export function stripCommitComments(raw, commentChar = "#") {
  const scissors = `${commentChar} ------------------------ >8 ------------------------`;
  const lines = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith(scissors)) break;
    if (line.startsWith(commentChar)) continue;
    lines.push(line);
  }
  return lines.join("\n");
}

/** A description of the first format violation in `subject`, else null. */
export function checkConventional(subject) {
  if (!subject || EXEMPT_RE.test(subject)) return null;
  if (!CONVENTIONAL_RE.test(subject)) {
    const lowered = subject[0].toLowerCase() + subject.slice(1);
    if (CONVENTIONAL_RE.test(lowered)) return "type must be lowercase";
    return `must start with a lowercase type: ${TYPES.join(", ")}`;
  }
  if (subject.length > MAX_SUBJECT_LEN) {
    return `subject is ${subject.length} chars, limit is ${MAX_SUBJECT_LEN}`;
  }
  if (subject.endsWith(".")) return "subject must not end with a period";
  return null;
}

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------

function git(...args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function currentBranch() {
  return git("symbolic-ref", "--short", "HEAD");
}

/** The branches that count as "the default branch" for this checkout. */
export function defaultBranches() {
  const remoteHead = git("symbolic-ref", "--short", "refs/remotes/origin/HEAD");
  if (remoteHead) {
    const name = remoteHead.includes("/")
      ? remoteHead.slice(remoteHead.indexOf("/") + 1)
      : remoteHead;
    return [name];
  }
  return [DEFAULT_BRANCH_FALLBACK, "main", "master"];
}

function commentChar() {
  const configured = git("config", "core.commentChar");
  if (!configured || configured === "auto") return "#";
  return configured;
}

// ---------------------------------------------------------------------------
// reporting
// ---------------------------------------------------------------------------

const FORMAT_HELP = `Required: type(scope)?: description — lowercase type, ${MAX_SUBJECT_LEN} chars max, no
trailing period, imperative mood. Types: ${TYPES.join(", ")}.
Examples: feat(explorer): add network page / fix: support non default name networks
Exempt: merge, revert, fixup!/squash!, and release subjects (v1.3.0).
Deliberate exception: ${ENV_ALLOW_FORMAT}=1 git commit ...`;

const ATTRIBUTION_HELP = `Commits in this repository carry no AI attribution: no Co-Authored-By trailer,
no "Generated with Claude Code" footer, no AI credit. The author of the commit
is its author. Re-commit with the attribution removed.
Deliberate exception: ${ENV_ALLOW_ATTRIBUTION}=1 git commit ...`;

const BRANCH_HELP = `Work on each issue in its own branch. Create one first:
  git checkout -b issue-<n>-<slug>    (when there is a tracked issue)
  git checkout -b <type>/<slug>       (when there is not)
Already committed here? Move the work: git branch <name> && git reset --keep HEAD~1
Deliberate exception: ${ENV_ALLOW_DEFAULT_BRANCH}=1 git commit ...`;

function reject(violations) {
  const blocks = violations.map(
    ([title, detail, help]) =>
      `REJECTED — ${title}\n${detail ? `${detail}\n` : ""}\n${help}\n`,
  );
  process.stderr.write(`\n${blocks.join("\n")}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// hook entry points
// ---------------------------------------------------------------------------

function runCommitMsg(messagePath) {
  if (!messagePath) return;

  let raw;
  try {
    raw = readFileSync(messagePath, "utf8");
  } catch {
    return; // nothing to check; let git proceed
  }

  const message = stripCommitComments(raw, commentChar());
  const subject = subjectOf(message);
  const violations = [];

  if (process.env[ENV_ALLOW_ATTRIBUTION] !== "1") {
    const label = findAttribution(message);
    if (label) {
      violations.push([
        "attribution rule",
        `Matched: ${label}.`,
        ATTRIBUTION_HELP,
      ]);
    }
  }

  if (process.env[ENV_ALLOW_FORMAT] !== "1") {
    const problem = checkConventional(subject);
    if (problem) {
      violations.push([
        "Conventional Commits rule",
        `Subject: "${subject}"\nProblem: ${problem}.`,
        FORMAT_HELP,
      ]);
    }
  }

  if (violations.length) reject(violations);
}

function runPreCommit() {
  if (process.env[ENV_ALLOW_DEFAULT_BRANCH] === "1") return;

  const current = currentBranch();
  if (!current) return; // detached HEAD, or not a repo

  if (defaultBranches().includes(current)) {
    reject([
      [
        "branch rule",
        `'${current}' is this repository's default branch.`,
        BRANCH_HELP,
      ],
    ]);
  }
}

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "commit-msg") runCommitMsg(rest[0]);
  else if (mode === "pre-commit") runPreCommit();
}

// Only act when run as a hook, not when imported by the tests.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}

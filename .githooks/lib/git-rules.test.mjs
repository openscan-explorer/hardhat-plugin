import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  checkConventional,
  findAttribution,
  stripCommitComments,
  subjectOf,
  MAX_SUBJECT_LEN,
} from "./git-rules.mjs";

const HOOKS_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const TRAILER = "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>";

describe("checkConventional", () => {
  const valid = [
    "feat(explorer): add network page",
    "fix: support non default name networks",
    "feat(contract verification): verify on deploy",
    "chore(example-project): dont track ignition dir",
    "feat(api)!: drop the old option",
    `feat: ${"x".repeat(MAX_SUBJECT_LEN - 6)}`,
  ];
  for (const subject of valid) {
    it(`accepts "${subject.slice(0, 40)}"`, () => {
      assert.equal(checkConventional(subject), null);
    });
  }

  it("rejects a capitalized type", () => {
    assert.match(checkConventional("Docs: Update README"), /lowercase/);
  });

  it("rejects a trailing period", () => {
    assert.match(checkConventional("feat: add the thing."), /period/);
  });

  it("rejects a subject over the limit", () => {
    const subject = `feat: ${"x".repeat(MAX_SUBJECT_LEN - 5)}`;
    assert.equal(subject.length, MAX_SUBJECT_LEN + 1);
    assert.match(checkConventional(subject), /limit is 72/);
  });

  it("rejects a subject with no type", () => {
    assert.match(
      checkConventional("Update openscan to v1.2.0-alpha"),
      /must start with a lowercase type/,
    );
  });

  it("rejects an unknown type", () => {
    assert.ok(checkConventional("wip: half a thing"));
  });

  const exempt = [
    "v1.3.0",
    "1.0.2",
    "Merge pull request #8 from MatiasOS/dev",
    'Revert "feat: add the thing"',
    "fixup! feat: add the thing",
    "squash! feat: add the thing",
  ];
  for (const subject of exempt) {
    it(`exempts "${subject.slice(0, 40)}"`, () => {
      assert.equal(checkConventional(subject), null);
    });
  }

  it("ignores an empty subject", () => {
    assert.equal(checkConventional(""), null);
  });
});

describe("findAttribution", () => {
  const attributed = [
    [TRAILER, "co-author trailer"],
    ["Co-authored-by: Cursor Agent <x@y.z>", "another AI tool"],
    ["Co-authored-by: dependabot[bot] <x@y.z>", "bot trailer"],
    [
      "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
      "footer",
    ],
    ["This was AI-generated from a template", "AI-generated note"],
    ["Mostly written by Claude, reviewed by me", "written by note"],
  ];
  for (const [text, label] of attributed) {
    it(`flags ${label}`, () => {
      assert.ok(findAttribution(text), `expected a match for: ${text}`);
    });
  }

  const clean = [
    "feat: add the thing\n\nA normal body explaining the change.",
    "fix: handle the ai-assistant config key",
    "docs: describe the code generation step",
    "",
  ];
  for (const text of clean) {
    it(`passes "${text.slice(0, 40)}"`, () => {
      assert.equal(findAttribution(text), null);
    });
  }
});

describe("message parsing", () => {
  it("takes the first non-empty line as the subject", () => {
    assert.equal(subjectOf("\n\nfeat: a thing\n\nbody\n"), "feat: a thing");
  });

  it("strips comment lines", () => {
    const raw = "feat: a thing\n# Please enter the commit message\n\nbody\n";
    assert.equal(stripCommitComments(raw).includes("Please enter"), false);
  });

  it("strips everything past the scissors line", () => {
    const raw = [
      "feat: a thing",
      "# ------------------------ >8 ------------------------",
      "diff --git a/x b/x",
      `+${TRAILER}`,
    ].join("\n");
    const message = stripCommitComments(raw);
    assert.equal(findAttribution(message), null);
    assert.equal(subjectOf(message), "feat: a thing");
  });

  it("honours a custom comment char", () => {
    const raw = "feat: a thing\n; a comment\n";
    assert.equal(stripCommitComments(raw, ";").includes("a comment"), false);
  });
});

describe("hooks in a real repository", () => {
  let repo;

  const git = (args, env = {}) => {
    try {
      const stdout = execFileSync("git", args, {
        cwd: repo,
        encoding: "utf8",
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, out: stdout, err: "" };
    } catch (error) {
      return {
        code: error.status ?? 1,
        out: error.stdout ?? "",
        err: error.stderr ?? "",
      };
    }
  };

  // A fresh file per commit, so switching branches mid-suite never trips over
  // a staged modification that the target branch would have to overwrite.
  let change = 0;
  const stageChange = () => {
    writeFileSync(join(repo, `change-${change++}.txt`), "content\n");
    git(["add", "."]);
  };

  const commit = (message, env = {}) => {
    stageChange();
    return git(["commit", "-m", message], env);
  };

  before(() => {
    repo = mkdtempSync(join(tmpdir(), "githooks-test-"));
    git(["init", "-b", "main"]);
    git(["config", "user.email", "t@example.com"]);
    git(["config", "user.name", "Test"]);
    git(["config", "core.hooksPath", HOOKS_DIR]);
    writeFileSync(join(repo, "file.txt"), "start\n");
    git(["add", "."]);
    // The default-branch guard is exercised separately; get a base commit in.
    git(["commit", "-m", "feat: initial"], {
      ALLOW_DEFAULT_BRANCH_COMMIT: "1",
    });
    git(["checkout", "-q", "-b", "feat/work"]);
  });

  after(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it("accepts a conventional subject on a feature branch", () => {
    const { code } = commit("feat(explorer): add network page");
    assert.equal(code, 0);
  });

  it("rejects a capitalized type", () => {
    const { code, err } = commit("Docs: Update README");
    assert.equal(code, 1);
    assert.match(err, /Conventional Commits rule/);
    assert.match(err, /lowercase/);
  });

  it("rejects a trailing period", () => {
    const { code, err } = commit("feat: add the thing.");
    assert.equal(code, 1);
    assert.match(err, /period/);
  });

  it("rejects an over-long subject", () => {
    const { code, err } = commit(`feat: ${"x".repeat(MAX_SUBJECT_LEN - 5)}`);
    assert.equal(code, 1);
    assert.match(err, /limit is 72/);
  });

  it("rejects an attribution trailer", () => {
    const { code, err } = commit(`feat: sneaky\n\n${TRAILER}`);
    assert.equal(code, 1);
    assert.match(err, /attribution rule/);
  });

  it("rejects a Generated-with footer", () => {
    const { code, err } = commit(
      "feat: sneaky\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    );
    assert.equal(code, 1);
    assert.match(err, /attribution rule/);
  });

  it("reports both violations at once", () => {
    const { code, err } = commit(`Docs: Update README\n\n${TRAILER}`);
    assert.equal(code, 1);
    assert.match(err, /attribution rule/);
    assert.match(err, /Conventional Commits rule/);
  });

  it("accepts an exempt release subject", () => {
    assert.equal(commit("v1.3.0").code, 0);
  });

  it("accepts an exempt merge subject", () => {
    assert.equal(commit("Merge pull request #8 from MatiasOS/dev").code, 0);
  });

  it("accepts a message file with no attribution", () => {
    const path = join(repo, "msg.txt");
    writeFileSync(path, "feat: from a file\n\nA normal body.\n");
    stageChange();
    assert.equal(git(["commit", "-F", path]).code, 0);
  });

  it("rejects a message file carrying attribution", () => {
    const path = join(repo, "msg.txt");
    writeFileSync(path, `feat: from a file\n\n${TRAILER}\n`);
    stageChange();
    const { code, err } = git(["commit", "-F", path]);
    assert.equal(code, 1);
    assert.match(err, /attribution rule/);
  });

  it("honours the format escape hatch", () => {
    const { code } = commit("Docs: Update README", {
      ALLOW_NONCONVENTIONAL_COMMIT: "1",
    });
    assert.equal(code, 0);
  });

  it("honours the attribution escape hatch", () => {
    const { code } = commit(`feat: allowed\n\n${TRAILER}`, {
      ALLOW_AI_ATTRIBUTION: "1",
    });
    assert.equal(code, 0);
  });

  it("honours --no-verify", () => {
    stageChange();
    assert.equal(
      git(["commit", "--no-verify", "-m", "Docs: bypassed"]).code,
      0,
    );
  });

  describe("default-branch guard", () => {
    before(() => git(["checkout", "-q", "main"]));
    after(() => git(["checkout", "-q", "feat/work"]));

    it("rejects a commit on main when origin/HEAD is unset", () => {
      const { code, err } = commit("feat: on the default branch");
      assert.equal(code, 1);
      assert.match(err, /branch rule/);
      assert.match(err, /default branch/);
    });

    it("honours the branch escape hatch", () => {
      const { code } = commit("feat: deliberate", {
        ALLOW_DEFAULT_BRANCH_COMMIT: "1",
      });
      assert.equal(code, 0);
    });
  });

  describe("default branch resolved from origin/HEAD", () => {
    before(() => {
      git(["checkout", "-q", "-B", "dev"]);
      git(["update-ref", "refs/remotes/origin/dev", "HEAD"]);
      git([
        "symbolic-ref",
        "refs/remotes/origin/HEAD",
        "refs/remotes/origin/dev",
      ]);
    });
    after(() => {
      git(["symbolic-ref", "-d", "refs/remotes/origin/HEAD"]);
      git(["checkout", "-q", "feat/work"]);
    });

    it("rejects a commit on dev when origin/HEAD points there", () => {
      const { code, err } = commit("feat: on dev");
      assert.equal(code, 1);
      assert.match(err, /'dev' is this repository's default branch/);
    });

    it("allows main once origin/HEAD names dev instead", () => {
      git(["checkout", "-q", "main"]);
      assert.equal(commit("feat: main is not the default here").code, 0);
    });
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = readFileSync(new URL("../update-and-up.sh", import.meta.url), "utf8");

test("update-and-up refuses non-Development checkouts before any fetch, pull or migration", () => {
  const dir = mkdtempSync(join(tmpdir(), "aca-update-branch-"));
  try {
    const bin = join(dir, "bin");
    const scripts = join(dir, "scripts");
    mkdirSync(bin);
    mkdirSync(scripts);
    const gitLog = join(dir, "git.log");
    const fakeGit = join(bin, "git");
    writeFileSync(fakeGit, [
      "#!/bin/sh",
      "printf '%s\\n' \"$*\" >> \"$MOCK_GIT_LOG\"",
      "case \"$1\" in",
      "  symbolic-ref) printf '%s\\n' \"$MOCK_BRANCH\"; exit 0 ;;",
      "  status) exit 0 ;;",
      "  fetch|pull) echo UNEXPECTED_NETWORK_GIT_OPERATION >&2; exit 99 ;;",
      "  *) echo UNEXPECTED_GIT_OPERATION >&2; exit 99 ;;",
      "esac",
    ].join("\n") + "\n");
    chmodSync(fakeGit, 0o755);
    writeFileSync(join(scripts, "update-and-up.sh"), script);
    writeFileSync(join(scripts, "manual-up.sh"), "#!/bin/sh\necho UNEXPECTED_DEPLOY >&2\nexit 99\n");
    const result = spawnSync("bash", [join(scripts, "update-and-up.sh")], {
      encoding: "utf8",
      env: { ...process.env, PATH: bin + ":" + process.env.PATH, MOCK_BRANCH: "main", MOCK_GIT_LOG: gitLog },
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr + result.stdout, /Development/);
    assert.match(result.stderr + result.stdout, /main/);
    assert.doesNotMatch(readFileSync(gitLog, "utf8"), /(?:^|\n)(?:fetch|pull)\b/m);
    assert.doesNotMatch(result.stdout + result.stderr, /UNEXPECTED_(?:DEPLOY|NETWORK_GIT_OPERATION)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Development-only updater retains clean checkout guard and manual-up", () => {
  assert.match(script, /BRANCH="Development"/);
  assert.match(script, /git status --porcelain/);
  assert.match(script, /git pull --ff-only origin "\$BRANCH"/);
  assert.match(script, /bash scripts\/manual-up\.sh/);
  assert.doesNotMatch(script, /ACA_UPDATE_BRANCH/);
});

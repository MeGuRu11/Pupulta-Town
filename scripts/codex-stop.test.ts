import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const fixtures: string[] = [];
const hook = resolve(import.meta.dirname, "../.codex/hooks/verify.mjs");

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "pupulta-codex-stop-"));
  fixtures.push(root);
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  const hookDir = join(root, ".codex", "hooks");
  const bin = join(root, "node_modules", ".bin");
  const cwd = join(root, "packages");
  for (const dir of [hookDir, bin, cwd]) mkdirSync(dir, { recursive: true });
  const script = join(hookDir, "verify.mjs");
  copyFileSync(hook, script);
  writeFileSync(join(root, ".gitignore"), ".codex/\nnode_modules/\n");
  execFileSync("git", ["add", ".gitignore"], { cwd: root });
  const pnpm = process.platform === "win32"
    ? "@echo off\nif not exist .git exit /b 8\nif not \"%~1\"==\"verify\" exit /b 9\necho verify fixture output\nexit /b %PUPULTA_TEST_VERIFY_STATUS%\n"
    : "#!/bin/sh\n[ -d .git ] || exit 8\n[ \"$1\" = verify ] || exit 9\necho verify fixture output\nexit \"$PUPULTA_TEST_VERIFY_STATUS\"\n";
  writeFileSync(join(bin, process.platform === "win32" ? "pnpm.cmd" : "pnpm"), pnpm, { mode: 0o755 });
  return { root, script, bin, cwd };
}

function runHook(fixture: ReturnType<typeof createFixture>, status: number, stopHookActive = false) {
  const result = spawnSync(process.execPath, [fixture.script], {
    cwd: fixture.cwd,
    input: JSON.stringify({ cwd: fixture.cwd, stop_hook_active: stopHookActive }),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: fixture.bin + delimiter + process.env.PATH,
      PUPULTA_TEST_VERIFY_STATUS: String(status),
    },
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as unknown;
}

describe("Codex Stop hook", () => {
  it("runs verify from the repo root and keeps a passing turn complete", () => {
    expect(runHook(createFixture(), 0)).toEqual({});
  });

  it("reports failed verification once and permits a continuation to finish", () => {
    const fixture = createFixture();
    expect(runHook(fixture, 1)).toEqual({
      decision: "block",
      reason: expect.stringContaining("verify fixture output"),
    });
    expect(runHook(fixture, 1, true)).toEqual({});
  });

  it("leaves verification manual when dependencies are unavailable", () => {
    const fixture = createFixture();
    rmSync(fixture.bin, { recursive: true, force: true });
    expect(runHook(fixture, 1)).toEqual({});
  });
});

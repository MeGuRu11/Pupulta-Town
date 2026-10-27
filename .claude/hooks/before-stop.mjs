// Stop: Claude may finish only when `pnpm verify` is green.
// Skips the run when nothing changed since the last green result.
// Claude Code itself stops a hook that keeps blocking after 8 continuations in a row.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const pkgPath = join(root, "package.json");

if (!existsSync(pkgPath)) process.exit(0);
if (!JSON.parse(readFileSync(pkgPath, "utf8")).scripts?.verify) process.exit(0);

const git = (...args) =>
  spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout ?? "";

const stateKey = createHash("sha256")
  .update(git("rev-parse", "HEAD"))
  .update(git("diff", "HEAD"))
  .update(git("ls-files", "--others", "--exclude-standard"))
  .digest("hex");

const cachePath = join(root, ".claude", ".verify-green");
if (existsSync(cachePath) && readFileSync(cachePath, "utf8") === stateKey) process.exit(0);

const run = spawnSync("pnpm", ["-s", "verify"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (run.status === 0) {
  writeFileSync(cachePath, stateKey);
  process.exit(0);
}

const tail = `${run.stdout}${run.stderr}`.split("\n").slice(-60).join("\n");
process.stdout.write(
  JSON.stringify({
    decision: "block",
    reason: `pnpm verify красный. Почини и запусти снова, прежде чем заканчивать.\n${tail}`,
  }),
);

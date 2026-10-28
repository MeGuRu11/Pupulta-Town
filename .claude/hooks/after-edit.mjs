// PostToolUse (Edit|Write): lint the file Claude just changed.
// Exit 2 shows stderr to Claude, so it fixes lint errors right away.
// Does nothing until the monorepo has package.json and eslint installed.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd;
const file = input.tool_input?.file_path;

if (!file || !/\.(ts|tsx|js|mjs)$/.test(file)) process.exit(0);
if (!existsSync(join(root, "node_modules", ".bin", "eslint"))) process.exit(0);

const run = spawnSync("pnpm", ["exec", "eslint", "--no-warn-ignored", file], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (run.status !== 0) {
  process.stderr.write(`eslint нашёл ошибки в ${file}:\n${run.stdout}${run.stderr}`);
  process.exit(2);
}

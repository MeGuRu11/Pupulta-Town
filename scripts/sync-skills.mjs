// Copies project skills from .agents/skills (read by Codex) to .claude/skills (read by Claude Code).
// `--check` only compares the two folders and exits 1 if they differ; CI runs it that way.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const source = ".agents/skills";
const target = ".claude/skills";

const listFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .map((entry) => join(dir, String(entry)))
        .filter((path) => statSync(path).isFile())
        .map((path) => relative(dir, path).replaceAll("\\", "/"))
        .sort()
    : [];

if (process.argv.includes("--check")) {
  const want = listFiles(source);
  const have = listFiles(target);
  const differ =
    want.length !== have.length ||
    want.some(
      (file, i) =>
        file !== have.at(i) ||
        !readFileSync(join(source, file)).equals(readFileSync(join(target, file))),
    );
  if (differ) {
    console.error(`${target} не совпадает с ${source}. Запусти: node scripts/sync-skills.mjs`);
    process.exit(1);
  }
  console.log("Скиллы совпадают.");
} else {
  rmSync(target, { recursive: true, force: true });
  if (existsSync(source)) cpSync(source, target, { recursive: true });
  console.log(`Скопировано: ${source} → ${target}`);
}

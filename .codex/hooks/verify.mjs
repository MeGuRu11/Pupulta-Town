import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const input = JSON.parse(readFileSync(0, "utf8"));

function stopDecision() {
  if (input.stop_hook_active || !existsSync(join(root, "node_modules", ".bin"))) return {};

  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (status.status !== 0 || !status.stdout.trim()) return {};

  const verify = spawnSync("pnpm verify", {
    cwd: root,
    encoding: "utf8",
    shell: true,
    timeout: 115_000,
  });
  if (verify.status === 0) return {};

  const details = [verify.stdout, verify.stderr, verify.error?.message]
    .filter(Boolean)
    .join("\n")
    .trim()
    .split("\n")
    .slice(-30)
    .join("\n");
  return {
    decision: "block",
    reason: `Проверка pnpm verify не прошла. Исправь причину и повтори проверку.\n${details}`,
  };
}

console.log(JSON.stringify(stopDecision()));

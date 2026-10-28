// PreToolUse for the tester subagent: allow edits to test files only.
// Exit 2 blocks the tool call and tells the subagent why.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = (input.tool_input?.file_path ?? "").replaceAll("\\", "/");

const isTest =
  /\.test\.tsx?$/.test(file) ||
  file.includes("/supabase/tests/") ||
  file.includes("/apps/web/e2e/");

if (!isTest) {
  process.stderr.write(
    `Тестировщик меняет только тесты, а ${file} — не тест. Опиши найденную проблему основному агенту.`,
  );
  process.exit(2);
}

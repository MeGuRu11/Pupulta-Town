import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./check-skills.mjs", import.meta.url));
const tempPrefix = join(realpathSync(tmpdir()), "pupulta-check-skills-");
const entry = ".agents/skills/sample/SKILL.md";
const valid = "---\nname: sample\ndescription: Проверка формата\n---\n\n# Инструкция\n";

function run(t, files = {}, directories = []) {
  const cwd = mkdtempSync(tempPrefix);
  t.after(() => {
    assert.ok(cwd.startsWith(tempPrefix) && cwd.length > tempPrefix.length);
    rmSync(cwd, { recursive: true });
  });
  for (const directory of directories) {
    mkdirSync(join(cwd, directory), { recursive: true });
  }
  for (const [file, content] of Object.entries(files)) {
    const path = join(cwd, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

test("checks canonical skills with LF or CRLF and ignores helper files", (t) => {
  const { status, stdout, stderr } = run(t, {
    [entry]: valid,
    ".agents/skills/other/SKILL.md": valid.replace("sample", "other").replaceAll("\n", "\r\n"),
    ".agents/skills/sample/references/example.md": "helper",
  });
  assert.equal(status, 0, stderr);
  assert.match(stdout, /2/);
});

test("rejects a missing canonical skills directory", (t) => {
  const { status, stderr } = run(t);
  assert.equal(status, 1);
  assert.match(stderr, /[.]agents[/\\]skills/);
});

test("rejects a canonical skills directory without any skill", (t) => {
  const { status, stderr } = run(t, {}, [".agents/skills"]);
  assert.equal(status, 1);
  assert.match(stderr, /[.]agents[/\\]skills/);
});

test("rejects a directory with a missing or miscapitalized entrypoint", (t) => {
  const { status, stderr } = run(t, {
    [entry]: valid,
    ".agents/skills/other/skill.md": valid.replace("sample", "other"),
  });
  assert.equal(status, 1);
  assert.match(stderr, /other[/\\]SKILL[.]md/);
});

for (const [label, content, diagnostic] of [
  ["missing front matter", "# Инструкция\n", /front matter/],
  ["unclosed front matter", valid.replace("\n---\n", "\n"), /front matter/],
  ["wrong name", valid.replace("name: sample", "name: other"), /name/],
  ["duplicate name", valid.replace("name: sample", "name: sample\nname: sample"), /name/],
  ["no space after name key", valid.replace("name: sample", "name:sample"), /name/],
  ["missing description", valid.replace(/description:.*\n/, ""), /description/],
  ["no space after description key", valid.replace("description: ", "description:"), /description/],
  ["empty description", valid.replace(/description:.*/, "description:   "), /description/],
  ["empty quoted description", valid.replace(/description:.*/, 'description: ""'), /description/],
  ["empty body", valid.replace("# Инструкция\n", ""), /Markdown/],
]) {
  test(`rejects an entrypoint with ${label}`, (t) => {
    const { status, stderr } = run(t, { [entry]: content });
    assert.equal(status, 1);
    assert.match(stderr, /sample[/\\]SKILL[.]md/);
    assert.match(stderr, diagnostic);
  });
}

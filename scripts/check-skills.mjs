import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Проверка формата проекта, запускается из корня. Проверяем только SKILL.md
// в непосредственных подкаталогах .agents/skills. Поля name и description
// задаются простыми однострочными значениями с пробелом после двоеточия,
// без YAML-кавычек и блоков.
// Остальные метаданные и вспомогательные файлы скилла не разбираем.
const source = ".agents/skills";

try {
  const skills = readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (skills.length === 0) throw new Error(`${source}: нет каталогов скиллов.`);

  for (const { name } of skills) {
    const directory = join(source, name);
    const path = join(directory, "SKILL.md");
    const entries = readdirSync(directory, { withFileTypes: true });
    if (!entries.some((entry) => entry.name === "SKILL.md" && entry.isFile())) {
      throw new Error(`${path}: требуется файл SKILL.md.`);
    }

    const lines = readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    const end = lines.indexOf("---", 1);
    if (lines[0] !== "---" || end < 0) {
      throw new Error(`${path}: нужен начальный блок front matter между строками ---.`);
    }

    const metadata = lines.slice(1, end).join("\n");
    const names = [...metadata.matchAll(/^name:(.*)$/gm)].map(([, value]) => value);
    const descriptions = [...metadata.matchAll(/^description:(.*)$/gm)].map(([, value]) => value);
    if (names.length !== 1 || !names[0].startsWith(" ") || names[0].trim() !== name) {
      throw new Error(`${path}: поле name должно быть указано один раз и совпадать с каталогом ${name}.`);
    }
    const description = descriptions[0]?.trim();
    if (descriptions.length !== 1 || !descriptions[0].startsWith(" ") || !description || /^[#|>"']/.test(description)) {
      throw new Error(`${path}: нужно одно непустое однострочное поле description без кавычек.`);
    }
    if (!lines.slice(end + 1).join("\n").trim()) {
      throw new Error(`${path}: после front matter нужна инструкция в Markdown.`);
    }
  }

  console.log(`Проверено скиллов: ${skills.length}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

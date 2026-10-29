// `pnpm check:assets`: every file in assets/ is a valid glTF 2.0 binary (.glb).
// Size, pivot, node-name and polygon-budget checks arrive with the first model (see the glb-asset skill).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/** Checks the GLB container and its JSON chunk; returns problems, empty when the file is fine. */
export function checkGlb(bytes: Buffer): string[] {
  if (bytes.length < HEADER_BYTES + CHUNK_HEADER_BYTES) {
    return [`file is ${bytes.length} bytes, shorter than the GLB header`];
  }
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) return ["no glTF signature at the start of the file"];

  const version = bytes.readUInt32LE(4);
  if (version !== 2) return [`container version is ${version}, expected glTF 2`];

  const length = bytes.readUInt32LE(8);
  if (length !== bytes.length) return [`header length is ${length}, file is ${bytes.length} bytes`];

  const chunkLength = bytes.readUInt32LE(12);
  const chunkType = bytes.readUInt32LE(16);
  const chunkEnd = HEADER_BYTES + CHUNK_HEADER_BYTES + chunkLength;
  if (chunkType !== JSON_CHUNK) return ["first chunk is not JSON"];
  if (chunkEnd > bytes.length) return ["JSON chunk runs past the end of the file"];

  let json: unknown;
  try {
    json = JSON.parse(bytes.toString("utf8", HEADER_BYTES + CHUNK_HEADER_BYTES, chunkEnd));
  } catch {
    return ["JSON chunk is not valid JSON"];
  }
  const assetVersion = (json as { asset?: { version?: unknown } } | null)?.asset?.version;
  if (typeof assetVersion !== "string" || !assetVersion.startsWith("2.")) {
    return [`asset.version is ${JSON.stringify(assetVersion)}, expected "2.x"`];
  }
  return [];
}

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true })
    .map((entry) => join(dir, String(entry)))
    .filter((path) => statSync(path).isFile())
    .map((path) => relative(dir, path).replaceAll("\\", "/"))
    .filter((file) => !file.split("/").some((part) => part.startsWith(".")))
    .sort();

/** Checks every file under `dir`; returns problems as `path: message`. A missing folder is fine. */
export function checkAssets(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return listFiles(dir).flatMap((file) => {
    if (!file.endsWith(".glb")) return [`${file}: only .glb (glTF 2.0 binary) belongs in assets/`];
    return checkGlb(readFileSync(join(dir, file))).map((problem) => `${file}: ${problem}`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? "assets");
  const problems = checkAssets(dir);
  if (problems.length > 0) {
    console.error(`check:assets нашёл ошибки в ${relative(process.cwd(), dir) || "."}:`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log("check:assets: ассеты в порядке.");
}

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkAssets, checkGlb } from "./check-assets.ts";

const JSON_CHUNK = 0x4e4f534a;

// Builds a GLB container: 12-byte header, then a JSON chunk padded with spaces to 4 bytes.
const glb = (json: unknown, { version = 2, lengthDelta = 0, magic = 0x46546c67 } = {}) => {
  const text = Buffer.from(JSON.stringify(json));
  const padded = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(magic, 0);
  header.writeUInt32LE(version, 4);
  header.writeUInt32LE(20 + padded.length + lengthDelta, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(JSON_CHUNK, 16);
  return Buffer.concat([header, padded]);
};

const validJson = { asset: { version: "2.0" }, scenes: [{ nodes: [] }] };

const tempDir = () => mkdtempSync(join(tmpdir(), "assets-"));

describe("checkGlb", () => {
  it("accepts a glTF 2.0 container", () => {
    expect(checkGlb(glb(validJson))).toEqual([]);
  });

  it("rejects a file without the glTF signature", () => {
    expect(checkGlb(glb(validJson, { magic: 0x12345678 }))).toEqual([
      expect.stringContaining("signature"),
    ]);
  });

  it("rejects container version 1", () => {
    expect(checkGlb(glb(validJson, { version: 1 }))).toEqual([expect.stringContaining("version")]);
  });

  it("rejects a header length that does not match the file", () => {
    expect(checkGlb(glb(validJson, { lengthDelta: 4 }))).toEqual([expect.stringContaining("length")]);
  });

  it("rejects asset.version other than 2.x", () => {
    expect(checkGlb(glb({ asset: { version: "1.0" } }))).toEqual([
      expect.stringContaining("asset.version"),
    ]);
  });

  it("rejects a file shorter than the header", () => {
    expect(checkGlb(Buffer.from("glTF"))).toEqual([expect.stringContaining("header")]);
  });
});

describe("checkAssets", () => {
  it("passes when the folder does not exist", () => {
    expect(checkAssets(join(tempDir(), "missing"))).toEqual([]);
  });

  it("passes on an empty folder with a .gitkeep", () => {
    const dir = tempDir();
    writeFileSync(join(dir, ".gitkeep"), "");
    expect(checkAssets(dir)).toEqual([]);
  });

  it("checks .glb files in subfolders", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "buildings"));
    writeFileSync(join(dir, "buildings", "house.glb"), glb(validJson));
    writeFileSync(join(dir, "buildings", "broken.glb"), glb(validJson, { version: 1 }));
    expect(checkAssets(dir)).toEqual([expect.stringMatching(/^buildings\/broken\.glb: .*version/)]);
  });

  it("rejects model files that are not .glb", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "house.fbx"), "");
    writeFileSync(join(dir, "house.gltf"), "{}");
    expect(checkAssets(dir)).toEqual([
      expect.stringMatching(/^house\.fbx: /),
      expect.stringMatching(/^house\.gltf: /),
    ]);
  });
});

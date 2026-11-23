import { readFileSync, writeFileSync } from "node:fs";
import { cellKindExamples, footprintExamples } from "../packages/shared/src/rules-examples.ts";

const testFile = new URL("../supabase/tests/001_grid_examples.test.sql", import.meta.url);
const sql = [
  "-- Generated from packages/shared/src/rules-examples.ts.",
  "-- Regenerate with: node scripts/generate-db-grid-tests.ts",
  "begin;",
  "create extension if not exists pgtap with schema extensions;",
  "set local search_path = public, extensions;",
  `select plan(${footprintExamples.length + cellKindExamples.length});`,
  "",
  ...footprintExamples.map(
    ({ size, width, depth }) =>
      `select is(ARRAY[private.footprint('${size}'), private.footprint('${size}')], ARRAY[${width}, ${depth}], '${size} takes ${width} by ${depth} cells');`,
  ),
  "",
  ...cellKindExamples.map(
    ({ x, z, kind }) => `select is(private.cell_kind(${x}, ${z}), '${kind}', 'cell (${x}, ${z}) is ${kind}');`,
  ),
  "",
  "select * from finish();",
  "rollback;",
  "",
].join("\n");

if (process.argv.includes("--check")) {
  if (readFileSync(testFile, "utf8").replaceAll("\r\n", "\n") !== sql) {
    console.error("Grid tests are out of date. Run node scripts/generate-db-grid-tests.ts.");
    process.exitCode = 1;
  }
} else {
  writeFileSync(testFile, sql);
}

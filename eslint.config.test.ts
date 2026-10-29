// Proves the AGENTS.md invariants for packages/sim are enforced by the linter, not by memory.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: import.meta.dirname });

const errorsIn = async (filePath: string, code: string) => {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((message) => message.severity === 2);
};

const simFile = "packages/sim/src/probe.ts";

describe("packages/sim invariants", () => {
  it.each([
    ["Math.random()", "export const x = Math.random();"],
    ["Date.now()", "export const x = Date.now();"],
    ["performance.now()", "export const x = performance.now();"],
    ["new Date() without arguments", "export const x = new Date();"],
    ["Date() as a function", "export const x = Date();"],
    ["import from three", 'import * as THREE from "three";\nexport const x = THREE;'],
    ["import from three/addons", 'import { x } from "three/addons/x.js";\nexport { x };'],
    ["import from react", 'import { useState } from "react";\nexport const x = useState;'],
    ["import from react-dom", 'import { render } from "react-dom";\nexport const x = render;'],
    ["import from @react-three/fiber", 'import { Canvas } from "@react-three/fiber";\nexport const x = Canvas;'],
    ["import from @supabase/supabase-js", 'import { createClient } from "@supabase/supabase-js";\nexport const x = createClient;'],
    ["import from colyseus.js", 'import { Client } from "colyseus.js";\nexport const x = Client;'],
    ["import of a Node built-in", 'import { request } from "node:http";\nexport const x = request;'],
    ["import of a Node built-in without prefix", 'import { request } from "http";\nexport const x = request;'],
    ["document", "export const x = document.body;"],
    ["window", "export const x = window.innerWidth;"],
    ["fetch", 'export const x = fetch("/api");'],
    ["WebSocket", 'export const x = new WebSocket("ws://x");'],
    ["crypto", "export const x = crypto.getRandomValues(new Uint32Array(1));"],
  ])("rejects %s", async (_name, code) => {
    expect(await errorsIn(simFile, code)).not.toEqual([]);
  });

  it("accepts deterministic code with time passed as a parameter", async () => {
    const code = [
      "export const at = (timeMs: number): Date => new Date(timeMs);",
      "export const next = (seed: number): number => (seed * 1103515245 + 12345) % 2 ** 31;",
    ].join("\n");
    expect(await errorsIn(simFile, code)).toEqual([]);
  });

  it("applies only to packages/sim", async () => {
    expect(await errorsIn("apps/web/src/probe.ts", "export const x = Math.random();")).toEqual([]);
  });
});

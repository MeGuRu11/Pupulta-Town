import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";
import { builtinModules } from "node:module";

// AGENTS.md invariants for packages/sim: no 3D, no React, no DOM, no network,
// no randomness outside the city seed and no clock outside the time parameter.
const simInvariant = "packages/sim is pure TypeScript: see the invariants in AGENTS.md.";
const nodeBuiltin = `${simInvariant} Node built-ins are not available in the browser.`;

const simRules = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        { name: "three", message: simInvariant },
        { name: "react", message: simInvariant },
        { name: "react-dom", message: simInvariant },
        { name: "colyseus.js", message: simInvariant },
        ...builtinModules.map((name) => ({ name, message: nodeBuiltin })),
      ],
      patterns: [
        {
          group: ["three/*", "react/*", "react-dom/*", "@react-three/*", "@supabase/*", "@colyseus/*"],
          message: simInvariant,
        },
        { group: ["node:*"], message: nodeBuiltin },
      ],
    },
  ],
  "no-restricted-properties": [
    "error",
    { object: "Math", property: "random", message: "Use the generator seeded by the city." },
    { object: "Date", property: "now", message: "Take the time as a parameter." },
    { object: "performance", property: "now", message: "Take the time as a parameter." },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: "new Date() reads the clock. Take the time as a parameter.",
    },
    {
      selector: "CallExpression[callee.name='Date']",
      message: "Date() reads the clock. Take the time as a parameter.",
    },
  ],
  "no-restricted-globals": [
    "error",
    ...[
      "window",
      "document",
      "navigator",
      "location",
      "localStorage",
      "sessionStorage",
      "requestAnimationFrame",
      "fetch",
      "XMLHttpRequest",
      "WebSocket",
      "EventSource",
      "crypto",
      "process",
    ].map((name) => ({ name, message: simInvariant })),
  ],
};

export default defineConfig(
  globalIgnores(["**/dist/**", "playwright-report/**", "test-results/**"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs}", "*.config.ts", "scripts/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["packages/sim/**/*.ts"],
    rules: simRules,
  },
);

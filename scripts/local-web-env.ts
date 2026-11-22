import { execFileSync } from "node:child_process";

/** Only the local API address and the public browser key may reach Vite. */
export function readLocalWebEnvironment() {
  let status: { API_URL?: unknown; ANON_KEY?: unknown };
  try {
    const output = execFileSync("supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
      windowsHide: true,
    });
    status = JSON.parse(output);
  } catch {
    throw new Error("Start the local Supabase stack and make its CLI available in PATH.");
  }
  if (typeof status?.API_URL !== "string" || typeof status.ANON_KEY !== "string" || !status.ANON_KEY.trim()) {
    throw new Error("Local Supabase did not return its public browser configuration.");
  }
  const url = URL.parse(status.API_URL);
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Expected a loopback address for the local Supabase API.");
  }
  return { VITE_SUPABASE_URL: url.origin, VITE_SUPABASE_ANON_KEY: status.ANON_KEY };
}

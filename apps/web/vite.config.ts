import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readLocalWebEnvironment } from "../../scripts/local-web-env.ts";

export default defineConfig(({ command, mode, isPreview }) => {
  const plugins = [react()];
  if (command !== "serve" || isPreview || mode !== "development") return { plugins };
  const appDir = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, appDir, "VITE_");
  if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_ANON_KEY) return { plugins };
  try {
    const local = readLocalWebEnvironment();
    return { plugins, define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(local.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(local.VITE_SUPABASE_ANON_KEY),
    } };
  } catch {
    console.warn("Для локального входа запустите Supabase и перезапустите pnpm dev.");
    return { plugins };
  }
});

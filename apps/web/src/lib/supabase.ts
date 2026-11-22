import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";

interface PublicConfig {
  url: string;
  key: string;
}

export function readPublicConfig(environment: Record<string, unknown>): PublicConfig | null {
  const rawUrl = environment.VITE_SUPABASE_URL;
  const rawKey = environment.VITE_SUPABASE_ANON_KEY;
  if (typeof rawUrl !== "string" || typeof rawKey !== "string") return null;
  const url = rawUrl.trim();
  const key = rawKey.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  } catch {
    return null;
  }
  return { url, key };
}

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (client) return client;
  const config = readPublicConfig(import.meta.env);
  if (!config) return null;
  client = createClient<Database>(config.url, config.key);
  return client;
}

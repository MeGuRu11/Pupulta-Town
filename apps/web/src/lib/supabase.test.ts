import { describe, expect, it } from "vitest";
import { readPublicConfig } from "./supabase.ts";

describe("public Supabase configuration", () => {
  it("does not connect when either public variable is missing", () => {
    expect(readPublicConfig({})).toBeNull();
    expect(readPublicConfig({ VITE_SUPABASE_URL: "http://127.0.0.1:54321" })).toBeNull();
    expect(readPublicConfig({ VITE_SUPABASE_ANON_KEY: "public-test-key" })).toBeNull();
  });

  it("rejects malformed URLs and unsupported protocols", () => {
    for (const url of ["not-a-url", "file:///tmp/data", "javascript:alert(1)"]) {
      expect(readPublicConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: "public-test-key" })).toBeNull();
    }
  });

  it("accepts explicit public HTTP or HTTPS settings", () => {
    expect(readPublicConfig({
      VITE_SUPABASE_URL: " http://127.0.0.1:54321 ",
      VITE_SUPABASE_ANON_KEY: " public-test-key ",
    })).toEqual({ url: "http://127.0.0.1:54321", key: "public-test-key" });
  });
});

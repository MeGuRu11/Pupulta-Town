import { describe, expect, it } from "vitest";
import { parseTestOverrides } from "./clock.ts";

describe("explicit test clock and city seed", () => {
  it("ignores all URL overrides outside the enabled test mode", () => {
    expect(parseTestOverrides("?now=2026-11-08T12%3A00%3A00Z&seed=42", false)).toEqual({ nowMs: null, seed: null });
  });

  it("reads a fixed world time with an explicit timezone and a zero seed", () => {
    const now = "2026-11-08T15:00:00.123+03:00";
    expect(parseTestOverrides(`?now=${encodeURIComponent(now)}&seed=0`, true)).toEqual({
      nowMs: Date.parse("2026-11-08T12:00:00.123Z"),
      seed: 0,
    });
  });

  it("accepts the maximum city seed and a valid leap day", () => {
    expect(parseTestOverrides("?now=2028-02-29T00%3A00%3A00Z&seed=4294967295", true)).toEqual({
      nowMs: Date.parse("2028-02-29T00:00:00Z"),
      seed: 4294967295,
    });
  });

  it.each(["2026-02-30T00:00:00Z", "2026-11-08T24:00:00Z", "2026-11-08T12:60:00Z", "2026-11-08T12:00:60Z", "2026-11-08T12:00:00", "2026-11-08", "invalid", "2026-11-08T12:00:00+24:00"])(
    "rejects rolled-over or ambiguous time: %s",
    (now) => expect(parseTestOverrides(`?now=${encodeURIComponent(now)}&seed=23`, true)).toEqual({ nowMs: null, seed: 23 }),
  );

  it.each(["-1", "4294967296", "1.5", "1e2", "0xFF", "Infinity", "", "no"])(
    "rejects a seed outside the unsigned integer format: %s",
    (seed) => expect(parseTestOverrides(`?seed=${encodeURIComponent(seed)}`, true)).toEqual({ nowMs: null, seed: null }),
  );

  it("falls back independently for omitted overrides", () => {
    expect(parseTestOverrides("", true)).toEqual({ nowMs: null, seed: null });
    expect(parseTestOverrides("?now=2026-11-08T12%3A00%3A00Z", true)).toEqual({ nowMs: Date.parse("2026-11-08T12:00:00Z"), seed: null });
  });
});

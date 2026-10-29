import { describe, expect, it } from "vitest";
import { createRandom } from "./index.ts";

const take = (seed: number, count: number): number[] => {
  const next = createRandom(seed);
  return Array.from({ length: count }, () => next());
};

describe("createRandom", () => {
  it("gives the same sequence for the same seed", () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it("stays in [0, 1)", () => {
    for (const value of take(7, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("rejects a seed that is not an integer", () => {
    expect(() => createRandom(1.5)).toThrow(RangeError);
  });
});

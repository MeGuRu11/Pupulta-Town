// Seeded pseudo-random generator: the only source of randomness in the simulation.

/**
 * Mulberry32: a small 32-bit generator, good enough for placing residents.
 * Seeds that differ by a multiple of 2^32 give the same sequence.
 */
export const createRandom = (seed: number): (() => number) => {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`Seed must be an integer, got ${seed}`);
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
};

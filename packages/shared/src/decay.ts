// Building decay from an overdue team task (decision 0008). The stage is never stored:
// it is computed from the due date and the current time.
import type { DecayStage } from "./types.ts";

/** Each stage starts on this calendar day of the delay. */
export const DECAY_STAGES: ReadonlyArray<{ stage: Exclude<DecayStage, "none">; fromDay: number }> = [
  { stage: "dirt", fromDay: 1 },
  { stage: "graffiti", fromDay: 3 },
  { stage: "defect", fromDay: 7 },
  { stage: "repair", fromDay: 14 },
  { stage: "fire", fromDay: 21 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = (timeMs: number): number => Math.floor(timeMs / DAY_MS);

const parseDueOn = (dueOn: string): number => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueOn);
  const timeMs = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  // Date.UTC rolls 2026-02-30 over to March; reject it instead.
  if (Number.isNaN(timeMs) || new Date(timeMs).toISOString().slice(0, 10) !== dueOn) {
    throw new RangeError(`Due date must be a valid YYYY-MM-DD date, got "${dueOn}"`);
  }
  return utcDay(timeMs);
};

/**
 * @param dueOn last day of the task, `YYYY-MM-DD`; the delay starts the next day
 * @param nowMs current time, Unix milliseconds
 * @param closedAtMs when the task was closed, or null if it is open
 *
 * Calendar days are counted in UTC: the city has no time zone yet.
 */
export const decayStage = (dueOn: string, nowMs: number, closedAtMs: number | null): DecayStage => {
  const dueDay = parseDueOn(dueOn);
  if (closedAtMs !== null && closedAtMs <= nowMs) return "none";
  const daysLate = utcDay(nowMs) - dueDay;
  let current: DecayStage = "none";
  for (const { stage, fromDay } of DECAY_STAGES) {
    if (daysLate >= fromDay) current = stage;
  }
  return current;
};

import { describe, expect, it } from "vitest";
import { DECAY_DAY_UTC_OFFSET_MINUTES, DECAY_STAGES, decayStage } from "./index.ts";

// Times below are Moscow local time: decay days change at midnight in Moscow.
const at = (local: string): number => Date.parse(`${local}+03:00`);

describe("decayStage", () => {
  const due = "2026-11-10";

  it("has no decay before the due date and on the due day", () => {
    expect(decayStage(due, at("2026-11-01T12:00:00"), null)).toBe("none");
    expect(decayStage(due, at("2026-11-10T00:00:00"), null)).toBe("none");
    expect(decayStage(due, at("2026-11-10T23:59:59.999"), null)).toBe("none");
  });

  it.each([
    ["2026-11-11T00:00:00", "dirt"],
    ["2026-11-12T23:59:59", "dirt"],
    ["2026-11-13T00:00:00", "graffiti"],
    ["2026-11-16T23:59:59", "graffiti"],
    ["2026-11-17T00:00:00", "defect"],
    ["2026-11-23T23:59:59", "defect"],
    ["2026-11-24T00:00:00", "repair"],
    ["2026-11-30T23:59:59", "repair"],
    ["2026-12-01T00:00:00", "fire"],
    ["2027-06-01T00:00:00", "fire"],
  ])("at %s is %s", (now, stage) => {
    expect(decayStage(due, at(now), null)).toBe(stage);
  });

  it("starts the stages on days 1, 3, 7, 14 and 21 of the delay", () => {
    expect(DECAY_STAGES.map(({ fromDay }) => fromDay)).toEqual([1, 3, 7, 14, 21]);
  });

  it("has no decay once the task is closed, however late", () => {
    expect(decayStage(due, at("2026-12-20T00:00:00"), at("2026-12-19T10:00:00"))).toBe("none");
  });

  it("ignores a closing time that is still in the future", () => {
    expect(decayStage(due, at("2026-11-11T08:00:00"), at("2026-11-12T08:00:00"))).toBe("dirt");
  });

  it("counts calendar days across a month boundary", () => {
    expect(decayStage("2026-10-31", at("2026-11-01T00:00:00"), null)).toBe("dirt");
    expect(decayStage("2026-10-31", at("2026-10-31T23:59:59"), null)).toBe("none");
  });

  it("changes the day at midnight in Moscow (UTC+3), not at midnight UTC", () => {
    expect(DECAY_DAY_UTC_OFFSET_MINUTES).toBe(180);
    // 21:00 UTC on the due day is already 00:00 the next day in Moscow.
    expect(decayStage(due, Date.parse("2026-11-10T20:59:59.999Z"), null)).toBe("none");
    expect(decayStage(due, Date.parse("2026-11-10T21:00:00Z"), null)).toBe("dirt");
  });

  it("rejects a due date that is not YYYY-MM-DD", () => {
    expect(() => decayStage("2026-11-10T00:00:00Z", 0, null)).toThrow(RangeError);
    expect(() => decayStage("2026-02-30", 0, null)).toThrow(RangeError);
  });
});

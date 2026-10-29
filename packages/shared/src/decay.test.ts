import { describe, expect, it } from "vitest";
import { DECAY_STAGES, decayStage } from "./index.ts";

const at = (iso: string): number => Date.parse(iso);

describe("decayStage", () => {
  const due = "2026-11-10";

  it("has no decay before the due date and on the due day", () => {
    expect(decayStage(due, at("2026-11-01T12:00:00Z"), null)).toBe("none");
    expect(decayStage(due, at("2026-11-10T00:00:00Z"), null)).toBe("none");
    expect(decayStage(due, at("2026-11-10T23:59:59.999Z"), null)).toBe("none");
  });

  it.each([
    ["2026-11-11T00:00:00Z", "dirt"],
    ["2026-11-12T23:59:59Z", "dirt"],
    ["2026-11-13T00:00:00Z", "graffiti"],
    ["2026-11-16T23:59:59Z", "graffiti"],
    ["2026-11-17T00:00:00Z", "defect"],
    ["2026-11-23T23:59:59Z", "defect"],
    ["2026-11-24T00:00:00Z", "repair"],
    ["2026-11-30T23:59:59Z", "repair"],
    ["2026-12-01T00:00:00Z", "fire"],
    ["2027-06-01T00:00:00Z", "fire"],
  ])("at %s is %s", (now, stage) => {
    expect(decayStage(due, at(now), null)).toBe(stage);
  });

  it("starts the stages on days 1, 3, 7, 14 and 21 of the delay", () => {
    expect(DECAY_STAGES.map(({ fromDay }) => fromDay)).toEqual([1, 3, 7, 14, 21]);
  });

  it("has no decay once the task is closed, however late", () => {
    expect(decayStage(due, at("2026-12-20T00:00:00Z"), at("2026-12-19T10:00:00Z"))).toBe("none");
  });

  it("ignores a closing time that is still in the future", () => {
    expect(decayStage(due, at("2026-11-11T08:00:00Z"), at("2026-11-12T08:00:00Z"))).toBe("dirt");
  });

  it("counts calendar days in UTC across a month boundary", () => {
    expect(decayStage("2026-10-31", at("2026-11-01T00:00:00Z"), null)).toBe("dirt");
    expect(decayStage("2026-10-31", at("2026-10-31T23:59:59Z"), null)).toBe("none");
  });

  it("rejects a due date that is not YYYY-MM-DD", () => {
    expect(() => decayStage("2026-11-10T00:00:00Z", 0, null)).toThrow(RangeError);
    expect(() => decayStage("2026-02-30", 0, null)).toThrow(RangeError);
  });
});

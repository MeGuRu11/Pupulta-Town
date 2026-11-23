import { describe, expect, it } from "vitest";
import type { CityData, CityObject, TeamTask } from "../tracker/types.ts";
import { makeSceneLots, sceneBlocks, sceneDecayTime, sceneOrigin } from "./model.ts";

const now = Date.parse("2026-11-23T09:00:00Z");

function task(overrides: Partial<TeamTask> = {}): TeamTask {
  return {
    id: "task", city_id: "city", title: "Почта", description: "", due_on: "2026-11-16",
    size: "S", status: "todo", closed_at: null, ...overrides,
  };
}

function object(overrides: Partial<CityObject> = {}): CityObject {
  return {
    id: "lot", task_id: "task", city_id: "city", size: "S",
    cell_x: 4, cell_z: 4, rotation: 0, stage: "foundation", ...overrides,
  };
}

function lots(objects: CityObject[], tasks: TeamTask[], time = now) {
  const data: CityData = { objects, tasks, profiles: [], assignments: [], members: [] };
  return makeSceneLots(data, time);
}

describe("city objects shown on the scene", () => {
  it("places the S foundation at the centre of the allocated cell", () => {
    expect(lots([object()], [task()])).toEqual([{
      id: "lot", taskId: "task", title: "Почта", size: "S", stage: "foundation", decay: "defect",
      x: 9, z: 9, width: 2, depth: 2, rotation: 0,
    }]);
  });

  it("uses the database stage, footprint and rotation of an M object", () => {
    const scene = lots([object({ cell_x: 12, cell_z: 5, size: "M", rotation: 270, stage: "construction" })],
      [task({ size: "M", status: "in_progress" })]);
    expect(scene[0]).toMatchObject({ stage: "construction", x: 28, z: 14, width: 8, depth: 8, rotation: 3 * Math.PI / 2 });
    expect(sceneBlocks(scene)).toBe(1);
  });

  it("joins objects by task identity and skips rows missing from an asynchronous snapshot", () => {
    const scene = lots([
      object({ id: "missing", task_id: "absent" }), object(), object({ id: "other-city", city_id: "neighbour" }),
    ], [task({ id: "other", title: "Парк" }), task()]);
    expect(scene.map(({ id, title }) => [id, title])).toEqual([["lot", "Почта"]]);
  });

  it("uses Moscow midnight to show overdue damage and clears it after the task closes", () => {
    const due = task({ due_on: "2026-11-22" });
    expect(lots([object()], [due], Date.parse("2026-11-22T20:59:59Z"))[0]?.decay).toBe("none");
    expect(lots([object()], [due], Date.parse("2026-11-22T21:00:00Z"))[0]?.decay).toBe("dirt");
    expect(lots([object({ stage: "complete" })], [task({ status: "done", closed_at: "2026-11-23T08:59:00Z" })])[0])
      .toMatchObject({ stage: "complete", decay: "none" });
  });
});

describe("camera and street bounds", () => {
  it("starts an empty scene at the first block", () => {
    expect(sceneOrigin([])).toEqual({ x: 0, z: 0 });
    expect(sceneBlocks([])).toBe(1);
  });

  it("frames a single occupied block even at a large signed database coordinate", () => {
    const scene = lots([object({ cell_x: 1600000004, cell_z: -1599999996 })], [task()]);
    expect(sceneOrigin(scene)).toEqual({ x: 3200000000, z: -3200000000 });
    expect(sceneBlocks(scene)).toBe(1);
  });

  it("fits occupied blocks on both sides of zero, including the far footprint edge", () => {
    const scene = lots([object({ cell_x: -12, cell_z: 4 }), object({ id: "house", task_id: "house-task",
      cell_x: 44, cell_z: 28, size: "M" })], [task(), task({ id: "house-task", size: "M" })]);
    expect(sceneOrigin(scene)).toEqual({ x: -32, z: 0 });
    expect(sceneBlocks(scene)).toBe(4);
  });
});

describe("scene clock for building decay", () => {
  const midnight = Date.parse("2026-11-22T21:00:00Z");
  const closed = "2026-11-23T10:15:00.123Z";
  const closeTime = Date.parse(closed);
  const tasks = [task({ closed_at: closed, due_on: "2026-11-22" })];

  it("reuses one timestamp between world clock ticks until Moscow midnight or a task closes", () => {
    expect(sceneDecayTime(tasks, midnight - 1)).toBeLessThan(midnight);
    expect(sceneDecayTime(tasks, midnight)).toBe(midnight);
    expect(sceneDecayTime(tasks, closeTime - 1)).toBe(midnight);
    expect(sceneDecayTime(tasks, closeTime)).toBe(closeTime);
    expect(sceneDecayTime(tasks, closeTime + 60_000)).toBe(closeTime);
  });

  it("matches the full clock for open, closed and future-closed tasks even when viewing past time", () => {
    const rows = [
      task({ id: "later", closed_at: "2026-11-23T12:00:00Z" }),
      task({ id: "open", due_on: "2026-11-22" }),
      ...tasks,
      task({ id: "past", closed_at: "2026-11-20T12:00:00Z" }),
    ];
    const objects = rows.map(row => object({ id: row.id, task_id: row.id }));
    for (const clock of [closeTime + 86400000, closeTime, closeTime - 1, midnight, midnight - 1]) {
      expect(lots(objects, rows, sceneDecayTime(rows, clock))).toEqual(lots(objects, rows, clock));
    }
  });
});

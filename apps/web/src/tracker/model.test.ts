import { describe, expect, it } from "vitest";
import {
  canChangeStatus,
  canManageTasks,
  errorMessage,
  filterTasks,
  getTaskDecay,
  parseInviteToken,
  validateTaskDraft,
} from "./model.ts";
import type { TaskAssignee, TaskDraft, TeamTask } from "./types.ts";

const draft: TaskDraft = {
  city_id: "city-a",
  title: "Построить библиотеку",
  description: "Место для книг",
  size: "M",
  due_on: "2026-11-10",
  assignee_ids: [],
};

const makeTask = (id: string, status: TeamTask["status"] = "todo"): TeamTask => ({
  id,
  city_id: "city-a",
  title: id,
  description: "",
  size: "S",
  due_on: "2026-11-10",
  status,
  closed_at: status === "done" ? "2026-11-11T12:00:00Z" : null,
});

const assignments: TaskAssignee[] = [
  { city_id: "city-a", task_id: "one", user_id: "alice" },
  { city_id: "city-a", task_id: "two", user_id: "boris" },
  { city_id: "city-a", task_id: "three", user_id: "alice" },
];

describe("city invitations", () => {
  const token = "8bbdf12c-0faf-4643-912c-d81a7ca923b7";

  it("accepts the copied code and the link produced by the tracker", () => {
    expect(parseInviteToken(`  ${token}  `)).toBe(token);
    expect(parseInviteToken(`http://localhost:5173/?invite=${token}`)).toBe(token);
  });

  it("rejects malformed codes, a missing invitation and unrelated URL schemes", () => {
    expect(parseInviteToken("not-a-code")).toBeNull();
    expect(parseInviteToken(`https://example.com/?user=${token}`)).toBeNull();
    expect(parseInviteToken(`file:///tmp/invitation?invite=${token}`)).toBeNull();
  });
});

describe("task form validation", () => {
  it("allows a valid overdue task without changing the draft", () => {
    const overdue = { ...draft, due_on: "2020-02-29", title: "  Дорожка  " };
    expect(validateTaskDraft(overdue)).toBeNull();
    expect(overdue.title).toBe("  Дорожка  ");
  });

  it("does not accept an empty or whitespace-only title", () => {
    expect(validateTaskDraft({ ...draft, title: "" })).not.toBeNull();
    expect(validateTaskDraft({ ...draft, title: " \n\t " })).not.toBeNull();
  });

  it.each(["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-11-00", "2026-1-02", "2026-11-10T00:00:00Z", "0099-12-31"])(
    "rejects a due date the database cannot accept: %s",
    (due_on) => expect(validateTaskDraft({ ...draft, due_on })).not.toBeNull(),
  );

  it("accepts the date range shared by the database and decay calculation", () => {
    expect(validateTaskDraft({ ...draft, due_on: "0100-01-01" })).toBeNull();
    expect(validateTaskDraft({ ...draft, due_on: "9999-12-31" })).toBeNull();
  });

  it("rejects unsupported task sizes even when supplied outside TypeScript", () => {
    const unsupported = { ...draft, size: "L" } as unknown as TaskDraft;
    expect(validateTaskDraft(unsupported)).not.toBeNull();
  });
});

describe("actions for city roles", () => {
  it("offers task creation only to the leader", () => {
    expect(canManageTasks("leader")).toBe(true);
    expect(canManageTasks("member")).toBe(false);
    expect(canManageTasks("guest")).toBe(false);
    expect(canManageTasks(undefined)).toBe(false);
  });

  it("allows the leader to change an unassigned task", () => {
    expect(canChangeStatus("leader", "leader", "unassigned", assignments)).toBe(true);
  });

  it("allows a member only on their own assignment", () => {
    expect(canChangeStatus("member", "alice", "one", assignments)).toBe(true);
    expect(canChangeStatus("member", "alice", "two", assignments)).toBe(false);
    expect(canChangeStatus("member", "alice", "unassigned", assignments)).toBe(false);
  });

  it("does not grant a guest permissions from an assignment alone", () => {
    expect(canChangeStatus("guest", "alice", "one", assignments)).toBe(false);
    expect(canChangeStatus(null, "alice", "one", assignments)).toBe(false);
  });
});

describe("task filters", () => {
  const tasks = [makeTask("one"), makeTask("two", "in_progress"), makeTask("three", "done"), makeTask("unassigned")];

  it("combines a user's assignments with the status filter and preserves list order", () => {
    expect(filterTasks(tasks, assignments, "alice", "mine", "all").map((task) => task.id)).toEqual(["one", "three"]);
    expect(filterTasks(tasks, assignments, "alice", "mine", "done").map((task) => task.id)).toEqual(["three"]);
    expect(filterTasks(tasks, assignments, "alice", "mine", "in_progress")).toEqual([]);
  });

  it("includes unassigned and other people's tasks in all tasks", () => {
    expect(filterTasks(tasks, assignments, "alice", "all", "todo").map((task) => task.id)).toEqual(["one", "unassigned"]);
    expect(filterTasks(tasks, assignments, "nobody", "mine", "all")).toEqual([]);
    expect(tasks.map((task) => task.id)).toEqual(["one", "two", "three", "unassigned"]);
  });
});

describe("task decay in the shared world clock", () => {
  it("uses Moscow midnight and the shared thresholds", () => {
    const task = makeTask("one");
    expect(getTaskDecay(task, Date.parse("2026-11-10T20:59:59.999Z"))).toBe("none");
    expect(getTaskDecay(task, Date.parse("2026-11-10T21:00:00Z"))).toBe("dirt");
    expect(getTaskDecay(task, Date.parse("2026-11-12T21:00:00Z"))).toBe("graffiti");
  });

  it("removes decay after closure but permits deterministic inspection before closure", () => {
    const task = makeTask("three", "done");
    expect(getTaskDecay(task, Date.parse("2026-11-11T10:00:00Z"))).toBe("dirt");
    expect(getTaskDecay(task, Date.parse("2026-12-01T00:00:00Z"))).toBe("none");
  });
});

describe("user-facing errors", () => {
  it("explains common authentication and invitation failures", () => {
    expect(errorMessage(new Error("Invalid login credentials"))).toContain("пароль");
    expect(errorMessage({ message: "Invalid city invitation", code: "22023" })).toContain("приглашение");
    expect(errorMessage(new Error("City already has 20 participants"))).toContain("20");
  });

  it("does not render arbitrary error payloads or internal response details", () => {
    expect(errorMessage({ detail: "private-data" })).not.toContain("private-data");
    expect(errorMessage(new Error("Unexpected database response: private-data"))).not.toContain("private-data");
    expect(errorMessage(null)).not.toBe("");
  });
});

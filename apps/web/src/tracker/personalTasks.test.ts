import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../lib/database.types.ts";
import { createPersonalTask, listPersonalTasks, setPersonalTaskStatus } from "./personalTasks.ts";

const owner = "00000000-0000-4000-8000-000000000001";
const task = {
  id: "00000000-0000-4000-8000-000000000010", owner_id: owner,
  title: "Выбрать книгу", status: "todo", created_at: "2026-11-23T12:00:00+00:00",
};

function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = createClient<Database>("http://localhost:54321", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  return { fetch, client };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("personal task requests", () => {
  it("continues past a server-capped page from its last timestamp and id", async () => {
    const { client, fetch } = setup();
    const next = { ...task, id: "00000000-0000-4000-8000-000000000011" };
    fetch.mockResolvedValueOnce(json([task], 200, { "Content-Range": "0-0/2" }))
      .mockResolvedValueOnce(json([next], 200, { "Content-Range": "0-0/1" }));
    expect(await listPersonalTasks(client, owner)).toEqual([task, next]);
    const [first, second] = fetch.mock.calls.map(([input]) => new URL(String(input)));
    for (const url of [first!, second!]) {
      expect(url.pathname).toBe("/rest/v1/personal_tasks");
      expect(url.searchParams.get("owner_id")).toBe("eq." + owner);
      expect(url.searchParams.get("order")).toBe("created_at.desc,id.asc");
    }
    // A newly created task ahead of this cursor cannot shift the next page.
    const cursor = second!.searchParams.get("or")?.replaceAll('"', "");
    expect(cursor).toBe(`(created_at.lt.${task.created_at},and(created_at.eq.${task.created_at},id.gt.${task.id}))`);
  });

  it("recovers a previously committed create by its stable id without resetting its status", async () => {
    const { client, fetch } = setup();
    const existing = { ...task, status: "done" };
    fetch.mockResolvedValueOnce(json({ code: "23505", message: "duplicate key" }, 409))
      .mockResolvedValueOnce(json(existing));
    expect(await createPersonalTask(client, owner, task.id, "  Выбрать книгу  ")).toEqual(existing);
    const [insert, lookup] = fetch.mock.calls;
    expect(JSON.parse(String(insert![1]?.body))).toEqual({ id: task.id, title: task.title });
    const query = new URL(String(lookup![0])).searchParams;
    expect(query.get("owner_id")).toBe("eq." + owner);
    expect(query.get("id")).toBe("eq." + task.id);
  });

  it("refuses to treat a different task sharing a create id as a successful retry", async () => {
    const { client, fetch } = setup();
    fetch.mockResolvedValueOnce(json({ code: "23505", message: "duplicate key" }, 409))
      .mockResolvedValueOnce(json(task));
    await expect(createPersonalTask(client, owner, task.id, "Купить чай")).rejects.toThrow();
  });

  it("rejects blank and oversized titles before writing", async () => {
    const { client, fetch } = setup();
    for (const title of [" \n\t ", "я".repeat(161)]) {
      await expect(createPersonalTask(client, owner, task.id, title)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires an updated row belonging to the active account", async () => {
    const { client, fetch } = setup();
    fetch.mockResolvedValueOnce(json({ code: "PGRST116", message: "No matching row" }, 406));
    await expect(setPersonalTaskStatus(client, owner, task.id, "done")).rejects.toThrow();
    const [input, init] = fetch.mock.calls[0]!;
    const query = new URL(String(input)).searchParams;
    expect([query.get("owner_id"), query.get("id")]).toEqual(["eq." + owner, "eq." + task.id]);
    expect(JSON.parse(String(init?.body))).toEqual({ status: "done" });
  });
});

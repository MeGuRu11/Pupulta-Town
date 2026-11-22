import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../lib/database.types.ts";
import { createTeamTask, getCityInvite, loadCities, loadCityData, setTaskStatus, subscribeCity } from "./api.ts";
import { errorMessage } from "./model.ts";

function clientWithResponse(body: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
  const client = createClient<Database>("http://localhost:54321", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  return { client, fetch };
}

describe("tracker API", () => {
  it("selects only publicly readable city columns, never the invitation token", async () => {
    const { client, fetch } = clientWithResponse([]);
    expect(await loadCities(client)).toEqual([]);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/rest/v1/cities");
    expect(url.searchParams.get("select")).toBe("id,name,seed,created_by,created_at");
  });

  it("loads the remaining visible cities when the server returns fewer rows than requested", async () => {
    const rows = [{ id: "city-a" }, { id: "city-b" }, { id: "city-c" }];
    const { client, fetch } = clientWithResponse([]);
    fetch.mockImplementation(async (input) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const page = rows.slice(offset, offset + 2);
      return new Response(JSON.stringify(page), {
        headers: { "Content-Type": "application/json", "Content-Range": `${offset}-${offset + page.length - 1}/3` },
      });
    });
    expect(await loadCities(client)).toEqual(rows);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("creates a task exclusively through the atomic database RPC", async () => {
    const { client, fetch } = clientWithResponse("task-id");
    expect(await createTeamTask(client, {
      city_id: "city-id", title: "Фонарь", description: "На перекрёстке", size: "S",
      due_on: "2026-11-10", assignee_ids: ["member-id"],
    })).toBe("task-id");
    const call = fetch.mock.calls[0];
    expect(new URL(String(call?.[0])).pathname).toBe("/rest/v1/rpc/create_team_task");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      p_city_id: "city-id", p_title: "Фонарь", p_description: "На перекрёстке",
      p_size: "S", p_due_on: "2026-11-10", p_assignee_ids: ["member-id"],
    });
  });

  it("explains that a city is no longer available when RLS hides its membership", async () => {
    const { client } = clientWithResponse([]);
    await expect(loadCityData(client, "city-id").catch(errorMessage)).resolves.toContain("Город недоступен");
  });

  it("changes status through RPC even when the RPC has no result body", async () => {
    const { client, fetch } = clientWithResponse(null);
    await expect(setTaskStatus(client, "task-id", "done")).resolves.toBeUndefined();
    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe("/rest/v1/rpc/set_task_status");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      p_task_id: "task-id", p_status: "done",
    });
  });

  it("propagates permission failure without leaking SQL details into the UI", async () => {
    const { client } = clientWithResponse({
      code: "42501", message: "permission denied for table cities", details: "internal SQL detail", hint: null,
    }, 403);
    await expect(getCityInvite(client, "city-id")).rejects.toThrow("Недостаточно прав");
    await expect(getCityInvite(client, "city-id")).rejects.not.toThrow("internal SQL detail");
  });
});

describe("city subscription", () => {
  it("can resubscribe to the same city while its previous channel is still leaving", () => {
    const channelNames = new Set<string>();
    const channel = { on() { return this; }, subscribe() { return this; } };
    const client = {
      channel(name: string) {
        if (channelNames.has(name)) throw new Error("Cannot rejoin an existing channel");
        channelNames.add(name);
        return channel;
      },
      removeChannel: vi.fn(() => new Promise(() => {})),
    } as unknown as SupabaseClient<Database>;
    const stop = subscribeCity(client, "same-city", vi.fn(), vi.fn());
    stop();
    const stopNext = subscribeCity(client, "same-city", vi.fn(), vi.fn());
    stopNext();
    expect(channelNames.size).toBe(2);
  });

  it("scopes events to the chosen city, refreshes after reconnect and ignores events after cleanup", () => {
    let statusCallback: (status: string) => void = () => undefined;
    const callbacks: (() => void)[] = [];
    const channel = {
      on: vi.fn((_event: string, _filter: unknown, callback: () => void) => {
        callbacks.push(callback);
        return channel;
      }),
      subscribe: vi.fn((callback: (status: string) => void) => {
        statusCallback = callback;
        return channel;
      }),
    };
    const removeChannel = vi.fn(async () => "ok");
    const client = { channel: vi.fn(() => channel), removeChannel } as unknown as SupabaseClient<Database>;
    const onChange = vi.fn();
    const onStatus = vi.fn();
    const stop = subscribeCity(client, "chosen-city", onChange, onStatus);
    expect(onStatus).toHaveBeenLastCalledWith("connecting");
    expect(channel.on.mock.calls.map((call) => call[1])).toEqual([
      { event: "*", schema: "public", table: "team_tasks", filter: "city_id=eq.chosen-city" },
      { event: "*", schema: "public", table: "city_objects", filter: "city_id=eq.chosen-city" },
    ]);
    statusCallback("SUBSCRIBED");
    expect(onStatus).toHaveBeenLastCalledWith("live");
    expect(onChange).toHaveBeenCalledTimes(1);
    statusCallback("CHANNEL_ERROR");
    expect(onStatus).toHaveBeenLastCalledWith("offline");
    statusCallback("SUBSCRIBED");
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
    callbacks[0]?.();
    statusCallback("CLOSED");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(removeChannel).toHaveBeenCalledWith(channel);
    expect(onStatus).toHaveBeenLastCalledWith("live");
  });
});

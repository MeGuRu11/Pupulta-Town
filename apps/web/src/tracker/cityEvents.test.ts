import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../lib/database.types.ts";
import { describeCityEvent, EVENT_PAGE_SIZE, loadCityEventPage, subscribeCityEvents, type CityEvent } from "./cityEvents.ts";

const city = "00000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-23T23:45:32.123456+00:00";
function event(index: number, changes: Partial<CityEvent> = {}): CityEvent {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    city_id: city, occurred_at: timestamp, kind: "foundation", actor_name: "Аня",
    task_title: "Почта", size: "M", previous_stage: null, repaired: false, ...changes,
  };
}

describe("city event history", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("fills a page across server caps and timestamp ties, even as new events arrive", async () => {
    const rows = Array.from({ length: EVENT_PAGE_SIZE + 1 }, (_, i) => event(EVENT_PAGE_SIZE + 1 - i));
    const fetch = vi.fn<typeof globalThis.fetch>(async input => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/rest/v1/city_events");
      expect(url.searchParams.get("city_id")).toBe("eq." + city);
      expect(url.searchParams.get("order")).toBe("occurred_at.desc,id.desc");
      const cursor = url.searchParams.get("or");
      let remaining = rows;
      if (cursor) {
        const id = cursor.match(/id\.lt\.([\da-f-]+)\)\)$/)?.[1];
        expect(cursor.replaceAll('"', "")).toBe(`(occurred_at.lt.${timestamp},and(occurred_at.eq.${timestamp},id.lt.${id}))`);
        remaining = rows.filter(row => row.id < id!);
      }
      const page = remaining.slice(0, Math.min(6, Number(url.searchParams.get("limit"))));
      return new Response(JSON.stringify(page), { headers: {
        "Content-Type": "application/json", "Content-Range": `0-${page.length - 1}/${remaining.length}`,
      } });
    });
    const client = createClient<Database>("http://localhost:54321", "test-public-key", {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
    });
    const first = await loadCityEventPage(client, city);
    expect(first).toEqual({ events: rows.slice(0, EVENT_PAGE_SIZE), hasMore: true });
    expect(fetch).toHaveBeenCalledTimes(4);
    rows.unshift(event(99));
    expect(await loadCityEventPage(client, city, first.events.at(-1)))
      .toEqual({ events: [event(1)], hasMore: false });
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("listens only for city inserts, refreshes when reconnected and retires the old channel", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    let notify: () => void = vi.fn();
    let status: (value: string) => void = vi.fn();
    const channel = {
      on: vi.fn((_name: string, _filter: unknown, callback: () => void) => { notify = callback; return channel; }),
      subscribe: vi.fn((callback: (value: string) => void) => { status = callback; return channel; }),
    };
    const open = vi.fn<(name: string) => typeof channel>().mockReturnValue(channel);
    const removeChannel = vi.fn(async () => "ok");
    const client = { channel: open, removeChannel } as unknown as SupabaseClient<Database>;
    const close = subscribeCityEvents(client, city, refresh);
    expect(channel.on.mock.calls.map(call => call.slice(0, 2))).toEqual([[
      "postgres_changes", { schema: "public", table: "city_events", event: "INSERT", filter: "city_id=eq." + city },
    ]]);
    status("SUBSCRIBED"); notify(); status("CHANNEL_ERROR"); status("SUBSCRIBED");
    expect(refresh).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(10_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    status("TIMED_OUT");
    vi.advanceTimersByTime(5_000);
    expect(refresh).toHaveBeenCalledTimes(4);
    close(); notify(); status("SUBSCRIBED");
    vi.advanceTimersByTime(10_000);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(removeChannel).toHaveBeenCalledWith(channel);
    subscribeCityEvents(client, city, refresh)();
    expect(new Set(open.mock.calls.map(call => call[0])).size).toBe(2);
  });
});

describe("event descriptions", () => {
  it("reports joining and new building stages without assuming the actor's gender", () => {
    expect(describeCityEvent(event(1, { kind: "joined", task_title: null, size: null }))).toBe("Вступление в город.");
    expect(describeCityEvent(event(1))).toBe("Задача «Почта» создана. Заложен фундамент дома.");
    expect(describeCityEvent(event(1, { kind: "construction", size: "S", previous_stage: "foundation" })))
      .toBe("Задача «Почта» в работе. Идёт строительство киоска.");
  });

  it("distinguishes a reopened task and a return to foundation from new construction", () => {
    expect(describeCityEvent(event(1, { kind: "construction", previous_stage: "complete" })))
      .toBe("Задача «Почта» снова в работе. Строительство дома возобновлено.");
    expect(describeCityEvent(event(1, { previous_stage: "construction" })))
      .toBe("Задача «Почта» возвращена к выполнению. На участке снова фундамент.");
  });

  it("combines closure, building and restoration into one description", () => {
    expect(describeCityEvent(event(1, { kind: "completed", previous_stage: "construction" })))
      .toBe("Задача «Почта» закрыта. Дом построен.");
    expect(describeCityEvent(event(1, { kind: "completed", previous_stage: "foundation", size: "S", repaired: true })))
      .toBe("Задача «Почта» закрыта. Киоск построен. Постройка восстановлена.");
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "../lib/database.types.ts";
import { requireData } from "./api.ts";

type Client = SupabaseClient<Database>;
export type CityEvent = Tables<"city_events">;
export const EVENT_PAGE_SIZE = 20;

export async function loadCityEventPage(client: Client, cityId: string, before?: CityEvent) {
  const rows: CityEvent[] = [];
  let cursor = before;
  while (rows.length <= EVENT_PAGE_SIZE) {
    const query = client.from("city_events").select("*", { count: "exact" }).eq("city_id", cityId)
      .order("occurred_at", { ascending: false }).order("id", { ascending: false })
      .limit(EVENT_PAGE_SIZE + 1 - rows.length);
    if (cursor) {
      // Keep the original Postgres timestamp (including microseconds) in both comparisons.
      const time = `"${cursor.occurred_at}"`;
      query.or(`occurred_at.lt.${time},and(occurred_at.eq.${time},id.lt.${cursor.id})`);
    }
    const result = await query;
    const part = requireData(result);
    rows.push(...part);
    if (part.length === 0 || (result.count !== null && part.length >= result.count)) break;
    cursor = part.at(-1);
  }
  return { events: rows.slice(0, EVENT_PAGE_SIZE), hasMore: rows.length > EVENT_PAGE_SIZE };
}

let subscriptionId = 0;

export function subscribeCityEvents(client: Client, cityId: string, onRefresh: () => void) {
  let active = true;
  const refresh = () => { if (active) onRefresh(); };
  // The history also works while the live connection is starting or reconnecting.
  let poll: ReturnType<typeof setInterval> | undefined = setInterval(refresh, 5000);
  const channel = client.channel(`city-events:${cityId}:${++subscriptionId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "city_events", filter: `city_id=eq.${cityId}`,
    }, refresh)
    .subscribe(status => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        clearInterval(poll);
        poll = undefined;
        refresh();
      } else {
        poll ??= setInterval(refresh, 5000);
      }
    });
  return () => {
    active = false;
    clearInterval(poll);
    void client.removeChannel(channel);
  };
}

export function describeCityEvent(event: CityEvent): string {
  if (event.kind === "joined") return "Вступление в город.";
  const task = `Задача «${event.task_title}»`;
  const building = event.size === "S" ? "киоска" : "дома";
  switch (event.kind) {
    case "foundation":
      return event.previous_stage === null
        ? `${task} создана. Заложен фундамент ${building}.`
        : `${task} возвращена к выполнению. На участке снова фундамент.`;
    case "construction":
      return event.previous_stage === "complete"
        ? `${task} снова в работе. Строительство ${building} возобновлено.`
        : `${task} в работе. Идёт строительство ${building}.`;
    case "completed": {
      const built = event.size === "S" ? "Киоск построен." : "Дом построен.";
      return `${task} закрыта. ${built}${event.repaired ? " Постройка восстановлена." : ""}`;
    }
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { errorMessage, TrackerError } from "./model.ts";
import type { City, CityData, ConnectionStatus, TaskDraft, TaskStatus } from "./types.ts";

type Client = SupabaseClient<Database>;
type QueryError = { code?: string; message: string };

export function requireData<T>(result: { data: T | null; error: QueryError | null }): T {
  if (result.error) throw new TrackerError(errorMessage(result.error));
  if (result.data === null) throw new TrackerError("Сервер не вернул ожидаемые данные. Попробуйте ещё раз.");
  return result.data;
}

// PostgREST may cap a response below the requested page size.
async function readRows<T>(fetchPage: (from: number, to: number) =>
  PromiseLike<{ data: T[] | null; error: QueryError | null; count: number | null }>): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (;;) {
    const result = await fetchPage(rows.length, rows.length + pageSize - 1);
    const page = requireData(result);
    rows.push(...page);
    if (page.length === 0 || (result.count === null ? page.length < pageSize : rows.length >= result.count)) return rows;
  }
}

export async function loadCities(client: Client): Promise<City[]> {
  return readRows((from, to) => client.from("cities")
    .select("id,name,seed,created_by,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id").range(from, to));
}

export async function loadCityData(client: Client, cityId: string): Promise<CityData> {
  const [tasks, memberProfiles, assignments, objects] = await Promise.all([
    readRows((from, to) => client.from("team_tasks").select("*", { count: "exact" }).eq("city_id", cityId)
      .order("due_on").order("id").range(from, to)),
    readRows((from, to) => client.from("city_members").select("*,profiles(id,display_name,avatar)", { count: "exact" })
      .eq("city_id", cityId).order("seat").range(from, to)),
    readRows((from, to) => client.from("task_assignees").select("*", { count: "exact" }).eq("city_id", cityId)
      .order("task_id").order("user_id").range(from, to)),
    readRows((from, to) => client.from("city_objects").select("*", { count: "exact" }).eq("city_id", cityId)
      .order("cell_z").order("cell_x").range(from, to)),
  ]);
  // RLS returns no rows if this account no longer has access to the city.
  if (memberProfiles.length === 0) throw new TrackerError("Город недоступен. Обновите список городов.");
  const members = memberProfiles.map(({ city_id, role, seat, user_id }) => ({ city_id, role, seat, user_id }));
  const profiles = memberProfiles.map((member) => member.profiles);
  return { tasks, members, assignments, objects, profiles };
}

export async function createCity(client: Client, name: string): Promise<string> {
  return requireData(await client.rpc("create_city", { p_name: name }));
}

export async function getCityInvite(client: Client, cityId: string): Promise<string> {
  return requireData(await client.rpc("get_city_invite", { p_city_id: cityId }));
}

export async function joinCity(client: Client, token: string): Promise<string> {
  return requireData(await client.rpc("join_city", { p_invite_token: token }));
}

export async function createTeamTask(client: Client, draft: TaskDraft): Promise<string> {
  return requireData(await client.rpc("create_team_task", {
    p_city_id: draft.city_id,
    p_title: draft.title,
    p_description: draft.description,
    p_size: draft.size,
    p_due_on: draft.due_on,
    p_assignee_ids: draft.assignee_ids,
  }));
}

export async function setTaskStatus(client: Client, taskId: string, status: TaskStatus): Promise<void> {
  const { error } = await client.rpc("set_task_status", { p_task_id: taskId, p_status: status });
  if (error) throw new TrackerError(errorMessage(error));
}

let nextSubscriptionId = 0;

export function subscribeCity(
  client: Client,
  cityId: string,
  onChange: () => void,
  onStatus: (status: ConnectionStatus) => void,
): () => void {
  let active = true;
  onStatus("connecting");
  const changed = () => { if (active) onChange(); };
  const channel = client.channel(`city:${cityId}:${++nextSubscriptionId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "team_tasks", filter: `city_id=eq.${cityId}`,
    }, changed)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "city_objects", filter: `city_id=eq.${cityId}`,
    }, changed)
    .subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        onStatus("live");
        // Also closes the fetch/subscribe race and refreshes after reconnecting.
        onChange();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        onStatus("offline");
      }
    });
  return () => {
    active = false;
    void client.removeChannel(channel);
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "../lib/database.types.ts";
import { requireData } from "./api.ts";
import { TrackerError } from "./model.ts";
import type { TaskStatus } from "./types.ts";

type Client = SupabaseClient<Database>;
export type PersonalTask = Tables<"personal_tasks">;

export async function listPersonalTasks(client: Client, userId: string): Promise<PersonalTask[]> {
  const tasks: PersonalTask[] = [];
  for (;;) {
    const query = client.from("personal_tasks").select("*", { count: "exact" })
      .eq("owner_id", userId).order("created_at", { ascending: false }).order("id").limit(1000);
    const last = tasks.at(-1);
    if (last) {
      // New tasks can appear ahead of the cursor while subsequent pages are being read.
      const timestamp = `"${last.created_at}"`;
      query.or(`created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.gt.${last.id})`);
    }
    const result = await query;
    const page = requireData(result);
    tasks.push(...page);
    if (!page.length || (result.count !== null && page.length >= result.count)) return tasks;
  }
}

export async function createPersonalTask(client: Client, userId: string, id: string, title: string): Promise<PersonalTask> {
  const name = title.trim();
  if (!name) throw new TrackerError("Введите название задачи.");
  if (Array.from(name).length > 160) throw new TrackerError("Сократите название до 160 символов.");
  const inserted = await client.from("personal_tasks").insert({ id, title: name }).select().single();
  if (inserted.error?.code !== "23505") return requireData(inserted);

  // A retry can follow a successful insert whose response never reached the client.
  const existing = requireData<PersonalTask>(await client.from("personal_tasks").select("*")
    .eq("owner_id", userId).eq("id", id).single());
  if (existing.title !== name) throw new TrackerError("Эта попытка сохранения относится к другой задаче.");
  return existing;
}

export async function setPersonalTaskStatus(client: Client, userId: string, id: string, status: TaskStatus): Promise<PersonalTask> {
  return requireData(await client.from("personal_tasks").update({ status })
    .eq("owner_id", userId).eq("id", id).select().single());
}

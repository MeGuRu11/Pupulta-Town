import type { Database } from "../lib/database.types.ts";

type Tables = Database["public"]["Tables"];

// The invitation column is intentionally not readable through table queries.
export type City = Omit<Tables["cities"]["Row"], "invite_token">;
export type CityMember = Tables["city_members"]["Row"];
export type TeamTask = Tables["team_tasks"]["Row"];
export type TaskAssignee = Tables["task_assignees"]["Row"];
export type CityObject = Tables["city_objects"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];

export interface CityData {
  tasks: TeamTask[];
  members: CityMember[];
  assignments: TaskAssignee[];
  objects: CityObject[];
  profiles: Profile[];
}

export interface TaskDraft {
  city_id: string;
  title: string;
  description: string;
  size: "S" | "M";
  due_on: string;
  assignee_ids: string[];
}

export type ConnectionStatus = "connecting" | "live" | "offline";

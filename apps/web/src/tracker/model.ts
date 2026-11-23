import { decayStage, type DecayStage, type Role } from "@pupulta/shared";
import { isCalendarDate } from "./clock.ts";
import type { TaskAssignee, TaskDraft, TaskStatus, TeamTask } from "./types.ts";

export function validateTaskDraft(draft: TaskDraft): string | null {
  if (!draft.title.trim()) return "Введите название задачи.";
  if (draft.size !== "S" && draft.size !== "M") return "Выберите размер S или M.";
  if (!isCalendarDate(draft.due_on) || draft.due_on < "0100-01-01") {
    return "Укажите действительную дату от 01.01.0100 до 31.12.9999.";
  }
  return null;
}

export function parseInviteToken(value: string): string | null {
  let token = value.trim();
  if (/^https?:\/\//i.test(token)) {
    try {
      token = new URL(token).searchParams.get("invite") ?? "";
    } catch {
      return null;
    }
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid.test(token) ? token : null;
}

type CurrentRole = Role | null | undefined;

export function canManageTasks(role: CurrentRole): boolean {
  return role === "leader";
}

export function canChangeStatus(
  role: CurrentRole,
  userId: string,
  taskId: string,
  assignments: readonly TaskAssignee[],
): boolean {
  return role === "leader" || (role === "member" && assignments.some(
    (entry) => entry.task_id === taskId && entry.user_id === userId,
  ));
}

export function filterTasks(
  tasks: readonly TeamTask[],
  assignments: readonly TaskAssignee[],
  userId: string,
  scope: "all" | "mine",
  status: "all" | TaskStatus,
): TeamTask[] {
  const assigned = scope === "mine"
    ? new Set(assignments.filter((entry) => entry.user_id === userId).map((entry) => entry.task_id))
    : null;
  return tasks.filter((task) => (status === "all" || task.status === status) && (!assigned || assigned.has(task.id)));
}

export function getTaskDecay(task: TeamTask, nowMs: number): DecayStage {
  return decayStage(task.due_on, nowMs, task.closed_at === null ? null : Date.parse(task.closed_at));
}

/** Messages intentionally written for users. Unknown SDK and database payloads stay private. */
export class TrackerError extends Error {}

const permissionDenied = "Недостаточно прав для этого действия.";
const invalidLogin = "Проверьте почту и пароль.";
const confirmEmail = "Подтвердите адрес почты, затем войдите снова.";
const emailTaken = "Этот адрес уже зарегистрирован. Войдите в аккаунт.";
const networkError = "Не удалось связаться с сервером. Проверьте подключение.";
const expiredSession = "Сессия истекла. Войдите снова.";
const knownCodes = new Map([
  ["42501", permissionDenied],
  ["PGRST301", expiredSession],
  ["PGRST302", expiredSession],
  ["invalid_credentials", invalidLogin],
  ["email_not_confirmed", confirmEmail],
  ["user_already_exists", emailTaken],
  ["email_exists", emailTaken],
  ["weak_password", "Выберите более надёжный пароль."],
  ["over_request_rate_limit", "Слишком много попыток. Попробуйте позже."],
  ["over_email_send_rate_limit", "Слишком много писем за короткое время. Попробуйте позже."],
]);
const knownMessages = new Map([
  ["Invalid login credentials", invalidLogin],
  ["Email not confirmed", confirmEmail],
  ["User already registered", emailTaken],
  ["Invalid city invitation", "Это приглашение недействительно. Проверьте ссылку."],
  ["City already has 20 participants", "В городе уже 20 участников. Свободных мест нет."],
  ["Assignees must be working members of the city", "Обновите список участников и выберите исполнителей заново."],
  ["Failed to fetch", networkError],
  ["TypeError: Failed to fetch", networkError],
  ["NetworkError when attempting to fetch resource.", networkError],
  ["Load failed", networkError],
]);

export function errorMessage(error: unknown): string {
  if (error instanceof TrackerError) return error.message;
  if (typeof error === "object" && error !== null) {
    const byCode = "code" in error && typeof error.code === "string" ? knownCodes.get(error.code) : undefined;
    if (byCode) return byCode;
    const byMessage = "message" in error && typeof error.message === "string" ? knownMessages.get(error.message) : undefined;
    if (byMessage) return byMessage;
  }
  return "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

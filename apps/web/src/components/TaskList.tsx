import { useState } from "react";
import { canChangeStatus, errorMessage, filterTasks, getTaskDecay } from "../tracker/model.ts";
import type { CityData, CityMember, CityObject, TaskStatus, TeamTask } from "../tracker/types.ts";
import { memberName } from "./TaskForm.tsx";
import { statuses, statusNames, TaskStatusSelect } from "./TaskStatusSelect.tsx";
import { HudIcon, type HudIconName } from "./HudIcon.tsx";

export const stageNames = { foundation: "Фундамент", construction: "Стройка", complete: "Готовый объект" } satisfies Record<CityObject["stage"], string>;
const stageIcons = { foundation: "objects", construction: "city", complete: "home" } satisfies Record<CityObject["stage"], HudIconName>;
export const decayNames = { none: "", dirt: "Грязь", graffiti: "Граффити", defect: "Дефект", repair: "Ремонт", fire: "Пожар" };

function displayDueOn(value: string) { return value.split("-").reverse().join("."); }

function TaskCard({ task, data, member, nowMs, onStatus }: {
  task: TeamTask; data: CityData; member: CityMember; nowMs: number;
  onStatus: (id: string, status: TaskStatus) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const canEdit = canChangeStatus(member.role, member.user_id, task.id, data.assignments);
  const assigned = data.assignments.filter((item) => item.task_id === task.id)
    .map((item) => memberName(data, item.user_id));
  const object = data.objects.find((item) => item.task_id === task.id);
  const decay = getTaskDecay(task, nowMs);
  async function change(value: TaskStatus) {
    if (pending || !canEdit) return;
    setPending(true);
    setError("");
    try { await onStatus(task.id, value); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setPending(false); }
  }
  return <article className="task-card" aria-label={task.title}>
    <div className="task-top"><h4>{task.title}</h4>
      {object && <span className={`stage-pill stage-${object.stage}`}><HudIcon name={stageIcons[object.stage]} />{task.size} · {stageNames[object.stage]}</span>}
    </div>
    {task.description && <p className="task-description">{task.description}</p>}
    <div className="task-meta">
      <span>До <time dateTime={task.due_on}>{displayDueOn(task.due_on)}</time></span>
      <span>{assigned.length ? assigned.join(", ") : "Без исполнителя"}</span>
      {decay !== "none" && <span className="decay-pill">Просрочена · {decayNames[decay]}</span>}
    </div>
    {canEdit ? <TaskStatusSelect title={task.title} status={task.status} disabled={pending}
      onChange={value => { void change(value); }} /> : <span className="task-status">{statusNames[task.status]}</span>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
  </article>;
}

export function TaskList({ data, member, nowMs, status, onFilter, onStatus }: {
  status: TaskStatus | "all"; onFilter: (status: TaskStatus | "all") => void;
  data: CityData; member: CityMember; nowMs: number; onStatus: (id: string, status: TaskStatus) => Promise<void>;
}) {
  const [scope, setScope] = useState<"mine" | "all">("all");
  const tasks = filterTasks(data.tasks, data.assignments, member.user_id, scope, status);
  return <section className="task-section" aria-labelledby="task-list-title">
    <div className="section-heading"><h3 id="task-list-title">Задачи города</h3><span className="count-pill">{tasks.length}</span></div>
    <div className="task-filters">
      <label>Показать<select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
        <option value="all">Все задачи</option><option value="mine">Назначенные мне</option>
      </select></label>
      <label>Статус<select value={status} onChange={(event) => onFilter(event.target.value as typeof status)}>
        <option value="all">Любой статус</option>
        {statuses.map((value) => <option key={value} value={value}>{statusNames[value]}</option>)}
      </select></label>
    </div>
    <div className="task-list">
      {tasks.map((task) => <TaskCard key={task.id} task={task} data={data} member={member} nowMs={nowMs} onStatus={onStatus} />)}
      {!tasks.length && <p className="empty-state">{data.tasks.length ? "Нет задач с выбранными фильтрами." : "В городе пока нет задач."}</p>}
    </div>
  </section>;
}

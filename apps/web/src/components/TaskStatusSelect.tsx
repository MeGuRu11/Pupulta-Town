import type { TaskStatus } from "../tracker/types.ts";

export const statusNames = {
  todo: "К выполнению", in_progress: "В работе", done: "Готово",
} satisfies Record<TaskStatus, string>;
export const statuses = ["todo", "in_progress", "done"] as const;

export function TaskStatusSelect({ title, status, disabled, onChange }: {
  title: string; status: TaskStatus; disabled: boolean; onChange: (value: TaskStatus) => void;
}) {
  return <label className="task-status">Статус
    <select aria-label={`Статус задачи ${title}`} value={status} disabled={disabled}
      onChange={(event) => onChange(event.target.value as TaskStatus)}>
      {statuses.map(value => <option key={value} value={value}>{statusNames[value]}</option>)}
    </select>
  </label>;
}

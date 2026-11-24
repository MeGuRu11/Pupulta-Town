import { useState, type FormEvent } from "react";
import type { CityData, TaskDraft } from "../tracker/types.ts";
import { errorMessage, validateTaskDraft } from "../tracker/model.ts";

export function memberName(data: CityData, userId: string) {
  const profile = data.profiles.find((entry) => entry.id === userId);
  const member = data.members.find((entry) => entry.user_id === userId);
  return profile?.display_name.trim() || (member ? `Участник №${member.seat}` : "Бывший участник");
}

export function TaskForm({ cityId, data, onCreate, onCreated }: {
  cityId: string; data: CityData; onCreate: (draft: TaskDraft) => Promise<void>;
  onCreated: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const draft: TaskDraft = {
      city_id: cityId,
      title: String(fields.get("title") ?? "").trim(),
      description: String(fields.get("description") ?? "").trim(),
      size: fields.get("size") === "M" ? "M" : "S",
      due_on: String(fields.get("due_on") ?? ""),
      assignee_ids: fields.getAll("assignee").map(String),
    };
    const invalid = validateTaskDraft(draft);
    if (invalid) { setError(invalid); return; }
    setError("");
    setPending(true);
    try {
      await onCreate(draft);
      form.reset();
      if (form.isConnected && !form.closest("[hidden]")) onCreated();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  return <form className="task-form" onSubmit={(event) => { void submit(event); }}>
    <fieldset className="form-grid" disabled={pending} aria-label="Параметры задачи">
      <label className="field-wide">Название задачи<input name="title" required placeholder="Например, нарисовать ларёк" /></label>
      <label className="field-wide">Описание<textarea name="description" rows={2} /></label>
      <label>Размер<select name="size" defaultValue="S"><option value="S">S · Малый объект</option><option value="M">M · Дом</option></select></label>
      <label>Срок<input type="date" name="due_on" min="0100-01-01" max="9999-12-31" required /></label>
      <fieldset className="field-wide check-list"><legend>Исполнители</legend>
        {data.members.filter((member) => member.role !== "guest").map((member) =>
          <label key={member.user_id}><input type="checkbox" name="assignee" value={member.user_id} />
            {memberName(data, member.user_id)}</label>)}
      </fieldset>
    </fieldset>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={pending}>{pending ? "Создаём…" : "Создать задачу"}</button>
  </form>;
}

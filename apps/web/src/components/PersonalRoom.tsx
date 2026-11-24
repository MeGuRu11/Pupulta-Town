import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { errorMessage } from "../tracker/model.ts";
import { createPersonalTask, listPersonalTasks, setPersonalTaskStatus, type PersonalTask } from "../tracker/personalTasks.ts";
import { TaskStatusSelect } from "./TaskStatusSelect.tsx";

export function PersonalRoom({ client, userId }: { client: SupabaseClient<Database>; userId: string }) {
  const [tasks, setTasks] = useState<PersonalTask[] | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const draft = useRef<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let active = true;
    void listPersonalTasks(client, userId)
      .then(rows => { if (active) setTasks(rows); })
      .catch((reason: unknown) => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [client, userId, loadAttempt]);

  function reload() {
    setTasks(null);
    setError("");
    setLoadAttempt(attempt => attempt + 1);
  }

  async function save(write: () => Promise<PersonalTask>) {
    if (saving || tasks === null) return false;
    setSaving(true);
    setError("");
    try {
      const saved = await write();
      setTasks(current => {
        if (!current) return current;
        return current.some(task => task.id === saved.id)
          ? current.map(task => task.id === saved.id ? saved : task)
          : [saved, ...current];
      });
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = title.trim();
    if (!name) { setError("Введите название задачи."); return; }
    // Keep the id after a lost response so a retry cannot create another copy.
    if (draft.current?.title !== name) draft.current = { id: crypto.randomUUID(), title: name };
    const { id } = draft.current;
    if (await save(() => createPersonalTask(client, userId, id, name))) {
      draft.current = null;
      setTitle("");
    }
  }

  return <section className="personal-room" aria-label="Личная комната">
    <header className="city-heading">
      <div>
        <p className="muted">Задачи без сроков. Их видите только вы.</p>
      </div>
      <button type="button" className="button button-quiet" onClick={reload}
        disabled={saving || (tasks === null && !error)}>Обновить</button>
    </header>
    <form className="task-form personal-task-form" onSubmit={event => { void create(event); }}>
      <label>Название личной задачи
        <input value={title} onChange={event => setTitle(event.target.value)}
          placeholder="Например, разобрать эскизы" required disabled={saving || tasks === null} />
      </label>
      <button className="button button-primary" disabled={saving || tasks === null}>Добавить задачу</button>
    </form>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <section className="task-section" aria-labelledby="personal-list-title">
      <div className="section-heading">
        <h3 id="personal-list-title">Мои задачи</h3>
        {tasks !== null && <span className="count-pill">{tasks.length}</span>}
      </div>
      {tasks === null ? (!error && <p className="muted" role="status">Загружаем задачи…</p>)
        : tasks.length === 0 ? <p className="empty-state">У вас пока нет личных задач.</p>
        : <div className="task-list">
          {tasks.map(task => <article key={task.id} className="task-card personal-task" aria-label={task.title}>
            <h4>{task.title}</h4>
            <TaskStatusSelect title={task.title} status={task.status} disabled={saving}
              onChange={status => { void save(() => setPersonalTaskStatus(client, userId, task.id, status)); }} />
          </article>)}
        </div>}
    </section>
  </section>;
}

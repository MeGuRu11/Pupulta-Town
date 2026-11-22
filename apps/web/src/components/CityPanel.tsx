import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCityData, useWorldClock } from "../hooks/useTracker.ts";
import type { Database } from "../lib/database.types.ts";
import { createTeamTask, getCityInvite, setTaskStatus } from "../tracker/api.ts";
import { canManageTasks, errorMessage } from "../tracker/model.ts";
import type { City, CityMember, ConnectionStatus } from "../tracker/types.ts";
import { memberName, TaskForm } from "./TaskForm.tsx";
import { TaskList } from "./TaskList.tsx";

type Client = SupabaseClient<Database>;

const roleNames: Record<CityMember["role"], string> = {
  leader: "Руководитель", member: "Исполнитель", guest: "Гость",
};
const connectionLabels: Record<ConnectionStatus, string> = {
  connecting: "Подключаем обновления…",
  live: "Обновляется в реальном времени",
  offline: "Связь прервана. Обновите данные вручную.",
};
const cityTime = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
});

function CityInvite({ client, cityId }: { client: Client; cityId: string }) {
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function showInvite() {
    if (link) { setLink(""); return; }
    setPending(true);
    setError("");
    try {
      const token = await getCityInvite(client, cityId);
      const url = new URL(window.location.pathname, window.location.origin);
      url.searchParams.set("invite", token);
      setLink(url.href);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  return <div className="city-invite">
    <button type="button" className="button button-secondary" disabled={pending}
      aria-expanded={Boolean(link)} onClick={() => { void showInvite(); }}>
      {pending ? "Получаем ссылку…" : link ? "Скрыть приглашение" : "Пригласить"}
    </button>
    {link && <label className="invite-panel">Ссылка-приглашение
      <input readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
    </label>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
  </div>;
}

export function CityPanel({ client, city, userId, onRefreshCities }: {
  client: Client; city: City; userId: string; onRefreshCities: () => Promise<void>;
}) {
  const { data, loading, connection, error, refresh } = useCityData(client, city.id);
  const { nowMs, seedOverride } = useWorldClock();
  const member = data?.members.find((item) => item.user_id === userId);
  const manager = canManageTasks(member?.role);
  const [refreshing, setRefreshing] = useState(false);
  async function refreshWorkspace() {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), onRefreshCities()]);
    } finally {
      setRefreshing(false);
    }
  }

  return <section className="city-panel" aria-labelledby="current-city-title">
    <div className="city-heading">
      <div>
        <h2 id="current-city-title">{city.name}</h2>
        {member && <p className="muted">{roleNames[member.role]}</p>}
      </div>
      <div className="city-actions">
        <button type="button" className="button button-quiet" disabled={refreshing} onClick={() => { void refreshWorkspace(); }}>
          {refreshing ? "Обновляем…" : "Обновить"}
        </button>
        {manager && <CityInvite client={client} cityId={city.id} />}
      </div>
    </div>
    <p className="connection" role="status">{connectionLabels[connection]}</p>
    {loading && <p className="notice" role="status">Загружаем задачи и участников…</p>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {data && member && <>
      <section className="city-overview" aria-labelledby="city-plot-title" data-seed={seedOverride ?? city.seed}>
        <h3 id="city-plot-title">Участок города</h3>
        <div className="city-stats">
          <p className="stat"><strong>{data.objects.length}</strong><br />Объекты</p>
          <p className="stat"><strong>{data.tasks.filter((task) => task.status === "done").length}</strong><br />Завершённые задачи</p>
          <p className="stat"><strong><time dateTime={new Date(nowMs).toISOString()}>{cityTime.format(nowMs)}</time></strong><br />Время города (МСК)</p>
        </div>
      </section>
      <details className="task-section">
        <summary>Участники города ({data.members.length})</summary>
        <ul>{data.members.map((item) => <li key={item.user_id}>
          {memberName(data, item.user_id)} · {roleNames[item.role]}
        </li>)}</ul>
      </details>
      <TaskList data={data} member={member} nowMs={nowMs} onStatus={async (id, status) => {
        await setTaskStatus(client, id, status);
        await refresh();
      }} />
      {manager && <TaskForm cityId={city.id} data={data} onCreate={async (draft) => {
        await createTeamTask(client, draft);
        await refresh();
      }} />}
    </>}
  </section>;
}

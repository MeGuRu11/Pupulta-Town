import { useCallback, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCityData, useWorldClock } from "../hooks/useTracker.ts";
import type { Database } from "../lib/database.types.ts";
import { createTeamTask, getCityInvite, setTaskStatus } from "../tracker/api.ts";
import { canManageTasks, errorMessage } from "../tracker/model.ts";
import type { City, CityMember, ConnectionStatus, TaskStatus } from "../tracker/types.ts";
import { memberName, TaskForm } from "./TaskForm.tsx";
import { TaskList } from "./TaskList.tsx";
import { CityScene, SceneIndex } from "../scene/CityScene.tsx";
import { CityEventFeed } from "./CityEventFeed.tsx";
import { GameDock, GameWindow, emptyCity, navigate, type Panel } from "./GameHud.tsx";
import { HudIcon } from "./HudIcon.tsx";
import { PersonalRoom } from "./PersonalRoom.tsx";

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

export function CityPanel({ client, city, userId, panel, citiesMenu, accountMenu, onRefreshCities }: {
  client: Client; city: City | undefined; userId: string; panel: Panel | null;
  citiesMenu: ReactNode; accountMenu: ReactNode; onRefreshCities: () => Promise<void>;
}) {
  const { data, loading, connection, error, refresh } = useCityData(client, city?.id);
  const { nowMs, seedOverride, fixedTime } = useWorldClock();
  const member = data?.members.find(item => item.user_id === userId);
  const manager = canManageTasks(member?.role);
  const [refreshing, setRefreshing] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskStatus | "all">("all");
  const seed = seedOverride ?? city?.seed ?? 0;
  const close = useCallback(() => {
    navigate("map");
    const selector = `button[data-panel="${panel}"]:not(:disabled)`;
    const trigger = opener.current?.dataset.panel === panel && opener.current.isConnected ? opener.current :
      document.querySelector<HTMLButtonElement>(`.game-dock ${selector}`) ?? document.querySelector<HTMLButtonElement>(selector);
    trigger?.focus({ preventScroll: true });
  }, [panel]);
  function open(next: Panel, trigger: HTMLButtonElement) {
    opener.current = trigger;
    if (panel === next) close();
    else {
      if (next === "tasks") setTaskFilter("all");
      navigate(next);
    }
  }

  async function refreshWorkspace() {
    setRefreshing(true);
    try { await Promise.all([refresh(), onRefreshCities()]); }
    finally { setRefreshing(false); }
  }

  function section() {
    if (panel === "cities") return citiesMenu;
    if (panel === "account") return accountMenu;
    if (panel === "personal") return <PersonalRoom client={client} userId={userId} />;
    if (!city) return <button className="button" onClick={() => navigate("cities")}>Выбрать город</button>;
    if (!data || !member) return <div>
      <p role="status">{error || (loading ? "Загружаем город…" : "Город недоступен.")}</p>
      {error && <button className="button" onClick={() => { void refreshWorkspace(); }}>Повторить загрузку</button>}</div>;
    switch (panel) {
      case "members": return <>
        <div className="city-actions"><button className="button button-quiet" disabled={refreshing}
          onClick={() => { void refreshWorkspace(); }}>Обновить</button>
          {manager && <CityInvite client={client} cityId={city.id} />}</div>
        <p className="hud-connection" role="status">{connectionLabels[connection]}</p>
        <ul className="hud-member-list">{data.members.map(item => <li key={item.user_id}>
          <strong>{memberName(data, item.user_id)}</strong><span>{roleNames[item.role]}</span></li>)}</ul>
      </>;
      case "events": return <CityEventFeed client={client} cityId={city.id} refreshKey={0} />;
      case "objects": return <SceneIndex data={data} nowMs={nowMs} />;
      case "tasks": return <TaskList data={data} member={member} nowMs={nowMs} status={taskFilter} onFilter={setTaskFilter} onStatus={async (id, status) => {
        await setTaskStatus(client, id, status); await refresh();
      }} />;
      case "create": return manager ? null : <p>Задачи создаёт руководитель города.</p>;
      default: return null;
    }
  }

  return <main className="game-workspace">
    <div className="game-world" data-seed={seed}>
      <CityScene data={data ?? emptyCity} seed={seed} nowMs={nowMs} fixedTime={fixedTime} />
    </div>
    <header className="game-top">
      <div className="hud-city"><HudIcon name="city" /><div><small>Пупульта Town</small>
        <h1>{city?.name ?? "Обзор города"}</h1></div></div>
      {city && data && <div className="hud-stats" role="group" aria-label="Показатели города">
        <button type="button" className="hud-stat" data-panel="objects" aria-label="Список построек" aria-haspopup="dialog"
          onClick={event => open("objects", event.currentTarget)}><HudIcon name="objects" /><strong>{data.objects.length}</strong><span>Постройки</span></button>
        <button type="button" className="hud-stat" data-panel="members" aria-label="Состав команды" aria-haspopup="dialog"
          onClick={event => open("members", event.currentTarget)}><HudIcon name="members" /><strong>{data.members.length}</strong><span>Участники</span></button>
        <button type="button" className="hud-stat" data-panel="tasks" aria-label="Завершённые задачи" aria-haspopup="dialog"
          onClick={event => { opener.current = event.currentTarget; setTaskFilter("done"); navigate("tasks"); }}>
          <HudIcon name="check" /><strong>{data.tasks.filter(task => task.status === "done").length}</strong><span>Завершено</span></button>
        <div className="hud-stat"><HudIcon name="clock" /><strong>{cityTime.format(nowMs)}</strong><span>МСК</span></div>
      </div>}
      <button type="button" className="hud-account" data-panel="account" aria-label="Аккаунт" aria-haspopup="dialog"
        aria-pressed={panel === "account"} title="Аккаунт" onClick={event => open("account", event.currentTarget)}><HudIcon name="account" /></button>
    </header>
    {city && error && !panel && <div className="hud-notice" role="alert">{error} <button onClick={() => { void refreshWorkspace(); }}>Обновить</button></div>}
    <GameWindow panel={panel} onClose={close} taskForm={manager && city && data ?
      <TaskForm cityId={city.id} data={data} onCreate={async draft => {
        await createTeamTask(client, draft);
        await refresh();
      }} onCreated={() => { setTaskFilter("all"); navigate("tasks"); }} /> : null}>
      {panel && section()}
    </GameWindow>
    <GameDock panel={panel} manager={manager} hasCity={!!city} onOpen={open} />
  </main>;
}

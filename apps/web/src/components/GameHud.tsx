import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { HudIcon } from "./HudIcon.tsx";
import type { CityData } from "../tracker/types.ts";

export const emptyCity: CityData = { tasks: [], objects: [], assignments: [], profiles: [], members: [] };
export const panelNames = {
  cities: "Города", tasks: "Задачи", events: "События", members: "Участники", objects: "Постройки",
  personal: "Личная комната", create: "Новая задача", account: "Аккаунт",
} as const;
export type Panel = keyof typeof panelNames;
const panelIcons = {
  cities: "city", tasks: "tasks", events: "events", members: "members", objects: "objects",
  personal: "personal", create: "add", account: "account",
} as const;
const sections = ["tasks", "events", "objects", "members", "cities", "personal", "create"] as const;

function readPanel(): Panel | "map" | null {
  const hash = window.location.hash.slice(1);
  if (hash === "map") return hash;
  return Object.hasOwn(panelNames, hash) ? hash as Panel : null;
}
function listen(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
export function usePanelRoute() { return useSyncExternalStore(listen, readPanel); }
export function navigate(panel: Panel | "map") { window.location.hash = panel; }

export function GameDock({ panel, hasCity, manager, onOpen }: {
  panel: Panel | null; hasCity: boolean; manager: boolean; onOpen: (next: Panel, trigger: HTMLButtonElement) => void;
}) {
  return <nav className="game-dock" aria-label="Меню города">
    <button type="button" className="hud-action" data-panel="map" aria-pressed={!panel}
      onClick={() => navigate("map")}><HudIcon name="compass" /><span>Карта</span></button>
    {sections.map(key => {
    if (key === "create" && !manager) return null;
    return <button type="button" key={key} data-panel={key} aria-pressed={panel === key}
      aria-haspopup="dialog" aria-controls={panel === key ? "game-window" : undefined}
      disabled={!hasCity && key !== "cities" && key !== "personal"}
      className={key === "create" ? "hud-action hud-action-primary" : "hud-action"}
      onClick={event => onOpen(key, event.currentTarget)}>
      <HudIcon name={panelIcons[key]} /><span>{panelNames[key]}</span>
    </button>;
  })}</nav>;
}

export function GameWindow({ panel, children, taskForm, onClose }: {
  panel: Panel | null; children: ReactNode; taskForm: ReactNode; onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (panel) close.current?.focus({ preventScroll: true }); }, [panel]);
  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, onClose]);
  return <section hidden={!panel} id="game-window" className="game-window" role="dialog" aria-labelledby="game-window-title">
    <div className="game-window-bar">{panel && <HudIcon name={panelIcons[panel]} />}<h2 id="game-window-title">{panel && panelNames[panel]}</h2>
      <button ref={close} type="button" aria-label="Закрыть окно" title="Закрыть (Esc)" className="hud-close" onClick={onClose}>
        <HudIcon name="close" /></button></div>
    {panel && !(panel === "create" && taskForm) && <div className="game-window-body" key={panel}>{children}</div>}
    {taskForm && <div className="game-window-body" hidden={panel !== "create"}>{taskForm}</div>}
  </section>;
}

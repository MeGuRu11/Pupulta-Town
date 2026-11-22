import { useRef, useState, type FormEvent } from "react";
import type { City } from "../tracker/types.ts";
import { errorMessage, parseInviteToken } from "../tracker/model.ts";

export function CitySidebar({ cities, selectedId, loading, error, invite, onSelect, onCreate, onJoin, onRefresh }: {
  cities: City[]; selectedId: string; loading: boolean; error: string; invite: string;
  onSelect: (id: string) => void; onCreate: (name: string) => Promise<void>;
  onJoin: (token: string) => Promise<void>; onRefresh: () => Promise<void>;
}) {
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [actionError, setActionError] = useState("");
  const [inviteValue, setInviteValue] = useState(invite);
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const collapsible = Boolean(selectedId) && !invite && !error;

  function closeMenu() {
    setExpanded(false);
    requestAnimationFrame(() => {
      if (toggle.current?.getClientRects().length) toggle.current.focus();
    });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!name.trim()) { setActionError("Укажите название города."); return; }
    setPending("create"); setActionError("");
    try { await onCreate(name.trim()); setName(""); closeMenu(); }
    catch (reason) { setActionError(errorMessage(reason)); }
    finally { setPending(null); }
  }
  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const token = parseInviteToken(inviteValue);
    if (!token) { setActionError("Вставьте код или ссылку-приглашение в город."); return; }
    setPending("join"); setActionError("");
    try { await onJoin(token); setInviteValue(""); closeMenu(); }
    catch (reason) { setActionError(errorMessage(reason)); }
    finally { setPending(null); }
  }

  return <aside className={`sidebar${collapsible ? " sidebar-collapsible" : ""}`} aria-label="Города">
    {collapsible && <button ref={toggle} type="button" className="city-menu-toggle"
      aria-expanded={expanded} aria-controls="city-menu" onClick={() => setExpanded(!expanded)}>
      Мои города<span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
    </button>}
    <div id="city-menu" className={`city-menu${expanded ? " is-expanded" : ""}`}>
      <div className="sidebar-heading"><span className="eyebrow">МОИ ГОРОДА</span><span className="count-pill">{cities.length}</span></div>
      <nav className="city-list" aria-label="Выбор города">
        {cities.map((city) => <button className={`city-choice ${selectedId === city.id ? "is-active" : ""}`} key={city.id} onClick={() => { onSelect(city.id); closeMenu(); }} aria-pressed={selectedId === city.id}>
          <span>{city.name}</span><span className="city-arrow" aria-hidden="true">↗</span>
        </button>)}
        {loading && <p className="small muted" role="status">Загружаем города…</p>}
        {error && <div><p className="notice notice-error" role="alert">{error}</p><button className="text-button" onClick={() => { void onRefresh(); }}>Повторить загрузку</button></div>}
      </nav>
      <div className="sidebar-divider" />
      <form className="compact-form" onSubmit={(event) => { void create(event); }}>
        <h2>Новый город</h2>
        <label>Название города<input value={name} onChange={(event) => { setName(event.target.value); }} placeholder="Например, Заречье" required disabled={pending !== null} /></label>
        <button className="button button-secondary button-wide" disabled={pending !== null}>{pending === "create" ? "Создаём…" : "Создать город"}<span aria-hidden="true">+</span></button>
      </form>
      <form className="compact-form join-form" onSubmit={(event) => { void join(event); }}>
        <h2>Войти по приглашению</h2>
        <label>Код приглашения<input value={inviteValue} onChange={(event) => { setInviteValue(event.target.value); }} placeholder="Код или ссылка" required disabled={pending !== null} /></label>
        <button className="button button-quiet button-wide" disabled={pending !== null}>{pending === "join" ? "Присоединяемся…" : "Присоединиться"}<span aria-hidden="true">↗</span></button>
      </form>
      {actionError && <p className="notice notice-error" role="alert">{actionError}</p>}
    </div>
  </aside>;
}

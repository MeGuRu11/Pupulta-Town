import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { describeCityEvent, loadCityEventPage, subscribeCityEvents, type CityEvent } from "../tracker/cityEvents.ts";
import { errorMessage } from "../tracker/model.ts";

const moscowTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow",
});

export function CityEventFeed({ client, cityId, refreshKey }: {
  client: SupabaseClient<Database>; cityId: string; refreshKey: number;
}) {
  const [rows, setRows] = useState<CityEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const actions = useRef({ refresh: () => {}, more: () => {} });

  useEffect(() => {
    let active = true, loading = false, refreshQueued = false;
    let pages = 1;
    let history: CityEvent[] = [];

    async function load(append: boolean) {
      if (!active) return;
      if (loading) {
        if (!append) refreshQueued = true;
        return;
      }
      loading = true;
      setBusy(true);
      setError("");
      // Read older events from the cursor. On reconnect, rebuild the visible window
      // from its head to include commits that arrived while the player was away.
      const next = append ? [...history] : [];
      try {
        let more = true;
        for (let n = 0; n < (append ? 1 : pages) && more; n++) {
          const page = await loadCityEventPage(client, cityId, next.at(-1));
          if (!active) return;
          next.push(...page.events);
          more = page.hasMore;
        }
        if (append) pages++;
        history = next;
        setRows(next);
        setHasMore(more);
      } catch (reason) {
        if (active) setError(errorMessage(reason));
      } finally {
        loading = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void load(false);
        } else if (active) {
          setBusy(false);
        }
      }
    }

    const refresh = () => { void load(false); };
    actions.current = { refresh, more: () => { void load(true); } };
    const unsubscribe = subscribeCityEvents(client, cityId, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [client, cityId]);

  useEffect(() => { actions.current.refresh(); }, [client, cityId, refreshKey]);

  return <section className="task-section city-feed" aria-labelledby="city-feed-title">
    <div className="section-heading"><h3 id="city-feed-title">Лента событий</h3>
      <span className="small muted">Время по Москве</span></div>
    {error && <div><p className="notice notice-error" role="alert">{error}</p>
      <button type="button" className="text-button" onClick={() => actions.current.refresh()}>Повторить загрузку ленты</button></div>}
    {!rows.length && !error && (busy
      ? <p className="small muted" role="status">Загружаем события…</p>
      : <p className="small muted">Событий пока нет.</p>)}
    {rows.length > 0 && <ol className="city-feed-list" aria-label="История города" tabIndex={0}>
      {rows.map(event => <li key={event.id}>
        <div><strong>{event.actor_name}</strong> <time dateTime={event.occurred_at}>
          {moscowTime.format(new Date(event.occurred_at))}</time></div>
        <p>{describeCityEvent(event)}</p>
      </li>)}
    </ol>}
    {hasMore && !error && <button type="button" className="text-button" disabled={busy}
      onClick={() => actions.current.more()}>Показать ещё</button>}
  </section>;
}

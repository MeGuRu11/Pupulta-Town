import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { loadCities, loadCityData, subscribeCity } from "../tracker/api.ts";
import { errorMessage } from "../tracker/model.ts";
import { parseTestOverrides } from "../tracker/clock.ts";
import type { City, CityData, ConnectionStatus } from "../tracker/types.ts";

type Client = SupabaseClient<Database>;

export function useAuthSession(client: Client | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;
    let active = true;
    let authVersion = 0;
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      // The SDK holds an auth lock while calling this callback. No SDK awaits here.
      authVersion += 1;
      if (active) {
        setSession(nextSession);
        setLoading(false);
        setError("");
      }
    });
    const initialVersion = authVersion;
    void client.auth.getSession().then(({ data: initial, error: sessionError }) => {
      if (!active || authVersion !== initialVersion) return;
      setSession(initial.session);
      setLoading(false);
      if (sessionError) setError(errorMessage(sessionError));
    }).catch((reason: unknown) => {
      if (active && authVersion === initialVersion) {
        setLoading(false);
        setError(errorMessage(reason));
      }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);

  return { session, loading, error };
}

export function useCities(client: Client) {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);

  const refresh = useCallback(async (preferredId?: string) => {
    const version = ++request.current;
    setLoading(true);
    setError("");
    try {
      const next = await loadCities(client);
      if (version !== request.current) return false;
      if (preferredId && !next.some(city => city.id === preferredId)) {
        setError("Город пока не найден в списке. Повторите загрузку.");
        return false;
      }
      setCities(next);
      setSelectedId((current) => {
        const preferred = preferredId ?? current;
        return next.some((city) => city.id === preferred) ? preferred : (next[0]?.id ?? "");
      });
      return true;
    } catch (reason) {
      if (version === request.current) setError(errorMessage(reason));
      return false;
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  return { cities, selectedId, select: setSelectedId, loading, error, refresh };
}

export function useCityData(client: Client, cityId: string | undefined) {
  const [data, setData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!cityId) return;
    let active = true;
    let request = 0;
    const refresh = async () => {
      const version = ++request;
      try {
        const next = await loadCityData(client, cityId);
        if (active && version === request) {
          setData(next);
          setError("");
        }
      } catch (reason) {
        if (active && version === request) {
          setData(null);
          setError(errorMessage(reason));
        }
      } finally {
        if (active && version === request) setLoading(false);
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const unsubscribe = subscribeCity(client, cityId, () => { void refresh(); }, (status) => {
      if (active) setConnection(status);
    });
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onOnline = () => { void refresh(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      request += 1;
      refreshRef.current = async () => {};
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [client, cityId]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { data, loading, error, connection, refresh };
}

export function useWorldClock() {
  const [overrides] = useState(() => parseTestOverrides(
    window.location.search,
    import.meta.env.VITE_ENABLE_TEST_OVERRIDES === "true",
  ));
  const [nowMs, setNowMs] = useState(() => overrides.nowMs ?? Date.now());
  useEffect(() => {
    if (overrides.nowMs !== null) return;
    const interval = window.setInterval(() => { setNowMs(Date.now()); }, 1000);
    return () => { window.clearInterval(interval); };
  }, [overrides.nowMs]);
  return { nowMs, seedOverride: overrides.seed, fixedTime: overrides.nowMs !== null };
}

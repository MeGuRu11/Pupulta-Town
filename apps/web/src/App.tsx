import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { emptyCity, navigate, usePanelRoute } from "./components/GameHud.tsx";
import { HudIcon } from "./components/HudIcon.tsx";
import { CityScene } from "./scene/CityScene.tsx";
import { AuthPanel } from "./components/AuthPanel.tsx";
import { CitySidebar } from "./components/CitySidebar.tsx";
import { CityPanel } from "./components/CityPanel.tsx";
import { useAuthSession, useCities } from "./hooks/useTracker.ts";
import { getSupabaseClient } from "./lib/supabase.ts";
import { createCity, joinCity } from "./tracker/api.ts";
import { errorMessage } from "./tracker/model.ts";
import "./styles.css";
import "./game.css";

type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;

function Workspace({ client, session }: { client: Client; session: Session }) {
  const { cities, selectedId, select, loading, error, refresh } = useCities(client);
  const route = usePanelRoute();
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.search).get("invite") ?? "");
  const [accountError, setAccountError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [cityToOpen, setCityToOpen] = useState<string>();
  const user = session.user;
  const city = cities.find((item) => item.id === selectedId);

  // Auth can establish a session immediately or when the confirmation email is opened.
  // Fill the blank profile created by the database, without overwriting a renamed profile.
  const candidateName: unknown = user.user_metadata.display_name;
  useEffect(() => {
    if (typeof candidateName !== "string" || !candidateName.trim()) return;
    let current = true;
    void client.from("profiles").update({ display_name: candidateName.trim() })
      .eq("id", user.id).eq("display_name", "").then(({ error: profileError }) => {
        if (current && profileError) setAccountError("Не удалось сохранить имя профиля.");
      });
    return () => { current = false; };
  }, [client, user.id, candidateName]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setAccountError("");
    try {
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(null, "", url);
    } catch (reason) {
      setAccountError(errorMessage(reason));
    } finally {
      setSigningOut(false);
    }
  }

  async function reloadCities(target = cityToOpen) {
    if (await refresh(target) && target) {
      setCityToOpen(undefined);
      if (!window.location.hash || window.location.hash === "#cities") navigate("map");
    }
  }

  async function openCommittedCity(cityId: string) {
    // Retry the list read without replaying the successful write.
    setCityToOpen(cityId);
    await reloadCities(cityId);
  }

  async function enterCity(token: string) {
    const cityId = await joinCity(client, token);
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url);
    setInvite("");
    await openCommittedCity(cityId);
  }

  const panel = route === "map" ? null : route ?? (invite || cityToOpen || (!city && !loading) ? "cities" : null);
  return <CityPanel key={city?.id ?? "unsettled"} city={city} client={client} userId={user.id}
      panel={panel} onRefreshCities={reloadCities}
      citiesMenu={<CitySidebar cities={cities} selectedId={selectedId} invite={invite} loading={loading} error={error}
        awaitingCity={Boolean(cityToOpen)} onRefresh={reloadCities} onJoin={enterCity}
        onSelect={id => { setCityToOpen(undefined); select(id); navigate("map"); }}
        onCreate={async name => { await openCommittedCity(await createCity(client, name)); }} />}
      accountMenu={<div className="hud-account-menu"><p>{typeof candidateName === "string" && candidateName.trim() ? candidateName : user.email}</p>
        {accountError && <p className="notice notice-error" role="alert">{accountError}</p>}
        <button type="button" className="button button-quiet" disabled={signingOut} onClick={() => { void signOut(); }}>Выйти</button></div>} />;
}

export function App() {
  const client = getSupabaseClient();
  const { session, loading, error } = useAuthSession(client);
  const hasInvite = new URLSearchParams(window.location.search).has("invite");
  if (client && session) return <Workspace key={session.user.id} client={client} session={session} />;
  return <main className="game-workspace game-entry">
    <div className="game-world"><CityScene data={emptyCity} seed={0} nowMs={0} fixedTime /></div>
    <header className="game-top"><div className="hud-city"><HudIcon name="city" /><h1>Пупульта Town</h1></div></header>
    <div className="game-window"><div className="game-window-body">
      {!client ? <section className="notice" role="alert">
        <h2>Трекер ещё не подключён</h2>
        <p>Для запуска укажите адрес Supabase и публичный ключ в локальных настройках приложения.</p>
      </section> : loading ? <p className="notice" role="status">Открываем город…</p> :
        <AuthPanel client={client} initialError={error} hasInvite={hasInvite} />}
    </div></div>
  </main>;
}

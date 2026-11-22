import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Brand } from "./components/Brand.tsx";
import { AuthPanel } from "./components/AuthPanel.tsx";
import { CitySidebar } from "./components/CitySidebar.tsx";
import { CityPanel } from "./components/CityPanel.tsx";
import { useAuthSession, useCities } from "./hooks/useTracker.ts";
import { getSupabaseClient } from "./lib/supabase.ts";
import { createCity, joinCity } from "./tracker/api.ts";
import { errorMessage } from "./tracker/model.ts";
import "./styles.css";

type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;

function Header({ children }: { children?: React.ReactNode }) {
  return <header className="app-header"><Brand />{children}</header>;
}

function Workspace({ client, session }: { client: Client; session: Session }) {
  const { cities, selectedId, select, loading, error, refresh } = useCities(client);
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.search).get("invite") ?? "");
  const [accountError, setAccountError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
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
    } catch (reason) {
      setAccountError(errorMessage(reason));
    } finally {
      setSigningOut(false);
    }
  }

  async function enterCity(token: string) {
    const cityId = await joinCity(client, token);
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url);
    setInvite("");
    await refresh(cityId);
  }

  return <>
    <Header>
      <div className="header-account">
        <span>{typeof candidateName === "string" && candidateName.trim() ? candidateName : user.email}</span>
        <button className="text-button" disabled={signingOut} onClick={() => { void signOut(); }}>Выйти</button>
      </div>
    </Header>
    {accountError && <p className="notice notice-error" role="alert">{accountError}</p>}
    <div className="workspace">
      <CitySidebar cities={cities} selectedId={selectedId} onSelect={select} invite={invite}
        loading={loading} error={error} onRefresh={refresh} onJoin={enterCity}
        onCreate={async (name) => { await refresh(await createCity(client, name)); }} />
      <main className="workspace-main">
        {city ? <CityPanel key={city.id} client={client} city={city} userId={user.id} onRefreshCities={refresh} />
          : <section className="empty-state">
            <h2>{loading ? "Загружаем города…" : "Ваши города"}</h2>
            {!loading && <p>{error ? "Повторите загрузку списка городов." : "Создайте город или войдите в существующий по приглашению команды."}</p>}
          </section>}
      </main>
    </div>
  </>;
}

export function App() {
  const client = getSupabaseClient();
  const { session, loading, error } = useAuthSession(client);
  const hasInvite = new URLSearchParams(window.location.search).has("invite");
  return <div className="app-shell">
    {client && session ? <Workspace key={session.user.id} client={client} session={session} />
      : <><Header /><main>
        {!client ? <section className="empty-state" role="alert">
          <h2>Трекер ещё не подключён</h2>
          <p>Для запуска укажите адрес Supabase и публичный ключ в локальных настройках приложения.</p>
        </section> : loading ? <p className="notice" role="status">Открываем город…</p> :
        <AuthPanel client={client} initialError={error} hasInvite={hasInvite} />}
      </main></>}
  </div>;
}

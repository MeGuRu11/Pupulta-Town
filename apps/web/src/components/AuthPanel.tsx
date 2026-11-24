import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { errorMessage, parseInviteToken, TrackerError } from "../tracker/model.ts";

export function AuthPanel({ client, initialError, hasInvite }: {
  client: SupabaseClient<Database>; initialError: string; hasInvite: boolean;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    const name = String(fields.get("name") ?? "").trim();
    setPending(true); setError(""); setMessage("");
    try {
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!name) throw new TrackerError("Укажите имя.");
        const redirect = new URL(window.location.pathname, window.location.origin);
        const invite = parseInviteToken(new URLSearchParams(window.location.search).get("invite") ?? "");
        if (invite) redirect.searchParams.set("invite", invite);
        const { data, error } = await client.auth.signUp({
          email, password, options: { data: { display_name: name }, emailRedirectTo: redirect.href },
        });
        if (error) throw error;
        if (!data.session) setMessage("Подтвердите регистрацию по ссылке в письме.");
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setPending(false); }
  }

  return <section className="auth-card" aria-labelledby="auth-title">
      <h2 id="auth-title">{mode === "login" ? "Вход в город" : "Создать аккаунт"}</h2>
      <p className="muted">{hasInvite ? "Вы получили приглашение. После входа можно присоединиться к команде." : mode === "login" ? "Войдите с почтой, указанной при регистрации." : "Это имя увидят участники вашего города."}</p>
      <form onSubmit={(event) => { void submit(event); }}>
        {mode === "signup" && <label>Имя<input name="name" autoComplete="nickname" required maxLength={80} placeholder="Как вас зовут?" disabled={pending} /></label>}
        <label>Почта<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" disabled={pending} /></label>
        <label>Пароль<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 6 : undefined} placeholder={mode === "signup" ? "Не менее 6 символов" : undefined} disabled={pending} /></label>
        {(error || initialError) && <p className="notice notice-error" role="alert">{error || initialError}</p>}
        {message && <p className="notice" role="status">{message}</p>}
        <button className="button button-primary button-wide" disabled={pending}>{pending ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}<span aria-hidden="true">↗</span></button>
      </form>
      <div className="auth-switch"><span>{mode === "login" ? "Пока нет аккаунта?" : "Уже с нами?"}</span><button type="button" className="text-button" disabled={pending} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Создать аккаунт" : "Уже есть аккаунт? Войти"}</button></div>
  </section>;
}

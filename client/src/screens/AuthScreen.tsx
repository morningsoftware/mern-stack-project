import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { api } from "../api";
import type { ApiError } from "../api";
import { USER_ROLES } from "../constants";
import { ErrorNote, Field } from "../components/Forms";
import type { AuthResponse, OAuthProvider, User } from "../types";

export function AuthScreen({
  onReady,
  initialError = "",
  onClearError,
}: {
  onReady: (user: User) => void;
  initialError?: string;
  onClearError?: () => void;
}) {
  const submitLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState(initialError);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    role: "developer",
    password: "",
  });

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  useEffect(() => {
    let active = true;
    api<{ providers: OAuthProvider[] }>("/api/auth/oauth/providers")
      .then((result) => {
        if (active) setProviders(result.providers || []);
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function update(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function switchMode(nextMode: "login" | "register"): void {
    setMode(nextMode);
    setError("");
    onClearError?.();
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setPending(true);
    setError("");
    onClearError?.();
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { username: form.username, password: form.password }
          : form;
      const result = await api<AuthResponse>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onReady(result.user);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      submitLock.current = false;
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="auth-wrap">
      <p className="eyebrow">Studio sign in</p>
      <h1>Checkpoint</h1>
      <p>
        Sign in to manage teams, projects, tasks, bugs, and playtest feedback.
      </p>
      <div className="panel">
        <div className="auth-switch" aria-label="Account access">
          <button
            type="button"
            className={mode === "login" ? "" : "secondary"}
            aria-pressed={mode === "login"}
            disabled={pending}
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "" : "secondary"}
            aria-pressed={mode === "register"}
            disabled={pending}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
        </div>
        <ErrorNote error={error} />
        <form onSubmit={submit}>
          <fieldset className="stack" disabled={pending}>
            <Field label="Username">
              <input
                name="username"
                value={form.username}
                onChange={update}
                autoComplete="username"
                required
              />
            </Field>
            {mode === "register" && (
              <>
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={update}
                    autoComplete="email"
                    required
                  />
                </Field>
                <Field label="Display name">
                  <input
                    name="displayName"
                    value={form.displayName}
                    onChange={update}
                    required
                  />
                </Field>
                <Field label="Role">
                  <select name="role" value={form.role} onChange={update}>
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Password">
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={update}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </Field>
            <button type="submit">
              {pending
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </fieldset>
        </form>
        {providers.length > 0 && (
          <div className="oauth-links">
            <p className="meta">Or continue with</p>
            {providers.map((provider) => (
              <a
                key={provider.id}
                className="button-link secondary"
                href={`/api/auth/oauth/${provider.id}`}
              >
                Continue with {provider.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

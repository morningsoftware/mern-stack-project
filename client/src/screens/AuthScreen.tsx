import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { api, setToken } from "../api";
import type { ApiError } from "../api";
import { USER_ROLES } from "../constants";
import { ErrorNote, Field } from "../components/Forms";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Theme } from "../theme";
import type { AuthResponse, User } from "../types";

const AuthBackdrop = lazy(() => import("../components/AuthBackdrop"));

export function AuthScreen({
  onReady,
  theme,
  onToggleTheme,
}: {
  onReady: (user: User) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const submitLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    role: "developer",
    password: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setShowBackdrop(true), 400);
    return () => window.clearTimeout(timer);
  }, []);

  function update(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setPending(true);
    setError("");
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
      setToken(result.token);
      onReady(result.user);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      submitLock.current = false;
      setPending(false);
    }
  }

  return (
    <>
      {showBackdrop && (
        <Suspense fallback={null}>
          <AuthBackdrop theme={theme} />
        </Suspense>
      )}
      <ThemeToggle
        theme={theme}
        onToggle={onToggleTheme}
        className="auth-theme-toggle"
      />
      <main id="main-content" className="auth-wrap">
        <p className="eyebrow">Studio sign in</p>
        <h1>Checkpoint</h1>
        <p>
          Sign in to manage teams, projects, tasks, bugs, and playtest feedback.
        </p>
        <div className="panel">
          <div className="auth-switch" role="group" aria-label="Account access">
            <button
              type="button"
              className={mode === "login" ? "" : "secondary"}
              aria-pressed={mode === "login"}
              disabled={pending}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "register" ? "" : "secondary"}
              aria-pressed={mode === "register"}
              disabled={pending}
              onClick={() => {
                setMode("register");
                setError("");
              }}
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
        </div>
      </main>
    </>
  );
}

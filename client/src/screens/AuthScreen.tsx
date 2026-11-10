import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { api, errorMessage } from "../api";
import type { AuthResponse, OAuthProvider, User } from "../types";
import type { UserRole } from "../constants";
import { USER_ROLES } from "../constants";
import { ErrorNote, Field } from "../components/Forms";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Theme } from "../theme";

const AuthBackdrop = lazy(() => import("../components/AuthBackdrop"));

interface AuthForm {
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
}

export function AuthScreen({
  onReady,
  initialError = "",
  onClearError,
  theme,
  onToggleTheme,
}: {
  onReady: (user: User) => void;
  initialError?: string;
  onClearError?: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const submitLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState(initialError);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [form, setForm] = useState<AuthForm>({
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

  useEffect(() => {
    const timer = window.setTimeout(() => setShowBackdrop(true), 400);
    return () => window.clearTimeout(timer);
  }, []);

  function update(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void {
    const { name, value } = event.target;
    setForm((current) => {
      switch (name) {
        case "username":
          return { ...current, username: value };
        case "email":
          return { ...current, email: value };
        case "displayName":
          return { ...current, displayName: value };
        case "role":
          return { ...current, role: value as UserRole };
        case "password":
          return { ...current, password: value };
        default:
          return current;
      }
    });
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
      setError(errorMessage(err));
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
        <h1 className="auth-brand">
          <img
            src="/brand/checkpoint-logo.png"
            alt="checkpoint"
            width="320"
            height="102"
          />
        </h1>
        <p>Sign in to your studio workspace.</p>
        <div className="panel">
          <div className="auth-switch" role="group" aria-label="Account access">
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
            <>
              <hr className="auth-divider" />
              <div className="oauth-links">
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
            </>
          )}
        </div>
      </main>
    </>
  );
}

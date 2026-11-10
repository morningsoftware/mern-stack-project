import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { api, errorMessage, setToken } from "../api";
import type { AuthResponse, User } from "../types";
import type { UserRole } from "../constants";
import { USER_ROLES } from "../constants";
import { ErrorNote, Field } from "../components/Forms";

interface AuthForm {
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
}

export function AuthScreen({ onReady }: { onReady: (user: User) => void }) {
  const submitLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [form, setForm] = useState<AuthForm>({
    username: "",
    email: "",
    displayName: "",
    role: "developer",
    password: "",
  });

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

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      setError(errorMessage(err));
    } finally {
      submitLock.current = false;
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="auth-wrap">
      <p className="eyebrow">Studio sign in</p>
      <h1 className="auth-brand">
        <img
          src="/brand/checkpoint-logo.png"
          alt="checkpoint"
          width="360"
          height="120"
        />
      </h1>
      <p>
        Sign in to manage teams, projects, tasks, bugs, and playtest feedback.
      </p>
      <div className="panel">
        <div className="auth-switch" aria-label="Account access">
          <button
            type="button"
            className={mode === "login" ? "" : "secondary"}
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
  );
}

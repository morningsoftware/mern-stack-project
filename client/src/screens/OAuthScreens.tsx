import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { api } from "../api";
import { USER_ROLES } from "../constants";
import { ErrorNote, Field } from "../components/Forms";
import { errorMessage, oauthProviderLabel } from "../oauth";
import type {
  AuthResponse,
  OAuthRegistration,
  User,
} from "../types";

export function OAuthOnboardingScreen({
  code,
  onReady,
  onCancel,
}: {
  code: string;
  onReady: (user: User) => void;
  onCancel: () => void;
}) {
  const [registration, setRegistration] = useState<OAuthRegistration | null>(
    null
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    role: "developer",
  });

  useEffect(() => {
    let active = true;
    api<{ registration: OAuthRegistration }>(
      "/api/auth/oauth/registration/inspect",
      {
        method: "POST",
        body: JSON.stringify({ code }),
      }
    )
      .then((result) => {
        if (!active) return;
        setRegistration(result.registration);
        setForm({
          username: result.registration.suggestedUsername,
          displayName: result.registration.displayName,
          role: "developer",
        });
      })
      .catch((err: unknown) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

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
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await api<AuthResponse>(
        "/api/auth/oauth/registration/complete",
        {
          method: "POST",
          body: JSON.stringify({ code, ...form }),
        }
      );
      onReady(result.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <main id="main-content" className="auth-wrap">
        <p role="status">Loading your sign-up details…</p>
      </main>
    );
  }

  if (!registration) {
    return (
      <main id="main-content" className="auth-wrap">
        <h1>Create your account</h1>
        <div className="panel">
          <ErrorNote
            error={error || "This sign-up link is invalid or has expired."}
          />
          <button type="button" className="secondary" onClick={onCancel}>
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="auth-wrap">
      <p className="eyebrow">Studio sign up</p>
      <h1>Create your account</h1>
      <p>
        Finish setting up your studio account. Your email comes from your
        provider and cannot be changed here.
      </p>
      <div className="panel">
        <p className="meta">
          Signed in with {oauthProviderLabel(registration.provider)}.
        </p>
        <ErrorNote error={error} />
        <form onSubmit={submit}>
          <fieldset className="stack" disabled={pending}>
            <Field label="Email">
              <input value={registration.email} readOnly />
            </Field>
            <Field label="Username">
              <input
                name="username"
                value={form.username}
                onChange={update}
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Display name">
              <input
                name="displayName"
                value={form.displayName}
                onChange={update}
                autoComplete="name"
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
            <button type="submit">
              {pending ? "Creating account…" : "Create account"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </button>
          </fieldset>
        </form>
      </div>
    </main>
  );
}

export function OAuthLinkScreen({
  code,
  provider,
  onReady,
  onCancel,
}: {
  code: string;
  provider: string | null;
  onReady: (user: User) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const label = oauthProviderLabel(provider);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await api<AuthResponse>("/api/auth/oauth/link/complete", {
        method: "POST",
        body: JSON.stringify({ code, password }),
      });
      onReady(result.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="auth-wrap">
      <p className="eyebrow">Connect account</p>
      <h1>Link {label}</h1>
      <p>
        An account with this email already exists. Enter your password once to
        link {label} to it.
      </p>
      <div className="panel">
        <ErrorNote error={error} />
        <form onSubmit={submit}>
          <fieldset className="stack" disabled={pending}>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <button type="submit">
              {pending ? "Linking…" : "Link and sign in"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </button>
          </fieldset>
        </form>
      </div>
    </main>
  );
}

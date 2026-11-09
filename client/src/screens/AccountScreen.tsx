import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { ErrorNote, Field } from "../components/Forms";
import { errorMessage, oauthProviderLabel } from "../oauth";
import type {
  AccountResponse,
  OAuthProvider,
  User,
} from "../types";

export function AccountScreen({
  user,
  initialNotice = "",
  initialError = "",
  onBack,
}: {
  user: User;
  initialNotice?: string;
  initialError?: string;
  onBack: () => void;
}) {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);
  const [pending, setPending] = useState<"unlink" | "password" | null>(null);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
  });

  async function load(): Promise<void> {
    const [nextAccount, nextProviders] = await Promise.all([
      api<AccountResponse>("/api/auth/account"),
      api<{ providers: OAuthProvider[] }>("/api/auth/oauth/providers"),
    ]);
    setAccount(nextAccount);
    setProviders(nextProviders.providers || []);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  async function unlink(provider: OAuthProvider): Promise<void> {
    if (pending) return;
    setPending("unlink");
    setError("");
    setNotice("");
    try {
      await api(`/api/auth/oauth/${provider.id}`, { method: "DELETE" });
      setNotice(`${provider.label} has been disconnected.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function savePassword(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending("password");
    setError("");
    setNotice("");
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({
          newPassword: passwords.newPassword,
          ...(account?.hasPassword
            ? { currentPassword: passwords.currentPassword }
            : {}),
        }),
      });
      const changed = Boolean(account?.hasPassword);
      setPasswords({ currentPassword: "", newPassword: "" });
      setNotice(
        changed
          ? "Password updated."
          : "Password set. You can now sign in with it."
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  const linked = account?.providers || [];
  const linkedIds = new Set(linked.map((provider) => provider.provider));
  const available = providers.filter((provider) => !linkedIds.has(provider.id));
  const lastSignInMethod = Boolean(
    account && !account.hasPassword && linked.length <= 1
  );

  return (
    <div>
      <header className="top">
        <div>
          <button type="button" className="secondary" onClick={onBack}>
            Back to workspace
          </button>
          <p className="eyebrow">Settings</p>
          <h1>Account</h1>
          <p className="meta">
            {user.displayName} ({user.email})
          </p>
        </div>
      </header>
      <ErrorNote error={error} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!account ? (
        <p role="status" className="loading">
          Loading account settings…
        </p>
      ) : (
        <div className="grid">
          <section className="panel">
            <h2>Password</h2>
            <p className="meta">
              {account.hasPassword
                ? "Change the password used to sign in."
                : "Your account currently signs in with a provider. Set a password to add password sign-in."}
            </p>
            <form onSubmit={savePassword}>
              <fieldset className="stack" disabled={pending !== null}>
                {account.hasPassword && (
                  <Field label="Current password">
                    <input
                      type="password"
                      value={passwords.currentPassword}
                      onChange={(event) =>
                        setPasswords({
                          ...passwords,
                          currentPassword: event.target.value,
                        })
                      }
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                )}
                <Field
                  label={account.hasPassword ? "New password" : "Password"}
                >
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords({
                        ...passwords,
                        newPassword: event.target.value,
                      })
                    }
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <button type="submit" disabled={pending !== null}>
                  {pending === "password"
                    ? "Saving…"
                    : account.hasPassword
                      ? "Update password"
                      : "Set password"}
                </button>
              </fieldset>
            </form>
          </section>
          <section className="panel">
            <h2>Connected accounts</h2>
            {linked.length === 0 ? (
              <p>No providers connected.</p>
            ) : (
              <ul className="list">
                {linked.map((provider) => {
                  const definition = providers.find(
                    (item) => item.id === provider.provider
                  );
                  const label =
                    definition?.label || oauthProviderLabel(provider.provider);
                  return (
                    <li key={`${provider.provider}:${provider.email}`}>
                      <span>
                        <strong>{label}</strong>
                        <span className="meta"> — {provider.email}</span>
                      </span>
                      <button
                        type="button"
                        className="secondary"
                        disabled={lastSignInMethod || pending !== null}
                        title={
                          lastSignInMethod
                            ? "Set a password before unlinking your last sign-in method"
                            : undefined
                        }
                        onClick={() => unlink({ id: provider.provider, label })}
                      >
                        {pending === "unlink" ? "Unlinking…" : "Unlink"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {lastSignInMethod && (
              <p className="meta">
                Set a password before unlinking your last sign-in method.
              </p>
            )}
            <h3>Link a provider</h3>
            {available.length === 0 ? (
              <p className="meta">All configured providers are connected.</p>
            ) : (
              <div className="oauth-links">
                {available.map((provider) => (
                  <a
                    key={provider.id}
                    className="button-link secondary"
                    href={`/api/auth/oauth/${provider.id}?intent=link`}
                  >
                    Link {provider.label}
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { api } from "../api";
import { ErrorNote, Field } from "../components/Forms";
import { userAvatarUrl } from "../format";
import { errorMessage, oauthProviderLabel } from "../oauth";
import type {
  AccountResponse,
  OAuthProvider,
  User,
} from "../types";

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

type Pending = "profile" | "avatar" | "unlink" | "password" | null;

export function AccountScreen({
  user,
  initialNotice = "",
  initialError = "",
  onUserChange,
  onBack,
}: {
  user: User;
  initialNotice?: string;
  initialError?: string;
  onUserChange: (user: User) => void;
  onBack: () => void;
}) {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);
  const [pending, setPending] = useState<Pending>(null);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
    onUserChange(nextAccount.user);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    setDisplayName(user.displayName);
  }, [user.displayName]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  async function saveDisplayName(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending("profile");
    setError("");
    setNotice("");
    try {
      const updated = await api<User>(`/api/users/${user._id}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      });
      onUserChange(updated);
      setAccount((current) =>
        current ? { ...current, user: updated } : current
      );
      setDisplayName(updated.displayName);
      setNotice("Display name updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] || null;
    setError("");
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!AVATAR_TYPES.includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      event.target.value = "";
      setAvatarFile(null);
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Choose an image up to 2 MB.");
      event.target.value = "";
      setAvatarFile(null);
      return;
    }
    setAvatarFile(file);
  }

  async function uploadAvatar(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();
    if (!avatarFile || pending) return;
    setPending("avatar");
    setError("");
    setNotice("");
    try {
      const result = await api<{ user: User }>(
        `/api/users/${user._id}/avatar`,
        {
          method: "POST",
          headers: { "Content-Type": avatarFile.type },
          body: avatarFile,
        }
      );
      onUserChange(result.user);
      setAccount((current) =>
        current ? { ...current, user: result.user } : current
      );
      setAvatarFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setNotice("Profile picture updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function removeAvatar(): Promise<void> {
    if (pending) return;
    setPending("avatar");
    setError("");
    setNotice("");
    try {
      const result = await api<{ user: User }>(
        `/api/users/${user._id}/avatar`,
        { method: "DELETE" }
      );
      onUserChange(result.user);
      setAccount((current) =>
        current ? { ...current, user: result.user } : current
      );
      setAvatarFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setNotice("Profile picture removed.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

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
  const avatar = avatarPreview || userAvatarUrl(user);

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
          <section className="panel account-profile">
            <h2>Profile</h2>
            <div className="account-profile-layout">
              <div className="account-avatar" aria-hidden="true">
                {avatar ? (
                  <img src={avatar} alt="" />
                ) : (
                  user.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="account-profile-forms">
                <form onSubmit={saveDisplayName}>
                  <fieldset className="stack" disabled={pending !== null}>
                    <Field label="Display name">
                      <input
                        value={displayName}
                        onChange={(event) =>
                          setDisplayName(event.target.value)
                        }
                        maxLength={80}
                        required
                      />
                    </Field>
                    <p className="meta">Username: {user.username}</p>
                    <div className="build-actions">
                      <button type="submit" disabled={pending !== null}>
                        {pending === "profile"
                          ? "Saving…"
                          : "Save display name"}
                      </button>
                    </div>
                  </fieldset>
                </form>
                <form onSubmit={uploadAvatar}>
                  <fieldset className="stack" disabled={pending !== null}>
                    <Field label="Profile picture">
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={chooseAvatar}
                      />
                    </Field>
                    <p className="meta">PNG, JPEG, or WebP up to 2 MB.</p>
                    <div className="build-actions">
                      <button
                        type="submit"
                        disabled={!avatarFile || pending !== null}
                      >
                        {pending === "avatar" ? "Uploading…" : "Upload picture"}
                      </button>
                      {user.avatarUpdatedOn && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={pending !== null}
                          onClick={removeAvatar}
                        >
                          Remove picture
                        </button>
                      )}
                    </div>
                  </fieldset>
                </form>
              </div>
            </div>
          </section>
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

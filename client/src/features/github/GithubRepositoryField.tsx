import { useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import type { GithubAccessibleRepository, GithubAccount } from "../../types";
import { ErrorNote, Field } from "../../components/Forms";

const EMPTY: GithubAccount = {
  connected: false,
  login: null,
  oauthConfigured: false,
  callbackUrl: "",
  installUrl: null,
  repositories: [],
};

export function GithubRepositoryField({
  value,
  onChange,
  disabled,
  onConnection,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onConnection?: (connected: boolean) => void;
}) {
  const [account, setAccount] = useState<GithubAccount>(EMPTY);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "error") {
      setError("GitHub could not be connected. Try again.");
      params.delete("github");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api<GithubAccount>("/api/github/repositories", {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setAccount(data);
        onConnection?.(Boolean(data.connected));
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [onConnection]);

  async function connect() {
    setPending(true);
    setError("");
    try {
      const returnTo = `${window.location.origin}/${window.location.hash || "#/teams"}`;
      const data = await api<{ url: string }>(
        `/api/github/connect?returnTo=${encodeURIComponent(returnTo)}`,
      );
      window.location.assign(data.url);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  const choices: GithubAccessibleRepository[] = account.repositories.some(
    (repository) => repository.fullName === value,
  )
    ? account.repositories
    : value
      ? [{ fullName: value, installationId: null }, ...account.repositories]
      : account.repositories;

  return (
    <div>
      {!account.oauthConfigured ? (
        <p className="meta">
          GitHub connection is not configured yet. Add GITHUB_APP_CLIENT_SECRET to the
          server environment and set the GitHub App callback URL to{" "}
          {account.callbackUrl}.
        </p>
      ) : !account.connected ? (
        <>
          <p className="meta">Connect GitHub to choose a repository.</p>
          <button
            type="button"
            className="secondary"
            disabled={disabled || pending}
            onClick={connect}
          >
            {pending ? "Connecting…" : "Connect GitHub"}
          </button>
        </>
      ) : (
        <>
          <p className="meta">Connected as {account.login}.</p>
          <Field label="GitHub repository">
            <select
              value={value}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">No repository</option>
              {choices.map((repository) => (
                <option key={repository.fullName} value={repository.fullName}>
                  {repository.fullName}
                </option>
              ))}
            </select>
          </Field>
          {!account.repositories.length && (
            <p className="meta">
              No repositories are available yet.
              {account.installUrl ? (
                <>
                  {" "}
                  <a href={account.installUrl}>Install the GitHub App</a> on
                  your account, then refresh.
                </>
              ) : null}
            </p>
          )}
        </>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

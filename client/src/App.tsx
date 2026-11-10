import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { ApiError } from "./api";
import { AppShell } from "./components/AppShell";
import { AuthScreen } from "./screens/AuthScreen";
import { AccountScreen } from "./screens/AccountScreen";
import {
  OAuthLinkScreen,
  OAuthOnboardingScreen,
} from "./screens/OAuthScreens";
import { TeamsScreen } from "./screens/TeamsScreen";
import { TeamScreen } from "./screens/TeamScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import type { ProjectView } from "./constants";
import type { Project, Team, User } from "./types";
import {
  clearOAuthFragment,
  errorMessage,
  oauthErrorMessage,
  oauthProviderLabel,
  readOAuthFragment,
} from "./oauth";
import type { OAuthFlow } from "./oauth";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [team, setTeam] = useState<Team | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [view, setView] = useState<ProjectView>("overview");
  const [oauthFlow, setOAuthFlow] = useState<OAuthFlow | null>(null);
  const [authError, setAuthError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const exchangePending = useRef(false);
  const oauthFlowPending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setSessionError("");

    if (exchangePending.current || oauthFlowPending.current) return;

    const fragment = readOAuthFragment();
    const hasOAuthFragment = Boolean(
      fragment.loginCode ||
        fragment.registrationCode ||
        fragment.linkCode ||
        fragment.linkedProvider ||
        fragment.error
    );

    if (hasOAuthFragment) clearOAuthFragment();

    if (fragment.registrationCode) {
      oauthFlowPending.current = true;
      setOAuthFlow({ type: "register", code: fragment.registrationCode });
      setReady(true);
      return;
    }

    if (fragment.linkCode) {
      oauthFlowPending.current = true;
      setOAuthFlow({
        type: "link",
        code: fragment.linkCode,
        provider: fragment.provider,
      });
      setReady(true);
      return;
    }

    // Link outcomes and errors can happen while the user is already signed in,
    // so they still load the existing session below.
    if (fragment.error) {
      setAuthError(oauthErrorMessage(fragment.error));
      setAccountOpen(true);
    }
    if (fragment.linkedProvider) {
      setAccountNotice(
        `${oauthProviderLabel(fragment.linkedProvider)} connected.`
      );
      setAccountOpen(true);
    }

    if (fragment.loginCode) {
      exchangePending.current = true;
      setReady(false);
      // Keep the exchange alive across StrictMode's effect replay. The ref
      // guard above prevents a duplicate exchange.
      api<{ user: User }>("/api/auth/oauth/exchange", {
        method: "POST",
        body: JSON.stringify({ code: fragment.loginCode }),
      })
        .then((result) => {
          setUser(result.user);
          setAuthError("");
        })
        .catch((err: unknown) => setAuthError(errorMessage(err)))
        .finally(() => {
          exchangePending.current = false;
          setReady(true);
        });
      return;
    }

    setReady(false);
    api<{ user: User }>("/api/auth/me", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setUser(result.user);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        if (err.status === 401) {
          setUser(null);
        } else {
          setSessionError(
            "We could not restore your session. Check your connection and try again."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [attempt]);

  async function signOut(): Promise<void> {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear local state even if the server is unreachable.
    }
    setUser(null);
    setTeam(null);
    setProject(null);
    setView("overview");
    setOAuthFlow(null);
    oauthFlowPending.current = false;
    setAccountOpen(false);
    setAccountNotice("");
    setAuthError("");
  }

  function openTeams(): void {
    setAccountOpen(false);
    setTeam(null);
    setProject(null);
    setView("overview");
  }

  function openTeam(): void {
    setAccountOpen(false);
    setProject(null);
    setView("overview");
  }

  if (!ready)
    return (
      <main id="main-content" className="auth-wrap">
        <p role="status">Loading your workspace…</p>
      </main>
    );
  if (sessionError)
    return (
      <main id="main-content" className="auth-wrap">
        <p role="alert">{sessionError}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button>
      </main>
    );
  if (oauthFlow?.type === "register") {
    return (
      <OAuthOnboardingScreen
        code={oauthFlow.code}
        onReady={(nextUser) => {
          oauthFlowPending.current = false;
          setOAuthFlow(null);
          setAuthError("");
          setUser(nextUser);
        }}
        onCancel={() => {
          oauthFlowPending.current = false;
          setOAuthFlow(null);
          setAuthError("");
        }}
      />
    );
  }
  if (oauthFlow?.type === "link") {
    return (
      <OAuthLinkScreen
        code={oauthFlow.code}
        provider={oauthFlow.provider}
        onReady={(nextUser) => {
          oauthFlowPending.current = false;
          setOAuthFlow(null);
          setAuthError("");
          setUser(nextUser);
        }}
        onCancel={() => {
          oauthFlowPending.current = false;
          setOAuthFlow(null);
          setAuthError("");
        }}
      />
    );
  }
  if (!user) {
    return (
      <AuthScreen
        onReady={(nextUser) => {
          setAuthError("");
          setAccountOpen(false);
          setAccountNotice("");
          setUser(nextUser);
        }}
        initialError={authError}
        onClearError={() => setAuthError("")}
      />
    );
  }

  return (
    <AppShell
      user={user}
      team={team}
      project={project}
      view={view}
      accountOpen={accountOpen}
      onViewChange={(next) => {
        setAccountOpen(false);
        setView(next);
      }}
      onTeams={openTeams}
      onTeam={openTeam}
      onAccount={() => {
        setAccountNotice("");
        setAuthError("");
        setAccountOpen(true);
      }}
      onSignOut={signOut}
    >
      {accountOpen ? (
        <AccountScreen
          user={user}
          initialNotice={accountNotice}
          initialError={authError}
          onBack={() => {
            setAccountOpen(false);
            setAccountNotice("");
            setAuthError("");
          }}
        />
      ) : project ? (
        <ProjectScreen
          key={project._id}
          project={project}
          currentUserId={user._id}
          onProjectChange={setProject}
          view={view}
          onViewChange={setView}
        />
      ) : team ? (
        <TeamScreen
          key={team._id}
          team={team}
          onOpenProject={(next) => {
            setProject(next);
            setView("tasks");
          }}
        />
      ) : (
        <TeamsScreen onOpenTeam={setTeam} />
      )}
    </AppShell>
  );
}

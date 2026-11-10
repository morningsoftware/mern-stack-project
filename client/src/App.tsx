import { useEffect, useRef, useState } from "react";
import { api } from "./api";
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
import { UnsavedChanges, useLeaveGuard } from "./navigation/UnsavedChanges";
import { parseRoute, routeHash, routeContext } from "./navigation/routes";
import {
  clearOAuthFragment,
  errorMessage,
  oauthErrorMessage,
  oauthProviderLabel,
  readOAuthFragment,
} from "./oauth";
import type { OAuthFlow } from "./oauth";

export function App() {
  return (
    <UnsavedChanges>
      <Workspace />
    </UnsavedChanges>
  );
}

function errorStatus(err: unknown): number | undefined {
  return typeof err === "object" && err !== null && "status" in err
    ? Number((err as { status?: number }).status)
    : undefined;
}

function Workspace() {
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
  const guard = useLeaveGuard();
  const [hash, setHash] = useState(() =>
    window.location.hash.startsWith("#/") ? window.location.hash : "#/teams",
  );
  const [routeError, setRouteError] = useState("");
  const [routing, setRouting] = useState(false);
  const [routeAttempt, setRouteAttempt] = useState(0);
  const location = useRef({
    hash,
    index: window.history.state?.checkpointIndex || 0,
  });
  const restoring = useRef(false);

  useEffect(() => {
    window.history.replaceState(
      { ...window.history.state, checkpointIndex: location.current.index },
      "",
      location.current.hash,
    );
    const onPop = () => {
      if (restoring.current) {
        restoring.current = false;
        return;
      }
      const nextHash = window.location.hash || "#/teams";
      const index = window.history.state?.checkpointIndex;
      if (
        routeContext(nextHash) !== routeContext(location.current.hash) &&
        !(guard?.canLeave() ?? true)
      ) {
        if (Number.isInteger(index) && index !== location.current.index) {
          restoring.current = true;
          window.history.go(location.current.index - index);
        } else
          window.history.replaceState(
            { checkpointIndex: location.current.index },
            "",
            location.current.hash,
          );
        return;
      }
      location.current = {
        hash: nextHash,
        index: index ?? location.current.index + 1,
      };
      window.history.replaceState(
        { checkpointIndex: location.current.index },
        "",
        nextHash,
      );
      setHash(nextHash);
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [guard]);

  function navigate(
    nextTeam: Team | null,
    nextProject: Project | null,
    nextView: ProjectView = "tasks",
  ) {
    const nextHash = routeHash(nextTeam, nextProject, nextView);
    if (nextHash === location.current.hash) return;
    if (
      routeContext(nextHash) !== routeContext(location.current.hash) &&
      !(guard?.canLeave() ?? true)
    )
      return;
    const index = location.current.index + 1;
    window.history.pushState({ checkpointIndex: index }, "", nextHash);
    location.current = { hash: nextHash, index };
    // Preserve drafts when switching views within a project.
    setTeam(nextTeam);
    setProject(nextProject);
    setView(nextView);
    setHash(nextHash);
  }

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setRouteError("");
    let route;
    try {
      route = parseRoute(hash);
    } catch (err) {
      setRouteError(errorMessage(err));
      setRouting(false);
      return;
    }
    if (
      (!route.teamId && !team) ||
      (route.teamId === team?._id && route.projectId === (project?._id || null))
    ) {
      setView(route.view);
      setRouting(false);
      return;
    }
    setRouting(true);
    (async () => {
      const nextTeam = route.teamId
        ? await api<Team>(`/api/teams/${encodeURIComponent(route.teamId)}`, {
            signal: controller.signal,
          })
        : null;
      const nextProject = route.projectId
        ? await api<Project>(
            `/api/projects/${encodeURIComponent(route.projectId)}`,
            { signal: controller.signal },
          )
        : null;
      if (nextProject && nextProject.teamId !== nextTeam?._id)
        throw new Error(
          "This project does not belong to the team in this link.",
        );
      if (!controller.signal.aborted) {
        setTeam(nextTeam);
        setProject(nextProject);
        setView(route.view);
      }
    })()
      .catch((err) => {
        if (!controller.signal.aborted)
          setRouteError(
            errorStatus(err) === 404
              ? "This team or project could not be found."
              : errorMessage(err),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouting(false);
      });
    return () => controller.abort();
  }, [user, hash, routeAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setSessionError("");

    if (exchangePending.current || oauthFlowPending.current)
      return () => controller.abort();

    const fragment = readOAuthFragment();
    const hasOAuthFragment = Boolean(
      fragment.loginCode ||
        fragment.registrationCode ||
        fragment.linkCode ||
        fragment.linkedProvider ||
        fragment.error,
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
        `${oauthProviderLabel(fragment.linkedProvider)} connected.`,
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
    api<{ user: User }>("/api/auth/me", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setUser(result.user);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (errorStatus(err) === 401) {
          setUser(null);
        } else {
          setSessionError(
            "We could not restore your session. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [attempt]);

  async function signOut(): Promise<void> {
    if (!(guard?.canLeave() ?? true)) return;
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
    window.history.replaceState(
      { checkpointIndex: location.current.index },
      "",
      "#/teams",
    );
    location.current.hash = "#/teams";
    setHash("#/teams");
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

  // Resolve a saved project link before painting the smaller teams navigation.
  // Otherwise the project menu pushes the entire mobile workspace down on load.
  let awaitingRoute = false;
  if (!accountOpen) {
    try {
      const requested = parseRoute(hash);
      awaitingRoute =
        requested.teamId !== (team?._id || null) ||
        requested.projectId !== (project?._id || null);
    } catch {
      /* The route effect renders the explicit invalid-link error. */
    }
  }
  if (awaitingRoute && !routeError)
    return (
      <main id="main-content" className="auth-wrap">
        <p role="status">Opening workspace…</p>
      </main>
    );

  return (
    <AppShell
      user={user}
      team={team}
      project={project}
      view={view}
      accountOpen={accountOpen}
      onTeams={() => {
        setAccountOpen(false);
        navigate(null, null, "overview");
      }}
      onTeam={() => {
        setAccountOpen(false);
        navigate(team, null, "overview");
      }}
      onViewChange={(next) => {
        setAccountOpen(false);
        navigate(team, project, next);
      }}
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
      ) : routing ? (
        <p role="status">Opening workspace…</p>
      ) : routeError ? (
        <section>
          <p role="alert">{routeError}</p>
          <button onClick={() => setRouteAttempt((old) => old + 1)}>
            Retry link
          </button>{" "}
          <button
            className="secondary"
            onClick={() => navigate(null, null, "overview")}
          >
            Back to teams
          </button>
        </section>
      ) : project ? (
        <ProjectScreen
          key={project._id}
          project={project}
          currentUserId={user._id}
          onProjectChange={setProject}
          view={view}
          onViewChange={(next) => navigate(team, project, next)}
        />
      ) : team ? (
        <TeamScreen
          key={team._id}
          team={team}
          currentUserId={user._id}
          onOpenProject={(next) => navigate(team, next)}
        />
      ) : (
        <TeamsScreen
          onOpenTeam={(next) => navigate(next, null, "overview")}
        />
      )}
    </AppShell>
  );
}

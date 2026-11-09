import { useEffect, useRef, useState } from "react";
import { api, getToken, setToken } from "./api";
import { AppShell } from "./components/AppShell";
import { AuthScreen } from "./screens/AuthScreen";
import { TeamsScreen } from "./screens/TeamsScreen";
import { TeamScreen } from "./screens/TeamScreen";
import { ProjectScreen } from "./screens/ProjectScreen";

import { UnsavedChanges, useLeaveGuard } from "./navigation/UnsavedChanges";
import { parseRoute, routeHash, routeContext } from "./navigation/routes.js";

export function App() {
  return (
    <UnsavedChanges>
      <Workspace />
    </UnsavedChanges>
  );
}
type WorkspaceRecord = { _id: string; teamId?: string };

function errorStatus(err: unknown): number | undefined {
  return typeof err === "object" && err !== null && "status" in err
    ? Number((err as { status?: number }).status)
    : undefined;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}

function Workspace() {
  const [user, setUser] = useState<WorkspaceRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [team, setTeam] = useState<WorkspaceRecord | null>(null);
  const [project, setProject] = useState<WorkspaceRecord | null>(null);
  const [view, setView] = useState("overview");
  const guard = useLeaveGuard() as unknown as { canLeave: () => boolean };
  const [hash, setHash] = useState(() => window.location.hash || "#/teams");
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
        !guard.canLeave()
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
    nextTeam: WorkspaceRecord | null,
    nextProject: WorkspaceRecord | null,
    nextView = "tasks",
  ) {
    const nextHash = routeHash(nextTeam, nextProject, nextView);
    if (nextHash === location.current.hash) return;
    if (
      routeContext(nextHash) !== routeContext(location.current.hash) &&
      !guard.canLeave()
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
        ? await api<WorkspaceRecord>(
            `/api/teams/${encodeURIComponent(route.teamId)}`,
            { signal: controller.signal },
          )
        : null;
      const nextProject = route.projectId
        ? await api<WorkspaceRecord>(
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
    if (!getToken()) {
      setReady(true);
      return () => controller.abort();
    }
    setReady(false);
    api<{ user: WorkspaceRecord }>("/api/auth/me", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setUser(result.user);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (errorStatus(err) === 401) setToken(null);
        else
          setSessionError(
            "We could not restore your session. Check your connection and try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [attempt]);
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
  if (!user) return <AuthScreen onReady={setUser} />;
  // Resolve a saved project link before painting the smaller teams navigation.
  // Otherwise the project menu pushes the entire mobile workspace down on load.
  let awaitingRoute = false;
  try {
    const requested = parseRoute(hash);
    awaitingRoute = requested.teamId !== (team?._id || null) ||
      requested.projectId !== (project?._id || null);
  } catch { /* The route effect renders the explicit invalid-link error. */ }
  if (awaitingRoute && !routeError)
    return <main id="main-content" className="auth-wrap"><p role="status">Opening workspace…</p></main>;
  return (
    <AppShell
      user={user}
      team={team}
      project={project}
      view={view}
      onTeams={() => navigate(null, null, "overview")}
      onTeam={() => navigate(team, null, "overview")}
      onViewChange={(next: string) => navigate(team, project, next)}
      onSignOut={() => {
        if (!guard.canLeave()) return;
        setToken(null);
        setUser(null);
        setTeam(null);
        setProject(null);
        setView("overview");
        window.history.replaceState(
          { checkpointIndex: location.current.index },
          "",
          "#/teams",
        );
        location.current.hash = "#/teams";
        setHash("#/teams");
      }}
    >
      {routing ? (
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
          onViewChange={(next: string) => navigate(team, project, next)}
        />
      ) : team ? (
        <TeamScreen
          key={team._id}
          team={team}
          currentUserId={user._id}
          onOpenProject={(next: WorkspaceRecord) => navigate(team, next)}
        />
      ) : (
        <TeamsScreen
          onOpenTeam={(next: WorkspaceRecord) =>
            navigate(next, null, "overview")
          }
        />
      )}
    </AppShell>
  );
}

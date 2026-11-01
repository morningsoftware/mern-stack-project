import { useEffect, useRef, useState } from "react";
import { api, getToken, setToken } from "./api.js";
import { AppShell } from "./components/AppShell.jsx";
import { AuthScreen } from "./screens/AuthScreen.jsx";
import { TeamsScreen } from "./screens/TeamsScreen.jsx";
import { TeamScreen } from "./screens/TeamScreen.jsx";
import { ProjectScreen } from "./screens/ProjectScreen.jsx";

import { UnsavedChanges, useLeaveGuard } from "./navigation/UnsavedChanges.jsx";
import { parseRoute, routeHash, routeContext } from "./navigation/routes.js";

export function App() {
  return (
    <UnsavedChanges>
      <Workspace />
    </UnsavedChanges>
  );
}
function Workspace() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [team, setTeam] = useState(null);
  const [project, setProject] = useState(null);
  const [view, setView] = useState("overview");
  const guard = useLeaveGuard();
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
  function navigate(nextTeam, nextProject, nextView = "tasks") {
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
      setRouteError(err.message);
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
        ? await api(`/api/teams/${encodeURIComponent(route.teamId)}`, {
            signal: controller.signal,
          })
        : null;
      const nextProject = route.projectId
        ? await api(`/api/projects/${encodeURIComponent(route.projectId)}`, {
            signal: controller.signal,
          })
        : null;
      if (nextProject && nextProject.teamId !== nextTeam._id)
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
            err.status === 404
              ? "This team or project could not be found."
              : err.message,
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
    api("/api/auth/me", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setUser(result.user);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err.status === 401) setToken(null);
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
  return (
    <AppShell
      user={user}
      team={team}
      project={project}
      view={view}
      onViewChange={(next) => navigate(team, project, next)}
      onTeams={() => navigate(null, null, "overview")}
      onTeam={() => navigate(team, null, "overview")}
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
        <TeamsScreen onOpenTeam={(next) => navigate(next, null, "overview")} />
      )}
    </AppShell>
  );
}

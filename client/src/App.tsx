import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import type { ApiError } from "./api";
import { AppShell } from "./components/AppShell";
import { AuthScreen } from "./screens/AuthScreen";
import { TeamsScreen } from "./screens/TeamsScreen";
import { TeamScreen } from "./screens/TeamScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import type { ProjectView } from "./constants";
import { useTheme } from "./theme";
import type { Project, Team, User } from "./types";

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [team, setTeam] = useState<Team | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [view, setView] = useState<ProjectView>("overview");
  useEffect(() => {
    const controller = new AbortController();
    setSessionError("");
    if (!getToken()) {
      setReady(true);
      return () => controller.abort();
    }
    setReady(false);
    api<{ user: User }>("/api/auth/me", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setUser(result.user);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        if (err.status === 401) setToken(null);
        else
          setSessionError(
            "We could not restore your session. Check your connection and try again."
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
  if (!user)
    return (
      <AuthScreen
        onReady={setUser}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  return (
    <AppShell
      user={user}
      team={team}
      project={project}
      view={view}
      theme={theme}
      onToggleTheme={toggleTheme}
      onViewChange={setView}
      onTeams={() => {
        setTeam(null);
        setProject(null);
        setView("overview");
      }}
      onTeam={() => {
        setProject(null);
        setView("overview");
      }}
      onSignOut={() => {
        setToken(null);
        setUser(null);
        setTeam(null);
        setProject(null);
        setView("overview");
      }}
    >
      {project ? (
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

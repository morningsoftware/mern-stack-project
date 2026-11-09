import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { ProjectView } from "../constants";
import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "../theme";
import type { Project, Team, User } from "../types";

export const PROJECT_VIEWS: ReadonlyArray<readonly [ProjectView, string]> = [
  ["tasks", "Task board"],
  ["overview", "Overview"],
  ["milestones", "Milestones"],
  ["bugs", "Bug reports"],
  ["builds", "Builds"],
  ["feedback", "Playtest feedback"],
];

export function AppShell({
  user,
  team,
  project,
  view,
  theme,
  onToggleTheme,
  onViewChange,
  onTeams,
  onTeam,
  onSignOut,
  children,
}: {
  user: User;
  team: Team | null;
  project: Project | null;
  view: ProjectView;
  theme: Theme;
  onToggleTheme: () => void;
  onViewChange: (view: ProjectView) => void;
  onTeams: () => void;
  onTeam: () => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const main = useRef<HTMLElement>(null);
  const previousLocation = useRef<string | null>(null);
  const location = `${team?._id || "teams"}/${project?._id || ""}/${view}`;
  useEffect(() => {
    if (previousLocation.current !== null) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      main.current?.focus({ preventScroll: true });
    }
    previousLocation.current = location;
  }, [location]);
  useEffect(() => {
    const nextTitle = project
      ? `${project.name} · Checkpoint`
      : team
        ? `${team.name} · Checkpoint`
        : "Checkpoint";
    document.title = nextTitle;
    return () => {
      if (document.title === nextTitle) document.title = "Checkpoint";
    };
  }, [team, project]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <span>Checkpoint</span>
          <ThemeToggle
            theme={theme}
            onToggle={onToggleTheme}
            className="brand-theme"
          />
        </div>
        <p className="nav-label">Workspace</p>
        <nav aria-label="Workspace navigation" className="workspace-nav">
          <button
            className="nav-item"
            aria-current={!team ? "page" : undefined}
            onClick={onTeams}
          >
            <span aria-hidden="true">◇</span>Teams
          </button>
          {team && (
            <button
              className="nav-item"
              aria-current={!project ? "page" : undefined}
              onClick={onTeam}
            >
              <span aria-hidden="true">▦</span>
              {team.name}
            </button>
          )}
        </nav>
        {project && (
          <>
            <p className="nav-label">Project / {project.name}</p>
            <nav aria-label="Project navigation" className="workspace-nav">
              {PROJECT_VIEWS.map(([key, label]) => (
                <button
                  key={key}
                  className="nav-item"
                  aria-current={view === key ? "page" : undefined}
                  onClick={() => onViewChange(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-footer">
          <span className="avatar" aria-hidden="true">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{user.displayName}</strong>
            <small>{user.role}</small>
          </div>
          <button className="text-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="workspace-bar">
          <nav aria-label="Breadcrumb">
            <ol>
              <li>
                <button className="text-button" onClick={onTeams}>
                  Teams
                </button>
              </li>
              {team && (
                <li>
                  <button className="text-button" onClick={onTeam}>
                    {team.name}
                  </button>
                </li>
              )}
              {project && <li>{project.name}</li>}
            </ol>
          </nav>
          <span className="workspace-label">
            {project
              ? "Project workspace"
              : team
                ? "Team workspace"
                : "Studio workspace"}
          </span>
        </header>
        <main
          id="main-content"
          ref={main}
          tabIndex={-1}
          className="workspace-content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

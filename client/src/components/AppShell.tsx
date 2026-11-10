import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { ProjectView } from "../constants";
import type { Project, Team, User } from "../types";

export const PROJECT_VIEWS: ReadonlyArray<readonly [ProjectView, string]> = [
  ["tasks", "Task board"],
  ["overview", "Overview"],
  ["milestones", "Milestones"],
  ["bugs", "Bug reports"],
  ["builds", "Builds"],
  ["feedback", "Playtest feedback"],
];

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function AppShell({
  user,
  team,
  project,
  view,
  accountOpen,
  onViewChange,
  onTeams,
  onTeam,
  onAccount,
  onSignOut,
  children,
}: {
  user: User;
  team: Team | null;
  project: Project | null;
  view: ProjectView;
  accountOpen: boolean;
  onViewChange: (view: ProjectView) => void;
  onTeams: () => void;
  onTeam: () => void;
  onAccount: () => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const main = useRef<HTMLElement>(null);
  const previousLocation = useRef<string | null>(null);
  const location = accountOpen
    ? "account"
    : `${team?._id || "teams"}/${project?._id || ""}/${view}`;
  useEffect(() => {
    if (previousLocation.current !== null) main.current?.focus();
    previousLocation.current = location;
  }, [location]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            Checkpoint<small>Studio workspace</small>
          </span>
        </div>
        <p className="nav-label">Workspace</p>
        <nav aria-label="Workspace navigation" className="workspace-nav">
          <button
            className="nav-item"
            aria-current={!accountOpen && !team ? "page" : undefined}
            onClick={onTeams}
          >
            <span aria-hidden="true">◇</span>Teams
          </button>
          {team && (
            <button
              className="nav-item"
              aria-current={
                !accountOpen && !project ? "page" : undefined
              }
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
                  aria-current={
                    !accountOpen && view === key ? "page" : undefined
                  }
                  onClick={() => onViewChange(key)}
                >
                  {label}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-profile"
            aria-label={`Account settings for ${user.displayName}`}
            title="Account settings"
            onClick={onAccount}
          >
            <span className="avatar" aria-hidden="true">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="sidebar-profile-name">
              <strong>{user.displayName}</strong>
              <small>{user.role}</small>
            </span>
          </button>
          <button
            type="button"
            className="icon-button sidebar-signout"
            aria-label="Sign out"
            title="Sign out"
            onClick={onSignOut}
          >
            <SignOutIcon />
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
              {accountOpen ? (
                <li>Account</li>
              ) : (
                <>
                  {team && (
                    <li>
                      <button className="text-button" onClick={onTeam}>
                        {team.name}
                      </button>
                    </li>
                  )}
                  {project && <li>{project.name}</li>}
                </>
              )}
            </ol>
          </nav>
          <span className="workspace-label">
            {accountOpen ? "Account settings" : "Team workspace"}
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

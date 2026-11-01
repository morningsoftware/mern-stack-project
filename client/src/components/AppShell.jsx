import { useEffect, useRef, useState } from "react";

export const PROJECT_VIEWS = [
  ["tasks", "Task board"],
  ["my-work", "My work"],
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
  onViewChange,
  onTeams,
  onTeam,
  onSignOut,
  children,
}) {
  const main = useRef(null);
  const [linkNotice, setLinkNotice] = useState("");
  const previousLocation = useRef(null);
  const location = `${team?._id || "teams"}/${project?._id || ""}/${view}`;
  useEffect(() => {
    const active = document.activeElement;
    const hasVisibleFocus =
      main.current?.contains(active) && !active.closest("[hidden]");
    if (previousLocation.current !== null && !hasVisibleFocus)
      main.current?.focus();
    previousLocation.current = location;
    setLinkNotice("");
  }, [location]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <span>
            Checkpoint<small>Studio workspace</small>
          </span>
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
          {project ? (
            <div className="share-project">
              <button
                type="button"
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setLinkNotice("Project link copied.");
                  } catch {
                    setLinkNotice(
                      "Copy the address from your browser to share this view.",
                    );
                  }
                }}
              >
                Copy project link
              </button>
              {linkNotice && (
                <span role="status" className="meta">
                  {linkNotice}
                </span>
              )}
            </div>
          ) : (
            <span className="workspace-label">Team workspace</span>
          )}
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

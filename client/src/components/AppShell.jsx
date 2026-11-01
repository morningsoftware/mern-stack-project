import { useEffect, useRef } from "react";

export const PROJECT_VIEWS = [
  ["overview", "Overview", "01"],
  ["milestones", "Milestones", "02"],
  ["tasks", "Tasks", "03"],
  ["bugs", "Bug reports", "04"],
  ["feedback", "Playtest feedback", "05"],
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
  const previousLocation = useRef(null);
  const location = `${team?._id || "teams"}/${project?._id || ""}/${view}`;
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
            MERN Stack Project<small>GAME DEVELOPMENT WORKSPACE</small>
          </span>
        </div>
        <p className="nav-label">WORKSPACE</p>
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
            <p className="nav-label">PROJECT / {project.name}</p>
            <nav aria-label="Project navigation" className="workspace-nav">
              {PROJECT_VIEWS.map(([key, label, number]) => (
                <button
                  key={key}
                  className="nav-item"
                  aria-current={view === key ? "page" : undefined}
                  onClick={() => onViewChange(key)}
                >
                  <span className="nav-number" aria-hidden="true">
                    {number}
                  </span>
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
          <span className="workspace-label">DEVELOP. TEST. ITERATE.</span>
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

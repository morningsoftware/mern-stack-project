import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import type { ProjectView } from "../constants";
import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "../theme";
import type { Project, Team, User } from "../types";

const SIDEBAR_WIDTH_KEY = "mern_sidebar_width";
const DEFAULT_SIDEBAR_WIDTH = 234;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;
const SIDEBAR_STEP = 16;

function clampSidebarWidth(width: number): number {
  return Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, Math.round(width))
  );
}

function readSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  try {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      return clampSidebarWidth(stored);
    }
  } catch {
    // Ignore storage access failures and use the default width.
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

const PROJECT_NAV_GROUPS: ReadonlyArray<{
  label: string;
  views: ReadonlyArray<readonly [ProjectView, string]>;
}> = [
  {
    label: "Plan",
    views: [
      ["tasks", "Task board"],
      ["overview", "Overview"],
      ["milestones", "Milestones"],
      ["my-work", "My work"],
    ],
  },
  {
    label: "Playtest",
    views: [
      ["builds", "Builds"],
      ["sessions", "Playtest sessions"],
      ["feedback", "Playtest feedback"],
      ["bugs", "Bug reports"],
    ],
  },
  {
    label: "Project",
    views: [
      ["activity", "Activity"],
      ["notifications", "Notifications"],
      ["github", "GitHub"],
    ],
  },
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
  theme,
  onToggleTheme,
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
  theme: Theme;
  onToggleTheme: () => void;
  onViewChange: (view: ProjectView) => void;
  onTeams: () => void;
  onTeam: () => void;
  onAccount: () => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const main = useRef<HTMLElement>(null);
  const [linkNotice, setLinkNotice] = useState("");
  const previousLocation = useRef<string | null>(null);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const location = accountOpen
    ? "account"
    : `${team?._id || "teams"}/${project?._id || ""}/${view}`;

  useEffect(() => {
    if (previousLocation.current !== null) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const active = document.activeElement;
      const hasVisibleFocus = Boolean(
        active && main.current?.contains(active) && !active.closest("[hidden]"),
      );
      if (!hasVisibleFocus) main.current?.focus({ preventScroll: true });
    }
    previousLocation.current = location;
    setLinkNotice("");
  }, [location]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // Ignore storage access failures; the width still applies this session.
    }
  }, [sidebarWidth]);

  useEffect(() => {
    if (!resizingSidebar) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handleMove(event: PointerEvent): void {
      const start = resizeStart.current;
      if (!start) return;
      setSidebarWidth(
        clampSidebarWidth(start.width + event.clientX - start.x)
      );
    }

    function stopResize(): void {
      resizeStart.current = null;
      setResizingSidebar(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [resizingSidebar]);

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    resizeStart.current = { x: event.clientX, width: sidebarWidth };
    setResizingSidebar(true);
  }

  function resizeSidebarWithKeyboard(
    event: ReactKeyboardEvent<HTMLDivElement>
  ): void {
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = sidebarWidth - SIDEBAR_STEP;
        break;
      case "ArrowRight":
        next = sidebarWidth + SIDEBAR_STEP;
        break;
      case "Home":
        next = MIN_SIDEBAR_WIDTH;
        break;
      case "End":
        next = MAX_SIDEBAR_WIDTH;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSidebarWidth(clampSidebarWidth(next));
  }

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
    <div
      className="app-shell"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
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
      <aside className="sidebar" id="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/brand/checkpoint-logo-light.png"
            alt="checkpoint"
            width="190"
            height="60"
          />
        </div>
        <p className="nav-label">Workspace</p>
        <nav aria-label="Workspace navigation" className="workspace-nav">
          <button
            className="nav-item"
            aria-current={!accountOpen && !team ? "page" : undefined}
            onClick={onTeams}
          >
            Teams
          </button>
          {team && (
            <button
              key={team._id}
              className="nav-item"
              aria-current={
                !accountOpen && !project ? "page" : undefined
              }
              onClick={onTeam}
            >
              {team.name}
            </button>
          )}
        </nav>
        {project && (
          <>
            <nav
              key={project._id}
              aria-label="Project navigation"
              className="workspace-nav"
            >
              {PROJECT_NAV_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className="nav-group"
                  role="group"
                  aria-labelledby={`nav-group-${group.label.toLowerCase()}`}
                >
                  <p
                    className="nav-group-label"
                    id={`nav-group-${group.label.toLowerCase()}`}
                  >
                    {group.label}
                  </p>
                  {group.views.map(([key, label]) => (
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
                </div>
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
          <ThemeToggle
            theme={theme}
            onToggle={onToggleTheme}
            className="sidebar-theme"
          />
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
        <div
          className={`sidebar-resizer${resizingSidebar ? " is-resizing" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-controls="sidebar"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuenow={sidebarWidth}
          title="Drag or use arrow keys to resize the sidebar"
          tabIndex={0}
          onPointerDown={startSidebarResize}
          onKeyDown={resizeSidebarWithKeyboard}
        />
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
          {accountOpen ? (
            <span className="workspace-label">Account settings</span>
          ) : project ? (
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

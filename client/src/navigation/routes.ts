import { PROJECT_VIEWS } from "../constants";
import type { ProjectView } from "../constants";

export interface WorkspaceRoute {
  teamId: string | null;
  projectId: string | null;
  view: ProjectView;
}

export interface HashRecord {
  _id: string;
}

export function isProjectView(value: string): value is ProjectView {
  return (PROJECT_VIEWS as readonly string[]).includes(value);
}

export function parseRoute(hash: string): WorkspaceRoute {
  if (!hash || hash === "#" || hash === "#/teams")
    return { teamId: null, projectId: null, view: "overview" };
  const match =
    /^#\/teams\/([^/]+)(?:\/projects\/([^/]+)(?:\/([^/]+))?)?$/.exec(hash);
  if (!match) throw new Error("This workspace link is not valid.");
  const view = match[2] ? match[3] || "tasks" : "overview";
  if (match[2] && !isProjectView(view))
    throw new Error("This project view does not exist.");
  try {
    return {
      teamId: decodeURIComponent(match[1]),
      projectId: match[2] ? decodeURIComponent(match[2]) : null,
      view: view as ProjectView,
    };
  } catch {
    throw new Error("This workspace link is not valid.");
  }
}

export function routeHash(
  team: HashRecord | null,
  project: HashRecord | null,
  view: ProjectView = "tasks",
): string {
  if (!team) return "#/teams";
  return `#/teams/${encodeURIComponent(team._id)}${project ? `/projects/${encodeURIComponent(project._id)}/${view}` : ""}`;
}

export function routeContext(hash: string): string {
  try {
    const route = parseRoute(hash);
    return `${route.teamId || ""}/${route.projectId || ""}`;
  } catch {
    return hash;
  }
}

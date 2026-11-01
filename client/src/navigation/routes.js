export const VIEWS = [
  "tasks",
  "overview",
  "milestones",
  "bugs",
  "builds",
  "feedback",
];
export function parseRoute(hash) {
  if (!hash || hash === "#" || hash === "#/teams")
    return { teamId: null, projectId: null, view: "overview" };
  const match =
    /^#\/teams\/([^/]+)(?:\/projects\/([^/]+)(?:\/([^/]+))?)?$/.exec(hash);
  if (!match) throw new Error("This workspace link is not valid.");
  const view = match[2] ? match[3] || "tasks" : "overview";
  if (match[2] && !VIEWS.includes(view))
    throw new Error("This project view does not exist.");
  try {
    return {
      teamId: decodeURIComponent(match[1]),
      projectId: match[2] ? decodeURIComponent(match[2]) : null,
      view,
    };
  } catch {
    throw new Error("This workspace link is not valid.");
  }
}
export function routeHash(team, project, view = "tasks") {
  if (!team) return "#/teams";
  return `#/teams/${encodeURIComponent(team._id)}${project ? `/projects/${encodeURIComponent(project._id)}/${view}` : ""}`;
}
export function routeContext(hash) {
  try {
    const route = parseRoute(hash);
    return `${route.teamId || ""}/${route.projectId || ""}`;
  } catch {
    return hash;
  }
}

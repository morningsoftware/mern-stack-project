import { httpError } from "./errors.js";
import { requireDoc } from "./validate.js";

export async function requireTeamMember(db, teamId, userId) {
  const team = await requireDoc(db.collection("teams"), teamId, "Team");
  const member = await db.collection("teamMembers").findOne({ teamId, userId });
  if (team.createdBy?.toString() !== userId.toString() && !member)
    throw httpError(403, "Only team members can perform this action");
  return team;
}
export async function requireTeamOwner(db, teamId, userId) {
  const team = await requireDoc(db.collection("teams"), teamId, "Team");
  const member = await db
    .collection("teamMembers")
    .findOne({ teamId, userId, role: "owner" });
  if (team.createdBy?.toString() !== userId.toString() && !member)
    throw httpError(403, "Only team owners can manage this team");
  return team;
}
export async function requireProjectTeamMember(db, projectId, userId) {
  const project = await requireDoc(
    db.collection("projects"),
    projectId,
    "Project",
  );
  await requireTeamMember(db, project.teamId, userId);
  return project;
}
export async function requireBugAccess(db, bug, userId) {
  if ((bug.reportedBy || bug.createdBy)?.toString() !== userId.toString())
    await requireProjectTeamMember(db, bug.projectId, userId);
}

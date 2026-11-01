import { httpError } from "./errors.js";
import { requireDoc } from "./validate.js";

export async function requireProjectTeamMember(db, projectId, userId) {
  const project = await requireDoc(
    db.collection("projects"),
    projectId,
    "Project",
  );
  const team = await requireDoc(db.collection("teams"), project.teamId, "Team");
  const member = await db
    .collection("teamMembers")
    .findOne({ teamId: project.teamId, userId });
  if (team.createdBy?.toString() !== userId.toString() && !member) {
    throw httpError(403, "Only team members can perform this action");
  }
  return project;
}

import type { Db, ObjectId, WithId } from "mongodb";
import { httpError } from "./errors.js";
import { requireDoc } from "./validate.js";
import type {
  BugReportDocument,
  ProjectDocument,
  TeamDocument,
} from "./schema.js";

export async function requireTeamMember(
  db: Db,
  teamId: ObjectId,
  userId: ObjectId,
): Promise<WithId<TeamDocument>> {
  const team = await requireDoc(
    db.collection<TeamDocument>("teams"),
    teamId,
    "Team",
  );
  const member = await db
    .collection("teamMembers")
    .findOne({ teamId, userId });
  if (team.createdBy?.toString() !== userId.toString() && !member)
    throw httpError(403, "Only team members can perform this action");
  return team;
}

export async function requireTeamOwner(
  db: Db,
  teamId: ObjectId,
  userId: ObjectId,
): Promise<WithId<TeamDocument>> {
  const team = await requireDoc(
    db.collection<TeamDocument>("teams"),
    teamId,
    "Team",
  );
  const member = await db
    .collection("teamMembers")
    .findOne({ teamId, userId, role: "owner" });
  if (team.createdBy?.toString() !== userId.toString() && !member)
    throw httpError(403, "Only team owners can manage this team");
  return team;
}

export async function requireProjectTeamMember(
  db: Db,
  projectId: ObjectId,
  userId: ObjectId,
): Promise<WithId<ProjectDocument>> {
  const project = await requireDoc(
    db.collection<ProjectDocument>("projects"),
    projectId,
    "Project",
  );
  await requireTeamMember(db, project.teamId, userId);
  return project;
}

export async function requireBugAccess(
  db: Db,
  bug: BugReportDocument,
  userId: ObjectId,
): Promise<void> {
  if ((bug.reportedBy || bug.createdBy)?.toString() !== userId.toString())
    await requireProjectTeamMember(db, bug.projectId, userId);
}

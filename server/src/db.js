import { MongoClient } from "mongodb";
import { DATABASE_NAME } from "./schema.js";

export async function connectDatabase(uri) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DATABASE_NAME);
  await ensureIndexes(db);
  return { client, db };
}

export async function ensureIndexes(db) {
  await db.collection("users").createIndex(
    { username: 1 },
    { unique: true, name: "unique_username" }
  );
  await db.collection("users").createIndex(
    { email: 1 },
    { unique: true, name: "unique_email" }
  );
  await db.collection("teams").createIndex(
    { createdBy: 1 },
    { name: "teams_by_creator" }
  );
  await db.collection("teamMembers").createIndex(
    { teamId: 1, userId: 1 },
    { unique: true, name: "unique_team_membership" }
  );
  await db.collection("teamMembers").createIndex(
    { userId: 1 },
    { name: "members_by_user" }
  );
  await db.collection("projects").createIndex(
    { teamId: 1 },
    { name: "projects_by_team" }
  );
  await db.collection("milestones").createIndex(
    { projectId: 1 },
    { name: "milestones_by_project" }
  );
  await db.collection("tasks").createIndex(
    { projectId: 1, status: 1 },
    { name: "tasks_by_project_status" }
  );
  await db.collection("tasks").createIndex(
    { assigneeId: 1 },
    { name: "tasks_by_assignee" }
  );
  await db.collection("bugReports").createIndex(
    { projectId: 1, status: 1 },
    { name: "bugs_by_project_status" }
  );
  await db.collection("playtestFeedback").createIndex(
    { projectId: 1, createdOn: -1 },
    { name: "feedback_by_project_date" }
  );
}

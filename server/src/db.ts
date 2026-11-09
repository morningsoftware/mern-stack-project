import { MongoClient } from "mongodb";
import type { Db } from "mongodb";
import { DATABASE_NAME } from "./schema.js";

export interface DatabaseConnection {
  client: MongoClient;
  db: Db;
}

export async function connectDatabase(uri: string): Promise<DatabaseConnection> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DATABASE_NAME);
  await ensureIndexes(db);
  return { client, db };
}

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("builds").createIndex(
    { projectId: 1, version: 1, platform: 1 },
    { unique: true, name: "unique_project_build_platform" }
  );
  await db.collection("builds").createIndex(
    { projectId: 1, createdOn: -1 },
    { name: "builds_by_project_date" }
  );
  await db.collection("users").createIndex(
    { username: 1 },
    { unique: true, name: "unique_username" }
  );
  await db.collection("users").createIndex(
    { email: 1 },
    { unique: true, name: "unique_email" }
  );
  await db.collection("users").createIndex(
    { "oauthAccounts.provider": 1, "oauthAccounts.providerId": 1 },
    { unique: true, sparse: true, name: "unique_oauth_account" }
  );
  await db.collection("oauthStates").createIndex(
    { expiresAt: 1 },
    { name: "oauth_states_expiry", expireAfterSeconds: 0 }
  );
  await db.collection("oauthLoginCodes").createIndex(
    { expiresAt: 1 },
    { name: "oauth_login_codes_expiry", expireAfterSeconds: 0 }
  );
  await db.collection("oauthPendingRegistrations").createIndex(
    { expiresAt: 1 },
    { name: "oauth_registrations_expiry", expireAfterSeconds: 0 }
  );
  await db.collection("oauthPendingRegistrations").createIndex(
    { provider: 1, email: 1 },
    { name: "oauth_registration_provider_email" }
  );
  await db.collection("oauthLinkChallenges").createIndex(
    { expiresAt: 1 },
    { name: "oauth_link_challenges_expiry", expireAfterSeconds: 0 }
  );
  await db.collection("oauthLinkChallenges").createIndex(
    { userId: 1, provider: 1 },
    { name: "oauth_link_challenges_user_provider" }
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

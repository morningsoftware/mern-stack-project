import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const DATABASE_NAME = "mern";

// All collections used by the application.
const COLLECTIONS = [
  "users",
  "teams",
  "teamMembers",
  "projects",
  "milestones",
  "tasks",
  "bugReports",
  "playtestFeedback",
  "builds",
  "userAvatars",
  "taskComments",
  "bugScreenshots",
  "projectActivity",
  "notifications",
  "playtestSessions",
  "githubDeliveries",
  "oauthStates",
  "oauthLoginCodes",
  "oauthPendingRegistrations",
  "oauthLinkChallenges",
] as const;

async function setupDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  console.log("Connecting to Atlas...");
  console.log("Database:", DATABASE_NAME);
  console.log("Username:", uri ? new URL(uri).username : "(missing)");

  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Set your Atlas connection string first."
    );
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(DATABASE_NAME);

    // Verify the connection before changing anything.
    await db.command({ ping: 1 });

    console.log(`Connected to MongoDB database: ${DATABASE_NAME}`);

    // Find collections that already exist.
    const existingCollections = await db
      .listCollections({}, { nameOnly: true })
      .toArray();

    const existingNames = new Set(
      existingCollections.map((collection) => collection.name)
    );

    // Create missing collections without deleting existing ones.
    for (const collectionName of COLLECTIONS) {
      if (!existingNames.has(collectionName)) {
        await db.createCollection(collectionName);
        console.log(`Created collection: ${collectionName}`);
      } else {
        console.log(`Collection already exists: ${collectionName}`);
      }
    }

    await db.collection("builds").createIndex(
      { projectId: 1, version: 1, platform: 1 },
      { unique: true, name: "unique_project_build_platform" }
    );
    await db.collection("builds").createIndex(
      { projectId: 1, createdOn: -1 },
      { name: "builds_by_project_date" }
    );
    await db.collection("taskComments").createIndex(
      { taskId: 1, _id: -1 },
      { name: "comments_by_task" }
    );
    await db.collection("bugScreenshots").createIndex(
      { bugId: 1, _id: 1 },
      { name: "screenshots_by_bug" }
    );
    await db.collection("projectActivity").createIndex(
      { projectId: 1, _id: -1 },
      { name: "activity_by_project" }
    );
    await db.collection("notifications").createIndex(
      { userId: 1, projectId: 1, _id: -1 },
      { name: "notifications_by_recipient" }
    );
    await db.collection("notifications").createIndex(
      { eventId: 1, userId: 1 },
      { unique: true, name: "unique_event_recipient" }
    );
    await db.collection("playtestSessions").createIndex(
      { projectId: 1, deadline: 1 },
      { name: "sessions_by_project_deadline" }
    );
    await db.collection("playtestFeedback").createIndex(
      { sessionId: 1 },
      { name: "feedback_by_session" }
    );
    await db.collection("githubDeliveries").createIndex(
      { deliveryId: 1 },
      { unique: true, name: "unique_github_delivery" }
    );
    await db.collection("githubDeliveries").createIndex(
      { repository: 1, event: 1, _id: -1 },
      { name: "github_deliveries_by_repository" }
    );

    // USERS
    // Prevent duplicate usernames and email addresses.
    await db.collection("users").createIndex(
      { username: 1 },
      { unique: true, name: "unique_username" }
    );

    await db.collection("users").createIndex(
      { email: 1 },
      { unique: true, name: "unique_email" }
    );

    // A provider account can be linked to only one user.
    await db.collection("users").createIndex(
      { "oauthAccounts.provider": 1, "oauthAccounts.providerId": 1 },
      { unique: true, sparse: true, name: "unique_oauth_account" }
    );

    // OAUTH
    // Expired authorization state, sign-in codes, pending registrations, and
    // link challenges are removed by MongoDB's TTL monitor.
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

    // TEAMS
    // Find teams created by a particular user.
    await db.collection("teams").createIndex(
      { createdBy: 1 },
      { name: "teams_by_creator" }
    );

    // TEAM MEMBERS
    // Prevent the same user from joining the same team twice.
    await db.collection("teamMembers").createIndex(
      { teamId: 1, userId: 1 },
      { unique: true, name: "unique_team_membership" }
    );

    await db.collection("teamMembers").createIndex(
      { userId: 1 },
      { name: "members_by_user" }
    );

    // PROJECTS
    // Find projects belonging to a team.
    await db.collection("projects").createIndex(
      { teamId: 1 },
      { name: "projects_by_team" }
    );

    // MILESTONES
    // Find milestones belonging to a project.
    await db.collection("milestones").createIndex(
      { projectId: 1 },
      { name: "milestones_by_project" }
    );

    // TASKS
    // Find tasks by project and status.
    await db.collection("tasks").createIndex(
      { projectId: 1, status: 1 },
      { name: "tasks_by_project_status" }
    );

    // Find tasks assigned to a particular user.
    await db.collection("tasks").createIndex(
      { assigneeId: 1 },
      { name: "tasks_by_assignee" }
    );

    // BUG REPORTS
    // Find bug reports by project and status.
    await db.collection("bugReports").createIndex(
      { projectId: 1, status: 1 },
      { name: "bugs_by_project_status" }
    );

    // PLAYTEST FEEDBACK
    // Retrieve a project's newest feedback first.
    await db.collection("playtestFeedback").createIndex(
      { projectId: 1, createdOn: -1 },
      { name: "feedback_by_project_date" }
    );

    console.log("Database setup completed successfully.");
    console.log("Existing documents were preserved.");
    console.log("No sample data was inserted.");
  } finally {
    await client.close();
  }
}

setupDatabase().catch((error: unknown) => {
  console.error(
    "Database setup failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});

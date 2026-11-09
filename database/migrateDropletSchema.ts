/**
 * Bring a droplet database up to the local `mern` schema.
 *
 * The droplet API (`feat/express-api`) already has these collections and
 * indexes: users, teams, teamMembers, projects, milestones, tasks, bugReports,
 * and playtestFeedback, including unique username/email, team membership, and
 * the project/task/bug/feedback lookup indexes. This migration adds only what
 * the local database has beyond that. It does not copy documents, rewrite
 * existing records, or print connection details.
 *
 * New collections: builds, taskComments, bugScreenshots, projectActivity,
 * notifications, playtestSessions, githubDeliveries.
 *
 * New optional fields, stored only when the current API writes them:
 * - users: githubLogin, githubUserId, githubAccessToken, githubRefreshToken,
 *   githubTokenExpiresAt
 * - projects: githubRepository, githubInstallationId
 * - bugReports: reproductionSteps, expectedResult, actualResult, environment,
 *   buildId, sourceFeedbackId, screenshotCount
 * - playtestFeedback: buildId, sessionId, reviewStatus, reviewedBy, reviewedOn
 *
 * Run on the droplet with its MONGODB_URI already set:
 *   npm run db:migrate-schema
 */
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config();
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(root, "server", ".env") });
}

const DATABASE_NAME = "mern";
const COLLECTIONS = [
  "builds",
  "taskComments",
  "bugScreenshots",
  "projectActivity",
  "notifications",
  "playtestSessions",
  "githubDeliveries",
] as const;

async function migrate(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing.");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(DATABASE_NAME);
    await db.command({ ping: 1 });
    const existing = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(
        (collection) => collection.name,
      ),
    );
    for (const name of COLLECTIONS) {
      if (existing.has(name)) {
        console.log(`Collection already exists: ${name}`);
      } else {
        await db.createCollection(name);
        console.log(`Created collection: ${name}`);
      }
    }

    await db.collection("builds").createIndex(
      { projectId: 1, version: 1, platform: 1 },
      { unique: true, name: "unique_project_build_platform" },
    );
    await db.collection("builds").createIndex(
      { projectId: 1, createdOn: -1 },
      { name: "builds_by_project_date" },
    );
    await db.collection("taskComments").createIndex(
      { taskId: 1, _id: -1 },
      { name: "comments_by_task" },
    );
    await db.collection("bugScreenshots").createIndex(
      { bugId: 1, _id: 1 },
      { name: "screenshots_by_bug" },
    );
    await db.collection("projectActivity").createIndex(
      { projectId: 1, _id: -1 },
      { name: "activity_by_project" },
    );
    await db.collection("notifications").createIndex(
      { userId: 1, projectId: 1, _id: -1 },
      { name: "notifications_by_recipient" },
    );
    await db.collection("notifications").createIndex(
      { eventId: 1, userId: 1 },
      { unique: true, name: "unique_event_recipient" },
    );
    await db.collection("playtestSessions").createIndex(
      { projectId: 1, deadline: 1 },
      { name: "sessions_by_project_deadline" },
    );
    await db.collection("playtestFeedback").createIndex(
      { sessionId: 1 },
      { name: "feedback_by_session" },
    );
    await db.collection("githubDeliveries").createIndex(
      { deliveryId: 1 },
      { unique: true, name: "unique_github_delivery" },
    );
    await db.collection("githubDeliveries").createIndex(
      { repository: 1, event: 1, _id: -1 },
      { name: "github_deliveries_by_repository" },
    );
    console.log("Droplet schema migration completed. Existing documents were kept.");
  } finally {
    await client.close();
  }
}

migrate().catch((error: unknown) => {
  console.error(
    "Migration failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});

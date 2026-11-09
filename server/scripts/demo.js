// Isolated local demo: never reads .env or connects to the team's database.
import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createApp } from "../src/app.js";
import { ensureIndexes } from "../src/db.js";

process.env.JWT_SECRET = randomBytes(32).toString("hex");
const mongod = await MongoMemoryServer.create(
  process.platform === "win32"
    ? {}
    : { instance: { args: ["--nounixsocket"] } },
);
const client = new MongoClient(mongod.getUri());
await client.connect();
const db = client.db("mern");
await ensureIndexes(db);
const app = createApp(db);
const port = Number(process.env.CHECKPOINT_DEMO_PORT || 4002);
const host = process.env.CHECKPOINT_DEMO_HOST || "127.0.0.1";
const server = await new Promise((resolve, reject) => {
  const listener = app.listen(port, host, () => resolve(listener));
  listener.on("error", reject);
});
const origin = `http://127.0.0.1:${port}`;
async function request(
  path,
  body,
  token,
  method = "POST",
  contentType = "application/json",
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": contentType } : {}),
    },
    ...(body !== undefined
      ? {
          body:
            contentType === "application/json" ? JSON.stringify(body) : body,
        }
      : {}),
  });
  if (!response.ok)
    throw new Error(`Demo setup ${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
try {
  const accounts = {};
  for (const username of ["demo", "sam", "tester"])
    accounts[username] = await request("/api/auth/register", {
      username,
      email: `${username}@example.test`,
      displayName: {
        demo: "Demo developer",
        sam: "Sam · teammate",
        tester: "Demo playtester",
      }[username],
      role: username === "tester" ? "playtester" : "developer",
      password: "checkpoint-demo",
    });
  const { token, user } = accounts.demo;
  const team = await request(
    "/api/teams",
    {
      name: "Pixel Forge",
      description: "Local demo studio · temporary isolated data",
    },
    token,
  );
  await request(
    `/api/teams/${team._id}/members`,
    { userId: accounts.sam.user._id, role: "developer" },
    token,
  );
  const project = await request(
    "/api/projects",
    {
      teamId: team._id,
      name: "Starfall",
      description: "A sample game for testing Checkpoint workflows.",
    },
    token,
  );
  const milestone = await request(
    "/api/milestones",
    {
      projectId: project._id,
      name: "Playable prototype",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    token,
  );
  const task = await request(
    "/api/tasks",
    {
      projectId: project._id,
      milestoneId: milestone._id,
      assigneeId: user._id,
      title: "Implement player movement",
      priority: "high",
      description: "Walking, jumping, and collision handling.",
    },
    token,
  );
  await request(
    `/api/tasks/${task._id}/comments`,
    { body: "Try keyboard and gamepad before the next playtest." },
    accounts.sam.token,
  );
  await request(
    "/api/tasks",
    {
      projectId: project._id,
      milestoneId: milestone._id,
      assigneeId: accounts.sam.user._id,
      title: "Build the first level",
      priority: "medium",
    },
    token,
  );
  const build = await request(
    "/api/builds",
    {
      projectId: project._id,
      version: "0.5.0",
      platform: "web",
      downloadUrl: "https://example.com/starfall-demo",
      releaseNotes:
        "Example URL only; replace it with your own playable build.",
    },
    token,
  );
  const session = await request(
    "/api/playtest-sessions",
    {
      projectId: project._id,
      buildId: build._id,
      title: "Movement playtest",
      instructions:
        "Test jumping at ledges. Include input method and reproduction steps.",
      deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
    },
    token,
  );
  await request(
    "/api/playtest-feedback",
    {
      projectId: project._id,
      buildId: build._id,
      sessionId: session._id,
      rating: 3,
      comments: "The jump sometimes catches on a ledge.",
    },
    accounts.tester.token,
  );
  const bug = await request(
    "/api/bug-reports",
    {
      projectId: project._id,
      buildId: build._id,
      title: "Player catches on a ledge",
      severity: "high",
      reproductionSteps: "Jump at the first platform's left edge",
      expectedResult: "Land on the platform",
      actualResult: "Player sticks to the edge",
      environment: "Example keyboard playtest",
    },
    accounts.tester.token,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=",
    "base64",
  );
  await request(
    `/api/bug-reports/${bug._id}/screenshots`,
    png,
    accounts.tester.token,
    "POST",
    "image/png",
  );
  const inbox = await request(
    `/api/notifications?projectId=${project._id}`,
    undefined,
    token,
    "GET",
  );
  const activity = await request(
    `/api/activity?projectId=${project._id}`,
    undefined,
    token,
    "GET",
  );
  if (inbox.unreadCount !== 1 || activity.events.length < 6)
    throw new Error("Demo workflow verification failed");
  console.log(`Checkpoint real API demo ready: ${origin}`);
  console.log(
    "Accounts: demo, sam, tester · password for all: checkpoint-demo",
  );
  console.log(
    "Temporary isolated MongoDB. Restarting resets sample data. No production database access.",
  );
} catch (error) {
  console.error(error.message);
  await new Promise((resolve) => server.close(resolve));
  await client.close();
  await mongod.stop();
  process.exitCode = 1;
}
async function stop() {
  await new Promise((resolve) => server.close(resolve));
  await client.close();
  await mongod.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

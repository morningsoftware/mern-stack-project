// Isolated local demo: never reads .env or connects to the team's database.
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createApp } from "../src/app.js";
import { ensureIndexes } from "../src/db.js";

interface Account {
  token: string;
  user: { _id: string };
}

interface IdDocument {
  _id: string;
}

interface Inbox {
  unreadCount: number;
}

interface ActivityFeed {
  events: unknown[];
}

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
const server = await new Promise<Server>((resolve, reject) => {
  const listener = app.listen(port, host, () => resolve(listener));
  listener.on("error", reject);
});
const origin = `http://127.0.0.1:${port}`;

async function request<T>(
  path: string,
  body?: unknown,
  token?: string,
  method = "POST",
  contentType = "application/json",
): Promise<T> {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": contentType } : {}),
    },
    ...(body !== undefined
      ? {
          body:
            contentType === "application/json"
              ? JSON.stringify(body)
              : (body as RequestInit["body"]),
        }
      : {}),
  });
  if (!response.ok)
    throw new Error(`Demo setup ${method} ${path}: ${response.status}`);
  return (response.status === 204 ? null : await response.json()) as T;
}

try {
  const accounts: Record<string, Account> = {};
  for (const username of ["demo", "sam", "tester"])
    accounts[username] = await request<Account>("/api/auth/register", {
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
  const team = await request<IdDocument>(
    "/api/teams",
    {
      name: "Pixel Forge",
      description: "Local demo studio · temporary isolated data",
    },
    token,
  );
  await request<null>(
    `/api/teams/${team._id}/members`,
    { userId: accounts.sam.user._id, role: "developer" },
    token,
  );
  const project = await request<IdDocument>(
    "/api/projects",
    {
      teamId: team._id,
      name: "Starfall",
      description: "A sample game for testing Checkpoint workflows.",
    },
    token,
  );
  const milestone = await request<IdDocument>(
    "/api/milestones",
    {
      projectId: project._id,
      name: "Playable prototype",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    token,
  );
  const task = await request<IdDocument>(
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
  await request<null>(
    `/api/tasks/${task._id}/comments`,
    { body: "Try keyboard and gamepad before the next playtest." },
    accounts.sam.token,
  );
  await request<IdDocument>(
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
  const build = await request<IdDocument>(
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
  const session = await request<IdDocument>(
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
  await request<null>(
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
  const bug = await request<IdDocument>(
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
  await request<null>(
    `/api/bug-reports/${bug._id}/screenshots`,
    png,
    accounts.tester.token,
    "POST",
    "image/png",
  );
  const inbox = await request<Inbox>(
    `/api/notifications?projectId=${project._id}`,
    undefined,
    token,
    "GET",
  );
  const activity = await request<ActivityFeed>(
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
  console.error((error as Error).message);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await client.close();
  await mongod.stop();
  process.exitCode = 1;
}

async function stop(): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await client.close();
  await mongod.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import type { Db } from "mongodb";
import request from "supertest";

type ApiClient = ReturnType<typeof request>;
import { createApp } from "../src/app.js";
import { ensureIndexes } from "../src/db.js";
import type { UserRole } from "../src/schema.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

export interface TestContext {
  db: Db;
  api: ApiClient;
  stop: () => Promise<void>;
}

export interface RegisterOverrides {
  username?: string;
  email?: string;
  displayName?: string;
  role?: UserRole;
  password?: string;
}

export interface RegisteredUser {
  body: {
    username: string;
    email: string;
    displayName: string;
    role: UserRole;
    password: string;
  };
  token: string;
  user: {
    _id: string;
    username: string;
    email: string;
    displayName: string;
    role: UserRole;
    createdOn: string;
    createdBy: string | null;
  };
}

export async function startApi(): Promise<TestContext> {
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  const db = client.db("mern");
  await ensureIndexes(db);
  const app = createApp(db);
  return {
    db,
    api: request(app),
    async stop() {
      await client.close();
      await mongod.stop();
    },
  };
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(
  api: ApiClient,
  overrides: RegisterOverrides = {}
): Promise<RegisteredUser> {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const body = {
    username: overrides.username || `user_${suffix}`,
    email: overrides.email || `user_${suffix}@example.com`,
    displayName: overrides.displayName || "Test User",
    role: overrides.role || "developer",
    password: overrides.password || "password123",
  };
  const response = await api.post("/api/auth/register").send(body);
  if (response.status !== 201) {
    throw new Error(
      `register failed: ${response.status} ${JSON.stringify(response.body)}`
    );
  }
  return {
    body,
    token: response.body.token as string,
    user: response.body.user as RegisteredUser["user"],
  };
}

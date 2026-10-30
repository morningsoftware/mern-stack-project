import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ensureIndexes } from "../src/db.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

export async function startApi() {
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

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(api, overrides = {}) {
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
    throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { body, token: response.body.token, user: response.body.user };
}

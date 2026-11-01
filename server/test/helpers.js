import express from "express";
import { appendFileSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ensureIndexes } from "../src/db.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

export async function startApi() {
  // TCP is sufficient for the isolated test client; do not create a Unix socket.
  const mongod = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  const db = client.db("mern");
  await ensureIndexes(db);
  const app = createApp(db);
  const observed = express();
  if (process.env.CHECKPOINT_ROUTE_LOG)
    observed.use((req, res, next) => {
      const path = req.path.replace(/\/[a-f0-9]{24}(?=\/|$)/gi, "/:id");
      res.once("finish", () =>
        appendFileSync(
          process.env.CHECKPOINT_ROUTE_LOG,
          JSON.stringify({ method: req.method, path, status: res.statusCode }) +
            "\n",
        ),
      );
      next();
    });
  observed.use(app);
  return {
    db,
    api: request(observed),
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
    throw new Error(
      `register failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return { body, token: response.body.token, user: response.body.user };
}

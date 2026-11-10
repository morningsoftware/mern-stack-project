import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Db } from "mongodb";
import { startApi } from "./helpers.js";

for (const key of [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "OAUTH_CALLBACK_BASE_URL",
  "CLIENT_ORIGIN",
]) {
  delete process.env[key];
}

interface TestContext {
  db: Db;
  api: any;
  stop: () => Promise<void>;
}

let ctx: TestContext;

before(async () => {
  ctx = (await startApi()) as TestContext;
});

after(async () => {
  await ctx.stop();
});

test("OAuth providers are hidden when no provider is configured", async () => {
  const providers = await ctx.api.get("/api/auth/oauth/providers");
  assert.equal(providers.status, 200);
  assert.deepEqual(providers.body.providers, []);

  const start = await ctx.api.get("/api/auth/oauth/google");
  assert.equal(start.status, 503);
  assert.match(start.body.error, /not configured/i);
});

test("unknown OAuth provider routes return 404", async () => {
  const response = await ctx.api.get("/api/auth/oauth/unknown");
  assert.equal(response.status, 404);
});

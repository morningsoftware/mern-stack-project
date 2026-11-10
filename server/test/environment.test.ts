import assert from "node:assert/strict";
import { test } from "node:test";
import type { Db } from "mongodb";
import request from "supertest";
import { prepareEnvironment } from "../src/environment.js";
import { configureOAuth } from "../src/oauth.js";
import { githubOauthConfigured } from "../src/githubOauth.js";
import { createApp } from "../src/app.js";

const keys = [
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET",
  "GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_ID", "GITHUB_REDIRECT_URI",
  "GITHUB_APP_REDIRECT_URI", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET",
  "CLIENT_ORIGIN", "OAUTH_CALLBACK_BASE_URL", "CHECKPOINT_PUBLIC_URL",
];

async function withEnvironment(env: NodeJS.ProcessEnv, run: () => Promise<void>) {
  const before = { ...process.env };
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, env);
    await run();
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
}

test("legacy GitHub App deployment starts without configuring an unintended sign-in provider", async () => {
  await withEnvironment({
    GITHUB_APP_ID: "123", GITHUB_CLIENT_ID: "legacy-app-id", GITHUB_CLIENT_SECRET: "legacy-test-secret",
    GITHUB_REDIRECT_URI: "https://checkpoint.example/api/github/callback",
    CHECKPOINT_PUBLIC_URL: "https://checkpoint.example",
  }, async () => {
    assert.throws(() => configureOAuth(), /OAUTH_CALLBACK_BASE_URL is required/);
    const messages = prepareEnvironment(process.env);
    assert.equal(process.env.GITHUB_APP_CLIENT_ID, "legacy-app-id");
    assert.equal(process.env.GITHUB_APP_CLIENT_SECRET, "legacy-test-secret");
    assert.equal(process.env.GITHUB_APP_REDIRECT_URI, "https://checkpoint.example/api/github/callback");
    assert.equal(process.env.GITHUB_CLIENT_ID, undefined);
    assert.equal(githubOauthConfigured(), true);
    assert.equal(messages.some(message => message.includes("legacy-test-secret")), false);
    const app = createApp({} as Db);
    assert.equal((await request(app).get("/api/health")).status, 200);
    assert.deepEqual((await request(app).get("/api/auth/oauth/providers")).body.providers, []);
    assert.equal((await request(app).get("/api/auth/oauth/github")).status, 503);
    assert.deepEqual(prepareEnvironment(process.env), []);
  });
});

test("new GitHub sign-in and separate App credentials remain independent", async () => {
  await withEnvironment({
    GITHUB_APP_ID: "123", GITHUB_CLIENT_ID: "sign-in-id", GITHUB_CLIENT_SECRET: "sign-in-test-secret",
    GITHUB_APP_CLIENT_ID: "app-id", GITHUB_APP_CLIENT_SECRET: "app-test-secret",
    CLIENT_ORIGIN: "https://checkpoint.example", OAUTH_CALLBACK_BASE_URL: "https://checkpoint.example",
  }, async () => {
    prepareEnvironment(process.env);
    assert.deepEqual(configureOAuth().enabledIds, ["github"]);
    assert.equal(process.env.GITHUB_CLIENT_ID, "sign-in-id");
    assert.equal(process.env.GITHUB_APP_CLIENT_ID, "app-id");
  });
});

test("trusted deployment URL supplies missing origins for new providers", async () => {
  await withEnvironment({
    GOOGLE_CLIENT_ID: "google-id", GOOGLE_CLIENT_SECRET: "google-test-secret",
    CHECKPOINT_PUBLIC_URL: "https://checkpoint.example/",
  }, async () => {
    prepareEnvironment(process.env);
    assert.equal(process.env.OAUTH_CALLBACK_BASE_URL, "https://checkpoint.example");
    assert.equal(configureOAuth().clientOrigin, "https://checkpoint.example");
    assert.deepEqual(configureOAuth().enabledIds, ["google"]);
  });
});

test("explicit origins are preserved and incomplete provider credentials still fail", async () => {
  const env = {
    CLIENT_ORIGIN: "https://client.example", OAUTH_CALLBACK_BASE_URL: "https://api.example",
    CHECKPOINT_PUBLIC_URL: "https://checkpoint.example",
  };
  prepareEnvironment(env);
  assert.equal(env.CLIENT_ORIGIN, "https://client.example");
  assert.equal(env.OAUTH_CALLBACK_BASE_URL, "https://api.example");
  await withEnvironment({ ...env, GOOGLE_CLIENT_ID: "incomplete-id" }, async () => {
    assert.throws(() => configureOAuth(), /requires both/);
  });
  assert.throws(() => prepareEnvironment({ CHECKPOINT_PUBLIC_URL: "file:///tmp/config" }), /HTTP/);
  assert.throws(() => prepareEnvironment({ CHECKPOINT_PUBLIC_URL: "https://user:password@example.com" }), /without credentials/);
});

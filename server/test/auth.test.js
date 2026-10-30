import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PUBLIC_USER_FIELDS } from "../src/schema.js";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;

before(async () => {
  ctx = await startApi();
});

after(async () => {
  await ctx.stop();
});

test("POST /api/auth/register creates a user and returns a token", async () => {
  const response = await ctx.api.post("/api/auth/register").send({
    username: "alex_dev",
    email: "Alex@Example.com",
    displayName: "Alex Rivera",
    role: "developer",
    password: "password123",
  });
  assert.equal(response.status, 201);
  assert.equal(typeof response.body.token, "string");
  assert.equal(response.body.user.email, "alex@example.com");
  assert.equal(response.body.user.createdBy, null);
  for (const field of PUBLIC_USER_FIELDS) {
    assert.ok(field in response.body.user);
  }
  assert.equal(response.body.user.passwordHash, undefined);
  assert.equal(response.body.passwordHash, undefined);
});

test("POST /api/auth/register rejects a short password, a bad role, and duplicates", async () => {
  const missing = await ctx.api.post("/api/auth/register").send({
    username: "sam_codes",
    email: "sam@example.com",
    displayName: "Sam Chen",
    role: "developer",
    password: "short",
  });
  assert.equal(missing.status, 400);

  const badRole = await ctx.api.post("/api/auth/register").send({
    username: "sam_codes",
    email: "sam@example.com",
    displayName: "Sam Chen",
    role: "owner",
    password: "password123",
  });
  assert.equal(badRole.status, 400);

  const duplicate = await ctx.api.post("/api/auth/register").send({
    username: "alex_dev",
    email: "other@example.com",
    displayName: "Other",
    role: "artist",
    password: "password123",
  });
  assert.equal(duplicate.status, 409);
});

test("POST /api/auth/login accepts username or email and rejects a bad password", async () => {
  const byName = await ctx.api.post("/api/auth/login").send({
    username: "alex_dev",
    password: "password123",
  });
  assert.equal(byName.status, 200);
  assert.equal(byName.body.user.username, "alex_dev");

  const byEmail = await ctx.api.post("/api/auth/login").send({
    email: "alex@example.com",
    password: "password123",
  });
  assert.equal(byEmail.status, 200);

  const bad = await ctx.api.post("/api/auth/login").send({
    username: "alex_dev",
    password: "wrong-password",
  });
  assert.equal(bad.status, 401);
});

test("GET /api/auth/me returns the signed-in user", async () => {
  const { token, user } = await registerUser(ctx.api, { username: "me_user" });
  const ok = await ctx.api.get("/api/auth/me").set(auth(token));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.username, user.username);

  const missing = await ctx.api.get("/api/auth/me");
  assert.equal(missing.status, 401);

  const invalid = await ctx.api.get("/api/auth/me").set(auth("not-a-token"));
  assert.equal(invalid.status, 401);
});

test("GET /api/health does not require authentication", async () => {
  const response = await ctx.api.get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

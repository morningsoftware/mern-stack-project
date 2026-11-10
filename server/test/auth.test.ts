import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PUBLIC_USER_FIELDS } from "../src/schema.js";
import type { TestContext } from "./helpers.js";
import {
  auth,
  cookieHeader,
  cookieValue,
  registerUser,
  setCookies,
  startApi,
} from "./helpers.js";

process.env.CLIENT_ORIGIN = "http://localhost:5173";

let ctx: TestContext;

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

  const tooLong = await ctx.api.post("/api/auth/register").send({
    username: "long_password",
    email: "long@example.com",
    displayName: "Long Password",
    role: "developer",
    password: "a".repeat(73),
  });
  assert.equal(tooLong.status, 400);

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

test("auth cookies authenticate and cookie mutations require CSRF", async () => {
  const registered = await ctx.api.post("/api/auth/register").send({
    username: "cookie_user",
    email: "cookie@example.com",
    displayName: "Cookie User",
    role: "developer",
    password: "password123",
  });
  assert.equal(registered.status, 201);

  const cookies = cookieHeader(registered);
  const csrf = cookieValue(registered, "mern_csrf");
  const session = setCookies(registered).find((cookie) =>
    cookie.startsWith("mern_session=")
  );
  assert.ok(cookies.includes("mern_session="));
  assert.ok(cookies.includes("mern_csrf="));
  assert.ok(session?.includes("HttpOnly"));
  assert.ok(csrf);

  const me = await ctx.api.get("/api/auth/me").set("Cookie", cookies);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, "cookie_user");

  const noCsrf = await ctx.api
    .post("/api/teams")
    .set("Cookie", cookies)
    .send({ name: "Cookie Team", description: "No CSRF header" });
  assert.equal(noCsrf.status, 403);

  const withCsrf = await ctx.api
    .post("/api/teams")
    .set("Cookie", cookies)
    .set("X-CSRF-Token", csrf as string)
    .send({ name: "Cookie Team", description: "With CSRF header" });
  assert.equal(withCsrf.status, 201);

  const sessionPair = (session as string).split(";")[0];
  const forged = await ctx.api
    .post("/api/teams")
    .set("Cookie", `${sessionPair}; mern_csrf=forged.value`)
    .set("X-CSRF-Token", "forged.value")
    .send({ name: "Forged Team", description: "Invalid CSRF signature" });
  assert.equal(forged.status, 403);

  const badOrigin = await ctx.api
    .post("/api/auth/login")
    .set("Origin", "https://evil.example")
    .send({ username: "cookie_user", password: "password123" });
  assert.equal(badOrigin.status, 403);

  const allowedOrigin = await ctx.api
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5173")
    .send({ username: "cookie_user", password: "password123" });
  assert.equal(allowedOrigin.status, 200);

  const logout = await ctx.api.post("/api/auth/logout").set("Cookie", cookies);
  assert.equal(logout.status, 204);
  assert.ok(
    setCookies(logout).some((cookie) =>
      cookie.includes("Expires=Thu, 01 Jan 1970")
    )
  );
});

test("GET /api/health does not require authentication", async () => {
  const response = await ctx.api.get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PUBLIC_USER_FIELDS } from "../src/schema.js";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let alex;
let sam;

before(async () => {
  ctx = await startApi();
  alex = await registerUser(ctx.api, { username: "alex_dev", role: "developer" });
  sam = await registerUser(ctx.api, { username: "sam_codes", role: "artist" });
});

after(async () => {
  await ctx.stop();
});

test("GET /api/users lists users without password hashes", async () => {
  const missing = await ctx.api.get("/api/users");
  assert.equal(missing.status, 401);

  const response = await ctx.api.get("/api/users").set(auth(alex.token));
  assert.equal(response.status, 200);
  assert.ok(response.body.length >= 2);
  for (const user of response.body) {
    for (const field of PUBLIC_USER_FIELDS) assert.ok(field in user);
    assert.equal(user.passwordHash, undefined);
  }
});

test("GET /api/users/:id returns one user or 404", async () => {
  const response = await ctx.api.get(`/api/users/${alex.user._id}`).set(auth(sam.token));
  assert.equal(response.status, 200);
  assert.equal(response.body.username, "alex_dev");

  const missing = await ctx.api
    .get("/api/users/64b000000000000000000000")
    .set(auth(alex.token));
  assert.equal(missing.status, 404);

  const badId = await ctx.api.get("/api/users/nope").set(auth(alex.token));
  assert.equal(badId.status, 400);
});

test("PATCH /api/users/:id updates only the signed-in user", async () => {
  const forbidden = await ctx.api
    .patch(`/api/users/${sam.user._id}`)
    .set(auth(alex.token))
    .send({ displayName: "Nope" });
  assert.equal(forbidden.status, 403);

  const empty = await ctx.api
    .patch(`/api/users/${alex.user._id}`)
    .set(auth(alex.token))
    .send({});
  assert.equal(empty.status, 400);

  const response = await ctx.api
    .patch(`/api/users/${alex.user._id}`)
    .set(auth(alex.token))
    .send({ displayName: "Alex Rivera", role: "playtester" });
  assert.equal(response.status, 200);
  assert.equal(response.body.displayName, "Alex Rivera");
  assert.equal(response.body.role, "playtester");
  assert.equal(response.body.passwordHash, undefined);
});

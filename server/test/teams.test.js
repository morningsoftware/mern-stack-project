import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let alex;

before(async () => {
  ctx = await startApi();
  alex = await registerUser(ctx.api, { username: "alex_dev" });
});

after(async () => {
  await ctx.stop();
});

test("team endpoints require authentication", async () => {
  const response = await ctx.api.get("/api/teams");
  assert.equal(response.status, 401);
});

test("POST /api/teams creates a team and an owner membership", async () => {
  const missing = await ctx.api.post("/api/teams").set(auth(alex.token)).send({});
  assert.equal(missing.status, 400);

  const response = await ctx.api.post("/api/teams").set(auth(alex.token)).send({
    name: "Pixel Forge",
    description: "A small indie game development team.",
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.name, "Pixel Forge");
  assert.equal(response.body.createdBy, alex.user._id);
  assert.ok(response.body.createdOn);

  const members = await ctx.api
    .get(`/api/teams/${response.body._id}/members`)
    .set(auth(alex.token));
  assert.equal(members.status, 200);
  assert.equal(members.body.length, 1);
  assert.equal(members.body[0].role, "owner");
  assert.equal(members.body[0].userId, alex.user._id);
});

test("GET, PATCH, and DELETE /api/teams/:id", async () => {
  const created = await ctx.api.post("/api/teams").set(auth(alex.token)).send({
    name: "Temporary",
    description: "gone soon",
  });
  const id = created.body._id;

  const fetched = await ctx.api.get(`/api/teams/${id}`).set(auth(alex.token));
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.name, "Temporary");

  const updated = await ctx.api
    .patch(`/api/teams/${id}`)
    .set(auth(alex.token))
    .send({ name: "Renamed" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, "Renamed");

  const removed = await ctx.api.delete(`/api/teams/${id}`).set(auth(alex.token));
  assert.equal(removed.status, 204);

  const missing = await ctx.api.get(`/api/teams/${id}`).set(auth(alex.token));
  assert.equal(missing.status, 404);
});

test("GET /api/teams lists created teams", async () => {
  const response = await ctx.api.get("/api/teams").set(auth(alex.token));
  assert.equal(response.status, 200);
  assert.ok(response.body.some((team) => team.name === "Pixel Forge"));
});

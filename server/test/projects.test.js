import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let alex;
let teamId;

before(async () => {
  ctx = await startApi();
  alex = await registerUser(ctx.api);
  const team = await ctx.api.post("/api/teams").set(auth(alex.token)).send({
    name: "Pixel Forge",
    description: "",
  });
  teamId = team.body._id;
});

after(async () => {
  await ctx.stop();
});

test("POST /api/projects creates an active project for a team", async () => {
  const unauthenticated = await ctx.api.post("/api/projects").send({
    teamId,
    name: "Starfall",
  });
  assert.equal(unauthenticated.status, 401);

  const missingTeam = await ctx.api.post("/api/projects").set(auth(alex.token)).send({
    teamId: "64b000000000000000000000",
    name: "Starfall",
  });
  assert.equal(missingTeam.status, 404);

  const response = await ctx.api.post("/api/projects").set(auth(alex.token)).send({
    teamId,
    name: "Starfall",
    description: "A 2D adventure game set among the stars.",
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.status, "active");
  assert.equal(response.body.teamId, teamId);
  assert.equal(response.body.createdBy, alex.user._id);
});

test("GET, PATCH, and DELETE /api/projects/:id", async () => {
  const created = await ctx.api.post("/api/projects").set(auth(alex.token)).send({
    teamId,
    name: "Side Quest",
    description: "extra",
  });
  const id = created.body._id;

  const listed = await ctx.api.get(`/api/projects?teamId=${teamId}`).set(auth(alex.token));
  assert.equal(listed.status, 200);
  assert.ok(listed.body.some((project) => project._id === id));

  const fetched = await ctx.api.get(`/api/projects/${id}`).set(auth(alex.token));
  assert.equal(fetched.status, 200);

  const updated = await ctx.api
    .patch(`/api/projects/${id}`)
    .set(auth(alex.token))
    .send({ status: "completed", name: "Side Quest Done" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "completed");

  const badStatus = await ctx.api
    .patch(`/api/projects/${id}`)
    .set(auth(alex.token))
    .send({ status: "nope" });
  assert.equal(badStatus.status, 400);

  const removed = await ctx.api.delete(`/api/projects/${id}`).set(auth(alex.token));
  assert.equal(removed.status, 204);
  const missing = await ctx.api.get(`/api/projects/${id}`).set(auth(alex.token));
  assert.equal(missing.status, 404);
});

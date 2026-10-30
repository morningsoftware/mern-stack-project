import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let token;
let projectId;

before(async () => {
  ctx = await startApi();
  const user = await registerUser(ctx.api);
  token = user.token;
  const team = await ctx.api.post("/api/teams").set(auth(token)).send({ name: "Pixel Forge" });
  const project = await ctx.api.post("/api/projects").set(auth(token)).send({
    teamId: team.body._id,
    name: "Starfall",
  });
  projectId = project.body._id;
});

after(async () => {
  await ctx.stop();
});

test("POST /api/milestones creates a milestone on a project", async () => {
  const unauthenticated = await ctx.api.post("/api/milestones").send({
    projectId,
    name: "Playable Prototype",
  });
  assert.equal(unauthenticated.status, 401);

  const response = await ctx.api.post("/api/milestones").set(auth(token)).send({
    projectId,
    name: "Playable Prototype",
    description: "Complete the first playable game level.",
    status: "in_progress",
    dueDate: "2026-11-05T23:59:00Z",
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.projectId, projectId);
  assert.equal(response.body.status, "in_progress");
  assert.ok(response.body.dueDate);
});

test("GET, PATCH, and DELETE /api/milestones/:id", async () => {
  const created = await ctx.api.post("/api/milestones").set(auth(token)).send({
    projectId,
    name: "Alpha",
  });
  const id = created.body._id;
  assert.equal(created.body.status, "todo");

  const listed = await ctx.api
    .get(`/api/milestones?projectId=${projectId}`)
    .set(auth(token));
  assert.ok(listed.body.some((milestone) => milestone._id === id));

  const updated = await ctx.api.patch(`/api/milestones/${id}`).set(auth(token)).send({
    status: "completed",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "completed");

  const removed = await ctx.api.delete(`/api/milestones/${id}`).set(auth(token));
  assert.equal(removed.status, 204);
  const missing = await ctx.api.get(`/api/milestones/${id}`).set(auth(token));
  assert.equal(missing.status, 404);
});

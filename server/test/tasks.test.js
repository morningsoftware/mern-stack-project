import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let alex;
let projectId;
let milestoneId;

before(async () => {
  ctx = await startApi();
  alex = await registerUser(ctx.api, { username: "sam_codes" });
  const team = await ctx.api.post("/api/teams").set(auth(alex.token)).send({ name: "Pixel Forge" });
  const project = await ctx.api.post("/api/projects").set(auth(alex.token)).send({
    teamId: team.body._id,
    name: "Starfall",
  });
  projectId = project.body._id;
  const milestone = await ctx.api.post("/api/milestones").set(auth(alex.token)).send({
    projectId,
    name: "Playable Prototype",
  });
  milestoneId = milestone.body._id;
});

after(async () => {
  await ctx.stop();
});

test("POST /api/tasks creates a task assigned to a user", async () => {
  const unauthenticated = await ctx.api.post("/api/tasks").send({
    projectId,
    milestoneId,
    title: "Implement player movement",
    assigneeId: alex.user._id,
  });
  assert.equal(unauthenticated.status, 401);

  const response = await ctx.api.post("/api/tasks").set(auth(alex.token)).send({
    projectId,
    milestoneId,
    title: "Implement player movement",
    description: "Add walking, jumping, and collision handling.",
    status: "in_progress",
    priority: "high",
    assigneeId: alex.user._id,
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.title, "Implement player movement");
  assert.equal(response.body.assigneeId, alex.user._id);
  assert.equal(response.body.priority, "high");
  assert.equal(response.body.status, "in_progress");
});

test("GET, PATCH, and DELETE /api/tasks/:id", async () => {
  const created = await ctx.api.post("/api/tasks").set(auth(alex.token)).send({
    projectId,
    milestoneId,
    title: "Create the first level background",
    assigneeId: alex.user._id,
  });
  const id = created.body._id;
  assert.equal(created.body.status, "todo");
  assert.equal(created.body.priority, "medium");

  const listed = await ctx.api
    .get(`/api/tasks?projectId=${projectId}&status=todo`)
    .set(auth(alex.token));
  assert.equal(listed.status, 200);
  assert.ok(listed.body.some((task) => task._id === id));

  const updated = await ctx.api.patch(`/api/tasks/${id}`).set(auth(alex.token)).send({
    status: "done",
    priority: "low",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "done");

  const removed = await ctx.api.delete(`/api/tasks/${id}`).set(auth(alex.token));
  assert.equal(removed.status, 204);
  const missing = await ctx.api.get(`/api/tasks/${id}`).set(auth(alex.token));
  assert.equal(missing.status, 404);
});

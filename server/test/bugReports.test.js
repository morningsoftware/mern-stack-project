import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let token;
let userId;
let projectId;

before(async () => {
  ctx = await startApi();
  const user = await registerUser(ctx.api, { username: "taylor_tests", role: "playtester" });
  token = user.token;
  userId = user.user._id;
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

test("POST /api/bug-reports records the reporter", async () => {
  const unauthenticated = await ctx.api.post("/api/bug-reports").send({
    projectId,
    title: "Player falls through platform",
  });
  assert.equal(unauthenticated.status, 401);

  const response = await ctx.api.post("/api/bug-reports").set(auth(token)).send({
    projectId,
    title: "Player falls through platform",
    description: "The character sometimes falls through the bridge.",
    severity: "high",
    status: "open",
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.reportedBy, userId);
  assert.equal(response.body.createdBy, userId);
  assert.equal(response.body.severity, "high");
  assert.equal(response.body.status, "open");
});

test("GET, PATCH, and DELETE /api/bug-reports/:id", async () => {
  const created = await ctx.api.post("/api/bug-reports").set(auth(token)).send({
    projectId,
    title: "Camera clips the wall",
  });
  const id = created.body._id;

  const listed = await ctx.api
    .get(`/api/bug-reports?projectId=${projectId}&status=open`)
    .set(auth(token));
  assert.ok(listed.body.some((bug) => bug._id === id));

  const updated = await ctx.api.patch(`/api/bug-reports/${id}`).set(auth(token)).send({
    status: "resolved",
    severity: "low",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, "resolved");

  const removed = await ctx.api.delete(`/api/bug-reports/${id}`).set(auth(token));
  assert.equal(removed.status, 204);
  const missing = await ctx.api.get(`/api/bug-reports/${id}`).set(auth(token));
  assert.equal(missing.status, 404);
});

import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { ObjectId } from "mongodb";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { startApi, registerUser, auth } from "./helpers.js";

let ctx: TestContext;
let owner: RegisteredUser;
let other: RegisteredUser;
let projectId: string;
let taskId: string;
let milestoneId: string;

before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  other = await registerUser(ctx.api);
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Studio" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Game" });
  projectId = project.body._id;
  const milestone = await ctx.api
    .post("/api/milestones")
    .set(auth(owner.token))
    .send({ projectId, name: "Prototype" });
  milestoneId = milestone.body._id;
  const task = await ctx.api
    .post("/api/tasks")
    .set(auth(owner.token))
    .send({
      projectId,
      milestoneId,
      assigneeId: owner.user._id,
      title: "Movement",
    });
  taskId = task.body._id;
});
after(async () => {
  await ctx?.stop();
});
test("activity records real creators, changed fields, builds, and milestones", async () => {
  await ctx.api
    .patch(`/api/tasks/${taskId}`)
    .set(auth(owner.token))
    .send({ status: "done", actorName: "forged" });
  await ctx.api
    .patch(`/api/milestones/${milestoneId}`)
    .set(auth(owner.token))
    .send({ status: "completed" });
  await ctx.api
    .post("/api/builds")
    .set(auth(owner.token))
    .send({
      projectId,
      version: "0.1",
      platform: "web",
      downloadUrl: "https://example.com/build",
    });
  const feed = await ctx.api
    .get(`/api/activity?projectId=${projectId}`)
    .set(auth(owner.token));
  assert.equal(feed.status, 200);
  assert(
    feed.body.events.some(
      (item: any) => item.resource === "build" && item.action === "created",
    ),
  );
  const status = feed.body.events.find(
    (item: any) => item.resource === "task" && item.action === "updated",
  );
  assert.deepEqual(status.changes.status, { from: "todo", to: "done" });
  assert.equal(status.actorName, owner.user.displayName);
  assert.equal(status.actorId, owner.user._id);
  const count = await ctx.db.collection("projectActivity").countDocuments();
  await ctx.api
    .patch(`/api/tasks/${taskId}`)
    .set(auth(owner.token))
    .send({ status: "done" });
  assert.equal(
    await ctx.db.collection("projectActivity").countDocuments(),
    count,
  );
});
test("failed writes create no activity; feed access and cursors are validated", async () => {
  const count = await ctx.db.collection("projectActivity").countDocuments();
  assert.equal(
    (
      await ctx.api
        .patch(`/api/tasks/${taskId}`)
        .set(auth(owner.token))
        .send({ status: "invalid" })
    ).status,
    400,
  );
  assert.equal(
    await ctx.db.collection("projectActivity").countDocuments(),
    count,
  );
  assert.equal(
    (
      await ctx.api
        .get(`/api/activity?projectId=${projectId}`)
        .set(auth(other.token))
    ).status,
    403,
  );
  assert.equal(
    (await ctx.api.get(`/api/activity?projectId=${projectId}`)).status,
    401,
  );
  assert.equal(
    (
      await ctx.api
        .get(`/api/activity?projectId=${projectId}&before=bad`)
        .set(auth(owner.token))
    ).status,
    400,
  );
});
test("activity pagination does not overlap and excludes other projects", async () => {
  await ctx.db
    .collection("projectActivity")
    .insertMany(
      Array.from({ length: 35 }, () => ({
        projectId: new ObjectId(projectId),
        actorName: "Owner",
        action: "created",
        resource: "task",
        createdOn: new Date(),
      })),
    );
  await ctx.db
    .collection("projectActivity")
    .insertOne({ projectId: new ObjectId(), label: "Excluded" });
  const first = await ctx.api
    .get(`/api/activity?projectId=${projectId}`)
    .set(auth(owner.token));
  assert.equal(first.body.events.length, 30);
  assert.equal(first.body.hasMore, true);
  const next = await ctx.api
    .get(`/api/activity?projectId=${projectId}&before=${first.body.nextBefore}`)
    .set(auth(owner.token));
  assert(
    !next.body.events.some((row: any) =>
      first.body.events.some((item: any) => item._id === row._id),
    ),
  );
  assert(next.body.events.every((row: any) => row.projectId === projectId));
});

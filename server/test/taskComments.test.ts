import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { ObjectId } from "mongodb";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { startApi, registerUser, auth } from "./helpers.js";

let ctx: TestContext;
let owner: RegisteredUser;
let outsider: RegisteredUser;
let taskId: string;
let projectId: ObjectId;

before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  outsider = await registerUser(ctx.api);
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Studio" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Game" });
  projectId = new ObjectId(project.body._id);
  const result = await ctx.db
    .collection("tasks")
    .insertOne({ projectId, title: "Movement" });
  taskId = result.insertedId.toString();
});
after(async () => {
  await ctx?.stop();
});
const url = () => `/api/tasks/${taskId}/comments`;
test("team discussion persists plain text with server-assigned authorship", async () => {
  const result = await ctx.api
    .post(url())
    .set(auth(owner.token))
    .send({
      body: "  Check jump timing\nSecond line  ",
      authorId: outsider.user._id,
      authorName: "Forged",
    });
  assert.equal(result.status, 201);
  assert.equal(result.body.authorId, owner.user._id);
  assert.equal(result.body.authorName, owner.user.displayName);
  assert.equal(result.body.body, "Check jump timing\nSecond line");
  const list = await ctx.api.get(url()).set(auth(owner.token));
  assert.equal(list.status, 200);
  assert.equal(list.body.comments[0]._id, result.body._id);
  assert.equal(list.body.comments[0].passwordHash, undefined);
  assert.equal(list.body.hasMore, false);
});
test("nonmembers cannot read or post, unauthenticated requests fail", async () => {
  for (const method of ["get", "post"] as const) {
    assert.equal(
      (
        await ctx.api[method](url())
          .set(auth(outsider.token))
          .send({ body: "No" })
      ).status,
      403,
    );
    assert.equal(
      (await ctx.api[method](url()).send({ body: "No" })).status,
      401,
    );
  }
});
test("invalid bodies, task IDs, and cursors do not insert comments", async () => {
  const count = await ctx.db.collection("taskComments").countDocuments();
  for (const body of [" ", "a".repeat(4001), 42, null]) {
    assert.equal(
      (await ctx.api.post(url()).set(auth(owner.token)).send({ body })).status,
      400,
    );
  }
  assert.equal(
    (await ctx.api.get(url() + "?before=bad").set(auth(owner.token))).status,
    400,
  );
  assert.equal(
    (await ctx.api.get("/api/tasks/bad/comments").set(auth(owner.token)))
      .status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .get(`/api/tasks/${new ObjectId()}/comments`)
        .set(auth(owner.token))
    ).status,
    404,
  );
  assert.equal(await ctx.db.collection("taskComments").countDocuments(), count);
});
test("older pages are ordered, bounded, and exclude other tasks", async () => {
  const ids = Array.from({ length: 65 }, () => new ObjectId());
  await ctx.db
    .collection("taskComments")
    .insertMany(
      ids.map((_id, i) => ({
        _id,
        taskId: new ObjectId(taskId),
        projectId,
        authorId: owner.user._id,
        body: `Note ${i}`,
        createdOn: new Date(),
      })),
    );
  await ctx.db
    .collection("taskComments")
    .insertOne({ taskId: new ObjectId(), body: "Other task" });
  const first = await ctx.api.get(url()).set(auth(owner.token));
  assert.equal(first.body.comments.length, 30);
  assert.equal(first.body.hasMore, true);
  const second = await ctx.api
    .get(url() + `?before=${first.body.nextBefore}`)
    .set(auth(owner.token));
  assert.equal(second.body.comments.length, 30);
  const overlap = second.body.comments.filter((item: any) =>
    first.body.comments.some((other: any) => other._id === item._id),
  );
  assert.equal(overlap.length, 0);
  const last = await ctx.api
    .get(url() + `?before=${second.body.nextBefore}`)
    .set(auth(owner.token));
  assert.equal(last.body.comments.length, 6);
  assert.equal(last.body.hasMore, false);
  assert(first.body.comments.every((item: any) => item.taskId === taskId));
  assert.deepEqual(
    first.body.comments.map((item: any) => item._id),
    first.body.comments.map((item: any) => item._id).sort(),
  );
});

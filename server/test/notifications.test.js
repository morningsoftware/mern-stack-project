import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { before, after, test } from "node:test";
import { startApi, registerUser, auth } from "./helpers.js";
let ctx, owner, member, tester, projectId, milestoneId, taskId, notificationId;
before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  member = await registerUser(ctx.api);
  tester = await registerUser(ctx.api);
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Studio" });
  await ctx.api
    .post(`/api/teams/${team.body._id}/members`)
    .set(auth(owner.token))
    .send({ userId: member.user._id, role: "developer" });
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
});
after(async () => {
  await ctx?.stop();
});
const inbox = () => `/api/notifications?projectId=${projectId}`;
test("assignments notify a teammate once, not the actor or nonmembers", async () => {
  const created = await ctx.api.post("/api/tasks").set(auth(owner.token)).send({
    projectId,
    milestoneId,
    title: "Movement",
    assigneeId: member.user._id,
  });
  taskId = created.body._id;
  const list = await ctx.api.get(inbox()).set(auth(member.token));
  assert.equal(list.body.unreadCount, 1);
  assert.equal(list.body.notifications[0].resourceId, taskId);
  notificationId = list.body.notifications[0]._id;
  await ctx.api
    .patch(`/api/tasks/${taskId}`)
    .set(auth(owner.token))
    .send({ status: "in_progress", assigneeId: member.user._id });
  assert.equal(
    (await ctx.api.get(inbox()).set(auth(member.token))).body.unreadCount,
    1,
  );
  await ctx.api.post("/api/tasks").set(auth(owner.token)).send({
    projectId,
    milestoneId,
    title: "Own work",
    assigneeId: owner.user._id,
  });
  assert.equal(
    (await ctx.api.get(inbox()).set(auth(owner.token))).body.unreadCount,
    0,
  );
  await ctx.api.post("/api/tasks").set(auth(owner.token)).send({
    projectId,
    milestoneId,
    title: "External assignment",
    assigneeId: tester.user._id,
  });
  assert.equal(
    await ctx.db
      .collection("notifications")
      .countDocuments({ userId: new ObjectId(tester.user._id) }),
    0,
  );
});
test("external feedback alerts team members without sending to its author", async () => {
  await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(tester.token))
    .send({ projectId, rating: 3, comments: "Needs more contrast" });
  assert.equal(
    (await ctx.api.get(inbox()).set(auth(owner.token))).body.unreadCount,
    1,
  );
  assert.equal(
    (await ctx.api.get(inbox()).set(auth(member.token))).body.unreadCount,
    2,
  );
});
test("read state is recipient-private, persistent, and validated", async () => {
  assert.equal(
    (
      await ctx.api
        .patch(`/api/notifications/${notificationId}`)
        .set(auth(owner.token))
        .send({ read: true })
    ).status,
    404,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/notifications/${notificationId}`)
        .set(auth(member.token))
        .send({ read: "yes" })
    ).status,
    400,
  );
  const read = await ctx.api
    .patch(`/api/notifications/${notificationId}`)
    .set(auth(member.token))
    .send({ read: true });
  assert.equal(read.status, 200);
  assert(read.body.readOn);
  const list = await ctx.api
    .get(inbox() + "&unread=true")
    .set(auth(member.token));
  assert.equal(list.body.unreadCount, 1);
  assert(list.body.notifications.every((item) => item._id !== notificationId));
  assert.equal(
    (
      await ctx.api
        .patch(`/api/notifications/${notificationId}`)
        .set(auth(member.token))
        .send({ read: false })
    ).body.readOn,
    null,
  );
  assert.equal(
    (await ctx.api.get(inbox()).set(auth(tester.token))).status,
    403,
  );
  assert.equal((await ctx.api.get(inbox())).status, 401);
  assert.equal(
    (await ctx.api.get(inbox() + "&unread=bad").set(auth(member.token))).status,
    400,
  );
});

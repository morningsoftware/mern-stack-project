import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { startApi, registerUser, auth } from "./helpers.js";

let ctx: TestContext;
let owner: RegisteredUser;
let member: RegisteredUser;
let outsider: RegisteredUser;
let teamId: string;
let projectId: string;
let milestoneId: string;
let taskId: string;
let bugId: string;

before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  member = await registerUser(ctx.api);
  outsider = await registerUser(ctx.api);
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Protected studio" });
  teamId = team.body._id;
  await ctx.api
    .post(`/api/teams/${teamId}/members`)
    .set(auth(owner.token))
    .send({ userId: member.user._id, role: "developer" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId, name: "Protected game" });
  projectId = project.body._id;
  const milestone = await ctx.api
    .post("/api/milestones")
    .set(auth(owner.token))
    .send({ projectId, name: "Goal" });
  milestoneId = milestone.body._id;
  const task = await ctx.api
    .post("/api/tasks")
    .set(auth(owner.token))
    .send({
      projectId,
      milestoneId,
      title: "Work",
      assigneeId: member.user._id,
    });
  taskId = task.body._id;
  const bug = await ctx.api
    .post("/api/bug-reports")
    .set(auth(member.token))
    .send({ projectId, title: "Report" });
  bugId = bug.body._id;
});
after(async () => {
  await ctx?.stop();
});
test("outsiders cannot join or take ownership to bypass private feature access", async () => {
  assert.equal(
    (
      await ctx.api
        .post(`/api/teams/${teamId}/members`)
        .set(auth(outsider.token))
        .send({ userId: outsider.user._id, role: "owner" })
    ).status,
    403,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/teams/${teamId}/members/${member.user._id}`)
        .set(auth(member.token))
        .send({ role: "owner" })
    ).status,
    403,
  );
  assert.equal(
    (await ctx.api.delete(`/api/teams/${teamId}`).set(auth(outsider.token)))
      .status,
    403,
  );
  assert.equal(
    (
      await ctx.api
        .delete(`/api/teams/${teamId}/members/${owner.user._id}`)
        .set(auth(owner.token))
    ).status,
    403,
  );
  assert.equal(
    (
      await ctx.api
        .get(`/api/activity?projectId=${projectId}`)
        .set(auth(outsider.token))
    ).status,
    403,
  );
});
test("unrelated users cannot modify or delete project work or screenshots via legacy routes", async () => {
  const cases: Array<[string, Record<string, string>]> = [
    [`/api/projects/${projectId}`, { name: "Intrusion" }],
    [`/api/milestones/${milestoneId}`, { status: "completed" }],
    [`/api/tasks/${taskId}`, { status: "done" }],
    [`/api/bug-reports/${bugId}`, { status: "resolved" }],
  ];
  for (const [path, body] of cases) {
    assert.equal(
      (await ctx.api.patch(path).set(auth(outsider.token)).send(body)).status,
      403,
    );
    assert.equal(
      (await ctx.api.delete(path).set(auth(outsider.token))).status,
      403,
    );
  }
  assert.equal(
    (
      await ctx.api
        .post("/api/projects")
        .set(auth(outsider.token))
        .send({ teamId, name: "Intrusion" })
    ).status,
    403,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/tasks")
        .set(auth(outsider.token))
        .send({
          projectId,
          milestoneId,
          title: "Intrusion",
          assigneeId: member.user._id,
        })
    ).status,
    403,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/milestones")
        .set(auth(outsider.token))
        .send({ projectId, name: "Intrusion" })
    ).status,
    403,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/tasks")
        .set(auth(owner.token))
        .send({
          projectId,
          milestoneId,
          title: "External assignee",
          assigneeId: outsider.user._id,
        })
    ).status,
    403,
  );
});
test("legitimate members can update work and external reporters can edit their own bugs", async () => {
  assert.equal(
    (
      await ctx.api
        .patch(`/api/tasks/${taskId}`)
        .set(auth(member.token))
        .send({ status: "in_progress" })
    ).status,
    200,
  );
  const created = await ctx.api
    .post("/api/bug-reports")
    .set(auth(outsider.token))
    .send({ projectId, title: "External playtest report" });
  assert.equal(created.status, 201);
  assert.equal(
    (
      await ctx.api
        .patch(`/api/bug-reports/${created.body._id}`)
        .set(auth(outsider.token))
        .send({ description: "More detail" })
    ).status,
    200,
  );
});

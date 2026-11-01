import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { ObjectId } from "mongodb";
import { startApi, registerUser, auth } from "./helpers.js";
let ctx, owner, tester, projectId, otherProject, buildId, otherBuild, sessionId;
const deadline = () => new Date(Date.now() + 86400000).toISOString();
before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  tester = await registerUser(ctx.api);
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Studio" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Game" });
  projectId = project.body._id;
  const other = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Other game" });
  otherProject = other.body._id;
  for (const id of [projectId, otherProject]) {
    const build = await ctx.api
      .post("/api/builds")
      .set(auth(owner.token))
      .send({
        projectId: id,
        version: "0.2",
        platform: "web",
        downloadUrl: "https://example.com/play",
      });
    if (id === projectId) buildId = build.body._id;
    else otherBuild = build.body._id;
  }
});
after(async () => {
  await ctx?.stop();
});
const body = () => ({
  projectId,
  buildId,
  title: "Movement playtest",
  instructions: "Test jumping at the ledge. Report input method.",
  deadline: deadline(),
});
test("team creates, lists, fetches, edits, and closes a build-specific session", async () => {
  const created = await ctx.api
    .post("/api/playtest-sessions")
    .set(auth(owner.token))
    .send(body());
  assert.equal(created.status, 201);
  sessionId = created.body._id;
  assert.equal(created.body.status, "open");
  assert.equal(
    (
      await ctx.api
        .get(`/api/playtest-sessions?projectId=${projectId}`)
        .set(auth(tester.token))
    ).body.length,
    1,
  );
  assert.equal(
    (
      await ctx.api
        .get(`/api/playtest-sessions/${sessionId}`)
        .set(auth(tester.token))
    ).status,
    200,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-sessions/${sessionId}`)
        .set(auth(owner.token))
        .send({ instructions: "Test both keyboard and gamepad" })
    ).status,
    200,
  );
});
test("session feedback retains session and build while general feedback stays compatible", async () => {
  const created = await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(tester.token))
    .send({
      projectId,
      buildId,
      sessionId,
      rating: 4,
      comments: "Good jumping",
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.sessionId, sessionId);
  assert.equal(created.body.buildId, buildId);
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-feedback/${created.body._id}`)
        .set(auth(tester.token))
        .send({ sessionId: null })
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-feedback/${created.body._id}`)
        .set(auth(tester.token))
        .send({ buildId: null })
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-feedback/${created.body._id}`)
        .set(auth(tester.token))
        .send({ comments: "Updated note" })
    ).status,
    200,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/playtest-feedback")
        .set(auth(tester.token))
        .send({ projectId, rating: 3 })
    ).status,
    201,
  );
});
test("closed/expired sessions and mismatched references reject new feedback before writes", async () => {
  const count = await ctx.db.collection("playtestFeedback").countDocuments();
  assert.equal(
    (
      await ctx.api
        .post("/api/playtest-feedback")
        .set(auth(tester.token))
        .send({
          projectId: otherProject,
          buildId: otherBuild,
          sessionId,
          rating: 3,
        })
    ).status,
    400,
  );
  await ctx.api
    .patch(`/api/playtest-sessions/${sessionId}`)
    .set(auth(owner.token))
    .send({ status: "closed" });
  assert.equal(
    (
      await ctx.api
        .post("/api/playtest-feedback")
        .set(auth(tester.token))
        .send({ projectId, buildId, sessionId, rating: 3 })
    ).status,
    409,
  );
  await ctx.db
    .collection("playtestSessions")
    .updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { status: "open", deadline: new Date(0) } },
    );
  assert.equal(
    (
      await ctx.api
        .post("/api/playtest-feedback")
        .set(auth(tester.token))
        .send({ projectId, buildId, sessionId, rating: 3 })
    ).status,
    409,
  );
  assert.equal(
    await ctx.db.collection("playtestFeedback").countDocuments(),
    count,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-sessions/${sessionId}`)
        .set(auth(owner.token))
        .send({ status: "open" })
    ).status,
    400,
  );
});
test("management, payload lengths, deadlines, and build immutability are enforced", async () => {
  assert.equal(
    (
      await ctx.api
        .post("/api/playtest-sessions")
        .set(auth(tester.token))
        .send(body())
    ).status,
    403,
  );
  assert.equal(
    (await ctx.api.post("/api/playtest-sessions").send(body())).status,
    401,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-sessions/${sessionId}`)
        .set(auth(tester.token))
        .send({ status: "closed" })
    ).status,
    403,
  );
  for (const overrides of [
    { buildId: otherBuild },
    { deadline: "2000-01-01" },
    { deadline: "bad" },
    { title: "x".repeat(121) },
    { instructions: "" },
  ])
    assert.equal(
      (
        await ctx.api
          .post("/api/playtest-sessions")
          .set(auth(owner.token))
          .send({ ...body(), ...overrides })
      ).status,
      400,
    );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-sessions/${sessionId}`)
        .set(auth(owner.token))
        .send({ buildId: otherBuild })
    ).status,
    400,
  );
});

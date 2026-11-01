import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx, owner, outsider, projectId, otherProjectId;
before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  outsider = await registerUser(ctx.api, { role: "playtester" });
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Build studio" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ name: "Game", teamId: team.body._id });
  const other = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ name: "Other game", teamId: team.body._id });
  projectId = project.body._id;
  otherProjectId = other.body._id;
});
after(async () => {
  await ctx?.stop();
});
const build = (version) => ({
  projectId,
  version,
  platform: "windows",
  downloadUrl: "https://example.com/game.zip",
  releaseNotes: "A playable prototype.",
});

test("build routes require authentication", async () => {
  assert.equal(
    (await ctx.api.get(`/api/builds?projectId=${projectId}`)).status,
    401,
  );
  assert.equal(
    (await ctx.api.post("/api/builds").send(build("unauthorized"))).status,
    401,
  );
  assert.equal(
    (await ctx.api.get("/api/builds/64b000000000000000000000")).status,
    401,
  );
  assert.equal(
    (
      await ctx.api
        .patch("/api/builds/64b000000000000000000000")
        .send({ version: "x" })
    ).status,
    401,
  );
});
test("publish, list, fetch, and edit a build without moving its project", async () => {
  const created = await ctx.api
    .post("/api/builds")
    .set(auth(owner.token))
    .send(build("0.1.0"));
  assert.equal(created.status, 201);
  assert.equal(created.body.createdBy, owner.user._id);
  const id = created.body._id;
  const list = await ctx.api
    .get(`/api/builds?projectId=${projectId}`)
    .set(auth(outsider.token));
  assert.equal(list.status, 200);
  assert(list.body.some((item) => item._id === id));
  const fetched = await ctx.api.get(`/api/builds/${id}`).set(auth(owner.token));
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.downloadUrl, "https://example.com/game.zip");
  const edited = await ctx.api
    .patch(`/api/builds/${id}`)
    .set(auth(owner.token))
    .send({
      version: "0.1.1",
      releaseNotes: "Fixed the jump.",
      projectId: otherProjectId,
    });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.projectId, projectId);
  assert.equal(edited.body.version, "0.1.1");
  assert(edited.body.updatedOn);
  assert.equal(
    (
      await ctx.api
        .post("/api/builds")
        .set(auth(owner.token))
        .send(build("0.1.1"))
    ).status,
    409,
  );
});
test("nonmembers cannot publish or edit build links", async () => {
  assert.equal(
    (
      await ctx.api
        .post("/api/builds")
        .set(auth(outsider.token))
        .send(build("outsider"))
    ).status,
    403,
  );
  const created = await ctx.api
    .post("/api/builds")
    .set(auth(owner.token))
    .send(build("membership"));
  assert.equal(
    (
      await ctx.api
        .patch(`/api/builds/${created.body._id}`)
        .set(auth(outsider.token))
        .send({ releaseNotes: "overwrite" })
    ).status,
    403,
  );
});
test("reject unsafe URLs, invalid platforms, empty edits, and invalid identifiers", async () => {
  for (const downloadUrl of [
    "http://example.com/game",
    "javascript:alert(1)",
    "https://user:secret@example.com/game",
    "not a url",
  ]) {
    assert.equal(
      (
        await ctx.api
          .post("/api/builds")
          .set(auth(owner.token))
          .send({ ...build("bad-url"), downloadUrl })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await ctx.api
        .post("/api/builds")
        .set(auth(owner.token))
        .send({ ...build("platform"), platform: "console" })
    ).status,
    400,
  );
  assert.equal(
    (await ctx.api.get("/api/builds").set(auth(owner.token))).status,
    400,
  );
  assert.equal(
    (await ctx.api.get("/api/builds/nope").set(auth(owner.token))).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .get("/api/builds/64b000000000000000000000")
        .set(auth(owner.token))
    ).status,
    404,
  );
  const created = await ctx.api
    .post("/api/builds")
    .set(auth(owner.token))
    .send(build("invalid-edit"));
  assert.equal(
    (
      await ctx.api
        .patch(`/api/builds/${created.body._id}`)
        .set(auth(owner.token))
        .send({})
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/builds/${created.body._id}`)
        .set(auth(owner.token))
        .send({ downloadUrl: "http://example.com" })
    ).status,
    400,
  );
});
test("feedback can target a build only in the same project; general feedback remains compatible", async () => {
  const created = await ctx.api
    .post("/api/builds")
    .set(auth(owner.token))
    .send(build("feedback"));
  const body = {
    projectId,
    buildId: created.body._id,
    rating: 4,
    comments: "Jump feels better.",
  };
  const feedback = await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(outsider.token))
    .send(body);
  assert.equal(feedback.status, 201);
  assert.equal(feedback.body.buildId, created.body._id);
  assert.equal(
    (
      await ctx.api
        .post("/api/playtest-feedback")
        .set(auth(outsider.token))
        .send({ ...body, projectId: otherProjectId })
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/playtest-feedback")
        .set(auth(outsider.token))
        .send({ ...body, buildId: "64b000000000000000000000" })
    ).status,
    404,
  );
  const updated = await ctx.api
    .patch(`/api/playtest-feedback/${feedback.body._id}`)
    .set(auth(outsider.token))
    .send({ buildId: null });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.buildId, null);
  const general = await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(outsider.token))
    .send({ projectId, rating: 3, comments: "General feedback" });
  assert.equal(general.status, 201);
  assert.equal(general.body.buildId, undefined);
});

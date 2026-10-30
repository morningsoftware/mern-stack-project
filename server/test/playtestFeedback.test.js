import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let taylor;
let alex;
let projectId;

before(async () => {
  ctx = await startApi();
  taylor = await registerUser(ctx.api, { username: "taylor_tests", role: "playtester" });
  alex = await registerUser(ctx.api, { username: "alex_dev" });
  const team = await ctx.api.post("/api/teams").set(auth(alex.token)).send({ name: "Pixel Forge" });
  const project = await ctx.api.post("/api/projects").set(auth(alex.token)).send({
    teamId: team.body._id,
    name: "Starfall",
  });
  projectId = project.body._id;
});

after(async () => {
  await ctx.stop();
});

test("POST /api/playtest-feedback stores a rating and comments", async () => {
  const badRating = await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(taylor.token))
    .send({ projectId, rating: 9, comments: "too high" });
  assert.equal(badRating.status, 400);

  const response = await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(taylor.token))
    .send({
      projectId,
      rating: 4,
      comments: "Fun movement and atmosphere. The controls need polish.",
    });
  assert.equal(response.status, 201);
  assert.equal(response.body.userId, taylor.user._id);
  assert.equal(response.body.rating, 4);
  assert.equal(response.body.createdBy, taylor.user._id);
});

test("GET lists newest feedback first and only the author can change it", async () => {
  const older = await ctx.api.post("/api/playtest-feedback").set(auth(taylor.token)).send({
    projectId,
    rating: 3,
    comments: "earlier note",
  });
  const newer = await ctx.api.post("/api/playtest-feedback").set(auth(alex.token)).send({
    projectId,
    rating: 5,
    comments: "later note",
  });

  const listed = await ctx.api
    .get(`/api/playtest-feedback?projectId=${projectId}`)
    .set(auth(taylor.token));
  assert.equal(listed.status, 200);
  const ids = listed.body.map((item) => item._id);
  assert.ok(ids.indexOf(newer.body._id) < ids.indexOf(older.body._id));

  const forbidden = await ctx.api
    .patch(`/api/playtest-feedback/${older.body._id}`)
    .set(auth(alex.token))
    .send({ rating: 1 });
  assert.equal(forbidden.status, 403);

  const updated = await ctx.api
    .patch(`/api/playtest-feedback/${older.body._id}`)
    .set(auth(taylor.token))
    .send({ comments: "revised" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.comments, "revised");

  const removed = await ctx.api
    .delete(`/api/playtest-feedback/${older.body._id}`)
    .set(auth(taylor.token));
  assert.equal(removed.status, 204);
  const missing = await ctx.api
    .get(`/api/playtest-feedback/${older.body._id}`)
    .set(auth(taylor.token));
  assert.equal(missing.status, 404);
});

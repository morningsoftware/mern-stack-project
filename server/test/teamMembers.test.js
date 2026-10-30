import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx;
let alex;
let sam;
let teamId;

before(async () => {
  ctx = await startApi();
  alex = await registerUser(ctx.api, { username: "alex_dev" });
  sam = await registerUser(ctx.api, { username: "sam_codes", role: "developer" });
  const team = await ctx.api.post("/api/teams").set(auth(alex.token)).send({
    name: "Pixel Forge",
    description: "A small indie game development team.",
  });
  teamId = team.body._id;
});

after(async () => {
  await ctx.stop();
});

test("POST /api/teams/:id/members adds a user once", async () => {
  const badRole = await ctx.api
    .post(`/api/teams/${teamId}/members`)
    .set(auth(alex.token))
    .send({ userId: sam.user._id, role: "playtester" });
  assert.equal(badRole.status, 400);

  const created = await ctx.api
    .post(`/api/teams/${teamId}/members`)
    .set(auth(alex.token))
    .send({ userId: sam.user._id, role: "developer" });
  assert.equal(created.status, 201);
  assert.equal(created.body.userId, sam.user._id);
  assert.equal(created.body.role, "developer");
  assert.equal(created.body.createdBy, alex.user._id);

  const duplicate = await ctx.api
    .post(`/api/teams/${teamId}/members`)
    .set(auth(alex.token))
    .send({ userId: sam.user._id, role: "artist" });
  assert.equal(duplicate.status, 409);
});

test("PATCH and DELETE /api/teams/:id/members/:userId", async () => {
  const updated = await ctx.api
    .patch(`/api/teams/${teamId}/members/${sam.user._id}`)
    .set(auth(alex.token))
    .send({ role: "artist" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.role, "artist");

  const removed = await ctx.api
    .delete(`/api/teams/${teamId}/members/${sam.user._id}`)
    .set(auth(alex.token));
  assert.equal(removed.status, 204);

  const missing = await ctx.api
    .delete(`/api/teams/${teamId}/members/${sam.user._id}`)
    .set(auth(alex.token));
  assert.equal(missing.status, 404);
});

test("member routes 404 when the team does not exist", async () => {
  const response = await ctx.api
    .get("/api/teams/64b000000000000000000000/members")
    .set(auth(alex.token));
  assert.equal(response.status, 404);
});

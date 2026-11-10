import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx: TestContext;
let user: RegisteredUser;
let other: RegisteredUser;

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=",
  "base64"
);

before(async () => {
  ctx = await startApi();
  user = await registerUser(ctx.api, {
    displayName: "Original Name",
  });
  other = await registerUser(ctx.api);
});

after(async () => {
  await ctx?.stop();
});

test("display name can be updated by the account owner", async () => {
  const updated = await ctx.api
    .patch(`/api/users/${user.user._id}`)
    .set(auth(user.token))
    .send({ displayName: "Updated Name" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.displayName, "Updated Name");

  const me = await ctx.api.get("/api/auth/me").set(auth(user.token));
  assert.equal(me.body.user.displayName, "Updated Name");

  const forbidden = await ctx.api
    .patch(`/api/users/${user.user._id}`)
    .set(auth(other.token))
    .send({ displayName: "Not Allowed" });
  assert.equal(forbidden.status, 403);

  const empty = await ctx.api
    .patch(`/api/users/${user.user._id}`)
    .set(auth(user.token))
    .send({ displayName: "" });
  assert.equal(empty.status, 400);
});

test("profile pictures can be uploaded, fetched, and removed", async () => {
  const uploaded = await ctx.api
    .post(`/api/users/${user.user._id}/avatar`)
    .set(auth(user.token))
    .set("Content-Type", "image/png")
    .send(png);
  assert.equal(uploaded.status, 201);
  assert.ok(uploaded.body.user.avatarUpdatedOn);

  const image = await ctx.api
    .get(`/api/users/${user.user._id}/avatar`)
    .set(auth(user.token));
  assert.equal(image.status, 200);
  assert.equal(image.headers["content-type"], "image/png");
  assert.deepEqual(image.body, png);

  const anonymous = await ctx.api.get(
    `/api/users/${user.user._id}/avatar`
  );
  assert.equal(anonymous.status, 401);

  const forbidden = await ctx.api
    .post(`/api/users/${user.user._id}/avatar`)
    .set(auth(other.token))
    .set("Content-Type", "image/png")
    .send(png);
  assert.equal(forbidden.status, 403);

  const invalid = await ctx.api
    .post(`/api/users/${user.user._id}/avatar`)
    .set(auth(user.token))
    .set("Content-Type", "image/png")
    .send(Buffer.from("not an image"));
  assert.equal(invalid.status, 400);

  const removed = await ctx.api
    .delete(`/api/users/${user.user._id}/avatar`)
    .set(auth(user.token));
  assert.equal(removed.status, 200);
  assert.equal(removed.body.user.avatarUpdatedOn, null);

  const missing = await ctx.api
    .get(`/api/users/${user.user._id}/avatar`)
    .set(auth(user.token));
  assert.equal(missing.status, 404);
});

import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { ObjectId } from "mongodb";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { startApi, registerUser, auth } from "./helpers.js";

let ctx: TestContext;
let owner: RegisteredUser;
let reporter: RegisteredUser;
let outsider: RegisteredUser;
let bugId: string;
let secondBug: string;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=",
  "base64",
);
before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  reporter = await registerUser(ctx.api);
  outsider = await registerUser(ctx.api);
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Studio" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Game" });
  for (let i = 0; i < 2; i++) {
    const bug = await ctx.api
      .post("/api/bug-reports")
      .set(auth(reporter.token))
      .send({ projectId: project.body._id, title: "Screenshot bug" });
    if (i === 0) bugId = bug.body._id;
    else secondBug = bug.body._id;
  }
});
after(async () => {
  await ctx?.stop();
});
const path = () => `/api/bug-reports/${bugId}/screenshots`;
test("screenshots upload, list without binary, authenticated fetch, and removal", async () => {
  const created = await ctx.api
    .post(path())
    .set(auth(reporter.token))
    .set("Content-Type", "image/png")
    .send(png);
  assert.equal(created.status, 201);
  assert.equal(created.body.size, png.length);
  assert.equal(created.body.data, undefined);
  const list = await ctx.api.get(path()).set(auth(owner.token));
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].data, undefined);
  const image = await ctx.api
    .get(path() + "/" + created.body._id)
    .set(auth(owner.token));
  assert.equal(image.status, 200);
  assert.equal(image.headers["content-type"], "image/png");
  assert.deepEqual(image.body, png);
  assert.equal(
    (
      await ctx.api
        .get(`/api/bug-reports/${secondBug}/screenshots/${created.body._id}`)
        .set(auth(owner.token))
    ).status,
    404,
  );
  assert.equal(
    (
      await ctx.api
        .delete(path() + "/" + created.body._id)
        .set(auth(owner.token))
    ).status,
    204,
  );
  assert.equal(
    (await ctx.api.get(path() + "/" + created.body._id).set(auth(owner.token)))
      .status,
    404,
  );
});
test("outsiders and unauthenticated users cannot access screenshots", async () => {
  for (const method of ["get", "post"] as const) {
    assert.equal(
      (await ctx.api[method](path()).set(auth(outsider.token))).status,
      403,
    );
    assert.equal((await ctx.api[method](path())).status, 401);
  }
  assert.equal(
    (
      await ctx.api
        .delete(path() + "/" + new ObjectId().toString())
        .set(auth(outsider.token))
    ).status,
    403,
  );
});
test("invalid image data, type spoofing, SVG, and oversize payloads are rejected", async () => {
  assert.equal(
    (
      await ctx.api
        .post(path())
        .set(auth(owner.token))
        .set("Content-Type", "image/png")
        .send(Buffer.from("not an image"))
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .post(path())
        .set(auth(owner.token))
        .set("Content-Type", "image/jpeg")
        .send(png)
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .post(path())
        .set(auth(owner.token))
        .set("Content-Type", "image/svg+xml")
        .send("<svg/> ")
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .post(path())
        .set(auth(owner.token))
        .set("Content-Type", "image/png")
        .send(Buffer.alloc(2 * 1024 * 1024 + 1))
    ).status,
    413,
  );
});
test("concurrent uploads respect the three-image cap and deletion frees a slot", async () => {
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      ctx.api
        .post(path())
        .set(auth(owner.token))
        .set("Content-Type", "image/png")
        .send(png),
    ),
  );
  assert.equal(responses.filter((res) => res.status === 201).length, 3);
  assert.equal(responses.filter((res) => res.status === 409).length, 2);
  const id = responses.find((res) => res.status === 201)!.body._id;
  await ctx.api.delete(path() + "/" + id).set(auth(owner.token));
  assert.equal(
    (
      await ctx.api
        .post(path())
        .set(auth(owner.token))
        .set("Content-Type", "image/png")
        .send(png)
    ).status,
    201,
  );
});

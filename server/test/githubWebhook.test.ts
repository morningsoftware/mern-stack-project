import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, after, test } from "node:test";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { startApi, registerUser, auth } from "./helpers.js";

const SECRET = "test-webhook-secret";

let ctx: TestContext;
let owner: RegisteredUser;

before(async () => {
  process.env.GITHUB_WEBHOOK_SECRET = SECRET;
  ctx = await startApi();
  owner = await registerUser(ctx.api);
});

after(async () => {
  await ctx?.stop();
});

test("a signed delivery is stored once and listed for a signed-in user", async () => {
  const payload = {
    action: "opened",
    repository: { full_name: "morningsoftware/mern-stack-project" },
    installation: { id: 42 },
    pull_request: { number: 12, title: "Add movement" },
  };
  const first = await deliver("pull_request", "delivery-1", payload);
  assert.equal(first.status, 204);
  const duplicate = await deliver("pull_request", "delivery-1", payload);
  assert.equal(duplicate.status, 204);

  const stored = await ctx.db.collection("githubDeliveries").find().toArray();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].event, "pull_request");
  assert.equal(stored[0].repository, "morningsoftware/mern-stack-project");
  assert.equal(stored[0].detail, "#12 · Add movement");

  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Studio" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Unlinked" });
  const listed = await ctx.api
    .get(`/api/github/deliveries?projectId=${project.body._id}`)
    .set(auth(owner.token));
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.deliveries, []);
});

test("unsigned, malformed, and anonymous requests are rejected", async () => {
  const unsigned = await ctx.api
    .post("/api/github/webhook")
    .set("x-github-event", "ping")
    .set("x-github-delivery", "delivery-2")
    .set("content-type", "application/json")
    .send({ zen: "hello" });
  assert.equal(unsigned.status, 401);

  const badJson = await ctx.api
    .post("/api/github/webhook")
    .set("x-github-event", "ping")
    .set("x-github-delivery", "delivery-3")
    .set("x-hub-signature-256", sign(Buffer.from("{")))
    .set("content-type", "application/json")
    .send("{");
  assert.equal(badJson.status, 400);

  const hidden = await ctx.api.get("/api/github/deliveries");
  assert.equal(hidden.status, 401);
});

function sign(body: Buffer): string {
  return `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
}

function deliver(event: string, deliveryId: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  return ctx.api
    .post("/api/github/webhook")
    .set("x-github-event", event)
    .set("x-github-delivery", deliveryId)
    .set("x-hub-signature-256", sign(Buffer.from(raw)))
    .set("content-type", "application/json")
    .send(raw);
}

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { signToken } from "../src/middleware/auth.js";
import {
  OAuthLinkError,
  completePendingRegistration,
  linkProviderToUser,
  resolveOAuthIdentity,
} from "../src/oauthAccounts.js";
import type { OAuthIdentity } from "../src/oauthAccounts.js";
import { auth, registerUser, startApi } from "./helpers.js";

process.env.GOOGLE_CLIENT_ID = "google-client";
process.env.GOOGLE_CLIENT_SECRET = "google-secret";
process.env.GITHUB_CLIENT_ID = "github-client";
process.env.GITHUB_CLIENT_SECRET = "github-secret";
process.env.DISCORD_CLIENT_ID = "discord-client";
process.env.DISCORD_CLIENT_SECRET = "discord-secret";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.OAUTH_CALLBACK_BASE_URL = "http://localhost:4000";

interface TestContext {
  db: Db;
  api: any;
  stop: () => Promise<void>;
}

let ctx: TestContext;

before(async () => {
  ctx = (await startApi()) as TestContext;
});

after(async () => {
  await ctx.stop();
});

function identity(overrides: Partial<OAuthIdentity> = {}): OAuthIdentity {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  return {
    provider: "google",
    providerId: `google-${suffix}`,
    email: `account_${suffix}@example.com`,
    emailVerified: true,
    displayName: "Account User",
    suggestedUsername: `account_${suffix}`,
    ...overrides,
  };
}

async function createOAuthUser(
  oauthIdentity: OAuthIdentity
): Promise<{ _id: ObjectId; token: string }> {
  const resolution = await resolveOAuthIdentity(ctx.db, oauthIdentity);
  assert.equal(resolution.action, "register");
  if (resolution.action !== "register") throw new Error("expected register");

  const user = await completePendingRegistration(ctx.db, resolution.code, {
    username: `${oauthIdentity.suggestedUsername}_created`,
    displayName: oauthIdentity.displayName,
    role: "developer",
  });
  return { _id: user._id, token: signToken(user._id) };
}

test("account reports password state and protects the last sign-in method", async () => {
  const oauthIdentity = identity();
  const { _id, token } = await createOAuthUser(oauthIdentity);

  const account = await ctx.api
    .get("/api/auth/account")
    .set(auth(token));
  assert.equal(account.status, 200);
  assert.equal(account.body.hasPassword, false);
  assert.equal(account.body.providers.length, 1);
  assert.equal(account.body.providers[0].provider, "google");
  assert.equal(account.body.providers[0].email, oauthIdentity.email);

  const blocked = await ctx.api
    .delete("/api/auth/oauth/google")
    .set(auth(token));
  assert.equal(blocked.status, 409);

  const setPassword = await ctx.api
    .post("/api/auth/password")
    .set(auth(token))
    .send({ newPassword: "newpassword123" });
  assert.equal(setPassword.status, 200);

  const login = await ctx.api
    .post("/api/auth/login")
    .send({ email: oauthIdentity.email, password: "newpassword123" });
  assert.equal(login.status, 200);

  const unlinked = await ctx.api
    .delete("/api/auth/oauth/google")
    .set(auth(token));
  assert.equal(unlinked.status, 200);
  assert.equal(unlinked.body.hasPassword, true);
  assert.deepEqual(unlinked.body.providers, []);

  const afterUnlink = await ctx.api
    .get("/api/auth/account")
    .set(auth(token));
  assert.equal(afterUnlink.body.providers.length, 0);
  assert.equal(afterUnlink.body.user._id, _id.toString());
});

test("password changes require the current password when one exists", async () => {
  const { token } = await registerUser(ctx.api, {
    username: `password_user_${Date.now()}`,
    email: `password_${Date.now()}@example.com`,
  });

  const missing = await ctx.api
    .post("/api/auth/password")
    .set(auth(token))
    .send({ newPassword: "newpassword123" });
  assert.equal(missing.status, 401);

  const wrong = await ctx.api
    .post("/api/auth/password")
    .set(auth(token))
    .send({ currentPassword: "wrong-password", newPassword: "newpassword123" });
  assert.equal(wrong.status, 401);

  const changed = await ctx.api
    .post("/api/auth/password")
    .set(auth(token))
    .send({ currentPassword: "password123", newPassword: "newpassword123" });
  assert.equal(changed.status, 200);
});

test("account link intent stores the signed-in user in OAuth state", async () => {
  const { user, token } = await registerUser(ctx.api, {
    username: `link_intent_${Date.now()}`,
    email: `link_intent_${Date.now()}@example.com`,
  });

  const start = await ctx.api
    .get("/api/auth/oauth/google?intent=link")
    .set(auth(token));
  assert.equal(start.status, 302);
  assert.equal(new URL(start.headers.location).host, "accounts.google.com");

  const state = await ctx.db
    .collection("oauthStates")
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  assert.ok(state);
  assert.equal(state.linkUserId.toString(), user._id);

  const anonymous = await ctx.api.get("/api/auth/oauth/google?intent=link");
  assert.equal(anonymous.status, 302);
  const fragment = new URLSearchParams(
    new URL(anonymous.headers.location).hash.replace(/^#/, "")
  );
  assert.equal(fragment.get("oauth_error"), "not_signed_in");
});

test("a provider account cannot be linked to two users", async () => {
  const first = await registerUser(ctx.api, {
    username: `link_first_${Date.now()}`,
    email: `link_first_${Date.now()}@example.com`,
  });
  const second = await registerUser(ctx.api, {
    username: `link_second_${Date.now()}`,
    email: `link_second_${Date.now()}@example.com`,
  });
  const oauthIdentity = identity();

  const linked = await linkProviderToUser(
    ctx.db,
    new ObjectId(first.user._id),
    oauthIdentity
  );
  assert.equal(linked.oauthAccounts?.length, 1);
  assert.equal(linked.oauthAccounts?.[0].providerId, oauthIdentity.providerId);

  await assert.rejects(
    () =>
      linkProviderToUser(
        ctx.db,
        new ObjectId(second.user._id),
        oauthIdentity
      ),
    (error: any) =>
      error instanceof OAuthLinkError && error.code === "provider_in_use"
  );

  await assert.rejects(
    () =>
      linkProviderToUser(ctx.db, new ObjectId(first.user._id), {
        ...oauthIdentity,
        providerId: `${oauthIdentity.providerId}-different`,
      }),
    (error: any) =>
      error instanceof OAuthLinkError &&
      error.code === "provider_already_linked"
  );
});

test("concurrent unlinks cannot remove the last sign-in method", async () => {
  const oauthIdentity = identity();
  const { _id, token } = await createOAuthUser(oauthIdentity);
  await linkProviderToUser(
    ctx.db,
    _id,
    identity({
      provider: "github",
      providerId: `github-${Date.now()}${Math.floor(Math.random() * 10000)}`,
    })
  );

  const results = await Promise.all([
    ctx.api.delete("/api/auth/oauth/google").set(auth(token)),
    ctx.api.delete("/api/auth/oauth/github").set(auth(token)),
  ]);
  const statuses = results.map((result) => result.status).sort();
  assert.deepEqual(statuses, [200, 409]);

  const account = await ctx.api
    .get("/api/auth/account")
    .set(auth(token));
  assert.equal(account.status, 200);
  assert.equal(account.body.hasPassword, false);
  assert.equal(account.body.providers.length, 1);
});

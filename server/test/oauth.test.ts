import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Db } from "mongodb";
import { DiscordStrategy } from "../src/discordStrategy.js";
import {
  OAuthProfileError,
  completePendingRegistration,
  inspectPendingRegistration,
  normalizeOAuthProfile,
  resolveOAuthIdentity,
} from "../src/oauthAccounts.js";
import type {
  OAuthIdentity,
  OAuthResolution,
  RawOAuthProfile,
} from "../src/oauthAccounts.js";
import { mongoStateStore } from "../src/oauth.js";
import { createLoginCode } from "../src/oauthCodes.js";
import { hashToken } from "../src/oauthTokens.js";
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
    email: `oauth_${suffix}@example.com`,
    emailVerified: true,
    displayName: "OAuth User",
    suggestedUsername: `oauth_${suffix}`,
    ...overrides,
  };
}

function locationParams(location: string) {
  const url = new URL(location);
  return {
    url,
    fragment: new URLSearchParams(url.hash.replace(/^#/, "")),
  };
}

function callStore(
  store: any,
  method: string,
  ...args: any[]
): Promise<{ value: any; info: any }> {
  return new Promise((resolve, reject) => {
    store[method](...args, (error: any, value: any, info: any) => {
      if (error) reject(error);
      else resolve({ value, info });
    });
  });
}

type RegisterResolution = Extract<OAuthResolution, { action: "register" }>;
type LoginResolution = Extract<OAuthResolution, { action: "login" }>;
type LinkResolution = Extract<OAuthResolution, { action: "link" }>;

function requireRegister(result: OAuthResolution): RegisterResolution {
  if (result.action !== "register") throw new Error("expected register");
  return result;
}

function requireLogin(result: OAuthResolution): LoginResolution {
  if (result.action !== "login") throw new Error("expected login");
  return result;
}

function requireLink(result: OAuthResolution): LinkResolution {
  if (result.action !== "link") throw new Error("expected link");
  return result;
}

test("GET /api/auth/oauth/providers lists enabled providers", async () => {
  const response = await ctx.api.get("/api/auth/oauth/providers");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.providers, [
    { id: "google", label: "Google" },
    { id: "github", label: "GitHub" },
    { id: "discord", label: "Discord" },
  ]);
});

test("OAuth start routes redirect with state and PKCE", async () => {
  const expected = {
    google: { host: "accounts.google.com", scope: "profile email" },
    github: { host: "github.com", scope: "read:user,user:email" },
    discord: { host: "discord.com", scope: "identify email" },
  };

  for (const [provider, details] of Object.entries(expected)) {
    const response = await ctx.api.get(`/api/auth/oauth/${provider}`);
    assert.equal(response.status, 302);
    const { url } = locationParams(response.headers.location);
    assert.equal(url.host, details.host);
    assert.equal(url.searchParams.get("scope"), details.scope);
    assert.ok(url.searchParams.get("state"));
    assert.ok(url.searchParams.get("code_challenge"));
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      `http://localhost:4000/api/auth/oauth/${provider}/callback`
    );
  }

  const states = await ctx.db.collection("oauthStates").find({}).toArray();
  assert.ok(states.length >= 3);
  for (const state of states) {
    assert.ok(state.codeVerifier);
    assert.ok(state.expiresAt > new Date());
  }
});

test("OAuth callback rejects an invalid state before contacting the provider", async () => {
  const response = await ctx.api.get(
    "/api/auth/oauth/google/callback?code=not-a-real-code&state=not-a-real-state"
  );
  assert.equal(response.status, 302);
  const { url, fragment } = locationParams(response.headers.location);
  assert.equal(url.origin, "http://localhost:5173");
  assert.equal(fragment.get("oauth_error"), "state");
  assert.equal(fragment.get("provider"), "google");
});

test("state store verifies PKCE state once and rejects replay", async () => {
  const req = {
    params: { provider: "google" },
    app: { locals: { db: ctx.db } },
  };
  const stored = await callStore(
    mongoStateStore,
    "store",
    req,
    "code-verifier",
    true,
    {}
  );
  assert.ok(stored.value);

  const verified = await callStore(
    mongoStateStore,
    "verify",
    req,
    stored.value,
    {}
  );
  assert.equal(verified.value, "code-verifier");

  const replay = await callStore(
    mongoStateStore,
    "verify",
    req,
    stored.value,
    {}
  );
  assert.equal(replay.value, false);
  assert.equal(replay.info.code, "state");
});

test("OAuth profiles require a provider-verified email", () => {
  const google = normalizeOAuthProfile("google", {
    id: "google-1",
    displayName: "Ada Lovelace",
    emails: [{ value: "Ada@Example.com", verified: true }],
  });
  assert.equal(google.email, "ada@example.com");
  assert.equal(google.providerId, "google-1");
  assert.equal(google.emailVerified, true);
  assert.equal(google.suggestedUsername, "ada_lovelace");

  const github = normalizeOAuthProfile("github", {
    id: "github-1",
    username: "octocat",
    displayName: "The Octocat",
    emails: [
      { value: "secondary@example.com", verified: true, primary: false },
      { value: "primary@example.com", verified: true, primary: true },
    ],
  });
  assert.equal(github.email, "primary@example.com");

  assert.throws(
    () =>
      normalizeOAuthProfile("google", {
        id: "google-2",
        displayName: "Unverified",
        emails: [{ value: "unverified@example.com", verified: false }],
      }),
    (error: any) =>
      error instanceof OAuthProfileError && error.code === "email_unverified"
  );

  assert.throws(
    () =>
      normalizeOAuthProfile("discord", {
        id: "discord-1",
        username: "discord-user",
        email: "discord@example.com",
        verified: false,
      }),
    (error: any) =>
      error instanceof OAuthProfileError && error.code === "email_unverified"
  );
});

test("Discord strategy maps the verified profile used by account linking", async () => {
  const strategy = new DiscordStrategy(
    {
      clientID: "discord-client",
      clientSecret: "discord-secret",
      callbackURL: "http://localhost:4000/api/auth/oauth/discord/callback",
      scope: ["identify", "email"],
    },
    () => {}
  );
  (strategy as any)._oauth2.get = (url: string, accessToken: string, done: any) => {
    assert.equal(url, "https://discord.com/api/users/@me");
    assert.equal(accessToken, "access-token");
    done(
      null,
      JSON.stringify({
        id: "discord-123",
        username: "discord_user",
        global_name: "Discord User",
        email: "Discord@Example.com",
        verified: true,
      })
    );
  };

  const profile: any = await new Promise((resolve, reject) => {
    strategy.userProfile("access-token", (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
  assert.equal(profile.id, "discord-123");
  assert.equal(profile.displayName, "Discord User");
  assert.equal(profile.verified, true);
  assert.equal(
    normalizeOAuthProfile("discord", profile as RawOAuthProfile).email,
    "discord@example.com"
  );
});

test("new OAuth identity creates a pending registration and completes onboarding", async () => {
  const oauthIdentity = identity();
  const resolution = requireRegister(await resolveOAuthIdentity(ctx.db, oauthIdentity));
  assert.equal(resolution.action, "register");
  assert.equal(
    await ctx.db.collection("users").findOne({ email: oauthIdentity.email }),
    null
  );

  const inspected = await ctx.api
    .post("/api/auth/oauth/registration/inspect")
    .send({ code: resolution.code });
  assert.equal(inspected.status, 200);
  assert.equal(inspected.body.registration.email, oauthIdentity.email);
  assert.equal(
    inspected.body.registration.suggestedUsername,
    oauthIdentity.suggestedUsername
  );

  const completed = await ctx.api
    .post("/api/auth/oauth/registration/complete")
    .send({
      code: resolution.code,
      username: `${oauthIdentity.suggestedUsername}_chosen`,
      displayName: "Chosen Name",
      role: "artist",
    });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.user.username, `${oauthIdentity.suggestedUsername}_chosen`);
  assert.equal(completed.body.user.role, "artist");
  assert.equal(completed.body.user.email, oauthIdentity.email);
  assert.equal(completed.body.user.passwordHash, undefined);

  const stored = await ctx.db
    .collection("users")
    .findOne({ email: oauthIdentity.email });
  assert.ok(stored);
  assert.equal(stored.emailVerified, true);
  assert.equal(stored.passwordHash, undefined);
  assert.equal(stored.oauthAccounts[0].provider, "google");
  assert.equal(stored.oauthAccounts[0].providerId, oauthIdentity.providerId);

  const me = await ctx.api.get("/api/auth/me").set(auth(completed.body.token));
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, oauthIdentity.email);

  const replay = await ctx.api
    .post("/api/auth/oauth/registration/complete")
    .send({
      code: resolution.code,
      username: `${oauthIdentity.suggestedUsername}_again`,
      displayName: "Chosen Name",
      role: "artist",
    });
  assert.equal(replay.status, 401);
});

test("existing provider identity logs in without creating another user", async () => {
  const oauthIdentity = identity();
  const pending = requireRegister(await resolveOAuthIdentity(ctx.db, oauthIdentity));
  const user = await completePendingRegistration(
    ctx.db,
    pending.code,
    {
      username: `${oauthIdentity.suggestedUsername}_login`,
      displayName: "Login User",
      role: "developer",
    }
  );

  const login = requireLogin(await resolveOAuthIdentity(ctx.db, {
    ...oauthIdentity,
    email: "changed@example.com",
    displayName: "Changed Name",
  }));
  assert.equal(login.action, "login");
  assert.equal(login.user._id.toString(), user._id.toString());
  assert.equal(
    await ctx.db.collection("users").countDocuments({ email: oauthIdentity.email }),
    1
  );
});

test("verified email links a second provider to an OAuth user", async () => {
  const oauthIdentity = identity();
  const pending = requireRegister(await resolveOAuthIdentity(ctx.db, oauthIdentity));
  const user = await completePendingRegistration(ctx.db, pending.code, {
    username: `${oauthIdentity.suggestedUsername}_multi`,
    displayName: "Multi Provider",
    role: "developer",
  });

  const secondProvider = {
    ...oauthIdentity,
    provider: "github",
    providerId: `github-${Date.now()}`,
  };
  const linked = await resolveOAuthIdentity(ctx.db, secondProvider);
  assert.equal(linked.action, "login");
  assert.equal(linked.user._id.toString(), user._id.toString());
  assert.equal(linked.user.oauthAccounts?.length, 2);
});

test("login codes are single-use and expire", async () => {
  const { user } = await registerUser(ctx.api, {
    username: `code_user_${Date.now()}`,
    email: `code_${Date.now()}@example.com`,
  });
  const storedUser = await ctx.db
    .collection("users")
    .findOne({ email: user.email });
  assert.ok(storedUser);

  const code = await createLoginCode(ctx.db, storedUser._id, "google");
  const exchanged = await ctx.api
    .post("/api/auth/oauth/exchange")
    .send({ code });
  assert.equal(exchanged.status, 200);
  assert.equal(exchanged.body.user.email, user.email);
  assert.ok(exchanged.body.token);

  const me = await ctx.api
    .get("/api/auth/me")
    .set(auth(exchanged.body.token));
  assert.equal(me.status, 200);

  const replay = await ctx.api
    .post("/api/auth/oauth/exchange")
    .send({ code });
  assert.equal(replay.status, 401);

  const expiredCode = await createLoginCode(ctx.db, storedUser._id, "google");
  await ctx.db
    .collection("oauthLoginCodes")
    .updateOne(
      { _id: hashToken(expiredCode) } as any,
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
  const expired = await ctx.api
    .post("/api/auth/oauth/exchange")
    .send({ code: expiredCode });
  assert.equal(expired.status, 401);
});

test("a password account requires one-time password confirmation before linking", async () => {
  const { user } = await registerUser(ctx.api, {
    username: `link_user_${Date.now()}`,
    email: `link_${Date.now()}@example.com`,
  });

  const oauthIdentity = identity({
    provider: "github",
    providerId: `github-link-${Date.now()}`,
    email: user.email,
    displayName: "Link User",
    suggestedUsername: "link_user",
  });
  const challenge = requireLink(await resolveOAuthIdentity(ctx.db, oauthIdentity));
  assert.equal(challenge.action, "link");

  const wrong = await ctx.api
    .post("/api/auth/oauth/link/complete")
    .send({ code: challenge.code, password: "wrong-password" });
  assert.equal(wrong.status, 401);

  const correct = await ctx.api
    .post("/api/auth/oauth/link/complete")
    .send({ code: challenge.code, password: "password123" });
  assert.equal(correct.status, 200);
  assert.equal(correct.body.user.email, user.email);

  const stored = await ctx.db
    .collection("users")
    .findOne({ email: user.email });
  assert.ok(stored);
  assert.equal(stored.emailVerified, true);
  assert.equal(stored.passwordHash !== undefined, true);
  assert.equal(
    stored.oauthAccounts?.some(
      (account: any) =>
        account.provider === "github" &&
        account.providerId === oauthIdentity.providerId
    ),
    true
  );
});

test("link challenges stop accepting passwords after repeated failures", async () => {
  const { user } = await registerUser(ctx.api, {
    username: `limit_user_${Date.now()}`,
    email: `limit_${Date.now()}@example.com`,
  });
  const challenge = requireLink(await resolveOAuthIdentity(ctx.db, identity({
    provider: "discord",
    providerId: `discord-limit-${Date.now()}`,
    email: user.email,
  })));
  assert.equal(challenge.action, "link");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrong = await ctx.api
      .post("/api/auth/oauth/link/complete")
      .send({ code: challenge.code, password: "wrong-password" });
    assert.equal(wrong.status, 401);
  }

  const correct = await ctx.api
    .post("/api/auth/oauth/link/complete")
    .send({ code: challenge.code, password: "password123" });
  assert.equal(correct.status, 401);
});

test("onboarding rejects an invalid role without consuming the sign-up code", async () => {
  const oauthIdentity = identity();
  const pending = requireRegister(await resolveOAuthIdentity(ctx.db, oauthIdentity));
  assert.equal(pending.action, "register");

  const invalid = await ctx.api
    .post("/api/auth/oauth/registration/complete")
    .send({
      code: pending.code,
      username: `${oauthIdentity.suggestedUsername}_bad_role`,
      displayName: "Bad Role",
      role: "owner",
    });
  assert.equal(invalid.status, 400);

  const inspected = await inspectPendingRegistration(
    ctx.db,
    pending.code
  );
  assert.ok(inspected);
});

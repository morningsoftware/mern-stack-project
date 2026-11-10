import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, after, test } from "node:test";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { startApi, registerUser, auth } from "./helpers.js";

const REPO = "morningsoftware/mern-stack-project";
let ctx: TestContext;
let owner: RegisteredUser;
let previousFetch: typeof fetch | undefined;

before(async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const directory = mkdtempSync(join(tmpdir(), "checkpoint-github-"));
  const keyPath = join(directory, "app.pem");
  writeFileSync(keyPath, privateKey.export({ type: "pkcs1", format: "pem" }));
  process.env.GITHUB_APP_ID = "12345";
  process.env.GITHUB_PRIVATE_KEY_PATH = keyPath;
  process.env.GITHUB_WEBHOOK_SECRET = "test-webhook-secret";
  process.env.GITHUB_CLIENT_ID = "client";
  process.env.GITHUB_CLIENT_SECRET = "secret";
  process.env.GITHUB_REDIRECT_URI = "http://127.0.0.1:4000/api/github/callback";
  process.env.CLIENT_ORIGIN = "http://127.0.0.1:5173";
  previousFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes("/login/oauth/access_token")) {
      return json({ access_token: "user-token", token_type: "bearer" });
    }
    if (address.endsWith("/user/installations")) {
      return json({ installations: [{ id: 7 }] });
    }
    if (
      address.includes("/user/installations/") &&
      address.includes("/repositories")
    ) {
      return json({ repositories: [{ full_name: REPO }] });
    }
    if (address.endsWith("/user")) return json({ login: "octocat", id: 1 });
    if (address.endsWith("/app/installations") && options.method !== "POST") {
      return json([{ id: 7 }]);
    }
    if (address.includes("/access_tokens")) return json({ token: "install" });
    if (address.includes("/installation/repositories")) {
      return json({ repositories: [{ full_name: REPO }] });
    }
    if (address.includes("/pulls")) {
      return json([
        {
          number: 4,
          title: "Fix jump",
          state: "open",
          html_url: "https://github.com/example/pull/4",
          user: { login: "sam" },
        },
      ]);
    }
    if (address.includes("/check-runs") && options.method === "POST") {
      return json({
        id: 9,
        html_url: "https://github.com/example/check/9",
        status: "completed",
        conclusion: "success",
      });
    }
    if (address.includes("/check-runs")) {
      return json({
        check_runs: [
          {
            name: "Playtest",
            status: "completed",
            conclusion: "success",
            html_url: "https://github.com/example/check/9",
          },
        ],
      });
    }
    if (address.includes("/languages")) return json({ TypeScript: 80, CSS: 20 });
    if (address.includes("/contributors")) {
      return json([
        {
          login: "sam",
          contributions: 4,
          html_url: "https://github.com/sam",
        },
      ]);
    }
    if (address.includes("/branches")) {
      return json([
        { name: "main", protected: true, commit: { sha: "aaa1111" } },
        { name: "feat", protected: false, commit: { sha: "bbb2222" } },
      ]);
    }
    if (address.includes("/commits")) {
      return json([
        {
          sha: "bbb2222ccc",
          html_url: `https://github.com/${REPO}/commit/bbb2222ccc`,
          commit: {
            message: "Add camera\n\nDetails",
            author: { name: "Sam", date: "2026-11-02T00:00:00Z" },
          },
          author: { login: "sam" },
        },
      ]);
    }
    if (address.endsWith("/graphql")) {
      return json({
        data: {
          repository: {
            refs: {
              pageInfo: { hasNextPage: false },
              nodes: [
                {
                  name: "main",
                  target: {
                    oid: "aaa1111",
                    committedDate: "2026-10-01T00:00:00Z",
                    messageHeadline: "Start project",
                    author: { name: "Alex", user: { login: "alex" } },
                  },
                },
                {
                  name: "feat",
                  target: {
                    oid: "bbb2222",
                    committedDate: "2026-11-02T00:00:00Z",
                    messageHeadline: "Add camera",
                    author: { name: "Sam", user: { login: "sam" } },
                  },
                },
              ],
            },
          },
        },
      });
    }
    if (address.endsWith(`/repos/${REPO}`)) {
      return json({
        full_name: REPO,
        description: "Studio tools",
        private: true,
        archived: false,
        html_url: `https://github.com/${REPO}`,
        homepage: null,
        stargazers_count: 12,
        forks_count: 2,
        open_issues_count: 3,
        language: "TypeScript",
        license: { name: "MIT License" },
        default_branch: "main",
        pushed_at: "2026-11-02T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      });
    }
    throw new Error(`Unexpected GitHub request ${address}`);
  };
  ctx = await startApi();
  owner = await registerUser(ctx.api);
});

after(async () => {
  if (previousFetch) global.fetch = previousFetch;
  await ctx?.stop();
});

test("a project can link, filter, and clear a GitHub repository", async () => {
  const missing = await ctx.api
    .get("/api/github/repositories")
    .set(auth(owner.token));
  assert.equal(missing.status, 200);
  assert.equal(missing.body.connected, false);
  assert.deepEqual(missing.body.repositories, []);

  const connect = await ctx.api
    .get("/api/github/connect")
    .query({ returnTo: "http://127.0.0.1:5173/#/teams" })
    .set(auth(owner.token));
  assert.equal(connect.status, 200);
  const state = new URL(connect.body.url).searchParams.get("state");
  const callback = await ctx.api.get("/api/github/callback").query({
    code: "abc",
    state,
  });
  assert.equal(callback.status, 302);

  const account = await ctx.api
    .get("/api/github/repositories")
    .set(auth(owner.token));
  assert.equal(account.status, 200);
  assert.equal(account.body.connected, true);
  assert.equal(account.body.login, "octocat");
  assert.deepEqual(account.body.repositories, [
    { fullName: REPO, installationId: 7 },
  ]);

  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "Studio" });
  const rejected = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({
      teamId: team.body._id,
      name: "Rejected",
      githubRepository: "other/repo",
    });
  assert.equal(rejected.status, 400);

  const created = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({
      teamId: team.body._id,
      name: "Linked",
      githubRepository: REPO,
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.githubRepository, REPO);
  assert.equal(created.body.githubInstallationId, 7);

  const events = await ctx.api
    .get("/api/github/events")
    .set(auth(owner.token));
  assert.equal(events.status, 200);
  assert.ok(events.body.events.includes("pull_request"));
  assert.ok(events.body.events.includes("check_run"));
  assert.ok(events.body.events.includes("push"));

  const pulls = await ctx.api
    .get(`/api/github/pulls?projectId=${created.body._id}`)
    .set(auth(owner.token));
  assert.equal(pulls.status, 200);
  assert.equal(pulls.body.pulls[0].number, 4);
  assert.equal(pulls.body.pulls[0].author, "sam");

  const checks = await ctx.api
    .get(`/api/github/checks?projectId=${created.body._id}&ref=abc123`)
    .set(auth(owner.token));
  assert.equal(checks.status, 200);
  assert.equal(checks.body.checkRuns[0].name, "Playtest");

  const published = await ctx.api
    .post("/api/github/checks")
    .set(auth(owner.token))
    .send({
      projectId: created.body._id,
      name: "Playtest",
      headSha: "abc123",
      status: "completed",
      conclusion: "success",
      summary: "Passed",
    });
  assert.equal(published.status, 201);
  assert.equal(published.body.conclusion, "success");

  const snapshot = await ctx.api
    .get(`/api/github/repository?projectId=${created.body._id}`)
    .set(auth(owner.token));
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.body.repository.stars, 12);
  assert.equal(snapshot.body.repository.visibility, "private");
  assert.equal(snapshot.body.repository.defaultBranch, "main");
  assert.equal(snapshot.body.repository.license, "MIT License");
  assert.equal(snapshot.body.languages[0].name, "TypeScript");
  assert.equal(snapshot.body.languages[0].share, 80);
  assert.equal(snapshot.body.contributors[0].login, "sam");
  assert.equal(snapshot.body.branches[0].name, "feat");
  assert.equal(snapshot.body.branches[0].protected, false);
  assert.equal(snapshot.body.branches[1].name, "main");
  assert.equal(snapshot.body.branches[1].default, true);
  assert.equal(snapshot.body.branches[1].protected, true);
  assert.equal(snapshot.body.commits[0].message, "Add camera");
  assert.equal(snapshot.body.commits[0].author, "sam");

  await deliver("delivery-linked", REPO);
  await deliver("delivery-other", "other/repo");
  const listed = await ctx.api
    .get(`/api/github/deliveries?projectId=${created.body._id}`)
    .set(auth(owner.token));
  assert.equal(listed.status, 200);
  assert.equal(listed.body.deliveries.length, 1);
  assert.equal(listed.body.deliveries[0].repository, REPO);

  const cleared = await ctx.api
    .patch(`/api/projects/${created.body._id}`)
    .set(auth(owner.token))
    .send({ githubRepository: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.githubRepository, null);
  const hidden = await ctx.api
    .get(`/api/github/deliveries?projectId=${created.body._id}`)
    .set(auth(owner.token));
  assert.deepEqual(hidden.body.deliveries, []);
  const removed = await ctx.api
    .get(`/api/github/repository?projectId=${created.body._id}`)
    .set(auth(owner.token));
  assert.equal(removed.status, 400);
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function deliver(deliveryId: string, repository: string) {
  const raw = JSON.stringify({
    repository: { full_name: repository },
    installation: { id: 7 },
  });
  return ctx.api
    .post("/api/github/webhook")
    .set("x-github-event", "push")
    .set("x-github-delivery", deliveryId)
    .set(
      "x-hub-signature-256",
      `sha256=${createHmac("sha256", "test-webhook-secret").update(raw).digest("hex")}`,
    )
    .set("content-type", "application/json")
    .send(raw);
}

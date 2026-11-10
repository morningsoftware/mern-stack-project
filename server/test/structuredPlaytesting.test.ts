import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { RegisteredUser, TestContext } from "./helpers.js";
import { auth, registerUser, startApi } from "./helpers.js";

let ctx: TestContext;
let owner: RegisteredUser;
let tester: RegisteredUser;
let stranger: RegisteredUser;
let projectId: string;
let otherProjectId: string;
let buildId: string;
let otherBuildId: string;
let feedbackId: string;

before(async () => {
  ctx = await startApi();
  owner = await registerUser(ctx.api);
  tester = await registerUser(ctx.api, { role: "playtester" });
  stranger = await registerUser(ctx.api);
  const team = await ctx.api
    .post("/api/teams")
    .set(auth(owner.token))
    .send({ name: "QA studio" });
  const project = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Game" });
  projectId = project.body._id;
  const other = await ctx.api
    .post("/api/projects")
    .set(auth(owner.token))
    .send({ teamId: team.body._id, name: "Other game" });
  otherProjectId = other.body._id;
  const build = await ctx.api
    .post("/api/builds")
    .set(auth(owner.token))
    .send({
      projectId,
      version: "0.4.0",
      platform: "web",
      downloadUrl: "https://example.com/demo",
    });
  buildId = build.body._id;
  const otherBuild = await ctx.api
    .post("/api/builds")
    .set(auth(owner.token))
    .send({
      projectId: otherProjectId,
      version: "0.4.0",
      platform: "web",
      downloadUrl: "https://example.com/other",
    });
  otherBuildId = otherBuild.body._id;
  const feedback = await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(tester.token))
    .send({ projectId, buildId, rating: 2, comments: "The jump gets stuck." });
  feedbackId = feedback.body._id;
});
after(async () => {
  await ctx?.stop();
});
const bugBody = () => ({
  projectId,
  title: "Jump stuck",
  description: "Reported in a playtest",
  buildId,
  sourceFeedbackId: feedbackId,
  reproductionSteps: "1. Start level\n2. Jump at the ledge",
  expectedResult: "Player lands on the platform",
  actualResult: "Player gets stuck",
  environment: "Windows 11, keyboard",
  severity: "high",
});

test("structured bugs retain build, feedback origin, and reproduction details", async () => {
  const created = await ctx.api
    .post("/api/bug-reports")
    .set(auth(tester.token))
    .send(bugBody());
  assert.equal(created.status, 201);
  assert.equal(created.body.buildId, buildId);
  assert.equal(created.body.sourceFeedbackId, feedbackId);
  assert.equal(created.body.expectedResult, "Player lands on the platform");
  assert.equal(created.body.reportedBy, tester.user._id);
  const fetched = await ctx.api
    .get(`/api/bug-reports/${created.body._id}`)
    .set(auth(owner.token));
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.reproductionSteps, bugBody().reproductionSteps);
  const list = await ctx.api
    .get(`/api/bug-reports?projectId=${projectId}&buildId=${buildId}`)
    .set(auth(owner.token));
  assert.equal(list.status, 200);
  assert(list.body.some((bug: any) => bug._id === created.body._id));
  const filtered = await ctx.api
    .get(`/api/bug-reports?projectId=${projectId}&buildId=${otherBuildId}`)
    .set(auth(owner.token));
  assert.equal(filtered.body.length, 0);
  const changed = await ctx.api
    .patch(`/api/bug-reports/${created.body._id}`)
    .set(auth(owner.token))
    .send({
      buildId: null,
      reproductionSteps: "",
      environment: "macOS",
      actualResult: "Now intermittent",
    });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.buildId, null);
  assert.equal(changed.body.reproductionSteps, "");
  assert.equal(changed.body.environment, "macOS");
  assert.equal(changed.body.sourceFeedbackId, feedbackId);
});
test("cross-project build and feedback references are rejected before writing", async () => {
  assert.equal(
    (
      await ctx.api
        .post("/api/bug-reports")
        .set(auth(tester.token))
        .send({ ...bugBody(), buildId: otherBuildId })
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/bug-reports")
        .set(auth(tester.token))
        .send({
          ...bugBody(),
          projectId: otherProjectId,
          buildId: otherBuildId,
        })
    ).status,
    400,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/bug-reports")
        .set(auth(tester.token))
        .send({ ...bugBody(), sourceFeedbackId: "64b000000000000000000000" })
    ).status,
    404,
  );
  assert.equal(
    (
      await ctx.api
        .post("/api/bug-reports")
        .set(auth(tester.token))
        .send({ ...bugBody(), expectedResult: { bad: true } })
    ).status,
    400,
  );
  const created = await ctx.api
    .post("/api/bug-reports")
    .set(auth(tester.token))
    .send(bugBody());
  const badPatch = await ctx.api
    .patch(`/api/bug-reports/${created.body._id}`)
    .set(auth(owner.token))
    .send({ buildId: otherBuildId, title: "Should not save" });
  assert.equal(badPatch.status, 400);
  const unchanged = await ctx.api
    .get(`/api/bug-reports/${created.body._id}`)
    .set(auth(owner.token));
  assert.equal(unchanged.body.title, "Jump stuck");
});
test("review transitions require team membership and preserve author ownership", async () => {
  const initial = await ctx.api
    .get(`/api/playtest-feedback/${feedbackId}`)
    .set(auth(owner.token));
  assert.equal(initial.body.reviewStatus, "new");
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-feedback/${feedbackId}`)
        .set(auth(tester.token))
        .send({ reviewStatus: "reviewed" })
    ).status,
    403,
  );
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-feedback/${feedbackId}`)
        .set(auth(stranger.token))
        .send({ reviewStatus: "reviewed" })
    ).status,
    403,
  );
  const reviewed = await ctx.api
    .patch(`/api/playtest-feedback/${feedbackId}`)
    .set(auth(owner.token))
    .send({ reviewStatus: "reviewed", reviewedBy: tester.user._id });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.reviewedBy, owner.user._id);
  assert(reviewed.body.reviewedOn);
  assert.equal(reviewed.body.comments, "The jump gets stuck.");
  const unauthorizedContent = await ctx.api
    .patch(`/api/playtest-feedback/${feedbackId}`)
    .set(auth(owner.token))
    .send({ reviewStatus: "new", comments: "Overwrite author" });
  assert.equal(unauthorizedContent.status, 403);
  assert.equal(
    (
      await ctx.api
        .patch(`/api/playtest-feedback/${feedbackId}`)
        .set(auth(owner.token))
        .send({ reviewStatus: "invalid" })
    ).status,
    400,
  );
  const authorEdit = await ctx.api
    .patch(`/api/playtest-feedback/${feedbackId}`)
    .set(auth(tester.token))
    .send({ comments: "More detail from the author" });
  assert.equal(authorEdit.status, 200);
  assert.equal(authorEdit.body.reviewStatus, "reviewed");
  const reopened = await ctx.api
    .patch(`/api/playtest-feedback/${feedbackId}`)
    .set(auth(owner.token))
    .send({ reviewStatus: "new" });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.reviewedBy, null);
  assert.equal(reopened.body.reviewedOn, null);
});
test("legacy general bugs/feedback remain valid without build or structured fields", async () => {
  const bug = await ctx.api
    .post("/api/bug-reports")
    .set(auth(tester.token))
    .send({ projectId, title: "General issue" });
  assert.equal(bug.status, 201);
  assert.equal(bug.body.buildId, undefined);
  assert.equal(bug.body.expectedResult, "");
  const feedback = await ctx.api
    .post("/api/playtest-feedback")
    .set(auth(tester.token))
    .send({ projectId, rating: 4 });
  assert.equal(feedback.status, 201);
  assert.equal(feedback.body.buildId, undefined);
  assert.equal(feedback.body.reviewStatus, "new");
});

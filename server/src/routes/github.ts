import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import express from "express";
import type { Request as ExpressRequest } from "express";
import { ObjectId } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import {
  connectGithubAccount,
  githubAccountForUser,
  githubAuthorizeUrl,
  githubConnectState,
  safeReturnTarget,
} from "../githubOauth.js";
import { githubInstallationRequest } from "../githubApp.js";
import { loadRepositorySnapshot } from "../githubRepository.js";
import {
  GITHUB_WEBHOOK_EVENTS,
  describeGithubDelivery,
} from "../githubEvents.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import type { GithubDeliveryDocument, ProjectDocument } from "../schema.js";
import {
  oneOf,
  optionalString,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const githubWebhookRouter = Router();
export const githubRouter = Router();

githubWebhookRouter.post(
  "/",
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncRoute(async (req, res) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) throw httpError(500, "GITHUB_WEBHOOK_SECRET is not set");
    const body = req.body;
    if (!Buffer.isBuffer(body)) throw httpError(400, "Expected a JSON body");
    if (
      !signaturesMatch(
        body,
        req.get("x-hub-signature-256"),
        secret,
      )
    ) {
      throw httpError(401, "Invalid webhook signature");
    }

    const event = req.get("x-github-event");
    const deliveryId = req.get("x-github-delivery");
    if (!event || !deliveryId) {
      throw httpError(400, "Missing GitHub event headers");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body.toString("utf8"));
    } catch {
      throw httpError(400, "Webhook body must be JSON");
    }

    const summary = describeGithubDelivery(event, payload);
    const doc: Omit<GithubDeliveryDocument, "_id"> = {
      deliveryId,
      ...summary,
      receivedOn: new Date(),
    };
    try {
      await req.app.locals.db.collection("githubDeliveries").insertOne(doc);
    } catch (error) {
      const duplicate = error as { code?: number };
      if (duplicate.code !== 11000) throw error;
    }
    res.status(204).end();
  }),
);

githubRouter.get(
  "/callback",
  asyncRoute(async (req, res) => {
    const state = githubConnectState(req.query.state);
    if (typeof req.query.error === "string") {
      res.redirect(withGithubError(state.returnTo));
      return;
    }
    const code = requireString(req.query.code, "code");
    if (!ObjectId.isValid(state.userId)) {
      throw httpError(400, "GitHub OAuth state is invalid");
    }
    await connectGithubAccount(
      req.app.locals.db,
      new ObjectId(state.userId),
      code,
    );
    res.redirect(state.returnTo);
  }),
);
githubRouter.use(requireAuth);
githubRouter.get(
  "/connect",
  asyncRoute(async (req, res) => {
    const returnTo = safeReturnTarget(req.query.returnTo);
    res.json({
      url: githubAuthorizeUrl(actorId(req).toString(), returnTo),
    });
  }),
);
githubRouter.get(
  "/repositories",
  asyncRoute(async (req, res) => {
    res.json(await githubAccountForUser(req.app.locals.db, actorId(req)));
  }),
);
githubRouter.get(
  "/events",
  asyncRoute(async (req, res) => {
    res.json({ events: GITHUB_WEBHOOK_EVENTS });
  }),
);
githubRouter.get(
  "/repository",
  asyncRoute(async (req, res) => {
    const project = await linkedProject(req, true);
    res.json(
      await loadRepositorySnapshot(
        project.githubInstallationId,
        project.owner,
        project.repo,
      ),
    );
  }),
);
githubRouter.get(
  "/deliveries",
  asyncRoute(async (req, res) => {
    const project = await linkedProject(req);
    if (!project) {
      res.json({ deliveries: [] });
      return;
    }
    const filter: { repository: string; event?: string } = {
      repository: project.githubRepository,
    };
    if (req.query.event !== undefined) {
      filter.event = oneOf(req.query.event, GITHUB_WEBHOOK_EVENTS, "event");
    }
    const deliveries = await req.app.locals.db
      .collection<GithubDeliveryDocument>("githubDeliveries")
      .find(filter)
      .sort({ _id: -1 })
      .limit(50)
      .toArray();
    res.json({ deliveries });
  }),
);
githubRouter.get(
  "/pulls",
  asyncRoute(async (req, res) => {
    const project = await linkedProject(req, true);
    const pulls = await githubInstallationRequest<{
      number: number;
      title: string;
      state: string;
      html_url: string;
      user?: { login?: string };
    }[]>(
      project.githubInstallationId,
      `/repos/${project.owner}/${project.repo}/pulls?state=open&per_page=30`,
    );
    res.json({
      pulls: pulls.map((pull) => ({
        number: pull.number,
        title: pull.title,
        state: pull.state,
        url: pull.html_url,
        author: pull.user?.login || null,
      })),
    });
  }),
);
githubRouter.get(
  "/checks",
  asyncRoute(async (req, res) => {
    const project = await linkedProject(req, true);
    const ref = requireString(req.query.ref, "ref");
    const result = await githubInstallationRequest<{
      check_runs?: Array<{
        name?: string;
        status?: string;
        conclusion?: string | null;
        html_url?: string;
      }>;
    }>(
      project.githubInstallationId,
      `/repos/${project.owner}/${project.repo}/commits/${encodeURIComponent(ref)}/check-runs?per_page=30`,
    );
    res.json({
      checkRuns: (result.check_runs ?? []).map((run) => ({
        name: run.name || "Check",
        status: run.status || null,
        conclusion: run.conclusion || null,
        url: run.html_url || null,
      })),
    });
  }),
);
githubRouter.post(
  "/checks",
  asyncRoute(async (req, res) => {
    const project = await linkedProject(req, true);
    const name = requireString(req.body?.name, "name");
    const headSha = requireString(req.body?.headSha, "headSha");
    const status = oneOf(
      req.body?.status || "queued",
      ["queued", "in_progress", "completed"] as const,
      "status",
    );
    const conclusion =
      status === "completed"
        ? oneOf(
            req.body?.conclusion,
            [
              "success",
              "failure",
              "neutral",
              "cancelled",
              "skipped",
              "timed_out",
              "action_required",
            ] as const,
            "conclusion",
          )
        : undefined;
    const summary = optionalString(req.body?.summary, "summary") || name;
    const created = await githubInstallationRequest<{
      id?: number;
      html_url?: string;
      status?: string;
      conclusion?: string | null;
    }>(
      project.githubInstallationId,
      `/repos/${project.owner}/${project.repo}/check-runs`,
      "POST",
      {
        name,
        head_sha: headSha,
        status,
        ...(conclusion ? { conclusion } : {}),
        output: { title: name, summary },
      },
    );
    res.status(201).json({
      id: created.id ?? null,
      name,
      status: created.status || status,
      conclusion: created.conclusion || conclusion || null,
      url: created.html_url || null,
    });
  }),
);

type LinkedRepository = {
  githubRepository: string;
  githubInstallationId: number;
  owner: string;
  repo: string;
};

async function linkedProject(
  req: ExpressRequest,
  required: true,
): Promise<LinkedRepository>;
async function linkedProject(
  req: ExpressRequest,
  required?: false,
): Promise<LinkedRepository | null>;
async function linkedProject(req: ExpressRequest, required = false) {
  const projectId = parseObjectId(
    req.query.projectId ?? req.body?.projectId,
    "projectId",
  );
  await requireProjectTeamMember(req.app.locals.db, projectId, actorId(req));
  const project = await requireDoc(
    req.app.locals.db.collection<ProjectDocument>("projects"),
    projectId,
    "Project",
  );
  if (!project.githubRepository || !project.githubInstallationId) {
    if (required) {
      throw httpError(400, "This project is not linked to a GitHub repository");
    }
    return null;
  }
  const [owner, repo] = project.githubRepository.split("/");
  return {
    githubRepository: project.githubRepository,
    githubInstallationId: project.githubInstallationId,
    owner,
    repo,
  };
}

function withGithubError(returnTo: string): string {
  const url = new URL(returnTo);
  url.searchParams.set("github", "error");
  return url.toString();
}

function signaturesMatch(
  body: Buffer,
  header: string | undefined,
  secret: string,
): boolean {
  if (!header) return false;
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

import {
  requireTeamMember,
  requireProjectTeamMember,
} from "../projectAccess.js";
import { Router } from "express";
import type { Request as ExpressRequest } from "express";
import type { Filter } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { githubAccountForUser } from "../githubOauth.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type { ProjectDocument, TeamDocument } from "../schema.js";
import { PROJECT_STATUSES } from "../schema.js";
import {
  oneOf,
  optionalObjectId,
  optionalString,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter: Filter<ProjectDocument> = {};
    const teamId = optionalObjectId(req.query.teamId, "teamId");
    if (teamId) filter.teamId = teamId;
    const projects = await req.app.locals.db
      .collection<ProjectDocument>("projects")
      .find(filter)
      .sort({ createdOn: -1 })
      .toArray();
    res.json(projects);
  }),
);

projectsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const teamId = parseObjectId(req.body?.teamId, "teamId");
    const name = requireString(req.body?.name, "name");
    const description =
      optionalString(req.body?.description, "description") ?? "";
    const status = req.body?.status
      ? oneOf(req.body.status, PROJECT_STATUSES, "status")
      : "active";
    await requireTeamMember(req.app.locals.db, teamId, actorId(req));
    const link = await repositoryLink(req, req.body?.githubRepository);
    const doc = {
      teamId,
      name,
      description,
      status,
      ...(link ?? {}),
      createdOn: new Date(),
      createdBy: actorId(req),
    };
    const result = await req.app.locals.db
      .collection("projects")
      .insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  }),
);

projectsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(req.app.locals.db.collection("projects"), id, "Project"),
    );
  }),
);

projectsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const projects = req.app.locals.db.collection("projects");
    await requireProjectTeamMember(req.app.locals.db, id, actorId(req));
    const update: Partial<ProjectDocument> = {};
    const name = optionalString(req.body?.name, "name");
    if (name !== undefined) update.name = name;
    if (req.body?.description !== undefined) {
      update.description =
        optionalString(req.body.description, "description") ?? "";
    }
    if (req.body?.status !== undefined) {
      update.status = oneOf(req.body.status, PROJECT_STATUSES, "status");
    }
    if (req.body && "githubRepository" in req.body) {
      const link = await repositoryLink(req, req.body.githubRepository);
      update.githubRepository = link?.githubRepository ?? null;
      update.githubInstallationId = link?.githubInstallationId ?? null;
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }
    await projects.updateOne({ _id: id }, { $set: update });
    res.json(await projects.findOne({ _id: id }));
  }),
);

projectsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const projects = req.app.locals.db.collection("projects");
    await requireProjectTeamMember(req.app.locals.db, id, actorId(req));
    await projects.deleteOne({ _id: id });
    res.status(204).end();
  }),
);

async function repositoryLink(
  req: ExpressRequest,
  value: unknown,
): Promise<{
  githubRepository: string;
  githubInstallationId: number;
} | null> {
  if (value === undefined || value === null || value === "") return null;
  const fullName = requireString(value, "githubRepository");
  const account = await githubAccountForUser(req.app.locals.db, actorId(req));
  if (!account.connected) {
    throw httpError(400, "Connect GitHub before linking a repository");
  }
  const repository = account.repositories.find(
    (item) => item.fullName === fullName,
  );
  if (!repository) {
    throw httpError(400, "That repository is not available to your GitHub account");
  }
  return {
    githubRepository: repository.fullName,
    githubInstallationId: repository.installationId,
  };
}

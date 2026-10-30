import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
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

function actorId(req) {
  return parseObjectId(req.user._id.toString(), "user");
}

projectsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter = {};
    const teamId = optionalObjectId(req.query.teamId, "teamId");
    if (teamId) filter.teamId = teamId;
    const projects = await req.app.locals.db
      .collection("projects")
      .find(filter)
      .sort({ createdOn: -1 })
      .toArray();
    res.json(projects);
  })
);

projectsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const teamId = parseObjectId(req.body?.teamId, "teamId");
    const name = requireString(req.body?.name, "name");
    const description = optionalString(req.body?.description, "description") ?? "";
    const status = req.body?.status
      ? oneOf(req.body.status, PROJECT_STATUSES, "status")
      : "active";
    await requireDoc(req.app.locals.db.collection("teams"), teamId, "Team");
    const doc = {
      teamId,
      name,
      description,
      status,
      createdOn: new Date(),
      createdBy: actorId(req),
    };
    const result = await req.app.locals.db.collection("projects").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  })
);

projectsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(await requireDoc(req.app.locals.db.collection("projects"), id, "Project"));
  })
);

projectsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const projects = req.app.locals.db.collection("projects");
    await requireDoc(projects, id, "Project");
    const update = {};
    const name = optionalString(req.body?.name, "name");
    if (name !== undefined) update.name = name;
    if (req.body?.description !== undefined) {
      update.description = optionalString(req.body.description, "description") ?? "";
    }
    if (req.body?.status !== undefined) {
      update.status = oneOf(req.body.status, PROJECT_STATUSES, "status");
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }
    await projects.updateOne({ _id: id }, { $set: update });
    res.json(await projects.findOne({ _id: id }));
  })
);

projectsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const projects = req.app.locals.db.collection("projects");
    await requireDoc(projects, id, "Project");
    await projects.deleteOne({ _id: id });
    res.status(204).end();
  })
);

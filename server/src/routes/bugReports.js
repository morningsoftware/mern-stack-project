import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { BUG_SEVERITIES, BUG_STATUSES } from "../schema.js";
import {
  oneOf,
  optionalObjectId,
  optionalString,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const bugReportsRouter = Router();
bugReportsRouter.use(requireAuth);

function actorId(req) {
  return parseObjectId(req.user._id.toString(), "user");
}

bugReportsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter = {};
    const projectId = optionalObjectId(req.query.projectId, "projectId");
    if (projectId) filter.projectId = projectId;
    if (req.query.status !== undefined) {
      filter.status = oneOf(req.query.status, BUG_STATUSES, "status");
    }
    const bugs = await req.app.locals.db
      .collection("bugReports")
      .find(filter)
      .sort({ createdOn: -1 })
      .toArray();
    res.json(bugs);
  })
);

bugReportsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const title = requireString(req.body?.title, "title");
    const description = optionalString(req.body?.description, "description") ?? "";
    const severity = req.body?.severity
      ? oneOf(req.body.severity, BUG_SEVERITIES, "severity")
      : "medium";
    const status = req.body?.status
      ? oneOf(req.body.status, BUG_STATUSES, "status")
      : "open";
    await requireDoc(req.app.locals.db.collection("projects"), projectId, "Project");
    const createdBy = actorId(req);
    const doc = {
      projectId,
      title,
      description,
      severity,
      status,
      reportedBy: createdBy,
      createdOn: new Date(),
      createdBy,
    };
    const result = await req.app.locals.db.collection("bugReports").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  })
);

bugReportsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(await requireDoc(req.app.locals.db.collection("bugReports"), id, "Bug report"));
  })
);

bugReportsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const bugs = req.app.locals.db.collection("bugReports");
    await requireDoc(bugs, id, "Bug report");
    const update = {};
    const title = optionalString(req.body?.title, "title");
    if (title !== undefined) update.title = title;
    if (req.body?.description !== undefined) {
      update.description = optionalString(req.body.description, "description") ?? "";
    }
    if (req.body?.severity !== undefined) {
      update.severity = oneOf(req.body.severity, BUG_SEVERITIES, "severity");
    }
    if (req.body?.status !== undefined) {
      update.status = oneOf(req.body.status, BUG_STATUSES, "status");
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }
    await bugs.updateOne({ _id: id }, { $set: update });
    res.json(await bugs.findOne({ _id: id }));
  })
);

bugReportsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const bugs = req.app.locals.db.collection("bugReports");
    await requireDoc(bugs, id, "Bug report");
    await bugs.deleteOne({ _id: id });
    res.status(204).end();
  })
);

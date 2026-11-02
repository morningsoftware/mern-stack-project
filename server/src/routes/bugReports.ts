import { Router } from "express";
import { ObjectId } from "mongodb";
import type { Filter } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type { BugReportDocument, ProjectDocument } from "../schema.js";
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

bugReportsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter: Filter<BugReportDocument> = {};
    const projectId = optionalObjectId(req.query.projectId, "projectId");
    if (projectId) filter.projectId = projectId;
    if (req.query.status !== undefined) {
      filter.status = oneOf(req.query.status, BUG_STATUSES, "status");
    }
    const bugs = await req.app.locals.db
      .collection<BugReportDocument>("bugReports")
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
    await requireDoc(
      req.app.locals.db.collection<ProjectDocument>("projects"),
      projectId,
      "Project"
    );
    const createdBy = actorId(req);
    const doc: BugReportDocument = {
      _id: new ObjectId(),
      projectId,
      title,
      description,
      severity,
      status,
      reportedBy: createdBy,
      createdOn: new Date(),
      createdBy,
    };
    await req.app.locals.db
      .collection<BugReportDocument>("bugReports")
      .insertOne(doc);
    res.status(201).json(doc);
  })
);

bugReportsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(
        req.app.locals.db.collection<BugReportDocument>("bugReports"),
        id,
        "Bug report"
      )
    );
  })
);

bugReportsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const bugs = req.app.locals.db.collection<BugReportDocument>("bugReports");
    await requireDoc(bugs, id, "Bug report");
    const update: Partial<BugReportDocument> = {};
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
    const bugs = req.app.locals.db.collection<BugReportDocument>("bugReports");
    await requireDoc(bugs, id, "Bug report");
    await bugs.deleteOne({ _id: id });
    res.status(204).end();
  })
);

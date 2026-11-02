import { Router } from "express";
import { ObjectId } from "mongodb";
import type { Filter } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type { MilestoneDocument, ProjectDocument } from "../schema.js";
import { MILESTONE_STATUSES } from "../schema.js";
import {
  oneOf,
  optionalObjectId,
  optionalString,
  parseDate,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const milestonesRouter = Router();
milestonesRouter.use(requireAuth);

milestonesRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter: Filter<MilestoneDocument> = {};
    const projectId = optionalObjectId(req.query.projectId, "projectId");
    if (projectId) filter.projectId = projectId;
    const milestones = await req.app.locals.db
      .collection<MilestoneDocument>("milestones")
      .find(filter)
      .sort({ dueDate: 1, createdOn: -1 })
      .toArray();
    res.json(milestones);
  })
);

milestonesRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const name = requireString(req.body?.name, "name");
    const description = optionalString(req.body?.description, "description") ?? "";
    const status = req.body?.status
      ? oneOf(req.body.status, MILESTONE_STATUSES, "status")
      : "todo";
    const dueDate = parseDate(req.body?.dueDate, "dueDate") ?? null;
    await requireDoc(
      req.app.locals.db.collection<ProjectDocument>("projects"),
      projectId,
      "Project"
    );
    const doc: MilestoneDocument = {
      _id: new ObjectId(),
      projectId,
      name,
      description,
      status,
      dueDate,
      createdOn: new Date(),
      createdBy: actorId(req),
    };
    await req.app.locals.db
      .collection<MilestoneDocument>("milestones")
      .insertOne(doc);
    res.status(201).json(doc);
  })
);

milestonesRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(
        req.app.locals.db.collection<MilestoneDocument>("milestones"),
        id,
        "Milestone"
      )
    );
  })
);

milestonesRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const milestones = req.app.locals.db.collection<MilestoneDocument>("milestones");
    await requireDoc(milestones, id, "Milestone");
    const update: Partial<MilestoneDocument> = {};
    const name = optionalString(req.body?.name, "name");
    if (name !== undefined) update.name = name;
    if (req.body?.description !== undefined) {
      update.description = optionalString(req.body.description, "description") ?? "";
    }
    if (req.body?.status !== undefined) {
      update.status = oneOf(req.body.status, MILESTONE_STATUSES, "status");
    }
    if (req.body?.dueDate !== undefined) {
      update.dueDate = parseDate(req.body.dueDate, "dueDate") ?? null;
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }
    await milestones.updateOne({ _id: id }, { $set: update });
    res.json(await milestones.findOne({ _id: id }));
  })
);

milestonesRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const milestones = req.app.locals.db.collection<MilestoneDocument>("milestones");
    await requireDoc(milestones, id, "Milestone");
    await milestones.deleteOne({ _id: id });
    res.status(204).end();
  })
);

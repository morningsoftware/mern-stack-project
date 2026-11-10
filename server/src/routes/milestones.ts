import { requireProjectTeamMember } from "../projectAccess.js";
import { Router } from "express";
import type { Filter } from "mongodb";
import { recordActivity } from "../activity.js";
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
  }),
);

milestonesRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const name = requireString(req.body?.name, "name");
    const description =
      optionalString(req.body?.description, "description") ?? "";
    const status = req.body?.status
      ? oneOf(req.body.status, MILESTONE_STATUSES, "status")
      : "todo";
    const dueDate = parseDate(req.body?.dueDate, "dueDate") ?? null;
    await requireProjectTeamMember(req.app.locals.db, projectId, actorId(req));
    const doc = {
      projectId,
      name,
      description,
      status,
      dueDate,
      createdOn: new Date(),
      createdBy: actorId(req),
    };
    const result = await req.app.locals.db
      .collection("milestones")
      .insertOne(doc);
    await recordActivity(
      req,
      res,
      "milestone",
      { ...doc, _id: result.insertedId },
      "created",
    );
    res.status(201).json({ ...doc, _id: result.insertedId });
  }),
);

milestonesRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(
        req.app.locals.db.collection("milestones"),
        id,
        "Milestone",
      ),
    );
  }),
);

milestonesRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const milestones =
      req.app.locals.db.collection<MilestoneDocument>("milestones");
    const existing = await requireDoc(milestones, id, "Milestone");
    await requireProjectTeamMember(
      req.app.locals.db,
      existing.projectId,
      actorId(req),
    );
    const update: Partial<MilestoneDocument> = {};
    const name = optionalString(req.body?.name, "name");
    if (name !== undefined) update.name = name;
    if (req.body?.description !== undefined) {
      update.description =
        optionalString(req.body.description, "description") ?? "";
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
    const updated = (await milestones.findOne({ _id: id }))!;
    await recordActivity(req, res, "milestone", updated, "updated", existing);
    res.json(updated);
  }),
);

milestonesRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const milestones = req.app.locals.db.collection("milestones");
    const existing = await requireDoc(milestones, id, "Milestone");
    await requireProjectTeamMember(
      req.app.locals.db,
      existing.projectId,
      actorId(req),
    );
    await milestones.deleteOne({ _id: id });
    res.status(204).end();
  }),
);

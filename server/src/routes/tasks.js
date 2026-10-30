import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { TASK_PRIORITIES, TASK_STATUSES } from "../schema.js";
import {
  oneOf,
  optionalObjectId,
  optionalString,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

function actorId(req) {
  return parseObjectId(req.user._id.toString(), "user");
}

tasksRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter = {};
    const projectId = optionalObjectId(req.query.projectId, "projectId");
    const assigneeId = optionalObjectId(req.query.assigneeId, "assigneeId");
    const milestoneId = optionalObjectId(req.query.milestoneId, "milestoneId");
    if (projectId) filter.projectId = projectId;
    if (assigneeId) filter.assigneeId = assigneeId;
    if (milestoneId) filter.milestoneId = milestoneId;
    if (req.query.status !== undefined) {
      filter.status = oneOf(req.query.status, TASK_STATUSES, "status");
    }
    const tasks = await req.app.locals.db
      .collection("tasks")
      .find(filter)
      .sort({ createdOn: -1 })
      .toArray();
    res.json(tasks);
  })
);

tasksRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const milestoneId = parseObjectId(req.body?.milestoneId, "milestoneId");
    const title = requireString(req.body?.title, "title");
    const description = optionalString(req.body?.description, "description") ?? "";
    const status = req.body?.status
      ? oneOf(req.body.status, TASK_STATUSES, "status")
      : "todo";
    const priority = req.body?.priority
      ? oneOf(req.body.priority, TASK_PRIORITIES, "priority")
      : "medium";
    const assigneeId = parseObjectId(req.body?.assigneeId, "assigneeId");
    const db = req.app.locals.db;
    const project = await requireDoc(db.collection("projects"), projectId, "Project");
    const milestone = await requireDoc(db.collection("milestones"), milestoneId, "Milestone");
    if (milestone.projectId.toString() !== project._id.toString()) {
      throw httpError(400, "milestone does not belong to that project");
    }
    await requireDoc(db.collection("users"), assigneeId, "User");
    const doc = {
      projectId,
      milestoneId,
      title,
      description,
      status,
      priority,
      assigneeId,
      createdOn: new Date(),
      createdBy: actorId(req),
    };
    const result = await db.collection("tasks").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  })
);

tasksRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(await requireDoc(req.app.locals.db.collection("tasks"), id, "Task"));
  })
);

tasksRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const tasks = req.app.locals.db.collection("tasks");
    const existing = await requireDoc(tasks, id, "Task");
    const update = {};
    const title = optionalString(req.body?.title, "title");
    if (title !== undefined) update.title = title;
    if (req.body?.description !== undefined) {
      update.description = optionalString(req.body.description, "description") ?? "";
    }
    if (req.body?.status !== undefined) {
      update.status = oneOf(req.body.status, TASK_STATUSES, "status");
    }
    if (req.body?.priority !== undefined) {
      update.priority = oneOf(req.body.priority, TASK_PRIORITIES, "priority");
    }
    if (req.body?.assigneeId !== undefined) {
      const assigneeId = parseObjectId(req.body.assigneeId, "assigneeId");
      await requireDoc(req.app.locals.db.collection("users"), assigneeId, "User");
      update.assigneeId = assigneeId;
    }
    if (req.body?.milestoneId !== undefined) {
      const milestoneId = parseObjectId(req.body.milestoneId, "milestoneId");
      const milestone = await requireDoc(
        req.app.locals.db.collection("milestones"),
        milestoneId,
        "Milestone"
      );
      if (milestone.projectId.toString() !== existing.projectId.toString()) {
        throw httpError(400, "milestone does not belong to that project");
      }
      update.milestoneId = milestoneId;
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }
    await tasks.updateOne({ _id: id }, { $set: update });
    res.json(await tasks.findOne({ _id: id }));
  })
);

tasksRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const tasks = req.app.locals.db.collection("tasks");
    await requireDoc(tasks, id, "Task");
    await tasks.deleteOne({ _id: id });
    res.status(204).end();
  })
);

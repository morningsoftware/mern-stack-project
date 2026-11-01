import { Router } from "express";
import { ObjectId } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import { parseObjectId, requireDoc, requireString } from "../validate.js";

export const taskCommentsRouter = Router({ mergeParams: true });
taskCommentsRouter.use(requireAuth);
taskCommentsRouter.use(
  asyncRoute(async (req, res, next) => {
    const taskId = parseObjectId(req.params.taskId, "taskId");
    const db = req.app.locals.db;
    const task = await requireDoc(db.collection("tasks"), taskId, "Task");
    await requireProjectTeamMember(db, task.projectId, req.user._id);
    req.commentTask = task;
    next();
  }),
);

taskCommentsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter = { taskId: req.commentTask._id };
    if (req.query.before !== undefined)
      filter._id = { $lt: parseObjectId(req.query.before, "before") };
    const db = req.app.locals.db;
    const rows = await db
      .collection("taskComments")
      .find(filter)
      .sort({ _id: -1 })
      .limit(31)
      .toArray();
    const page = rows.slice(0, 30);
    const authors = await db
      .collection("users")
      .find(
        { _id: { $in: page.map((item) => item.authorId) } },
        { projection: { displayName: 1 } },
      )
      .toArray();
    const comments = page
      .reverse()
      .map((item) => ({
        ...item,
        authorName:
          authors.find((user) => user._id.equals(item.authorId))?.displayName ||
          "Former member",
      }));
    res.json({
      comments,
      hasMore: rows.length > 30,
      nextBefore: comments[0]?._id || null,
    });
  }),
);

taskCommentsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const body = requireString(req.body?.body, "body");
    if (body.length > 4000)
      throw httpError(400, "Comments must be 4,000 characters or fewer");
    const doc = {
      _id: new ObjectId(),
      taskId: req.commentTask._id,
      projectId: req.commentTask.projectId,
      authorId: req.user._id,
      body,
      createdOn: new Date(),
    };
    await req.app.locals.db.collection("taskComments").insertOne(doc);
    res.status(201).json({ ...doc, authorName: req.user.displayName });
  }),
);

import { Router } from "express";
import { ObjectId } from "mongodb";
import type { Db, Filter } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type {
  BuildDocument,
  PlaytestFeedbackDocument,
  ProjectDocument,
} from "../schema.js";
import {
  optionalObjectId,
  optionalString,
  parseObjectId,
  parseRating,
  requireDoc,
} from "../validate.js";

export const playtestFeedbackRouter = Router();
playtestFeedbackRouter.use(requireAuth);

async function validateBuild(
  db: Db,
  value: unknown,
  projectId: ObjectId
): Promise<ObjectId | null> {
  const buildId = optionalObjectId(value, "buildId");
  if (!buildId) return null;
  const build = await requireDoc(
    db.collection<BuildDocument>("builds"),
    buildId,
    "Build"
  );
  if (build.projectId.toString() !== projectId.toString())
    throw httpError(400, "build does not belong to that project");
  return buildId;
}

playtestFeedbackRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter: Filter<PlaytestFeedbackDocument> = {};
    const projectId = optionalObjectId(req.query.projectId, "projectId");
    if (projectId) filter.projectId = projectId;
    const feedback = await req.app.locals.db
      .collection<PlaytestFeedbackDocument>("playtestFeedback")
      .find(filter)
      .sort({ createdOn: -1 })
      .toArray();
    res.json(feedback);
  })
);

playtestFeedbackRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const rating = parseRating(req.body?.rating);
    const comments = optionalString(req.body?.comments, "comments") ?? "";
    await requireDoc(
      req.app.locals.db.collection<ProjectDocument>("projects"),
      projectId,
      "Project"
    );
    const buildId = await validateBuild(
      req.app.locals.db,
      req.body?.buildId,
      projectId
    );
    const userId = actorId(req);
    const doc: PlaytestFeedbackDocument = {
      _id: new ObjectId(),
      projectId,
      ...(buildId ? { buildId } : {}),
      userId,
      rating,
      comments,
      createdOn: new Date(),
      createdBy: userId,
    };
    await req.app.locals.db
      .collection<PlaytestFeedbackDocument>("playtestFeedback")
      .insertOne(doc);
    res.status(201).json(doc);
  })
);

playtestFeedbackRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(
        req.app.locals.db.collection<PlaytestFeedbackDocument>("playtestFeedback"),
        id,
        "Playtest feedback"
      )
    );
  })
);

playtestFeedbackRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const feedback = req.app.locals.db.collection<PlaytestFeedbackDocument>(
      "playtestFeedback"
    );
    const existing = await requireDoc(feedback, id, "Playtest feedback");
    if (existing.userId.toString() !== actorId(req).toString()) {
      throw httpError(403, "You can only update your own feedback");
    }
    const update: Partial<PlaytestFeedbackDocument> = {};
    if (req.body?.buildId !== undefined)
      update.buildId = await validateBuild(
        req.app.locals.db,
        req.body.buildId,
        existing.projectId
      );
    if (req.body?.rating !== undefined)
      update.rating = parseRating(req.body.rating);
    if (req.body?.comments !== undefined) {
      update.comments = optionalString(req.body.comments, "comments") ?? "";
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }
    await feedback.updateOne({ _id: id }, { $set: update });
    res.json(await feedback.findOne({ _id: id }));
  })
);

playtestFeedbackRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const feedback = req.app.locals.db.collection<PlaytestFeedbackDocument>(
      "playtestFeedback"
    );
    const existing = await requireDoc(feedback, id, "Playtest feedback");
    if (existing.userId.toString() !== actorId(req).toString()) {
      throw httpError(403, "You can only delete your own feedback");
    }
    await feedback.deleteOne({ _id: id });
    res.status(204).end();
  })
);

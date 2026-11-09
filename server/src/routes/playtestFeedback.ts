import { Router } from "express";
import { ObjectId } from "mongodb";
import type { Filter } from "mongodb";
import { validateSessionReference } from "../sessionReference.js";
import { recordActivity } from "../activity.js";
import { validateBuildReference } from "../buildReference.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import { asyncRoute, httpError } from "../errors.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type {
  PlaytestFeedbackDocument,
  ProjectDocument,
} from "../schema.js";
import {
  oneOf,
  optionalObjectId,
  optionalString,
  parseObjectId,
  parseRating,
  requireDoc,
} from "../validate.js";

export const playtestFeedbackRouter = Router();
playtestFeedbackRouter.use(requireAuth);

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
  }),
);

playtestFeedbackRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const rating = parseRating(req.body?.rating);
    const comments = optionalString(req.body?.comments, "comments") ?? "";
    await requireDoc(
      req.app.locals.db.collection("projects"),
      projectId,
      "Project",
    );
    const buildId = await validateBuildReference(
      req.app.locals.db,
      req.body?.buildId,
      projectId,
    );
    const sessionId = await validateSessionReference(
      req.app.locals.db,
      req.body?.sessionId,
      projectId,
      buildId,
    );
    const userId = actorId(req);
    const doc: PlaytestFeedbackDocument = {
      _id: new ObjectId(),
      projectId,
      ...(buildId ? { buildId } : {}),
      ...(sessionId ? { sessionId } : {}),
      userId,
      rating,
      comments,
      reviewStatus: "new",
      createdOn: new Date(),
      createdBy: userId,
    };
    const result = await req.app.locals.db
      .collection("playtestFeedback")
      .insertOne(doc);
    await recordActivity(
      req,
      res,
      "feedback",
      { ...doc, _id: result.insertedId },
      "created",
    );
    res.status(201).json({ ...doc, _id: result.insertedId });
  }),
);

playtestFeedbackRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(
        req.app.locals.db.collection<PlaytestFeedbackDocument>("playtestFeedback"),
        id,
        "Playtest feedback",
      ),
    );
  }),
);

playtestFeedbackRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const feedback = req.app.locals.db.collection<PlaytestFeedbackDocument>(
      "playtestFeedback"
    );
    const existing = await requireDoc(feedback, id, "Playtest feedback");
    if (req.body?.sessionId !== undefined)
      throw httpError(
        400,
        "Session association cannot be changed after submission",
      );
    if (
      existing.sessionId &&
      req.body?.buildId !== undefined &&
      existing.buildId?.toString() !== req.body.buildId
    )
      throw httpError(400, "Session feedback must keep its original build");
    const isAuthor = existing.userId.toString() === actorId(req).toString();
    const hasReview = req.body?.reviewStatus !== undefined;
    const hasContent = ["rating", "comments", "buildId"].some(
      (field) => req.body?.[field] !== undefined,
    );
    if (!isAuthor && (!hasReview || hasContent)) {
      throw httpError(403, "You can only update your own feedback content");
    }
    const update: Partial<PlaytestFeedbackDocument> = {};
    if (hasReview) {
      await requireProjectTeamMember(
        req.app.locals.db,
        existing.projectId,
        actorId(req),
      );
      update.reviewStatus = oneOf(
        req.body.reviewStatus,
        ["new", "reviewed"],
        "reviewStatus",
      );
      update.reviewedBy =
        update.reviewStatus === "reviewed" ? actorId(req) : null;
      update.reviewedOn =
        update.reviewStatus === "reviewed" ? new Date() : null;
    }
    if (req.body?.buildId !== undefined)
      update.buildId = await validateBuildReference(
        req.app.locals.db,
        req.body.buildId,
        existing.projectId,
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
    const updated = await feedback.findOne({ _id: id });
    await recordActivity(req, res, "feedback", updated, "updated", existing);
    res.json(updated);
  }),
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
  }),
);

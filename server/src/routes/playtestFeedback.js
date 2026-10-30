import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import {
  optionalObjectId,
  optionalString,
  parseObjectId,
  parseRating,
  requireDoc,
} from "../validate.js";

export const playtestFeedbackRouter = Router();
playtestFeedbackRouter.use(requireAuth);

function actorId(req) {
  return parseObjectId(req.user._id.toString(), "user");
}

playtestFeedbackRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const filter = {};
    const projectId = optionalObjectId(req.query.projectId, "projectId");
    if (projectId) filter.projectId = projectId;
    const feedback = await req.app.locals.db
      .collection("playtestFeedback")
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
    await requireDoc(req.app.locals.db.collection("projects"), projectId, "Project");
    const userId = actorId(req);
    const doc = {
      projectId,
      userId,
      rating,
      comments,
      createdOn: new Date(),
      createdBy: userId,
    };
    const result = await req.app.locals.db.collection("playtestFeedback").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  })
);

playtestFeedbackRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(
        req.app.locals.db.collection("playtestFeedback"),
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
    const feedback = req.app.locals.db.collection("playtestFeedback");
    const existing = await requireDoc(feedback, id, "Playtest feedback");
    if (existing.userId.toString() !== req.user._id.toString()) {
      throw httpError(403, "You can only update your own feedback");
    }
    const update = {};
    if (req.body?.rating !== undefined) update.rating = parseRating(req.body.rating);
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
    const feedback = req.app.locals.db.collection("playtestFeedback");
    const existing = await requireDoc(feedback, id, "Playtest feedback");
    if (existing.userId.toString() !== req.user._id.toString()) {
      throw httpError(403, "You can only delete your own feedback");
    }
    await feedback.deleteOne({ _id: id });
    res.status(204).end();
  })
);

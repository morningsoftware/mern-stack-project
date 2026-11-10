import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import { validateBuildReference } from "../buildReference.js";
import { recordActivity } from "../activity.js";
import type { PlaytestSessionDocument } from "../schema.js";
import { PLAYTEST_SESSION_STATUSES } from "../schema.js";
import {
  oneOf,
  parseObjectId,
  parseDate,
  requireDoc,
  requireString,
} from "../validate.js";

export const playtestSessionsRouter = Router();
playtestSessionsRouter.use(requireAuth);

function text(value: unknown, label: string, max: number): string {
  const output = requireString(value, label);
  if (output.length > max)
    throw httpError(400, `${label} must be ${max} characters or fewer`);
  return output;
}

function futureDeadline(value: unknown): Date {
  const date = parseDate(value, "deadline");
  if (!date || date <= new Date())
    throw httpError(400, "deadline must be in the future");
  return date;
}

playtestSessionsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.query.projectId, "projectId");
    await requireDoc(
      req.app.locals.db.collection("projects"),
      projectId,
      "Project",
    );
    res.json(
      await req.app.locals.db
        .collection<PlaytestSessionDocument>("playtestSessions")
        .find({ projectId })
        .sort({ createdOn: -1, _id: -1 })
        .toArray(),
    );
  }),
);

playtestSessionsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const db = req.app.locals.db,
      projectId = parseObjectId(req.body?.projectId, "projectId");
    await requireProjectTeamMember(db, projectId, req.user!._id);
    const buildId = await validateBuildReference(
      db,
      req.body?.buildId,
      projectId,
    );
    if (!buildId) throw httpError(400, "buildId is required");
    const doc: Omit<PlaytestSessionDocument, "_id"> = {
      projectId,
      buildId,
      title: text(req.body?.title, "title", 120),
      instructions: text(req.body?.instructions, "instructions", 4000),
      deadline: futureDeadline(req.body?.deadline),
      status: "open",
      createdBy: req.user!._id,
      createdOn: new Date(),
    };
    const result = await db.collection("playtestSessions").insertOne(doc);
    await recordActivity(
      req,
      res,
      "session",
      { ...doc, _id: result.insertedId },
      "created",
    );
    res.status(201).json({ ...doc, _id: result.insertedId });
  }),
);

playtestSessionsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    res.json(
      await requireDoc(
        req.app.locals.db.collection<PlaytestSessionDocument>(
          "playtestSessions",
        ),
        parseObjectId(req.params.id, "id"),
        "Playtest session",
      ),
    );
  }),
);

playtestSessionsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const db = req.app.locals.db,
      collection = db.collection<PlaytestSessionDocument>("playtestSessions"),
      id = parseObjectId(req.params.id, "id");
    const existing = await requireDoc(
      collection,
      id,
      "Playtest session",
    );
    await requireProjectTeamMember(db, existing.projectId, req.user!._id);
    if (req.body?.buildId !== undefined || req.body?.projectId !== undefined)
      throw httpError(400, "A session's project and build cannot be changed");
    const update: Partial<PlaytestSessionDocument> = {};
    if (req.body?.title !== undefined)
      update.title = text(req.body.title, "title", 120);
    if (req.body?.instructions !== undefined)
      update.instructions = text(req.body.instructions, "instructions", 4000);
    if (req.body?.deadline !== undefined)
      update.deadline = futureDeadline(req.body.deadline);
    if (req.body?.status !== undefined)
      update.status = oneOf(
        req.body.status,
        PLAYTEST_SESSION_STATUSES,
        "status",
      );
    if (!Object.keys(update).length)
      throw httpError(400, "No updatable fields were provided");
    if (
      update.status === "open" &&
      (update.deadline || existing.deadline) <= new Date()
    )
      throw httpError(
        400,
        "Set a future deadline before reopening this session",
      );
    update.updatedOn = new Date();
    await collection.updateOne({ _id: id }, { $set: update });
    const updated = (await collection.findOne({ _id: id }))!;
    await recordActivity(req, res, "session", updated, "updated", existing);
    res.json(updated);
  }),
);

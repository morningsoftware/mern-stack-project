import express, { Router } from "express";
import { Binary, ObjectId } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import {
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  imageContentType,
} from "../images.js";
import { requireAuth } from "../middleware/auth.js";
import { requireBugAccess } from "../projectAccess.js";
import type {
  BugReportDocument,
  BugScreenshotDocument,
} from "../schema.js";
import { parseObjectId, requireDoc } from "../validate.js";

export const bugScreenshotsRouter = Router({ mergeParams: true });
bugScreenshotsRouter.use(requireAuth);
bugScreenshotsRouter.use(
  asyncRoute(async (req, res, next) => {
    const db = req.app.locals.db;
    const bug = await requireDoc(
      db.collection<BugReportDocument>("bugReports"),
      parseObjectId(req.params.bugId, "bugId"),
      "Bug report",
    );
    await requireBugAccess(db, bug, req.user!._id);
    req.bug = bug;
    next();
  }),
);

const metadata = (doc: BugScreenshotDocument) => ({
  _id: doc._id,
  contentType: doc.contentType,
  size: doc.size,
  createdOn: doc.createdOn,
  createdBy: doc.createdBy,
});

bugScreenshotsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const rows = await req.app.locals.db
      .collection<BugScreenshotDocument>("bugScreenshots")
      .find({ bugId: req.bug!._id }, { projection: { data: 0 } })
      .sort({ _id: 1 })
      .toArray();
    res.json(rows.map(metadata));
  }),
);

bugScreenshotsRouter.post(
  "/",
  express.raw({
    type: [...IMAGE_CONTENT_TYPES],
    limit: IMAGE_MAX_BYTES,
  }),
  asyncRoute(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw httpError(
        400,
        "Choose a PNG, JPEG, or WebP screenshot (up to 2 MB)",
      );
    const contentType = imageContentType(req.body, "screenshot");
    if (contentType !== req.get("Content-Type")?.split(";")[0])
      throw httpError(400, "Image type does not match its contents");
    const db = req.app.locals.db;
    const slot = await db.collection("bugReports").findOneAndUpdate(
      {
        _id: req.bug!._id,
        $or: [
          { screenshotCount: { $exists: false } },
          { screenshotCount: { $lt: 3 } },
        ],
      },
      { $inc: { screenshotCount: 1 } },
    );
    if (!slot) throw httpError(409, "A bug can have at most three screenshots");
    const doc = {
      _id: new ObjectId(),
      bugId: req.bug!._id,
      projectId: req.bug!.projectId,
      contentType,
      size: req.body.length,
      createdOn: new Date(),
      createdBy: req.user!._id,
      data: new Binary(req.body),
    };
    try {
      await db.collection("bugScreenshots").insertOne(doc);
    } catch (error) {
      await db
        .collection("bugReports")
        .updateOne({ _id: req.bug!._id }, { $inc: { screenshotCount: -1 } });
      throw error;
    }
    res.status(201).json(metadata(doc));
  }),
);

bugScreenshotsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const doc = await req.app.locals.db
      .collection<BugScreenshotDocument>("bugScreenshots")
      .findOne({
        _id: parseObjectId(req.params.id, "id"),
        bugId: req.bug!._id,
      });
    if (!doc) throw httpError(404, "Screenshot not found");
    res.set({
      "Content-Type": doc.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    });
    res.send(Buffer.from(doc.data.buffer));
  }),
);

bugScreenshotsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const db = req.app.locals.db;
    const result = await db.collection("bugScreenshots").deleteOne({
      _id: parseObjectId(req.params.id, "id"),
      bugId: req.bug!._id,
    });
    if (!result.deletedCount) throw httpError(404, "Screenshot not found");
    await db
      .collection("bugReports")
      .updateOne(
        { _id: req.bug!._id, screenshotCount: { $gt: 0 } },
        { $inc: { screenshotCount: -1 } },
      );
    res.status(204).end();
  }),
);

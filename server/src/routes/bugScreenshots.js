import express, { Router } from "express";
import { Binary, ObjectId } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import { parseObjectId, requireDoc } from "../validate.js";

export const bugScreenshotsRouter = Router({ mergeParams: true });
bugScreenshotsRouter.use(requireAuth);
bugScreenshotsRouter.use(
  asyncRoute(async (req, res, next) => {
    const db = req.app.locals.db;
    const bug = await requireDoc(
      db.collection("bugReports"),
      parseObjectId(req.params.bugId, "bugId"),
      "Bug report",
    );
    if (
      (bug.reportedBy || bug.createdBy)?.toString() !== req.user._id.toString()
    )
      await requireProjectTeamMember(db, bug.projectId, req.user._id);
    req.bug = bug;
    next();
  }),
);
const metadata = (doc) => ({
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
      .collection("bugScreenshots")
      .find({ bugId: req.bug._id }, { projection: { data: 0 } })
      .sort({ _id: 1 })
      .toArray();
    res.json(rows.map(metadata));
  }),
);
function imageType(buffer) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return "image/jpeg";
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  throw httpError(400, "Use a PNG, JPEG, or WebP screenshot");
}
bugScreenshotsRouter.post(
  "/",
  express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: 2 * 1024 * 1024,
  }),
  asyncRoute(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw httpError(
        400,
        "Choose a PNG, JPEG, or WebP screenshot (up to 2 MB)",
      );
    const contentType = imageType(req.body);
    if (contentType !== req.get("Content-Type")?.split(";")[0])
      throw httpError(400, "Image type does not match its contents");
    const db = req.app.locals.db;
    const slot = await db
      .collection("bugReports")
      .findOneAndUpdate(
        {
          _id: req.bug._id,
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
      bugId: req.bug._id,
      projectId: req.bug.projectId,
      contentType,
      size: req.body.length,
      createdOn: new Date(),
      createdBy: req.user._id,
      data: new Binary(req.body),
    };
    try {
      await db.collection("bugScreenshots").insertOne(doc);
    } catch (error) {
      await db
        .collection("bugReports")
        .updateOne({ _id: req.bug._id }, { $inc: { screenshotCount: -1 } });
      throw error;
    }
    res.status(201).json(metadata(doc));
  }),
);
bugScreenshotsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const doc = await req.app.locals.db
      .collection("bugScreenshots")
      .findOne({ _id: parseObjectId(req.params.id, "id"), bugId: req.bug._id });
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
    const result = await db
      .collection("bugScreenshots")
      .deleteOne({
        _id: parseObjectId(req.params.id, "id"),
        bugId: req.bug._id,
      });
    if (!result.deletedCount) throw httpError(404, "Screenshot not found");
    await db
      .collection("bugReports")
      .updateOne(
        { _id: req.bug._id, screenshotCount: { $gt: 0 } },
        { $inc: { screenshotCount: -1 } },
      );
    res.status(204).end();
  }),
);

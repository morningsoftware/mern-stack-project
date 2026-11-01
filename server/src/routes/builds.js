import { Router } from "express";
import { recordActivity } from "../activity.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import {
  oneOf,
  optionalString,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const buildsRouter = Router();
buildsRouter.use(requireAuth);
const platforms = ["windows", "macos", "linux", "web", "other"];

function downloadUrl(value) {
  const text = requireString(value, "downloadUrl");
  let url;
  try {
    url = new URL(text);
  } catch {
    throw httpError(400, "downloadUrl must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw httpError(
      400,
      "downloadUrl must use HTTPS without embedded credentials",
    );
  return url.href;
}

buildsRouter.get(
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
        .collection("builds")
        .find({ projectId })
        .sort({ createdOn: -1, _id: -1 })
        .toArray(),
    );
  }),
);

buildsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const db = req.app.locals.db;
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const createdBy = parseObjectId(req.user._id.toString(), "user");
    await requireProjectTeamMember(db, projectId, createdBy);
    const version = requireString(req.body?.version, "version");
    if (version.length > 80)
      throw httpError(400, "version must be 80 characters or fewer");
    const doc = {
      projectId,
      version,
      platform: oneOf(req.body?.platform, platforms, "platform"),
      downloadUrl: downloadUrl(req.body?.downloadUrl),
      releaseNotes:
        optionalString(req.body?.releaseNotes, "releaseNotes") ?? "",
      createdOn: new Date(),
      createdBy,
    };
    const result = await db.collection("builds").insertOne(doc);
    await recordActivity(
      req,
      res,
      "build",
      { ...doc, _id: result.insertedId },
      "created",
    );
    res.status(201).json({ ...doc, _id: result.insertedId });
  }),
);

buildsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(req.app.locals.db.collection("builds"), id, "Build"),
    );
  }),
);

buildsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const db = req.app.locals.db;
    const id = parseObjectId(req.params.id, "id");
    const builds = db.collection("builds");
    const existing = await requireDoc(builds, id, "Build");
    await requireProjectTeamMember(
      db,
      existing.projectId,
      parseObjectId(req.user._id.toString(), "user"),
    );
    const update = {};
    if (req.body?.version !== undefined) {
      update.version = requireString(req.body.version, "version");
      if (update.version.length > 80)
        throw httpError(400, "version must be 80 characters or fewer");
    }
    if (req.body?.platform !== undefined)
      update.platform = oneOf(req.body.platform, platforms, "platform");
    if (req.body?.downloadUrl !== undefined)
      update.downloadUrl = downloadUrl(req.body.downloadUrl);
    if (req.body?.releaseNotes !== undefined)
      update.releaseNotes =
        optionalString(req.body.releaseNotes, "releaseNotes") ?? "";
    if (!Object.keys(update).length)
      throw httpError(400, "No updatable fields were provided");
    update.updatedOn = new Date();
    await builds.updateOne({ _id: id }, { $set: update });
    const updated = await builds.findOne({ _id: id });
    await recordActivity(req, res, "build", updated, "updated", existing);
    res.json(updated);
  }),
);

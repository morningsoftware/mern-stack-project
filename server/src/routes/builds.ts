import { Router } from "express";
import { ObjectId } from "mongodb";
import type { Db, Filter } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type {
  BuildDocument,
  ProjectDocument,
  TeamDocument,
  TeamMemberDocument,
} from "../schema.js";
import { BUILD_PLATFORMS } from "../schema.js";
import {
  oneOf,
  optionalString,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const buildsRouter = Router();
buildsRouter.use(requireAuth);

function downloadUrl(value: unknown): string {
  const text = requireString(value, "downloadUrl");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw httpError(400, "downloadUrl must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw httpError(
      400,
      "downloadUrl must use HTTPS without embedded credentials"
    );
  return url.href;
}

async function requireTeamMember(
  db: Db,
  projectId: ObjectId,
  userId: ObjectId
): Promise<void> {
  const project = await requireDoc(
    db.collection<ProjectDocument>("projects"),
    projectId,
    "Project"
  );
  const team = await requireDoc(
    db.collection<TeamDocument>("teams"),
    project.teamId,
    "Team"
  );
  const member = await db
    .collection<TeamMemberDocument>("teamMembers")
    .findOne({ teamId: project.teamId, userId });
  if (team.createdBy?.toString() !== userId.toString() && !member)
    throw httpError(403, "Only team members can publish or edit builds");
}

buildsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.query.projectId, "projectId");
    await requireDoc(
      req.app.locals.db.collection<ProjectDocument>("projects"),
      projectId,
      "Project"
    );
    const filter: Filter<BuildDocument> = { projectId };
    const builds = await req.app.locals.db
      .collection<BuildDocument>("builds")
      .find(filter)
      .sort({ createdOn: -1, _id: -1 })
      .toArray();
    res.json(builds);
  })
);

buildsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const db = req.app.locals.db;
    const projectId = parseObjectId(req.body?.projectId, "projectId");
    const createdBy = actorId(req);
    await requireTeamMember(db, projectId, createdBy);
    const version = requireString(req.body?.version, "version");
    if (version.length > 80)
      throw httpError(400, "version must be 80 characters or fewer");
    const doc: BuildDocument = {
      _id: new ObjectId(),
      projectId,
      version,
      platform: oneOf(req.body?.platform, BUILD_PLATFORMS, "platform"),
      downloadUrl: downloadUrl(req.body?.downloadUrl),
      releaseNotes:
        optionalString(req.body?.releaseNotes, "releaseNotes") ?? "",
      createdOn: new Date(),
      createdBy,
    };
    await db.collection<BuildDocument>("builds").insertOne(doc);
    res.status(201).json(doc);
  })
);

buildsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    res.json(
      await requireDoc(
        req.app.locals.db.collection<BuildDocument>("builds"),
        id,
        "Build"
      )
    );
  })
);

buildsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const db = req.app.locals.db;
    const id = parseObjectId(req.params.id, "id");
    const builds = db.collection<BuildDocument>("builds");
    const existing = await requireDoc(builds, id, "Build");
    await requireTeamMember(db, existing.projectId, actorId(req));
    const update: Partial<BuildDocument> = {};
    if (req.body?.version !== undefined) {
      const version = requireString(req.body.version, "version");
      if (version.length > 80)
        throw httpError(400, "version must be 80 characters or fewer");
      update.version = version;
    }
    if (req.body?.platform !== undefined)
      update.platform = oneOf(
        req.body.platform,
        BUILD_PLATFORMS,
        "platform"
      );
    if (req.body?.downloadUrl !== undefined)
      update.downloadUrl = downloadUrl(req.body.downloadUrl);
    if (req.body?.releaseNotes !== undefined)
      update.releaseNotes =
        optionalString(req.body.releaseNotes, "releaseNotes") ?? "";
    if (!Object.keys(update).length)
      throw httpError(400, "No updatable fields were provided");
    update.updatedOn = new Date();
    await builds.updateOne({ _id: id }, { $set: update });
    res.json(await builds.findOne({ _id: id }));
  })
);

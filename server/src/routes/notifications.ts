import { Router } from "express";
import type { Filter } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import type { NotificationDocument } from "../schema.js";
import { parseObjectId } from "../validate.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.query.projectId, "projectId");
    await requireProjectTeamMember(
      req.app.locals.db,
      projectId,
      req.user!._id,
    );
    if (
      req.query.unread !== undefined &&
      !["true", "false"].includes(req.query.unread as string)
    )
      throw httpError(400, "unread must be true or false");
    const filter: Filter<NotificationDocument> = {
      projectId,
      userId: req.user!._id,
    };
    const unreadCount = await req.app.locals.db
      .collection<NotificationDocument>("notifications")
      .countDocuments({ ...filter, readOn: null });
    if (req.query.unread === "true") filter.readOn = null;
    if (req.query.before !== undefined)
      filter._id = { $lt: parseObjectId(req.query.before, "before") };
    const rows = await req.app.locals.db
      .collection<NotificationDocument>("notifications")
      .find(filter)
      .sort({ _id: -1 })
      .limit(31)
      .toArray();
    const notifications = rows.slice(0, 30);
    res.json({
      notifications,
      unreadCount,
      hasMore: rows.length > 30,
      nextBefore: notifications.at(-1)?._id || null,
    });
  }),
);
notificationsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    if (typeof req.body?.read !== "boolean")
      throw httpError(400, "read must be true or false");
    const collection =
      req.app.locals.db.collection<NotificationDocument>("notifications");
    const filter = {
      _id: parseObjectId(req.params.id, "id"),
      userId: req.user!._id,
    };
    const doc = await collection.findOne(filter);
    if (!doc) throw httpError(404, "Notification not found");
    await requireProjectTeamMember(
      req.app.locals.db,
      doc.projectId,
      req.user!._id,
    );
    const updated = await collection.findOneAndUpdate(
      filter,
      { $set: { readOn: req.body.read ? doc.readOn || new Date() : null } },
      { returnDocument: "after" },
    );
    res.json(updated);
  }),
);

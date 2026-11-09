import { Router } from "express";
import { asyncRoute } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectTeamMember } from "../projectAccess.js";
import { parseObjectId } from "../validate.js";
export const activityRouter = Router();
activityRouter.use(requireAuth);
activityRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const projectId = parseObjectId(req.query.projectId, "projectId");
    await requireProjectTeamMember(req.app.locals.db, projectId, req.user._id);
    const filter = { projectId };
    if (req.query.before !== undefined)
      filter._id = { $lt: parseObjectId(req.query.before, "before") };
    const rows = await req.app.locals.db
      .collection("projectActivity")
      .find(filter)
      .sort({ _id: -1 })
      .limit(31)
      .toArray();
    const events = rows.slice(0, 30);
    res.json({
      events,
      hasMore: rows.length > 30,
      nextBefore: events.at(-1)?._id || null,
    });
  }),
);

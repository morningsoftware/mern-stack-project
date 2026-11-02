import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type { UserDocument } from "../schema.js";
import { USER_ROLES, publicUser } from "../schema.js";
import { oneOf, optionalString, parseObjectId, requireDoc } from "../validate.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const users = await req.app.locals.db
      .collection<UserDocument>("users")
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ username: 1 })
      .toArray();
    res.json(users.map(publicUser));
  })
);

usersRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const user = await requireDoc(
      req.app.locals.db.collection<UserDocument>("users"),
      id,
      "User"
    );
    res.json(publicUser(user));
  })
);

usersRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    if (id.toString() !== actorId(req).toString()) {
      throw httpError(403, "You can only update your own profile");
    }
    const users = req.app.locals.db.collection<UserDocument>("users");
    await requireDoc(users, id, "User");

    const update: Partial<UserDocument> = {};
    const displayName = optionalString(req.body?.displayName, "displayName");
    if (displayName !== undefined) update.displayName = displayName;
    if (req.body?.role !== undefined) {
      update.role = oneOf(req.body.role, USER_ROLES, "role");
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }

    await users.updateOne({ _id: id }, { $set: update });
    const user = await users.findOne({ _id: id });
    res.json(publicUser(user));
  })
);

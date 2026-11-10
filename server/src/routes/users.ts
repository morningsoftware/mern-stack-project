import express, { Router } from "express";
import type { Request } from "express";
import { Binary } from "mongodb";
import type { ObjectId } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import {
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  imageContentType,
} from "../images.js";
import { actorId, requireAuth } from "../middleware/auth.js";
import type { UserAvatarDocument, UserDocument } from "../schema.js";
import { USER_ROLES, publicUser } from "../schema.js";
import { oneOf, optionalString, parseObjectId, requireDoc } from "../validate.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

function requireSelf(req: Request, id: ObjectId) {
  if (id.toString() !== actorId(req).toString()) {
    throw httpError(403, "You can only update your own profile");
  }
}

usersRouter.get(
  "/:id/avatar",
  asyncRoute(async (req, res) => {
    const userId = parseObjectId(req.params.id, "id");
    const avatar = await req.app.locals.db
      .collection<UserAvatarDocument>("userAvatars")
      .findOne({ userId });
    if (!avatar) throw httpError(404, "Profile picture not found");
    res.set({
      "Content-Type": avatar.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    });
    res.send(Buffer.from(avatar.data.buffer));
  })
);

usersRouter.post(
  "/:id/avatar",
  express.raw({
    type: [...IMAGE_CONTENT_TYPES],
    limit: IMAGE_MAX_BYTES,
  }),
  asyncRoute(async (req, res) => {
    const userId = parseObjectId(req.params.id, "id");
    requireSelf(req, userId);
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw httpError(
        400,
        "Choose a PNG, JPEG, or WebP profile picture (up to 2 MB)",
      );
    }
    const contentType = imageContentType(req.body, "profile picture");
    if (contentType !== req.get("Content-Type")?.split(";")[0]) {
      throw httpError(400, "Image type does not match its contents");
    }

    const db = req.app.locals.db;
    const users = db.collection<UserDocument>("users");
    await requireDoc(users, userId, "User");
    const updatedOn = new Date();
    await db.collection<UserAvatarDocument>("userAvatars").updateOne(
      { userId },
      {
        $set: {
          contentType,
          size: req.body.length,
          updatedOn,
          data: new Binary(req.body),
        },
      },
      { upsert: true },
    );
    const updated = await users.findOneAndUpdate(
      { _id: userId },
      { $set: { avatarUpdatedOn: updatedOn } },
      { returnDocument: "after" },
    );
    if (!updated) throw httpError(404, "User not found");
    res.status(201).json({ user: publicUser(updated) });
  })
);

usersRouter.delete(
  "/:id/avatar",
  asyncRoute(async (req, res) => {
    const userId = parseObjectId(req.params.id, "id");
    requireSelf(req, userId);
    const db = req.app.locals.db;
    const users = db.collection<UserDocument>("users");
    await requireDoc(users, userId, "User");
    await db.collection<UserAvatarDocument>("userAvatars").deleteOne({ userId });
    const updated = await users.findOneAndUpdate(
      { _id: userId },
      { $set: { avatarUpdatedOn: null } },
      { returnDocument: "after" },
    );
    if (!updated) throw httpError(404, "User not found");
    res.json({ user: publicUser(updated) });
  })
);

usersRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const users = await req.app.locals.db
      .collection<UserDocument>("users")
      .find(
        {},
        {
          projection: {
            passwordHash: 0,
            githubAccessToken: 0,
            githubRefreshToken: 0,
          },
        },
      )
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

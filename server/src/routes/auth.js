import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { checkPassword, hashPassword, requireAuth, signToken } from "../middleware/auth.js";
import { USER_ROLES, publicUser } from "../schema.js";
import { oneOf, requireString } from "../validate.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncRoute(async (req, res) => {
    const username = requireString(req.body?.username, "username");
    const email = requireString(req.body?.email, "email").toLowerCase();
    const displayName = requireString(req.body?.displayName, "displayName");
    const role = oneOf(req.body?.role, USER_ROLES, "role");
    const password = requireString(req.body?.password, "password");
    if (password.length < 8) {
      throw httpError(400, "password must be at least 8 characters");
    }

    const users = req.app.locals.db.collection("users");
    const existing = await users.findOne({
      $or: [{ username }, { email }],
    });
    if (existing) {
      throw httpError(409, "username or email is already in use");
    }

    const now = new Date();
    const doc = {
      username,
      email,
      displayName,
      role,
      passwordHash: await hashPassword(password),
      createdOn: now,
      createdBy: null,
    };
    const result = await users.insertOne(doc);
    const user = publicUser({ ...doc, _id: result.insertedId });
    res.status(201).json({ token: signToken(result.insertedId), user });
  })
);

authRouter.post(
  "/login",
  asyncRoute(async (req, res) => {
    const identifier = requireString(
      req.body?.username || req.body?.email,
      "username"
    );
    const password = requireString(req.body?.password, "password");
    const users = req.app.locals.db.collection("users");
    const user = await users.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });
    if (!user?.passwordHash || !(await checkPassword(password, user.passwordHash))) {
      throw httpError(401, "Invalid username or password");
    }
    res.json({ token: signToken(user._id), user: publicUser(user) });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ user: req.user });
  })
);

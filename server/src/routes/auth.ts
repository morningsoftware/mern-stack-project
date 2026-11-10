import { Router } from "express";
import { ObjectId } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import {
  checkPassword,
  hashPassword,
  requireAuth,
  signToken,
} from "../middleware/auth.js";
import type { OAuthUserDocument } from "../oauthAccounts.js";
import type { UserDocument } from "../schema.js";
import { USER_ROLES, publicUser } from "../schema.js";
import { clearAuthCookies, setAuthCookies } from "../session.js";
import {
  oneOf,
  optionalPassword,
  passwordValue,
  requirePassword,
  requireString,
} from "../validate.js";

export const authRouter = Router();

authRouter.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

authRouter.post(
  "/register",
  asyncRoute(async (req, res) => {
    const username = requireString(req.body?.username, "username");
    const email = requireString(req.body?.email, "email").toLowerCase();
    const displayName = requireString(req.body?.displayName, "displayName");
    const role = oneOf(req.body?.role, USER_ROLES, "role");
    const password = requirePassword(req.body?.password, "password");

    const users = req.app.locals.db.collection<UserDocument>("users");
    const existing = await users.findOne({
      $or: [{ username }, { email }],
    });
    if (existing) {
      throw httpError(409, "username or email is already in use");
    }

    const now = new Date();
    const doc: UserDocument = {
      _id: new ObjectId(),
      username,
      email,
      displayName,
      role,
      passwordHash: await hashPassword(password),
      createdOn: now,
      createdBy: null,
    };
    await users.insertOne(doc);
    const token = signToken(doc._id);
    setAuthCookies(res, token);
    res.status(201).json({ token, user: publicUser(doc) });
  })
);

authRouter.post(
  "/login",
  asyncRoute(async (req, res) => {
    const identifier = requireString(
      req.body?.username || req.body?.email,
      "username"
    );
    const password = passwordValue(req.body?.password, "password");
    const users = req.app.locals.db.collection<UserDocument>("users");
    const user = await users.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });
    if (
      !user?.passwordHash ||
      !(await checkPassword(password, user.passwordHash))
    ) {
      throw httpError(401, "Invalid username or password");
    }
    const token = signToken(user._id);
    setAuthCookies(res, token);
    res.json({ token, user: publicUser(user) });
  })
);

authRouter.post("/logout", (req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ user: req.user });
  })
);

authRouter.get(
  "/account",
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await req.app.locals.db
      .collection<OAuthUserDocument>("users")
      .findOne({ _id: req.user!._id });
    if (!user) throw httpError(401, "Invalid or expired token");

    res.json({
      user: publicUser(user),
      hasPassword: Boolean(user.passwordHash),
      providers: (user.oauthAccounts || []).map((account) => ({
        provider: account.provider,
        email: account.email,
        linkedOn: account.linkedOn,
      })),
    });
  })
);

authRouter.post(
  "/password",
  requireAuth,
  asyncRoute(async (req, res) => {
    const newPassword = requirePassword(req.body?.newPassword, "newPassword");
    const currentPassword = optionalPassword(
      req.body?.currentPassword,
      "currentPassword"
    );

    const users = req.app.locals.db.collection<UserDocument>("users");
    const user = await users.findOne({ _id: req.user!._id });
    if (!user) throw httpError(401, "Invalid or expired token");

    if (user.passwordHash) {
      if (
        !currentPassword ||
        !(await checkPassword(currentPassword, user.passwordHash))
      ) {
        throw httpError(401, "Current password is incorrect");
      }
    }

    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(newPassword) } }
    );
    res.json({ ok: true, hasPassword: true });
  })
);

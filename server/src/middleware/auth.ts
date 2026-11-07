import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { ObjectId } from "mongodb";
import type { Request } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { publicUser } from "../schema.js";
import type { UserDocument } from "../schema.js";

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function checkPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(userId: ObjectId | string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "JWT_SECRET is not set");
  return jwt.sign({ sub: userId.toString() }, secret, { expiresIn: "7d" });
}

export function actorId(req: Request): ObjectId {
  if (!req.user) throw httpError(401, "Authentication required");
  return req.user._id;
}

export const requireAuth = asyncRoute(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError(401, "Authentication required");

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "JWT_SECRET is not set");

  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(match[1], secret);
  } catch {
    throw httpError(401, "Invalid or expired token");
  }

  if (
    typeof payload === "string" ||
    !payload.sub ||
    !ObjectId.isValid(payload.sub)
  ) {
    throw httpError(401, "Invalid or expired token");
  }

  const user = await req.app.locals.db
    .collection<UserDocument>("users")
    .findOne({ _id: new ObjectId(payload.sub) });
  if (!user) throw httpError(401, "Invalid or expired token");

  const profile = publicUser(user);
  if (!profile) throw httpError(401, "Invalid or expired token");
  req.user = profile;
  next();
});

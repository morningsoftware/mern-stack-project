import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { asyncRoute, httpError } from "../errors.js";
import { publicUser } from "../schema.js";

const BCRYPT_ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function checkPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "JWT_SECRET is not set");
  return jwt.sign({ sub: userId.toString() }, secret, { expiresIn: "7d" });
}

export const requireAuth = asyncRoute(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError(401, "Authentication required");

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "JWT_SECRET is not set");

  let payload;
  try {
    payload = jwt.verify(match[1], secret);
  } catch {
    throw httpError(401, "Invalid or expired token");
  }

  if (!payload?.sub || !ObjectId.isValid(payload.sub)) {
    throw httpError(401, "Invalid or expired token");
  }

  const user = await req.app.locals.db
    .collection("users")
    .findOne({ _id: new ObjectId(payload.sub) });
  if (!user) throw httpError(401, "Invalid or expired token");

  req.user = publicUser(user);
  next();
});

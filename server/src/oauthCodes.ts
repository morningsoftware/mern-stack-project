import type { Db, ObjectId, WithId } from "mongodb";
import {
  OAUTH_LOGIN_CODE_TTL_MS,
  createOpaqueToken,
  expiresFromNow,
  hashToken,
} from "./oauthTokens.js";

interface OAuthLoginCodeDocument {
  _id: string;
  userId: ObjectId;
  provider: string;
  expiresAt: Date;
  createdAt: Date;
}

export async function createLoginCode(
  db: Db,
  userId: ObjectId,
  provider: string
): Promise<string> {
  const code = createOpaqueToken();
  await db.collection<OAuthLoginCodeDocument>("oauthLoginCodes").insertOne({
    _id: hashToken(code),
    userId,
    provider,
    expiresAt: expiresFromNow(OAUTH_LOGIN_CODE_TTL_MS),
    createdAt: new Date(),
  });
  return code;
}

export async function consumeLoginCode(
  db: Db,
  code: string
): Promise<WithId<OAuthLoginCodeDocument> | null> {
  return db.collection<OAuthLoginCodeDocument>("oauthLoginCodes").findOneAndDelete({
    _id: hashToken(code),
    expiresAt: { $gt: new Date() },
  });
}

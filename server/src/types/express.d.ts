import type { Db, ObjectId } from "mongodb";
import type { OAuthConfig } from "../oauth.js";
import type { PublicUser } from "../schema.js";
import type { AuthSource } from "../session.js";

declare global {
  namespace Express {
    interface Locals {
      db: Db;
      oauth?: OAuthConfig;
    }

    interface User extends PublicUser {}

    interface Request {
      user?: PublicUser;
      authMethod?: AuthSource;
      oauthLinkUserId?: ObjectId;
      oauthState?: {
        provider: string;
        linkUserId: ObjectId | null;
      };
    }
  }
}

export {};

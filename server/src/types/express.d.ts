import type { Db } from "mongodb";
import type { PublicUser } from "../schema.js";

declare global {
  namespace Express {
    interface Locals {
      db: Db;
    }

    interface Request {
      user?: PublicUser;
    }
  }
}

export {};

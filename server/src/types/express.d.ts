import type { Db } from "mongodb";
import type {
  BugReportDocument,
  PlaytestSessionDocument,
  ProjectDocument,
  PublicUser,
  TaskDocument,
} from "../schema.js";

declare global {
  namespace Express {
    interface Locals {
      db: Db;
    }

    interface Request {
      user?: PublicUser;
      bug?: BugReportDocument;
      commentTask?: TaskDocument;
      project?: ProjectDocument;
      session?: PlaytestSessionDocument;
    }
  }
}

export {};

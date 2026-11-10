import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { notifyForActivity } from "./notifications.js";
import type {
  ActivityChange,
  ActivityDocument,
  ActivityResource,
  ProjectActivityDocument,
} from "./schema.js";

const tracked = [
  "title",
  "name",
  "version",
  "status",
  "priority",
  "severity",
  "assigneeId",
  "milestoneId",
  "dueDate",
  "reviewStatus",
  "instructions",
  "deadline",
] as const satisfies readonly (keyof ActivityDocument)[];

const value = (input: unknown): string | null =>
  input == null
    ? null
    : input instanceof Date
      ? input.toISOString()
      : String(input).slice(0, 160);

export async function recordActivity(
  req: Request,
  res: Response,
  resource: ActivityResource,
  doc: ActivityDocument,
  action: "created" | "updated",
  previous?: ActivityDocument | null,
): Promise<void> {
  const changes: Record<string, ActivityChange> = {};
  if (previous)
    for (const field of tracked)
      if (value(previous[field]) !== value(doc[field]))
        changes[field] = {
          from: value(previous[field]),
          to: value(doc[field]),
        };
  if (action === "updated" && !Object.keys(changes).length) return;
  const event: ProjectActivityDocument = {
    _id: new ObjectId(),
    projectId: doc.projectId,
    resource,
    resourceId: doc._id,
    action,
    label: value(doc.title || doc.name || doc.version || "Playtest feedback"),
    changes,
    actorId: req.user!._id,
    actorName: req.user!.displayName,
    createdOn: new Date(),
  };
  try {
    await req.app.locals.db
      .collection<ProjectActivityDocument>("projectActivity")
      .insertOne(event);
    try {
      await notifyForActivity(req.app.locals.db, event, doc, previous);
    } catch {
      res.set("X-Checkpoint-Notifications", "unavailable");
      console.warn(
        "Notification recording unavailable; primary write succeeded",
      );
    }
  } catch {
    res.set("X-Checkpoint-Activity", "unavailable");
    console.warn("Activity recording unavailable; primary write succeeded");
  }
}

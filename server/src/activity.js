import { notifyForActivity } from "./notifications.js";
import { ObjectId } from "mongodb";
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
];
const value = (input) =>
  input == null
    ? null
    : input instanceof Date
      ? input.toISOString()
      : String(input).slice(0, 160);
export async function recordActivity(
  req,
  res,
  resource,
  doc,
  action,
  previous,
) {
  const changes = {};
  if (previous)
    for (const field of tracked)
      if (value(previous[field]) !== value(doc[field]))
        changes[field] = {
          from: value(previous[field]),
          to: value(doc[field]),
        };
  if (action === "updated" && !Object.keys(changes).length) return;
  const event = {
    _id: new ObjectId(),
    projectId: doc.projectId,
    resource,
    resourceId: doc._id,
    action,
    label: value(doc.title || doc.name || doc.version || "Playtest feedback"),
    changes,
    actorId: req.user._id,
    actorName: req.user.displayName,
    createdOn: new Date(),
  };
  try {
    await req.app.locals.db.collection("projectActivity").insertOne(event);
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

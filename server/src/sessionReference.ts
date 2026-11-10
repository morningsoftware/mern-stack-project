import type { Db, ObjectId } from "mongodb";
import { httpError } from "./errors.js";
import type { PlaytestSessionDocument } from "./schema.js";
import { optionalObjectId, requireDoc } from "./validate.js";

export async function validateSessionReference(
  db: Db,
  value: unknown,
  projectId: ObjectId,
  buildId: ObjectId | null | undefined,
): Promise<ObjectId | null> {
  const id = optionalObjectId(value, "sessionId");
  if (!id) return null;
  const session = await requireDoc(
    db.collection<PlaytestSessionDocument>("playtestSessions"),
    id,
    "Playtest session",
  );
  if (
    session.projectId.toString() !== projectId.toString() ||
    session.buildId.toString() !== buildId?.toString()
  )
    throw httpError(400, "Session must match the feedback project and build");
  if (session.status !== "open" || session.deadline <= new Date())
    throw httpError(
      409,
      "This playtest session is closed or past its deadline",
    );
  return id;
}

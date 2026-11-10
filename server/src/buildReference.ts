import type { Db, ObjectId } from "mongodb";
import { httpError } from "./errors.js";
import type { BuildDocument } from "./schema.js";
import { optionalObjectId, requireDoc } from "./validate.js";

export async function validateBuildReference(
  db: Db,
  value: unknown,
  projectId: ObjectId,
): Promise<ObjectId | null> {
  const buildId = optionalObjectId(value, "buildId");
  if (!buildId) return null;
  const build = await requireDoc(
    db.collection<BuildDocument>("builds"),
    buildId,
    "Build",
  );
  if (build.projectId.toString() !== projectId.toString()) {
    throw httpError(400, "build does not belong to that project");
  }
  return buildId;
}

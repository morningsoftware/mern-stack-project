import { httpError } from "./errors.js";
import { optionalObjectId, requireDoc } from "./validate.js";

export async function validateBuildReference(db, value, projectId) {
  const buildId = optionalObjectId(value, "buildId");
  if (!buildId) return null;
  const build = await requireDoc(db.collection("builds"), buildId, "Build");
  if (build.projectId.toString() !== projectId.toString()) {
    throw httpError(400, "build does not belong to that project");
  }
  return buildId;
}

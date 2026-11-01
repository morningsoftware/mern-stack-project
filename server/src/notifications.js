import { ObjectId } from "mongodb";
export async function notifyForActivity(db, event, doc, previous) {
  const assignment =
    event.resource === "task" &&
    (event.action === "created" ||
      previous?.assigneeId?.toString() !== doc.assigneeId?.toString());
  const feedback = event.resource === "feedback" && event.action === "created";
  if (!assignment && !feedback) return;
  let candidates = [];
  const project = await db
    .collection("projects")
    .findOne({ _id: doc.projectId });
  if (!project) return;
  const team = await db.collection("teams").findOne({ _id: project.teamId });
  const members = await db
    .collection("teamMembers")
    .find({ teamId: project.teamId })
    .toArray();
  const allowed = new Set(
    [
      ...members.map((member) => member.userId.toString()),
      team?.createdBy?.toString(),
    ].filter(Boolean),
  );
  let message;
  if (
    event.resource === "task" &&
    (event.action === "created" ||
      previous?.assigneeId?.toString() !== doc.assigneeId?.toString())
  ) {
    if (doc.assigneeId) candidates = [doc.assigneeId];
    message = `Assigned to you: ${String(doc.title).slice(0, 160)}`;
  } else if (event.resource === "feedback" && event.action === "created") {
    candidates = [...allowed].map((id) => new ObjectId(id));
    message = `New playtest feedback in ${String(project.name).slice(0, 160)}`;
  } else return;
  const unique = [...new Set(candidates.map((id) => id.toString()))].filter(
    (id) => id !== event.actorId.toString() && allowed.has(id),
  );
  if (!unique.length) return;
  await db.collection("notifications").insertMany(
    unique.map((id) => ({
      eventId: event._id,
      userId: new ObjectId(id),
      projectId: doc.projectId,
      resource: event.resource,
      resourceId: doc._id,
      message,
      createdOn: new Date(),
      readOn: null,
    })),
  );
}

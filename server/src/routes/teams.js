import { Router } from "express";
import { asyncRoute, httpError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import { TEAM_MEMBER_ROLES } from "../schema.js";
import {
  oneOf,
  optionalString,
  parseObjectId,
  requireDoc,
  requireString,
} from "../validate.js";

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

function actorId(req) {
  return parseObjectId(req.user._id.toString(), "user");
}

teamsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const teams = await req.app.locals.db
      .collection("teams")
      .find({})
      .sort({ createdOn: -1 })
      .toArray();
    res.json(teams);
  })
);

teamsRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const name = requireString(req.body?.name, "name");
    const description = optionalString(req.body?.description, "description") ?? "";
    const now = new Date();
    const createdBy = actorId(req);
    const doc = { name, description, createdOn: now, createdBy };
    const result = await req.app.locals.db.collection("teams").insertOne(doc);
    await req.app.locals.db.collection("teamMembers").insertOne({
      teamId: result.insertedId,
      userId: createdBy,
      role: "owner",
      createdOn: now,
      createdBy,
    });
    res.status(201).json({ ...doc, _id: result.insertedId });
  })
);

teamsRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const team = await requireDoc(req.app.locals.db.collection("teams"), id, "Team");
    res.json(team);
  })
);

teamsRouter.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const teams = req.app.locals.db.collection("teams");
    await requireDoc(teams, id, "Team");
    const update = {};
    const name = optionalString(req.body?.name, "name");
    if (name !== undefined) update.name = name;
    if (req.body?.description !== undefined) {
      update.description = optionalString(req.body.description, "description") ?? "";
    }
    if (Object.keys(update).length === 0) {
      throw httpError(400, "No updatable fields were provided");
    }
    await teams.updateOne({ _id: id }, { $set: update });
    res.json(await teams.findOne({ _id: id }));
  })
);

teamsRouter.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const id = parseObjectId(req.params.id, "id");
    const teams = req.app.locals.db.collection("teams");
    await requireDoc(teams, id, "Team");
    await teams.deleteOne({ _id: id });
    await req.app.locals.db.collection("teamMembers").deleteMany({ teamId: id });
    res.status(204).end();
  })
);

teamsRouter.get(
  "/:id/members",
  asyncRoute(async (req, res) => {
    const teamId = parseObjectId(req.params.id, "id");
    await requireDoc(req.app.locals.db.collection("teams"), teamId, "Team");
    const members = await req.app.locals.db
      .collection("teamMembers")
      .find({ teamId })
      .sort({ createdOn: 1 })
      .toArray();
    res.json(members);
  })
);

teamsRouter.post(
  "/:id/members",
  asyncRoute(async (req, res) => {
    const teamId = parseObjectId(req.params.id, "id");
    const userId = parseObjectId(req.body?.userId, "userId");
    const role = oneOf(req.body?.role, TEAM_MEMBER_ROLES, "role");
    const db = req.app.locals.db;
    await requireDoc(db.collection("teams"), teamId, "Team");
    await requireDoc(db.collection("users"), userId, "User");

    const existing = await db.collection("teamMembers").findOne({ teamId, userId });
    if (existing) throw httpError(409, "That user is already on this team");

    const now = new Date();
    const createdBy = actorId(req);
    const doc = { teamId, userId, role, createdOn: now, createdBy };
    const result = await db.collection("teamMembers").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  })
);

teamsRouter.patch(
  "/:id/members/:userId",
  asyncRoute(async (req, res) => {
    const teamId = parseObjectId(req.params.id, "id");
    const userId = parseObjectId(req.params.userId, "userId");
    const role = oneOf(req.body?.role, TEAM_MEMBER_ROLES, "role");
    const members = req.app.locals.db.collection("teamMembers");
    const existing = await members.findOne({ teamId, userId });
    if (!existing) throw httpError(404, "Team member not found");
    await members.updateOne({ _id: existing._id }, { $set: { role } });
    res.json(await members.findOne({ _id: existing._id }));
  })
);

teamsRouter.delete(
  "/:id/members/:userId",
  asyncRoute(async (req, res) => {
    const teamId = parseObjectId(req.params.id, "id");
    const userId = parseObjectId(req.params.userId, "userId");
    const result = await req.app.locals.db
      .collection("teamMembers")
      .deleteOne({ teamId, userId });
    if (result.deletedCount === 0) throw httpError(404, "Team member not found");
    res.status(204).end();
  })
);

// Document fields match database/data.js. passwordHash is stored only so a
// user can authenticate; it is never part of an API response.
// Status values that the sample data only demonstrates once are extended just
// enough for a record to move forward. Field names are unchanged.

export const DATABASE_NAME = "mern";

export const USER_ROLES = ["developer", "artist", "playtester"];
export const TEAM_MEMBER_ROLES = ["owner", "developer", "artist"];
export const PROJECT_STATUSES = ["active", "completed", "archived"];
export const MILESTONE_STATUSES = ["todo", "in_progress", "completed"];
export const TASK_STATUSES = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES = ["low", "medium", "high"];
export const BUG_SEVERITIES = ["low", "medium", "high"];
export const BUG_STATUSES = ["open", "in_progress", "resolved"];

export const PUBLIC_USER_FIELDS = [
  "_id",
  "username",
  "email",
  "displayName",
  "role",
  "createdOn",
  "createdBy",
];

export function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdOn: user.createdOn,
    createdBy: user.createdBy ?? null,
  };
}

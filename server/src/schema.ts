import type { ObjectId } from "mongodb";

// Document fields match database/data.ts. passwordHash is stored only so a
// user can authenticate; it is never part of an API response.
// Status values that the sample data only demonstrates once are extended just
// enough for a record to move forward. Field names are unchanged.

export const DATABASE_NAME = "mern";

export const USER_ROLES = ["developer", "artist", "playtester"] as const;
export const TEAM_MEMBER_ROLES = ["owner", "developer", "artist"] as const;
export const PROJECT_STATUSES = ["active", "completed", "archived"] as const;
export const MILESTONE_STATUSES = ["todo", "in_progress", "completed"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const BUG_SEVERITIES = ["low", "medium", "high"] as const;
export const BUG_STATUSES = ["open", "in_progress", "resolved"] as const;
export const BUILD_PLATFORMS = [
  "windows",
  "macos",
  "linux",
  "web",
  "other",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type BugSeverity = (typeof BUG_SEVERITIES)[number];
export type BugStatus = (typeof BUG_STATUSES)[number];
export type BuildPlatform = (typeof BUILD_PLATFORMS)[number];

export const PUBLIC_USER_FIELDS = [
  "_id",
  "username",
  "email",
  "displayName",
  "role",
  "createdOn",
  "createdBy",
] as const;

export interface UserDocument {
  _id: ObjectId;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  passwordHash?: string;
  createdOn: Date;
  createdBy: ObjectId | null;
}

export interface PublicUser {
  _id: ObjectId;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdOn: Date;
  createdBy: ObjectId | null;
}

export interface TeamDocument {
  _id: ObjectId;
  name: string;
  description: string;
  createdOn: Date;
  createdBy: ObjectId;
}

export interface TeamMemberDocument {
  _id: ObjectId;
  teamId: ObjectId;
  userId: ObjectId;
  role: TeamMemberRole;
  createdOn: Date;
  createdBy: ObjectId;
}

export interface ProjectDocument {
  _id: ObjectId;
  teamId: ObjectId;
  name: string;
  description: string;
  status: ProjectStatus;
  createdOn: Date;
  createdBy: ObjectId;
}

export interface MilestoneDocument {
  _id: ObjectId;
  projectId: ObjectId;
  name: string;
  description: string;
  status: MilestoneStatus;
  dueDate: Date | null;
  createdOn: Date;
  createdBy: ObjectId;
}

export interface TaskDocument {
  _id: ObjectId;
  projectId: ObjectId;
  milestoneId: ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: ObjectId;
  createdOn: Date;
  createdBy: ObjectId;
}

export interface BugReportDocument {
  _id: ObjectId;
  projectId: ObjectId;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  reportedBy: ObjectId;
  createdOn: Date;
  createdBy: ObjectId;
}

export interface PlaytestFeedbackDocument {
  _id: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  rating: number;
  comments: string;
  buildId?: ObjectId | null;
  createdOn: Date;
  createdBy: ObjectId;
}

export interface BuildDocument {
  _id: ObjectId;
  projectId: ObjectId;
  version: string;
  platform: BuildPlatform;
  downloadUrl: string;
  releaseNotes: string;
  updatedOn?: Date;
  createdOn: Date;
  createdBy: ObjectId;
}

export function publicUser(user: UserDocument | null): PublicUser | null {
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

export const USER_ROLES = ["developer", "artist", "playtester"] as const;
export const MEMBER_ROLES = ["owner", "developer", "artist"] as const;
export const PROJECT_STATUSES = ["active", "completed", "archived"] as const;
export const MILESTONE_STATUSES = ["todo", "in_progress", "completed"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;
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
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof PRIORITIES)[number];
export type BugSeverity = (typeof BUG_SEVERITIES)[number];
export type BugStatus = (typeof BUG_STATUSES)[number];
export type BuildPlatform = (typeof BUILD_PLATFORMS)[number];

export type ProjectView =
  | "tasks"
  | "overview"
  | "milestones"
  | "bugs"
  | "builds"
  | "feedback";

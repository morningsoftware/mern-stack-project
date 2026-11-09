import type {
  BugSeverity,
  BugStatus,
  BuildPlatform,
  MemberRole,
  MilestoneStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "./constants";

export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdOn?: string;
  createdBy?: string | null;
}

export interface Team {
  _id: string;
  name: string;
  description?: string;
}

export interface TeamMember {
  _id: string;
  userId: string;
  role: MemberRole;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
}

export interface Milestone {
  _id: string;
  name: string;
  description?: string;
  dueDate?: string | null;
  status: MilestoneStatus;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  milestoneId: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface BugReport {
  _id: string;
  title: string;
  description?: string;
  severity: BugSeverity;
  status: BugStatus;
}

export interface PlaytestFeedback {
  _id: string;
  userId: string;
  rating: number;
  comments?: string;
  buildId?: string | null;
}

export interface Build {
  _id: string;
  version: string;
  platform: BuildPlatform;
  downloadUrl: string;
  releaseNotes: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

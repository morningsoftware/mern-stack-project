import type {
  BugSeverity,
  BugStatus,
  BuildPlatform,
  GithubCheckStatus,
  MemberRole,
  MilestoneStatus,
  PlaytestSessionStatus,
  ProjectStatus,
  ReviewStatus,
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
  createdBy?: string | null;
}

export interface TeamMember {
  _id: string;
  userId: string;
  role: MemberRole;
}

export interface Project {
  _id: string;
  teamId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  githubRepository?: string | null;
  githubInstallationId?: number | null;
  createdOn?: string;
  createdBy?: string | null;
}

export interface Milestone {
  _id: string;
  projectId?: string;
  name: string;
  description?: string;
  dueDate?: string | null;
  status: MilestoneStatus;
  createdOn?: string;
  createdBy?: string | null;
}

export interface Task {
  _id: string;
  projectId?: string;
  title: string;
  description?: string;
  milestoneId: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdOn?: string;
  createdBy?: string | null;
}

export interface BugReport {
  _id: string;
  projectId?: string;
  title: string;
  description?: string;
  reproductionSteps?: string;
  expectedResult?: string;
  actualResult?: string;
  environment?: string;
  buildId?: string | null;
  sourceFeedbackId?: string | null;
  severity: BugSeverity;
  status: BugStatus;
  reportedBy?: string;
  screenshotCount?: number;
  createdOn?: string;
  createdBy?: string | null;
}

export interface PlaytestFeedback {
  _id: string;
  projectId?: string;
  userId: string;
  rating: number;
  comments?: string;
  buildId?: string | null;
  sessionId?: string | null;
  reviewStatus?: ReviewStatus;
  reviewedBy?: string | null;
  reviewedOn?: string | null;
  createdOn?: string;
  createdBy?: string | null;
}

export interface PlaytestSession {
  _id: string;
  projectId: string;
  buildId: string;
  title: string;
  instructions: string;
  deadline: string;
  status: PlaytestSessionStatus;
  createdOn?: string;
  updatedOn?: string;
  createdBy?: string | null;
}

export interface Build {
  _id: string;
  projectId?: string;
  version: string;
  platform: BuildPlatform;
  downloadUrl: string;
  releaseNotes: string;
  createdOn?: string;
  updatedOn?: string;
  createdBy?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ActivityChange {
  from: string | null;
  to: string | null;
}

export interface ActivityEvent {
  _id: string;
  projectId: string;
  resource: string;
  resourceId: string;
  action: string;
  label: string;
  changes: Record<string, ActivityChange>;
  actorId?: string;
  actorName: string;
  createdOn: string;
}

export interface ActivityPage {
  events: ActivityEvent[];
  hasMore: boolean;
  nextBefore: string | null;
}

export interface Notification {
  _id: string;
  eventId?: string;
  userId?: string;
  projectId: string;
  resource: string;
  resourceId: string;
  message: string;
  createdOn: string;
  readOn: string | null;
}

export interface NotificationPage {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
  nextBefore: string | null;
}

export interface TaskComment {
  _id: string;
  taskId?: string;
  projectId?: string;
  authorId?: string;
  authorName: string;
  body: string;
  createdOn: string;
}

export interface TaskCommentsPage {
  comments: TaskComment[];
  hasMore: boolean;
  nextBefore: string | null;
}

export interface BugScreenshot {
  _id: string;
  contentType: string;
  size: number;
  createdOn: string;
  createdBy?: string;
}

export interface GithubAccessibleRepository {
  fullName: string;
  installationId: number | null;
}

export interface GithubAccount {
  connected: boolean;
  login: string | null;
  oauthConfigured: boolean;
  callbackUrl: string;
  installUrl: string | null;
  repositories: GithubAccessibleRepository[];
}

export interface GithubDelivery {
  _id: string;
  deliveryId?: string;
  event: string;
  action: string | null;
  repository: string | null;
  installationId?: number | null;
  detail: string | null;
  receivedOn: string;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  author: string | null;
}

export interface GithubLanguage {
  name: string;
  bytes: number;
  share: number;
}

export interface GithubContributor {
  login: string;
  contributions: number;
  url: string | null;
}

export interface GithubBranch {
  name: string;
  sha: string | null;
  protected: boolean;
  default: boolean;
  committedAt: string | null;
  message: string | null;
  author: string | null;
}

export interface GithubCommit {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string | null;
}

export interface GithubRepositorySnapshot {
  repository: {
    fullName: string;
    description: string | null;
    visibility: "public" | "private";
    defaultBranch: string | null;
    url: string | null;
    homepage: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    language: string | null;
    license: string | null;
    archived: boolean;
    pushedAt: string | null;
    createdAt: string | null;
  };
  languages: GithubLanguage[];
  contributors: GithubContributor[];
  contributorsReady: boolean;
  branches: GithubBranch[];
  branchesTruncated: boolean;
  commits: GithubCommit[];
}

export interface GithubCheckForm {
  name: string;
  headSha: string;
  status: GithubCheckStatus;
  conclusion: string;
  summary: string;
}

export interface BugDraft {
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  buildId: string;
  reproductionSteps: string;
  expectedResult: string;
  actualResult: string;
  environment: string;
  sourceFeedbackId: string;
}

export interface TaskDraft {
  title: string;
  description: string;
  milestoneId: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface MilestoneDraft {
  name: string;
  description: string;
  dueDate: string;
  status: MilestoneStatus;
}

export interface PlaytestNoteDraft {
  rating: string;
  comments: string;
  buildId: string;
  sessionId: string;
}

export interface BuildForm {
  version: string;
  platform: BuildPlatform;
  downloadUrl: string;
  releaseNotes: string;
}

export interface OAuthProvider {
  id: string;
  label: string;
}

export interface OAuthRegistration {
  provider: string;
  email: string;
  displayName: string;
  suggestedUsername: string;
}

export interface LinkedProvider {
  provider: string;
  email: string;
  linkedOn?: string;
}

export interface AccountResponse {
  user: User;
  hasPassword: boolean;
  providers: LinkedProvider[];
}

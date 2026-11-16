export type User = { _id: string; username: string; displayName: string; role?: string };
export type Project = { _id: string; name: string; description?: string; status: string };
export type Build = { _id: string; projectId?: string; version: string; platform: string; downloadUrl: string; releaseNotes?: string };
export type Session = { _id: string; title: string; instructions: string; buildId: string; status: string; deadline: string };
export type Bug = {
  _id: string; projectId: string; reportedBy: string; title: string; description: string; status: string; severity: string;
  buildId?: string; reproductionSteps?: string; expectedResult?: string; actualResult?: string; environment?: string;
  createdOn?: string; screenshotCount?: number;
};
export type Screenshot = { _id: string; contentType: string; size: number; createdOn?: string };

// Must match BUG_SEVERITIES / BUG_STATUSES in server/src/schema.ts. The server rejects any other value.
export const severities = ['low', 'medium', 'high'] as const;
export const bugStatuses = ['open', 'in_progress', 'resolved'] as const;
export type Severity = (typeof severities)[number];
export type BugStatus = (typeof bugStatuses)[number];

export type SessionState = 'open' | 'closed' | 'passed';

export function sessionOpen(session: Session, now = Date.now()) {
  return session.status === 'open' && new Date(session.deadline).getTime() > now;
}
export function sessionState(session: Session, now = Date.now()): SessionState {
  if (session.status !== 'open') return 'closed';
  return sessionOpen(session, now) ? 'open' : 'passed';
}

export function ownBugs(bugs: Bug[], userId: string) { return bugs.filter(bug => bug.reportedBy === userId); }

export function filterBugs(bugs: Bug[], status: BugStatus | 'all') {
  return status === 'all' ? bugs : bugs.filter(bug => bug.status === status);
}
export function countBugsByStatus(bugs: Bug[]): Record<BugStatus | 'all', number> {
  const counts = { all: bugs.length, open: 0, in_progress: 0, resolved: 0 };
  for (const bug of bugs) if (bug.status in counts && bug.status !== 'all') counts[bug.status as BugStatus]++;
  return counts;
}

const projectOrder: Record<string, number> = { active: 0, completed: 1, archived: 2 };
export function browseProjects(projects: Project[], query: string) {
  const needle = query.trim().toLowerCase();
  return projects
    .filter(project => !needle || `${project.name} ${project.description || ''}`.toLowerCase().includes(needle))
    .sort((a, b) => (projectOrder[a.status] ?? 3) - (projectOrder[b.status] ?? 3) || a.name.localeCompare(b.name));
}

export type BugField = 'title' | 'reproductionSteps' | 'actualResult' | 'expectedResult' | 'severity';
export type BugErrors = Partial<Record<BugField, string>>;

export function bugErrors(form: Record<string, string>): BugErrors {
  const errors: BugErrors = {};
  if (!form.title?.trim()) errors.title = 'Add a short bug title.';
  if (!form.reproductionSteps?.trim()) errors.reproductionSteps = 'Explain how to reproduce the bug.';
  if (!form.actualResult?.trim()) errors.actualResult = 'Describe what happened.';
  if (!form.expectedResult?.trim()) errors.expectedResult = 'Describe what you expected.';
  if (!(severities as readonly string[]).includes(form.severity)) errors.severity = 'Choose a valid severity.';
  return errors;
}

export function bugPayload(form: Record<string, string>, projectId: string) {
  const first = Object.values(bugErrors(form))[0];
  if (first) throw new Error(first);
  return { projectId, title: form.title.trim(), description: form.description?.trim() || '', severity: form.severity,
    reproductionSteps: form.reproductionSteps.trim(), expectedResult: form.expectedResult.trim(), actualResult: form.actualResult.trim(), environment: form.environment?.trim() || '',
    ...(form.buildId ? { buildId: form.buildId } : {}) };
}

export const ratingLabels = ['Poor', 'Rough', 'Okay', 'Good', 'Great'] as const;

export function feedbackPayload(input: { projectId: string; buildId?: string; sessionId?: string; rating: number | null; comments: string }) {
  if (!input.projectId) throw new Error('Choose a project before sending feedback.');
  if (input.rating === null || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error('Choose a rating from 1 to 5.');
  const comments = input.comments.trim();
  if (!comments) throw new Error('Add a short description of your playtest.');
  return { projectId: input.projectId, ...(input.buildId ? { buildId: input.buildId } : {}), ...(input.sessionId ? { sessionId: input.sessionId } : {}), rating: input.rating, comments };
}

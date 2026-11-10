export type User = { _id: string; username: string; displayName: string };
export type Project = { _id: string; name: string; description?: string; status: string };
export type Build = { _id: string; version: string; platform: string; downloadUrl: string; releaseNotes?: string };
export type Session = { _id: string; title: string; instructions: string; buildId: string; status: string; deadline: string };
export type Bug = { _id: string; projectId: string; reportedBy: string; title: string; description: string; status: string; severity: string; buildId?: string; reproductionSteps?: string; expectedResult?: string; actualResult?: string; environment?: string };
export type Screenshot = { _id: string; contentType: string; size: number };
export const severities = ['low', 'medium', 'high', 'critical'] as const;
export function sessionOpen(session: Session, now = Date.now()) {
  return session.status === 'open' && new Date(session.deadline).getTime() > now;
}
export function ownBugs(bugs: Bug[], userId: string) { return bugs.filter(bug => bug.reportedBy === userId); }
export function bugPayload(form: Record<string, string>, projectId: string) {
  const title = form.title?.trim();
  if (!title) throw new Error('Add a short bug title.');
  if (!form.reproductionSteps?.trim()) throw new Error('Explain how to reproduce the bug.');
  if (!form.actualResult?.trim()) throw new Error('Describe what happened.');
  if (!form.expectedResult?.trim()) throw new Error('Describe what you expected.');
  if (!(severities as readonly string[]).includes(form.severity)) throw new Error('Choose a valid severity.');
  return { projectId, title, description: form.description?.trim() || '', severity: form.severity,
    reproductionSteps: form.reproductionSteps.trim(), expectedResult: form.expectedResult.trim(), actualResult: form.actualResult.trim(), environment: form.environment?.trim() || '',
    ...(form.buildId ? { buildId: form.buildId } : {}) };
}

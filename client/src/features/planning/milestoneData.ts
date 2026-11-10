import type { Milestone, Task } from "../../types";

export interface MilestoneProgress {
  done: number;
  total: number;
}

export interface MilestoneRow {
  milestone: Milestone;
  date: string | null;
  overdue: boolean;
  dueToday: boolean;
  progress: MilestoneProgress;
}

// Milestone inputs are calendar dates. Keep their stored UTC date instead of
// shifting midnight into the previous day in the viewer's timezone.
export function dueDateKey(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function milestoneRows(
  milestones: Milestone[],
  tasks: Array<Pick<Task, "milestoneId" | "status">>,
  today = localDayKey(),
): MilestoneRow[] {
  const totals = new Map<string, MilestoneProgress>();
  for (const task of tasks) {
    const total = totals.get(task.milestoneId) || { done: 0, total: 0 };
    total.total += 1;
    if (task.status === "done") total.done += 1;
    totals.set(task.milestoneId, total);
  }
  return milestones
    .map((milestone) => {
      const date = dueDateKey(milestone.dueDate);
      return {
        milestone,
        date,
        overdue:
          milestone.status !== "completed" && date !== null && date < today,
        dueToday: milestone.status !== "completed" && date === today,
        progress: totals.get(milestone._id) || { done: 0, total: 0 },
      };
    })
    .sort(
      (a, b) =>
        (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") ||
        a.milestone.name.localeCompare(b.milestone.name),
    );
}

export function formatDueDate(date: string | null): string {
  return date
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`))
    : "Unscheduled";
}

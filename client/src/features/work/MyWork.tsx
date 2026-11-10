import { useState } from "react";
import type { TaskPriority, TaskStatus } from "../../constants";
import { TASK_STATUSES } from "../../constants";
import type { BugReport, Milestone, Task } from "../../types";
import { formatDueDate, dueDateKey } from "../planning/milestoneData";

export function MyWork({
  tasks,
  milestones,
  bugs,
  currentUserId,
  pending,
  onOpenTask,
  onOpenBug,
  onStatusChange,
  onMilestones,
}: {
  tasks: Task[];
  milestones: Milestone[];
  bugs: BugReport[];
  currentUserId: string;
  pending: boolean;
  onOpenTask: (id: string) => void;
  onOpenBug: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onMilestones: () => void;
}) {
  const [includeDone, setIncludeDone] = useState(false);
  const mine = tasks.filter((task) => task.assigneeId === currentUserId);
  const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  const visible = mine
    .filter((task) => includeDone || task.status !== "done")
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title),
    );
  const goals = milestones
    .filter(
      (item) =>
        item.status !== "completed" &&
        mine.some(
          (task) => task.status !== "done" && task.milestoneId === item._id,
        ),
    )
    .sort((a, b) =>
      (dueDateKey(a.dueDate) || "9999").localeCompare(
        dueDateKey(b.dueDate) || "9999",
      ),
    );
  const reports = bugs.filter(
    (bug) =>
      (bug.reportedBy || bug.createdBy) === currentUserId &&
      bug.status !== "resolved",
  );
  return (
    <section className="panel my-work" aria-labelledby="my-work-title">
      <div className="section-heading">
        <div>
          <h2 id="my-work-title">My work</h2>
          <p className="meta">Your assignments and reports in this project.</p>
        </div>
        <label className="toggle-filter">
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(event) => setIncludeDone(event.target.checked)}
          />
          Include completed tasks
        </label>
      </div>
      <h3>Assigned tasks</h3>
      <ul className="list">
        {visible.map((task) => (
          <li key={task._id}>
            <div>
              <button
                className="item-title"
                onClick={() => onOpenTask(task._id)}
              >
                {task.title}
              </button>
              <p className="meta">
                {task.priority} priority ·{" "}
                {milestones.find((item) => item._id === task.milestoneId)
                  ?.name || "No milestone"}
              </p>
            </div>
            <select
              aria-label={`My status for ${task.title}`}
              disabled={pending}
              value={task.status}
              onChange={(event) =>
                onStatusChange(task._id, event.target.value as TaskStatus)
              }
            >
              {TASK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="empty-notice">
          {mine.length
            ? "No unfinished tasks assigned to you."
            : "No tasks assigned to you yet."}
        </p>
      )}
      <h3>Milestones for your unfinished work</h3>
      <ul className="list">
        {goals.map((item) => (
          <li key={item._id}>
            <span>{item.name}</span>
            <span className="meta">
              {formatDueDate(dueDateKey(item.dueDate))}
            </span>
          </li>
        ))}
      </ul>
      {!goals.length && (
        <p className="meta">
          No open milestones linked to your unfinished tasks.
        </p>
      )}
      <button className="text-button" onClick={onMilestones}>
        View milestone plan
      </button>
      <h3>Your open bug reports</h3>
      <ul className="list">
        {reports.map((bug) => (
          <li key={bug._id}>
            <button className="item-title" onClick={() => onOpenBug(bug._id)}>
              {bug.title}
            </button>
            <span className="meta">
              {bug.status.replaceAll("_", " ")} · {bug.severity}
            </span>
          </li>
        ))}
      </ul>
      {!reports.length && (
        <p className="meta">No unresolved bugs reported by you.</p>
      )}
    </section>
  );
}

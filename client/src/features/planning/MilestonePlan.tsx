import { useEffect, useState } from "react";
import type { MilestoneStatus } from "../../constants";
import type { Milestone, Task } from "../../types";
import { StatusBadge } from "../../components/ProjectOverview";
import { localDayKey, milestoneRows, formatDueDate } from "./milestoneData";

type MilestoneFilter = "all" | "open" | "overdue" | "completed";

const FILTERS: ReadonlyArray<readonly [MilestoneFilter, string]> = [
  ["all", "All milestones"],
  ["open", "Open"],
  ["overdue", "Overdue"],
  ["completed", "Completed"],
];

export function MilestonePlan({
  milestones,
  tasks,
  pending,
  onEdit,
  onTaskOpen,
  onStatusChange,
}: {
  milestones: Milestone[];
  tasks: Task[];
  pending: boolean;
  onEdit: (id: string) => void;
  onTaskOpen: (id: string) => void;
  onStatusChange: (id: string, status: MilestoneStatus) => void;
}) {
  const [filter, setFilter] = useState<MilestoneFilter>("all");
  const [today, setToday] = useState(localDayKey);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDayKey()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const rows = milestoneRows(milestones, tasks, today);
  const filtered = rows.filter(
    (row) =>
      filter === "all" ||
      (filter === "open" && row.milestone.status !== "completed") ||
      (filter === "overdue" && row.overdue) ||
      (filter === "completed" && row.milestone.status === "completed"),
  );
  const dates = [...new Set(filtered.map((row) => row.date))];
  return (
    <section className="milestone-plan" aria-labelledby="milestone-plan-title">
      <div className="section-heading">
        <div>
          <h2 id="milestone-plan-title">Milestone roadmap</h2>
          <p className="meta">
            {milestones.filter((item) => item.status === "completed").length}{" "}
            completed · {rows.filter((row) => row.overdue).length} overdue ·{" "}
            {rows.filter((row) => !row.date).length} unscheduled
          </p>
        </div>
      </div>
      <div className="plan-filters" role="group" aria-label="Milestone filters">
        {FILTERS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className="secondary"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {milestones.length === 0 ? (
        <div className="empty-state">
          <h3>No milestones yet</h3>
          <p>Add a development goal and due date, then link tasks to it.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="empty-notice" role="status">
          No milestones match this view.
        </p>
      ) : (
        <ol className="milestone-timeline">
          {dates.map((date) => (
            <li className="date-group" key={date || "undated"}>
              <h3 className="timeline-date">{formatDueDate(date)}</h3>
              <div className="date-milestones">
                {filtered
                  .filter((row) => row.date === date)
                  .map(({ milestone, overdue, dueToday, progress }) => (
                    <article
                      className={`milestone-entry${overdue ? " milestone-overdue" : ""}`}
                      key={milestone._id}
                    >
                      <div className="section-heading">
                        <button
                          type="button"
                          className="item-title milestone-title"
                          onClick={() => onEdit(milestone._id)}
                        >
                          {milestone.name}
                        </button>
                        <StatusBadge status={milestone.status} />
                      </div>
                      {milestone.description && (
                        <p className="release-notes">{milestone.description}</p>
                      )}
                      {overdue && (
                        <p className="deadline-flag overdue-flag">
                          Overdue — due {formatDueDate(date)}
                        </p>
                      )}
                      {dueToday && <p className="deadline-flag">Due today</p>}
                      <div className="milestone-progress">
                        <label htmlFor={`milestone-progress-${milestone._id}`}>
                          {progress.done} of {progress.total} linked tasks done
                        </label>
                        <progress
                          id={`milestone-progress-${milestone._id}`}
                          value={progress.done}
                          max={progress.total || 1}
                        />
                      </div>
                      <div className="milestone-controls">
                        <label className="row">
                          Milestone status
                          <select
                            aria-label={`Status for ${milestone.name}`}
                            value={milestone.status}
                            disabled={pending}
                            onChange={(event) =>
                              onStatusChange(
                                milestone._id,
                                event.target.value as MilestoneStatus,
                              )
                            }
                          >
                            <option value="todo">To do</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          className="text-button"
                          disabled={pending}
                          onClick={() => onEdit(milestone._id)}
                        >
                          Edit milestone
                        </button>
                      </div>
                      <details className="linked-tasks">
                        <summary>Linked tasks ({progress.total})</summary>
                        {progress.total ? (
                          <ul>
                            {tasks
                              .filter(
                                (task) => task.milestoneId === milestone._id,
                              )
                              .map((task) => (
                                <li key={task._id}>
                                  <button
                                    type="button"
                                    className="item-title"
                                    onClick={() => onTaskOpen(task._id)}
                                  >
                                    {task.title}
                                  </button>
                                  <StatusBadge status={task.status} />
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <p className="meta">
                            No tasks linked. Assign this milestone when creating
                            or editing a task.
                          </p>
                        )}
                      </details>
                    </article>
                  ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import type { ProjectView } from "../constants";
import {
  BUILD_PLATFORM_LABELS,
  countLabel,
  formatStatus,
} from "../format";
import type {
  Build,
  BugReport,
  Milestone,
  PlaytestFeedback,
  Task,
} from "../types";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status}`}>{formatStatus(status)}</span>
  );
}

export function ProjectOverview({
  milestones,
  tasks,
  bugs,
  feedback,
  builds,
  onViewChange,
}: {
  milestones: Milestone[];
  tasks: Task[];
  bugs: BugReport[];
  feedback: PlaytestFeedback[];
  builds: Build[];
  onViewChange: (view: ProjectView) => void;
}) {
  const done = tasks.filter((task) => task.status === "done").length;
  const unresolved = bugs.filter((bug) => bug.status !== "resolved").length;
  const upcoming = [...milestones]
    .filter((item) => item.status !== "completed")
    .sort(
      (a, b) =>
        (a.dueDate ? Date.parse(a.dueDate) : Infinity) -
        (b.dueDate ? Date.parse(b.dueDate) : Infinity),
    );
  const rating = feedback.length
    ? (
        feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length
      ).toFixed(1)
    : "—";
  return (
    <>
      <section className="project-ledger" aria-label="Project summary">
        <div>
          <span>Task progress</span>
          <strong>
            {done} / {tasks.length}
          </strong>
          <progress
            value={done}
            max={tasks.length || 1}
            aria-label={`${done} of ${tasks.length} tasks completed`}
          />
        </div>
        <div>
          <span>Unresolved bugs</span>
          <strong>{unresolved}</strong>
        </div>
        <div>
          <span>Published builds</span>
          <strong>{builds.length}</strong>
        </div>
        <div>
          <span>Playtest rating</span>
          <strong>
            {rating}
            <small>{feedback.length ? " / 5" : ""}</small>
          </strong>
        </div>
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Upcoming milestones</h2>
            <button
              className="text-button"
              onClick={() => onViewChange("milestones")}
            >
              View milestones →
            </button>
          </div>
          {upcoming.length ? (
            <ul className="list">
              {upcoming.slice(0, 4).map((item) => (
                <li key={item._id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small className="meta">
                      {item.dueDate
                        ? new Intl.DateTimeFormat(undefined, {
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          }).format(new Date(item.dueDate))
                        : "No due date"}
                    </small>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <h3>
                {milestones.length
                  ? "All milestones reached"
                  : "Set your first milestone"}
              </h3>
              <p>
                {milestones.length
                  ? "Add the next development goal when you are ready."
                  : "Create a milestone before assigning tasks."}
              </p>
              <button
                className="secondary"
                onClick={() => onViewChange("milestones")}
              >
                Manage milestones
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Latest build</h2>
            <button
              className="text-button"
              onClick={() => onViewChange("builds")}
            >
              Build library →
            </button>
          </div>
          {builds[0] ? (
            <>
              <h3>
                {builds[0].version}{" "}
                <span className="badge">
                  {BUILD_PLATFORM_LABELS[builds[0].platform]}
                </span>
              </h3>
              <p className="release-notes">
                {builds[0].releaseNotes || "No release notes provided."}
              </p>
            </>
          ) : (
            <p className="meta">No playable build has been published yet.</p>
          )}
          <hr />
          <p className="meta">
            {countLabel(tasks.length - done, "task")} remaining ·{" "}
            {countLabel(feedback.length, "playtest report")}
          </p>
          <button className="secondary" onClick={() => onViewChange("tasks")}>
            Open task board
          </button>
        </section>
      </div>
    </>
  );
}

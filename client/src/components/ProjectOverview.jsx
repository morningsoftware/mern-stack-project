export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function ProjectOverview({
  milestones,
  tasks,
  bugs,
  feedback,
  onViewChange,
}) {
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const openBugs = bugs.filter((bug) => bug.status !== "resolved").length;
  const completeMilestones = milestones.filter(
    (item) => item.status === "completed",
  ).length;
  const averageRating = feedback.length
    ? (
        feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length
      ).toFixed(1)
    : null;
  const nextMilestones = [...milestones]
    .filter((item) => item.status !== "completed")
    .sort(
      (a, b) =>
        (a.dueDate ? Date.parse(a.dueDate) : Infinity) -
        (b.dueDate ? Date.parse(b.dueDate) : Infinity),
    )
    .slice(0, 3);
  const dateLabel = (date) =>
    date
      ? new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(date))
      : "No due date";
  return (
    <>
      <section className="stats-grid" aria-label="Project summary">
        <div className="stat-card">
          <span>Tasks completed</span>
          <strong>
            {completedTasks}
            <small> / {tasks.length}</small>
          </strong>
          <progress
            value={completedTasks}
            max={tasks.length || 1}
            aria-label={`${completedTasks} of ${tasks.length} tasks completed`}
          />
        </div>
        <div className="stat-card">
          <span>Milestones reached</span>
          <strong>
            {completeMilestones}
            <small> / {milestones.length}</small>
          </strong>
          <p>Keep your next goal in sight.</p>
        </div>
        <div className="stat-card">
          <span>Unresolved bugs</span>
          <strong>{openBugs}</strong>
          <p>
            {openBugs
              ? "Ready for your next triage."
              : "No unresolved reports."}
          </p>
        </div>
        <div className="stat-card">
          <span>Playtest rating</span>
          <strong>
            {averageRating || "—"}
            <small>{averageRating ? " / 5" : ""}</small>
          </strong>
          <p>
            {feedback.length} feedback{" "}
            {feedback.length === 1 ? "entry" : "entries"}
          </p>
        </div>
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE ROAD AHEAD</p>
              <h2>Upcoming milestones</h2>
            </div>
            <button
              className="text-button"
              onClick={() => onViewChange("milestones")}
            >
              View all →
            </button>
          </div>
          {nextMilestones.length ? (
            <ul className="list">
              {nextMilestones.map((item) => (
                <li key={item._id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small className="meta">{dateLabel(item.dueDate)}</small>
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
                  ? "Plan the next stage of development when you are ready."
                  : "Break your game into achievable development goals."}
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
            <div>
              <p className="eyebrow">KEEP THINGS MOVING</p>
              <h2>Project tools</h2>
            </div>
          </div>
          <div className="tool-links">
            <button onClick={() => onViewChange("tasks")}>
              <span>
                <strong>Plan the work</strong>
                <small>Assign tasks and track their status.</small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
            <button onClick={() => onViewChange("bugs")}>
              <span>
                <strong>Track the issues</strong>
                <small>Report bugs and prioritize fixes.</small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
            <button onClick={() => onViewChange("feedback")}>
              <span>
                <strong>Hear from playtesters</strong>
                <small>Review ratings and player feedback.</small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

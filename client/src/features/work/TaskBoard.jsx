import { useState } from "react";
import { Field } from "../../components/Forms.jsx";

const columns = [
  ["todo", "To do"],
  ["in_progress", "In progress"],
  ["done", "Done"],
];

export function TaskBoard({
  tasks,
  users,
  milestones,
  pending,
  onStatusChange,
  onOpen,
  currentUserId,
  onCreate,
}) {
  const [filters, setFilters] = useState({
    query: "",
    assignee: "",
    priority: "",
    milestone: "",
    mine: false,
  });
  const update = (key, value) =>
    setFilters((old) => ({ ...old, [key]: value }));
  const visible = tasks.filter(
    (task) =>
      (!filters.query ||
        `${task.title} ${task.description || ""}`
          .toLowerCase()
          .includes(filters.query.toLowerCase().trim())) &&
      (!filters.assignee || task.assigneeId === filters.assignee) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.milestone || task.milestoneId === filters.milestone) &&
      (!filters.mine || task.assigneeId === currentUserId),
  );
  const userName = (id) =>
    users.find((user) => user._id === id)?.displayName || "Unassigned";
  const milestoneName = (id) =>
    milestones.find((item) => item._id === id)?.name || "No milestone";
  return (
    <section aria-labelledby="task-board-title" className="work-board">
      <div className="section-heading">
        <div>
          <h2 id="task-board-title">Task board</h2>
          <p className="meta">
            {visible.length} of {tasks.length} tasks
          </p>
        </div>
        <div className="board-actions">
          <button type="button" disabled={pending} onClick={onCreate}>
            New task
          </button>
          <label className="toggle-filter">
            <input
              type="checkbox"
              checked={filters.mine}
              onChange={(event) => update("mine", event.target.checked)}
            />
            My work
          </label>
        </div>
      </div>
      <div className="board-filters" aria-label="Task filters">
        <Field label="Search tasks">
          <input
            type="search"
            value={filters.query}
            onChange={(event) => update("query", event.target.value)}
            placeholder="Search title or description"
          />
        </Field>
        <Field label="Filter by assignee">
          <select
            value={filters.assignee}
            onChange={(event) => update("assignee", event.target.value)}
          >
            <option value="">Everyone</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filter by priority">
          <select
            value={filters.priority}
            onChange={(event) => update("priority", event.target.value)}
          >
            <option value="">All priorities</option>
            {["high", "medium", "low"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filter by milestone">
          <select
            value={filters.milestone}
            onChange={(event) => update("milestone", event.target.value)}
          >
            <option value="">All milestones</option>
            {milestones.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setFilters({
              query: "",
              assignee: "",
              priority: "",
              milestone: "",
              mine: false,
            })
          }
        >
          Clear filters
        </button>
      </div>
      {visible.length === 0 && tasks.length > 0 && (
        <p role="status" className="empty-notice">
          No tasks match these filters. Clear the filters to see all work.
        </p>
      )}
      <div className="board-columns">
        {columns.map(([status, label]) => (
          <section
            key={status}
            className={`board-column column-${status}`}
            aria-label={label}
          >
            <header>
              <h3>{label}</h3>
              <span className="count">
                {visible.filter((task) => task.status === status).length}
              </span>
            </header>
            <div className="column-items">
              {visible
                .filter((task) => task.status === status)
                .map((task) => (
                  <article className="work-card" key={task._id}>
                    <div className="card-meta">
                      <span className={`priority priority-${task.priority}`}>
                        {task.priority} priority
                      </span>
                      <span className="record-id">
                        {task._id.slice(-5).toUpperCase()}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="card-title"
                      onClick={() => onOpen(task._id)}
                    >
                      {task.title}
                    </button>
                    {task.description && (
                      <p className="card-description">{task.description}</p>
                    )}
                    <p className="card-milestone">
                      {milestoneName(task.milestoneId)}
                    </p>
                    <footer>
                      <span className="assignee-name">
                        {userName(task.assigneeId)}
                      </span>
                      <select
                        aria-label={`Status for ${task.title}`}
                        value={task.status}
                        disabled={pending}
                        onChange={(event) =>
                          onStatusChange(task._id, event.target.value)
                        }
                      >
                        {columns.map(([value, name]) => (
                          <option key={value} value={value}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </footer>
                  </article>
                ))}
              {visible.filter((task) => task.status === status).length ===
                0 && <p className="column-empty">No tasks here</p>}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

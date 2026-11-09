import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { ApiError } from "../api";
import {
  PROJECT_STATUSES,
  MILESTONE_STATUSES,
  BUG_STATUSES,
  BUG_SEVERITIES,
  PRIORITIES,
} from "../constants";
import type {
  BugSeverity,
  BugStatus,
  MilestoneStatus,
  ProjectView,
  TaskPriority,
  TaskStatus,
} from "../constants";
import { ErrorNote, Field } from "../components/Forms";
import { TaskBoard } from "../features/work/TaskBoard";
import { ItemDrawer } from "../features/work/ItemDrawer";
import { BuildLibrary } from "../features/work/BuildLibrary";
import { ProjectOverview } from "../components/ProjectOverview";
import type {
  Build,
  BugReport,
  Milestone,
  PlaytestFeedback,
  Project,
  Task,
  User,
} from "../types";

type Drawer = { kind: "task" | "bug"; id: string };

export function ProjectScreen({
  project,
  currentUserId,
  onProjectChange,
  view,
  onViewChange,
}: {
  project: Project;
  currentUserId: string;
  onProjectChange: (project: Project) => void;
  view: ProjectView;
  onViewChange: (view: ProjectView) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);
  const [users, setUsers] = useState<User[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [feedback, setFeedback] = useState<PlaytestFeedback[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [error, setError] = useState("");
  const [milestone, setMilestone] = useState({
    name: "",
    description: "",
    dueDate: "",
    status: "todo" as MilestoneStatus,
  });
  const [task, setTask] = useState({
    title: "",
    description: "",
    milestoneId: "",
    assigneeId: "",
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
  });
  const [bug, setBug] = useState({
    title: "",
    description: "",
    severity: "medium" as BugSeverity,
    status: "open" as BugStatus,
  });
  const [note, setNote] = useState({ rating: "4", comments: "", buildId: "" });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [
        nextUsers,
        nextMilestones,
        nextTasks,
        nextBugs,
        nextFeedback,
        nextBuilds,
      ] = await Promise.all([
        api<User[]>("/api/users", { signal }),
        api<Milestone[]>(`/api/milestones?projectId=${project._id}`, {
          signal,
        }),
        api<Task[]>(`/api/tasks?projectId=${project._id}`, { signal }),
        api<BugReport[]>(`/api/bug-reports?projectId=${project._id}`, {
          signal,
        }),
        api<PlaytestFeedback[]>(
          `/api/playtest-feedback?projectId=${project._id}`,
          { signal }
        ),
        api<Build[]>(`/api/builds?projectId=${project._id}`, { signal }),
      ]);
      if (signal?.aborted) return;
      setUsers(nextUsers);
      setMilestones(nextMilestones);
      setTasks(nextTasks);
      setBugs(nextBugs);
      setFeedback(nextFeedback);
      setBuilds(nextBuilds);
      setTask((current) => ({
        ...current,
        milestoneId: current.milestoneId || nextMilestones[0]?._id || "",
        assigneeId: current.assigneeId || nextUsers[0]?._id || "",
      }));
    },
    [project._id]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((err: ApiError) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);

  const nameFor = (id: string): string =>
    users.find((user) => user._id === id)?.displayName || "Unknown user";

  async function submit(
    path: string,
    body: unknown,
    reset: () => void
  ): Promise<void> {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      reset();
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }

  async function patch(
    path: string,
    body: unknown,
    reset?: () => void
  ): Promise<void> {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    try {
      const updated = await api<Project>(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (path === `/api/projects/${project._id}`) onProjectChange(updated);
      reset?.();
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <header className="top">
        <div>
          <p className="eyebrow">Project</p>
          <h1>{project.name}</h1>
          <p>
            {project.description || "No description"}{" "}
            <span className="meta">Status: {project.status}</span>
          </p>
        </div>
        <Field label="Project status">
          <select
            value={project.status}
            disabled={pending || loading}
            onChange={(event) =>
              patch(`/api/projects/${project._id}`, {
                status: event.target.value,
              })
            }
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
      </header>
      <ErrorNote error={error} />
      {loading && (
        <p role="status" className="loading">
          Loading project workspace…
        </p>
      )}
      {!loading && view === "overview" && !error && (
        <ProjectOverview
          milestones={milestones}
          tasks={tasks}
          bugs={bugs}
          feedback={feedback}
          builds={builds}
          onViewChange={onViewChange}
        />
      )}
      <fieldset
        className="workspace-fields"
        disabled={pending || loading}
        aria-busy={pending}
      >
        <div className="grid workspace-grid">
          <section className="panel" hidden={view !== "milestones"}>
            <h2>Milestones</h2>
            <ul className="list">
              {milestones.map((item) => (
                <li key={item._id}>
                  <span>{item.name}</span>
                  <select
                    aria-label={`Status for ${item.name}`}
                    value={item.status}
                    onChange={(event) =>
                      patch(`/api/milestones/${item._id}`, {
                        status: event.target.value,
                      })
                    }
                  >
                    {MILESTONE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {milestones.length === 0 && <p>No milestones yet.</p>}
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                submit(
                  "/api/milestones",
                  {
                    ...milestone,
                    projectId: project._id,
                    dueDate: milestone.dueDate || null,
                  },
                  () =>
                    setMilestone({
                      name: "",
                      description: "",
                      dueDate: "",
                      status: "todo",
                    })
                );
              }}
            >
              <Field label="Milestone name">
                <input
                  value={milestone.name}
                  onChange={(event) =>
                    setMilestone({ ...milestone, name: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Due date">
                <input
                  type="date"
                  value={milestone.dueDate}
                  onChange={(event) =>
                    setMilestone({ ...milestone, dueDate: event.target.value })
                  }
                />
              </Field>
              <button type="submit">Add milestone</button>
            </form>
          </section>
          <section className="panel" hidden={view !== "tasks"}>
            <TaskBoard
              tasks={tasks}
              users={users}
              milestones={milestones}
              pending={pending || loading}
              currentUserId={currentUserId}
              onOpen={(id) => setDrawer({ kind: "task", id })}
              onStatusChange={(id, status) =>
                patch(`/api/tasks/${id}`, { status })
              }
            />
            <details className="create-work">
              <summary>Add a task</summary>
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(
                    "/api/tasks",
                    { ...task, projectId: project._id },
                    () => setTask({ ...task, title: "", description: "" })
                  );
                }}
              >
                <Field label="Task title">
                  <input
                    value={task.title}
                    onChange={(event) =>
                      setTask({ ...task, title: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Milestone">
                  <select
                    value={task.milestoneId}
                    onChange={(event) =>
                      setTask({ ...task, milestoneId: event.target.value })
                    }
                    required
                  >
                    <option value="">Select a milestone</option>
                    {milestones.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assignee">
                  <select
                    value={task.assigneeId}
                    onChange={(event) =>
                      setTask({ ...task, assigneeId: event.target.value })
                    }
                    required
                  >
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    value={task.priority}
                    onChange={(event) =>
                      setTask({
                        ...task,
                        priority: event.target.value as TaskPriority,
                      })
                    }
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="submit">Add task</button>
              </form>
            </details>
          </section>
          <section className="panel" hidden={view !== "bugs"}>
            <h2>Bug reports</h2>
            <ul className="list">
              {bugs.map((item) => (
                <li key={item._id}>
                  <span>
                    <button
                      type="button"
                      className="item-title"
                      onClick={() => setDrawer({ kind: "bug", id: item._id })}
                    >
                      {item.title}
                    </button>{" "}
                    <span className="badge">{item.severity}</span>
                  </span>
                  <select
                    aria-label={`Status for ${item.title}`}
                    value={item.status}
                    onChange={(event) =>
                      patch(`/api/bug-reports/${item._id}`, {
                        status: event.target.value,
                      })
                    }
                  >
                    {BUG_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {bugs.length === 0 && <p>No bug reports yet.</p>}
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                submit(
                  "/api/bug-reports",
                  { ...bug, projectId: project._id },
                  () =>
                    setBug({
                      title: "",
                      description: "",
                      severity: "medium",
                      status: "open",
                    })
                );
              }}
            >
              <Field label="Bug title">
                <input
                  value={bug.title}
                  onChange={(event) =>
                    setBug({ ...bug, title: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={bug.description}
                  onChange={(event) =>
                    setBug({ ...bug, description: event.target.value })
                  }
                />
              </Field>
              <Field label="Severity">
                <select
                  value={bug.severity}
                  onChange={(event) =>
                    setBug({
                      ...bug,
                      severity: event.target.value as BugSeverity,
                    })
                  }
                >
                  {BUG_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit">Report bug</button>
            </form>
          </section>
          <section hidden={view !== "builds"}>
            <BuildLibrary
              builds={builds}
              feedback={feedback}
              pending={pending || loading}
              onPublish={(body, reset) =>
                submit(
                  "/api/builds",
                  { ...body, projectId: project._id },
                  reset
                )
              }
              onUpdate={(id, body, reset) =>
                patch(`/api/builds/${id}`, body, reset)
              }
              onFeedback={(buildId) => {
                setNote((old) => ({ ...old, buildId }));
                onViewChange("feedback");
              }}
            />
          </section>
          <section className="panel" hidden={view !== "feedback"}>
            <h2>Playtest feedback</h2>
            <ul className="list">
              {feedback.map((item) => (
                <li key={item._id}>
                  <span>
                    {nameFor(item.userId)}: {item.comments || "No comments"}
                    {item.buildId && (
                      <small className="meta">
                        Build:{" "}
                        {builds.find((build) => build._id === item.buildId)
                          ?.version || "Unavailable build"}
                      </small>
                    )}
                  </span>
                  <span className="meta">Rating {item.rating} of 5</span>
                </li>
              ))}
            </ul>
            {feedback.length === 0 && <p>No feedback yet.</p>}
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                submit(
                  "/api/playtest-feedback",
                  {
                    projectId: project._id,
                    rating: Number(note.rating),
                    comments: note.comments,
                    ...(note.buildId ? { buildId: note.buildId } : {}),
                  },
                  () => setNote({ rating: "4", comments: "", buildId: "" })
                );
              }}
            >
              <Field label="Build tested">
                <select
                  value={note.buildId}
                  onChange={(event) =>
                    setNote({ ...note, buildId: event.target.value })
                  }
                >
                  <option value="">General project feedback</option>
                  {builds.map((build) => (
                    <option key={build._id} value={build._id}>
                      {build.version} · {build.platform}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rating">
                <select
                  value={note.rating}
                  onChange={(event) =>
                    setNote({ ...note, rating: event.target.value })
                  }
                >
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Comments">
                <textarea
                  value={note.comments}
                  onChange={(event) =>
                    setNote({ ...note, comments: event.target.value })
                  }
                />
              </Field>
              <button type="submit">Add feedback</button>
            </form>
          </section>
        </div>
      </fieldset>
      {drawer && (
        <ItemDrawer
          key={`${drawer.kind}-${drawer.id}`}
          {...drawer}
          users={users}
          milestones={milestones}
          onClose={() => setDrawer(null)}
          onSaved={(updated) => {
            if (drawer.kind === "task")
              setTasks((items) =>
                items.map((item) =>
                  item._id === updated._id ? (updated as Task) : item
                )
              );
            else
              setBugs((items) =>
                items.map((item) =>
                  item._id === updated._id ? (updated as BugReport) : item
                )
              );
          }}
        />
      )}
      {pending && (
        <p role="status" className="save-status">
          Saving changes…
        </p>
      )}
    </div>
  );
}

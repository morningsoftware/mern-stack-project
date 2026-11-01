import { useCallback, useEffect, useRef, useState } from "react";
import { useUnsavedChanges } from "../navigation/UnsavedChanges.jsx";
import { api } from "../api.js";
import { PROJECT_STATUSES, TASK_STATUSES, PRIORITIES } from "../constants.js";
import { ErrorNote, Field } from "../components/Forms.jsx";
import { MilestonePlan } from "../features/planning/MilestonePlan.jsx";
import { MilestoneEditor } from "../features/planning/MilestoneEditor.jsx";
import { BugReports } from "../features/playtesting/BugReports.jsx";
import { FeedbackTriage } from "../features/playtesting/FeedbackTriage.jsx";
import { emptyBugDraft } from "../features/playtesting/BugDetailsFields.jsx";
import { PlaytestSessions } from "../features/playtesting/PlaytestSessions.jsx";
import { Notifications } from "../features/activity/Notifications.jsx";
import { ActivityFeed } from "../features/activity/ActivityFeed.jsx";
import { MyWork } from "../features/work/MyWork.jsx";
import { TaskBoard } from "../features/work/TaskBoard.jsx";
import { ItemDrawer } from "../features/work/ItemDrawer.jsx";
import { BuildLibrary } from "../features/work/BuildLibrary.jsx";
import { ProjectOverview } from "../components/ProjectOverview.jsx";

export function ProjectScreen({
  project,
  currentUserId,
  onProjectChange,
  view,
  onViewChange,
}) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);
  const [users, setUsers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [queuedFeedback, setQueuedFeedback] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const taskForm = useRef(null);
  const milestoneForm = useRef(null);
  const [taskTouched, setTaskTouched] = useState(false);
  const [milestone, setMilestone] = useState({
    name: "",
    description: "",
    dueDate: "",
    status: "todo",
  });
  const [task, setTask] = useState({
    title: "",
    description: "",
    milestoneId: "",
    assigneeId: "",
    status: "todo",
    priority: "medium",
  });
  const [bug, setBug] = useState(emptyBugDraft);
  const [note, setNote] = useState({
    rating: "4",
    comments: "",
    buildId: "",
    sessionId: "",
  });

  const emptyReport = emptyBugDraft();
  const dirty =
    taskTouched ||
    milestone.name !== "" ||
    milestone.description !== "" ||
    milestone.dueDate !== "" ||
    Object.keys(emptyReport).some((key) => bug[key] !== emptyReport[key]) ||
    note.comments !== "" ||
    note.rating !== "4" ||
    note.buildId !== "" ||
    Boolean(note.sessionId);
  useUnsavedChanges(dirty, pending);
  function startMilestone() {
    onViewChange("milestones");
    milestoneForm.current.open = true;
    milestoneForm.current.querySelector("input")?.focus();
  }
  const load = useCallback(
    async (signal) => {
      const [
        nextUsers,
        nextMilestones,
        nextTasks,
        nextBugs,
        nextFeedback,
        nextBuilds,
        nextMembers,
      ] = await Promise.all([
        api("/api/users", { signal }),
        api(`/api/milestones?projectId=${project._id}`, { signal }),
        api(`/api/tasks?projectId=${project._id}`, { signal }),
        api(`/api/bug-reports?projectId=${project._id}`, { signal }),
        api(`/api/playtest-feedback?projectId=${project._id}`, { signal }),
        api(`/api/builds?projectId=${project._id}`, { signal }),
        api(`/api/teams/${project.teamId}/members`, { signal }),
      ]);
      if (signal?.aborted) return;
      setUsers(nextUsers);
      setMilestones(nextMilestones);
      setTasks(nextTasks);
      setBugs(nextBugs);
      setFeedback(nextFeedback);
      setBuilds(nextBuilds);
      setMembers(nextMembers);
      setTask((current) => ({
        ...current,
        milestoneId: current.milestoneId || nextMilestones[0]?._id || "",
        assigneeId:
          current.assigneeId ||
          nextUsers.find((user) =>
            nextMembers.some((member) => member.userId === user._id),
          )?._id ||
          "",
      }));
    },
    [project._id, project.teamId],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load]);

  const assignableUsers = users.filter((user) =>
    members.some((member) => member.userId === user._id),
  );
  const canReview = members.some((member) => member.userId === currentUserId);
  function beginBugReport(entry) {
    const build = builds.find((item) => item._id === entry.buildId);
    setBug({
      ...emptyBugDraft(),
      title: build ? `Issue in ${build.version}` : "Playtest issue",
      description: entry.comments || "",
      buildId: entry.buildId || "",
      sourceFeedbackId: entry._id,
    });
    setQueuedFeedback(null);
  }
  function reportFeedback(entry) {
    onViewChange("bugs");
    if (
      bug.title ||
      bug.description ||
      bug.reproductionSteps ||
      bug.expectedResult ||
      bug.actualResult ||
      bug.environment ||
      bug.buildId ||
      bug.sourceFeedbackId ||
      bug.severity !== "medium" ||
      bug.status !== "open"
    )
      setQueuedFeedback(entry);
    else beginBugReport(entry);
  }

  async function submit(path, body, reset) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      reset();
      setNotice("Created successfully.");
      try {
        await load();
      } catch {
        setError(
          "Your item was created, but the workspace could not refresh. Reload to see the latest data.",
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }

  async function patch(path, body, reset) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const updated = await api(path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (path === `/api/projects/${project._id}`) onProjectChange(updated);
      reset?.();
      setNotice("Changes saved.");
      try {
        await load();
      } catch {
        setError(
          "Your changes were saved, but the workspace could not refresh. Reload to see the latest data.",
        );
      }
    } catch (err) {
      setError(err.message);
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
      {notice && (
        <p role="status" className="workspace-notice">
          {notice}
        </p>
      )}
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
          <section hidden={view !== "sessions"}>
            <PlaytestSessions
              projectId={project._id}
              builds={builds}
              feedback={feedback}
              canManage={canReview}
              active={view === "sessions"}
              onSessionsChange={setSessions}
              onFeedback={(session) => {
                setNote((old) => ({
                  ...old,
                  buildId: session.buildId,
                  sessionId: session._id,
                }));
                onViewChange("feedback");
              }}
            />
          </section>
          <section hidden={view !== "notifications"}>
            <Notifications
              projectId={project._id}
              active={view === "notifications"}
              onViewChange={onViewChange}
              onOpenTask={(id) => setDrawer({ kind: "task", id })}
            />
          </section>
          <section hidden={view !== "activity"}>
            <ActivityFeed
              projectId={project._id}
              active={view === "activity"}
            />
          </section>
          <section hidden={view !== "my-work"}>
            <MyWork
              tasks={tasks}
              milestones={milestones}
              bugs={bugs}
              currentUserId={currentUserId}
              pending={pending || loading}
              onOpenTask={(id) => setDrawer({ kind: "task", id })}
              onOpenBug={(id) => setDrawer({ kind: "bug", id })}
              onStatusChange={(id, status) =>
                patch(`/api/tasks/${id}`, { status })
              }
              onMilestones={() => onViewChange("milestones")}
            />
          </section>
          <section className="panel" hidden={view !== "milestones"}>
            <MilestonePlan
              milestones={milestones}
              tasks={tasks}
              pending={pending || loading}
              onEdit={setEditingMilestone}
              onTaskOpen={(id) => setDrawer({ kind: "task", id })}
              onStatusChange={(id, status) =>
                patch(`/api/milestones/${id}`, { status })
              }
            />
            <details ref={milestoneForm} className="create-work">
              <summary>Add a milestone</summary>
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
                      }),
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
                <Field label="Milestone description">
                  <textarea
                    rows={3}
                    value={milestone.description}
                    onChange={(event) =>
                      setMilestone({
                        ...milestone,
                        description: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Due date">
                  <input
                    type="date"
                    value={milestone.dueDate}
                    onChange={(event) =>
                      setMilestone({
                        ...milestone,
                        dueDate: event.target.value,
                      })
                    }
                  />
                </Field>
                <button type="submit">Add milestone</button>
              </form>
            </details>
          </section>
          <section className="panel" hidden={view !== "tasks"}>
            {!loading && milestones.length === 0 && (
              <div className="source-notice">
                <h3>Start with a milestone</h3>
                <p>
                  Tasks belong to milestones. Add your first goal, then break it
                  into assigned work.
                </p>
                <button type="button" onClick={startMilestone}>
                  Create first milestone
                </button>
              </div>
            )}
            <TaskBoard
              onCreate={() => {
                if (!milestones.length) {
                  startMilestone();
                  return;
                }
                taskForm.current.open = true;
                taskForm.current.querySelector("input")?.focus();
              }}
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
            <details ref={taskForm} className="create-work">
              <summary>Add a task</summary>
              <form
                onChange={() => setTaskTouched(true)}
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(
                    "/api/tasks",
                    { ...task, projectId: project._id },
                    () => {
                      setTask({ ...task, title: "", description: "" });
                      setTaskTouched(false);
                    },
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
                <Field label="Task description">
                  <textarea
                    rows={3}
                    value={task.description}
                    onChange={(event) =>
                      setTask({ ...task, description: event.target.value })
                    }
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
                    {assignableUsers.map((user) => (
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
                      setTask({ ...task, priority: event.target.value })
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
            {queuedFeedback && (
              <div className="source-notice" role="alert">
                <p>
                  You have an unsent bug report. Keep it or replace it with a
                  report from the selected feedback.
                </p>
                <div className="build-actions">
                  <button
                    type="button"
                    onClick={() => beginBugReport(queuedFeedback)}
                  >
                    Replace draft
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setQueuedFeedback(null)}
                  >
                    Keep current draft
                  </button>
                </div>
              </div>
            )}
            <BugReports
              bugs={bugs}
              builds={builds}
              pending={pending || loading}
              draft={bug}
              onDraftChange={setBug}
              onSubmit={() =>
                submit(
                  "/api/bug-reports",
                  { ...bug, projectId: project._id },
                  () => setBug(emptyBugDraft()),
                )
              }
              onOpen={(id) => setDrawer({ kind: "bug", id })}
              onStatusChange={(id, status) =>
                patch(`/api/bug-reports/${id}`, { status })
              }
            />
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
                  reset,
                )
              }
              onUpdate={(id, body, reset) =>
                patch(`/api/builds/${id}`, body, reset)
              }
              onFeedback={(buildId) => {
                setNote((old) => ({ ...old, buildId, sessionId: "" }));
                onViewChange("feedback");
              }}
            />
          </section>
          <section className="panel" hidden={view !== "feedback"}>
            <FeedbackTriage
              feedback={feedback}
              builds={builds}
              users={users}
              bugs={bugs}
              canReview={canReview}
              pending={pending || loading}
              onReview={(id, reviewStatus) =>
                patch(`/api/playtest-feedback/${id}`, { reviewStatus })
              }
              onReportBug={reportFeedback}
              onOpenBug={(id) => setDrawer({ kind: "bug", id })}
              sessions={sessions}
              note={note}
              onNoteChange={setNote}
              onSubmit={() =>
                submit(
                  "/api/playtest-feedback",
                  {
                    projectId: project._id,
                    rating: Number(note.rating),
                    comments: note.comments,
                    ...(note.buildId ? { buildId: note.buildId } : {}),
                    ...(note.sessionId ? { sessionId: note.sessionId } : {}),
                  },
                  () =>
                    setNote({
                      rating: "4",
                      comments: "",
                      buildId: "",
                      sessionId: "",
                    }),
                )
              }
            />
          </section>
        </div>
      </fieldset>
      {editingMilestone && (
        <MilestoneEditor
          key={editingMilestone}
          id={editingMilestone}
          onClose={() => setEditingMilestone(null)}
          onSaved={(updated) =>
            setMilestones((items) =>
              items.map((item) => (item._id === updated._id ? updated : item)),
            )
          }
        />
      )}
      {drawer && (
        <ItemDrawer
          key={`${drawer.kind}-${drawer.id}`}
          {...drawer}
          builds={builds}
          users={assignableUsers}
          milestones={milestones}
          onClose={() => setDrawer(null)}
          onSaved={(updated) => {
            if (drawer.kind === "task")
              setTasks((items) =>
                items.map((item) =>
                  item._id === updated._id ? updated : item,
                ),
              );
            else
              setBugs((items) =>
                items.map((item) =>
                  item._id === updated._id ? updated : item,
                ),
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

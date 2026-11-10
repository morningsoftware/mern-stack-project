import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { BugDetailsFields } from "../playtesting/BugDetailsFields";
import { BugScreenshots } from "../playtesting/BugScreenshots";
import { TaskDiscussion } from "../discussions/TaskDiscussion";
import {
  useUnsavedChanges,
  confirmDiscard,
} from "../../navigation/UnsavedChanges";
import { api, errorMessage } from "../../api";
import type {
  BugReport,
  Build,
  Milestone,
  Task,
  User,
} from "../../types";
import { ErrorNote, Field } from "../../components/Forms";
import {
  TASK_STATUSES,
  PRIORITIES,
  BUG_STATUSES,
  BUG_SEVERITIES,
} from "../../constants";
import type {
  BugSeverity,
  BugStatus,
  TaskPriority,
  TaskStatus,
} from "../../constants";

type DrawerRecord = Task | BugReport;

export function ItemDrawer({
  kind,
  id,
  users,
  milestones,
  builds = [],
  onClose,
  onSaved,
}: {
  kind: "task" | "bug";
  id: string;
  users: User[];
  milestones: Milestone[];
  builds?: Build[];
  onClose: () => void;
  onSaved: (record: DrawerRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false);
  const [record, setRecord] = useState<DrawerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [discussionBusy, setDiscussionBusy] = useState(false);
  const [discussionDirty, setDiscussionDirty] = useState(false);
  const baseline = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const endpoint = kind === "task" ? "tasks" : "bug-reports";
  const dirty = record !== null && JSON.stringify(record) !== baseline.current;
  useUnsavedChanges(Boolean(dirty), pending);
  function close() {
    if (!pending && !discussionBusy && confirmDiscard(dirty || discussionDirty))
      onClose();
  }
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node?.showModal();
    title.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = oldOverflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<DrawerRecord>(`/api/${endpoint}/${id}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          baseline.current = JSON.stringify(data);
          setRecord(data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, id, attempt]);
  const update = (key: string, value: string): void =>
    setRecord((old) =>
      old ? ({ ...old, [key]: value } as DrawerRecord) : old,
    );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || lock.current || discussionBusy) return;
    if (
      discussionDirty &&
      !confirmDiscard(
        true,
        "Discard your unsent attachment or comment and save these changes? Choose Cancel to keep writing.",
      )
    )
      return;
    lock.current = true;
    setPending(true);
    setError("");
    const body = {
      title: record.title.trim(),
      description: record.description || "",
      status: record.status,
      ...(kind === "task"
        ? {
            priority: (record as Task).priority,
            assigneeId: (record as Task).assigneeId,
            milestoneId: (record as Task).milestoneId,
          }
        : {
            severity: (record as BugReport).severity,
            buildId: (record as BugReport).buildId || null,
            reproductionSteps: (record as BugReport).reproductionSteps || "",
            expectedResult: (record as BugReport).expectedResult || "",
            actualResult: (record as BugReport).actualResult || "",
            environment: (record as BugReport).environment || "",
          }),
    };
    if (!body.title) {
      setError("Enter a title before saving.");
      setPending(false);
      lock.current = false;
      return;
    }
    try {
      const updated = await api<DrawerRecord>(`/api/${endpoint}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved(updated);
      baseline.current = JSON.stringify(record);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="item-drawer"
      aria-labelledby="drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="drawer-header">
        <div>
          <p className="record-id">
            {kind === "task" ? "Task" : "Bug report"} /{" "}
            {id.slice(-5).toUpperCase()}
          </p>
          <h2 id="drawer-title" ref={title} tabIndex={-1}>
            {kind === "task" ? "Task details" : "Bug details"}
          </h2>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={close}
          disabled={pending || discussionBusy}
        >
          Close
        </button>
      </header>
      <ErrorNote error={error} />
      {loading && <p role="status">Loading details…</p>}
      {!loading && !record && (
        <button onClick={() => setAttempt((old) => old + 1)}>Try again</button>
      )}
      {!loading && record && (
        <form onSubmit={save}>
          <fieldset className="stack" disabled={pending || discussionBusy}>
            <Field label="Title">
              <input
                value={record.title}
                onChange={(event) => update("title", event.target.value)}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={7}
                value={record.description || ""}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
            <Field label="Status">
              <select
                value={record.status}
                onChange={(event) => update("status", event.target.value)}
              >
                {(kind === "task" ? TASK_STATUSES : BUG_STATUSES).map(
                  (status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </Field>
            {kind === "task" ? (
              <>
                <Field label="Priority">
                  <select
                    value={(record as Task).priority}
                    onChange={(event) =>
                      update(
                        "priority",
                        event.target.value as TaskPriority,
                      )
                    }
                  >
                    {PRIORITIES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assignee">
                  <select
                    value={(record as Task).assigneeId}
                    onChange={(event) =>
                      update("assigneeId", event.target.value)
                    }
                    required
                  >
                    {!users.some(
                      (user) => user._id === (record as Task).assigneeId,
                    ) && (
                      <option value={(record as Task).assigneeId}>
                        Current assignee
                      </option>
                    )}
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Milestone">
                  <select
                    value={(record as Task).milestoneId}
                    onChange={(event) =>
                      update("milestoneId", event.target.value)
                    }
                    required
                  >
                    {!milestones.some(
                      (item) => item._id === (record as Task).milestoneId,
                    ) && (
                      <option value={(record as Task).milestoneId}>
                        Current milestone
                      </option>
                    )}
                    {milestones.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Severity">
                  <select
                    value={(record as BugReport).severity}
                    onChange={(event) =>
                      update(
                        "severity",
                        event.target.value as BugSeverity,
                      )
                    }
                  >
                    {BUG_SEVERITIES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <BugDetailsFields
                  value={record as BugReport}
                  builds={builds}
                  onChange={update}
                />
                {(record as BugReport).sourceFeedbackId && (
                  <p className="meta">Linked to playtest feedback.</p>
                )}
              </>
            )}
            <div className="drawer-actions">
              <button type="submit">
                {pending ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {kind === "bug" && record && !loading && (
        <BugScreenshots
          bugId={id}
          disabled={pending}
          onBusyChange={setDiscussionBusy}
          onDraftChange={setDiscussionDirty}
        />
      )}
      {kind === "task" && record && !loading && (
        <TaskDiscussion
          disabled={pending}
          taskId={id}
          onBusyChange={setDiscussionBusy}
          onDraftChange={setDiscussionDirty}
        />
      )}
    </dialog>
  );
}

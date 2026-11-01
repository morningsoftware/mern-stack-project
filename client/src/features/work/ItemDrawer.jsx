import { useEffect, useRef, useState } from "react";
import { BugDetailsFields } from "../playtesting/BugDetailsFields.jsx";
import { api } from "../../api.js";
import { ErrorNote, Field } from "../../components/Forms.jsx";
import {
  TASK_STATUSES,
  PRIORITIES,
  BUG_STATUSES,
  BUG_SEVERITIES,
} from "../../constants.js";

export function ItemDrawer({
  kind,
  id,
  users,
  milestones,
  builds = [],
  onClose,
  onSaved,
}) {
  const dialog = useRef(null);
  const title = useRef(null);
  const lock = useRef(false);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const endpoint = kind === "task" ? "tasks" : "bug-reports";
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal();
    title.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(`/api/${endpoint}/${id}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setRecord(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, id, attempt]);
  const update = (key, value) => setRecord((old) => ({ ...old, [key]: value }));
  async function save(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    const body = {
      title: record.title.trim(),
      description: record.description || "",
      status: record.status,
      ...(kind === "task"
        ? {
            priority: record.priority,
            assigneeId: record.assigneeId,
            milestoneId: record.milestoneId,
          }
        : {
            severity: record.severity,
            buildId: record.buildId || null,
            reproductionSteps: record.reproductionSteps || "",
            expectedResult: record.expectedResult || "",
            actualResult: record.actualResult || "",
            environment: record.environment || "",
          }),
    };
    if (!body.title) {
      setError("Enter a title before saving.");
      setPending(false);
      lock.current = false;
      return;
    }
    try {
      const updated = await api(`/api/${endpoint}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message);
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
        if (!pending) onClose();
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
          onClick={onClose}
          disabled={pending}
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
          <fieldset className="stack" disabled={pending}>
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
                    value={record.priority}
                    onChange={(event) => update("priority", event.target.value)}
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
                    value={record.assigneeId}
                    onChange={(event) =>
                      update("assigneeId", event.target.value)
                    }
                    required
                  >
                    {!users.some((user) => user._id === record.assigneeId) && (
                      <option value={record.assigneeId}>
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
                    value={record.milestoneId}
                    onChange={(event) =>
                      update("milestoneId", event.target.value)
                    }
                    required
                  >
                    {!milestones.some(
                      (item) => item._id === record.milestoneId,
                    ) && (
                      <option value={record.milestoneId}>
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
                    value={record.severity}
                    onChange={(event) => update("severity", event.target.value)}
                  >
                    {BUG_SEVERITIES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
                <BugDetailsFields
                  value={record}
                  builds={builds}
                  onChange={update}
                />
                {record.sourceFeedbackId && (
                  <p className="meta">Linked to playtest feedback.</p>
                )}
              </>
            )}
            <div className="drawer-actions">
              <button type="submit">
                {pending ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </dialog>
  );
}

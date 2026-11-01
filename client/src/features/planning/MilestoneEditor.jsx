import { useEffect, useRef, useState } from "react";
import {
  useUnsavedChanges,
  confirmDiscard,
} from "../../navigation/UnsavedChanges.jsx";
import { api } from "../../api.js";
import { ErrorNote, Field } from "../../components/Forms.jsx";
import { MILESTONE_STATUSES } from "../../constants.js";
import { dueDateKey } from "./milestoneData.js";

export function MilestoneEditor({ id, onClose, onSaved }) {
  const dialog = useRef(null);
  const heading = useRef(null);
  const lock = useRef(false);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const baseline = useRef(null);
  const dirty = form && JSON.stringify(form) !== baseline.current;
  useUnsavedChanges(Boolean(dirty), pending);
  function close() {
    if (!pending && confirmDiscard(dirty)) onClose();
  }
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal();
    heading.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(`/api/milestones/${id}`, { signal: controller.signal })
      .then((record) => {
        if (!controller.signal.aborted) {
          const initial = {
            name: record.name,
            description: record.description || "",
            dueDate: dueDateKey(record.dueDate) || "",
            status: record.status,
          };
          baseline.current = JSON.stringify(initial);
          setForm(initial);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  async function save(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!form.name.trim()) {
      setError("Enter a milestone name.");
      return;
    }
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const updated = await api(`/api/milestones/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          dueDate: form.dueDate || null,
        }),
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
      aria-labelledby="milestone-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="drawer-header">
        <div>
          <p className="record-id">Milestone / {id.slice(-5).toUpperCase()}</p>
          <h2 id="milestone-editor-title" ref={heading} tabIndex={-1}>
            Edit milestone
          </h2>
        </div>
        <button
          className="secondary"
          type="button"
          disabled={pending}
          onClick={close}
        >
          Close
        </button>
      </header>
      <ErrorNote error={error} />
      {loading && <p role="status">Loading milestone…</p>}
      {!loading && !form && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button>
      )}
      {!loading && form && (
        <form onSubmit={save}>
          <fieldset className="stack" disabled={pending}>
            <Field label="Milestone name">
              <input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={6}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </Field>
            <p className="meta">
              Leave the date empty to keep this milestone unscheduled. Dates use
              the selected calendar day.
            </p>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
              >
                {MILESTONE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <div className="drawer-actions">
              <button type="submit">
                {pending ? "Saving…" : "Save milestone"}
              </button>
              <button type="button" className="secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { ErrorNote, Field } from "../../components/Forms.jsx";
import {
  useUnsavedChanges,
  confirmDiscard,
} from "../../navigation/UnsavedChanges.jsx";
const blank = { title: "", instructions: "", deadline: "", buildId: "" };
function localInput(date) {
  if (!date) return "";
  const value = new Date(date);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function PlaytestSessions({
  projectId,
  builds,
  feedback,
  canManage,
  active,
  onFeedback,
  onSessionsChange,
}) {
  const [sessions, setSessions] = useState([]),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState(null),
    [now, setNow] = useState(Date.now);
  const baseline = useRef(JSON.stringify(blank)),
    lock = useRef(false);
  const dirty = JSON.stringify(form) !== baseline.current;
  useEffect(() => {
    onSessionsChange(sessions);
  }, [sessions, onSessionsChange]);
  useUnsavedChanges(dirty, pending);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(`/api/playtest-sessions?projectId=${projectId}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setSessions(data);

          setNow(Date.now());
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, active, attempt, onSessionsChange]);
  function reset() {
    setEditing(null);
    baseline.current = JSON.stringify(blank);
    setForm(blank);
  }
  async function save(id, body, clear) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const updated = await api(`/api/playtest-sessions${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setSessions((old) => {
        const next = id
          ? old.map((item) => (item._id === id ? updated : item))
          : [updated, ...old];

        return next;
      });
      if (clear) reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
      lock.current = false;
    }
  }
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <section
      className="panel playtest-sessions"
      aria-labelledby="sessions-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="sessions-title">Playtest sessions</h2>
          <p className="meta">
            A specific build, testing instructions, and a feedback deadline.
          </p>
        </div>
        <button
          className="secondary"
          disabled={loading || pending}
          onClick={() => setAttempt((old) => old + 1)}
        >
          Refresh sessions
        </button>
      </div>
      <ErrorNote error={error} />
      {loading && <p role="status">Loading sessions…</p>}
      {!loading && !error && !sessions.length && (
        <p className="empty-notice">
          No playtest sessions yet. Publish a build, then organize a test.
        </p>
      )}
      <div className="feedback-reports">
        {sessions.map((session) => {
          const expired = new Date(session.deadline).getTime() <= now;
          const open = session.status === "open" && !expired;
          return (
            <article className="feedback-report" key={session._id}>
              <header>
                <h3>{session.title}</h3>
                <span className="badge">
                  {session.status === "closed"
                    ? "Closed"
                    : expired
                      ? "Deadline passed"
                      : "Open"}
                </span>
              </header>
              <p className="meta">
                {builds.find((item) => item._id === session.buildId)?.version ||
                  "Unavailable build"}{" "}
                · Deadline: {new Date(session.deadline).toLocaleString()}
              </p>
              <p className="release-notes">{session.instructions}</p>
              <p className="meta">
                {
                  feedback.filter((item) => item.sessionId === session._id)
                    .length
                }{" "}
                feedback reports
              </p>
              <div className="build-actions">
                <button
                  disabled={!open || pending}
                  onClick={() => onFeedback(session)}
                >
                  Submit session feedback
                </button>
                {canManage && (
                  <>
                    <button
                      className="secondary"
                      disabled={pending}
                      onClick={() => {
                        if (!confirmDiscard(dirty)) return;
                        const initial = {
                          title: session.title,
                          instructions: session.instructions,
                          deadline: localInput(session.deadline),
                          buildId: session.buildId,
                        };
                        baseline.current = JSON.stringify(initial);
                        setEditing(session._id);
                        setForm(initial);
                      }}
                    >
                      Edit session
                    </button>
                    <button
                      className="text-button"
                      disabled={
                        pending || (expired && session.status !== "closed")
                      }
                      onClick={() =>
                        save(
                          session._id,
                          {
                            status:
                              session.status === "closed" ? "open" : "closed",
                          },
                          false,
                        )
                      }
                    >
                      {session.status === "closed"
                        ? "Reopen session"
                        : "Close session"}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {canManage && (
        <section className="submit-feedback">
          <h3>
            {editing ? "Edit playtest session" : "Create a playtest session"}
          </h3>
          {!builds.length && (
            <p className="meta">
              Publish a build in Builds before creating a session.
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const deadline = new Date(form.deadline);
              if (!Number.isFinite(deadline.getTime())) {
                setError("Enter a valid feedback deadline.");
                return;
              }
              const body = {
                title: form.title,
                instructions: form.instructions,
                deadline: deadline.toISOString(),
              };
              if (!editing) {
                body.projectId = projectId;
                body.buildId = form.buildId;
              }
              save(editing, body, true);
            }}
          >
            <fieldset className="stack" disabled={pending || !builds.length}>
              <Field label="Session title">
                <input
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </Field>
              <Field label="Session build">
                <select
                  required
                  disabled={Boolean(editing)}
                  value={form.buildId}
                  onChange={(event) => update("buildId", event.target.value)}
                >
                  <option value="">Choose a build</option>
                  {builds.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.version} · {item.platform}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Testing instructions">
                <textarea
                  rows={4}
                  required
                  maxLength={4000}
                  value={form.instructions}
                  onChange={(event) =>
                    update("instructions", event.target.value)
                  }
                />
              </Field>
              <Field label="Feedback deadline">
                <input
                  type="datetime-local"
                  required
                  value={form.deadline}
                  onChange={(event) => update("deadline", event.target.value)}
                />
              </Field>
              <p className="meta">
                Deadline uses your local timezone. The session's build stays
                fixed.
              </p>
              <button type="submit">
                {pending
                  ? "Saving…"
                  : editing
                    ? "Save session"
                    : "Create session"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (confirmDiscard(dirty)) reset();
                  }}
                >
                  Cancel session edit
                </button>
              )}
            </fieldset>
          </form>
        </section>
      )}
    </section>
  );
}

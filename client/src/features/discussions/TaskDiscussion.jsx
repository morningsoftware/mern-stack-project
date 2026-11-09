import { useEffect, useRef, useState } from "react";
import { useUnsavedChanges } from "../../navigation/UnsavedChanges.jsx";
import { api } from "../../api.js";
import { ErrorNote, Field } from "../../components/Forms.jsx";

export function TaskDiscussion({
  taskId,
  onBusyChange,
  disabled = false,
  onDraftChange,
}) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  useUnsavedChanges(Boolean(body), pending);
  useEffect(() => {
    onDraftChange?.(Boolean(body));
  }, [body, onDraftChange]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(`/api/tasks/${taskId}/comments`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setComments(data.comments);
          setPage(data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.status === 403
              ? "Task discussions are available to team members."
              : err.message,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [taskId, attempt]);
  async function run(action) {
    if (lock.current || disabled) return;
    lock.current = true;
    setPending(true);
    onBusyChange(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      lock.current = false;
      setPending(false);
      onBusyChange(false);
    }
  }
  return (
    <section className="task-discussion" aria-labelledby="discussion-title">
      <h3 id="discussion-title">Discussion</h3>
      <p className="meta">
        Notes and decisions for this task. Visible to team members.
      </p>
      <ErrorNote error={error} />
      {loading && <p role="status">Loading discussion…</p>}
      {!loading && !page && (
        <button
          type="button"
          className="secondary"
          onClick={() => setAttempt((old) => old + 1)}
        >
          Retry discussion
        </button>
      )}
      {page && (
        <>
          {page.hasMore && (
            <button
              type="button"
              className="text-button"
              disabled={pending || disabled}
              onClick={() =>
                run(async () => {
                  const data = await api(
                    `/api/tasks/${taskId}/comments?before=${page.nextBefore}`,
                  );
                  setComments((old) => [...data.comments, ...old]);
                  setPage(data);
                })
              }
            >
              Load earlier comments
            </button>
          )}
          {!comments.length && (
            <p className="empty-notice">
              No comments yet. Add a note or a question for your team.
            </p>
          )}
          <ol className="discussion-list">
            {comments.map((comment) => (
              <li key={comment._id}>
                <header>
                  <strong>{comment.authorName}</strong>{" "}
                  <time dateTime={comment.createdOn}>
                    {new Date(comment.createdOn).toLocaleString()}
                  </time>
                </header>
                <p>{comment.body}</p>
              </li>
            ))}
          </ol>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!body.trim()) return;
              run(async () => {
                const added = await api(`/api/tasks/${taskId}/comments`, {
                  method: "POST",
                  body: JSON.stringify({ body: body.trim() }),
                });
                setComments((old) => [...old, added]);
                setBody("");
                setNotice("Comment posted.");
              });
            }}
          >
            <fieldset className="stack" disabled={pending || disabled}>
              <Field label="Add a comment">
                <textarea
                  value={body}
                  maxLength={4000}
                  rows={3}
                  required
                  onChange={(event) => setBody(event.target.value)}
                />
              </Field>
              <small className="meta">
                {body.length.toLocaleString()} / 4,000 characters · Plain text
              </small>
              <button type="submit" disabled={!body.trim()}>
                {pending ? "Please wait…" : "Post comment"}
              </button>
            </fieldset>
          </form>
        </>
      )}
      <p role="status" className="meta">
        {notice}
      </p>
    </section>
  );
}

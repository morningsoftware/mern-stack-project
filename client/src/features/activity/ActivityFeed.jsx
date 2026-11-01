import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { ErrorNote } from "../../components/Forms.jsx";
export function ActivityFeed({ projectId, active }) {
  const [events, setEvents] = useState([]),
    [page, setPage] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(`/api/activity?projectId=${projectId}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setEvents(data.events);
          setPage(data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, active, attempt]);
  async function older() {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    setError("");
    try {
      const data = await api(
        `/api/activity?projectId=${projectId}&before=${page.nextBefore}`,
      );
      setEvents((old) => [...old, ...data.events]);
      setPage(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      lock.current = false;
    }
  }
  return (
    <section className="panel" aria-labelledby="activity-title">
      <div className="section-heading">
        <div>
          <h2 id="activity-title">Activity</h2>
          <p className="meta">
            Recorded changes from this feature's release onward.
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => setAttempt((old) => old + 1)}
        >
          Refresh activity
        </button>
      </div>
      <ErrorNote error={error} />
      {loading && <p role="status">Loading activity…</p>}
      {!loading && !error && !events.length && (
        <p className="empty-notice">
          No recorded activity yet. Create or update work to start the history.
        </p>
      )}
      <ol className="discussion-list activity-list">
        {events.map((event) => (
          <li key={event._id}>
            <header>
              <span>
                <strong>{event.actorName}</strong> {event.action}{" "}
                {event.resource}: {event.label}
              </span>
              <time dateTime={event.createdOn}>
                {new Date(event.createdOn).toLocaleString()}
              </time>
            </header>
            {Object.entries(event.changes || {}).map(([field, change]) => (
              <p className="meta" key={field}>
                {field}: {change.from || "None"} → {change.to || "None"}
              </p>
            ))}
          </li>
        ))}
      </ol>
      {page?.hasMore && (
        <button type="button" disabled={loading} onClick={older}>
          Load earlier activity
        </button>
      )}
    </section>
  );
}

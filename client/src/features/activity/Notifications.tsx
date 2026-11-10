import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../../api";
import type { Notification, NotificationPage } from "../../types";
import type { ProjectView } from "../../constants";
import { ErrorNote } from "../../components/Forms";

export function Notifications({
  projectId,
  active,
  onViewChange,
  onOpenTask,
}: {
  projectId: string;
  active: boolean;
  onViewChange: (view: ProjectView) => void;
  onOpenTask: (id: string) => void;
}) {
  const [items, setItems] = useState<Notification[]>([]),
    [page, setPage] = useState<NotificationPage | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [attempt, setAttempt] = useState(0),
    [unread, setUnread] = useState(false);
  const lock = useRef(false);
  const endpoint = `/api/notifications?projectId=${projectId}&unread=${unread}`;
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<NotificationPage>(endpoint, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(data.notifications);
          setPage(data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, active, attempt]);
  async function toggle(item: Notification) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const updated = await api<Notification>(
        `/api/notifications/${item._id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ read: !item.readOn }),
        },
      );
      setItems((old) =>
        old
          .map((row) => (row._id === item._id ? updated : row))
          .filter((row) => !unread || !row.readOn),
      );
      setPage((old) =>
        old
          ? {
              ...old,
              unreadCount: old.unreadCount + (updated.readOn ? -1 : 1),
            }
          : old,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
      lock.current = false;
    }
  }
  async function older() {
    if (lock.current || !page) return;
    lock.current = true;
    setLoading(true);
    setError("");
    try {
      const data = await api<NotificationPage>(
        `${endpoint}&before=${page.nextBefore}`,
      );
      setItems((old) => [...old, ...data.notifications]);
      setPage(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      lock.current = false;
    }
  }
  return (
    <section
      className="panel notifications"
      aria-labelledby="notifications-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="notifications-title">Notifications</h2>
          <p className="meta">
            {page?.unreadCount ?? 0} unread in this project · Assignment and
            playtest updates
          </p>
        </div>
        <button
          className="secondary"
          disabled={loading || pending}
          onClick={() => setAttempt((old) => old + 1)}
        >
          Refresh notifications
        </button>
      </div>
      <label className="toggle-filter">
        <input
          type="checkbox"
          checked={unread}
          disabled={pending || loading}
          onChange={(event) => setUnread(event.target.checked)}
        />
        Unread only
      </label>
      <ErrorNote error={error} />
      {loading && <p role="status">Loading notifications…</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item._id}>
            <div>
              <strong>{item.message}</strong>
              <p className="meta">
                {item.readOn ? "Read" : "Unread"} ·{" "}
                {new Date(item.createdOn).toLocaleString()}
              </p>
              <button
                className="text-button"
                onClick={() => {
                  if (item.resource === "task") onOpenTask(item.resourceId);
                  else onViewChange("feedback");
                }}
              >
                Open related work
              </button>
            </div>
            <button
              className="secondary"
              disabled={pending || loading}
              onClick={() => toggle(item)}
            >
              {item.readOn ? "Mark unread" : "Mark read"}
            </button>
          </li>
        ))}
      </ul>
      {!loading && !error && !items.length && (
        <p className="empty-notice">
          {unread
            ? "No unread notifications."
            : "No notifications yet. Updates from teammates will appear here."}
        </p>
      )}
      {page?.hasMore && (
        <button disabled={loading || pending} onClick={older}>
          Load earlier notifications
        </button>
      )}
    </section>
  );
}

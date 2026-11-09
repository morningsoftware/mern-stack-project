import { useState } from "react";
import { Field } from "../../components/Forms.jsx";

export function FeedbackTriage({
  feedback,
  sessions = [],
  builds,
  users,
  bugs,
  pending,
  canReview,
  onReview,
  onReportBug,
  onOpenBug,
  note,
  onNoteChange,
  onSubmit,
}) {
  const [filters, setFilters] = useState({ build: "", rating: "", review: "" });
  const setFilter = (key, value) =>
    setFilters((old) => ({ ...old, [key]: value }));
  const visible = feedback.filter(
    (item) =>
      (!filters.build ||
        (filters.build === "general"
          ? !item.buildId
          : item.buildId === filters.build)) &&
      (!filters.rating ||
        (filters.rating === "low"
          ? item.rating <= 2
          : filters.rating === "mid"
            ? item.rating === 3
            : item.rating >= 4)) &&
      (!filters.review || (item.reviewStatus || "new") === filters.review),
  );
  const updateNote = (key, value) =>
    onNoteChange((old) => ({ ...old, [key]: value }));
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Playtest feedback</h2>
          <p className="meta">
            {
              feedback.filter((item) => (item.reviewStatus || "new") === "new")
                .length
            }{" "}
            awaiting review · {visible.length} shown
          </p>
        </div>
      </div>
      <div className="board-filters" aria-label="Feedback filters">
        <Field label="Filter feedback by build">
          <select
            value={filters.build}
            onChange={(event) => setFilter("build", event.target.value)}
          >
            <option value="">All builds</option>
            <option value="general">General feedback</option>
            {builds.map((build) => (
              <option key={build._id} value={build._id}>
                {build.version} · {build.platform}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filter feedback by rating">
          <select
            value={filters.rating}
            onChange={(event) => setFilter("rating", event.target.value)}
          >
            <option value="">All ratings</option>
            <option value="low">1–2 stars</option>
            <option value="mid">3 stars</option>
            <option value="high">4–5 stars</option>
          </select>
        </Field>
        <Field label="Review state">
          <select
            value={filters.review}
            onChange={(event) => setFilter("review", event.target.value)}
          >
            <option value="">All reports</option>
            <option value="new">Awaiting review</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </Field>
        <button
          type="button"
          className="text-button"
          onClick={() => setFilters({ build: "", rating: "", review: "" })}
        >
          Clear feedback filters
        </button>
      </div>
      <div className="feedback-reports">
        {visible.map((item) => {
          const linked = bugs.filter(
            (bug) => bug.sourceFeedbackId === item._id,
          );
          const state = item.reviewStatus || "new";
          return (
            <article className="feedback-report" key={item._id}>
              <header>
                <strong>
                  {users.find((user) => user._id === item.userId)
                    ?.displayName || "Unknown playtester"}
                </strong>
                <span>Rating {item.rating} of 5</span>
                <span className="badge">
                  {state === "reviewed" ? "Reviewed" : "Awaiting review"}
                </span>
              </header>
              <p className="meta">
                {item.buildId
                  ? `Build: ${builds.find((build) => build._id === item.buildId)?.version || "Unavailable build"}`
                  : "General project feedback"}
              </p>
              {item.sessionId && (
                <p className="meta">
                  Session:{" "}
                  {sessions.find((session) => session._id === item.sessionId)
                    ?.title || "Linked playtest session"}
                </p>
              )}
              <p className="release-notes">
                {item.comments || "No comments provided."}
              </p>
              {linked.length > 0 && (
                <div className="linked-report-bugs">
                  <small className="meta">Linked bug reports</small>
                  {linked.map((bug) => (
                    <button
                      type="button"
                      className="text-button"
                      key={bug._id}
                      onClick={() => onOpenBug(bug._id)}
                    >
                      {bug.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="build-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => onReportBug(item)}
                >
                  {linked.length ? "Log another bug" : "Log bug from feedback"}
                </button>
                {canReview && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={pending}
                    onClick={() =>
                      onReview(
                        item._id,
                        state === "reviewed" ? "new" : "reviewed",
                      )
                    }
                  >
                    {state === "reviewed" ? "Reopen review" : "Mark reviewed"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <p className="empty-notice" role="status">
          {feedback.length
            ? "No feedback matches these filters."
            : "No feedback yet. Submit a report after testing a build."}
        </p>
      )}
      {!canReview && (
        <p className="meta">Team members can mark reports as reviewed.</p>
      )}
      <section
        className="submit-feedback"
        aria-labelledby="submit-feedback-title"
      >
        <h3 id="submit-feedback-title">Submit playtest feedback</h3>
        {note.sessionId && (
          <div className="source-notice">
            <p>
              Feedback for session:{" "}
              {sessions.find((item) => item._id === note.sessionId)?.title ||
                "Selected session"}
              . Its build is fixed.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={() => updateNote("sessionId", "")}
            >
              Unlink session
            </button>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <fieldset className="stack" disabled={pending}>
            <Field label="Build tested">
              <select
                disabled={Boolean(note.sessionId)}
                value={note.buildId}
                onChange={(event) => updateNote("buildId", event.target.value)}
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
                onChange={(event) => updateNote("rating", event.target.value)}
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
                rows={4}
                value={note.comments}
                onChange={(event) => updateNote("comments", event.target.value)}
              />
            </Field>
            <button type="submit">
              {pending ? "Submitting…" : "Add feedback"}
            </button>
          </fieldset>
        </form>
      </section>
    </>
  );
}

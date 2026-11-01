import { useState } from "react";
import { Field } from "../../components/Forms.jsx";
import { BUG_STATUSES, BUG_SEVERITIES } from "../../constants.js";
import { BugDetailsFields } from "./BugDetailsFields.jsx";

export function BugReports({
  bugs,
  builds,
  pending,
  draft,
  onDraftChange,
  onSubmit,
  onOpen,
  onStatusChange,
}) {
  const [buildFilter, setBuildFilter] = useState("");
  const visible = bugs.filter(
    (bug) =>
      !buildFilter ||
      (buildFilter === "general" ? !bug.buildId : bug.buildId === buildFilter),
  );
  const update = (key, value) =>
    onDraftChange((old) => ({ ...old, [key]: value }));
  return (
    <>
      <div className="section-heading">
        <h2>Bug reports</h2>
        <span className="count">{visible.length}</span>
      </div>
      <Field label="Filter bugs by build">
        <select
          value={buildFilter}
          onChange={(event) => setBuildFilter(event.target.value)}
        >
          <option value="">All builds</option>
          <option value="general">No build linked</option>
          {builds.map((build) => (
            <option key={build._id} value={build._id}>
              {build.version} · {build.platform}
            </option>
          ))}
        </select>
      </Field>
      <ul className="list bug-list">
        {visible.map((bug) => (
          <li key={bug._id}>
            <div>
              <button
                type="button"
                className="item-title"
                onClick={() => onOpen(bug._id)}
              >
                {bug.title}
              </button>
              <div className="report-tags">
                <span className="badge">{bug.severity}</span>
                {bug.buildId && (
                  <span className="meta">
                    Build:{" "}
                    {builds.find((build) => build._id === bug.buildId)
                      ?.version || "Unavailable build"}
                  </span>
                )}
                {bug.sourceFeedbackId && (
                  <span className="meta">From playtest feedback</span>
                )}
              </div>
            </div>
            <select
              aria-label={`Status for ${bug.title}`}
              value={bug.status}
              disabled={pending}
              onChange={(event) => onStatusChange(bug._id, event.target.value)}
            >
              {BUG_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="empty-notice" role="status">
          {bugs.length ? "No bugs match this build." : "No bug reports yet."}
        </p>
      )}
      <section className="new-bug-report" aria-labelledby="new-bug-title">
        <h3 id="new-bug-title">Report a bug</h3>
        <p className="meta">
          After submitting, open the report to attach screenshots.
        </p>
        {draft.sourceFeedbackId && (
          <div className="source-notice">
            <p>
              Started from playtest feedback. The original comment is copied
              below; add the reproduction details before submitting.
            </p>
            <button
              type="button"
              className="text-button"
              onClick={() => update("sourceFeedbackId", "")}
            >
              Unlink feedback
            </button>
          </div>
        )}
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <fieldset disabled={pending} className="stack">
            <Field label="Bug title">
              <input
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
            <BugDetailsFields value={draft} builds={builds} onChange={update} />
            <Field label="Severity">
              <select
                value={draft.severity}
                onChange={(event) => update("severity", event.target.value)}
              >
                {BUG_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit">
              {pending ? "Submitting…" : "Report bug"}
            </button>
          </fieldset>
        </form>
      </section>
    </>
  );
}

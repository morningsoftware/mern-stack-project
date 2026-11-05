import { useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { ErrorNote } from "../../components/Forms.jsx";

export function VersionControl({ projectId, fullName, active, attempt, section }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const loadedKey = useRef("");

  useEffect(() => {
    if (!active || !fullName) return;
    const key = `${fullName}:${attempt}`;
    if (loadedKey.current === key) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSnapshot(null);
    api(`/api/github/repository?projectId=${projectId}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        loadedKey.current = key;
        setSnapshot(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, attempt, fullName, projectId]);

  if (loading && !snapshot) {
    return <p role="status">Loading repository…</p>;
  }
  return (
    <>
      <ErrorNote error={error} />
      {!error && snapshot && section === "repository" && (
        <RepositoryDetails snapshot={snapshot} />
      )}
      {!error && snapshot && section === "branches" && (
        <BranchList snapshot={snapshot} />
      )}
      {!error && snapshot && section === "commits" && (
        <CommitHistory snapshot={snapshot} />
      )}
    </>
  );
}

function RepositoryDetails({ snapshot }) {
  const { repository, languages, contributors, contributorsReady } = snapshot;
  const languageTotal = languages.reduce((sum, language) => sum + language.bytes, 0);
  return (
    <>
      <section className="project-ledger" aria-label="Repository summary">
        <div>
          <span>Stars</span>
          <strong>{repository.stars}</strong>
        </div>
        <div>
          <span>Forks</span>
          <strong>{repository.forks}</strong>
        </div>
        <div>
          <span>Open issues</span>
          <strong>{repository.openIssues}</strong>
          <small className="meta">Includes pull requests</small>
        </div>
        <div>
          <span>Primary language</span>
          <strong>{repository.language || "—"}</strong>
        </div>
      </section>
      <p className="meta">
        {repository.visibility === "private" ? "Private" : "Public"}
        {repository.archived ? " · Archived" : ""}
        {repository.defaultBranch
          ? ` · Default branch ${repository.defaultBranch}`
          : ""}
        {repository.license ? ` · ${repository.license}` : ""}
        {repository.pushedAt ? ` · Last push ${formatWhen(repository.pushedAt)}` : ""}
      </p>
      {repository.description && <p>{repository.description}</p>}
      {repository.homepage && (
        <p>
          <a href={repository.homepage}>Project site</a>
        </p>
      )}
      {repository.url && (
        <p>
          <a href={repository.url}>View on GitHub</a>
        </p>
      )}
      <h3>Languages</h3>
      {!languages.length ? (
        <p className="empty-notice">No language data yet.</p>
      ) : (
        <ul className="list">
          {languages.map((language) => (
            <li key={language.name}>
              <div>
                <strong>{language.name}</strong>
                <progress
                  value={language.bytes}
                  max={languageTotal || 1}
                  aria-label={`${language.name}, ${shareLabel(language.share)} of this repository`}
                />
              </div>
              <span className="meta">{shareLabel(language.share)}</span>
            </li>
          ))}
        </ul>
      )}
      <h3>Contributors</h3>
      {!contributorsReady ? (
        <p className="empty-notice" role="status">
          GitHub is still calculating contributors.
        </p>
      ) : !contributors.length ? (
        <p className="empty-notice">No contributors yet.</p>
      ) : (
        <ul className="list">
          {contributors.map((person) => (
            <li key={person.login}>
              <span>{person.login}</span>
              <span className="meta">
                {person.contributions}{" "}
                {person.contributions === 1 ? "contribution" : "contributions"}
                {person.url ? (
                  <>
                    {" "}
                    <a href={person.url}>Profile</a>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function BranchList({ snapshot }) {
  const { branches, branchesTruncated } = snapshot;
  return (
    <>
      <p className="meta">Branches are ordered by their latest commit.</p>
      {branchesTruncated && (
        <p className="meta">Showing the 12 branches with the latest commits.</p>
      )}
      {!branches.length ? (
        <p className="empty-notice">No branches found.</p>
      ) : (
        <ul className="list">
          {branches.map((branch) => (
            <li key={branch.name}>
              <div>
                <strong>{branch.name}</strong>
                <span className="version-flags">
                  {branch.default && <span className="badge">default</span>}
                  {branch.protected && <span className="badge">protected</span>}
                </span>
                <small className="meta">
                  {branch.message || "No commit message"}
                  {" · "}
                  {branch.author || "Unknown author"}
                  {branch.sha ? ` · ${branch.sha.slice(0, 7)}` : ""}
                </small>
              </div>
              <time dateTime={branch.committedAt || undefined}>
                {formatWhen(branch.committedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CommitHistory({ snapshot }) {
  const branch = snapshot.repository.defaultBranch;
  return (
    <>
      <p className="meta">
        {branch
          ? `Recent commits on ${branch}.`
          : "Recent commits on the default branch."}
      </p>
      {!snapshot.commits.length ? (
        <p className="empty-notice">No commits yet.</p>
      ) : (
        <ol className="discussion-list activity-list">
          {snapshot.commits.map((commit) => (
            <li key={commit.sha}>
              <header>
                <span>
                  <strong className="count">{commit.sha.slice(0, 7)}</strong>{" "}
                  {commit.message}
                </span>
                <time dateTime={commit.date || undefined}>
                  {formatWhen(commit.date)}
                </time>
              </header>
              <p>
                {commit.author || "Unknown author"}
                {commit.url ? (
                  <>
                    {" "}
                    <a href={commit.url}>View</a>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function shareLabel(share) {
  return share > 0 ? `${share}%` : "<1%";
}

function formatWhen(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

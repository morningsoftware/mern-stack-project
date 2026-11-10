import { useEffect, useState } from "react";
import type { Dispatch, FormEvent, KeyboardEvent, SetStateAction } from "react";
import { api, errorMessage } from "../../api";
import type {
  GithubCheckForm,
  GithubDelivery,
  GithubPullRequest,
  Project,
} from "../../types";
import type { GithubCheckStatus } from "../../constants";
import { ErrorNote, Field } from "../../components/Forms";
import { GithubRepositoryField } from "./GithubRepositoryField";
import { VersionControl } from "./VersionControl";
import type { VersionSection } from "./VersionControl";

type GithubTab = "repository" | "branches" | "commits" | "events" | "pulls";

const TABS: ReadonlyArray<readonly [GithubTab, string]> = [
  ["repository", "Repository"],
  ["branches", "Branches"],
  ["commits", "Commits"],
  ["events", "Events"],
  ["pulls", "Pull requests"],
];
const VERSION_TABS = new Set<GithubTab>(["repository", "branches", "commits"]);

export function GithubDeliveries({
  project,
  active,
  onProjectChange,
}: {
  project: Project;
  active: boolean;
  onProjectChange: (project: Project) => void;
}) {
  const [tab, setTab] = useState<GithubTab>("repository");
  const [deliveries, setDeliveries] = useState<GithubDelivery[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);
  const [eventFilter, setEventFilter] = useState("");
  const [pulls, setPulls] = useState<GithubPullRequest[]>([]);
  const [checkForm, setCheckForm] = useState<GithubCheckForm>({
    name: "",
    headSha: "",
    status: "completed",
    conclusion: "success",
    summary: "",
  });
  const [selected, setSelected] = useState(project.githubRepository || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setSelected(project.githubRepository || "");
  }, [project.githubRepository]);

  useEffect(() => {
    if (!active || tab !== "events") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const deliveryPath = `/api/github/deliveries?projectId=${project._id}${
      eventFilter ? `&event=${encodeURIComponent(eventFilter)}` : ""
    }`;
    Promise.all([
      api<{ deliveries: GithubDelivery[] }>(deliveryPath, {
        signal: controller.signal,
      }),
      api<{ events: string[] }>("/api/github/events", {
        signal: controller.signal,
      }),
    ])
      .then(([deliveryData, eventData]) => {
        if (controller.signal.aborted) return;
        setDeliveries(deliveryData.deliveries);
        setEvents(eventData.events);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, attempt, eventFilter, project._id, tab]);

  useEffect(() => {
    if (!active || tab !== "pulls" || !project.githubRepository) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<{ pulls: GithubPullRequest[] }>(
      `/api/github/pulls?projectId=${project._id}`,
      {
        signal: controller.signal,
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) setPulls(data.pulls);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, attempt, project._id, project.githubRepository, tab]);

  const unchanged = (selected || "") === (project.githubRepository || "");

  function selectTab(next: GithubTab) {
    setTab(next);
    setError("");
    if (next !== "events" && next !== "pulls") setLoading(false);
  }

  function onTabsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex(([key]) => key === tab);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % TABS.length
            : (index - 1 + TABS.length) % TABS.length;
    const next = TABS[nextIndex][0];
    selectTab(next);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#github-tab-${next}`)
      ?.focus();
  }

  async function publishCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/api/github/checks", {
        method: "POST",
        body: JSON.stringify({
          projectId: project._id,
          name: checkForm.name,
          headSha: checkForm.headSha,
          status: checkForm.status,
          ...(checkForm.status === "completed"
            ? { conclusion: checkForm.conclusion }
            : {}),
          summary: checkForm.summary,
        }),
      });
      setCheckForm({
        name: "",
        headSha: "",
        status: "completed",
        conclusion: "success",
        summary: "",
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const updated = await api<Project>(`/api/projects/${project._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          githubRepository: selected || null,
        }),
      });
      onProjectChange(updated);
      setAttempt((old) => old + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel github-view" aria-labelledby="github-title">
      <div className="section-heading">
        <div>
          <h2 id="github-title">GitHub</h2>
          <p className="meta">
            {project.githubRepository
              ? `Linked to ${project.githubRepository}. Repository contents stay on GitHub.`
              : "Link a repository the GitHub App can access. This can be skipped."}
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={loading || pending}
          onClick={() => setAttempt((old) => old + 1)}
        >
          Refresh
        </button>
      </div>
      <form onSubmit={saveLink}>
        <fieldset className="stack" disabled={pending}>
          <GithubRepositoryField
            value={selected}
            disabled={pending}
            onChange={setSelected}
            onConnection={setGithubConnected}
          />
          {githubConnected && (
            <button type="submit" disabled={unchanged}>
              {pending
                ? "Saving…"
                : !selected && project.githubRepository
                  ? "Remove repository"
                  : "Link repository"}
            </button>
          )}
        </fieldset>
      </form>
      <div
        className="plan-filters"
        role="tablist"
        aria-label="GitHub sections"
        onKeyDown={onTabsKeyDown}
      >
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="secondary"
            role="tab"
            id={`github-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`github-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`github-panel-${tab}`}
        aria-labelledby={`github-tab-${tab}`}
      >
        <ErrorNote error={error} />
        {VERSION_TABS.has(tab) &&
          (project.githubRepository ? (
            <VersionControl
              projectId={project._id}
              fullName={project.githubRepository}
              active={active}
              attempt={attempt}
              section={tab as VersionSection}
            />
          ) : (
            <p className="empty-notice">
              Link a repository to see its branches, languages, contributors,
              and commit history.
            </p>
          ))}
        {tab === "events" && (
          <EventsPanel
            linked={Boolean(project.githubRepository)}
            loading={loading}
            events={events}
            eventFilter={eventFilter}
            onFilter={setEventFilter}
            deliveries={deliveries}
          />
        )}
        {tab === "pulls" && (
          <PullsPanel
            linked={Boolean(project.githubRepository)}
            loading={loading}
            pending={pending}
            pulls={pulls}
            checkForm={checkForm}
            setCheckForm={setCheckForm}
            onPublish={publishCheck}
          />
        )}
      </div>
    </section>
  );
}

function EventsPanel({
  linked,
  loading,
  events,
  eventFilter,
  onFilter,
  deliveries,
}: {
  linked: boolean;
  loading: boolean;
  events: string[];
  eventFilter: string;
  onFilter: (value: string) => void;
  deliveries: GithubDelivery[];
}) {
  if (!linked) {
    return (
      <p className="empty-notice">
        Link a repository to see its GitHub deliveries.
      </p>
    );
  }
  return (
    <>
      <Field label="Event">
        <select
          value={eventFilter}
          onChange={(event) => onFilter(event.target.value)}
        >
          <option value="">All events</option>
          {events.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      {loading && <p role="status">Loading GitHub deliveries…</p>}
      {!loading && !deliveries.length && (
        <p className="empty-notice">No deliveries yet for this repository.</p>
      )}
      <ol className="discussion-list activity-list">
        {deliveries.map((delivery) => (
          <li key={delivery._id}>
            <header>
              <span>
                <strong>{delivery.event}</strong>
                {delivery.action ? ` ${delivery.action}` : ""}
              </span>
              <time dateTime={delivery.receivedOn}>
                {new Date(delivery.receivedOn).toLocaleString()}
              </time>
            </header>
            <p>{delivery.detail || delivery.repository}</p>
          </li>
        ))}
      </ol>
    </>
  );
}

function PullsPanel({
  linked,
  loading,
  pending,
  pulls,
  checkForm,
  setCheckForm,
  onPublish,
}: {
  linked: boolean;
  loading: boolean;
  pending: boolean;
  pulls: GithubPullRequest[];
  checkForm: GithubCheckForm;
  setCheckForm: Dispatch<SetStateAction<GithubCheckForm>>;
  onPublish: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!linked) {
    return (
      <p className="empty-notice">
        Link a repository to see open pull requests.
      </p>
    );
  }
  return (
    <>
      {loading && <p role="status">Loading pull requests…</p>}
      {!loading && !pulls.length ? (
        <p className="empty-notice">No open pull requests.</p>
      ) : (
        <ul className="list">
          {pulls.map((pull) => (
            <li key={pull.number}>
              <span>
                #{pull.number} {pull.title}{" "}
                <span className="meta">{pull.author}</span>
              </span>
              <a href={pull.url}>View</a>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onPublish}>
        <fieldset className="stack" disabled={loading || pending}>
          <p className="eyebrow">Check run</p>
          <Field label="Check name">
            <input
              value={checkForm.name}
              onChange={(event) =>
                setCheckForm({ ...checkForm, name: event.target.value })
              }
              required
            />
          </Field>
          <Field label="Commit SHA">
            <input
              value={checkForm.headSha}
              onChange={(event) =>
                setCheckForm({ ...checkForm, headSha: event.target.value })
              }
              required
            />
          </Field>
          <Field label="Status">
            <select
              value={checkForm.status}
              onChange={(event) =>
                setCheckForm({
                  ...checkForm,
                  status: event.target.value as GithubCheckStatus,
                })
              }
            >
              <option value="queued">queued</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
            </select>
          </Field>
          {checkForm.status === "completed" && (
            <Field label="Conclusion">
              <select
                value={checkForm.conclusion}
                onChange={(event) =>
                  setCheckForm({
                    ...checkForm,
                    conclusion: event.target.value,
                  })
                }
              >
                {[
                  "success",
                  "failure",
                  "neutral",
                  "cancelled",
                  "skipped",
                ].map((conclusion) => (
                  <option key={conclusion} value={conclusion}>
                    {conclusion}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Summary">
            <textarea
              value={checkForm.summary}
              onChange={(event) =>
                setCheckForm({ ...checkForm, summary: event.target.value })
              }
            />
          </Field>
          <button type="submit">Publish check</button>
        </fieldset>
      </form>
    </>
  );
}

export const GITHUB_WEBHOOK_EVENTS = [
  "installation_target",
  "meta",
  "security_advisory",
  "check_run",
  "check_suite",
  "commit_comment",
  "create",
  "delete",
  "fork",
  "gollum",
  "label",
  "milestone",
  "merge_queue_entry",
  "public",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "push",
  "release",
  "repository",
  "repository_dispatch",
  "star",
  "watch",
  "workflow_dispatch",
  "workflow_job",
  "workflow_run",
] as const;

export type GithubWebhookEvent = (typeof GITHUB_WEBHOOK_EVENTS)[number];

export interface GithubDeliverySummary {
  event: string;
  action: string | null;
  repository: string | null;
  installationId: number | null;
  detail: string | null;
}

export function describeGithubDelivery(
  event: string,
  payload: unknown,
): GithubDeliverySummary {
  const record = asRecord(payload);
  return {
    event,
    action: text(record.action),
    repository: repositoryName(record),
    installationId: installationId(record),
    detail: clip(detailFor(event, record)),
  };
}

function detailFor(event: string, record: Record<string, unknown>): string | null {
  const pull = asRecord(record.pull_request);
  const review = asRecord(record.review);
  const comment = asRecord(record.comment);
  const checkRun = asRecord(record.check_run);
  const checkSuite = asRecord(record.check_suite);
  const release = asRecord(record.release);
  const workflowJob = asRecord(record.workflow_job);
  const workflowRun = asRecord(record.workflow_run);
  const label = asRecord(record.label);
  const milestone = asRecord(record.milestone);
  const advisory = asRecord(record.security_advisory);
  const forkee = asRecord(record.forkee);
  const pages = Array.isArray(record.pages) ? asRecord(record.pages[0]) : null;

  switch (event) {
    case "pull_request":
      return join(numberLabel(pull.number), text(pull.title));
    case "pull_request_review":
      return join(numberLabel(pull.number), text(review.state));
    case "pull_request_review_comment":
      return join(numberLabel(pull.number), text(comment.path));
    case "pull_request_review_thread":
      return numberLabel(pull.number);
    case "push":
      return join(
        text(record.ref),
        Array.isArray(record.commits)
          ? `${record.commits.length} commits`
          : null,
      );
    case "check_run":
      return join(text(checkRun.name), text(checkRun.status), text(checkRun.conclusion));
    case "check_suite":
      return join(text(checkSuite.status), text(checkSuite.conclusion));
    case "commit_comment":
      return join(shortSha(text(comment.commit_id)), firstLine(text(comment.body)));
    case "create":
    case "delete":
      return join(text(record.ref_type), text(record.ref));
    case "release":
      return text(release.tag_name) || text(release.name);
    case "fork":
      return text(forkee.full_name);
    case "label":
      return text(label.name);
    case "milestone":
      return text(milestone.title);
    case "merge_queue_entry":
      return numberLabel(pull.number);
    case "gollum":
      return text(pages?.page_name) || text(pages?.title);
    case "repository_dispatch":
      return text(record.event_type) || text(record.action);
    case "workflow_dispatch":
      return text(record.workflow);
    case "workflow_job":
      return join(text(workflowJob.name), text(workflowJob.status), text(workflowJob.conclusion));
    case "workflow_run":
      return join(text(workflowRun.name), text(workflowRun.status), text(workflowRun.conclusion));
    case "security_advisory":
      return text(advisory.summary) || text(advisory.ghsa_id);
    case "star":
    case "watch":
    case "public":
    case "repository":
    case "meta":
    case "installation_target":
      return text(record.action);
    default:
      return null;
  }
}

function repositoryName(record: Record<string, unknown>): string | null {
  const repository = asRecord(record.repository);
  return text(repository.full_name);
}

function installationId(record: Record<string, unknown>): number | null {
  const installation = asRecord(record.installation);
  return typeof installation.id === "number" ? installation.id : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberLabel(value: unknown): string | null {
  return typeof value === "number" ? `#${value}` : null;
}

function shortSha(value: string | null): string | null {
  return value ? value.slice(0, 7) : null;
}

function firstLine(value: string | null): string | null {
  return value ? value.split("\n")[0] : null;
}

function join(...parts: Array<string | null>): string | null {
  const present = parts.filter((part): part is string => Boolean(part));
  return present.length ? present.join(" · ") : null;
}

function clip(value: string | null): string | null {
  if (!value) return null;
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

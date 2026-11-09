import { httpError } from "./errors.js";
import {
  githubGraphql,
  githubInstallationRead,
  installationAccessToken,
} from "./githubApp.js";

const BRANCH_SCAN = 100;
const ACTIVE_BRANCHES = 12;

const BRANCH_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    refs(refPrefix: "refs/heads/", first: ${BRANCH_SCAN}) {
      pageInfo { hasNextPage }
      nodes {
        name
        target {
          oid
          ... on Commit {
            committedDate
            messageHeadline
            author { name user { login } }
          }
        }
      }
    }
  }
}`;

export interface RepositorySnapshot {
  repository: {
    fullName: string;
    description: string | null;
    visibility: "public" | "private";
    defaultBranch: string | null;
    url: string | null;
    homepage: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    language: string | null;
    license: string | null;
    archived: boolean;
    pushedAt: string | null;
    createdAt: string | null;
  };
  languages: Array<{ name: string; bytes: number; share: number }>;
  contributors: Array<{
    login: string;
    contributions: number;
    url: string | null;
  }>;
  contributorsReady: boolean;
  branches: Array<{
    name: string;
    sha: string | null;
    protected: boolean;
    default: boolean;
    committedAt: string | null;
    message: string | null;
    author: string | null;
  }>;
  branchesTruncated: boolean;
  commits: Array<{
    sha: string;
    message: string;
    author: string | null;
    date: string | null;
    url: string | null;
  }>;
}

type BranchQuery = {
  data?: {
    repository?: {
      refs?: {
        pageInfo?: { hasNextPage?: boolean };
        nodes?: Array<{
          name?: string | null;
          target?: {
            oid?: string | null;
            committedDate?: string | null;
            messageHeadline?: string | null;
            author?: {
              name?: string | null;
              user?: { login?: string | null } | null;
            } | null;
          } | null;
        } | null> | null;
      } | null;
    } | null;
  } | null;
};

export async function loadRepositorySnapshot(
  installationId: number,
  owner: string,
  repo: string,
): Promise<RepositorySnapshot> {
  const token = await installationAccessToken(installationId);
  const base = `/repos/${owner}/${repo}`;
  const [repository, languages, contributors, commits, branches, graphql] =
    await Promise.all([
      githubInstallationRead(token, base),
      githubInstallationRead(token, `${base}/languages`),
      githubInstallationRead(token, `${base}/contributors?per_page=12`),
      githubInstallationRead(token, `${base}/commits?per_page=20`),
      githubInstallationRead(token, `${base}/branches?per_page=${BRANCH_SCAN}`),
      githubGraphql<BranchQuery>(token, BRANCH_QUERY, { owner, name: repo }),
    ]);

  const record = asRecord(repository.body);
  if (!record) throw httpError(502, "GitHub request failed");
  const defaultBranch = text(record.default_branch);
  const protection = branchProtection(branches.body);
  const refs = graphql.data?.repository?.refs;
  if (!refs) throw httpError(502, "GitHub request failed");
  const ranked = rankBranches(refs.nodes ?? [], protection, defaultBranch);
  const active = ranked.slice(0, ACTIVE_BRANCHES);
  if (
    defaultBranch &&
    !active.some((branch) => branch.name === defaultBranch)
  ) {
    const fallback = ranked.find((branch) => branch.name === defaultBranch) ?? {
      name: defaultBranch,
      sha: null,
      protected: protection.get(defaultBranch) ?? false,
      default: true,
      committedAt: null,
      message: null,
      author: null,
    };
    active.splice(ACTIVE_BRANCHES - 1, 1, fallback);
  }

  const contributorState = contributorList(contributors);
  return {
    repository: {
      fullName: text(record.full_name) || `${owner}/${repo}`,
      description: text(record.description),
      visibility: record.private === true ? "private" : "public",
      defaultBranch,
      url: text(record.html_url),
      homepage: text(record.homepage),
      stars: count(record.stargazers_count),
      forks: count(record.forks_count),
      openIssues: count(record.open_issues_count),
      language: text(record.language),
      license: text(asRecord(record.license)?.name),
      archived: record.archived === true,
      pushedAt: text(record.pushed_at),
      createdAt: text(record.created_at),
    },
    languages: languageShares(languages.body),
    ...contributorState,
    branches: active,
    branchesTruncated:
      Boolean(refs.pageInfo?.hasNextPage) || ranked.length > active.length,
    commits: commitHistory(commits.body),
  };
}

function rankBranches(
  nodes: NonNullable<
    NonNullable<NonNullable<BranchQuery["data"]>["repository"]>["refs"]
  >["nodes"],
  protection: Map<string, boolean>,
  defaultBranch: string | null,
) {
  const branches = (nodes ?? []).flatMap((node) => {
    if (!node || typeof node.name !== "string" || !node.name) return [];
    const target = node.target;
    const login = text(target?.author?.user?.login);
    const name = text(target?.author?.name);
    return [
      {
        name: node.name,
        sha: text(target?.oid),
        protected: protection.get(node.name) ?? false,
        default: node.name === defaultBranch,
        committedAt: text(target?.committedDate),
        message: clip(text(target?.messageHeadline) || ""),
        author: login || name,
      },
    ];
  });
  return branches.sort((left, right) => {
    const leftTime = left.committedAt ? Date.parse(left.committedAt) : 0;
    const rightTime = right.committedAt ? Date.parse(right.committedAt) : 0;
    return (Number.isNaN(rightTime) ? 0 : rightTime) -
      (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

function branchProtection(body: unknown): Map<string, boolean> {
  if (!Array.isArray(body)) throw httpError(502, "GitHub request failed");
  const protection = new Map<string, boolean>();
  for (const entry of body) {
    const branch = asRecord(entry);
    const name = text(branch?.name);
    if (!name) continue;
    protection.set(name, branch?.protected === true);
  }
  return protection;
}

function languageShares(body: unknown) {
  const record = asRecord(body) ?? {};
  const entries = Object.entries(record).flatMap(([name, bytes]) =>
    typeof bytes === "number" && bytes >= 0 ? [[name, bytes] as const] : [],
  );
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  return entries
    .sort((left, right) => right[1] - left[1])
    .map(([name, bytes]) => ({
      name,
      bytes,
      share: total ? Math.round((bytes / total) * 100) : 0,
    }));
}

function contributorList(read: { status: number; body: unknown }): {
  contributors: RepositorySnapshot["contributors"];
  contributorsReady: boolean;
} {
  if (read.status === 202) return { contributors: [], contributorsReady: false };
  if (!Array.isArray(read.body)) throw httpError(502, "GitHub request failed");
  return {
    contributorsReady: true,
    contributors: read.body.flatMap((entry) => {
      const person = asRecord(entry);
      const login = text(person?.login);
      if (!login) return [];
      return [
        {
          login,
          contributions: count(person?.contributions),
          url: text(person?.html_url),
        },
      ];
    }),
  };
}

function commitHistory(body: unknown): RepositorySnapshot["commits"] {
  if (!Array.isArray(body)) throw httpError(502, "GitHub request failed");
  return body.flatMap((entry) => {
    const commit = asRecord(entry);
    const sha = text(commit?.sha);
    const detail = asRecord(commit?.commit);
    const author = asRecord(detail?.author);
    const account = asRecord(commit?.author);
    if (!sha || !detail) return [];
    const message = clip(text(detail.message) || "");
    if (!message) return [];
    return [
      {
        sha,
        message,
        author: text(account?.login) || text(author?.name),
        date: text(author?.date),
        url: text(commit?.html_url),
      },
    ];
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clip(value: string): string | null {
  const line = value.split("\n")[0]?.trim() ?? "";
  if (!line) return null;
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

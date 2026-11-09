import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { httpError } from "./errors.js";

export interface AccessibleRepository {
  fullName: string;
  installationId: number;
}

const GITHUB_API = "https://api.github.com";

export async function listAccessibleRepositories(): Promise<
  AccessibleRepository[]
> {
  const token = appToken();
  const installations = await githubJson<Array<{ id?: number }>>(
    `${GITHUB_API}/app/installations`,
    token,
  );
  const repositories: AccessibleRepository[] = [];
  for (const installation of installations) {
    if (typeof installation.id !== "number") continue;
    const access = await githubJson<{ token?: string }>(
      `${GITHUB_API}/app/installations/${installation.id}/access_tokens`,
      token,
      "POST",
    );
    if (!access.token) continue;
    const page = await githubJson<{
      repositories?: Array<{ full_name?: string }>;
    }>(
      `${GITHUB_API}/installation/repositories?per_page=100`,
      access.token,
    );
    for (const repository of page.repositories ?? []) {
      if (typeof repository.full_name !== "string") continue;
      repositories.push({
        fullName: repository.full_name,
        installationId: installation.id,
      });
    }
  }
  return repositories;
}

export async function findAccessibleRepository(
  fullName: string,
): Promise<AccessibleRepository> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    throw httpError(400, "githubRepository must be owner/name");
  }
  const match = (await listAccessibleRepositories()).find(
    (repository) => repository.fullName === fullName,
  );
  if (!match) {
    throw httpError(400, "That repository is not available to the GitHub App");
  }
  return match;
}

export async function githubAppSlug(): Promise<string | null> {
  const app = await githubJson<{ slug?: string }>(`${GITHUB_API}/app`, appToken());
  return typeof app.slug === "string" ? app.slug : null;
}

function appToken(): string {
  const appId = process.env.GITHUB_APP_ID;
  const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (!appId || !keyPath) {
    throw httpError(500, "GitHub App credentials are missing");
  }
  let key: string;
  try {
    key = readFileSync(keyPath, "utf8");
  } catch {
    throw httpError(500, "GitHub App private key could not be read");
  }
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({ iat: now - 60, exp: now + 540, iss: appId }, key, {
    algorithm: "RS256",
  });
}

function githubHeaders(token: string, jsonBody = false): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "checkpoint-github-app",
    ...(jsonBody ? { "Content-Type": "application/json" } : {}),
  };
}

async function githubJson<T>(
  url: string,
  token: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: githubHeaders(token, body !== undefined),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw httpError(502, "GitHub request failed");
  return (await response.json()) as T;
}

export async function installationAccessToken(
  installationId: number,
): Promise<string> {
  const access = await githubJson<{ token?: string }>(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    appToken(),
    "POST",
  );
  if (!access.token) throw httpError(502, "GitHub request failed");
  return access.token;
}

export async function githubInstallationRequest<T>(
  installationId: number,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = await installationAccessToken(installationId);
  return githubJson<T>(`${GITHUB_API}${path}`, token, method, body);
}

export async function githubInstallationRead(
  token: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(token),
  });
  if (response.status !== 202 && !response.ok) {
    throw httpError(502, "GitHub request failed");
  }
  const text = await response.text();
  if (!text) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    throw httpError(502, "GitHub request failed");
  }
}

export async function githubGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: githubHeaders(token, true),
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw httpError(502, "GitHub request failed");
  return (await response.json()) as T;
}

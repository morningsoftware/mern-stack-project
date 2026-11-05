import jwt from "jsonwebtoken";
import type { Db, ObjectId } from "mongodb";
import { httpError } from "./errors.js";
import { githubAppSlug, type AccessibleRepository } from "./githubApp.js";
import type { UserDocument } from "./schema.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_OAUTH = "https://github.com/login/oauth";

export interface GithubAccount {
  connected: boolean;
  login: string | null;
  oauthConfigured: boolean;
  callbackUrl: string;
  installUrl: string | null;
  repositories: AccessibleRepository[];
}

export function githubOauthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function githubCallbackUrl(): string {
  return (
    process.env.GITHUB_REDIRECT_URI ||
    "http://127.0.0.1:4000/api/github/callback"
  );
}

export function safeReturnTarget(value: unknown): string {
  const fallback = `${process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173"}/#/teams`;
  if (typeof value !== "string" || !value) return fallback;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fallback;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return fallback;
  return `${url.origin}${url.pathname}${url.search}${url.hash}`;
}

export function githubAuthorizeUrl(userId: string, returnTo: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.JWT_SECRET;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
    throw httpError(503, "GitHub OAuth is not configured on the server");
  }
  if (!secret) throw httpError(500, "JWT_SECRET is not set");
  const state = jwt.sign(
    { purpose: "github-connect", sub: userId, returnTo },
    secret,
    { expiresIn: "10m" },
  );
  const url = new URL(`${GITHUB_OAUTH}/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", githubCallbackUrl());
  url.searchParams.set("state", state);
  return url.toString();
}

export function githubConnectState(state: unknown): {
  userId: string;
  returnTo: string;
} {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "JWT_SECRET is not set");
  if (typeof state !== "string" || !state) {
    throw httpError(400, "Missing GitHub OAuth state");
  }
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(state, secret);
    if (typeof verified === "string") throw new Error("state");
    payload = verified;
  } catch {
    throw httpError(400, "GitHub OAuth state is invalid");
  }
  if (payload.purpose !== "github-connect" || typeof payload.sub !== "string") {
    throw httpError(400, "GitHub OAuth state is invalid");
  }
  return {
    userId: payload.sub,
    returnTo: safeReturnTarget(payload.returnTo),
  };
}

export async function githubAccountForUser(
  db: Db,
  userId: ObjectId,
): Promise<GithubAccount> {
  const oauthConfigured = githubOauthConfigured();
  const callbackUrl = githubCallbackUrl();
  const user = await db.collection<UserDocument>("users").findOne({ _id: userId });
  if (!user?.githubAccessToken) {
    return {
      connected: false,
      login: null,
      oauthConfigured,
      callbackUrl,
      installUrl: null,
      repositories: [],
    };
  }
  try {
    const token = await currentAccessToken(db, user);
    const repositories = await repositoriesForToken(token);
    return {
      connected: true,
      login: user.githubLogin || null,
      oauthConfigured,
      callbackUrl,
      installUrl: repositories.length ? null : await installationUrl(),
      repositories,
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      await clearGithubConnection(db, userId);
      return {
        connected: false,
        login: null,
        oauthConfigured,
        callbackUrl,
        installUrl: null,
        repositories: [],
      };
    }
    throw error;
  }
}

export async function connectGithubAccount(
  db: Db,
  userId: ObjectId,
  code: string,
): Promise<void> {
  const access = await oauthToken({ code });
  const profile = await githubUserJson<{ login?: string; id?: number }>(
    `${GITHUB_API}/user`,
    access.access_token,
  );
  if (!profile.login || typeof profile.id !== "number") {
    throw httpError(502, "GitHub request failed");
  }
  await db.collection<UserDocument>("users").updateOne(
    { _id: userId },
    {
      $set: {
        githubLogin: profile.login,
        githubUserId: profile.id,
        ...storedToken(access),
      },
    },
  );
}

async function currentAccessToken(db: Db, user: UserDocument): Promise<string> {
  const expires = user.githubTokenExpiresAt
    ? new Date(user.githubTokenExpiresAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (!user.githubAccessToken) throw httpError(401, "GitHub rejected the connection");
  if (expires > Date.now() + 60_000) return user.githubAccessToken;
  if (!user.githubRefreshToken) throw httpError(401, "GitHub rejected the connection");
  const access = await oauthToken({ refreshToken: user.githubRefreshToken });
  await db.collection<UserDocument>("users").updateOne(
    { _id: user._id },
    { $set: storedToken(access) },
  );
  return access.access_token;
}

async function repositoriesForToken(token: string): Promise<AccessibleRepository[]> {
  const page = await githubUserJson<{
    installations?: Array<{ id?: number }>;
  }>(`${GITHUB_API}/user/installations`, token);
  const repositories: AccessibleRepository[] = [];
  for (const installation of page.installations ?? []) {
    if (typeof installation.id !== "number") continue;
    const listed = await githubUserJson<{
      repositories?: Array<{ full_name?: string }>;
    }>(
      `${GITHUB_API}/user/installations/${installation.id}/repositories?per_page=100`,
      token,
    );
    for (const repository of listed.repositories ?? []) {
      if (typeof repository.full_name !== "string") continue;
      repositories.push({
        fullName: repository.full_name,
        installationId: installation.id,
      });
    }
  }
  return repositories;
}

async function installationUrl(): Promise<string | null> {
  try {
    const slug = await githubAppSlug();
    return slug ? `https://github.com/apps/${slug}/installations/new` : null;
  } catch {
    return null;
  }
}

async function clearGithubConnection(db: Db, userId: ObjectId): Promise<void> {
  await db.collection<UserDocument>("users").updateOne(
    { _id: userId },
    {
      $unset: {
        githubLogin: "",
        githubUserId: "",
        githubAccessToken: "",
        githubRefreshToken: "",
        githubTokenExpiresAt: "",
      },
    },
  );
}

type GithubAccess = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

async function oauthToken(
  input: { code: string } | { refreshToken: string },
): Promise<GithubAccess> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw httpError(503, "GitHub OAuth is not configured on the server");
  }
  const body =
    "code" in input
      ? {
          client_id: clientId,
          client_secret: clientSecret,
          code: input.code,
          redirect_uri: githubCallbackUrl(),
        }
      : {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: input.refreshToken,
        };
  const response = await fetch(`${GITHUB_OAUTH}/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | (GithubAccess & { error?: string })
    | null;
  if (!response.ok || !payload?.access_token) {
    throw httpError(401, "GitHub rejected the connection");
  }
  return payload;
}

function storedToken(access: GithubAccess) {
  return {
    githubAccessToken: access.access_token,
    githubRefreshToken: access.refresh_token ?? null,
    githubTokenExpiresAt: access.expires_in
      ? new Date(Date.now() + access.expires_in * 1000)
      : null,
  };
}

async function githubUserJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "checkpoint-github-app",
    },
  });
  if (response.status === 401) throw httpError(401, "GitHub rejected the connection");
  if (!response.ok) throw httpError(502, "GitHub request failed");
  return (await response.json()) as T;
}

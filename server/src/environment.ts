import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Normalize the pre-sign-in deployment without changing its .env on disk. */
export function prepareEnvironment(env: NodeJS.ProcessEnv): string[] {
  const messages: string[] = [];
  const legacyApp =
    !env.OAUTH_CALLBACK_BASE_URL?.trim() &&
    !env.GITHUB_APP_CLIENT_ID?.trim() &&
    !env.GITHUB_APP_CLIENT_SECRET?.trim() &&
    Boolean(env.GITHUB_CLIENT_ID?.trim() && env.GITHUB_CLIENT_SECRET?.trim()) &&
    Boolean(
      env.GITHUB_APP_ID?.trim() ||
      env.GITHUB_REDIRECT_URI?.endsWith("/api/github/callback")
    );

  if (legacyApp) {
    env.GITHUB_APP_CLIENT_ID = env.GITHUB_CLIENT_ID;
    env.GITHUB_APP_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;
    if (!env.GITHUB_APP_REDIRECT_URI && env.GITHUB_REDIRECT_URI) {
      env.GITHUB_APP_REDIRECT_URI = env.GITHUB_REDIRECT_URI;
    }
    // Those credentials belong to the App, not the new GitHub sign-in strategy.
    delete env.GITHUB_CLIENT_ID;
    delete env.GITHUB_CLIENT_SECRET;
    messages.push("Using legacy GitHub App credentials; migrate to GITHUB_APP_CLIENT_*.");
  }

  // This value comes from deployment configuration, never a request Host header.
  if (env.CHECKPOINT_PUBLIC_URL) {
    const publicUrl = new URL(env.CHECKPOINT_PUBLIC_URL);
    if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password) {
      throw new Error("CHECKPOINT_PUBLIC_URL must be an HTTP(S) URL without credentials");
    }
    env.CLIENT_ORIGIN ||= publicUrl.origin;
    env.OAUTH_CALLBACK_BASE_URL ||= publicUrl.origin;
  }
  return messages;
}

export function loadEnvironment(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  dotenv.config({ path: path.join(root, ".env"), quiet: true });
  dotenv.config({ quiet: true });
  for (const message of prepareEnvironment(process.env)) console.warn(message);
}

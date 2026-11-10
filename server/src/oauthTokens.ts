import crypto from "crypto";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_LOGIN_CODE_TTL_MS = 2 * 60 * 1000;
export const OAUTH_REGISTRATION_TTL_MS = 15 * 60 * 1000;
export const OAUTH_LINK_TTL_MS = 10 * 60 * 1000;

export function createOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function expiresFromNow(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

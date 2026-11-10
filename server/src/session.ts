import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { httpError } from "./errors.js";
import { createOpaqueToken } from "./oauthTokens.js";

export const SESSION_COOKIE = "mern_session";
export const CSRF_COOKIE = "mern_csrf";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function csrfSignature(value: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, "JWT_SECRET is not set");
  return crypto
    .createHmac("sha256", secret)
    .update(`csrf:${value}`)
    .digest("base64url");
}

// Signed double-submit token: a subdomain or sibling service cannot forge a
// matching cookie/header pair without the server secret.
function createCsrfToken(): string {
  const value = createOpaqueToken();
  return `${value}.${csrfSignature(value)}`;
}

function verifyCsrfToken(token: string): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) return false;
  const value = token.slice(0, separator);
  return safeEqual(token.slice(separator + 1), csrfSignature(value));
}

// The browser stores the JWT in an httpOnly cookie. A readable CSRF cookie is
// paired with it so cookie-authenticated mutations can prove same-origin intent.
export function setAuthCookies(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(true),
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
  });
  res.cookie(CSRF_COOKIE, createCsrfToken(), {
    ...cookieOptions(false),
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(true));
  res.clearCookie(CSRF_COOKIE, cookieOptions(false));
}

export type AuthSource = "bearer" | "cookie";

export function requestToken(req: Request): {
  token: string | null;
  source: AuthSource | null;
} {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return { token: match[1], source: "bearer" };

  const cookieToken = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (cookieToken) return { token: cookieToken, source: "cookie" };
  return { token: null, source: null };
}

export function assertCsrf(req: Request): void {
  if (SAFE_METHODS.has(req.method) || req.authMethod !== "cookie") return;

  const cookieToken = parseCookies(req.headers.cookie)[CSRF_COOKIE] || "";
  const headerToken = req.get("x-csrf-token") || "";
  if (
    !cookieToken ||
    !headerToken ||
    !verifyCsrfToken(cookieToken) ||
    !safeEqual(cookieToken, headerToken)
  ) {
    throw httpError(403, "Invalid CSRF token");
  }
}

function requestOrigin(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

function configuredClientOrigin(req: Request): string | null {
  const raw =
    req.app.locals.oauth?.clientOrigin ||
    process.env.CLIENT_ORIGIN?.trim() ||
    "";
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

// Reject browser mutations that did not originate from the configured client.
// Requests without an Origin header are non-browser callers (tests, CLI, server
// to server) and are left to the bearer-token path.
export function checkRequestOrigin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  const allowed = [configuredClientOrigin(req), requestOrigin(req)].filter(
    (value): value is string => Boolean(value)
  );
  if (!allowed.includes(origin)) {
    return next(httpError(403, "Request origin is not allowed"));
  }
  next();
}

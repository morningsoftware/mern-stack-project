import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import passport from "passport";
import { asyncRoute, httpError } from "../errors.js";
import { optionalAuth, requireAuth, signToken } from "../middleware/auth.js";
import { USER_ROLES, publicUser } from "../schema.js";
import { oneOf, passwordValue, requireString } from "../validate.js";
import {
  knownProvider,
  providerDefinition,
  providerEnabled,
} from "../oauth.js";
import {
  OAuthLinkError,
  OAuthProfileError,
  type OAuthUserDocument,
  completeLinkChallenge,
  completePendingRegistration,
  inspectPendingRegistration,
  linkProviderToUser,
  resolveOAuthIdentity,
  unlinkOAuthAccount,
} from "../oauthAccounts.js";
import { consumeLoginCode, createLoginCode } from "../oauthCodes.js";
import { setAuthCookies } from "../session.js";

export const oauthRouter = Router();

oauthRouter.use((req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "no-store");
  next();
});

function clientRedirect(
  req: Request,
  values: Record<string, string>
): string {
  const origin = req.app.locals.oauth?.clientOrigin as string | undefined;
  if (!origin) throw new Error("CLIENT_ORIGIN is not configured");
  const url = new URL("/", origin);
  url.hash = new URLSearchParams(values).toString();
  return url.toString();
}

function redirectToClient(
  req: Request,
  res: Response,
  values: Record<string, string>
): void {
  res.redirect(302, clientRedirect(req, values));
}

function redirectError(
  req: Request,
  res: Response,
  code: string,
  provider?: string
): void {
  redirectToClient(req, res, {
    oauth_error: code,
    ...(provider ? { provider } : {}),
  });
}

function callbackErrorCode(req: Request, info: any): string {
  if (req.query.error === "access_denied") return "cancelled";
  if (info?.code) return info.code;
  if (typeof info?.message === "string" && /state/i.test(info.message)) {
    return "state";
  }
  return "failed";
}

function logOAuthError(provider: string, error: unknown): void {
  console.error(
    `OAuth ${provider} failed:`,
    error instanceof Error ? error.message : "unknown error"
  );
}

oauthRouter.get("/providers", (req: Request, res: Response) => {
  res.json({ providers: req.app.locals.oauth?.providers || [] });
});

oauthRouter.post(
  "/exchange",
  asyncRoute(async (req: Request, res: Response) => {
    const code = requireString(req.body?.code, "code");
    if (code.length > 200) {
      throw httpError(401, "Invalid or expired sign-in link");
    }
    const record = await consumeLoginCode(req.app.locals.db, code);
    if (!record) {
      throw httpError(401, "Invalid or expired sign-in link");
    }
    const user = await req.app.locals.db
      .collection<OAuthUserDocument>("users")
      .findOne({ _id: record.userId });
    if (!user) {
      throw httpError(401, "Invalid or expired sign-in link");
    }
    const token = signToken(user._id);
    setAuthCookies(res, token);
    res.json({ token, user: publicUser(user) });
  })
);

oauthRouter.post(
  "/registration/inspect",
  asyncRoute(async (req: Request, res: Response) => {
    const code = requireString(req.body?.code, "code");
    if (code.length > 200) {
      throw httpError(401, "This sign-up link is invalid or has expired");
    }
    const registration = await inspectPendingRegistration(
      req.app.locals.db,
      code
    );
    if (!registration) {
      throw httpError(401, "This sign-up link is invalid or has expired");
    }
    res.json({ registration });
  })
);

oauthRouter.post(
  "/registration/complete",
  asyncRoute(async (req: Request, res: Response) => {
    const code = requireString(req.body?.code, "code");
    const username = requireString(req.body?.username, "username");
    const displayName = requireString(req.body?.displayName, "displayName");
    const role = oneOf(req.body?.role, USER_ROLES, "role");
    const user = await completePendingRegistration(req.app.locals.db, code, {
      username,
      displayName,
      role,
    });
    const token = signToken(user._id);
    setAuthCookies(res, token);
    res.json({ token, user: publicUser(user) });
  })
);

oauthRouter.post(
  "/link/complete",
  asyncRoute(async (req: Request, res: Response) => {
    const code = requireString(req.body?.code, "code");
    const password = passwordValue(req.body?.password, "password");
    let result;
    try {
      result = await completeLinkChallenge(req.app.locals.db, code, password);
    } catch (error) {
      if (error instanceof OAuthLinkError) {
        throw httpError(409, error.message);
      }
      throw error;
    }
    if (!result.ok) {
      throw httpError(401, result.message);
    }
    const token = signToken(result.user._id);
    setAuthCookies(res, token);
    res.json({
      token,
      user: publicUser(result.user),
    });
  })
);

oauthRouter.get(
  "/:provider/callback",
  (req: Request, res: Response, next: NextFunction) => {
    const provider = req.params.provider;
    if (!knownProvider(provider)) {
      return next(httpError(404, "Not found"));
    }
    if (!providerEnabled(req, provider)) {
      return next(
        httpError(
          503,
          `${providerDefinition(provider)?.label} sign-in is not configured`
        )
      );
    }

    passport.authenticate(
      provider,
      { session: false, state: true } as any,
      ((error: any, identity: any, info: any) => {
        if (error) {
          logOAuthError(provider, error);
          return redirectError(req, res, "provider_error", provider);
        }
        if (!identity) {
          return redirectError(
            req,
            res,
            callbackErrorCode(req, info),
            provider
          );
        }

        const linkUserId = req.oauthState?.linkUserId;
        if (linkUserId) {
          linkProviderToUser(req.app.locals.db, linkUserId, identity)
            .then(() => {
              redirectToClient(req, res, { oauth_linked: provider });
            })
            .catch((linkError: unknown) => {
              if (linkError instanceof OAuthLinkError) {
                return redirectError(req, res, linkError.code, provider);
              }
              logOAuthError(provider, linkError);
              return redirectError(req, res, "failed", provider);
            });
          return;
        }

        resolveOAuthIdentity(req.app.locals.db, identity)
          .then(async (result) => {
            if (result.action === "login") {
              const code = await createLoginCode(
                req.app.locals.db,
                result.user._id,
                provider
              );
              redirectToClient(req, res, { oauth_code: code });
              return;
            }
            if (result.action === "register") {
              redirectToClient(req, res, { oauth_register: result.code });
              return;
            }
            redirectToClient(req, res, {
              oauth_link: result.code,
              provider,
            });
          })
          .catch((resolveError: unknown) => {
            if (
              resolveError instanceof OAuthProfileError ||
              resolveError instanceof OAuthLinkError
            ) {
              return redirectError(
                req,
                res,
                resolveError.code,
                provider
              );
            }
            logOAuthError(provider, resolveError);
            return redirectError(req, res, "failed", provider);
          });
      }) as any
    )(req, res, next);
  }
);

oauthRouter.get(
  "/:provider",
  optionalAuth,
  (req: Request, res: Response, next: NextFunction) => {
    const provider = req.params.provider;
    if (!knownProvider(provider)) {
      return next(httpError(404, "Not found"));
    }
    if (!providerEnabled(req, provider)) {
      return next(
        httpError(
          503,
          `${providerDefinition(provider)?.label} sign-in is not configured`
        )
      );
    }

    if (req.query.intent === "link") {
      if (!req.user) {
        return redirectError(req, res, "not_signed_in");
      }
      req.oauthLinkUserId = req.user._id;
    }

    passport.authenticate(provider, {
      session: false,
      state: true,
      scope: providerDefinition(provider)?.scopes,
    } as any)(req, res, next);
  }
);

oauthRouter.delete(
  "/:provider",
  requireAuth,
  asyncRoute(async (req: Request, res: Response) => {
    const provider = req.params.provider;
    if (!knownProvider(provider)) {
      throw httpError(404, "Not found");
    }

    const result = await unlinkOAuthAccount(
      req.app.locals.db,
      req.user!._id,
      provider
    );
    res.json({ ok: true, ...result });
  })
);

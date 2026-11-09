import type { Request } from "express";
import type { Db, ObjectId, WithId } from "mongodb";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { DiscordStrategy } from "./discordStrategy.js";
import { OAuthProfileError, normalizeOAuthProfile } from "./oauthAccounts.js";
import {
  OAUTH_STATE_TTL_MS,
  createOpaqueToken,
  expiresFromNow,
  hashToken,
} from "./oauthTokens.js";

export interface OAuthProviderDefinition {
  id: string;
  label: string;
  envPrefix: string;
  scopes: string[];
}

export const OAUTH_PROVIDERS = {
  google: {
    id: "google",
    label: "Google",
    envPrefix: "GOOGLE",
    scopes: ["profile", "email"],
  },
  github: {
    id: "github",
    label: "GitHub",
    envPrefix: "GITHUB",
    scopes: ["read:user", "user:email"],
  },
  discord: {
    id: "discord",
    label: "Discord",
    envPrefix: "DISCORD",
    scopes: ["identify", "email"],
  },
} as const satisfies Record<string, OAuthProviderDefinition>;

export type OAuthProviderId = keyof typeof OAUTH_PROVIDERS;

export interface EnabledOAuthProvider {
  id: string;
  label: string;
}

export interface OAuthConfig {
  providers: EnabledOAuthProvider[];
  enabledIds: string[];
  clientOrigin: string | null;
}

interface StateInfo {
  code: string;
  message: string;
}

interface OAuthStateDocument {
  _id: string;
  provider: string;
  codeVerifier: string | null;
  linkUserId: ObjectId | null;
  expiresAt: Date;
  createdAt: Date;
}

function providerFromRequest(req: Request): OAuthProviderId {
  const provider = req.params.provider;
  if (!provider || !Object.hasOwn(OAUTH_PROVIDERS, provider)) {
    throw new Error("Unknown OAuth provider");
  }
  return provider as OAuthProviderId;
}

export const mongoStateStore = {
  store(
    req: Request,
    verifier: string | undefined,
    _state: boolean | string,
    _meta: unknown,
    cb: (error: Error | null, state?: string) => void
  ): void {
    try {
      const provider = providerFromRequest(req);
      const db = req.app.locals.db as Db;
      if (!db) throw new Error("Database is not available");
      const rawState = createOpaqueToken();
      db.collection<OAuthStateDocument>("oauthStates")
        .insertOne({
          _id: hashToken(rawState),
          provider,
          codeVerifier: typeof verifier === "string" ? verifier : null,
          linkUserId: req.oauthLinkUserId || null,
          expiresAt: expiresFromNow(OAUTH_STATE_TTL_MS),
          createdAt: new Date(),
        })
        .then(() => cb(null, rawState), cb);
    } catch (error) {
      cb(error as Error);
    }
  },

  verify(
    req: Request,
    providedState: string | undefined,
    _meta: unknown,
    cb: (
      error: Error | null,
      ok?: string | boolean,
      info?: StateInfo
    ) => void
  ): void {
    try {
      const provider = providerFromRequest(req);
      if (typeof providedState !== "string" || !providedState) {
        return cb(null, false, {
          code: "state",
          message: "Unable to verify authorization request state.",
        });
      }
      const db = req.app.locals.db as Db;
      if (!db) throw new Error("Database is not available");
      db.collection<OAuthStateDocument>("oauthStates")
        .findOneAndDelete({
          _id: hashToken(providedState),
          provider,
          expiresAt: { $gt: new Date() },
        })
        .then((stateDoc: WithId<OAuthStateDocument> | null) => {
          if (!stateDoc) {
            return cb(null, false, {
              code: "state",
              message: "Unable to verify authorization request state.",
            });
          }
          req.oauthState = {
            provider,
            linkUserId: stateDoc.linkUserId || null,
          };
          return cb(null, stateDoc.codeVerifier || true);
        }, cb);
    } catch (error) {
      cb(error as Error);
    }
  },
};

function verifyCallback(provider: OAuthProviderId) {
  return (
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (error: Error | null, user?: any, info?: any) => void
  ): void => {
    try {
      const identity = normalizeOAuthProfile(provider, profile);
      done(null, identity);
    } catch (error) {
      if (error instanceof OAuthProfileError) {
        if (error.code === "email_unverified") {
          return done(null, false, {
            code: error.code,
            message: error.message,
          });
        }
        return done(error);
      }
      return done(error as Error);
    }
  };
}

function strategyOptions(
  provider: OAuthProviderId,
  clientID: string,
  clientSecret: string,
  callbackURL: string
): any {
  const options: any = {
    clientID,
    clientSecret,
    callbackURL,
    scope: OAUTH_PROVIDERS[provider].scopes,
    state: true,
    store: mongoStateStore,
    pkce: true,
  };
  if (provider === "github") {
    options.allRawEmails = true;
    options.userAgent = "mern-stack-project";
  }
  return options;
}

function registerStrategy(
  provider: OAuthProviderId,
  clientID: string,
  clientSecret: string,
  callbackURL: string
): void {
  const options = strategyOptions(
    provider,
    clientID,
    clientSecret,
    callbackURL
  );
  if (provider === "google") {
    passport.use(
      "google",
      new GoogleStrategy(options, verifyCallback("google"))
    );
  } else if (provider === "github") {
    passport.use(
      "github",
      new GitHubStrategy(options, verifyCallback("github"))
    );
  } else if (provider === "discord") {
    passport.use(
      "discord",
      new DiscordStrategy(options, verifyCallback("discord"))
    );
  }
}

function validOrigin(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  return url.origin;
}

export function configureOAuth(): OAuthConfig {
  const callbackBase = process.env.OAUTH_CALLBACK_BASE_URL?.trim();
  const clientOrigin = process.env.CLIENT_ORIGIN?.trim();
  const providers: EnabledOAuthProvider[] = [];

  for (const provider of Object.values(OAUTH_PROVIDERS)) {
    const clientID = process.env[`${provider.envPrefix}_CLIENT_ID`]?.trim();
    const clientSecret =
      process.env[`${provider.envPrefix}_CLIENT_SECRET`]?.trim();

    if (!clientID && !clientSecret) continue;
    if (!clientID || !clientSecret) {
      throw new Error(
        `${provider.label} OAuth requires both ${provider.envPrefix}_CLIENT_ID and ${provider.envPrefix}_CLIENT_SECRET`
      );
    }
    if (!callbackBase) {
      throw new Error(
        "OAUTH_CALLBACK_BASE_URL is required when OAuth is enabled"
      );
    }
    if (!clientOrigin) {
      throw new Error("CLIENT_ORIGIN is required when OAuth is enabled");
    }

    const publicBase = validOrigin(callbackBase, "OAUTH_CALLBACK_BASE_URL");
    const callbackURL = `${publicBase}/api/auth/oauth/${provider.id}/callback`;
    registerStrategy(
      provider.id as OAuthProviderId,
      clientID,
      clientSecret,
      callbackURL
    );
    providers.push({ id: provider.id, label: provider.label });
  }

  return {
    providers,
    enabledIds: providers.map((provider) => provider.id),
    clientOrigin: clientOrigin
      ? validOrigin(clientOrigin, "CLIENT_ORIGIN")
      : null,
  };
}

export function knownProvider(
  provider: string | undefined
): provider is OAuthProviderId {
  return (
    typeof provider === "string" && Object.hasOwn(OAUTH_PROVIDERS, provider)
  );
}

export function providerEnabled(req: Request, provider: string): boolean {
  return Boolean(req.app.locals.oauth?.enabledIds?.includes(provider));
}

export function providerDefinition(
  provider: string
): OAuthProviderDefinition | null {
  return knownProvider(provider) ? OAUTH_PROVIDERS[provider] : null;
}

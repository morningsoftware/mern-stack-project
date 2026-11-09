import OAuth2Strategy, { InternalOAuthError } from "passport-oauth2";

const AUTHORIZATION_URL = "https://discord.com/api/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const PROFILE_URL = "https://discord.com/api/users/@me";

interface DiscordProfile {
  provider: "discord";
  id: string;
  username?: string;
  global_name?: string;
  displayName?: string;
  email?: string;
  verified?: boolean;
  _json: Record<string, unknown>;
}

// Discord does not expose a Passport strategy in its own SDK. This keeps the
// integration on passport-oauth2 and validates the verified email field that
// the account-linking logic depends on.
export class DiscordStrategy extends OAuth2Strategy {
  constructor(options: any, verify: any) {
    super(
      {
        authorizationURL: AUTHORIZATION_URL,
        tokenURL: TOKEN_URL,
        scopeSeparator: " ",
        ...options,
      },
      verify
    );
    this.name = "discord";
    (this as any)._oauth2.useAuthorizationHeaderforGET(true);
  }

  userProfile(
    accessToken: string,
    done: (error: Error | null, profile?: DiscordProfile) => void
  ): void {
    (this as any)._oauth2.get(
      PROFILE_URL,
      accessToken,
      (error: Error | null, body: unknown) => {
        if (error) {
          return done(
            new InternalOAuthError("Failed to fetch Discord profile", error)
          );
        }
        let data: Record<string, any>;
        try {
          data =
            typeof body === "string"
              ? JSON.parse(body)
              : (body as Record<string, any>);
        } catch {
          return done(new Error("Failed to parse Discord profile"));
        }
        if (!data?.id) {
          return done(new Error("Discord profile did not include an id"));
        }
        return done(null, {
          provider: "discord",
          id: String(data.id),
          username: data.username,
          global_name: data.global_name,
          displayName: data.global_name || data.username,
          email: data.email,
          verified: data.verified,
          _json: data,
        });
      }
    );
  }
}

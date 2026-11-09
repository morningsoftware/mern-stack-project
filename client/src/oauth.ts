export interface OAuthFragment {
  loginCode: string | null;
  registrationCode: string | null;
  linkCode: string | null;
  linkedProvider: string | null;
  provider: string | null;
  error: string | null;
}

export type OAuthFlow =
  | { type: "register"; code: string }
  | { type: "link"; code: string; provider: string | null };

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

export function oauthProviderLabel(provider: string | null): string {
  return provider &&
    Object.prototype.hasOwnProperty.call(OAUTH_PROVIDER_LABELS, provider)
    ? OAUTH_PROVIDER_LABELS[provider]
    : "this provider";
}

export function oauthErrorMessage(code: string | null): string {
  switch (code) {
    case "cancelled":
      return "That sign-in was cancelled.";
    case "state":
      return "That sign-in link expired or was already used. Please try again.";
    case "email_unverified":
      return "The provider did not share a verified email address. Use a different account or sign in with your password.";
    case "not_signed_in":
      return "Sign in before linking a provider.";
    case "provider_in_use":
      return "That provider account is already linked to another user.";
    case "provider_already_linked":
      return "A different account from this provider is already linked. Unlink it first.";
    case "provider_error":
      return "The provider could not complete sign-in. Please try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export function readOAuthFragment(): OAuthFragment {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    loginCode: params.get("oauth_code"),
    registrationCode: params.get("oauth_register"),
    linkCode: params.get("oauth_link"),
    linkedProvider: params.get("oauth_linked"),
    provider: params.get("provider"),
    error: params.get("oauth_error"),
  };
}

export function clearOAuthFragment(): void {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

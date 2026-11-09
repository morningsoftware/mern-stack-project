import { ObjectId } from "mongodb";
import type { Db, WithId } from "mongodb";
import { httpError } from "./errors.js";
import { checkPassword } from "./middleware/auth.js";
import type { UserDocument, UserRole } from "./schema.js";
import {
  OAUTH_LINK_TTL_MS,
  OAUTH_REGISTRATION_TTL_MS,
  createOpaqueToken,
  expiresFromNow,
  hashToken,
} from "./oauthTokens.js";

const MAX_LINK_ATTEMPTS = 5;

export interface OAuthAccount {
  provider: string;
  providerId: string;
  email: string;
  linkedOn: Date;
}

export interface OAuthUserDocument extends UserDocument {
  emailVerified?: boolean;
  oauthAccounts?: OAuthAccount[];
}

export class OAuthProfileError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class OAuthLinkError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface RawEmail {
  value?: string;
  email?: string;
  verified?: boolean;
  primary?: boolean;
}

export interface RawOAuthProfile {
  id?: string | number;
  displayName?: string;
  global_name?: string;
  username?: string;
  email?: string;
  verified?: boolean;
  emails?: RawEmail[];
}

export interface OAuthIdentity {
  provider: string;
  providerId: string;
  email: string;
  emailVerified: true;
  displayName: string;
  suggestedUsername: string;
}

interface PendingRegistrationDocument {
  _id: string;
  provider: string;
  providerId: string;
  email: string;
  displayName: string;
  suggestedUsername: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface OAuthRegistration {
  provider: string;
  email: string;
  displayName: string;
  suggestedUsername: string;
}

interface LinkChallengeDocument {
  _id: string;
  userId: ObjectId;
  provider: string;
  providerId: string;
  email: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

export type OAuthResolution =
  | { action: "login"; user: WithId<OAuthUserDocument> }
  | { action: "register"; code: string; registration: OAuthRegistration }
  | { action: "link"; code: string; provider: string };

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function verifiedEmail(entries: RawEmail[] | undefined): string {
  if (!Array.isArray(entries)) return "";
  const verified = entries.filter((entry) => entry?.verified === true);
  const primary = verified.find((entry) => entry.primary === true);
  const selected = primary || verified[0];
  return normalizeEmail(selected?.value || selected?.email);
}

export function usernameFromText(value: unknown): string {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return slug || "user";
}

function displayNameFor(profile: RawOAuthProfile): string {
  return (
    profile.displayName ||
    profile.global_name ||
    profile.username ||
    `user_${String(profile.id || "").slice(-6)}`
  );
}

export function normalizeOAuthProfile(
  provider: string,
  profile: RawOAuthProfile
): OAuthIdentity {
  let email = "";
  if (provider === "google" || provider === "github") {
    email = verifiedEmail(profile.emails);
  } else if (provider === "discord") {
    if (profile.verified === true) {
      email = normalizeEmail(profile.email);
    }
  } else {
    throw new OAuthProfileError("provider_error", "Unsupported OAuth provider");
  }

  if (!email || !email.includes("@")) {
    throw new OAuthProfileError(
      "email_unverified",
      "The provider did not return a verified email address"
    );
  }

  const providerId = profile.id === undefined ? "" : String(profile.id);
  if (!providerId) {
    throw new OAuthProfileError(
      "provider_error",
      "The provider did not return an account id"
    );
  }

  const displayName =
    String(displayNameFor(profile)).trim() || email.split("@")[0];
  return {
    provider,
    providerId,
    email,
    emailVerified: true,
    displayName,
    suggestedUsername: usernameFromText(displayName || email.split("@")[0]),
  };
}

export async function suggestUniqueUsername(
  db: Db,
  base: string
): Promise<string> {
  const users = db.collection<OAuthUserDocument>("users");
  const stem = usernameFromText(base).slice(0, 24) || "user";
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? stem : `${stem}_${attempt}`;
    const existing = await users.findOne(
      { username: candidate },
      { projection: { _id: 1 } }
    );
    if (!existing) return candidate;
  }
  return `${stem}_${createOpaqueToken().slice(0, 6)}`;
}

async function findLinkedUser(
  db: Db,
  identity: OAuthIdentity
): Promise<WithId<OAuthUserDocument> | null> {
  return db.collection<OAuthUserDocument>("users").findOne({
    oauthAccounts: {
      $elemMatch: {
        provider: identity.provider,
        providerId: identity.providerId,
      },
    },
  });
}

export async function linkOAuthAccount(
  db: Db,
  user: WithId<OAuthUserDocument>,
  identity: OAuthIdentity
): Promise<WithId<OAuthUserDocument>> {
  const users = db.collection<OAuthUserDocument>("users");
  const account: OAuthAccount = {
    provider: identity.provider,
    providerId: identity.providerId,
    email: identity.email,
    linkedOn: new Date(),
  };

  const accounts = Array.isArray(user.oauthAccounts) ? user.oauthAccounts : [];
  const alreadyLinked = accounts.some(
    (item) =>
      item.provider === identity.provider &&
      item.providerId === identity.providerId
  );
  const differentAccount = accounts.some(
    (item) =>
      item.provider === identity.provider &&
      item.providerId !== identity.providerId
  );
  if (differentAccount) {
    throw new OAuthLinkError(
      "provider_already_linked",
      "A different account from this provider is already linked"
    );
  }

  if (alreadyLinked) {
    await users.updateOne({ _id: user._id }, { $set: { emailVerified: true } });
  } else {
    try {
      await users.updateOne(
        { _id: user._id },
        {
          $push: { oauthAccounts: account },
          $set: { emailVerified: true },
        }
      );
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      const linked = await findLinkedUser(db, identity);
      if (linked && linked._id.equals(user._id)) return linked;
      if (linked) {
        throw new OAuthLinkError(
          "provider_in_use",
          "That provider account is already linked to another user"
        );
      }
      throw error;
    }
  }

  const linked = await users.findOne({ _id: user._id });
  if (!linked) throw httpError(404, "User not found");
  return linked;
}

// Links a provider from the account screen, where the user is already signed
// in and does not need to confirm a password again.
export async function linkProviderToUser(
  db: Db,
  userId: ObjectId,
  identity: OAuthIdentity
): Promise<WithId<OAuthUserDocument>> {
  const owner = await findLinkedUser(db, identity);
  if (owner && !owner._id.equals(userId)) {
    throw new OAuthLinkError(
      "provider_in_use",
      "That provider account is already linked to another user"
    );
  }

  const user = await db
    .collection<OAuthUserDocument>("users")
    .findOne({ _id: userId });
  if (!user) {
    throw new OAuthLinkError(
      "not_signed_in",
      "Sign in before linking a provider"
    );
  }
  return linkOAuthAccount(db, user, identity);
}

async function createPendingRegistration(
  db: Db,
  identity: OAuthIdentity
): Promise<{ code: string; registration: OAuthRegistration }> {
  const collection = db.collection<PendingRegistrationDocument>(
    "oauthPendingRegistrations"
  );
  const code = createOpaqueToken();
  const suggestedUsername = await suggestUniqueUsername(
    db,
    identity.suggestedUsername
  );

  await collection.deleteMany({
    provider: identity.provider,
    email: identity.email,
  });
  await collection.insertOne({
    _id: hashToken(code),
    provider: identity.provider,
    providerId: identity.providerId,
    email: identity.email,
    displayName: identity.displayName,
    suggestedUsername,
    expiresAt: expiresFromNow(OAUTH_REGISTRATION_TTL_MS),
    createdAt: new Date(),
  });

  return {
    code,
    registration: {
      provider: identity.provider,
      email: identity.email,
      displayName: identity.displayName,
      suggestedUsername,
    },
  };
}

export async function inspectPendingRegistration(
  db: Db,
  code: string
): Promise<OAuthRegistration | null> {
  const pending = await db
    .collection<PendingRegistrationDocument>("oauthPendingRegistrations")
    .findOne({
      _id: hashToken(code),
      expiresAt: { $gt: new Date() },
    });
  if (!pending) return null;
  return {
    provider: pending.provider,
    email: pending.email,
    displayName: pending.displayName,
    suggestedUsername: pending.suggestedUsername,
  };
}

export async function completePendingRegistration(
  db: Db,
  code: string,
  {
    username,
    displayName,
    role,
  }: { username: string; displayName: string; role: UserRole }
): Promise<WithId<OAuthUserDocument>> {
  const collection = db.collection<PendingRegistrationDocument>(
    "oauthPendingRegistrations"
  );
  const pending = await collection.findOne({
    _id: hashToken(code),
    expiresAt: { $gt: new Date() },
  });
  if (!pending) {
    throw httpError(401, "This sign-up link is invalid or has expired");
  }

  const users = db.collection<OAuthUserDocument>("users");
  const existing = await users.findOne({
    $or: [{ username }, { email: pending.email }],
  });
  if (existing) {
    throw httpError(
      409,
      existing.email === pending.email
        ? "An account with this email already exists. Sign in instead."
        : "That username is already in use"
    );
  }

  const now = new Date();
  const doc = {
    _id: new ObjectId(),
    username,
    email: pending.email,
    displayName,
    role,
    emailVerified: true,
    oauthAccounts: [
      {
        provider: pending.provider,
        providerId: pending.providerId,
        email: pending.email,
        linkedOn: now,
      },
    ],
    createdOn: now,
    createdBy: null,
  };

  let result;
  try {
    result = await users.insertOne(doc);
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      throw httpError(409, "That username or email is already in use");
    }
    throw error;
  }

  await collection.deleteOne({ _id: pending._id });
  return { ...doc, _id: result.insertedId };
}

async function createLinkChallenge(
  db: Db,
  user: WithId<OAuthUserDocument>,
  identity: OAuthIdentity
): Promise<{ code: string }> {
  const collection = db.collection<LinkChallengeDocument>("oauthLinkChallenges");
  const code = createOpaqueToken();
  await collection.deleteMany({
    userId: user._id,
    provider: identity.provider,
  });
  await collection.insertOne({
    _id: hashToken(code),
    userId: user._id,
    provider: identity.provider,
    providerId: identity.providerId,
    email: identity.email,
    attempts: 0,
    expiresAt: expiresFromNow(OAUTH_LINK_TTL_MS),
    createdAt: new Date(),
  });
  return { code };
}

export type LinkChallengeResult =
  | { ok: true; user: WithId<OAuthUserDocument> }
  | { ok: false; message: string };

export async function completeLinkChallenge(
  db: Db,
  code: string,
  password: string
): Promise<LinkChallengeResult> {
  const collection = db.collection<LinkChallengeDocument>("oauthLinkChallenges");
  const challenge = await collection.findOneAndUpdate(
    {
      _id: hashToken(code),
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_LINK_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  );
  if (!challenge) {
    return { ok: false, message: "This link is invalid or has expired" };
  }

  const users = db.collection<OAuthUserDocument>("users");
  const user = await users.findOne({ _id: challenge.userId });
  if (!user || !user.passwordHash) {
    await collection.deleteOne({ _id: challenge._id });
    return { ok: false, message: "This link is invalid or has expired" };
  }

  if (!(await checkPassword(password, user.passwordHash))) {
    if (challenge.attempts >= MAX_LINK_ATTEMPTS) {
      await collection.deleteOne({ _id: challenge._id });
    }
    return { ok: false, message: "Incorrect password" };
  }

  const linked = await linkOAuthAccount(db, user, {
    provider: challenge.provider,
    providerId: challenge.providerId,
    email: challenge.email,
    emailVerified: true,
    displayName: user.displayName,
    suggestedUsername: usernameFromText(user.displayName),
  });
  await collection.deleteOne({ _id: challenge._id });
  return { ok: true, user: linked };
}

export async function resolveOAuthIdentity(
  db: Db,
  identity: OAuthIdentity
): Promise<OAuthResolution> {
  const linked = await findLinkedUser(db, identity);
  if (linked) return { action: "login", user: linked };

  const users = db.collection<OAuthUserDocument>("users");
  const byEmail = await users.findOne({ email: identity.email });
  if (!byEmail) {
    const pending = await createPendingRegistration(db, identity);
    return { action: "register", ...pending };
  }

  // A verified provider email or a passwordless account can link directly.
  // Password accounts must prove the existing password once before linking.
  if (byEmail.emailVerified === true || !byEmail.passwordHash) {
    const user = await linkOAuthAccount(db, byEmail, identity);
    return { action: "login", user };
  }

  const challenge = await createLinkChallenge(db, byEmail, identity);
  return { action: "link", ...challenge, provider: identity.provider };
}

export async function unlinkOAuthAccount(
  db: Db,
  userId: ObjectId,
  provider: string
): Promise<{ providers: OAuthAccount[]; hasPassword: boolean }> {
  const users = db.collection<OAuthUserDocument>("users");
  const user = await users.findOne({ _id: userId });
  if (!user) throw httpError(401, "Invalid or expired token");

  const accounts = Array.isArray(user.oauthAccounts) ? user.oauthAccounts : [];
  if (!accounts.some((account) => account.provider === provider)) {
    throw httpError(404, "That provider is not linked");
  }

  // The guard is part of the update filter so concurrent unlink requests cannot
  // both remove a provider and leave the account without a sign-in method.
  const updated = await users.findOneAndUpdate(
    {
      _id: userId,
      "oauthAccounts.provider": provider,
      $expr: {
        $or: [
          { $ne: [{ $type: "$passwordHash" }, "missing"] },
          { $gt: [{ $size: { $ifNull: ["$oauthAccounts", []] } }, 1] },
        ],
      },
    },
    { $pull: { oauthAccounts: { provider } } },
    { returnDocument: "after" }
  );

  if (!updated) {
    const current = await users.findOne({ _id: userId });
    if (!current) throw httpError(401, "Invalid or expired token");
    const currentAccounts = Array.isArray(current.oauthAccounts)
      ? current.oauthAccounts
      : [];
    if (!currentAccounts.some((account) => account.provider === provider)) {
      throw httpError(404, "That provider is not linked");
    }
    throw httpError(
      409,
      "Set a password before unlinking your last sign-in method"
    );
  }

  return {
    providers: updated.oauthAccounts || [],
    hasPassword: Boolean(updated.passwordHash),
  };
}

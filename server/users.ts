import type { AdminUserSummary, AppUser, AuthProvider, ProfileUpdate } from "../shared/contracts";
import { hasAdminRole } from "./admin-role";
import type { Bindings } from "./env";
import { HttpError } from "./errors";

interface RequestIdentity {
  email: string;
  authProvider: AuthProvider;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export async function resolveCurrentUser(request: Request, env: Bindings): Promise<AppUser> {
  const identity =
    env.AUTH_MODE === "local" ? getLocalIdentity(request, env) : getAccessIdentity(request);
  const row = await findOrCreateUser(identity.email, env.DB);
  return toAppUser(row, identity.authProvider, env);
}

export async function updateCurrentUserProfile(
  currentUser: AppUser,
  profile: ProfileUpdate,
  env: Bindings,
): Promise<AppUser> {
  const updatedAt = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE users
     SET display_name = ?, avatar_url = ?, timezone = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(profile.displayName, profile.avatarUrl, profile.timezone, updatedAt, currentUser.id)
    .run();

  if (result.meta.changes !== 1) {
    throw new HttpError(404, "user_not_found", "User not found.");
  }

  const row = await findUserById(currentUser.id, env.DB);
  return toAppUser(row, currentUser.authProvider, env);
}

export async function listUsers(env: Bindings): Promise<AdminUserSummary[]> {
  const result = await env.DB.prepare(
    `SELECT id, email, display_name, avatar_url, timezone, created_at, updated_at
     FROM users
     ORDER BY created_at DESC, email ASC`,
  ).all<UserRow>();

  return result.results.map((row) => ({
    ...toUserFields(row),
    isAdmin: hasAdminRole(row.email, env),
  }));
}

function getAccessIdentity(request: Request): RequestIdentity {
  const emailHeader = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!emailHeader) {
    throw new HttpError(
      401,
      "authentication_required",
      "A valid Cloudflare Access session is required.",
    );
  }

  return {
    email: normalizeEmail(emailHeader, "Cloudflare Access provided an invalid email address."),
    authProvider: "cloudflare-access",
  };
}

function getLocalIdentity(request: Request, env: Bindings): RequestIdentity {
  if (!isLocalRequest(request, env)) {
    throw new HttpError(
      401,
      "local_auth_forbidden",
      "Local authentication is available only on a loopback or explicitly allowed hostname.",
    );
  }

  const email = env.LOCAL_DEV_USER_EMAIL?.trim();
  if (!email) {
    throw new HttpError(
      401,
      "local_identity_not_configured",
      "Set LOCAL_DEV_USER_EMAIL to use local development authentication.",
    );
  }

  return {
    email: normalizeEmail(email, "LOCAL_DEV_USER_EMAIL must be a valid email address."),
    authProvider: "local-dev",
  };
}

function isLocalRequest(request: Request, env: Bindings): boolean {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }

  return (env.LOCAL_DEV_ALLOWED_HOSTS ?? "")
    .split(",")
    .some((allowedHostname) => allowedHostname.trim().toLowerCase() === hostname);
}

function normalizeEmail(email: string, invalidMessage: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new HttpError(401, "invalid_access_identity", invalidMessage);
  }
  return normalized;
}

async function findOrCreateUser(email: string, db: D1Database): Promise<UserRow> {
  const existing = await findUserByEmail(email, db);
  if (existing) return existing;

  const now = new Date().toISOString();
  await insertUser(crypto.randomUUID(), email, now, db);

  const created = await findUserByEmail(email, db);
  if (!created) {
    throw new Error("D1 did not return the user after insert.");
  }
  return created;
}

function insertUser(
  id: string,
  email: string,
  now: string,
  db: D1Database,
): Promise<D1Result<unknown>> {
  return db
    .prepare(
      `INSERT INTO users (
         id, email, display_name, avatar_url, timezone, created_at, updated_at
       )
       VALUES (?, ?, NULL, NULL, NULL, ?, ?)
       ON CONFLICT(email) DO NOTHING`,
    )
    .bind(id, email, now, now)
    .run();
}

function findUserByEmail(email: string, db: D1Database): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

async function findUserById(userId: string, db: D1Database): Promise<UserRow> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
  if (!row) {
    throw new HttpError(404, "user_not_found", "User not found.");
  }
  return row;
}

function toUserFields(row: UserRow): Omit<AdminUserSummary, "isAdmin"> {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAppUser(row: UserRow, authProvider: AuthProvider, env: Bindings): AppUser {
  return {
    ...toUserFields(row),
    authProvider,
    isAdmin: hasAdminRole(row.email, env),
  };
}

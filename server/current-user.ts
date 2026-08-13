import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from "jose";
import type { AppUser, AuthProvider, ProfileUpdate } from "../shared/contracts";
import type { Bindings } from "./env";
import { HttpError } from "./errors";
import { hasAdminRole } from "./admin-role";

interface VerifiedIdentity {
  subject: string;
  email: string;
  authProvider: AuthProvider;
}

interface UserRow {
  id: string;
  email: string;
  access_subject: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

type AccessJwtVerifier = (token: string, env: Bindings) => Promise<VerifiedIdentity>;

export interface CurrentUserModule {
  resolve(request: Request, env: Bindings): Promise<AppUser>;
  updateProfile(
    userId: string,
    profile: ProfileUpdate,
    authProvider: AuthProvider,
    env: Bindings,
  ): Promise<AppUser>;
}

const remoteJwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function createCurrentUserModule(
  verifyAccessJwt: AccessJwtVerifier = verifyCloudflareAccessJwt,
): CurrentUserModule {
  return {
    async resolve(request, env) {
      const identity =
        env.AUTH_MODE === "local"
          ? getLocalIdentity(request, env)
          : await getAccessIdentity(request, env, verifyAccessJwt);

      const row = await findOrCreateUser(identity, env.DB);
      return toAppUser(row, identity.authProvider, env);
    },

    async updateProfile(userId, profile, authProvider, env) {
      const updatedAt = new Date().toISOString();

      const result = await env.DB.prepare(
        `UPDATE users
         SET display_name = ?, avatar_url = ?, timezone = ?, updated_at = ?
         WHERE id = ?`,
      )
        .bind(profile.displayName, profile.avatarUrl, profile.timezone, updatedAt, userId)
        .run();

      if (result.meta.changes !== 1) {
        throw new HttpError(404, "user_not_found", "User not found.");
      }

      const row = await findUserById(userId, env.DB);
      return toAppUser(row, authProvider, env);
    },
  };
}

async function getAccessIdentity(
  request: Request,
  env: Bindings,
  verifyAccessJwt: AccessJwtVerifier,
): Promise<VerifiedIdentity> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) {
    throw new HttpError(
      401,
      "authentication_required",
      "A valid Cloudflare Access session is required.",
    );
  }

  return verifyAccessJwt(token, env);
}

async function verifyCloudflareAccessJwt(token: string, env: Bindings): Promise<VerifiedIdentity> {
  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = env.CF_ACCESS_AUD?.trim();

  if (!audience || audience.startsWith("replace-with-")) {
    throw new HttpError(500, "access_not_configured", "Cloudflare Access is not configured.");
  }

  const certsUrl = new URL("/cdn-cgi/access/certs", teamDomain).toString();
  let jwks = remoteJwksByUrl.get(certsUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(certsUrl));
    remoteJwksByUrl.set(certsUrl, jwks);
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      algorithms: ["RS256"],
      audience,
      issuer: teamDomain,
    }));
  } catch (error) {
    if (error instanceof joseErrors.JOSEError) {
      throw new HttpError(
        401,
        "invalid_access_token",
        "The Cloudflare Access session is invalid or expired.",
      );
    }
    throw error;
  }

  if (
    payload.type !== "app" ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.email !== "string" ||
    !payload.email
  ) {
    throw new HttpError(
      401,
      "invalid_access_identity",
      "Cloudflare Access did not provide a user identity.",
    );
  }

  return {
    subject: payload.sub,
    email: normalizeEmail(payload.email),
    authProvider: "cloudflare-access",
  };
}

function getLocalIdentity(request: Request, env: Bindings): VerifiedIdentity {
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

  const normalizedEmail = normalizeEmail(email);
  return {
    subject: `local:${normalizedEmail}`,
    email: normalizedEmail,
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

function normalizeTeamDomain(value: string | undefined): string {
  if (!value) {
    throw new HttpError(500, "access_not_configured", "Cloudflare Access is not configured.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(
      500,
      "access_not_configured",
      "CF_ACCESS_TEAM_DOMAIN must be a valid HTTPS URL.",
    );
  }

  if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com")) {
    throw new HttpError(
      500,
      "access_not_configured",
      "CF_ACCESS_TEAM_DOMAIN must be a Cloudflare Access team URL.",
    );
  }

  return url.origin;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new HttpError(
      401,
      "invalid_access_identity",
      "Cloudflare Access provided an invalid email address.",
    );
  }
  return normalized;
}

async function findOrCreateUser(identity: VerifiedIdentity, db: D1Database): Promise<UserRow> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO users (
         id, email, access_subject, display_name, avatar_url, timezone,
         created_at, updated_at
       )
       VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         access_subject = excluded.access_subject,
         updated_at = CASE
           WHEN users.access_subject <> excluded.access_subject
           THEN excluded.updated_at
           ELSE users.updated_at
         END`,
    )
    .bind(id, identity.email, identity.subject, now, now)
    .run();

  const row = await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(identity.email)
    .first<UserRow>();

  if (!row) {
    throw new Error("D1 did not return the user after upsert.");
  }
  return row;
}

async function findUserById(userId: string, db: D1Database): Promise<UserRow> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();

  if (!row) {
    throw new HttpError(404, "user_not_found", "User not found.");
  }
  return row;
}

function toAppUser(row: UserRow, authProvider: AuthProvider, env: Bindings): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authProvider,
    isAdmin: hasAdminRole(row.email, env),
  };
}

import type { AdminUserSummary } from "../shared/contracts";
import { hasAdminRole } from "./admin-role";
import type { Bindings } from "./env";

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUsersModule {
  list(env: Bindings): Promise<AdminUserSummary[]>;
}

export function createAdminUsersModule(): AdminUsersModule {
  return {
    async list(env) {
      const result = await env.DB.prepare(
        `SELECT
           id, email, display_name, avatar_url, timezone, created_at, updated_at
         FROM users
         ORDER BY created_at DESC, email ASC`,
      ).all<AdminUserRow>();

      return result.results.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        timezone: row.timezone,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isAdmin: hasAdminRole(row.email, env.ADMIN_EMAIL),
      }));
    },
  };
}

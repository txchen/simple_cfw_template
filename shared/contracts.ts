import type { ProfileUpdate } from "./profile";

export type { ProfileUpdate } from "./profile";

export type AuthProvider = "cloudflare-access" | "local-dev";

export interface AppUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
  authProvider: AuthProvider;
  isAdmin: boolean;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
  isAdmin: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Partial<Record<keyof ProfileUpdate, string>>;
  };
}

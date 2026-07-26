export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  ADMIN_EMAIL: string;
  AUTH_MODE: "access" | "local";
  LOCAL_DEV_USER_EMAIL?: string;
}

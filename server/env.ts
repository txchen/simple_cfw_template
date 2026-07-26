export interface Bindings {
  DB: D1Database;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  AUTH_MODE: "access" | "local";
  LOCAL_DEV_USER_EMAIL?: string;
}

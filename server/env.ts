export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_EMAILS?: string;
  ADMIN_EMAIL?: string;
  AUTH_MODE: "access" | "local";
  LOCAL_DEV_USER_EMAIL?: string;
  LOCAL_DEV_ALLOWED_HOSTS?: string;
}

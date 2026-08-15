import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../server/app";
import type { Bindings } from "../server/env";

const app = createApp();

describe("administrator", () => {
  it("lets every configured administrator manage users", async () => {
    const adminEmails = " developer@example.com, SECOND-PARENT@example.com, developer@example.com ";
    const familyEnv: Bindings = {
      ...env,
      LOCAL_DEV_USER_EMAIL: "family@example.com",
      ADMIN_EMAILS: adminEmails,
    };
    const firstAdminEnv: Bindings = { ...env, ADMIN_EMAILS: adminEmails };
    const secondAdminEnv: Bindings = {
      ...env,
      LOCAL_DEV_USER_EMAIL: "second-parent@example.com",
      ADMIN_EMAILS: adminEmails,
    };

    await app.request("http://localhost/api/me", {}, familyEnv);
    await app.request("http://localhost/api/me", {}, firstAdminEnv);
    await app.request("http://localhost/api/me", {}, secondAdminEnv);

    const response = await app.request("http://localhost/api/admin/users", {}, secondAdminEnv);
    expect(response.status).toBe(200);
    const body = await response.json<{
      users: Array<{ email: string; isAdmin: boolean }>;
    }>();
    expect(body.users).toHaveLength(3);
    expect(body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "developer@example.com", isAdmin: true }),
        expect.objectContaining({ email: "second-parent@example.com", isAdmin: true }),
        expect.objectContaining({ email: "family@example.com", isAdmin: false }),
      ]),
    );
  });

  it("rejects a non-administrator from the admin API and page", async () => {
    const familyEnv: Bindings = {
      ...env,
      LOCAL_DEV_USER_EMAIL: "family@example.com",
    };

    const response = await app.request("http://localhost/api/admin/users", {}, familyEnv);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "admin_required" },
    });

    const pageResponse = await app.request("http://localhost/admin", {}, familyEnv);
    expect(pageResponse.status).toBe(403);
  });
});

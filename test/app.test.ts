import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import type { Bindings } from "../server/env";

const app = createApp();

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
});

describe("family starter worker", () => {
  it("reports health without touching D1", async () => {
    const response = await app.request(
      "http://localhost/api/health",
      {},
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("creates a local user once and returns it", async () => {
    const first = await app.request("http://localhost/api/me", {}, env);
    const second = await app.request("http://localhost/api/me", {}, env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstBody = await first.json<{
      user: { id: string; email: string; authProvider: string };
    }>();
    const secondBody = await second.json<{
      user: { id: string };
    }>();

    expect(firstBody.user).toMatchObject({
      email: "developer@example.com",
      authProvider: "local-dev",
      isAdmin: true,
    });
    expect(secondBody.user.id).toBe(firstBody.user.id);

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users",
    ).first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("updates only the current user's profile", async () => {
    await app.request("http://localhost/api/me", {}, env);

    const response = await app.request(
      "http://localhost/api/me/profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Hibiki",
          avatarUrl: "https://example.com/avatar.png",
          timezone: "America/Los_Angeles",
        }),
      },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json<{
      user: {
        displayName: string;
        avatarUrl: string;
        timezone: string;
      };
    }>();
    expect(body.user).toMatchObject({
      displayName: "Hibiki",
      avatarUrl: "https://example.com/avatar.png",
      timezone: "America/Los_Angeles",
    });
  });

  it("returns field errors for an invalid profile", async () => {
    await app.request("http://localhost/api/me", {}, env);

    const response = await app.request(
      "http://localhost/api/me/profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "A".repeat(81),
          avatarUrl: "javascript:alert(1)",
          timezone: "Mars/Olympus_Mons",
        }),
      },
      env,
    );

    expect(response.status).toBe(422);
    const body = await response.json<{
      error: { code: string; fields: Record<string, string> };
    }>();
    expect(body.error.code).toBe("invalid_profile");
    expect(Object.keys(body.error.fields)).toEqual([
      "displayName",
      "avatarUrl",
      "timezone",
    ]);
  });

  it("never uses the local identity on a public hostname", async () => {
    const response = await app.request(
      "https://family.example.com/api/me",
      {},
      env,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "local_auth_forbidden" },
    });
  });

  it("requires Access in production even on a localhost URL", async () => {
    const accessEnv: Bindings = {
      ...env,
      AUTH_MODE: "access",
    };

    const response = await app.request(
      "http://localhost/api/me",
      {},
      accessEnv,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required" },
    });
  });

  it("lets the configured admin list every user", async () => {
    const familyEnv: Bindings = {
      ...env,
      LOCAL_DEV_USER_EMAIL: "family@example.com",
    };
    await app.request("http://localhost/api/me", {}, familyEnv);
    await app.request("http://localhost/api/me", {}, env);

    const response = await app.request(
      "http://localhost/api/admin/users",
      {},
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json<{
      users: Array<{ email: string; isAdmin: boolean }>;
    }>();
    expect(body.users).toHaveLength(2);
    expect(body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "developer@example.com",
          isAdmin: true,
        }),
        expect.objectContaining({
          email: "family@example.com",
          isAdmin: false,
        }),
      ]),
    );
  });

  it("rejects a non-admin from the admin API", async () => {
    const familyEnv: Bindings = {
      ...env,
      LOCAL_DEV_USER_EMAIL: "family@example.com",
    };

    const response = await app.request(
      "http://localhost/api/admin/users",
      {},
      familyEnv,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "admin_required" },
    });

    const pageResponse = await app.request(
      "http://localhost/admin",
      {},
      familyEnv,
    );
    expect(pageResponse.status).toBe(403);
  });
});

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../server/app";
import type { Bindings } from "../server/env";

const app = createApp();

describe("identity", () => {
  it("reports health without touching D1", async () => {
    const response = await app.request("http://localhost/api/health", {}, env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("creates a local user once and returns it", async () => {
    const first = await app.request("http://localhost/api/me", {}, env);
    const second = await app.request("http://localhost/api/me", {}, env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstBody = await first.json<{
      user: { id: string; email: string; authProvider: string; isAdmin: boolean };
    }>();
    const secondBody = await second.json<{ user: { id: string } }>();
    expect(firstBody.user).toMatchObject({
      email: "developer@example.com",
      authProvider: "local-dev",
      isAdmin: true,
    });
    expect(secondBody.user.id).toBe(firstBody.user.id);

    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{
      count: number;
    }>();
    expect(count?.count).toBe(1);
  });

  it("uses the local identity on explicitly allowed development hostnames", async () => {
    const allowedEnv: Bindings = {
      ...env,
      LOCAL_DEV_ALLOWED_HOSTS: " 100.100.104.42, VIBE97 ",
    };

    for (const hostname of ["100.100.104.42", "vibe97"]) {
      const response = await app.request(`http://${hostname}/api/me`, {}, allowedEnv);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        user: { email: "developer@example.com", authProvider: "local-dev" },
      });
    }
  });

  it("never uses the local identity on an unlisted public hostname", async () => {
    const response = await app.request("https://family.example.com/api/me", {}, env);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "local_auth_forbidden" },
    });
  });

  it("uses the email header injected by Access in production", async () => {
    const accessEnv: Bindings = { ...env, AUTH_MODE: "access" };
    const response = await app.request(
      "https://family.example.com/api/me",
      { headers: { "Cf-Access-Authenticated-User-Email": " Family@Example.com " } },
      accessEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { email: "family@example.com", authProvider: "cloudflare-access" },
    });
  });

  it("requires the Access email header in production even on localhost", async () => {
    const accessEnv: Bindings = { ...env, AUTH_MODE: "access" };
    const response = await app.request("http://localhost/api/me", {}, accessEnv);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required" },
    });
  });
});

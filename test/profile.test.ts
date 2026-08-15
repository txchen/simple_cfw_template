import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../server/app";

const app = createApp();

describe("profile", () => {
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
    await expect(response.json()).resolves.toMatchObject({
      user: {
        displayName: "Hibiki",
        avatarUrl: "https://example.com/avatar.png",
        timezone: "America/Los_Angeles",
      },
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
    expect(Object.keys(body.error.fields)).toEqual(["displayName", "avatarUrl", "timezone"]);
  });

  it("keeps malformed JSON distinct from schema validation errors", async () => {
    const response = await app.request(
      "http://localhost/api/me/profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      },
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_json",
        message: "The request body must be valid JSON.",
      },
    });
  });

  it("normalizes optional profile strings", async () => {
    await app.request("http://localhost/api/me", {}, env);
    const response = await app.request(
      "http://localhost/api/me/profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "  Hibiki  ", avatarUrl: "" }),
      },
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { displayName: "Hibiki", avatarUrl: null, timezone: null },
    });
  });

  it("requires the profile body to be an object", async () => {
    const response = await app.request(
      "http://localhost/api/me/profile",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["not", "an", "object"]),
      },
      env,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_profile",
        message: "The profile must be a JSON object.",
      },
    });
  });
});

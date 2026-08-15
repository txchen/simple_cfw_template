import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ApiError, getCurrentUser } from "../src/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("turns a non-JSON response into a stable API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Cloudflare Access login</html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(getCurrentUser()).rejects.toMatchObject({
      name: "ApiError",
      code: "unexpected_response",
      message: "Unexpected response from the server.",
    });
  });

  it("preserves a structured API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "authentication_required",
              message: "A valid Cloudflare Access session is required.",
            },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(getCurrentUser()).rejects.toEqual(
      new ApiError("A valid Cloudflare Access session is required.", "authentication_required"),
    );
  });
});

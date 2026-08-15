import type { AdminUserSummary, ApiErrorBody, AppUser, ProfileUpdate } from "../shared/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: ApiErrorBody["error"]["fields"] = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getCurrentUser(): Promise<AppUser> {
  const response = await fetch("/api/me", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return readApiProperty<AppUser>(response, "user");
}

export async function updateProfile(profile: ProfileUpdate): Promise<AppUser> {
  const response = await fetch("/api/me/profile", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });
  return readApiProperty<AppUser>(response, "user");
}

export async function getAdminUsers(): Promise<AdminUserSummary[]> {
  const response = await fetch("/api/admin/users", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return readApiProperty<AdminUserSummary[]>(response, "users");
}

async function readApiProperty<T>(response: Response, property: string): Promise<T> {
  const body = await readJsonObject(response);

  if (isApiErrorBody(body)) {
    throw new ApiError(body.error.message, body.error.code, body.error.fields);
  }

  if (!response.ok || !(property in body)) {
    throw unexpectedResponse();
  }

  return body[property] as T;
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  if (!response.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    throw unexpectedResponse();
  }

  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw unexpectedResponse();
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unexpectedResponse();
  }
}

function isApiErrorBody(
  body: Record<string, unknown>,
): body is Record<string, unknown> & ApiErrorBody {
  if (!("error" in body) || typeof body.error !== "object" || body.error === null) return false;

  const error = body.error as Record<string, unknown>;
  return typeof error.code === "string" && typeof error.message === "string";
}

function unexpectedResponse(): ApiError {
  return new ApiError("Unexpected response from the server.", "unexpected_response");
}

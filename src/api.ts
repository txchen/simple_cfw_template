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
  return readUserResponse(response);
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
  return readUserResponse(response);
}

export async function getAdminUsers(): Promise<AdminUserSummary[]> {
  const response = await fetch("/api/admin/users", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const body = (await response.json()) as { users: AdminUserSummary[] } | ApiErrorBody;

  if (!response.ok || !("users" in body)) {
    throw toApiError(body);
  }
  return body.users;
}

async function readUserResponse(response: Response): Promise<AppUser> {
  const body = (await response.json()) as { user: AppUser } | ApiErrorBody;

  if (!response.ok || !("user" in body)) {
    throw toApiError(body);
  }

  return body.user;
}

function toApiError(body: ApiErrorBody | object): ApiError {
  const error =
    "error" in body
      ? (body as ApiErrorBody).error
      : { code: "unexpected_response", message: "Unexpected API response." };
  return new ApiError(error.message, error.code, error.fields);
}

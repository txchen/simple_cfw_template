import type { ProfileUpdate } from "../shared/contracts";
import { HttpError } from "./errors";

export async function parseProfileUpdate(
  request: Request,
): Promise<ProfileUpdate> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
  }

  if (!isRecord(input)) {
    throw new HttpError(
      422,
      "invalid_profile",
      "The profile must be a JSON object.",
    );
  }

  const fields: Partial<Record<keyof ProfileUpdate, string>> = {};
  const displayName = optionalString(input.displayName, "displayName", fields);
  const avatarUrl = optionalString(input.avatarUrl, "avatarUrl", fields);
  const timezone = optionalString(input.timezone, "timezone", fields);

  if (displayName && displayName.length > 80) {
    fields.displayName = "Display name must be 80 characters or fewer.";
  }

  if (avatarUrl) {
    if (avatarUrl.length > 500) {
      fields.avatarUrl = "Avatar URL must be 500 characters or fewer.";
    } else if (!isHttpUrl(avatarUrl)) {
      fields.avatarUrl = "Avatar URL must use http:// or https://.";
    }
  }

  if (timezone) {
    if (timezone.length > 100 || !isTimezone(timezone)) {
      fields.timezone = "Use a valid IANA timezone such as America/Los_Angeles.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new HttpError(
      422,
      "invalid_profile",
      "Please correct the highlighted fields.",
      fields,
    );
  }

  return { displayName, avatarUrl, timezone };
}

function optionalString(
  value: unknown,
  field: keyof ProfileUpdate,
  fields: Partial<Record<keyof ProfileUpdate, string>>,
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    fields[field] = "Must be a string or null.";
    return null;
  }
  return value.trim() || null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

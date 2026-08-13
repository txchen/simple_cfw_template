import type { ProfileUpdate } from "../shared/contracts";
import { HttpError } from "./errors";

type ValidationIssue = {
  message: string;
  path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
};

export function profileValidationError(issues: readonly ValidationIssue[]): HttpError {
  const fields: Partial<Record<keyof ProfileUpdate, string>> = {};

  for (const issue of issues) {
    const field = getIssueField(issue);
    if (field && fields[field] === undefined) {
      fields[field] = issue.message;
    }
  }

  if (Object.keys(fields).length === 0) {
    return new HttpError(422, "invalid_profile", issues[0]?.message ?? "The profile is invalid.");
  }

  return new HttpError(422, "invalid_profile", "Please correct the highlighted fields.", fields);
}

function getIssueField(issue: ValidationIssue): keyof ProfileUpdate | null {
  const segment = issue.path?.[0];
  const key = typeof segment === "object" && segment !== null ? segment.key : segment;

  return key === "displayName" || key === "avatarUrl" || key === "timezone" ? key : null;
}

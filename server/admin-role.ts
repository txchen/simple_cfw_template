export interface AdminRoleConfig {
  ADMIN_EMAILS?: string;
  ADMIN_EMAIL?: string;
}

export function hasAdminRole(userEmail: string, config: AdminRoleConfig): boolean {
  const configuredEmails = config.ADMIN_EMAILS?.trim() || config.ADMIN_EMAIL;
  if (!configuredEmails) return false;

  const normalizedUserEmail = userEmail.trim().toLowerCase();
  return configuredEmails.split(",").some((email) => {
    const normalizedAdminEmail = email.trim().toLowerCase();
    return (
      normalizedAdminEmail.length > 0 &&
      !normalizedAdminEmail.startsWith("replace-with-") &&
      normalizedUserEmail === normalizedAdminEmail
    );
  });
}

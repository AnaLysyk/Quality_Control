/**
 * Types for company access and membership.
 * Used for access control and UI display of company-related permissions.
 */
export type CompanyAccess = {
  /** Unique company ID */
  id: string;
  /** Company display name */
  name: string;
  /** Company slug (URL segment) */
  slug: string;
  /** Whether the company is active */
  active: boolean;
  /** User's role in the company */
  role: "ADMIN" | "USER" | "DEV" | "COMPANY";
  /** Whether the user's link/membership is active */
  linkActive: boolean;
  /** Company creation date (optional) */
  createdAt?: string | null;
};

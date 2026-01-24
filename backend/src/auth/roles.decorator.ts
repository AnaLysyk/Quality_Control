import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

export type RoleRequirement = string;

export const Roles = (...roles: RoleRequirement[]) => SetMetadata(ROLES_KEY, roles);

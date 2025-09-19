/**
 * User roles enumeration for Encore authentication system
 * This ensures consistency across the application and prevents role injection attacks
 */
export enum UserRole {
  GUEST = 'guest',
  MEMBER = 'member',
  BAR_OWNER = 'bar_owner',
  SUPER_ADMIN = 'super_admin'
}

/**
 * Array of all valid user roles for validation
 */
export const VALID_USER_ROLES = [
  UserRole.GUEST,
  UserRole.MEMBER,
  UserRole.BAR_OWNER,
  UserRole.SUPER_ADMIN
] as const;

/**
 * Role hierarchy for permission checking
 * Higher index means more permissions
 */
export const ROLE_HIERARCHY = {
  [UserRole.GUEST]: 0,
  [UserRole.MEMBER]: 1,
  [UserRole.BAR_OWNER]: 2,
  [UserRole.SUPER_ADMIN]: 3
} as const;

/**
 * Check if a role has sufficient permissions
 */
export const hasRolePermission = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/**
 * Get all roles that have a certain permission level or higher
 */
export const getRolesWithPermission = (requiredRole: UserRole): UserRole[] => {
  return VALID_USER_ROLES.filter(role => hasRolePermission(role, requiredRole));
};

/**
 * Validate if a string is a valid user role
 */
export const isValidUserRole = (role: string): role is UserRole => {
  return VALID_USER_ROLES.includes(role as UserRole);
};

/**
 * Type guard for UserRole
 */
export const assertValidUserRole = (role: string): UserRole => {
  if (!isValidUserRole(role)) {
    throw new Error(`Invalid user role: ${role}`);
  }
  return role;
};
/**
 * Check if a user has a specific action permission.
 * Admins always have all permissions.
 * For other roles, check the `allowed_modules` array for `action:xxx` keys.
 */
export function canPerformAction(userProfile, actionKey) {
  if (!userProfile) return false;
  
  // Admins always have full access
  const role = userProfile.role;
  if (role === 'Administrator' || role === 'Admin / Developer') return true;

  // Check the allowed_modules array for the action key
  const allowed = userProfile.allowed_modules;
  if (!Array.isArray(allowed)) return false;
  
  return allowed.includes(actionKey);
}

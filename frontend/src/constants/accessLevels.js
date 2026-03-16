// frontend/src/constants/accessLevels.js

// ============================================================================
// LEGACY ACCESS LEVELS (Your existing code - keep for backward compatibility)
// ============================================================================
export const ACCESS_LEVELS = {
  NO_ACCESS: 'no_access',
  VIEW_ONLY: 'view_only',
  FULL_ACCESS: 'full_access'
};

export const ACCESS_LEVEL_IDS = {
  NO_ACCESS: 1,
  VIEW_ONLY: 2,
  FULL_ACCESS: 3
};

export const ROLE_IDS = {
  ADMIN: 1,
  USER: 6
};

export const ROLE_NAMES = {
  ADMIN: 'Admin',
  USER: 'User'
};

// Helper function to check access level hierarchy
export const hasRequiredAccess = (currentLevel, requiredLevel) => {
  const hierarchy = {
    'no_access': 0,
    'view_only': 1,
    'full_access': 2
  };
  
  return hierarchy[currentLevel] >= hierarchy[requiredLevel];
};

// ============================================================================
// NEW: CRUD PERMISSIONS (Enhanced from your existing CRUD_PERMISSIONS)
// ============================================================================
export const CRUD_PERMISSIONS = {
  CAN_VIEW: 'CanView',
  CAN_CREATE: 'CanCreate',
  CAN_EDIT: 'CanEdit',
  CAN_DELETE: 'CanDelete',
  CAN_EXPORT: 'CanExport',
  CAN_APPROVE: 'CanApprove'
};

// Permission labels for display
export const PERMISSION_LABELS = {
  CanView: 'View',
  CanCreate: 'Create',
  CanEdit: 'Edit',
  CanDelete: 'Delete',
  CanExport: 'Export',
  CanApprove: 'Approve'
};

// NEW: Permission descriptions
export const PERMISSION_DESCRIPTIONS = {
  CanView: 'Can view and read data',
  CanCreate: 'Can create new items',
  CanEdit: 'Can edit existing items',
  CanDelete: 'Can delete items',
  CanExport: 'Can export data to files',
  CanApprove: 'Can approve or reject items'
};

// NEW: Permission icons/emojis
export const PERMISSION_ICONS = {
  CanView: '👁️',
  CanCreate: '➕',
  CanEdit: '✏️',
  CanDelete: '🗑️',
  CanExport: '📥',
  CanApprove: '✅'
};

// NEW: Permission colors for UI
export const PERMISSION_COLORS = {
  CanView: 'blue',
  CanCreate: 'green',
  CanEdit: 'yellow',
  CanDelete: 'red',
  CanExport: 'purple',
  CanApprove: 'indigo'
};

// NEW: All permission keys in order
export const ALL_PERMISSIONS = [
  'CanView',
  'CanCreate',
  'CanEdit',
  'CanDelete',
  'CanExport',
  'CanApprove'
];

// NEW: Default permissions object
export const DEFAULT_PERMISSIONS = {
  CanView: false,
  CanCreate: false,
  CanEdit: false,
  CanDelete: false,
  CanExport: false,
  CanApprove: false
};

// Helper function to check CRUD permissions (your existing function - kept)
export const hasCrudPermission = (permissions, permissionType) => {
  if (!permissions) return false;
  return permissions[permissionType] === true;
};

// ============================================================================
// NEW: PERMISSION PRESETS (common permission combinations)
// ============================================================================
export const PERMISSION_PRESETS = {
  NO_ACCESS: {
    label: 'No Access',
    permissions: {
      CanView: false,
      CanCreate: false,
      CanEdit: false,
      CanDelete: false,
      CanExport: false,
      CanApprove: false
    }
  },
  VIEW_ONLY: {
    label: 'View Only',
    permissions: {
      CanView: true,
      CanCreate: false,
      CanEdit: false,
      CanDelete: false,
      CanExport: false,
      CanApprove: false
    }
  },
  VIEW_EXPORT: {
    label: 'View & Export',
    permissions: {
      CanView: true,
      CanCreate: false,
      CanEdit: false,
      CanDelete: false,
      CanExport: true,
      CanApprove: false
    }
  },
  EDITOR: {
    label: 'Editor',
    permissions: {
      CanView: true,
      CanCreate: true,
      CanEdit: true,
      CanDelete: false,
      CanExport: true,
      CanApprove: false
    }
  },
  APPROVER: {
    label: 'Approver',
    permissions: {
      CanView: true,
      CanCreate: false,
      CanEdit: false,
      CanDelete: false,
      CanExport: true,
      CanApprove: true
    }
  },
  FULL_ACCESS: {
    label: 'Full Access',
    permissions: {
      CanView: true,
      CanCreate: true,
      CanEdit: true,
      CanDelete: true,
      CanExport: true,
      CanApprove: true
    }
  }
};

// ============================================================================
// NEW: HELPER FUNCTIONS FOR CRUD PERMISSIONS
// ============================================================================

/**
 * Convert legacy access level to CRUD permissions
 */
export const legacyToPermissions = (accessLevel) => {
  const levelName = typeof accessLevel === 'number' 
    ? Object.keys(ACCESS_LEVEL_IDS).find(key => ACCESS_LEVEL_IDS[key] === accessLevel)
    : accessLevel;
    
  switch (levelName) {
    case 'NO_ACCESS':
    case 'no_access':
    case 1:
      return PERMISSION_PRESETS.NO_ACCESS.permissions;
    case 'VIEW_ONLY':
    case 'view_only':
    case 2:
      return PERMISSION_PRESETS.VIEW_ONLY.permissions;
    case 'FULL_ACCESS':
    case 'full_access':
    case 3:
      return PERMISSION_PRESETS.FULL_ACCESS.permissions;
    default:
      return DEFAULT_PERMISSIONS;
  }
};

/**
 * Convert CRUD permissions to legacy access level (best match)
 */
export const permissionsToLegacy = (permissions) => {
  if (!permissions) return ACCESS_LEVELS.NO_ACCESS;
  
  // No permissions at all
  if (!permissions.CanView) {
    return ACCESS_LEVELS.NO_ACCESS;
  }
  
  // Only view permission
  if (permissions.CanView && 
      !permissions.CanCreate && 
      !permissions.CanEdit && 
      !permissions.CanDelete) {
    return ACCESS_LEVELS.VIEW_ONLY;
  }
  
  // Any write permissions
  return ACCESS_LEVELS.FULL_ACCESS;
};

/**
 * Check if user has at least one permission
 */
export const hasAnyPermission = (permissions) => {
  if (!permissions) return false;
  return ALL_PERMISSIONS.some(perm => permissions[perm]);
};

/**
 * Check if user has all specified permissions
 */
export const hasAllPermissions = (permissions, required = []) => {
  if (!permissions) return false;
  return required.every(perm => permissions[perm]);
};

/**
 * Count active permissions
 */
export const countActivePermissions = (permissions) => {
  if (!permissions) return 0;
  return ALL_PERMISSIONS.filter(perm => permissions[perm]).length;
};

/**
 * Get permission badge color based on Tailwind classes
 */
export const getPermissionBadgeColor = (permissionKey, isActive) => {
  if (!isActive) return 'bg-gray-200 text-gray-600';
  
  const colorMap = {
    CanView: 'bg-blue-100 text-blue-700',
    CanCreate: 'bg-green-100 text-green-700',
    CanEdit: 'bg-yellow-100 text-yellow-700',
    CanDelete: 'bg-red-100 text-red-700',
    CanExport: 'bg-purple-100 text-purple-700',
    CanApprove: 'bg-indigo-100 text-indigo-700'
  };
  
  return colorMap[permissionKey] || 'bg-gray-100 text-gray-700';
};

/**
 * Get a human-readable summary of permissions
 */
export const getPermissionSummary = (permissions) => {
  if (!permissions) return 'No Access';
  
  const active = ALL_PERMISSIONS.filter(perm => permissions[perm]);
  
  if (active.length === 0) return 'No Access';
  if (active.length === 6) return 'Full Access';
  if (active.length === 1 && active[0] === 'CanView') return 'View Only';
  
  return active.map(perm => PERMISSION_LABELS[perm]).join(', ');
};

/**
 * Get the best matching preset for given permissions
 */
export const getMatchingPreset = (permissions) => {
  if (!permissions) return 'NO_ACCESS';
  
  for (const [presetKey, preset] of Object.entries(PERMISSION_PRESETS)) {
    const matches = ALL_PERMISSIONS.every(
      perm => preset.permissions[perm] === permissions[perm]
    );
    if (matches) return presetKey;
  }
  
  return null; // Custom permissions
};

/**
 * Validate permissions object
 */
export const isValidPermissions = (permissions) => {
  if (!permissions || typeof permissions !== 'object') return false;
  
  // Check if all required keys exist and are boolean
  return ALL_PERMISSIONS.every(
    perm => perm in permissions && typeof permissions[perm] === 'boolean'
  );
};

/**
 * Merge permissions (OR operation)
 */
export const mergePermissions = (...permissionSets) => {
  const merged = { ...DEFAULT_PERMISSIONS };
  
  permissionSets.forEach(permissions => {
    if (permissions) {
      ALL_PERMISSIONS.forEach(perm => {
        if (permissions[perm]) {
          merged[perm] = true;
        }
      });
    }
  });
  
  return merged;
};

// ============================================================================
// ACCESS SOURCE (for permission hierarchy)
// ============================================================================
export const ACCESS_SOURCES = {
  SUPERUSER: 'superuser',
  USER: 'user',
  GROUP: 'group',
  ROLE: 'role',
  DEFAULT: 'default',
  NONE: 'none'
};

export const ACCESS_SOURCE_LABELS = {
  superuser: 'SuperUser Override',
  user: 'Individual Override',
  group: 'Group Access',
  role: 'Role Access',
  default: 'Default Access',
  none: 'No Access'
};

export const ACCESS_SOURCE_COLORS = {
  superuser: 'purple',
  user: 'blue',
  group: 'green',
  role: 'yellow',
  default: 'gray',
  none: 'red'
};

export const ACCESS_SOURCE_PRIORITIES = {
  superuser: 0,
  user: 1,
  group: 2,
  role: 3,
  default: 4,
  none: 5
};
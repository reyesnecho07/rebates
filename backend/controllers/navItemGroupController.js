// backend/controllers/NavItemGroupController.js
import navItemService from '../services/navItemsGroupService.js';

// ============================================================================
// NAVIGATION ITEM CONTROLLER METHODS
// ============================================================================

/**
 * Helper function to get database name from request
 */
const getDatabaseName = (req) => {
  // Get database from query parameter, default to 'USER'
  const dbName = req.query.db || 'USER';
  console.log('📊 Using database:', dbName);
  return dbName;
};

const getUserId = (req) => {
  return req.user?.UserID      // authMiddleware now always sets this
      || req.user?.User_ID
      || req.user?.userId
      || null;
};

/**
 * Get all nav items with permissions for current user in a specific database
 */
export const getNavItemsWithPermissions = async (req, res) => {
  try {
    console.log('📝 getNavItemsWithPermissions called');
    console.log('📊 Request query:', req.query);
    
    const { databaseId } = req.params;
    
    if (!databaseId) {
      return res.status(400).json({ 
        success: false,
        message: 'Database ID is required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const userId = getUserId(req);

    if (!userId) {
      console.log('⚠️ No user ID found in request');
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }
    
    console.log(`👤 Getting nav items for user ${userId} in database ${databaseId}`);
    
    const navItems = await navItemService.getNavItemsWithPermissions(userId, databaseId, dbName);
    
    console.log(`✅ Retrieved ${navItems.length} nav items with permissions`);
    
    res.json({
      success: true,
      count: navItems.length,
      data: navItems
    });
    
  } catch (error) {
    console.error('❌ Error in getNavItemsWithPermissions:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load navigation items',
      error: error.message 
    });
  }
};

/**
 * Get all nav items (active AND inactive)
 */
export const getAllNavItems = async (req, res) => {
  try {
    console.log('📝 getAllNavItems called');
    
    const dbName = getDatabaseName(req);
    
    const navItems = await navItemService.getAllNavItems(dbName);
    
    console.log(`✅ Retrieved ${navItems.length} nav items`);
    
    res.json({
      success: true,
      count: navItems.length,
      data: navItems
    });
    
  } catch (error) {
    console.error('❌ Error in getAllNavItems:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load navigation items',
      error: error.message 
    });
  }
};

/**
 * Get active nav items only
 */
export const getActiveNavItems = async (req, res) => {
  try {
    console.log('📝 getActiveNavItems called');
    
    const dbName = getDatabaseName(req);
    
    const navItems = await navItemService.getActiveNavItems(dbName);
    
    console.log(`✅ Retrieved ${navItems.length} active nav items`);
    
    res.json({
      success: true,
      count: navItems.length,
      data: navItems
    });
    
  } catch (error) {
    console.error('❌ Error in getActiveNavItems:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load active navigation items',
      error: error.message 
    });
  }
};

/**
 * Get nav items by database
 */
export const getNavItemsByDatabase = async (req, res) => {
  try {
    console.log('📝 getNavItemsByDatabase called');
    
    const { databaseId } = req.params;
    
    if (!databaseId) {
      return res.status(400).json({ 
        success: false,
        message: 'Database ID is required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const navItems = await navItemService.getNavItemsByDatabase(databaseId, dbName);
    
    console.log(`✅ Retrieved ${navItems.length} nav items for database ${databaseId}`);
    
    res.json({
      success: true,
      count: navItems.length,
      data: navItems
    });
    
  } catch (error) {
    console.error('❌ Error in getNavItemsByDatabase:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load navigation items for database',
      error: error.message 
    });
  }
};

/**
 * Get nav item by ID
 */
export const getNavItemById = async (req, res) => {
  try {
    console.log('📝 getNavItemById called');
    
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'Nav item ID is required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const navItem = await navItemService.getNavItemById(id, dbName);
    
    console.log(`✅ Retrieved nav item ${id}`);
    
    res.json({
      success: true,
      data: navItem
    });
    
  } catch (error) {
    console.error('❌ Error in getNavItemById:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        success: false,
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to load navigation item',
      error: error.message 
    });
  }
};

/**
 * Get child nav items for a parent
 */
export const getChildNavItems = async (req, res) => {
  try {
    console.log('📝 getChildNavItems called');
    
    const { parentId } = req.params;
    
    if (!parentId) {
      return res.status(400).json({ 
        success: false,
        message: 'Parent ID is required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const childItems = await navItemService.getChildNavItems(parentId, dbName);
    
    console.log(`✅ Retrieved ${childItems.length} child nav items for parent ${parentId}`);
    
    res.json({
      success: true,
      count: childItems.length,
      data: childItems
    });
    
  } catch (error) {
    console.error('❌ Error in getChildNavItems:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load child navigation items',
      error: error.message 
    });
  }
};

/**
 * Create new nav item
 */
export const createNavItem = async (req, res) => {
  try {
    console.log('📝 createNavItem called with body:', JSON.stringify(req.body, null, 2));
    
    const { 
      navItemName, 
      routePath, 
      displayOrder, 
      parentId, 
      iconName, 
      databaseId,
      isActive = true 
    } = req.body;
    
    if (!navItemName) {
      return res.status(400).json({ 
        success: false,
        message: 'Nav item name is required' 
      });
    }
    
    if (!databaseId) {
      return res.status(400).json({ 
        success: false,
        message: 'Database ID is required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const result = await navItemService.createNavItem({ 
      navItemName, 
      routePath, 
      displayOrder, 
      parentId, 
      iconName, 
      databaseId,
      isActive 
    }, dbName);
    
    console.log('✅ Nav item created successfully:', result);
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        navItemId: result.navItemId,
        navItemName: result.navItemName,
        createdAt: result.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error in createNavItem:', error);
    
    // Check for specific error types
    if (error.message.includes('already exists')) {
      return res.status(400).json({ 
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to create navigation item',
      error: error.message 
    });
  }
};

/**
 * Update nav item
 */
export const updateNavItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      navItemName, 
      routePath, 
      displayOrder, 
      parentId, 
      iconName, 
      databaseId,
      isActive 
    } = req.body;
    
    console.log('📝 updateNavItem called:', { id, navItemName, databaseId, isActive });
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'Nav item ID is required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const result = await navItemService.updateNavItem(id, { 
      navItemName, 
      routePath, 
      displayOrder, 
      parentId, 
      iconName, 
      databaseId,
      isActive 
    }, dbName);
    
    console.log('✅ Nav item updated successfully');
    
    res.json({
      success: true,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Error in updateNavItem:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        success: false,
        message: error.message 
      });
    }
    
    if (error.message.includes('already exists')) {
      return res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
    
    if (error.message.includes('cannot be its own parent')) {
      return res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to update navigation item',
      error: error.message 
    });
  }
};

/**
 * Update user navigation access
 */
export const updateUserNavAccess = async (req, res) => {
  try {
    const { userId, navItemId, canView, canCreate, canEdit, canDelete } = req.body;
    
    console.log('📝 updateUserNavAccess called:', { userId, navItemId, canView, canCreate, canEdit, canDelete });
    
    if (!userId || !navItemId) {
      return res.status(400).json({ 
        success: false,
        message: 'userId and navItemId are required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const result = await navItemService.updateUserNavAccess({ 
      userId, 
      navItemId, 
      canView, 
      canCreate, 
      canEdit, 
      canDelete 
    }, dbName);
    
    console.log('✅ User nav access updated successfully');
    
    res.json({
      success: true,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Error in updateUserNavAccess:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update user navigation access',
      error: error.message 
    });
  }
};

/**
 * Update role navigation access
 */
export const updateRoleNavAccess = async (req, res) => {
  try {
    const { roleId, navItemId, canView, canCreate, canEdit, canDelete } = req.body;
    
    console.log('📝 updateRoleNavAccess called:', { roleId, navItemId, canView, canCreate, canEdit, canDelete });
    
    if (!roleId || !navItemId) {
      return res.status(400).json({ 
        success: false,
        message: 'roleId and navItemId are required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const result = await navItemService.updateRoleNavAccess({ 
      roleId, 
      navItemId, 
      canView, 
      canCreate, 
      canEdit, 
      canDelete 
    }, dbName);
    
    console.log('✅ Role nav access updated successfully');
    
    res.json({
      success: true,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Error in updateRoleNavAccess:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update role navigation access',
      error: error.message 
    });
  }
};

/**
 * Update group navigation access
 */
export const updateGroupNavAccess = async (req, res) => {
  try {
    const { groupId, navItemId, canView, canCreate, canEdit, canDelete } = req.body;
    
    console.log('📝 updateGroupNavAccess called:', { groupId, navItemId, canView, canCreate, canEdit, canDelete });
    
    if (!groupId || !navItemId) {
      return res.status(400).json({ 
        success: false,
        message: 'groupId and navItemId are required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const result = await navItemService.updateGroupNavAccess({ 
      groupId, 
      navItemId, 
      canView, 
      canCreate, 
      canEdit, 
      canDelete 
    }, dbName);
    
    console.log('✅ Group nav access updated successfully');
    
    res.json({
      success: true,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Error in updateGroupNavAccess:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update group navigation access',
      error: error.message 
    });
  }
};

/**
 * Get user navigation access for a specific nav item
 */
export const getUserNavAccess = async (req, res) => {
  try {
    const { userId, navItemId } = req.params;
    
    console.log('📝 getUserNavAccess called for:', { userId, navItemId });
    
    if (!userId || !navItemId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID and Nav Item ID are required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const access = await navItemService.getUserNavAccess(userId, navItemId, dbName);
    
    console.log('✅ Retrieved user nav access');
    
    res.json({
      success: true,
      data: access
    });
    
  } catch (error) {
    console.error('❌ Error in getUserNavAccess:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get user navigation access',
      error: error.message 
    });
  }
};

/**
 * Get role navigation access for a specific nav item
 */
export const getRoleNavAccess = async (req, res) => {
  try {
    const { roleId, navItemId } = req.params;
    
    console.log('📝 getRoleNavAccess called for:', { roleId, navItemId });
    
    if (!roleId || !navItemId) {
      return res.status(400).json({ 
        success: false,
        message: 'Role ID and Nav Item ID are required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const access = await navItemService.getRoleNavAccess(roleId, navItemId, dbName);
    
    console.log('✅ Retrieved role nav access');
    
    res.json({
      success: true,
      data: access
    });
    
  } catch (error) {
    console.error('❌ Error in getRoleNavAccess:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get role navigation access',
      error: error.message 
    });
  }
};

/**
 * Get group navigation access for a specific nav item
 */
export const getGroupNavAccess = async (req, res) => {
  try {
    const { groupId, navItemId } = req.params;
    
    console.log('📝 getGroupNavAccess called for:', { groupId, navItemId });
    
    if (!groupId || !navItemId) {
      return res.status(400).json({ 
        success: false,
        message: 'Group ID and Nav Item ID are required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const access = await navItemService.getGroupNavAccess(groupId, navItemId, dbName);
    
    console.log('✅ Retrieved group nav access');
    
    res.json({
      success: true,
      data: access
    });
    
  } catch (error) {
    console.error('❌ Error in getGroupNavAccess:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get group navigation access',
      error: error.message 
    });
  }
};

/**
 * Delete nav item (soft delete by default)
 */
export const deleteNavItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { hardDelete } = req.query;
    
    console.log('📝 deleteNavItem called:', { id, hardDelete });
    
    if (!id) {
      return res.status(400).json({ 
        success: false,
        message: 'Nav item ID is required' 
      });
    }
    
    const dbName = getDatabaseName(req);
    
    const result = await navItemService.deleteNavItem(id, hardDelete === 'true', dbName);
    
    console.log('✅ Nav item deleted successfully');
    
    res.json({
      success: true,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Error in deleteNavItem:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        success: false,
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete navigation item',
      error: error.message 
    });
  }
};

/**
 * Test database connection (helper endpoint)
 */
export const testDatabaseConnection = async (req, res) => {
  try {
    console.log('📝 testDatabaseConnection called');
    
    const dbName = req.query.db || 'USER';
    console.log('📊 Testing connection to database:', dbName);
    
    const result = await navItemService.testDatabaseConnection(dbName);
    
    if (result.success) {
      res.json({
        success: true,
        status: result.status,
        message: result.message,
        data: {
          testResult: result.testResult,
          database: dbName
        }
      });
    } else {
      res.status(500).json({
        success: false,
        status: result.status,
        message: result.message,
        error: result.error,
        database: dbName
      });
    }
    
  } catch (error) {
    console.error('❌ Error in testDatabaseConnection:', error);
    res.status(500).json({ 
      success: false,
      status: 'disconnected',
      message: 'Database connection test failed',
      error: error.message 
    });
  }
};
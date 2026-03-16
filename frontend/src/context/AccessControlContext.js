// frontend/src/context/AccessControlContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';
import { 
  legacyToPermissions, 
  getPermissionSummary,
  CRUD_PERMISSIONS 
} from '../constants/accessLevels';
import { setComponentMetadata } from '../api/axios';
import { permissionWebSocket } from '../utils/websocket';

const AccessControlContext = createContext();

// ============================================================================
// CONSTANTS - Move outside component since they never change
// ============================================================================

// 6-hour refresh interval (in milliseconds)
const FULL_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;
// Quick permission check interval (lighter weight)
const PERMISSION_CHECK_INTERVAL = 5 * 60 * 1000;

export const useAccessControl = () => {
  const context = useContext(AccessControlContext);
  if (!context) {
    throw new Error('useAccessControl must be used within AccessControlProvider');
  }
  return context;
};

// Helper function for safe integer parsing
const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const AccessControlProvider = ({ children }) => {
  const { user, logout, token, tempToken, trackEvent } = useAuth();
  const [userAccess, setUserAccess] = useState({
    navigationItems: [],
    databases: [],
    isLoading: false,
    lastUpdated: null,
    error: null
  });

  const [accessControlMap, setAccessControlMap] = useState({});
  const [accessCache, setAccessCache] = useState({});
  const [cacheTimestamp, setCacheTimestamp] = useState(null);
  
  const [permissionUpdateListeners, setPermissionUpdateListeners] = useState([]);
  const [lastPermissionUpdate, setLastPermissionUpdate] = useState(null);
  const [websocketStatus, setWebsocketStatus] = useState('disconnected');
  
  // Track if auto-refresh is enabled
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  const hasLoadedAccessRef = useRef(false);
  const isLoadingRef = useRef(false);
  
  const userRef = useRef(user);
  const tokenRef = useRef(token);
  const tempTokenRef = useRef(tempToken);
  const logoutRef = useRef(logout);
  const trackEventRef = useRef(trackEvent);
  
  const loadUserAccessRef = useRef(null);

  // ============================================================================
  // NEW: Smart Refresh Refs and Constants
  // ============================================================================
  const reloadScheduledRef = useRef(false);
  const lastFullRefreshRef = useRef(null);
  const permissionChangeDetectedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
    tokenRef.current = token;
    tempTokenRef.current = tempToken;
    logoutRef.current = logout;
    trackEventRef.current = trackEvent;
  }, [user, token, tempToken, logout, trackEvent]);

  useEffect(() => {
    setComponentMetadata('AccessControlContext', '2.5.0'); // Updated version
  }, []);

  const accessHierarchy = useMemo(() => ({
    'no_access': 0,
    'view_only': 1,
    'full_access': 2
  }), []);

  const getValidAccessLevels = useCallback(() => [
    { id: 1, name: 'no_access', label: 'No Access' },
    { id: 2, name: 'view_only', label: 'View Only' },
    { id: 3, name: 'full_access', label: 'Full Access' }
  ], []);

  const getCachedAccess = useCallback((navItemId) => {
    const CACHE_DURATION = 5 * 60 * 1000;
    
    if (accessCache[navItemId] && 
        cacheTimestamp && 
        Date.now() - cacheTimestamp < CACHE_DURATION) {
      return accessCache[navItemId];
    }
    return null;
  }, [accessCache, cacheTimestamp]);

  const loadUserAccess = useCallback(async () => {
    const currentUser = userRef.current;
    const currentToken = tokenRef.current;
    const currentTempToken = tempTokenRef.current;

    if (!currentUser?.UserID || !currentToken || currentTempToken) {
      return;
    }

    isLoadingRef.current = true;
    setUserAccess(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers = {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json'
      };

      const navResponse = await api.get(`/navigation/user/${currentUser.UserID}`, { headers });
      
      const navigationItems = navResponse.data || [];

      let databases = [];
      try {
        const dbResponse = await api.get(`/databases/user/${currentUser.UserID}`, { headers });
        databases = dbResponse.data || [];
      } catch (dbError) {
        console.warn('⚠️ Failed to load databases:', dbError.message);
      }

      const map = {};
      const sourceMap = {
        'user': 'Individual',
        'group': 'Group',
        'role': 'Role',
        'superuser': 'Superuser',
        'default': 'Default'
      };
      
      navigationItems.forEach(item => {
        const crudPermissions = legacyToPermissions(item.AccessLevel);
        
        const accessData = {
          type: 'navigation',
          accessLevel: item.AccessLevel,
          accessLevelId: item.AccessLevelID,
          accessSource: item.AccessSource,
          sourceLabel: sourceMap[item.AccessSource] || item.AccessSource,
          hasIndividualOverride: item.HasIndividualOverride || item.AccessSource === 'user',
          item: item,
          permissions: crudPermissions,
          permissionSummary: getPermissionSummary(crudPermissions)
        };

        map[item.NavItemID] = accessData;
        
        const normalizedName = item.NavItemName?.toLowerCase().trim();
        if (normalizedName) {
          map[normalizedName] = accessData;
        }
      });

      databases.forEach(db => {
        const dbPermissions = legacyToPermissions(db.AccessLevel || 'no_access');
        
        map[`db_${db.DatabaseID}`] = {
          type: 'database',
          accessLevel: db.AccessLevel || 'no_access',
          accessLevelId: db.AccessLevelId || 1,
          accessSource: db.AccessSource || 'default',
          sourceLabel: sourceMap[db.AccessSource] || 'Default',
          item: db,
          permissions: dbPermissions,
          permissionSummary: getPermissionSummary(dbPermissions)
        };
      });

      setAccessCache(prev => {
        const newCache = { ...prev };
        navigationItems.forEach(item => {
          newCache[item.NavItemID] = map[item.NavItemID];
        });
        return newCache;
      });
      setCacheTimestamp(Date.now());

      setUserAccess({
        navigationItems,
        databases,
        isLoading: false,
        lastUpdated: new Date(),
        error: null
      });

      setAccessControlMap(map);
      hasLoadedAccessRef.current = true;
      isLoadingRef.current = false;

    } catch (error) {
      console.error('❌ Error loading user access:', error);
      
      isLoadingRef.current = false;
      
      if (error.response?.status === 401) {
        logoutRef.current('unauthorized');
        return;
      }

      setUserAccess(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load access control data'
      }));
    }
  }, []);

  useEffect(() => {
    loadUserAccessRef.current = loadUserAccess;
  }, [loadUserAccess]);

  const notifyPermissionUpdate = useCallback((updatedRoutePaths = []) => {
    console.log('📢 Notifying about permission update:', updatedRoutePaths);
    
    permissionUpdateListeners.forEach(listener => {
      if (typeof listener === 'function') {
        listener(updatedRoutePaths);
      }
    });
    
    setLastPermissionUpdate(new Date());
    
    hasLoadedAccessRef.current = false;
    if (loadUserAccessRef.current) {
      loadUserAccessRef.current();
    }
  }, [permissionUpdateListeners]);

  const subscribeToPermissionUpdates = useCallback((callback) => {
    setPermissionUpdateListeners(prev => [...prev, callback]);
    
    return () => {
      setPermissionUpdateListeners(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  const refreshPermissions = useCallback(async (routePaths = []) => {
    if (routePaths.length > 0) {
      setAccessCache(prev => {
        const newCache = { ...prev };
        Object.keys(newCache).forEach(key => {
          const item = newCache[key];
          if (item && item.item && routePaths.includes(item.item.RoutePath)) {
            delete newCache[key];
          }
        });
        return newCache;
      });
    } else {
      setAccessCache({});
    }
    
    hasLoadedAccessRef.current = false;
    isLoadingRef.current = false;
    setCacheTimestamp(null);
    
    if (loadUserAccessRef.current) {
      await loadUserAccessRef.current();
    }
    
    notifyPermissionUpdate(routePaths);
    
    return true;
  }, [notifyPermissionUpdate]);

  const refreshAccessControl = useCallback(async () => {
    hasLoadedAccessRef.current = false;
    isLoadingRef.current = false;
    setAccessCache({});
    setCacheTimestamp(null);
    if (loadUserAccessRef.current) {
      await loadUserAccessRef.current();
    }
  }, []);

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================
  
  const batchRemoveIndividualOverrides = useCallback(async (navItemIds, userId) => {
    const currentToken = tokenRef.current;
    
    if (!currentToken || !userId || !navItemIds?.length) {
      throw new Error('Invalid parameters for batch remove overrides');
    }

    try {
      const response = await api.delete('/navigation/batch/overrides', {
        data: {
          userId: safeParseInt(userId),
          navItemIds: navItemIds.map(id => safeParseInt(id))
        },
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Invalidate cache for these items
      setAccessCache(prev => {
        const newCache = { ...prev };
        navItemIds.forEach(id => {
          delete newCache[id];
        });
        return newCache;
      });

      // Refresh access control
      await refreshAccessControl();

      return response.data;
    } catch (error) {
      console.error('Batch remove overrides error:', error);
      throw error;
    }
  }, [refreshAccessControl]);

  const batchUpdatePermissions = useCallback(async (navItemIds, userId, permissions) => {
    const currentToken = tokenRef.current;
    
    if (!currentToken || !userId || !navItemIds?.length || !permissions) {
      throw new Error('Invalid parameters for batch update permissions');
    }

    try {
      const response = await api.put('/navigation/batch/permissions', {
        userId: safeParseInt(userId),
        navItemIds: navItemIds.map(id => safeParseInt(id)),
        permissions: permissions
      }, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Invalidate cache for these items
      setAccessCache(prev => {
        const newCache = { ...prev };
        navItemIds.forEach(id => {
          delete newCache[id];
        });
        return newCache;
      });

      // Refresh access control
      await refreshAccessControl();

      return response.data;
    } catch (error) {
      console.error('Batch update permissions error:', error);
      throw error;
    }
  }, [refreshAccessControl]);

  const batchSetAccessLevel = useCallback(async (navItemIds, userId, accessLevel) => {
    const currentToken = tokenRef.current;
    
    if (!currentToken || !userId || !navItemIds?.length || !accessLevel) {
      throw new Error('Invalid parameters for batch set access level');
    }

    try {
      const response = await api.put('/navigation/batch/access-level', {
        userId: safeParseInt(userId),
        navItemIds: navItemIds.map(id => safeParseInt(id)),
        accessLevel: accessLevel
      }, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Invalidate cache for these items
      setAccessCache(prev => {
        const newCache = { ...prev };
        navItemIds.forEach(id => {
          delete newCache[id];
        });
        return newCache;
      });

      // Refresh access control
      await refreshAccessControl();

      return response.data;
    } catch (error) {
      console.error('Batch set access level error:', error);
      throw error;
    }
  }, [refreshAccessControl]);

  const batchApplyTemplate = useCallback(async (navItemIds, userId, templateId) => {
    const currentToken = tokenRef.current;
    
    if (!currentToken || !userId || !navItemIds?.length || !templateId) {
      throw new Error('Invalid parameters for batch apply template');
    }

    try {
      const response = await api.post('/navigation/batch/apply-template', {
        userId: safeParseInt(userId),
        navItemIds: navItemIds.map(id => safeParseInt(id)),
        templateId: safeParseInt(templateId)
      }, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Invalidate cache for these items
      setAccessCache(prev => {
        const newCache = { ...prev };
        navItemIds.forEach(id => {
          delete newCache[id];
        });
        return newCache;
      });

      // Refresh access control
      await refreshAccessControl();

      return response.data;
    } catch (error) {
      console.error('Batch apply template error:', error);
      throw error;
    }
  }, [refreshAccessControl]);

  // ============================================================================
  // WEBSOCKET INTEGRATION WITH SMART REFRESH
  // ============================================================================

  useEffect(() => {
    if (!token || tempToken || !user?.UserID) {
      permissionWebSocket.disconnect();
      setWebsocketStatus('disconnected');
      reloadScheduledRef.current = false;
      return;
    }

    setWebsocketStatus('connecting');
    
    try {
      permissionWebSocket.connect(token);
      
      const unsubscribe = permissionWebSocket.subscribe((updateData) => {
        console.log('📨 WebSocket permission update received:', updateData);
        
        const updatedRoutePaths = updateData.routes || updateData.affectedRoutes || [];
        const affectedUserIds = updateData.userIds || [];
        
        const isCurrentUserAffected = affectedUserIds.length === 0 || 
                                    affectedUserIds.includes(user.UserID) ||
                                    affectedUserIds.includes(parseInt(user.UserID));
        
        if (isCurrentUserAffected) {
          console.log('🎯 Current user affected by permission change!');
          console.log('👤 User ID:', user.UserID);
          console.log('📝 Affected routes:', updatedRoutePaths);
          
          // Mark that permission change was detected
          permissionChangeDetectedRef.current = true;
          
          // Update permissions in context (real-time update without reload)
          notifyPermissionUpdate(updatedRoutePaths);
          
          // Refresh the actual permission data
          if (loadUserAccessRef.current) {
            loadUserAccessRef.current();
          }
          
          // Show notification about permission change
          window.dispatchEvent(new CustomEvent('show-notification', {
            detail: {
              message: 'Your permissions have been updated',
              type: 'info',
              autoHide: true,
              duration: 5000
            }
          }));
          
          // Check if we should do a full page reload
          const currentRoute = window.location.pathname;
          const isAuthorizationPage = currentRoute.includes('/authorization');
          const isAffectedRoute = updatedRoutePaths.some(route => 
            currentRoute.includes(route) || route.includes(currentRoute)
          );
          
          // Only reload page if:
          // 1. Auto-refresh is enabled
          // 2. Not already scheduled
          // 3. Not on authorization page (to prevent loop)
          // 4. Current page is directly affected by the permission change
          if (autoRefreshEnabled && 
              !reloadScheduledRef.current && 
              !isAuthorizationPage && 
              isAffectedRoute) {
            
            console.log('🔄 Scheduling page reload - current route is affected by permission change');
            reloadScheduledRef.current = true;
            
            window.dispatchEvent(new CustomEvent('show-notification', {
              detail: {
                message: 'Your permissions changed on this page. Reloading in 3 seconds...',
                type: 'warning',
                autoHide: false,
                duration: 3000
              }
            }));
            
            setTimeout(() => {
              console.log('🔄 Reloading page due to affected route permission change...');
              window.location.reload();
            }, 3000);
          } else if (isAuthorizationPage) {
            console.log('ℹ️ On authorization page - skipping auto-reload to prevent loop');
          } else if (!isAffectedRoute) {
            console.log('ℹ️ Current route not affected - permissions updated in background');
          } else if (reloadScheduledRef.current) {
            console.log('⏳ Reload already scheduled - ignoring duplicate message');
          }
        } else {
          console.log('ℹ️ Permission update not for current user');
          console.log('👤 Current User ID:', user.UserID);
          console.log('👥 Affected User IDs:', affectedUserIds);
        }
      });

      setTimeout(() => {
        if (permissionWebSocket.connected) {
          setWebsocketStatus('connected');
          console.log('✅ WebSocket connected - real-time permission updates enabled');
        } else {
          setWebsocketStatus('disconnected');
          console.log('⚠️ WebSocket connection failed - will use scheduled refresh');
        }
      }, 1000);

      return () => {
        unsubscribe();
        reloadScheduledRef.current = false;
      };
    } catch (error) {
      console.error('❌ WebSocket setup error:', error);
      setWebsocketStatus('error');
      reloadScheduledRef.current = false;
    }
  }, [token, tempToken, user?.UserID, notifyPermissionUpdate, autoRefreshEnabled]);

  // ============================================================================
  // SMART SCHEDULED REFRESH (6-Hour Interval)
  // ============================================================================

  useEffect(() => {
    if (!user?.UserID || !token || tempToken) {
      return;
    }

    // Initialize last refresh time if not set
    if (!lastFullRefreshRef.current) {
      lastFullRefreshRef.current = Date.now();
      console.log('🕐 Initialized permission refresh timer');
    }

    // Lightweight permission check (every 5 minutes)
    const checkInterval = setInterval(() => {
      const timeSinceLastRefresh = Date.now() - lastFullRefreshRef.current;
      const timeRemaining = FULL_REFRESH_INTERVAL - timeSinceLastRefresh;
      
      console.log(`⏱️ Time until next full refresh: ${Math.round(timeRemaining / 1000 / 60)} minutes`);
      
      // Check if 6 hours have passed
      if (timeSinceLastRefresh >= FULL_REFRESH_INTERVAL) {
        console.log('🔄 6-hour interval reached - performing scheduled permission refresh');
        
        // Update the last refresh timestamp
        lastFullRefreshRef.current = Date.now();
        
        // Refresh permissions
        refreshPermissions();
        
        // Show notification
        window.dispatchEvent(new CustomEvent('show-notification', {
          detail: {
            message: 'Refreshing permissions (scheduled update)',
            type: 'info',
            autoHide: true,
            duration: 3000
          }
        }));
      }
      // Also check if permission change was detected but not acted upon
      else if (permissionChangeDetectedRef.current && timeSinceLastRefresh > 60000) {
        console.log('🔄 Permission change detected - refreshing data');
        refreshPermissions();
        permissionChangeDetectedRef.current = false;
      }
    }, PERMISSION_CHECK_INTERVAL);

    return () => {
      clearInterval(checkInterval);
    };
  }, [user?.UserID, token, tempToken, refreshPermissions]);

  // ============================================================================
  // MANUAL REFRESH HELPERS
  // ============================================================================

  const forcePermissionRefresh = useCallback(async () => {
    console.log('🔄 Manual permission refresh triggered');
    lastFullRefreshRef.current = Date.now();
    await refreshPermissions();
    
    window.dispatchEvent(new CustomEvent('show-notification', {
      detail: {
        message: 'Permissions refreshed successfully',
        type: 'success',
        autoHide: true,
        duration: 2000
      }
    }));
  }, [refreshPermissions]);

  const getTimeUntilRefresh = useCallback(() => {
    if (!lastFullRefreshRef.current) {
      return FULL_REFRESH_INTERVAL;
    }
    const timeSinceLastRefresh = Date.now() - lastFullRefreshRef.current;
    return Math.max(0, FULL_REFRESH_INTERVAL - timeSinceLastRefresh);
  }, []);

  // ============================================================================
  // WEBSOCKET UTILITIES
  // ============================================================================

  const getWebSocketStatus = useCallback(() => {
    return {
      status: websocketStatus,
      connected: permissionWebSocket.connected,
      url: permissionWebSocket.socket?.url,
      autoRefreshEnabled
    };
  }, [websocketStatus, autoRefreshEnabled]);

  const reconnectWebSocket = useCallback(() => {
    if (!token || tempToken) {
      console.log('⚠️ Cannot reconnect WebSocket');
      return;
    }
    
    console.log('🔄 Manually reconnecting WebSocket...');
    setWebsocketStatus('connecting');
    permissionWebSocket.disconnect();
    setTimeout(() => {
      permissionWebSocket.connect(token);
    }, 100);
  }, [token, tempToken]);

  const toggleAutoRefresh = useCallback((enabled) => {
    setAutoRefreshEnabled(enabled);
    console.log(`🔄 Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  // ============================================================================
  // ACCESS CONTROL METHODS
  // ============================================================================

  const hasNavItemAccess = useCallback((navItemId, requiredAccess = 'view_only') => {
    if (!user?.UserID) return false;
    if (user.IsSuperUser) return true;

    const cached = getCachedAccess(navItemId);
    if (cached) {
      return accessHierarchy[cached.accessLevel] >= accessHierarchy[requiredAccess];
    }

    const access = accessControlMap[navItemId];
    if (!access) return false;

    return accessHierarchy[access.accessLevel] >= accessHierarchy[requiredAccess];
  }, [user, accessControlMap, accessHierarchy, getCachedAccess]);

  const hasNavItemAccessByName = useCallback((navItemName, requiredAccess = 'view_only') => {
    if (!user?.UserID) return false;
    if (user.IsSuperUser) return true;

    const key = navItemName?.toLowerCase().trim();
    const access = accessControlMap[key];
    if (!access) return false;

    return accessHierarchy[access.accessLevel] >= accessHierarchy[requiredAccess];
  }, [user, accessControlMap, accessHierarchy]);

  const hasDatabaseAccess = useCallback((databaseId, requiredAccess = 'view_only') => {
    if (!user?.UserID) return false;
    if (user.IsSuperUser) return true;

    const database = userAccess.databases.find(db => db.DatabaseID === databaseId);
    if (!database) return false;

    return accessHierarchy[database.AccessLevel] >= accessHierarchy[requiredAccess];
  }, [user, userAccess.databases, accessHierarchy]);

  const getNavItemAccessLevel = useCallback((navItemId) => {
    if (!user?.UserID) return 'no_access';
    if (user.IsSuperUser) return 'full_access';

    const cached = getCachedAccess(navItemId);
    if (cached) return cached.accessLevel;

    const access = accessControlMap[navItemId];
    return access?.accessLevel || 'no_access';
  }, [user, accessControlMap, getCachedAccess]);

  const getNavItemAccessLevelByName = useCallback((navItemName) => {
    if (!user?.UserID) return 'no_access';
    if (user.IsSuperUser) return 'full_access';

    const key = navItemName?.toLowerCase().trim();
    const access = accessControlMap[key];
    return access?.accessLevel || 'no_access';
  }, [user, accessControlMap]);

  const getAccessDetails = useCallback((navItemId) => {
    if (!user?.UserID) return null;
    
    if (user.IsSuperUser) {
      const fullAccessPerms = legacyToPermissions('full_access');
      return {
        accessLevel: 'full_access',
        accessLevelId: 3,
        accessSource: 'superuser',
        sourceLabel: 'Superuser',
        hasIndividualOverride: false,
        permissions: fullAccessPerms,
        permissionSummary: getPermissionSummary(fullAccessPerms)
      };
    }

    const cached = getCachedAccess(navItemId);
    if (cached) return cached;

    const access = accessControlMap[navItemId];
    if (!access) {
      const noAccessPerms = legacyToPermissions('no_access');
      return {
        accessLevel: 'no_access',
        accessLevelId: 1,
        accessSource: 'none',
        sourceLabel: 'No Access',
        hasIndividualOverride: false,
        permissions: noAccessPerms,
        permissionSummary: getPermissionSummary(noAccessPerms)
      };
    }

    return access;
  }, [user, accessControlMap, getCachedAccess]);

  const hasIndividualOverride = useCallback((navItemId) => {
    const details = getAccessDetails(navItemId);
    return details?.hasIndividualOverride || false;
  }, [getAccessDetails]);

  const getAccessExplanation = useCallback((navItemId) => {
    const details = getAccessDetails(navItemId);
    if (!details) return 'Access information not available';

    const accessLabel = details.accessLevel === 'full_access' ? 'Full Access' :
                       details.accessLevel === 'view_only' ? 'View Only' : 'No Access';

    if (details.accessSource === 'superuser') {
      return `Superuser access: ${accessLabel}`;
    }

    return `${accessLabel} (from ${details.sourceLabel})`;
  }, [getAccessDetails]);

  const getNavItemPermissions = useCallback((navItemId) => {
    if (!user?.UserID) return legacyToPermissions('no_access');
    if (user.IsSuperUser) return legacyToPermissions('full_access');

    const cached = getCachedAccess(navItemId);
    if (cached) return cached.permissions;

    const access = accessControlMap[navItemId];
    return access?.permissions || legacyToPermissions('no_access');
  }, [user, accessControlMap, getCachedAccess]);

  const getNavItemPermissionsByName = useCallback((navItemName) => {
    if (!user?.UserID) return legacyToPermissions('no_access');
    if (user.IsSuperUser) return legacyToPermissions('full_access');

    const key = navItemName?.toLowerCase().trim();
    const access = accessControlMap[key];
    return access?.permissions || legacyToPermissions('no_access');
  }, [user, accessControlMap]);

  const hasPermission = useCallback((navItemId, permissionKey) => {
    const permissions = getNavItemPermissions(navItemId);
    return permissions[permissionKey] || false;
  }, [getNavItemPermissions]);

  const hasAllPermissions = useCallback((navItemId, permissionKeys) => {
    const permissions = getNavItemPermissions(navItemId);
    return permissionKeys.every(key => permissions[key]);
  }, [getNavItemPermissions]);

  const hasSomePermission = useCallback((navItemId, permissionKeys) => {
    const permissions = getNavItemPermissions(navItemId);
    return permissionKeys.some(key => permissions[key]);
  }, [getNavItemPermissions]);

  const canCreate = useCallback((navItemId) => {
    return hasPermission(navItemId, CRUD_PERMISSIONS.CREATE);
  }, [hasPermission]);

  const canRead = useCallback((navItemId) => {
    return hasPermission(navItemId, CRUD_PERMISSIONS.READ);
  }, [hasPermission]);

  const canUpdate = useCallback((navItemId) => {
    return hasPermission(navItemId, CRUD_PERMISSIONS.UPDATE);
  }, [hasPermission]);

  const canDelete = useCallback((navItemId) => {
    return hasPermission(navItemId, CRUD_PERMISSIONS.DELETE);
  }, [hasPermission]);

  const canExport = useCallback((navItemId) => {
    return hasPermission(navItemId, CRUD_PERMISSIONS.EXPORT);
  }, [hasPermission]);

  const canImport = useCallback((navItemId) => {
    return hasPermission(navItemId, CRUD_PERMISSIONS.IMPORT);
  }, [hasPermission]);

  const getPermissionSummaryText = useCallback((navItemId) => {
    const permissions = getNavItemPermissions(navItemId);
    return getPermissionSummary(permissions);
  }, [getNavItemPermissions]);

  const hasAnyAccess = useCallback((navItemId) => {
    const permissions = getNavItemPermissions(navItemId);
    return Object.values(permissions).some(val => val === true);
  }, [getNavItemPermissions]);

  const hasRouteAccess = useCallback((routePath, requiredAccess = 'view_only') => {
    if (!user?.UserID) return false;
    if (user.IsSuperUser) return true;
    if (!routePath) return false;

    const cleanPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    
    const navItem = userAccess.navigationItems.find(item => {
      const itemPath = item.RoutePath?.startsWith('/') ? item.RoutePath : `/${item.RoutePath}`;
      return itemPath === cleanPath;
    });

    if (!navItem || !navItem.CanView) return false;

    if (requiredAccess === 'full_access') {
      return navItem.CanCreate || navItem.CanEdit || navItem.CanDelete;
    }

    return true;
  }, [user, userAccess.navigationItems]);

  const getRouteAccessDetails = useCallback((routePath) => {
    if (!user?.UserID) return null;
    
    if (user.IsSuperUser) {
      const fullAccessPerms = legacyToPermissions('full_access');
      return {
        accessLevel: 'full_access',
        accessLevelId: 3,
        accessSource: 'superuser',
        sourceLabel: 'Superuser',
        hasIndividualOverride: false,
        permissions: fullAccessPerms,
        permissionSummary: getPermissionSummary(fullAccessPerms),
        routePath: routePath
      };
    }

    const cleanPath = routePath?.startsWith('/') ? routePath : `/${routePath}`;
    
    const navItem = userAccess.navigationItems.find(item => {
      const itemPath = item.RoutePath?.startsWith('/') ? item.RoutePath : `/${item.RoutePath}`;
      return itemPath === cleanPath;
    });

    if (!navItem) {
      const noAccessPerms = legacyToPermissions('no_access');
      return {
        accessLevel: 'no_access',
        accessLevelId: 1,
        accessSource: 'none',
        sourceLabel: 'No Access',
        hasIndividualOverride: false,
        permissions: noAccessPerms,
        permissionSummary: getPermissionSummary(noAccessPerms),
        routePath: routePath
      };
    }

    return getAccessDetails(navItem.NavItemID);
  }, [user, userAccess.navigationItems, getAccessDetails]);

  const getRoutePermissions = useCallback((routePath) => {
    const details = getRouteAccessDetails(routePath);
    return details?.permissions || legacyToPermissions('no_access');
  }, [getRouteAccessDetails]);

  const hasRoutePermission = useCallback((routePath, permissionKey) => {
    const permissions = getRoutePermissions(routePath);
    return permissions[permissionKey] || false;
  }, [getRoutePermissions]);

  const canReadRoute = useCallback((routePath) => {
    return hasRoutePermission(routePath, CRUD_PERMISSIONS.READ);
  }, [hasRoutePermission]);

  const canCreateRoute = useCallback((routePath) => {
    return hasRoutePermission(routePath, CRUD_PERMISSIONS.CREATE);
  }, [hasRoutePermission]);

  const canUpdateRoute = useCallback((routePath) => {
    return hasRoutePermission(routePath, CRUD_PERMISSIONS.UPDATE);
  }, [hasRoutePermission]);

  const canDeleteRoute = useCallback((routePath) => {
    return hasRoutePermission(routePath, CRUD_PERMISSIONS.DELETE);
  }, [hasRoutePermission]);

  const canExportRoute = useCallback((routePath) => {
    return hasRoutePermission(routePath, CRUD_PERMISSIONS.EXPORT);
  }, [hasRoutePermission]);

  const getRoutePermissionSummary = useCallback((routePath) => {
    const permissions = getRoutePermissions(routePath);
    return getPermissionSummary(permissions);
  }, [getRoutePermissions]);

  // ============================================================================
  // LOAD USER ACCESS ON AUTH CHANGE
  // ============================================================================

  useEffect(() => {
    if (user?.UserID && token && !tempToken) {
      loadUserAccess();
    } else {
      setUserAccess({
        navigationItems: [],
        databases: [],
        isLoading: false,
        lastUpdated: null,
        error: null
      });
      setAccessControlMap({});
      setAccessCache({});
      setCacheTimestamp(null);
      hasLoadedAccessRef.current = false;
      isLoadingRef.current = false;
      
      permissionWebSocket.disconnect();
      setWebsocketStatus('disconnected');
    }
  }, [user?.UserID, token, tempToken, loadUserAccess]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue = useMemo(() => ({
    userAccess,
    accessControlMap,
    hasNavItemAccess,
    hasNavItemAccessByName,
    hasDatabaseAccess,
    getNavItemAccessLevel,
    getNavItemAccessLevelByName,
    getAccessDetails,
    getAccessExplanation,
    hasIndividualOverride,
    getNavItemPermissions,
    getNavItemPermissionsByName,
    hasPermission,
    hasAllPermissions,
    hasSomePermission,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canExport,
    canImport,
    getPermissionSummaryText,
    hasAnyAccess,
    hasRouteAccess,
    getRouteAccessDetails,
    getRoutePermissions,
    hasRoutePermission,
    canReadRoute,
    canCreateRoute,
    canUpdateRoute,
    canDeleteRoute,
    canExportRoute,
    getRoutePermissionSummary,
    refreshAccessControl,
    getValidAccessLevels,
    refreshPermissions,
    subscribeToPermissionUpdates,
    notifyPermissionUpdate,
    lastPermissionUpdate,
    websocketStatus,
    getWebSocketStatus,
    reconnectWebSocket,
    toggleAutoRefresh,
    autoRefreshEnabled,
    // Batch functions
    batchRemoveIndividualOverrides,
    batchUpdatePermissions,
    batchSetAccessLevel,
    batchApplyTemplate,
    // NEW: Manual refresh functions
    forcePermissionRefresh,
    getTimeUntilRefresh,
    lastFullRefresh: lastFullRefreshRef.current,
    FULL_REFRESH_INTERVAL,
    PERMISSION_CHECK_INTERVAL,
    // Status
    isLoading: userAccess.isLoading,
    error: userAccess.error,
    lastUpdated: userAccess.lastUpdated,
    isSuperUser: user?.IsSuperUser || false
  }), [userAccess, accessControlMap, hasNavItemAccess, hasNavItemAccessByName, hasDatabaseAccess, getNavItemAccessLevel, getNavItemAccessLevelByName,
    getAccessDetails, getAccessExplanation, hasIndividualOverride, getNavItemPermissions, getNavItemPermissionsByName, hasPermission, hasAllPermissions,
    hasSomePermission, canCreate, canRead, canUpdate, canDelete, canExport, canImport, getPermissionSummaryText, hasAnyAccess, hasRouteAccess, getRouteAccessDetails,
    getRoutePermissions, hasRoutePermission, canReadRoute, canCreateRoute, canUpdateRoute, canDeleteRoute, canExportRoute, getRoutePermissionSummary,
    refreshAccessControl, getValidAccessLevels, refreshPermissions, subscribeToPermissionUpdates, notifyPermissionUpdate, lastPermissionUpdate, websocketStatus,
    getWebSocketStatus, reconnectWebSocket, toggleAutoRefresh, autoRefreshEnabled, batchRemoveIndividualOverrides, batchUpdatePermissions, batchSetAccessLevel,
    batchApplyTemplate, forcePermissionRefresh, getTimeUntilRefresh, user?.IsSuperUser]);

  return (
    <AccessControlContext.Provider value={contextValue}>
      {children}
    </AccessControlContext.Provider>
  );
};
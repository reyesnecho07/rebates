// frontend/src/hooks/useNavItems.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Home, 
  FileText, 
  BarChart2, 
  Users, 
  Package, 
  User,
  Settings,
  Database,
  Shield,
  Layout
} from 'lucide-react';

// Map route names to icons
const iconMap = {
  'dashboard': Home,
  'rebatesetup': FileText,
  'reports': BarChart2,
  'customer': Users,
  'customerrecords': Users,
  'items': Package,
  'itemrecords': Package,
  'salesemployee': User,
  'users': Users,
  'authorization': Shield,
  'navigation': Layout,
  'database': Database,
  'settings': Settings,
  'groups': Users,
  'preferences': Settings
};

// Map database IDs to path prefixes
const getPathPrefix = (dbName) => {
  if (dbName === 'NEXCHEM_DB') return '/nexchem';
  if (dbName === 'VAN_DB') return '/van';
  if (dbName === 'VCP_DB') return '/vcp';
  if (dbName === 'UserDB_v1.2') return '/ums';
  return `/${dbName.toLowerCase().replace('_db', '')}`;
};

// Extract base route name from full route path
const extractRouteInfo = (routePath) => {
  if (!routePath) return { name: '', icon: FileText };
  
  // Remove leading slash and split
  const parts = routePath.replace(/^\//, '').split('_');
  
  // Get the last part and convert to lowercase
  const lastPart = parts[parts.length - 1]?.toLowerCase() || '';
  
  // Map to display name
  const displayNameMap = {
    'dashboard': 'Dashboard',
    'rebatesetup': 'Rebate Setup',
    'reports': 'Reports',
    'customerrecords': 'Customers',
    'customer': 'Customers',
    'itemrecords': 'Items',
    'items': 'Items',
    'salesemployee': 'Sales Employees',
    'users': 'Users',
    'authorization': 'Authorization',
    'navigation': 'Navigation Items',
    'database': 'Databases',
    'groups': 'Groups',
    'preferences': 'Preferences'
  };
  
  return {
    name: displayNameMap[lastPart] || lastPart,
    icon: iconMap[lastPart] || FileText,
    basePath: lastPart
  };
};

export const useNavItems = () => {
  const { user, token } = useAuth();
  const [navItems, setNavItems] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});

  const loadNavItemsForDatabase = useCallback(async (databaseId, dbName) => {
    // Skip if already loaded or loading
    if (navItems[databaseId] || loading[databaseId]) {
      return navItems[databaseId];
    }

    setLoading(prev => ({ ...prev, [databaseId]: true }));
    setError(prev => ({ ...prev, [databaseId]: null }));

    try {
      console.log(`📋 Loading nav items for database ${databaseId} (${dbName})`);
      
      const response = await api.get(`/navigation/by-database/${databaseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success && Array.isArray(response.data.data)) {
        const pathPrefix = getPathPrefix(dbName);
        
        // Transform API response to sidebar items
        const items = response.data.data
          .filter(item => item.CanView === 1 || item.CanView === true) // Only show items user can view
          .map(item => {
            const { name, icon } = extractRouteInfo(item.RoutePath);
            
            // Generate frontend path from RoutePath
            const routeParts = item.RoutePath?.replace(/^\//, '').split('_') || [];
            const lastPart = routeParts[routeParts.length - 1]?.toLowerCase() || '';
            
            // Map to frontend path format
            const pathMap = {
              'dashboard': `${pathPrefix}/dashboard`,
              'rebatesetup': `${pathPrefix}/rebatesetup`,
              'reports': `${pathPrefix}/reports`,
              'customerrecords': `${pathPrefix}/customers`,
              'itemrecords': `${pathPrefix}/items`,
              'salesemployee': `${pathPrefix}/sales-employees`,
              'users': '/ums/users',
              'authorization': '/ums/authorization',
              'database': '/ums/databases',
              'navigation': '/ums/navigation'
            };
            
            return {
              id: item.NavItemID,
              navItemName: item.NavItemName,
              label: name,
              path: pathMap[lastPart] || `${pathPrefix}/${lastPart}`,
              fullPath: item.RoutePath,
              icon: icon,
              canView: item.CanView === 1 || item.CanView === true,
              canCreate: item.CanCreate === 1 || item.CanCreate === true,
              canEdit: item.CanEdit === 1 || item.CanEdit === true,
              canDelete: item.CanDelete === 1 || item.CanDelete === true,
              sortOrder: item.SortOrder || 999,
              parentId: item.ParentID
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
        
        setNavItems(prev => ({
          ...prev,
          [databaseId]: items
        }));
        
        return items;
      }
      
      return [];
      
    } catch (err) {
      console.error(`Error loading nav items for database ${databaseId}:`, err);
      setError(prev => ({
        ...prev,
        [databaseId]: err.response?.data?.message || err.message
      }));
      
      // Return empty array on error
      return [];
    } finally {
      setLoading(prev => ({ ...prev, [databaseId]: false }));
    }
  }, [token, navItems, loading]);

  // Get nav items for a specific database
  const getNavItems = useCallback((databaseId) => {
    return navItems[databaseId] || [];
  }, [navItems]);

  // Check if user has specific permission for a nav item
  const hasPermission = useCallback((databaseId, navItemId, permission) => {
    const items = navItems[databaseId] || [];
    const item = items.find(i => i.id === navItemId);
    return item?.[permission] || false;
  }, [navItems]);

  // Clear cached nav items
  const clearCache = useCallback(() => {
    setNavItems({});
    setLoading({});
    setError({});
  }, []);

  return {
    navItems,
    loading,
    error,
    loadNavItemsForDatabase,
    getNavItems,
    hasPermission,
    clearCache
  };
};
// frontend/src/context/DatabaseAccessContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';

const DatabaseAccessContext = createContext();

export const useDatabaseAccess = () => {
  const context = useContext(DatabaseAccessContext);
  if (!context) {
    throw new Error('useDatabaseAccess must be used within DatabaseAccessProvider');
  }
  return context;
};

export const DatabaseAccessProvider = ({ children }) => {
  const { user, token, tempToken, trackEvent } = useAuth();
  
  const [databases, setDatabases] = useState([]);
  const [allDatabases, setAllDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Load user's accessible databases
  const loadUserDatabases = useCallback(async () => {
    // Prevent duplicate loads
    if (isLoadingRef.current || hasLoadedRef.current) {
      console.log('⏭️ Databases already loading or loaded, skipping');
      return;
    }

    if (!user?.UserID || !token || tempToken) {
      console.log('⏭️ No user or token, skipping database load');
      setLoading(false);
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log('📊 Loading databases for user:', user.UserID);
      
      // Get databases with user order preference
      const response = await api.get(`/databases/with-user-order?db=USER`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📊 Database response:', response.data);

      if (response.data.success && Array.isArray(response.data.data)) {
        const dbList = response.data.data;
        
        // Filter active and visible databases
        const visibleDatabases = dbList.filter(db => {
          // Check if database is active AND visible to user
          return db.IsActive === true && db.IsVisible !== false;
        });
        
        console.log(`✅ Loaded ${visibleDatabases.length} visible databases out of ${dbList.length} total`);
        
        // Sort by DisplayOrder
        const sortedDatabases = visibleDatabases.sort((a, b) => 
          (a.DisplayOrder || 999999) - (b.DisplayOrder || 999999)
        );
        
        setDatabases(sortedDatabases);
        setLastUpdated(new Date());
        hasLoadedRef.current = true;

        trackEvent('databases_loaded', {
          count: sortedDatabases.length,
          total: dbList.length
        });
      } else {
        console.warn('⚠️ No databases returned from API:', response.data);
        setDatabases([]);
        hasLoadedRef.current = true;
      }
    } catch (err) {
      console.error('❌ Error loading databases:', err);
      console.error('❌ Full error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        message: err.response?.data?.message,
        url: err.config?.url,
        baseURL: err.config?.baseURL,
      });
      
      setError(err.response?.data?.message || 'Failed to load databases');
      setDatabases([]);
      
      trackEvent('database_load_error', {
        error: err.message,
        status: err.response?.status
      });
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user?.UserID, token, tempToken, trackEvent]);

  // Load all databases (for admin users)
  const loadAllDatabases = useCallback(async () => {
    if (!user?.IsSuperUser || !token || tempToken) {
      return;
    }

    try {
      const response = await api.get(`/databases/all?db=USER`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success && Array.isArray(response.data.data)) {
        setAllDatabases(response.data.data);
      }
    } catch (err) {
      console.error('❌ Error loading all databases:', err);
    }
  }, [user?.IsSuperUser, token, tempToken]);

  // Load databases when user logs in
  useEffect(() => {
    if (user?.UserID && token && !tempToken) {
      loadUserDatabases();
      if (user?.IsSuperUser) {
        loadAllDatabases();
      }
    } else {
      setDatabases([]);
      setAllDatabases([]);
      setLoading(false);
      hasLoadedRef.current = false;
      isLoadingRef.current = false;
      setLastUpdated(null);
    }
  }, [user?.UserID, token, tempToken, user?.IsSuperUser, loadUserDatabases, loadAllDatabases]);

  // Get visible databases
  const getVisibleDatabases = useCallback(() => {
    return databases;
  }, [databases]);

  // Check if user has access to a specific database
  const hasDatabaseAccess = useCallback((databaseId) => {
    if (!user?.UserID) return false;
    if (user.IsSuperUser) return true;
    
    return databases.some(db => db.DatabaseID === databaseId);
  }, [user, databases]);

  // Get database by ID
  const getDatabaseById = useCallback((databaseId) => {
    return databases.find(db => db.DatabaseID === databaseId) || 
           allDatabases.find(db => db.DatabaseID === databaseId);
  }, [databases, allDatabases]);

  // Get database by name
  const getDatabaseByName = useCallback((databaseName) => {
    const nameLower = databaseName?.toLowerCase();
    return databases.find(db => db.DBName?.toLowerCase() === nameLower) ||
           allDatabases.find(db => db.DBName?.toLowerCase() === nameLower);
  }, [databases, allDatabases]);

  // Refresh databases
  const refreshDatabases = useCallback(async () => {
    hasLoadedRef.current = false;
    isLoadingRef.current = false;
    await loadUserDatabases();
    if (user?.IsSuperUser) {
      await loadAllDatabases();
    }
  }, [loadUserDatabases, loadAllDatabases, user?.IsSuperUser]);

  const value = {
    // State
    databases,
    allDatabases,
    loading,
    error,
    lastUpdated,
    
    // Basic access
    getVisibleDatabases,
    hasDatabaseAccess,
    getDatabaseById,
    getDatabaseByName,
    
    // Actions
    refreshDatabases,
  };

  return (
    <DatabaseAccessContext.Provider value={value}>
      {children}
    </DatabaseAccessContext.Provider>
  );
};
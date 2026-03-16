import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('userTheme');
    return savedTheme || 'light';
  });

  // Ref to prevent multiple simultaneous loads
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // API Base URL
  const API_BASE = 'http://192.168.100.193:3006/api/user';

  // Function to get current user ID
  const getCurrentUserId = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
      const userId = storedUser.UserID || storedUser.User_ID;
      
      // Validate userId - ensure it's not undefined, null, or invalid
      if (!userId || userId === 'undefined' || userId === 'null') {
        console.log('🎨 No valid user ID found');
        return null;
      }
      
      return userId;
    } catch (error) {
      console.error('🎨 Error parsing user from localStorage:', error);
      return null;
    }
  };

  // Function to save theme to database
  const saveThemeToDatabase = async (themeToSave) => {
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.log('🎨 No user ID found, saving to localStorage only');
      return;
    }

    try {
      console.log('🎨 Saving theme to database:', { userId, theme: themeToSave });
      
      const response = await axios.post(`${API_BASE}/preferences/save`, {
        userId: userId,
        preferenceKey: 'theme',
        preferenceValue: themeToSave.charAt(0).toUpperCase() + themeToSave.slice(1)
      });
      
      if (response.data.success) {
        console.log('✅ Theme saved to database successfully');
      }
    } catch (error) {
      console.error('❌ Error saving theme to database:', error.response?.data || error.message);
      // Theme is still saved in localStorage, so UI won't break
    }
  };

  // Function to load theme from database
  const loadThemeFromDatabase = async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current || hasLoadedRef.current) {
      console.log('🎨 Theme already loading or loaded, skipping');
      return;
    }

    const userId = getCurrentUserId();
    
    if (!userId) {
      console.log('🎨 No user ID, using localStorage theme');
      const localTheme = localStorage.getItem('userTheme');
      if (localTheme && localTheme !== theme) {
        setTheme(localTheme);
      }
      hasLoadedRef.current = true;
      return;
    }

    isLoadingRef.current = true;

    try {
      console.log('🎨 Loading theme from database for user:', userId);
      
      // FIXED: Add ?db=USER query parameter to match backend expectations
      const response = await axios.get(`${API_BASE}/preferences/${userId}/theme?db=USER`);
      
      if (response.data.success && response.data.value) {
        const dbTheme = response.data.value.toLowerCase();
        console.log('✅ Theme loaded from database:', dbTheme);
        
        // Only update if different from current theme
        if (dbTheme !== theme) {
          setTheme(dbTheme);
          localStorage.setItem('userTheme', dbTheme);
        }
      } else {
        console.log('⚠️ No theme preference found in database, using localStorage');
        const localTheme = localStorage.getItem('userTheme');
        if (localTheme && localTheme !== theme) {
          setTheme(localTheme);
        }
      }
    } catch (error) {
      console.error('❌ Error loading theme from database:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        userId: userId
      });
      
      // Use localStorage theme as fallback
      const localTheme = localStorage.getItem('userTheme');
      if (localTheme && localTheme !== theme) {
        console.log('🎨 Using localStorage theme as fallback:', localTheme);
        setTheme(localTheme);
      }
    } finally {
      isLoadingRef.current = false;
      hasLoadedRef.current = true;
    }
  };

  // Apply theme to DOM
  const applyTheme = (themeToApply) => {
    if (themeToApply === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else if (themeToApply === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    } else {
      // System theme
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (systemTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.body.classList.add('dark');
        document.body.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        document.body.classList.add('light');
        document.body.classList.remove('dark');
      }
    }
  };

  // Update theme function (for user-initiated changes)
  const changeTheme = (newTheme) => {
    console.log('🎨 Changing theme to:', newTheme);
    setTheme(newTheme);
    localStorage.setItem('userTheme', newTheme);
    
    // Save to database in background
    saveThemeToDatabase(newTheme);
  };

  // FIXED: Single useEffect for loading theme on mount
  useEffect(() => {
    // Load theme from database once on mount
    loadThemeFromDatabase();
  }, []); // Empty dependency array - only run once on mount

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for storage events (when theme changes in another tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'userTheme' && e.newValue && e.newValue !== theme) {
        console.log('🎨 Theme changed in another tab:', e.newValue);
        setTheme(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [theme]);

  const value = {
    theme,
    changeTheme, // Use changeTheme instead of updateTheme for consistency
    updateTheme: changeTheme, // Keep updateTheme for backward compatibility
    loadThemeFromDatabase, // Expose for manual refresh if needed
    saveThemeToDatabase // Expose for manual save if needed
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
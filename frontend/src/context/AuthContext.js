// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';           // keep — used for setting default headers
import api from '../api/axios'; 
import { getSessionId, setComponentMetadata, extractRequestMetadata } from '../api/axios';
import { useTheme } from '../context/ThemeContext';
import { userPreferencesAPI } from '../api/userPreferences';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [tempToken, setTempToken] = useState(() => {
    const stored = sessionStorage.getItem('tempToken');
    return stored;
  });
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(() => getSessionId());
  const { theme, changeTheme } = useTheme();
  
  // Track if user has been loaded to prevent duplicate loads
  const hasLoadedUserRef = useRef(false);
  const isLoadingUserRef = useRef(false);

  // Initialize component metadata on mount
  useEffect(() => {
    setComponentMetadata('AuthContext', '2.0.0');
  }, []);

  // Load user's theme preference from database
  const loadUserTheme = useCallback(async (userId) => {
    try {
      if (!userId) {
        console.log('🎨 No userId provided for theme loading');
        return;
      }

      console.log('🎨 Loading theme preference for user:', userId);
      
      // Use the userPreferencesAPI to get theme preference
      const preferences = await userPreferencesAPI.getUserPreferences(userId);
      const themePreference = preferences.find(p => p.PreferenceKey === 'theme');
      
      if (themePreference && themePreference.PreferenceValue) {
        const dbTheme = themePreference.PreferenceValue.toLowerCase();
        // Only update if different from current theme
        if (dbTheme !== theme) {
          console.log('🎨 Applying theme from database:', dbTheme);
          changeTheme(dbTheme);
        } else {
          console.log('🎨 Theme already matches database theme:', dbTheme);
        }
      } else {
        console.log('🎨 No theme preference found in database, using current theme');
      }
    } catch (error) {
      console.error('❌ Error loading theme from database:', error);
      // Fallback to localStorage theme
      const localTheme = localStorage.getItem('userTheme');
      if (localTheme && localTheme !== theme) {
        console.log('🎨 Using fallback localStorage theme:', localTheme);
        changeTheme(localTheme);
      }
    }
  }, [theme, changeTheme]);

  // Enhanced logout with tracking metadata
  const logout = useCallback((reason = 'user_initiated') => {
    const metadata = extractRequestMetadata();
    
    console.log('👋 Logout:', {
      reason,
      userId: user?.UserID,
      sessionId: metadata.sessionId,
      timestamp: new Date().toISOString()
    });

    if (window.analytics?.track) {
      window.analytics.track('User Logout', {
        reason,
        userId: user?.UserID,
        sessionId: metadata.sessionId,
        ...metadata
      });
    }

    // Clear state
    setUser(null);
    setToken(null);
    setTempToken(null);
    localStorage.removeItem('token');
    sessionStorage.removeItem('tempToken');
    delete axios.defaults.headers.common['Authorization'];
    
    // Reset refs
    hasLoadedUserRef.current = false;
    isLoadingUserRef.current = false;

    // Generate new session ID for next login
    setSessionId(getSessionId(true));
  }, [user]);

  const loadUser = useCallback(async () => {
    // Prevent duplicate/concurrent loads
    if (hasLoadedUserRef.current || isLoadingUserRef.current) {
      console.log('⏭️ User already loaded or loading, skipping');
      return;
    }

    isLoadingUserRef.current = true;

    try {
      const response = await api.get('/auth/me');
      const userData = response.data;
      setUser(userData);
      hasLoadedUserRef.current = true;

      console.log('✅ User loaded:', {
        userId: userData.UserID,
        isSuperUser: userData.IsSuperUser,
        sessionId: getSessionId()
      });

      // Load user's theme preference after user data is loaded
      await loadUserTheme(userData.UserID);

    } catch (error) {
      console.error('Load user error:', error);
      logout('token_invalid');
    } finally {
      setLoading(false);
      isLoadingUserRef.current = false;
    }
  }, [logout, loadUserTheme]);

  // Set axios default authorization header only when token changes
  useEffect(() => {
    console.log('🔐 Auth state changed - token:', !!token, 'tempToken:', !!tempToken);
    
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Only load user if not already loaded
      if (!hasLoadedUserRef.current) {
        loadUser();
      } else {
        setLoading(false);
      }
    } else if (tempToken) {
      console.log('🔐 Setting tempToken in axios headers');
      axios.defaults.headers.common['Authorization'] = `Bearer ${tempToken}`;
      setLoading(false);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  }, [token, tempToken, loadUser]);

const login = async (userID, password) => {
  const metadata = extractRequestMetadata();

  try {
const response = await api.post('/auth/login', {   // api already has /api in baseURL
  userCode: userID,                                 // backend expects 'userCode'
  password,
  metadata
});

    console.log('🔐 Login response:', {
      success: response.data.success,
      hasToken: !!response.data.token,
      hasUser: !!response.data.user,
      requirePasswordChange: response.data.requirePasswordChange,
      isFirstLogin: response.data.isFirstLogin,
      OneLogPwd: response.data.OneLogPwd,
    });

    const {
      token: newToken,
      user: userData,
      requirePasswordChange,
      isFirstLogin,
      OneLogPwd
    } = response.data;

    // Check if password change is needed (OneLogPwd = 1 or requirePasswordChange = true)
    const needsPasswordChange = requirePasswordChange || isFirstLogin || OneLogPwd === 1;

    if (needsPasswordChange) {
      console.log('🔐 Password change required — setting tempToken');

      // For password change flow, generate a temporary token from the returned token
      // (authController now always returns a token)
      const tempTokenValue = newToken;

      sessionStorage.setItem('tempToken', tempTokenValue);
      setTempToken(tempTokenValue);
      setUser({
        ...userData,
        UserID: userData.UserID || userData.User_ID,
      });

      axios.defaults.headers.common['Authorization'] = `Bearer ${tempTokenValue}`;

      return {
        requirePasswordChange: true,
        user: userData,
        message: response.data.message
      };
    }

    // ── Normal login flow ──
    if (!newToken) {
      console.error('❌ No token in login response!');
      throw new Error('Login failed: no token received from server');
    }

    // Save token
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    // Normalize user object
    const normalizedUser = {
      ...userData,
      UserID: userData.UserID || userData.User_ID,
    };

    setToken(newToken);
    setUser(normalizedUser);
    setTempToken(null);
    sessionStorage.removeItem('tempToken');

    // Mark user as loaded
    hasLoadedUserRef.current = true;

    // Load theme
    await loadUserTheme(normalizedUser.UserID);

    console.log('✅ Login successful:', {
      UserID: normalizedUser.UserID,
      IsSuperUser: normalizedUser.IsSuperUser,
    });

    return { success: true, user: normalizedUser };

  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error.response?.data?.error || error.response?.data?.message || 'Login failed';
  }
};

const changePassword = async (currentPassword, newPassword) => {
  try {
    // Get userCode from current user state
    const userCode = user?.User_ID || user?.UserID || user?.userCode;

    if (!userCode) {
      throw new Error('No user session found. Please log in again.');
    }

    console.log('🔑 Changing password for:', userCode);

    const response = await axios.post('/api/auth/change-password', {
      userCode,
      currentPassword,
      newPassword,
    });

    const { token: newToken, user: userData } = response.data;

    if (!newToken) {
      throw new Error('No token returned after password change');
    }

    // Save new token — replaces tempToken
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    const normalizedUser = {
      ...userData,
      UserID: userData.UserID || userData.User_ID,
    };

    setToken(newToken);
    setUser(normalizedUser);
    setTempToken(null);
    sessionStorage.removeItem('tempToken');
    hasLoadedUserRef.current = true;

    await loadUserTheme(normalizedUser.UserID);

    console.log('✅ Password changed, user logged in:', normalizedUser.UserID);
    return { success: true };

  } catch (error) {
    console.error('❌ changePassword error:', error);
    throw error.response?.data?.error || error.response?.data?.message || 'Password change failed';
  }
};

  const completePasswordChange = async (newPassword) => {
    const metadata = extractRequestMetadata();
    
    try {
      console.log('🔐 Attempting to complete password change');
      
      const storedToken = sessionStorage.getItem('tempToken');
      const activeToken = tempToken || storedToken;
      
      if (!activeToken) {
        console.error('🔐 No token found in state or sessionStorage');
        throw new Error('No temporary token available. Please log in again.');
      }

      axios.defaults.headers.common['Authorization'] = `Bearer ${activeToken}`;

      const response = await axios.post('/api/auth/complete-password-change', {
        newPassword,
        metadata
      });

      const { token: newToken, user: userData } = response.data;

      console.log('🔐 Password change successful, setting new token');

      setTempToken(null);
      sessionStorage.removeItem('tempToken');
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      // Mark user as loaded
      hasLoadedUserRef.current = true;

      // Load and apply user's theme preference
      await loadUserTheme(userData.UserID);

      console.log('✅ Password change completed:', {
        userId: userData.UserID,
        sessionId,
        ...metadata
      });

      if (window.analytics?.track) {
        window.analytics.track('Password Change Completed', {
          userId: userData.UserID,
          sessionId,
          ...metadata
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Complete password change error:', error);
      throw error.response?.data?.message || 'Password change failed';
    }
  };

  const getSessionMetadata = useCallback(() => {
    return {
      sessionId,
      userId: user?.UserID,
      isSuperUser: user?.IsSuperUser,
      isAuthenticated: !!token || !!tempToken,
      hasTempToken: !!tempToken,
      ...extractRequestMetadata()
    };
  }, [sessionId, user, token, tempToken]);

  const trackEvent = useCallback((eventName, properties = {}) => {
    const metadata = getSessionMetadata();
    
    console.log(`📊 Event: ${eventName}`, {
      ...properties,
      ...metadata
    });

    if (window.analytics?.track) {
      window.analytics.track(eventName, {
        ...properties,
        ...metadata
      });
    }
  }, [getSessionMetadata]);

  const value = {
    user,
    token,
    tempToken,
    loading,
    
    login,
    logout,
    changePassword,
    completePasswordChange,
    isAuthenticated: !!token || !!tempToken,
    
    sessionId,
    getSessionMetadata,
    trackEvent,
    loadUserTheme // Expose this function if needed elsewhere
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
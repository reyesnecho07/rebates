// frontend/src/api/axios.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://192.168.100.193:3006';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

// ============================================================================
// COMPONENT METADATA REGISTRY
// ============================================================================

// Initialize window._componentMetadata if it doesn't exist
if (typeof window !== 'undefined' && !window._componentMetadata) {
  window._componentMetadata = {};
}

// Generate or retrieve session ID
export const getSessionId = () => {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};

// Component metadata for tracking - updated to include routePath and description
export const setComponentMetadata = (name, version = '1.0.0', routePath = '', description = '') => {
  // Store in global window object for collection
  if (typeof window !== 'undefined') {
    window._componentMetadata[name] = {
      name,
      version,
      routePath,
      description,
      registeredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }
  
  // Also set for current tracking
  currentComponentMetadata = { name, version, routePath, description };
};

// Get all registered components (for refreshing routes)
export const collectComponentMetadata = () => {
  if (typeof window !== 'undefined' && window._componentMetadata) {
    const components = [];
    Object.entries(window._componentMetadata).forEach(([name, data]) => {
      components.push({
        name,
        routePath: data.routePath || '',
        version: data.version || '1.0.0',
        description: data.description || ''
      });
    });
    return components;
  }
  return [];
};

// Get component metadata by name
export const getComponentMetadata = (name) => {
  if (typeof window !== 'undefined' && window._componentMetadata[name]) {
    return window._componentMetadata[name];
  }
  return null;
};

// Global component metadata for current session
let currentComponentMetadata = {
  name: 'Unknown',
  version: '1.0.0',
  routePath: '',
  description: ''
};

// Get current component metadata
export const getCurrentComponentMetadata = () => currentComponentMetadata;

// ============================================================================
// COMPONENT ROUTE MANAGEMENT
// ============================================================================

// Get available route paths (for dropdown)
export const getAvailableRoutePaths = async () => {
  try {
    const response = await api.get('/api/components/available-routes');
    return response.data;
  } catch (error) {
    console.error('Error loading available routes:', error);
    throw error;
  }
};

// Refresh/scan route paths from registered components
export const refreshRoutePaths = async () => {
  try {
    const components = collectComponentMetadata();
    const response = await api.post('/api/components/refresh-routes', {
      components
    });
    return response.data;
  } catch (error) {
    console.error('Error refreshing route paths:', error);
    throw error;
  }
};

// Check if a specific route is available
export const checkRouteAvailability = async (routePath) => {
  try {
    const response = await api.get(`/api/components/check-availability/${encodeURIComponent(routePath)}`);
    return response.data;
  } catch (error) {
    console.error('Error checking route availability:', error);
    throw error;
  }
};

// ============================================================================
// ANALYTICS FUNCTIONS - UPDATED
// ============================================================================

// Extract request metadata for logging
export const extractRequestMetadata = () => {
  return {
    userAgent: navigator.userAgent,
    componentName: currentComponentMetadata.name,
    componentVersion: currentComponentMetadata.version,
    routePath: currentComponentMetadata.routePath,
    description: currentComponentMetadata.description,
    sessionId: getSessionId(),
    userId: localStorage.getItem('userId') || sessionStorage.getItem('userId') || null,
    timestamp: new Date().toISOString(),
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href,
    referrer: document.referrer || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language
  };
};

// Enhanced logComponentView - includes route path and registers component
export const logComponentView = async (componentName, componentVersion, metadata = {}) => {
  try {
    const componentData = getComponentMetadata(componentName) || {};
    const baseMetadata = extractRequestMetadata();
    
    const payload = {
      componentName,
      componentVersion,
      routePath: componentData.routePath || '',
      description: componentData.description || '',
      metadata: { 
        ...baseMetadata, 
        ...metadata,
        // Include component registry info
        registry: {
          hasRoutePath: !!componentData.routePath,
          routePath: componentData.routePath || '',
          description: componentData.description || '',
          registeredAt: componentData.registeredAt || new Date().toISOString()
        }
      }
    };
    
    // Send to backend for ComponentAnalytics
    if (process.env.NODE_ENV === 'production' || process.env.REACT_APP_ENABLE_ANALYTICS === 'true') {
      const response = await api.post('/api/analytics/component-view', payload);
      
      // Also register component with route path in ComponentAnalytics
      if (componentData.routePath) {
        try {
          await api.post('/api/components/register', {
            componentName,
            version: componentVersion,
            routePath: componentData.routePath,
            description: componentData.description,
            metadata: payload.metadata,
            userId: baseMetadata.userId,
            sessionId: baseMetadata.sessionId
          });
        } catch (regError) {
          console.warn('Failed to register component route:', regError);
          // Non-critical, don't throw
        }
      }
      
      return response.data;
    } else {
      // Development: log to console
      // console.log('📊 Component View:', payload);
      return { success: true, message: 'Logged in development' };
    }
  } catch (error) {
    console.warn('Failed to log component view:', error);
    // Don't throw, analytics should not break the app
    return { success: false, error: error.message };
  }
};

// Enhanced logUserAction - includes component context
export const logUserAction = async (actionType, details = {}) => {
  try {
    const baseMetadata = extractRequestMetadata();
    const componentData = getCurrentComponentMetadata();
    
    const payload = {
      actionType,
      details,
      componentName: componentData.name,
      componentVersion: componentData.version,
      routePath: componentData.routePath,
      metadata: {
        ...baseMetadata,
        componentContext: {
          name: componentData.name,
          routePath: componentData.routePath
        }
      }
    };
    
    if (process.env.NODE_ENV === 'production' || process.env.REACT_APP_ENABLE_ANALYTICS === 'true') {
      const response = await api.post('/api/analytics/user-action', payload);
      return response.data;
    } else {
      // console.log('📊 User Action:', payload);
      return { success: true, message: 'Logged in development' };
    }
  } catch (error) {
    console.warn('Failed to log user action:', error);
    return { success: false, error: error.message };
  }
};

// Track analytics event with component context
export const trackAnalyticsEvent = async (eventType, eventData = {}) => {
  try {
    const baseMetadata = extractRequestMetadata();
    const componentData = getCurrentComponentMetadata();
    
    const payload = {
      eventType,
      eventData: {
        ...eventData,
        component: componentData.name,
        routePath: componentData.routePath
      },
      metadata: baseMetadata
    };
    
    if (process.env.NODE_ENV === 'production' || process.env.REACT_APP_ENABLE_ANALYTICS === 'true') {
      const response = await api.post('/api/analytics/event', payload);
      return response.data;
    } else {
      console.log('📊 Analytics Event:', payload);
      return { success: true };
    }
  } catch (error) {
    console.warn('Failed to track analytics event:', error);
    return { success: false };
  }
};

// Track page view with route path
export const trackPageView = async (pageName, pageData = {}) => {
  const componentData = getCurrentComponentMetadata();
  return trackAnalyticsEvent('page_view', {
    pageName,
    routePath: componentData.routePath || pageData.routePath,
    ...pageData
  });
};

// ============================================================================
// REQUEST INTERCEPTOR - ENHANCED WITH COMPONENT CONTEXT
// ============================================================================

api.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add metadata headers for tracking - SIMPLIFIED VERSION
    const sessionId = getSessionId();
    const { name, version, routePath } = currentComponentMetadata;

    // Only send essential headers that won't cause CORS issues
    config.headers['X-Component-Name'] = name;
    config.headers['X-Component-Version'] = version;
    config.headers['X-Session-Id'] = sessionId;
    
    // Remove these problematic headers for now
    // config.headers['X-Route-Path'] = routePath || '';
    // config.headers['X-Timestamp'] = new Date().toISOString();

    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 API Request: ${config.method.toUpperCase()} ${config.url}`, {
        component: name,
        routePath: routePath || 'N/A',
        sessionId: sessionId.substring(0, 20) + '...',
        // Log what headers we're actually sending
        headers: Object.keys(config.headers)
      });
    }

    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ============================================================================
// RESPONSE INTERCEPTOR - ENHANCED WITH COMPONENT CONTEXT
// ============================================================================

api.interceptors.response.use(
  (response) => {
    // Log successful response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.config.url}`, {
        status: response.status,
        component: currentComponentMetadata.name,
        routePath: currentComponentMetadata.routePath || 'N/A',
        data: response.data
      });
    }
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      console.warn('🔒 Unauthorized - Token expired or invalid');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.warn('🚫 Forbidden - Insufficient permissions', {
        component: currentComponentMetadata.name,
        routePath: currentComponentMetadata.routePath
      });
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      console.warn('❌ Not Found:', {
        url: error.config?.url,
        component: currentComponentMetadata.name
      });
    }

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      console.error('💥 Server Error:', {
        message: error.response.data?.message,
        component: currentComponentMetadata.name,
        routePath: currentComponentMetadata.routePath
      });
    }

    // Log all errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        component: currentComponentMetadata.name,
        routePath: currentComponentMetadata.routePath,
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });
    }

    // Log error to analytics
    if (error.response?.status >= 400) {
      logUserAction('api_error', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        error: error.response?.data?.message || error.message,
        component: currentComponentMetadata.name
      }).catch(() => {}); // Don't let analytics errors break the app
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// HELPER FUNCTIONS - ENHANCED
// ============================================================================

// Make API call with component context
export const apiWithContext = (componentName, componentVersion = '1.0.0', routePath = '', description = '') => {
  setComponentMetadata(componentName, componentVersion, routePath, description);
  return api;
};

// Helper to handle API errors consistently
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  const componentData = getCurrentComponentMetadata();
  
  if (error.response) {
    return {
      message: error.response.data?.message || defaultMessage,
      status: error.response.status,
      data: error.response.data,
      component: componentData.name,
      routePath: componentData.routePath
    };
  } else if (error.request) {
    return {
      message: 'No response from server. Please check your connection.',
      status: null,
      data: null,
      component: componentData.name,
      routePath: componentData.routePath
    };
  } else {
    return {
      message: error.message || defaultMessage,
      status: null,
      data: null,
      component: componentData.name,
      routePath: componentData.routePath
    };
  }
};

// Check if error is authentication related
export const isAuthError = (error) => {
  return error.response?.status === 401 || error.response?.status === 403;
};

// Check if error is network related
export const isNetworkError = (error) => {
  return !error.response && error.request;
};

// Retry failed request with exponential backoff
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  const componentData = getCurrentComponentMetadata();
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (i === maxRetries - 1 || isAuthError(error)) {
        throw error;
      }
      
      const waitTime = delay * Math.pow(2, i);
      console.log(`Retrying request in ${waitTime}ms... (attempt ${i + 2}/${maxRetries})`, {
        component: componentData.name,
        routePath: componentData.routePath
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// ============================================================================
// COMPONENT REGISTRY UTILITIES
// ============================================================================

// Initialize component on mount
export const initializeComponent = async (metadata) => {
  const { name, version, routePath, description } = metadata;
  
  // Set metadata
  setComponentMetadata(name, version, routePath, description);
  
  // Log component view
  await logComponentView(name, version, {
    action: 'component_initialized',
    routePath,
    description
  });
  
  // Register component with backend
  try {
    const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    const sessionId = getSessionId();
    
    await api.post('/api/components/register', {
      componentName: name,
      version,
      routePath,
      description,
      metadata: extractRequestMetadata(),
      userId,
      sessionId
    });
  } catch (error) {
    console.warn('Component registration failed:', error);
    // Non-critical, continue
  }
  
  return metadata;
};

// Get all registered components for debugging
export const getAllRegisteredComponents = () => {
  if (typeof window !== 'undefined') {
    return window._componentMetadata || {};
  }
  return {};
};

// Clear component registry (for testing)
export const clearComponentRegistry = () => {
  if (typeof window !== 'undefined') {
    window._componentMetadata = {};
  }
};

// ============================================================================
// EXPORTS
// ============================================================================
export default api;
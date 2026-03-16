import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";

// Import components
import AuthPage from "./components/AuthPage";
import HomePage from "./HomePage";
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { DatabaseAccessProvider } from './context/DatabaseAccessContext';

// Import NEXCHEM components
import Nexchem_Dashboard from "./NEXCHEM/Nexchem_Dashboard";
import Nexchem_ItemRecords from "./NEXCHEM/Nexchem_ItemRecords";
import Nexchem_SalesEmployee from "./NEXCHEM/Nexchem_SalesEmployee";
import Nexchem_CustomerRecords from "./NEXCHEM/Nexchem_CustomerRecords";
import Nexchem_RebateSetup from "./NEXCHEM/Nexchem_RebateSetup";
import Nexchem_Reports from "./NEXCHEM/Nexchem_Reports";

// Import VAN components
import Van_Dashboard from "./VAN/Van_Dashboard";
import Van_ItemRecords from "./VAN/Van_ItemRecords";
import Van_SalesEmployee from "./VAN/Van_SalesEmployee";
import Van_CustomerRecords from "./VAN/Van_CustomerRecords";
import Van_RebateSetup from "./VAN/Van_RebateSetup";
import Van_Reports from "./VAN/Van_Reports";

// Import VCP components
import Vcp_Dashboard from "./VCP/Vcp_Dashboard";
import Vcp_ItemRecords from "./VCP/Vcp_ItemRecords";
import Vcp_SalesEmployee from "./VCP/Vcp_SalesEmployee";
import Vcp_CustomerRecords from "./VCP/Vcp_CustomerRecords";
import Vcp_RebateSetup from "./VCP/Vcp_RebateSetup";
import Vcp_Reports from "./VCP/Vcp_Reports";

// Common components
import Settings from "./Settings";
import AccountSetup from "./AccountSetup";

import { AccessControlProvider } from './context/AccessControlContext';

// PrivateRoute wrapper
function PrivateRoute({ isAuthenticated, children }) {
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Professional 404 Page Component
function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4 font-['Poppins']">
      <div className="max-w-2xl w-full text-center">
        {/* Animated 404 Graphic */}
        <div className="relative mb-8">
          <div className="w-48 h-48 mx-auto relative">
            {/* Outer Circle */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full opacity-10 animate-pulse"></div>
            
            {/* Main Circle */}
            <div className="absolute inset-4 bg-white rounded-full shadow-lg flex items-center justify-center">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <span className="text-4xl font-bold text-gray-800">404</span>
                </div>
                <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto"></div>
              </div>
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-bounce"></div>
            <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>

        {/* Content */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
          Page Not Found
        </h1>
        
        <p className="text-lg text-gray-600 mb-2 max-w-md mx-auto">
          Oops! The page you're looking for seems to have wandered off into the digital wilderness.
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center mt-4 gap-2 px-6 py-3 bg-white text-gray-700 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:border-blue-300 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

// Main App component wrapped with providers
function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check for token or user in localStorage
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("currentUser");
    return !!(token || userStr);
  });

  const [loading, setLoading] = useState(true);
  
  // Use refs to track auth state and prevent loops
  const lastAuthCheckRef = useRef({ token: null, user: null });
  const authCheckTimeoutRef = useRef(null);

  useEffect(() => {
    // Quick check on mount
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("currentUser");
    console.log('🔍 App mount - Checking auth:', { 
      hasToken: !!token,
      hasUser: !!userStr, 
      user: userStr ? JSON.parse(userStr)?.User_ID : null 
    });
    
    if (token || userStr) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // FIXED: Listen for auth state changes with debouncing to prevent infinite loops
  useEffect(() => {
    const handleAuthStateChange = () => {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("currentUser");
      
      // Check if auth data actually changed
      const authDataChanged = 
        token !== lastAuthCheckRef.current.token ||
        userStr !== lastAuthCheckRef.current.user;
      
      if (!authDataChanged) {
        // No change, skip update
        return;
      }
      
      // Update refs
      lastAuthCheckRef.current = { token, user: userStr };
      
      const shouldBeAuthenticated = !!(token || userStr);
      
      console.log('🔄 Auth state change detected:', { 
        hasToken: !!token,
        hasUser: !!userStr,
        currentAuthState: isAuthenticated,
        shouldBe: shouldBeAuthenticated 
      });
      
      if (isAuthenticated !== shouldBeAuthenticated) {
        console.log('🔄 Updating auth state to:', shouldBeAuthenticated);
        setIsAuthenticated(shouldBeAuthenticated);
      }
    };

    // FIXED: Reduced polling frequency from 500ms to 2000ms (2 seconds)
    // This prevents the excessive logging you were seeing
    const interval = setInterval(handleAuthStateChange, 2000);
    
    // Also check when window gets focus (with debouncing)
    const handleFocus = () => {
      // Clear any pending timeout
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
      
      // Schedule auth check after a short delay
      authCheckTimeoutRef.current = setTimeout(handleAuthStateChange, 100);
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Also listen for storage events (when localStorage changes in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'currentUser') {
        handleAuthStateChange();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
    };
  }, [isAuthenticated]);

  // Function for AuthPage to notify successful login
  const handleAuthSuccess = (userData) => {
    console.log('🎯 Auth success called from AuthPage:', userData?.User_ID);
    
    // Store user data
    localStorage.setItem("currentUser", JSON.stringify(userData));
    
    // Update refs immediately
    lastAuthCheckRef.current = {
      token: localStorage.getItem("token"),
      user: localStorage.getItem("currentUser")
    };
    
    // Force state update immediately
    setIsAuthenticated(true);
    
    // Force a re-render to ensure routes update
    setTimeout(() => {
      console.log('✅ Auth state updated, should redirect to HomePage');
    }, 0);
  };

  const handleLogout = () => {
    console.log('👋 Logging out...');
    
    // Clear all auth data
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("rememberedUser");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("selectedDB");
    
    // Update refs
    lastAuthCheckRef.current = { token: null, user: null };
    
    // Update state
    setIsAuthenticated(false);
    
    // Force redirect to login
    console.log('✅ Logout complete');
    window.location.href = "/login";
  };

  const handlePasswordChangeSuccess = (userData) => {
    console.log('✅ Password change successful');
    handleAuthSuccess(userData);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Root redirect */}
        <Route
          path="/"
          element={
            isAuthenticated ? 
              <Navigate to="/HomePage" replace /> :
              <Navigate to="/login" replace />
          }
        />

        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
              <Navigate to="/HomePage" replace /> :
              <AuthPage 
                onAuthSuccess={handleAuthSuccess}
                onPasswordChangeSuccess={handlePasswordChangeSuccess}
              />
          } 
        />

        {/* Home Page */}
        <Route
          path="/HomePage"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <HomePage onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* ========== NEXCHEM ROUTES ========== */}
        <Route
          path="/Nexchem_Dashboard"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_Dashboard onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Nexchem_ItemRecords"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_ItemRecords onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Nexchem_SalesEmployee"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_SalesEmployee onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Nexchem_CustomerRecords"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_CustomerRecords onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Nexchem_RebateSetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_RebateSetup onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Nexchem_Reports"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_Reports onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* ========== VAN ROUTES ========== */}
        <Route
          path="/Van_Dashboard"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_Dashboard onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Van_ItemRecords"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_ItemRecords onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Van_SalesEmployee"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_SalesEmployee onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Van_CustomerRecords"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_CustomerRecords onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Van_RebateSetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_RebateSetup onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Van_Reports"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_Reports onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* ========== VCP ROUTES ========== */}
        <Route
          path="/Vcp_Dashboard"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_Dashboard onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Vcp_ItemRecords"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_ItemRecords onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Vcp_SalesEmployee"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_SalesEmployee onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Vcp_CustomerRecords"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_CustomerRecords onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Vcp_RebateSetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_RebateSetup onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/Vcp_Reports"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_Reports onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* Common Routes */}
        <Route
          path="/settings"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Settings onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/accountsetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <AccountSetup onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

// Main App component that wraps everything with providers
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AccessControlProvider>
          <DatabaseAccessProvider>
            <AppContent />
          </DatabaseAccessProvider>
        </AccessControlProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
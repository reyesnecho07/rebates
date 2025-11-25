// App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";

// Import components
import AuthPage from "./components/AuthPage";

// Import NEXCHEM components
import Nexchem_Dashboard from "./NEXCHEM/Nexchem_Dashboard";
import Nexchem_ItemRecords from "./NEXCHEM/Nexchem_ItemRecords";
import Nexchem_SalesEmployee from "./NEXCHEM/Nexchem_SalesEmployee";
import Nexchem_CustomerRecords from "./NEXCHEM/Nexchem_CustomerRecords";
import Nexchem_RebateSetup from "./NEXCHEM/Nexchem_RebateSetup";
import Nexchem_Reports from "./NEXCHEM/Nexchem_Reports";
import Nexchem_Settings from "./NEXCHEM/Nexchem_Settings";

// Import VAN components
import Van_Dashboard from "./VAN/Van_Dashboard";
import Van_ItemRecords from "./VAN/Van_ItemRecords";
import Van_SalesEmployee from "./VAN/Van_SalesEmployee";
import Van_CustomerRecords from "./VAN/Van_CustomerRecords";
import Van_RebateSetup from "./VAN/Van_RebateSetup";
import Van_Reports from "./VAN/Van_Reports";
import Van_Settings from "./VAN/Van_Settings";

// Import VCP components
import Vcp_Dashboard from "./VCP/Vcp_Dashboard";
import Vcp_ItemRecords from "./VCP/Vcp_ItemRecords";
import Vcp_SalesEmployee from "./VCP/Vcp_SalesEmployee";
import Vcp_CustomerRecords from "./VCP/Vcp_CustomerRecords";
import Vcp_RebateSetup from "./VCP/Vcp_RebateSetup";
import Vcp_Reports from "./VCP/Vcp_Reports";
import Vcp_Settings from "./VCP/Vcp_Settings";

// Common components
import Settings from "./Settings";
import AccountSetup from "./AccountSetup";

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
        
        <p className="text-gray-500 mb-8">
          Don't worry, even the best explorers sometimes take wrong turns.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:border-blue-300 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("isAuthenticated") === "true"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAuth = localStorage.getItem("isAuthenticated");
    setIsAuthenticated(storedAuth === "true");
    setLoading(false);
  }, []);

  // UPDATED: login handler using simple-login endpoint with fixed password "abc123"
  const handleLogin = async (userCode, password, database) => {
    try {
      console.log(`Login attempt: ${userCode} in ${database} with password: ${password}`);

      // Use the simple-login endpoint that validates against the selected database
      const response = await fetch("http://192.168.100.193:5000/api/simple-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userCode: userCode.trim(),
          database: database
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Login success
        setIsAuthenticated(true);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("selectedDB", database);

        // Store user data
        const userData = {
          username: data.username,
          role: data.userID,
          database: database
        };
        localStorage.setItem("user", JSON.stringify(userData));

        console.log(`✅ Login successful for ${data.username} in ${database}`);
        return true;
      } else {
        console.log(`❌ Login failed: ${data.message}`);
        return false;
      }
    } catch (err) {
      console.error("Login error:", err);
      return false;
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedDB");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? 
              <Navigate to={`/${localStorage.getItem("selectedDB")?.toLowerCase()}/dashboard`} replace /> : 
              <Navigate to="/login" replace />
          }
        />

        {/* Public Routes */}
        <Route path="/login" element={<AuthPage onLogin={handleLogin} />} />

        {/* NEXCHEM Routes */}
        <Route
          path="/nexchem/dashboard"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/nexchem/items"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_ItemRecords />
            </PrivateRoute>
          }
        />
        <Route
          path="/nexchem/salesemployee"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_SalesEmployee />
            </PrivateRoute>
          }
        />
        <Route
          path="/nexchem/customer"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_CustomerRecords />
            </PrivateRoute>
          }
        />
        <Route
          path="/nexchem/rebatesetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_RebateSetup />
            </PrivateRoute>
          }
        />
        <Route
          path="/nexchem/nexchemreports"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_Reports />
            </PrivateRoute>
          }
        />
        <Route
          path="/nexchem/settings"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Nexchem_Settings />
            </PrivateRoute>
          }
        />

        {/* VAN Routes */}
        <Route
          path="/van/dashboard"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/van/items"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_ItemRecords />
            </PrivateRoute>
          }
        />
        <Route
          path="/van/salesemployee"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_SalesEmployee />
            </PrivateRoute>
          }
        />
        <Route
          path="/van/customer"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_CustomerRecords />
            </PrivateRoute>
          }
        />
        <Route
          path="/van/rebatesetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_RebateSetup />
            </PrivateRoute>
          }
        />
        <Route
          path="/van/vanreports"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_Reports />
            </PrivateRoute>
          }
        />
        <Route
          path="/van/settings"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Van_Settings />
            </PrivateRoute>
          }
        />        

        {/* VCP Routes */}
        <Route
          path="/vcp/dashboard"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/vcp/items"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_ItemRecords />
            </PrivateRoute>
          }
        />
        <Route
          path="/vcp/salesemployee"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_SalesEmployee />
            </PrivateRoute>
          }
        />
        <Route
          path="/vcp/customer"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_CustomerRecords />
            </PrivateRoute>
          }
        />
        <Route
          path="/vcp/rebatesetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_RebateSetup />
            </PrivateRoute>
          }
        />
        <Route
          path="/vcp/vcpreports"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_Reports />
            </PrivateRoute>
          }
        />
        <Route
          path="/vcp/settings"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Vcp_Settings />
            </PrivateRoute>
          }
        />

        {/* Common Routes */}
        <Route
          path="/settings"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Settings />
            </PrivateRoute>
          }
        />
        <Route
          path="/accountsetup"
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <AccountSetup />
            </PrivateRoute>
          }
        />

        {/* Catch-all - Updated with professional 404 page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
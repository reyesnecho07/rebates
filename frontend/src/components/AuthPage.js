import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, Database, User, Lock} from "lucide-react";

// Import side image
import loginImg from "../assets/login.png";

function Login({ onLogin }) {
  const [database, setDatabase] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState({
    database: false,
    userId: false,
    password: false
  });

  const navigate = useNavigate();

  // Load remembered credentials from localStorage
  useEffect(() => {
    const rememberedUser = localStorage.getItem("rememberedUser");
    const rememberedDB = localStorage.getItem("rememberedDB");
    
    if (rememberedUser && rememberedDB) {
      setUserId(rememberedUser);
      setDatabase(rememberedDB);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!database) {
      setError("Please select a database");
      return;
    }
    if (!userId || !password) {
      setError("Please enter both User ID and password");
      return;
    }

    setIsLoading(true);

    try {
      const success = await onLogin(userId.trim(), password, database);
      if (success) {
        // Save to localStorage if remember me is checked
        if (rememberMe) {
          localStorage.setItem("rememberedUser", userId.trim());
          localStorage.setItem("rememberedDB", database);
        } else {
          // Clear if not remembered
          localStorage.removeItem("rememberedUser");
          localStorage.removeItem("rememberedDB");
        }
        
        localStorage.setItem("selectedDB", database);
        
        // Redirect to database-specific dashboard
        switch(database) {
          case "NEXCHEM":
            navigate("/nexchem/dashboard");
            break;
          case "VAN":
            navigate("/van/dashboard");
            break;
          case "VCP":
            navigate("/vcp/dashboard");
            break;
          default:
            navigate("/dashboard");
        }
      } else {
        setError("Invalid User ID or password");
      }
    } catch (err) {
      console.error(err);
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleFocus = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: false }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100 p-4 font-poppins">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-full blur-3xl opacity-30 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-sky-200 to-blue-200 rounded-full blur-3xl opacity-20 animate-pulse delay-500"></div>
      </div>

      <div className="flex bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-blue-500/10 max-w-4xl w-full mx-4 overflow-hidden border border-white/50 relative z-10">
        {/* Image Side */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 items-center justify-center p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10"></div>
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white/10 to-transparent"></div>
          
          <div className="relative z-20 text-center flex flex-col items-center justify-center">
            <img 
              src={loginImg} 
              alt="Login" 
              className="max-w-full h-auto max-h-64 object-contain mb-6 transform hover:scale-105 transition-transform duration-500"
            />
            <h3 className="text-xl font-bold text-white mb-3 font-poppins">
              Rebate Management System
            </h3>
            <p className="text-blue-100 text-base font-poppins">
              Access your dashboard to manage your rebate setup.
            </p>
          </div>

          {/* Floating elements */}
          <div className="absolute top-8 left-8 w-5 h-5 bg-white/20 rounded-full animate-bounce"></div>
          <div className="absolute bottom-12 right-10 w-3 h-3 bg-white/30 rounded-full animate-bounce delay-300"></div>
          <div className="absolute top-24 right-12 w-2 h-2 bg-white/25 rounded-full animate-bounce delay-700"></div>
        </div>

        {/* Form Side */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-sm relative">
            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex items-center justify-center z-20 font-poppins">
                <div className="text-center flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-100 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-transparent border-t-blue-500 rounded-full animate-spin absolute top-0 left-0"></div>
                  </div>
                  <p className="text-gray-600 font-medium">Logging you in...</p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25 mb-4">
                <LogIn className="text-white" size={24} />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2 font-poppins">
                Welcome Back
              </h2>
              <p className="text-gray-500 text-sm font-poppins">
                Sign in to continue
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl mb-4 flex items-center gap-2 shadow-sm font-poppins">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Database Select */}
              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-poppins flex items-center gap-2">
                  <Database size={14} className="text-blue-500" />
                  Database
                </label>
                <div className={`relative transition-all duration-300 ${isFocused.database ? 'transform scale-[1.02]' : ''}`}>
                  <select
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    onFocus={() => handleFocus('database')}
                    onBlur={() => handleBlur('database')}
                    disabled={isLoading}
                    className={`w-full px-10 py-3 border-2 bg-white/50 backdrop-blur-sm rounded-xl outline-none transition-all duration-300 font-poppins appearance-none text-sm ${
                      isFocused.database 
                        ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${isLoading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <option value="" className="font-poppins">-- Select Database --</option>
                    <option value="NEXCHEM" className="font-poppins">NEXCHEM</option>
                    <option value="VAN" className="font-poppins">Vast Animal Nutrition</option>
                    <option value="VCP" className="font-poppins">Vast Crop Protection</option>
                  </select>
                  <Database className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-gray-400 transform rotate-45"></div>
                  </div>
                </div>
              </div>

              {/* User ID Input */}
              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-poppins flex items-center gap-2">
                  <User size={14} className="text-blue-500" />
                  User ID
                </label>
                <div className={`relative transition-all duration-300 ${isFocused.userId ? 'transform scale-[1.02]' : ''}`}>
                  <input
                    type="text"
                    placeholder="Enter your User ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    onFocus={() => handleFocus('userId')}
                    onBlur={() => handleBlur('userId')}
                    required
                    disabled={isLoading}
                    className={`w-full px-10 py-3 border-2 bg-white/50 backdrop-blur-sm rounded-xl outline-none transition-all duration-300 font-poppins text-sm ${
                      isFocused.userId 
                        ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                  />
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </div>

              {/* Password Input */}
              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-poppins flex items-center gap-2">
                  <Lock size={14} className="text-blue-500" />
                  Password
                </label>
                <div className={`relative transition-all duration-300 ${isFocused.password ? 'transform scale-[1.02]' : ''}`}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => handleFocus('password')}
                    onBlur={() => handleBlur('password')}
                    required
                    disabled={isLoading}
                    className={`w-full px-10 py-3 pr-10 border-2 bg-white/50 backdrop-blur-sm rounded-xl outline-none transition-all duration-300 font-poppins text-sm ${
                      isFocused.password 
                        ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 rounded-lg transition-all duration-300 hover:bg-gray-100 disabled:opacity-50 font-poppins"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer group font-poppins">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 border-2 rounded-full transition-all duration-300 flex items-center justify-center group-hover:shadow ${
                      rememberMe 
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600  shadow shadow-blue-500/30" 
                        : "border-gray-300 bg-white group-hover:border-gray-400"
                    } ${isLoading ? "opacity-50" : ""}`}>
                      {rememberMe && (
                        <svg 
                          className="w-3 h-3 text-white" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth="3" 
                            d="M5 13l4 4L19 7" 
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="font-medium">Remember me</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 font-poppins text-sm ${
                  isLoading 
                    ? "opacity-80 cursor-wait" 
                    : "hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
                } disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    Sign In
                  </>
                )}
              </button>

              {/* Footer */}
              <div className="pt-4 border-t border-gray-200/80">
                <p className="text-gray-500 text-xs text-center font-poppins flex items-center justify-center gap-1">
                    Rebate Management System v0.0.1
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
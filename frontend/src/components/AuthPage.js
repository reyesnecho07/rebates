// AuthPage.js - SIMPLIFIED VERSION (Only UsersDB_v1.1 authentication)
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Lock, X, KeyRound, AlertCircle, CheckCircle, Shield, LogIn } from "lucide-react";
import Loading from "../components/common/Loading";
import Rebate from "../assets/Rebate.png";

function Login() {
  const [userCode, setUserCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState({
    userCode: false,
    password: false
  });
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [tempLoginResult, setTempLoginResult] = useState(null);
  const [logoAnimation, setLogoAnimation] = useState(false);
  const [textReveal, setTextReveal] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  
  const navigate = useNavigate();

  // Logo animation sequence
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setLogoAnimation(true);
    }, 300);

    const timer2 = setTimeout(() => {
      setTextReveal(true);
    }, 800);

    const rememberedUser = localStorage.getItem("rememberedUser");
    if (rememberedUser) {
      setUserCode(rememberedUser);
      setRememberMe(true);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

const handlePasswordChange = async (e) => {
  e.preventDefault();
  setPasswordError("");

  if (!newPassword || !confirmPassword) {
    setPasswordError("Both password fields are required");
    return;
  }

  if (newPassword !== confirmPassword) {
    setPasswordError("Passwords do not match");
    return;
  }

  if (newPassword.length < 6) {
    setPasswordError("Password must be at least 6 characters long");
    return;
  }

  setChangingPassword(true);

  try {
    console.log('🔑 Changing password for:', userCode);
    
    const response = await fetch('http://192.168.100.193:3006/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userCode: userCode.trim(),
        currentPassword: password,
        newPassword: newPassword
      })
    });

    console.log('📨 Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('📨 Password change response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Password changed successfully');
      console.log('🔍 Updated user OneLogPwd:', data.user?.OneLogPwd);
      
      // IMPORTANT FIX: Always redirect to HomePage after password change
      // The backend has already updated OneLogPwd to 0
      
      console.log('✅ Password updated, proceeding to HomePage');
      
      // Store the UPDATED user data
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      
      if (rememberMe) {
        localStorage.setItem("rememberedUser", userCode.trim());
      } else {
        localStorage.removeItem("rememberedUser");
      }
      
      // Close modal and clear fields
      setShowChangePasswordModal(false);
      setNewPassword("");
      setConfirmPassword("");
      
      // Clear any temporary login result
      setTempLoginResult(null);
      
      // Redirect to HomePage
      console.log('🏠 Redirecting to HomePage...');
      navigate("/HomePage", { replace: true });
      
    } else {
      setPasswordError(data.error || "Password change failed");
    }
  } catch (err) {
    console.error("❌ Password change error:", err);
    setPasswordError(err.message || "Network error. Please check your connection.");
  } finally {
    setChangingPassword(false);
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setTempLoginResult(null);

    if (!userCode || !password) {
      setError("Please enter both Username and password");
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Authenticating user:', userCode);
      
      const response = await fetch('http://192.168.100.193:3006/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userCode: userCode.trim(),
          password: password
        })
      });

      console.log('📨 Response status:', response.status);
      
      if (!response.ok) {
        // Change the error message for HTTP errors
        const errorMessage = response.status === 401 
          ? "Login failed. Invalid username or password."
          : `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      console.log('📨 Full response:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('✅ Login successful');
        console.log('🔍 User OneLogPwd:', result.user?.OneLogPwd);
        console.log('🔍 isFirstLogin:', result.isFirstLogin);
        
        // CASE 1: If OneLogPwd = 1 (user must change password)
        if (result.user?.OneLogPwd === 1 || result.OneLogPwd === 1) {
          console.log('🔄 OneLogPwd = 1, showing password change modal');
          
          // Store temporary login result for modal
          setTempLoginResult(result);
          
          // Store current credentials for password change
          setShowChangePasswordModal(true);
          setIsLoading(false);
          return;
        }
        
        // CASE 2: OneLogPwd ≠ 1 (normal login - go directly to homepage)
        console.log('✅ OneLogPwd is not 1, redirecting to HomePage');
        
        // Store user data
        localStorage.setItem("currentUser", JSON.stringify(result.user));
        
        if (rememberMe) {
          localStorage.setItem("rememberedUser", userCode.trim());
        } else {
          localStorage.removeItem("rememberedUser");
        }
        
        // Redirect to HomePage
        navigate("/HomePage", { replace: true });
        
      } else {
        console.log('❌ Login failed:', result.error);
        setError("Incorrect credentials. Please check your username and password.");
      }
    } catch (err) {
      console.error("❌ Login error:", err);
      // The error message will already be set appropriately for 401 errors
      setError(err.message || "Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleNewPasswordVisibility = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleFocus = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: true }));
  };

  const handleBlur = (field) => {
    setIsFocused(prev => ({ ...prev, [field]: false }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 font-sans relative overflow-hidden">
      {/* Enhanced Background with subtle patterns - FIXED */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-72 h-72 bg-gradient-to-r from-blue-100/40 to-cyan-100/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/4 -right-32 w-72 h-72 bg-gradient-to-r from-indigo-100/30 to-purple-100/20 rounded-full blur-3xl animate-float-medium delay-1000" />
        <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-gradient-to-r from-cyan-100/20 to-teal-100/15 rounded-full blur-2xl animate-float-fast" />
        <div className="absolute bottom-1/3 right-1/4 w-36 h-36 bg-gradient-to-r from-blue-200/15 to-indigo-200/10 rounded-full blur-xl animate-float-slower" />
        
        {/* Subtle grid pattern - FIXED */}
        <div className="absolute inset-0 bg-[length:60px_60px] bg-repeat opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md">

        <div className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-blue-300/20 overflow-hidden border border-white/90 transition-all duration-700 delay-300 ${logoAnimation ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          
          {/* Enhanced Logo Header */}
          <div className="p-6 bg-gradient-to-br from-blue-50 via-white to-cyan-50 relative overflow-hidden border-b border-blue-100/70">
            {/* Decorative corner accents */}
            <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-blue-200/20 to-transparent rounded-br-full"></div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-cyan-200/20 to-transparent rounded-bl-full"></div>
            
            <div className="relative z-10 flex justify-center">
              <div className={`flex items-center gap-4 transition-all duration-600 ${logoAnimation ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}>
                
                {/* Enhanced Logo Container */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 w-20 h-20 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 blur-lg rounded-full animate-glow" />
                  <div className="absolute inset-0 w-22 h-22 bg-gradient-to-r from-blue-300/10 to-cyan-300/10 rounded-full animate-ping-slow"></div>
                  <div 
                    className={`relative w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-600 cursor-pointer
                                ${logoAnimation ? 'scale-100 rotate-0' : 'scale-50 rotate-180'} 
                                ${logoHover ? 'scale-105 shadow-lg shadow-blue-400/30' : ''}
                                animate-logo-float`}
                    onMouseEnter={() => setLogoHover(true)}
                    onMouseLeave={() => setLogoHover(false)}
                  >
                    {/* Logo border gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 via-white/20 to-cyan-400/30 rounded-2xl p-[2px]">
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center overflow-hidden">
                        <img 
                          src={Rebate} 
                          alt="Rebate System Logo" 
                          className="w-12 h-12 object-contain transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Enhanced Text Content */}
                <div className="relative overflow-hidden">
                  <div className="flex flex-col text-left">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 via-cyan-600 to-slate-800 bg-clip-text text-transparent leading-tight">
                      <span className={`inline-block animate-text-reveal opacity-0 [animation-delay:0.1s] ${textReveal ? 'opacity-100' : 'opacity-0'}`}>
                        Rebate
                      </span>
                      {' '}
                      <span className={`inline-block animate-text-reveal opacity-0 [animation-delay:0.2s] ${textReveal ? 'opacity-100' : 'opacity-0'}`}>
                        Management
                      </span>
                      {' '}
                      <span className={`inline-block animate-text-reveal opacity-0 [animation-delay:0.3s] ${textReveal ? 'opacity-100' : 'opacity-0'}`}>
                        System
                      </span>
                    </h1>
                    
                    <div className="relative mt-0.5">
                      <div className={`h-0.5 bg-gradient-to-r from-blue-300 via-cyan-400 to-blue-300 rounded-full overflow-hidden transition-all duration-900 delay-1000 ${textReveal ? 'w-full opacity-100' : 'w-0 opacity-0'}`}>
                        <div className="h-full w-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                      </div>
                    </div>
                    
                    <div className="overflow-hidden h-6 mt-0.5">
                      <div className="flex items-center gap-1">
                        <Shield size={12} className="text-blue-500" />
                        <p className={`text-slate-600 text-sm font-medium animate-subtitle-reveal opacity-0 ${textReveal ? 'opacity-100' : 'opacity-0'}`}>
                          Secure Authentication Portal
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login Form */}
          <div className="p-6">
            {/* Enhanced Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-gradient-to-r from-red-50/80 to-orange-50/80 backdrop-blur-sm border border-red-200/80 rounded-xl flex items-start gap-3 animate-fade-in shadow-sm">
                <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-orange-400 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                  <AlertCircle className="text-white" size={14} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-sm">Authentication Failed</p>
                  <p className="text-slate-600 text-xs mt-0.5">{error}</p>
                </div>
                <button 
                  onClick={() => setError("")}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Enhanced Username Field */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <User size={10} />
                  Username
                </label>
                <div className={`relative transition-all duration-300 ${isFocused.userCode ? 'scale-[1.01]' : ''}`}>
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <User className="text-slate-500" size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={userCode}
                    onChange={(e) => setUserCode(e.target.value)}
                    onFocus={() => handleFocus('userCode')}
                    onBlur={() => handleBlur('userCode')}
                    required
                    disabled={isLoading}
                    className="w-full px-5 py-3 pl-12 bg-gradient-to-b from-white to-slate-50/80 border-2 border-slate-200/80 rounded-xl outline-none transition-all duration-300 text-slate-900 placeholder-slate-500 text-sm
                            hover:border-slate-300 hover:shadow-sm focus:border-blue-500 focus:ring-3 focus:ring-blue-100/50
                            disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                  />
                  {userCode && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Password Field */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Lock size={10} />
                  Password
                </label>
                <div className={`relative transition-all duration-300 ${isFocused.password ? 'scale-[1.01]' : ''}`}>
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Lock className="text-slate-500" size={16} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => handleFocus('password')}
                    onBlur={() => handleBlur('password')}
                    required
                    disabled={isLoading}
                    className="w-full px-5 py-3 pl-12 pr-10 bg-gradient-to-b from-white to-slate-50/80 border-2 border-slate-200/80 rounded-xl outline-none transition-all duration-300 text-slate-900 placeholder-slate-500 text-sm
                            hover:border-slate-300 hover:shadow-sm focus:border-blue-500 focus:ring-3 focus:ring-blue-100/50
                            disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-blue-600 transition-colors p-1 hover:bg-slate-100 rounded"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Enhanced Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-md border-2 transition-all duration-300 flex items-center justify-center
                                  ${rememberMe 
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400 border-transparent shadow-sm' 
                                    : 'bg-white border-slate-300 group-hover:border-blue-400'
                                  }`}>
                      {rememberMe && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-slate-700 text-xs font-medium group-hover:text-slate-900 transition-colors">
                    Remember me
                  </span>
                </label>
              </div>

              {/* Enhanced Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-5 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white font-semibold rounded-xl transition-all duration-300 text-sm
                         hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group mt-4 border border-blue-500/20`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <LogIn size={16} />
                    <span>Sign In</span>
                  </div>
                )}
              </button>

              {/* Enhanced Version Info */}
              <div className="pt-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-slate-100 to-slate-50 rounded-full border border-slate-200/50">
                  <p className="text-slate-500 text-xs font-medium">
                    Rebate Management System v1.0
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* Bottom Decorative Bar */}
          <div className="h-2 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10"></div>
        </div>
      </div>

      {isLoading && <Loading/>}

      {/* Enhanced Password Change Modal */}
      {showChangePasswordModal && tempLoginResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <div className="bg-gradient-to-br from-white via-white to-slate-50/90 rounded-2xl shadow-2xl shadow-amber-200/20 w-full max-w-md overflow-hidden border border-amber-100/50 backdrop-blur-sm">
            {/* Modal Header */}
            <div className="p-6 border-b bg-gradient-to-r from-amber-50/80 via-orange-50/80 to-amber-50/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-r from-amber-500/10 to-orange-400/10 rounded-xl flex items-center justify-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-400 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <KeyRound size={18} className="text-white" />
                      </div>
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">
                      Password Change Required
                    </h3>
                    <p className="text-slate-600 text-xs mt-0.5">First-time login security measure</p>
                  </div>
                </div>
              </div>
              
              {/* Important Notice */}
              <div className="mt-3 p-3 bg-gradient-to-r from-amber-100/80 to-orange-100/80 border border-amber-300/50 rounded-xl">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle size={12} className="text-white" />
                  </div>
                  <div>
                    <p className="text-amber-900 text-xs font-medium">
                      Security Policy: You must change your password before accessing the system.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Enhanced User Info */}
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 rounded-xl border border-blue-200/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center shadow-sm">
                    <User size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">
                      {tempLoginResult.user?.DisplayName || userCode}
                    </h4>
                    <p className="text-slate-600 text-xs">
                      User ID: {tempLoginResult.user?.User_ID}
                    </p>
                  </div>
                  <div className="px-2 py-1 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border border-green-200">
                    <p className="text-green-700 text-xs font-semibold">First Login</p>
                  </div>
                </div>
              </div>

              {/* Enhanced Error Message */}
              {passwordError && (
                <div className="mb-4 p-3 bg-gradient-to-r from-red-50/80 to-pink-50/80 border border-red-200/80 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-gradient-to-r from-red-500 to-pink-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <X size={10} className="text-white" />
                    </div>
                    <p className="text-red-700 text-sm font-medium">{passwordError}</p>
                  </div>
                </div>
              )}

              {/* Enhanced Password Change Form */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <KeyRound size={10} />
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Lock className="text-slate-500" size={14} />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={changingPassword}
                      className="w-full px-3 py-2.5 pl-10 bg-gradient-to-b from-white to-slate-50/80 border border-slate-300/80 rounded-lg outline-none text-sm transition-all duration-300
                              hover:border-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100/50
                              disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={toggleNewPasswordVisibility}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-amber-600 transition-colors p-0.5 hover:bg-slate-100 rounded"
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <KeyRound size={10} />
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <KeyRound className="text-slate-500" size={14} />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={changingPassword}
                      className="w-full px-3 py-2.5 pl-10 bg-gradient-to-b from-white to-slate-50/80 border border-slate-300/80 rounded-lg outline-none text-sm transition-all duration-300
                              hover:border-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100/50
                              disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={toggleConfirmPasswordVisibility}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-amber-600 transition-colors p-0.5 hover:bg-slate-100 rounded"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Enhanced Password Requirements */}
                <div className="p-4 bg-gradient-to-br from-slate-50/80 to-white rounded-lg border border-slate-200/50">
                  <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Shield size={10} />
                    Security Requirements
                  </p>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${newPassword.length >= 6 ? 'bg-green-500/20' : 'bg-slate-300/20'}`}>
                        {newPassword.length >= 6 ? (
                          <CheckCircle size={8} className="text-green-600" />
                        ) : (
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                        )}
                      </div>
                      <span className={newPassword.length >= 6 ? 'text-green-700 font-medium' : ''}>
                        At least 6 characters
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${newPassword === confirmPassword && newPassword !== '' ? 'bg-green-500/20' : 'bg-slate-300/20'}`}>
                        {newPassword === confirmPassword && newPassword !== '' ? (
                          <CheckCircle size={8} className="text-green-600" />
                        ) : (
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                        )}
                      </div>
                      <span className={newPassword === confirmPassword && newPassword !== '' ? 'text-green-700 font-medium' : ''}>
                        Passwords must match
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Enhanced Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePasswordModal(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError("");
                    }}
                    disabled={changingPassword}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 font-semibold rounded-lg text-sm
                            hover:shadow-sm transition-all duration-300 border border-slate-300/50
                            disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white font-semibold rounded-lg text-sm
                            hover:shadow-lg hover:shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden
                            disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Updating...</span>
                      </div>
                    ) : (
                      "Change Password"
                    )}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default Login;